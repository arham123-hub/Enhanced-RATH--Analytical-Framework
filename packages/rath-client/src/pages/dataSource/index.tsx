import React, { useCallback, useState } from 'react';
import intl from 'react-intl-universal';
import { Dialog, DialogType, DialogFooter, DefaultButton, PrimaryButton, Stack, Spinner } from '@fluentui/react';
import { observer } from 'mobx-react-lite';
import { Button, Tab, TabList } from '@fluentui/react-components';
import { List, BarChart3, Database, Table } from 'lucide-react';
import { PROGRESSIVE_MIN_ROWS } from '../../utils/progressiveSampler';
import { useGlobalStore } from '../../store';
import { IDataPrepProgressTag, IDataPreviewMode, IDataFetchRecipe, IMuteFieldBase, IRow } from '../../interfaces';
import { DataSourceTag, IDBMeta, setDataStorage } from '../../utils/storage';
import { notify } from '../../components/error';
import DataTable from './dataTable/index';
import MetaView from './metaView/index';
import Selection from './selection/index';
import ImportStorage from './importStorage';
import Advice from './advice';
import FastSelection from './fastSelection';
import ProfilingView from './profilingView';
import MainActionButton from './baseActions/mainActionButton';
import DataOperations from './baseActions/dataOperations';
import DataInfo from './dataInfo';
import RealTimeControls from './realTimeControls';

const MARGIN_LEFT = { marginLeft: '1em' };

interface DataSourceBoardProps {}

interface PendingLoad {
    fields: IMuteFieldBase[];
    dataSource: IRow[];
    name?: string;
    tag?: DataSourceTag;
    withHistory?: IDBMeta;
    recipe?: IDataFetchRecipe;
}

