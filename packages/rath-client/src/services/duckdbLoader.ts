/**
 * DuckDB-WASM smart loader for huge files.
 *
 * Standard CSV ingestion in Rath parses the entire file into a JS-heap
 * `IRow[]` before any sampling or stats run, so files larger than ~200K rows
 * crash the tab. This loader sidesteps that path: the raw `File` handle is
 * registered with DuckDB-WASM, ingested via columnar streaming, and only a
 * bounded sample is materialized into JS for the existing pipeline.
 *
 * The DuckDB instance is kept alive on the store (`bigFileHandle`) so future
 * features can run push-down SQL (`SELECT … USING SAMPLE 5 PERCENT`) instead
 * of iterating JS rows.
 */

import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import type { IMuteFieldBase, IRow } from '../interfaces';

export type SupportedExt = 'csv' | 'tsv' | 'parquet' | 'json' | 'ndjson';

export interface BigFileLoadResult {
    db: AsyncDuckDB;
    tableName: string;
    totalRows: number;
    sample: IRow[];
    fields: IMuteFieldBase[];
    elapsedMs: number;
}

export const DEFAULT_BIG_FILE_SAMPLE_ROWS = 200_000;

let dbSingletonPromise: Promise<AsyncDuckDB> | null = null;

const detectExt = (fileName: string): SupportedExt => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.parquet')) return 'parquet';
    if (lower.endsWith('.tsv')) return 'tsv';
    if (lower.endsWith('.ndjson') || lower.endsWith('.jsonl')) return 'ndjson';
    if (lower.endsWith('.json')) return 'json';
    return 'csv';
};

const buildIngestSql = (table: string, virtualPath: string, ext: SupportedExt): string => {
    switch (ext) {
        case 'parquet':
            return `CREATE TABLE ${table} AS SELECT * FROM read_parquet('${virtualPath}')`;
        case 'tsv':
            return `CREATE TABLE ${table} AS SELECT * FROM read_csv_auto('${virtualPath}', delim='\t', SAMPLE_SIZE=-1)`;
        case 'json':
        case 'ndjson':
            return `CREATE TABLE ${table} AS SELECT * FROM read_json_auto('${virtualPath}')`;
        case 'csv':
        default:
            return `CREATE TABLE ${table} AS SELECT * FROM read_csv_auto('${virtualPath}', SAMPLE_SIZE=-1)`;
    }
};

/** Lazy-initialise a single AsyncDuckDB instance and cache it for the session. */
const getDuckDB = async (): Promise<AsyncDuckDB> => {
    if (dbSingletonPromise) return dbSingletonPromise;
    dbSingletonPromise = (async () => {
        const duckdb = await import('@duckdb/duckdb-wasm');
        const bundles = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(bundles);
        const workerUrl = URL.createObjectURL(
            new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
        );
        const worker = new Worker(workerUrl);
        const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? undefined);
        URL.revokeObjectURL(workerUrl);
        return db;
    })().catch(err => {
        dbSingletonPromise = null;
        throw err;
    });
    return dbSingletonPromise;
};

/** Coerce Arrow row values (BigInt, Date, etc.) into IRow-friendly primitives. */
const coerceRow = (raw: Record<string, unknown>): IRow => {
    const out: IRow = {};
    for (const k of Object.keys(raw)) {
        const v = raw[k];
        if (typeof v === 'bigint') {
            const asNum = Number(v);
            out[k] = Number.isSafeInteger(asNum) ? asNum : v.toString();
        } else if (v instanceof Date) {
            out[k] = v.toISOString();
        } else if (v === null || v === undefined) {
            out[k] = '';
        } else {
            out[k] = v as IRow[string];
        }
    }
    return out;
};

const stubFields = (columnNames: readonly string[]): IMuteFieldBase[] =>
    columnNames.map(name => ({
        fid: name,
        name,
        analyticType: '?',
        semanticType: '?',
        geoRole: '?',
    }));

/**
 * Ingest a (potentially huge) file into DuckDB-WASM and return a bounded
 * row sample plus a stub field list. Caller is expected to run the result
 * through the existing infer-and-load pipeline.
 */
export const loadFileWithDuckDB = async (
    file: File,
    sampleRows: number = DEFAULT_BIG_FILE_SAMPLE_ROWS,
    onStage?: (msg: string) => void,
): Promise<BigFileLoadResult> => {
    const t0 = performance.now();
    onStage?.('Booting DuckDB-WASM…');
    const db = await getDuckDB();

    const ext = detectExt(file.name);
    const virtualPath = `input_${Date.now()}.${ext}`;
    const tableName = `rath_big`;

    onStage?.(`Registering ${(file.size / (1024 * 1024)).toFixed(1)} MB file…`);
    const duckdb = await import('@duckdb/duckdb-wasm');
    await db.registerFileHandle(virtualPath, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

    const conn = await db.connect();
    try {
        onStage?.('Streaming into DuckDB columnar store…');
        await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
        await conn.query(buildIngestSql(tableName, virtualPath, ext));

        const countTbl = await conn.query(`SELECT COUNT(*)::BIGINT AS c FROM ${tableName}`);
        const countRow = countTbl.toArray()[0] as { c: bigint | number };
        const totalRows = typeof countRow.c === 'bigint' ? Number(countRow.c) : countRow.c;

        onStage?.(`Sampling ${Math.min(sampleRows, totalRows).toLocaleString()} of ${totalRows.toLocaleString()} rows…`);
        const sampleSql =
            totalRows > sampleRows
                ? `SELECT * FROM ${tableName} USING SAMPLE ${sampleRows} ROWS`
                : `SELECT * FROM ${tableName}`;
        const arrowTbl = await conn.query(sampleSql);
        const rawRows = arrowTbl.toArray() as Array<Record<string, unknown>>;
        const sample = rawRows.map(coerceRow);

        const columnNames = arrowTbl.schema.fields.map(f => f.name);
        const fields = stubFields(columnNames);

        return {
            db,
            tableName,
            totalRows,
            sample,
            fields,
            elapsedMs: performance.now() - t0,
        };
    } finally {
        await conn.close();
    }
};

/** Convenience for demo-time console queries against the loaded big file. */
export const queryBigFile = async (db: AsyncDuckDB, sql: string): Promise<unknown[]> => {
    const conn = await db.connect();
    try {
        const tbl = await conn.query(sql);
        return tbl.toArray();
    } finally {
        await conn.close();
    }
};
