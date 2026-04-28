import { IRow } from 'visual-insights';
/* eslint import/no-webpack-loader-syntax:0 */
// @ts-ignore
// eslint-disable-next-line
import fieldMetaWorker from '../workers/fieldMeta.worker?worker';
import { IFieldMeta, IRawField } from '../interfaces';
import {
    buildProgressiveSchedule,
    materializeSample,
    phaseLabel,
    ProgressivePhase,
} from '../utils/progressiveSampler';
import { workerService } from './base';

export interface ComputeFieldMetaServiceProps {
    dataSource: IRow[];
    fields: IRawField[];
    /** When set, the worker attaches confidence intervals based on this population size. */
    populationSize?: number;
}
export async function computeFieldMetaService(props: ComputeFieldMetaServiceProps): Promise<IFieldMeta[]> {
    let metas: IFieldMeta[] = [];
    try {
        const worker = new fieldMetaWorker();
        const result = await workerService<IFieldMeta[], ComputeFieldMetaServiceProps>(worker, props);
        if (result.success) {
            metas = result.data;
        } else {
            throw new Error('[fieldMeta worker]' + result.message);
        }
        worker.terminate();
    } catch (error) {
        console.error(error);
    }
    return metas;
}

export interface ProgressiveMetaPhaseResult {
    phase: ProgressivePhase;
    label: string;
    sampleSize: number;
    populationSize: number;
    metas: IFieldMeta[];
    elapsedMs: number;
}

/**
 * Run computeFieldMeta in 3 progressive phases (5%, 25%, 100%) so the UI can
 * paint a rough answer with confidence intervals in <500ms and refine it as
 * larger samples complete in the background.
 *
 * For datasets below the progressive threshold, only one full-population
 * phase is emitted.
 */
export async function computeFieldMetaProgressive(
    props: ComputeFieldMetaServiceProps,
    onPhase: (result: ProgressiveMetaPhaseResult) => void,
): Promise<IFieldMeta[]> {
    const { dataSource, fields } = props;
    const totalSize = dataSource.length;
    const schedule = buildProgressiveSchedule(totalSize);
    let lastMetas: IFieldMeta[] = [];
    for (const slice of schedule) {
        const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const sampleRows = slice.phase === 'full' ? dataSource : materializeSample(dataSource, slice.indices);
        const metas = await computeFieldMetaService({
            dataSource: sampleRows,
            fields,
            populationSize: slice.phase === 'full' ? undefined : totalSize,
        });
        const end = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        lastMetas = metas;
        onPhase({
            phase: slice.phase,
            label: phaseLabel(slice.phase),
            sampleSize: slice.sampleSize,
            populationSize: totalSize,
            metas,
            elapsedMs: end - start,
        });
    }
    return lastMetas;
}
