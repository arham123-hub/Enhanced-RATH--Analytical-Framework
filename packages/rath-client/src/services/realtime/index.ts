import type { IDataFetchRecipe, IRealTimeConfig } from '../../interfaces';
import { PollingManager } from './pollingManager';

export { PollingManager };
export type { PollingError } from './pollingManager';

export function createPollingManager(recipe: IDataFetchRecipe, config: IRealTimeConfig): PollingManager {
    return new PollingManager(recipe, config);
}
