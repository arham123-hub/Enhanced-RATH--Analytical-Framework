// metaList compoent

import React from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { IFieldMeta } from '../../../interfaces';
import { useGlobalStore } from '../../../store';
import DistributionChart from '../metaView/distChart';

const ColumnItem = styled.div`
    padding: 2px;
    margin: 0px 2px 2px 2px;
    /* border-bottom: 1px solid #dedede; */
    cursor: pointer;
    canvas {
        cursor: pointer;
    }
    position: relative;
    .bottom-bar {
        position: absolute;
        height: 2px;
        border-radius: 0px 0px 2px 2px;
        left: 0px;
        right: 0px;
        top: 0px;
        margin: 0px 1px;
    }
    .dimension {
        background-color: #1890ff;
    }
    .measure {
        background-color: #13c2c2;
    }
    .disable {
        background-color: #9e9e9e;
    }
    .change-dot {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #a4262c;
        animation: pulse-dot 1.4s ease-in-out infinite;
    }
    @keyframes pulse-dot {
        0%   { box-shadow: 0 0 0 0 rgba(164, 38, 44, 0.6); }
        70%  { box-shadow: 0 0 0 5px rgba(164, 38, 44, 0); }
        100% { box-shadow: 0 0 0 0 rgba(164, 38, 44, 0); }
    }
`;

const MetaContainer = styled.div`
    flex-grow: 0;
    flex-shrink: 0;
    overflow-y: auto;
    max-height: 600px;
    border-right: 1px solid #dedede;
`;

interface MetaListProps {
    columnIndex: number;
    onColumnIndexChange: (index: number) => void;
    fieldMetas: IFieldMeta[];
}

const MetaList: React.FC<MetaListProps> = (props) => {
    const { fieldMetas, onColumnIndexChange } = props;
    const { dataSourceStore } = useGlobalStore();
    return (
        <MetaContainer>
            {fieldMetas.map((fm, fIndex) => {
                const change = dataSourceStore.significantChanges.get(fm.fid);
                return (
                    <ColumnItem
                        key={fm.fid}
                        onClick={() => {
                            onColumnIndexChange(fIndex);
                        }}
                    >
                        <div className={`${fm.analyticType} bottom-bar`}></div>
                        {change && <div className="change-dot" title={`Mean shifted by ${change.deltaSigmas.toFixed(1)}σ`} />}
                        <h1>{fm.name}</h1>
                        <DistributionChart
                            dataSource={fm.distribution}
                            x="memberName"
                            y="count"
                            height={70}
                            width={220}
                            maxItemInView={16}
                            analyticType={fm.analyticType}
                            semanticType={fm.semanticType}
                        />
                    </ColumnItem>
                );
            })}
        </MetaContainer>
    );
};

export default observer(MetaList);
