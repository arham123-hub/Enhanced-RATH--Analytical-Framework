/**
 * Analytical 95% confidence intervals for sample-based statistics.
 *
 * These are used by the Progressive Analytics Engine to surface uncertainty
 * when stats are computed on a partial sample of the dataset.
 *
 * All `*Ci` helpers return the half-width of the 95% CI (i.e. the `±` value).
 * Callers display the stat as `value ± halfWidth`. A CI of 0 means the stat
 * was computed on the full population (n === populationSize).
 */

const Z_95 = 1.959963984540054;

const finitePopulationCorrection = (sampleSize: number, populationSize: number): number => {
    if (!populationSize || populationSize <= 1) return 1;
    if (sampleSize >= populationSize) return 0;
    const fpc = (populationSize - sampleSize) / (populationSize - 1);
    return fpc > 0 ? Math.sqrt(fpc) : 0;
};

/**
 * 95% CI half-width for the population mean from a sample.
 * Uses the normal-approximation interval with finite population correction.
 */
export const meanCi = (stdev: number, sampleSize: number, populationSize: number): number => {
    if (sampleSize <= 1 || stdev <= 0) return 0;
    const fpc = finitePopulationCorrection(sampleSize, populationSize);
    return Z_95 * (stdev / Math.sqrt(sampleSize)) * fpc;
};

/**
 * 95% CI half-width for the population standard deviation.
 * Uses the asymptotic standard-error approximation se(s) ≈ s / sqrt(2(n-1)).
 */
export const stdevCi = (stdev: number, sampleSize: number, populationSize: number): number => {
    if (sampleSize <= 2 || stdev <= 0) return 0;
    const fpc = finitePopulationCorrection(sampleSize, populationSize);
    return Z_95 * (stdev / Math.sqrt(2 * (sampleSize - 1))) * fpc;
};

/**
 * Wilson-score 95% CI half-width for a proportion (count / sampleSize).
 */
export const proportionCi = (count: number, sampleSize: number, populationSize: number): number => {
    if (sampleSize <= 0) return 0;
    const p = Math.max(0, Math.min(1, count / sampleSize));
    const fpc = finitePopulationCorrection(sampleSize, populationSize);
    return Z_95 * Math.sqrt((p * (1 - p)) / sampleSize) * fpc;
};

/**
 * Approximate 95% CI half-width for a sample quantile.
 * Uses the Maritz-Jarrett approximation se ≈ density-free bound:
 *   se(q_p) ≈ sqrt(p(1-p) / n) * IQR
 * Caller passes the IQR estimate from the sample; if not available falls back to stdev.
 */
export const quantileCi = (
    p: number,
    sampleSize: number,
    populationSize: number,
    spread: number,
): number => {
    if (sampleSize <= 1 || spread <= 0) return 0;
    const fpc = finitePopulationCorrection(sampleSize, populationSize);
    return Z_95 * Math.sqrt((p * (1 - p)) / sampleSize) * spread * fpc;
};

/**
 * Returns true when no useful CI can be reported (full-population computation).
 */
export const isFullPopulation = (sampleSize: number, populationSize: number): boolean =>
    sampleSize >= populationSize;
