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

import React, { FC, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import intl from 'react-intl-universal';
import { Dropdown, IDropdownOption, Slider, Stack, Toggle, TooltipHost } from '@fluentui/react';
import { Button } from '@fluentui/react-components';
import { Play, Pause, Square, RefreshCw, AlertCircle } from 'lucide-react';
import styled from 'styled-components';
import { useGlobalStore } from '../../store';
import { RealTimeMode, RealTimeStatus } from '../../interfaces';

const Wrap = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75em;
    padding: 0.6em 0.8em;
    background: var(--colorNeutralBackground2, #f5f5f5);
    border-radius: 4px;
    margin-top: 0.5em;
    font-size: 0.875rem;
`;

const LiveDot = styled.span<{ status: RealTimeStatus }>`
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    background-color: ${({ status }) => {
        if (status === RealTimeStatus.RUNNING) return '#107c10';
        if (status === RealTimeStatus.PAUSED) return '#e6a117';
        if (status === RealTimeStatus.ERROR) return '#d13438';
        return '#8a8886';
    }};
    ${({ status }) =>
        status === RealTimeStatus.RUNNING
            ? `animation: pulse 1.5s ease-in-out infinite;`
            : ''}

    @keyframes pulse {
        0%   { opacity: 1; }
        50%  { opacity: 0.3; }
        100% { opacity: 1; }
    }
`;

const StatusLabel = styled.span`
    font-weight: 600;
    min-width: 48px;
`;

const Meta = styled.span`
    color: #605e5c;
    font-size: 0.8rem;
`;

const ErrorMsg = styled.span`
    color: #d13438;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 4px;
`;

const NewRowBadge = styled.span`
    display: inline-block;
    background: #107c10;
    color: #fff;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    animation: popIn 0.3s ease-out;

    @keyframes popIn {
        0%   { transform: scale(0.5); opacity: 0; }
        70%  { transform: scale(1.15); }
        100% { transform: scale(1); opacity: 1; }
    }
`;

const INTERVAL_OPTIONS: IDropdownOption[] = [
    { key: 5_000, text: '5s' },
    { key: 10_000, text: '10s' },
    { key: 30_000, text: '30s' },
    { key: 60_000, text: '1m' },
    { key: 300_000, text: '5m' },
    { key: 600_000, text: '10m' },
];

const RealTimeControls: FC = () => {
    const { dataSourceStore } = useGlobalStore();
    const {
        realTimeConfig,
        realTimeStatus,
        realTimeError,
        retryInfo,
        lastRefreshTimestamp,
        refreshCount,
        newRowCount,
        dataFetchRecipe,
        fieldMetas,
    } = dataSourceStore;

    const isIdle = realTimeStatus === RealTimeStatus.IDLE;
    const isRunning = realTimeStatus === RealTimeStatus.RUNNING;
    const isPaused = realTimeStatus === RealTimeStatus.PAUSED;
    const canStart = realTimeConfig.mode !== RealTimeMode.NONE && !!dataFetchRecipe;

    const modeOptions: IDropdownOption[] = [
        { key: RealTimeMode.NONE, text: intl.get('dataSource.realTime.modes.none') },
        { key: RealTimeMode.POLLING_REPLACE, text: intl.get('dataSource.realTime.modes.polling_replace') },
        { key: RealTimeMode.POLLING_APPEND, text: intl.get('dataSource.realTime.modes.polling_append') },
    ];

    const cursorOptions: IDropdownOption[] = fieldMetas.map(f => ({
        key: f.fid,
        text: f.name ?? f.fid,
    }));

    const onModeChange = useCallback((_: any, option?: IDropdownOption) => {
        if (option) {
            dataSourceStore.setRealTimeConfig({ mode: option.key as RealTimeMode });
        }
    }, [dataSourceStore]);

    const onIntervalChange = useCallback((_: any, option?: IDropdownOption) => {
        if (option) {
            dataSourceStore.setRealTimeConfig({ intervalMs: option.key as number });
        }
    }, [dataSourceStore]);

    const onCursorChange = useCallback((_: any, option?: IDropdownOption) => {
        if (option) {
            dataSourceStore.setRealTimeConfig({ cursorField: option.key as string });
        }
    }, [dataSourceStore]);

    const onDebounceChange = useCallback((val: number) => {
        dataSourceStore.setRealTimeConfig({ analysisDebounceMs: val * 1_000 });
    }, [dataSourceStore]);

    const formatTimestamp = (ts: number | null) => {
        if (!ts) return '—';
        return new Date(ts).toLocaleTimeString();
    };

    if (!dataFetchRecipe) {
        return (
            <Wrap>
                <Meta>{intl.get('dataSource.realTime.notAvailable')}</Meta>
            </Wrap>
        );
    }

    return (
        <Wrap>
            {/* Status indicator */}
            <LiveDot status={realTimeStatus} />
            <StatusLabel>
                {intl.get(`dataSource.realTime.status.${realTimeStatus}`)}
            </StatusLabel>

            {/* Mode selector */}
            <Dropdown
                label={intl.get('dataSource.realTime.mode')}
                selectedKey={realTimeConfig.mode}
                options={modeOptions}
                onChange={onModeChange}
                styles={{ root: { minWidth: 200 } }}
                disabled={isRunning}
            />

            {/* Interval selector — shown when a polling mode is active */}
            {realTimeConfig.mode !== RealTimeMode.NONE && (
                <Dropdown
                    label={intl.get('dataSource.realTime.interval')}
                    selectedKey={realTimeConfig.intervalMs}
                    options={INTERVAL_OPTIONS}
                    onChange={onIntervalChange}
                    styles={{ root: { minWidth: 90 } }}
                    disabled={isRunning}
                />
            )}

            {/* Cursor field — shown for append mode */}
            {realTimeConfig.mode === RealTimeMode.POLLING_APPEND && (
                <Dropdown
                    label={intl.get('dataSource.realTime.cursorField')}
                    selectedKey={realTimeConfig.cursorField ?? null}
                    options={cursorOptions}
                    onChange={onCursorChange}
                    styles={{ root: { minWidth: 160 } }}
                    disabled={isRunning}
                />
            )}

            {/* Control buttons */}
            <Stack horizontal tokens={{ childrenGap: 6 }} verticalAlign="end">
                {(isIdle || isPaused) && (
                    <Button
                        appearance="primary"
                        icon={<Play size={14} />}
                        onClick={() => dataSourceStore.startRealTime()}
                        disabled={!canStart}
                    >
                        {isPaused
                            ? intl.get('dataSource.realTime.resume')
                            : intl.get('dataSource.realTime.start')}
                    </Button>
                )}
                {isRunning && (
                    <Button
                        appearance="secondary"
                        icon={<Pause size={14} />}
                        onClick={() => dataSourceStore.pauseRealTime()}
                    >
                        {intl.get('dataSource.realTime.pause')}
                    </Button>
                )}
                {(isRunning || isPaused) && (
                    <Button
                        appearance="subtle"
                        icon={<Square size={14} />}
                        onClick={() => dataSourceStore.stopRealTime()}
                    >
                        {intl.get('dataSource.realTime.stop')}
                    </Button>
                )}
            </Stack>

            {/* Refresh stats */}
            {refreshCount > 0 && (
                <Meta>
                    <RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {intl.get('dataSource.realTime.refreshCount')}: {refreshCount}
                    &nbsp;·&nbsp;
                    {intl.get('dataSource.realTime.lastRefresh')}: {formatTimestamp(lastRefreshTimestamp)}
                </Meta>
            )}

            {/* New rows badge */}
            {newRowCount > 0 && (
                <NewRowBadge key={refreshCount}>+{newRowCount} rows</NewRowBadge>
            )}

            {/* Retry indicator */}
            {retryInfo && !realTimeError && (
                <ErrorMsg style={{ color: '#e6a117' }}>
                    <AlertCircle size={13} />
                    Retry {retryInfo.retryCount}/{retryInfo.maxRetries}...
                </ErrorMsg>
            )}

            {/* Error message */}
            {realTimeError && (
                <ErrorMsg>
                    <AlertCircle size={13} />
                    {realTimeError}
                </ErrorMsg>
            )}

            {/* Auto-retrigger toggles */}
            {realTimeConfig.mode !== RealTimeMode.NONE && (
                <Stack tokens={{ childrenGap: 4 }}>
                    <Meta>{intl.get('dataSource.realTime.autoRetrigger')}</Meta>
                    <Stack horizontal tokens={{ childrenGap: 12 }}>
                        <TooltipHost content={intl.get('dataSource.realTime.semiAuto')}>
                            <Toggle
                                label={intl.get('dataSource.realTime.semiAuto')}
                                checked={realTimeConfig.autoRetrigger.semiAuto}
                                onChange={(_, checked) =>
                                    dataSourceStore.setRealTimeConfig({
                                        autoRetrigger: { ...realTimeConfig.autoRetrigger, semiAuto: !!checked },
                                    })
                                }
                                inlineLabel
                            />
                        </TooltipHost>
                        <TooltipHost content={intl.get('dataSource.realTime.causal')}>
                            <Toggle
                                label={intl.get('dataSource.realTime.causal')}
                                checked={realTimeConfig.autoRetrigger.causal}
                                onChange={(_, checked) =>
                                    dataSourceStore.setRealTimeConfig({
                                        autoRetrigger: { ...realTimeConfig.autoRetrigger, causal: !!checked },
                                    })
                                }
                                inlineLabel
                            />
                        </TooltipHost>
                    </Stack>
                </Stack>
            )}

            {/* Analysis debounce slider */}
            {realTimeConfig.mode !== RealTimeMode.NONE && (
                <Slider
                    label={intl.get('dataSource.realTime.debounce')}
                    min={1}
                    max={60}
                    step={1}
                    value={Math.round(realTimeConfig.analysisDebounceMs / 1_000)}
                    onChange={onDebounceChange}
                    showValue
                    styles={{ root: { minWidth: 180 } }}
                />
            )}
        </Wrap>
    );
};

export default observer(RealTimeControls);
