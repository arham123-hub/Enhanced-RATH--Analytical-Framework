import { observer } from 'mobx-react-lite';
import React from 'react';
import styled from 'styled-components';
import { RealTimeStatus } from '../../../interfaces';
import { useGlobalStore } from '../../../store';

type Mode = 'static' | 'live' | 'final' | 'approx';

const accentFor = (mode: Mode): { fg: string; bg: string } => {
    switch (mode) {
        case 'live':
            return { fg: '#a4262c', bg: '#fdf3f4' };
        case 'final':
            return { fg: '#107c10', bg: '#f3faf3' };
        case 'approx':
        default:
            return { fg: '#0078d4', bg: '#f0f6fc' };
    }
};

const Bar = styled.div<{ $mode: Mode }>`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    margin: 4px 8px 8px 8px;
    border-radius: 6px;
    border: 1px solid ${p => accentFor(p.$mode).fg};
    background: ${p => accentFor(p.$mode).bg};
    font-size: 12px;
    color: #333;
    transition: all 0.3s ease;

    .label {
        font-weight: 600;
        color: ${p => accentFor(p.$mode).fg};
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    .live-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #a4262c;
        animation: live-pulse 1.4s ease-in-out infinite;
    }
    @keyframes live-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(164, 38, 44, 0.6); }
        70%  { box-shadow: 0 0 0 6px rgba(164, 38, 44, 0); }
        100% { box-shadow: 0 0 0 0 rgba(164, 38, 44, 0); }
    }
    .meta {
        color: #666;
    }
    .change-count {
        font-weight: 600;
        color: #a4262c;
        margin-left: 4px;
    }
    .track {
        flex-grow: 1;
        height: 4px;
        background: #e1e1e1;
        border-radius: 2px;
        overflow: hidden;
    }
    .fill {
        height: 100%;
        background: ${p => accentFor(p.$mode).fg};
        transition: width 0.4s ease-out;
    }
    .toggle {
        cursor: pointer;
        color: #0078d4;
        text-decoration: underline;
        background: none;
        border: 0;
        padding: 0;
        font-size: 12px;
    }
`;

const ProgressivePhaseBadge: React.FC = () => {
    const { dataSourceStore } = useGlobalStore();
    const { progressiveStats, progressiveEnabled, realTimeStatus, significantChanges } = dataSourceStore;
    const liveActive = realTimeStatus === RealTimeStatus.RUNNING;

    if (!progressiveEnabled) {
        return (
            <Bar $mode="static">
                <span className="label">Progressive analytics</span>
                <span className="meta">disabled — full-population stats only.</span>
                <div className="track" style={{ visibility: 'hidden' }} />
                <button
                    type="button"
                    className="toggle"
                    onClick={() => dataSourceStore.setProgressiveEnabled(true)}
                >
                    enable
                </button>
            </Bar>
        );
    }

    if (!progressiveStats) return null;

    const { phase, label, sampleSize, populationSize, elapsedMs } = progressiveStats;
    const isFull = phase === 'full';
    const fillPct = phase === 'p5' ? 33 : phase === 'p25' ? 66 : 100;
    const mode: Mode = liveActive ? 'live' : isFull ? 'final' : 'approx';

    let labelText: string;
    if (liveActive) labelText = isFull ? `Live — full snapshot` : `Live — ${label} sample`;
    else labelText = isFull ? 'Final results' : `Approximate (${label} sample)`;

    return (
        <Bar $mode={mode}>
            <span className="label">
                {liveActive && <span className="live-dot" />}
                {labelText}
            </span>
            <span className="meta">
                {sampleSize.toLocaleString()} / {populationSize.toLocaleString()} rows · {Math.round(elapsedMs)} ms
                {!isFull && ' · refining…'}
                {liveActive && significantChanges.size > 0 && (
                    <span className="change-count">
                        · {significantChanges.size} field{significantChanges.size > 1 ? 's' : ''} drifted
                    </span>
                )}
            </span>
            <div className="track">
                <div className="fill" style={{ width: `${fillPct}%` }} />
            </div>
            <button
                type="button"
                className="toggle"
                onClick={() => dataSourceStore.setProgressiveEnabled(false)}
                title="Disable progressive sampling and recompute on the full dataset only."
            >
                disable
            </button>
        </Bar>
    );
};

export default observer(ProgressivePhaseBadge);
