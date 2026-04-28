import React from 'react';
import styled from 'styled-components';
import intl from 'react-intl-universal'
import { observer } from 'mobx-react-lite';
import { IFieldMeta } from '../../../interfaces';
import { useGlobalStore } from '../../../store';
import { formatNumbers } from './utils';

const Table = styled.table`
    font-size: 12px;
    thead {
        font-weight: 500;
        font-size: 14px;
    }
    .ci {
        color: #888;
        font-size: 11px;
        margin-left: 4px;
    }
    .change-pill {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 7px;
        font-size: 10px;
        font-weight: 600;
        border-radius: 9px;
        background: #fde7e9;
        color: #a4262c;
        border: 1px solid #f3b9bd;
        cursor: pointer;
        animation: pulse 1.4s ease-in-out infinite;
        vertical-align: middle;
    }
    @keyframes pulse {
        0%   { box-shadow: 0 0 0 0 rgba(164, 38, 44, 0.4); }
        70%  { box-shadow: 0 0 0 6px rgba(164, 38, 44, 0); }
        100% { box-shadow: 0 0 0 0 rgba(164, 38, 44, 0); }
    }
`

const QuantitativeMetrics: string[] = [
    'min',
    'max',
    'mean',
    'qt_50',
    'qt_25',
    'qt_75',
    'stdev',
]

const CI_METRIC_KEYS = new Set(['mean', 'stdev', 'qt_25', 'qt_50', 'qt_75']);

interface StatTableProps {
    title?: string;
    features: IFieldMeta['features'];
    semanticType: IFieldMeta['semanticType'];
    /** Optional fid; when set, the mean row shows a "changed" pill if real-time detected drift. */
    fid?: string;
}
const StatTable: React.FC<StatTableProps> = (props) => {
    const { title, features, semanticType, fid } = props;
    const { dataSourceStore } = useGlobalStore();
    const ci = features.ci as { [key: string]: number } | undefined;
    const change = fid ? dataSourceStore.significantChanges.get(fid) : undefined;
    return (
        <Table>
            <thead>
                <tr>
                    <td colSpan={2}>{title}</td>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>{intl.get("common.stat.unique")}</td>
                    <td align="right">{features.unique}</td>
                </tr>
                <tr>
                    <td>{intl.get("common.stat.count")}</td>
                    <td align="right">{features.count}</td>
                </tr>
                {semanticType === 'quantitative' && (
                    <React.Fragment>
                        {
                            QuantitativeMetrics.map((metric) => {
                                const ciValue = ci && CI_METRIC_KEYS.has(metric) ? ci[metric] : undefined;
                                const showCi = typeof ciValue === 'number' && ciValue > 0;
                                const showChange = metric === 'mean' && change !== undefined;
                                return (
                                    <tr key={metric}>
                                        <td>{intl.get(`common.stat.${metric}`)}</td>
                                        <td align="right">
                                            {formatNumbers(features[metric])}
                                            {showCi && (
                                                <span className="ci" title="95% confidence interval">
                                                    ± {formatNumbers(Number(ciValue.toPrecision(2)))}
                                                </span>
                                            )}
                                            {showChange && (
                                                <span
                                                    className="change-pill"
                                                    title={`Mean shifted by ${change!.deltaSigmas.toFixed(1)}σ over the last ${change!.gapSeconds.toFixed(0)}s. Click to dismiss.`}
                                                    onClick={() => fid && dataSourceStore.dismissSignificantChange(fid)}
                                                >
                                                    Δ {change!.deltaSigmas.toFixed(1)}σ
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        }
                    </React.Fragment>
                )}
            </tbody>
        </Table>
    );
};

export default observer(StatTable);