const DataSourceBoard: React.FC<DataSourceBoardProps> = (props) => {
    const { dataSourceStore, megaAutoStore, semiAutoStore } = useGlobalStore();
    const [pendingLoad, setPendingLoad] = useState<PendingLoad | null>(null);

    const { rawDataMetaInfo, loading, showDataImportSelection, dataPreviewMode, dataPrepProgressTag } = dataSourceStore;

    const onSelectPannelClose = useCallback(() => {
        dataSourceStore.setShowDataImportSelection(false);
    }, [dataSourceStore]);

    const commitLoad = useCallback(
        (pending: PendingLoad, progressive: boolean) => {
            dataSourceStore.setProgressiveEnabled(progressive);
            megaAutoStore.init();
            semiAutoStore.init();
            dataSourceStore.loadDataWithInferMetas(pending.dataSource, pending.fields, pending.tag, pending.recipe);
            if (pending.name && pending.tag !== undefined) {
                dataSourceStore.setDatasetId(pending.name);
                setDataStorage(pending.name, pending.fields, pending.dataSource, pending.tag, pending.withHistory);
            }
            dataSourceStore.setShowDataImportSelection(false);
        },
        [dataSourceStore, megaAutoStore, semiAutoStore]
    );

    const onSelectDataLoaded = useCallback(
        (fields: IMuteFieldBase[], dataSource: IRow[], name?: string, tag?: DataSourceTag | undefined, withHistory?: IDBMeta | undefined, recipe?: IDataFetchRecipe) => {
            if (dataSource.length >= PROGRESSIVE_MIN_ROWS) {
                setPendingLoad({ fields, dataSource, name, tag, withHistory, recipe });
            } else {
                dataSourceStore.setProgressiveEnabled(false);
                megaAutoStore.init();
                semiAutoStore.init();
                dataSourceStore.loadDataWithInferMetas(dataSource, fields, tag, recipe);
                if (name && tag !== undefined) {
                    dataSourceStore.setDatasetId(name);
                    setDataStorage(name, fields, dataSource, tag, withHistory);
                }
                dataSourceStore.setShowDataImportSelection(false);
            }
        },
        [dataSourceStore, megaAutoStore, semiAutoStore]
    );

    const onSelectStartLoading = useCallback(() => {
        dataSourceStore.setLoading(true);
    }, [dataSourceStore]);

    const onSelectLoadingFailed = useCallback(
        (err: any) => {
            dataSourceStore.setLoading(false);
            notify({
                type: 'error',
                title: '[Data Loading Error]',
                content: `${err}`,
            });
        },
        [dataSourceStore]
    );

    const toggleLoadingAnimation = useCallback(
        (on: boolean) => {
            dataSourceStore.setLoading(on);
        },
        [dataSourceStore]
    );

    const onDataLoading = useCallback(
        (p: number) => {
            dataSourceStore.setLoadingDataProgress(Math.floor(p * 100) / 100);
        },
        [dataSourceStore]
    );
    return (
        <div className="content-container" style={{ position: 'relative' }}>
            <div>
                <ImportStorage />
                <FastSelection />
                <Dialog
                    hidden={pendingLoad === null}
                    onDismiss={() => setPendingLoad(null)}
                    dialogContentProps={{
                        type: DialogType.normal,
                        title: 'How would you like to load this dataset?',
                        subText: `${pendingLoad?.dataSource.length.toLocaleString()} rows detected. Progressive loading shows instant approximate results with confidence intervals, then refines in the background.`,
                    }}
                    modalProps={{ isBlocking: true }}
                >
                    <DialogFooter>
                        <PrimaryButton
                            text="Progressive Load"
                            title="Show instant 5% → 25% → 100% results with confidence intervals"
                            onClick={() => { if (pendingLoad) { commitLoad(pendingLoad, true); setPendingLoad(null); } }}
                        />
                        <DefaultButton
                            text="Full Load"
                            title="Compute stats on the entire dataset at once"
                            onClick={() => { if (pendingLoad) { commitLoad(pendingLoad, false); setPendingLoad(null); } }}
                        />
                        <DefaultButton
                            text="Cancel"
                            onClick={() => setPendingLoad(null)}
                        />
                    </DialogFooter>
                </Dialog>
                <Stack horizontal>
                    <MainActionButton />
                    <Button
                        appearance={rawDataMetaInfo.length === 0 ? 'primary' : 'secondary'}
                        onClick={() => {
                            dataSourceStore.setShowDataImportSelection(true);
                        }}
                        style={MARGIN_LEFT}
                        icon={<Database />}
                    >
                        {intl.get('dataSource.importData.buttonName')}
                    </Button>

                    {dataPrepProgressTag !== IDataPrepProgressTag.none && (
                        <Spinner style={MARGIN_LEFT} label={dataPrepProgressTag} ariaLive="assertive" labelPosition="right" />
                    )}

                    <Selection
                        show={showDataImportSelection}
                        onDataLoading={onDataLoading}
                        loading={loading}
                        onClose={onSelectPannelClose}
                        onDataLoaded={onSelectDataLoaded}
                        onStartLoading={onSelectStartLoading}
                        onLoadingFailed={onSelectLoadingFailed}
                        setLoadingAnimation={toggleLoadingAnimation}
                    />
                </Stack>
                <hr style={{ margin: '1em 0em 0em 0em' }} />
                <TabList
                    selectedValue={dataPreviewMode}
                    onTabSelect={(e, item) => {
                        item.value && dataSourceStore.setDataPreviewMode(item.value as IDataPreviewMode);
                    }}
                >
                    <Tab value={IDataPreviewMode.data} icon={<Table />}>
                        {intl.get('dataSource.dataView')}
                    </Tab>
                    <Tab value={IDataPreviewMode.meta} icon={<List />}>
                        {intl.get('dataSource.metaView')}
                    </Tab>
                    <Tab value={IDataPreviewMode.stat} icon={<BarChart3 />}>
                        {intl.get('dataSource.statView')}
                    </Tab>
                </TabList>
                {rawDataMetaInfo.length > 0 && <DataOperations />}
                {rawDataMetaInfo.length > 0 && <RealTimeControls />}
                <DataInfo />
                {rawDataMetaInfo.length > 0 && <Advice />}
                {dataPreviewMode === IDataPreviewMode.data && <DataTable />}
                {dataPreviewMode === IDataPreviewMode.meta && <MetaView />}
                {dataPreviewMode === IDataPreviewMode.stat && <ProfilingView />}
            </div>
        </div>
    );
};

export default observer(DataSourceBoard);
