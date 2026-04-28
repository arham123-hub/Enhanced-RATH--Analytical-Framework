import { buildProgressiveSchedule, materializeSample, PROGRESSIVE_MIN_ROWS } from './progressiveSampler';

describe('progressiveSampler', () => {
    test('returns a single full phase below the progressive threshold', () => {
        const schedule = buildProgressiveSchedule(PROGRESSIVE_MIN_ROWS - 1);
        expect(schedule).toHaveLength(1);
        expect(schedule[0].phase).toBe('full');
        expect(schedule[0].sampleSize).toBe(PROGRESSIVE_MIN_ROWS - 1);
    });

    test('emits 5% / 25% / 100% phases above the threshold', () => {
        const total = 100_000;
        const schedule = buildProgressiveSchedule(total);
        expect(schedule.map(s => s.phase)).toEqual(['p5', 'p25', 'full']);
        expect(schedule[0].sampleSize).toBe(5_000);
        expect(schedule[1].sampleSize).toBe(25_000);
        expect(schedule[2].sampleSize).toBe(total);
    });

    test('25% sample is a strict superset of the 5% sample', () => {
        const schedule = buildProgressiveSchedule(50_000, 42);
        const five = new Set(schedule[0].indices);
        const twentyFive = new Set(schedule[1].indices);
        for (const idx of five) {
            expect(twentyFive.has(idx)).toBe(true);
        }
    });

    test('materializeSample picks rows by index', () => {
        const rows = [{ a: 0 }, { a: 1 }, { a: 2 }, { a: 3 }];
        expect(materializeSample(rows, [0, 2])).toEqual([{ a: 0 }, { a: 2 }]);
    });

    test('returns deterministic samples when seeded', () => {
        const a = buildProgressiveSchedule(20_000, 7);
        const b = buildProgressiveSchedule(20_000, 7);
        expect(a[0].indices).toEqual(b[0].indices);
    });
});
