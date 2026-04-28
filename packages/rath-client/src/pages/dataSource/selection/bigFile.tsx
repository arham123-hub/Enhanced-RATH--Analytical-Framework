import React, { useCallback, useState } from 'react';
import { PrimaryButton, Stack, MessageBar, MessageBarType, SpinButton, Spinner, SpinnerSize } from '@fluentui/react';
import styled from 'styled-components';
import { IMuteFieldBase, IRow } from '../../../interfaces';
import { DataSourceTag } from '../../../utils/storage';
import { loadFileWithDuckDB, DEFAULT_BIG_FILE_SAMPLE_ROWS } from '../../../services/duckdbLoader';
import { useGlobalStore } from '../../../store';

const Cont = styled.div`
    padding: 1em;
    max-width: 640px;
    .row { margin-bottom: 12px; }
    .hint { color: #666; font-size: 12px; line-height: 1.5; }
    .stage { margin-top: 8px; font-size: 12px; color: #0078d4; }
    .drop {
        border: 2px dashed #c8c8c8;
        border-radius: 6px;
        padding: 24px;
        text-align: center;
        background: #fafafa;
        cursor: pointer;
        &:hover { border-color: #0078d4; background: #f0f6fc; }
    }
    .file-info {
        margin-top: 12px;
        padding: 8px 12px;
        background: #f3faf3;
        border: 1px solid #107c10;
        border-radius: 4px;
        font-size: 13px;
    }
`;

interface BigFileProps {
    onClose: () => void;
    onLoadingFailed: (err: unknown) => void;
    onDataLoaded: (
        fields: IMuteFieldBase[],
        dataSource: IRow[],
        name?: string,
        tag?: DataSourceTag,
    ) => void;
    toggleLoadingAnimation: (on: boolean) => void;
}

const BigFileData: React.FC<BigFileProps> = props => {
    const { onClose, onDataLoaded, onLoadingFailed, toggleLoadingAnimation } = props;
    const { dataSourceStore } = useGlobalStore();
    const [file, setFile] = useState<File | null>(null);
    const [sampleRows, setSampleRows] = useState<number>(DEFAULT_BIG_FILE_SAMPLE_ROWS);
    const [stage, setStage] = useState<string>('');
    const [busy, setBusy] = useState<boolean>(false);

    const onPick = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;
        setFile(files[0]);
    }, []);

    const onIngest = useCallback(async () => {
        if (!file) return;
        setBusy(true);
        toggleLoadingAnimation(true);
        try {
            const result = await loadFileWithDuckDB(file, sampleRows, setStage);
            dataSourceStore.setBigFileHandle(result.db, result.totalRows);
            onDataLoaded(result.fields, result.sample, file.name, DataSourceTag.FILE);
            onClose();
        } catch (err) {
            onLoadingFailed(err);
        } finally {
            setBusy(false);
            toggleLoadingAnimation(false);
            setStage('');
        }
    }, [file, sampleRows, dataSourceStore, onDataLoaded, onClose, onLoadingFailed, toggleLoadingAnimation]);

    return (
        <Cont>
            <MessageBar messageBarType={MessageBarType.info}>
                Big File Mode streams the raw file into DuckDB-WASM (in-browser columnar engine) and loads
                a sample for interactive analysis. The full dataset stays queryable via SQL — no JS-heap
                blow-up on multi-GB files.
            </MessageBar>

            <div className="row" style={{ marginTop: 16 }}>
                <label htmlFor="bf-input">
                    <div className="drop">
                        {file ? (
                            <strong>{file.name}</strong>
                        ) : (
                            <span>Click to choose a CSV / TSV / Parquet / JSON file</span>
                        )}
                    </div>
                </label>
                <input
                    id="bf-input"
                    type="file"
                    accept=".csv,.tsv,.parquet,.json,.ndjson,.jsonl"
                    style={{ display: 'none' }}
                    onChange={e => onPick(e.target.files)}
                />
                {file && (
                    <div className="file-info">
                        Size: {(file.size / (1024 * 1024)).toFixed(1)} MB · Type: {file.type || 'auto-detect'}
                    </div>
                )}
            </div>

            <div className="row">
                <SpinButton
                    label="Sample rows to materialize"
                    value={String(sampleRows)}
                    min={10_000}
                    max={1_000_000}
                    step={50_000}
                    onChange={(_, val) => {
                        const n = Number(val);
                        if (Number.isFinite(n)) setSampleRows(Math.max(10_000, Math.min(1_000_000, n)));
                    }}
                />
                <div className="hint">
                    Stats and visualizations run on this sample. The full dataset remains in DuckDB and
                    can be queried via <code>window.__rathBigFile.db</code> at the console.
                </div>
            </div>

            <Stack horizontal tokens={{ childrenGap: 12 }}>
                <PrimaryButton text="Ingest with DuckDB" disabled={!file || busy} onClick={onIngest} />
                {busy && <Spinner size={SpinnerSize.small} label={stage || 'Working…'} labelPosition="right" />}
            </Stack>

            {stage && !busy && <div className="stage">{stage}</div>}
        </Cont>
    );
};

export default BigFileData;
