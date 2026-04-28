import { PollingManager } from './pollingManager';
import { RealTimeMode } from '../../interfaces';
import type { IRealTimeConfig, IDataFetchRecipe } from '../../interfaces';

// Mock external fetch functions
jest.mock('../../pages/dataConnection/database/service', () => ({
    fetchQueryResult: jest.fn(),
}));
jest.mock('../../pages/dataSource/selection/jsonAPI/utils', () => ({
    requestJSONAPIData: jest.fn(),
    jsonDataFormatChecker: jest.fn(() => 'array'),
    getFullData: jest.fn((raw) => ({ dataSource: raw, fields: [] })),
}));

const { requestJSONAPIData } = require('../../pages/dataSource/selection/jsonAPI/utils');

/**
 * Flush pending microtasks so RxJS switchMap → from(Promise) resolves.
 */
async function flush(cycles = 5) {
    for (let i = 0; i < cycles; i++) {
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(0);
    }
}

function makeConfig(overrides: Partial<IRealTimeConfig> = {}): IRealTimeConfig {
    return {
        mode: RealTimeMode.POLLING_REPLACE,
        intervalMs: 1_000,
        analysisDebounceMs: 500,
        autoRetrigger: { semiAuto: false, causal: false },
        maxRetries: 3,
        ...overrides,
    };
}

const recipe: IDataFetchRecipe = {
    type: 'restful',
    apiUrl: 'http://localhost:4000/data',
};

describe('PollingManager', () => {
    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('emits data on each interval tick', async () => {
        const mockData = [{ id: 1, value: 'a' }, { id: 2, value: 'b' }];
        requestJSONAPIData.mockResolvedValue(mockData);

        const config = makeConfig();
        const manager = new PollingManager(recipe, config);

        const collected: any[][] = [];
        const sub = manager.data$.subscribe(rows => collected.push(rows));

        jest.advanceTimersByTime(1_000);
        await flush();

        expect(collected.length).toBe(1);
        expect(collected[0]).toEqual(mockData);

        sub.unsubscribe();
        manager.destroy();
    });

    it('pauses and resumes emissions', async () => {
        const mockData = [{ id: 1 }];
        requestJSONAPIData.mockResolvedValue(mockData);

        const config = makeConfig();
        const manager = new PollingManager(recipe, config);

        const collected: any[][] = [];
        const sub = manager.data$.subscribe(rows => collected.push(rows));

        // First tick — should emit
        jest.advanceTimersByTime(1_000);
        await flush();
        expect(collected.length).toBe(1);

        // Pause — next tick should NOT emit
        manager.pause();
        jest.advanceTimersByTime(1_000);
        await flush();
        expect(collected.length).toBe(1);

        // Resume — next tick should emit
        manager.resume();
        jest.advanceTimersByTime(1_000);
        await flush();
        expect(collected.length).toBe(2);

        sub.unsubscribe();
        manager.destroy();
    });

    it('stops emitting after destroy', async () => {
        const mockData = [{ id: 1 }];
        requestJSONAPIData.mockResolvedValue(mockData);

        const config = makeConfig();
        const manager = new PollingManager(recipe, config);

        const collected: any[][] = [];
        let completed = false;
        const sub = manager.data$.subscribe({
            next: rows => collected.push(rows),
            complete: () => { completed = true; },
        });

        jest.advanceTimersByTime(1_000);
        await flush();
        expect(collected.length).toBe(1);

        manager.destroy();

        jest.advanceTimersByTime(5_000);
        await flush();
        expect(collected.length).toBe(1);
        expect(completed).toBe(true);

        sub.unsubscribe();
    });

    it('filters rows by cursor field in APPEND mode', async () => {
        requestJSONAPIData
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);

        const config = makeConfig({
            mode: RealTimeMode.POLLING_APPEND,
            cursorField: 'id',
        });
        const manager = new PollingManager(recipe, config);

        const collected: any[][] = [];
        const sub = manager.data$.subscribe(rows => collected.push(rows));

        // First tick — no lastCursor, so all rows pass through
        jest.advanceTimersByTime(1_000);
        await flush();
        expect(collected.length).toBe(1);
        expect(collected[0]).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);

        // Second tick — cursor is now 3, so only id=4 passes
        jest.advanceTimersByTime(1_000);
        await flush();
        expect(collected.length).toBe(2);
        expect(collected[1]).toEqual([{ id: 4 }]);

        sub.unsubscribe();
        manager.destroy();
    });

    it('skips emission when cursor filter returns no new rows', async () => {
        requestJSONAPIData
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

        const config = makeConfig({
            mode: RealTimeMode.POLLING_APPEND,
            cursorField: 'id',
        });
        const manager = new PollingManager(recipe, config);

        const collected: any[][] = [];
        const sub = manager.data$.subscribe(rows => collected.push(rows));

        // First tick — all rows
        jest.advanceTimersByTime(1_000);
        await flush();
        expect(collected.length).toBe(1);

        // Second tick — same data, cursor filters everything, no emission
        jest.advanceTimersByTime(1_000);
        await flush();
        expect(collected.length).toBe(1);

        sub.unsubscribe();
        manager.destroy();
    });

    it('emits error info on fetch failure', async () => {
        requestJSONAPIData.mockRejectedValue(new Error('Network error'));

        const config = makeConfig({ maxRetries: 2 });
        const manager = new PollingManager(recipe, config);

        const errors: any[] = [];
        manager.errors$.subscribe(err => errors.push(err));

        const sub = manager.data$.subscribe({ next: () => {}, error: () => {} });

        // Trigger first interval tick
        jest.advanceTimersByTime(1_000);
        await flush();

        // Advance past retry delays (exponential backoff: 2s, 4s)
        jest.advanceTimersByTime(2_000);
        await flush();
        jest.advanceTimersByTime(4_000);
        await flush();
        jest.advanceTimersByTime(8_000);
        await flush();

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toMatchObject({
            retryCount: expect.any(Number),
            maxRetries: 2,
        });

        sub.unsubscribe();
        manager.destroy();
    });
});
