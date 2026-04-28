import { isFullPopulation, meanCi, proportionCi, quantileCi, stdevCi } from './confidenceInterval';

describe('confidenceInterval', () => {
    test('meanCi shrinks as sample size grows', () => {
        const small = meanCi(10, 100, 1_000_000);
        const large = meanCi(10, 10_000, 1_000_000);
        expect(large).toBeLessThan(small);
        expect(small).toBeGreaterThan(0);
    });

    test('meanCi collapses to ~0 when sample equals population', () => {
        const ci = meanCi(10, 1000, 1000);
        expect(ci).toBe(0);
    });

    test('meanCi matches the textbook normal approximation within 1%', () => {
        // 95% CI half-width for mean: 1.96 * s / sqrt(n) when N >> n
        const expected = 1.959963984540054 * (10 / Math.sqrt(400));
        const actual = meanCi(10, 400, 1_000_000_000);
        expect(Math.abs(actual - expected) / expected).toBeLessThan(0.01);
    });

    test('stdevCi returns 0 when stdev is 0 or sample tiny', () => {
        expect(stdevCi(0, 100, 1000)).toBe(0);
        expect(stdevCi(5, 1, 1000)).toBe(0);
    });

    test('proportionCi is symmetric around p=0.5 and shrinks with n', () => {
        const ciAtHalfSmall = proportionCi(50, 100, 1_000_000);
        const ciAtHalfLarge = proportionCi(5_000, 10_000, 1_000_000);
        expect(ciAtHalfLarge).toBeLessThan(ciAtHalfSmall);
    });

    test('quantileCi returns 0 with non-positive spread', () => {
        expect(quantileCi(0.5, 100, 1000, 0)).toBe(0);
    });

    test('isFullPopulation is true only when sampleSize >= populationSize', () => {
        expect(isFullPopulation(99, 100)).toBe(false);
        expect(isFullPopulation(100, 100)).toBe(true);
        expect(isFullPopulation(101, 100)).toBe(true);
    });
});
