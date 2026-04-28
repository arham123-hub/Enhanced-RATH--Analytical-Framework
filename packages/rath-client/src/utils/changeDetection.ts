/**
 * Significant-change detection for streaming/real-time numeric stats.
 *
 * When real-time polling appends rows to a dataset, we want to flag fields
 * whose mean has drifted *significantly* (outside the 95% CI) from where it
 * was N polls ago. This is the statistical bridge between the Real-Time
 * feature (fresh data) and the Progressive Analytics Engine (CI on stats):
 * the CI tells us the noise floor; anything outside it is a real shift.
 */

const Z_95 = 1.959963984540054;

export interface MetricSnapshot {
    /** Field id this snapshot belongs to. */
    fid: string;
    /** Wall-clock time (ms since epoch) when the snapshot was recorded. */
    ts: number;
    /** Sample mean. */
    mean: number;
    /** Sample standard deviation. */
    stdev: number;
    /** Sample size used for this snapshot. */
    n: number;
}

export interface ChangeDetectionResult {
    fid: string;
    /** True iff |currentMean − historicalMean| exceeds 1.96·SE_pooled. */
    changed: boolean;
    /** How many CI half-widths the current mean is from the historical mean. */
    deltaSigmas: number;
    historicalMean: number;
    currentMean: number;
    /** Time gap in seconds between the two snapshots being compared. */
    gapSeconds: number;
}

/**
 * Maximum number of snapshots kept per field. Bounded so memory stays small
 * even on long-running real-time sessions.
 */
export const MAX_SNAPSHOT_HISTORY = 50;

/** Append `snap` to `history`, dropping the oldest entry if at capacity. */
export const appendSnapshot = (history: MetricSnapshot[], snap: MetricSnapshot): MetricSnapshot[] => {
    if (history.length >= MAX_SNAPSHOT_HISTORY) {
        return [...history.slice(1), snap];
    }
    return [...history, snap];
};

/**
 * Compare `current` against the snapshot from `lookback` polls ago and decide
 * whether the change is statistically significant at α = 0.05.
 *
 * Returns null when there isn't enough history to compare yet.
 */
export const detectSignificantChange = (
    history: readonly MetricSnapshot[],
    current: MetricSnapshot,
    lookback: number = 5,
): ChangeDetectionResult | null => {
    if (history.length < 1) return null;
    const idx = Math.max(0, history.length - lookback);
    const past = history[idx];
    if (!past || past.n < 2 || current.n < 2) return null;

    // Standard error of each mean estimate (no FPC — we're comparing point-in-time
    // estimates, not constraining to a fixed population). Then pool for the
    // standard error of the difference of independent means.
    const sePast = past.stdev / Math.sqrt(past.n);
    const seCurrent = current.stdev / Math.sqrt(current.n);
    const sePooled = Math.sqrt(sePast * sePast + seCurrent * seCurrent);
    if (sePooled <= 0) return null;

    const delta = current.mean - past.mean;
    const sigmas = Math.abs(delta) / sePooled;

    return {
        fid: current.fid,
        changed: sigmas > Z_95,
        deltaSigmas: sigmas,
        historicalMean: past.mean,
        currentMean: current.mean,
        gapSeconds: Math.max(0, (current.ts - past.ts) / 1000),
    };
};
