import { observer } from 'mobx-react-lite';
import { FC } from 'react';
import intl from 'react-intl-universal';
import { MessageBar, MessageBarType } from '@fluentui/react';
import { useGlobalStore } from '../../store';

const DataInfo: FC = () => {
    const { dataSourceStore } = useGlobalStore();
    const {
        cleanedData,
        rawDataMetaInfo,
        filteredDataMetaInfo,
        mutFields,
        fieldMetas,
        bigFileHandle,
        bigFileTotalRows,
    } = dataSourceStore;

    return (
        <>
            {bigFileHandle && bigFileTotalRows > 0 && (
                <MessageBar messageBarType={MessageBarType.success} styles={{ root: { marginBottom: 4 } }}>
                    <strong>Big File (DuckDB)</strong> · {bigFileTotalRows.toLocaleString()} total rows in
                    DuckDB · {rawDataMetaInfo.length.toLocaleString()} loaded as in-memory sample
                    {bigFileTotalRows > rawDataMetaInfo.length && (
                        <>
                            {' '}({((rawDataMetaInfo.length / bigFileTotalRows) * 100).toFixed(2)}%)
                        </>
                    )}
                </MessageBar>
            )}
            <MessageBar>
                {intl.get('dataSource.rowsInViews', {
                    origin: rawDataMetaInfo.length,
                    originCols: mutFields.length,
                    select: filteredDataMetaInfo.length,
                    selectCols: fieldMetas.length,
                    clean: cleanedData.length,
                })}
            </MessageBar>
        </>
    );
};

export default observer(DataInfo);