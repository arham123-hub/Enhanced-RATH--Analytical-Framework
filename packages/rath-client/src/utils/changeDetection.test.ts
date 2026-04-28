import {
    appendSnapshot,
    detectSignificantChange,
    MAX_SNAPSHOT_HISTORY,
    MetricSnapshot,
} from './changeDetection';

const snap = (overrides: Partial<MetricSnapshot> = {}): MetricSnapshot => ({
    fid: 'price',
    ts: 1_700_000_000_000,
    mean: 100,
    stdev: 10,
    n: 1000,
    ...overrides,
});

describe('changeDetection', () => {
    test('appendSnapshot caps history at MAX_SNAPSHOT_HISTORY', () => {
        let h: MetricSnapshot[] = [];
        for (let i = 0; i < MAX_SNAPSHOT_HISTORY + 5; i += 1) {
            h = appendSnapshot(h, snap({ ts: i, mean: i }));
        }
        expect(h).toHaveLength(MAX_SNAPSHOT_HISTORY);
        expect(h[0].mean).toBe(5);
        expect(h[h.length - 1].mean).toBe(MAX_SNAPSHOT_HISTORY + 4);
    });

    test('detectSignificantChange returns null with no history', () => {
        const r = detectSignificantChange([], snap());
        expect(r).toBeNull();
    });

    test('flags change when mean drifts far outside historical CI', () => {
        const history = [snap({ ts: 1000, mean: 100, stdev: 10, n: 1000 })];
        const current = snap({ ts: 2000, mean: 110, stdev: 10, n: 1000 });
        const r = detectSignificantChange(history, current);
        expect(r).not.toBeNull();
        expect(r!.changed).toBe(true);
        expect(r!.deltaSigmas).toBeGreaterThan(1.96);
        expect(r!.gapSeconds).toBe(1);
    });

    test('does not flag change when mean is within noise', () => {
        const history = [snap({ mean: 100, stdev: 10, n: 1000 })];
        const current = snap({ mean: 100.1, stdev: 10, n: 1000 });
        const r = detectSignificantChange(history, current);
        expect(r).not.toBeNull();
        expect(r!.changed).toBe(false);
    });

    test('returns null when sample sizes are too small', () => {
        const history = [snap({ n: 1 })];
        const current = snap({ mean: 200, n: 1 });
        expect(detectSignificantChange(history, current)).toBeNull();
    });

    test('lookback selects the right past snapshot', () => {
        const history = [
            snap({ ts: 1000, mean: 100 }),
            snap({ ts: 2000, mean: 105 }),
            snap({ ts: 3000, mean: 200 }),
        ];
        const current = snap({ ts: 4000, mean: 210 });
        // lookback = 1 → compare against the most recent (mean=200), small change
        const r1 = detectSignificantChange(history, current, 1);
        expect(r1!.historicalMean).toBe(200);
        // lookback = 5 → clamps to the oldest available (mean=100), big change
        const r5 = detectSignificantChange(history, current, 5);
        expect(r5!.historicalMean).toBe(100);
        expect(r5!.changed).toBe(true);
    });
});
