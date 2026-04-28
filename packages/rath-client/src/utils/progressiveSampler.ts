/**
 * Progressive sampling for the Progressive Analytics Engine.
 *
 * Yields three phases (5%, 25%, 100%) so the UI can render an instant rough
 * answer with confidence intervals, then refine as larger samples complete.
 *
 * Sampling strategy is uniform random without replacement (Fisher-Yates style
 * partial shuffle). The 25% sample is a strict superset of the 5% sample so
 * subsequent stats only need to incorporate new rows — and so users see CI
 * bounds shrink monotonically rather than jumping around.
 */

export type ProgressivePhase = 'p5' | 'p25' | 'full';

export interface ProgressiveSchedule {
    phase: ProgressivePhase;
    sampleSize: number;
    /** Indices into the source dataset, sorted ascending. */
    indices: readonly number[];
}

const DEFAULT_RATIOS: Record<Exclude<ProgressivePhase, 'full'>, number> = {
    p5: 0.05,
    p25: 0.25,
};

/** Minimum population size for which progressive sampling is worthwhile. */
export const PROGRESSIVE_MIN_ROWS = 2000;

/**
 * Build a 3-phase progressive schedule.
 * Each phase's index set is a superset of the previous phase, guaranteeing
 * monotonically tightening confidence intervals.
 */
export const buildProgressiveSchedule = (totalSize: number, seed?: number): ProgressiveSchedule[] => {
    if (totalSize <= 0) return [];

    if (totalSize < PROGRESSIVE_MIN_ROWS) {
        const allIdx = Array.from({ length: totalSize }, (_, i) => i);
        return [{ phase: 'full', sampleSize: totalSize, indices: allIdx }];
    }

    const rng = makeRng(seed);
    const shuffled = Array.from({ length: totalSize }, (_, i) => i);
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const size5 = Math.max(1, Math.floor(totalSize * DEFAULT_RATIOS.p5));
    const size25 = Math.max(size5 + 1, Math.floor(totalSize * DEFAULT_RATIOS.p25));

    const idx5 = shuffled.slice(0, size5).sort((a, b) => a - b);
    const idx25 = shuffled.slice(0, size25).sort((a, b) => a - b);
    const idxFull = Array.from({ length: totalSize }, (_, i) => i);

    return [
        { phase: 'p5', sampleSize: size5, indices: idx5 },
        { phase: 'p25', sampleSize: size25, indices: idx25 },
        { phase: 'full', sampleSize: totalSize, indices: idxFull },
    ];
};

/** Materialize a phase's sample rows from the full dataset. */
export const materializeSample = <T>(rows: readonly T[], indices: readonly number[]): T[] => {
    const out = new Array<T>(indices.length);
    for (let i = 0; i < indices.length; i += 1) {
        out[i] = rows[indices[i]];
    }
    return out;
};

const makeRng = (seed?: number): (() => number) => {
    if (seed === undefined) return Math.random;
    let s = seed >>> 0 || 1;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export const phaseLabel = (phase: ProgressivePhase): string => {
    switch (phase) {
        case 'p5':
            return '5%';
        case 'p25':
            return '25%';
        case 'full':
            return '100%';
    }
};
