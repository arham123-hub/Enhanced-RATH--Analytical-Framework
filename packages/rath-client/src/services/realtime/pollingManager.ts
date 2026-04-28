// Copyright (C) 2023 observedobserver
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { Observable, Subject, BehaviorSubject, interval, from, timer } from 'rxjs';
import { switchMap, filter, withLatestFrom, takeUntil, retry, map, tap } from 'rxjs/operators';
import type { IRow, IRealTimeConfig, IDataFetchRecipe } from '../../interfaces';
import { RealTimeMode } from '../../interfaces';
import { fetchQueryResult } from '../../pages/dataConnection/database/service';
import { requestJSONAPIData, jsonDataFormatChecker, getFullData } from '../../pages/dataSource/selection/jsonAPI/utils';

/**
 * Converts the column/rows response from the database connector into IRow[].
 */
function dbResultToRows(columns: string[], rows: (string | number)[][]): IRow[] {
    return rows.map(row => {
        const record: IRow = {};
        columns.forEach((col, i) => {
            record[col] = row[i];
        });
        return record;
    });
}

export interface PollingError {
    error: Error;
    retryCount: number;
    maxRetries: number;
    willRetry: boolean;
}

export class PollingManager {
    public readonly data$: Observable<IRow[]>;
    /** Emits whenever a fetch fails — includes retry count and whether it will retry */
    public readonly errors$ = new Subject<PollingError>();
    private readonly destroy$ = new Subject<void>();
    private readonly paused$ = new BehaviorSubject<boolean>(false);
    private lastCursorValue: any = undefined;
    private consecutiveErrors = 0;

    constructor(recipe: IDataFetchRecipe, private config: IRealTimeConfig) {
        // Initialize cursor from config if resuming
        this.lastCursorValue = config.lastCursor;
        const maxRetries = config.maxRetries ?? 3;

        this.data$ = interval(config.intervalMs).pipe(
            withLatestFrom(this.paused$),
            filter(([, paused]) => !paused),
            switchMap(() =>
                from(this.fetchRows(recipe)).pipe(
                    retry({
                        count: maxRetries,
                        delay: (error, retryCount) => {
                            const delayMs = Math.min(1000 * Math.pow(2, retryCount), 30_000);
                            this.errors$.next({
                                error,
                                retryCount,
                                maxRetries,
                                willRetry: retryCount < maxRetries,
                            });
                            return timer(delayMs);
                        },
                    }),
                )
            ),
            tap({
                next: () => { this.consecutiveErrors = 0; },
                error: (err) => {
                    this.consecutiveErrors++;
                    this.errors$.next({
                        error: err,
                        retryCount: maxRetries,
                        maxRetries,
                        willRetry: false,
                    });
                },
            }),
            map(rows => this.applyCursorFilter(rows)),
            filter(rows => rows.length > 0),
            takeUntil(this.destroy$),
        );
    }

    public pause() {
        this.paused$.next(true);
    }

    public resume() {
        this.paused$.next(false);
    }

    public destroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.errors$.complete();
    }

    /**
     * In APPEND mode with a cursorField set, filter to only rows newer than lastCursorValue.
     * Updates lastCursorValue after filtering.
     */
    private applyCursorFilter(rows: IRow[]): IRow[] {
        const { cursorField, mode } = this.config;
        if (mode !== RealTimeMode.POLLING_APPEND || !cursorField) {
            return rows;
        }

        let filtered: IRow[];
        if (this.lastCursorValue !== undefined) {
            filtered = rows.filter(row => row[cursorField] > this.lastCursorValue);
        } else {
            filtered = rows;
        }

        if (filtered.length > 0) {
            this.lastCursorValue = filtered.reduce(
                (max, row) => (row[cursorField] > max ? row[cursorField] : max),
                filtered[0][cursorField]
            );
        }

        return filtered;
    }

    private async fetchRows(recipe: IDataFetchRecipe): Promise<IRow[]> {
        if (recipe.type === 'database') {
            const server = recipe.dbServer!;
            const result = await fetchQueryResult(server, {
                uri: recipe.dbUri!,
                sourceType: recipe.dbSourceType as any,
                query: recipe.dbQuery!,
                credentials: recipe.dbCredentials,
            });
            return dbResultToRows(result.columns, result.rows as (string | number)[][]);
        }

        if (recipe.type === 'restful') {
            let url = recipe.apiUrl!;
            // Append cursor query param for incremental fetching
            if (this.config.mode === RealTimeMode.POLLING_APPEND
                && this.config.cursorField
                && this.lastCursorValue !== undefined
            ) {
                const separator = url.includes('?') ? '&' : '?';
                url = `${url}${separator}after=${encodeURIComponent(this.lastCursorValue)}`;
            }
            const raw = await requestJSONAPIData(url);
            const format = recipe.apiFormat as any ?? jsonDataFormatChecker(raw);
            const dataset = await getFullData(raw, format);
            return dataset.dataSource;
        }

        return [];
    }
}
