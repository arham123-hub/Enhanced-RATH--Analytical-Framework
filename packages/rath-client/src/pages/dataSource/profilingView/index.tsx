import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import styled from 'styled-components';
import { useGlobalStore } from '../../../store';
import MetaDetail from './metaDetail';
import MetaList from './metaList';
import ProgressivePhaseBadge from './progressiveBadge';

const Wrapper = styled.div`
    border-top: 1px solid #eee;
    margin-top: 8px;
`;

const Cont = styled.div`
    display: flex;
    width: 100%;
    overflow-x: auto;
`;

const ProfilingVieiw: React.FC = (props) => {
    const { dataSourceStore } = useGlobalStore();
    const { fieldMetas } = dataSourceStore;
    const [columnIndex, setColumnIndex] = useState<number>(0);
    if (fieldMetas.length === 0) return <div></div>;
    return (
        <Wrapper>
            <ProgressivePhaseBadge />
            <Cont>
                <MetaList fieldMetas={fieldMetas} onColumnIndexChange={setColumnIndex} columnIndex={columnIndex} />
                <MetaDetail field={fieldMetas[columnIndex]} />
            </Cont>
        </Wrapper>
    );
};

export default observer(ProfilingVieiw);
