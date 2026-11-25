import rawMasterItems from './dsrMasterItems.json';
import { DSRMasterItem } from '../types';
import { enrichItemWithSuggestedTags } from '../utils/tagAnalyzer';

export {
  CATEGORIES,
  getItemTypesByCategory,
  getCategories,
  getItemMinRate,
  getItemMaxRate,
} from './dsrHelpers';

let cachedInitialItems: DSRMasterItem[] | null = null;

export function getInitialDsrMasterItems(): DSRMasterItem[] {
  if (cachedInitialItems) return cachedInitialItems;
  cachedInitialItems = (rawMasterItems as unknown as DSRMasterItem[]).map((item) => {
    const normalized: DSRMasterItem = {
      ...item,
      isDeleted: false,
      isModified: false,
      isCustomAdded: false,
      variants: item.variants.map((v) => ({
        ...v,
        isDeleted: false,
        isModified: false,
      })),
    };
    return enrichItemWithSuggestedTags(normalized).item;
  });
  return cachedInitialItems;
}

export const INITIAL_DSR_MASTER_ITEMS: DSRMasterItem[] = getInitialDsrMasterItems();
