import { BOQItem, DSRMasterItem, DSRVariantItem } from '../types';

export interface BOQGroup {
  parentCode: string;
  parentDescription: string;
  category: string;
  chapter?: string;
  itemType: string;
  subItems: BOQItem[];
  isStandalone: boolean;
  groupTotal: number;
}

export function groupBoqItems(estimateItems: BOQItem[]): BOQGroup[] {
  const map = new Map<string, BOQGroup>();
  const order: string[] = [];

  for (const item of estimateItems) {
    const pCode = item.parentCode || item.itemCode;
    if (!map.has(pCode)) {
      order.push(pCode);
      map.set(pCode, {
        parentCode: pCode,
        parentDescription: item.parentDescription || item.fullSpecification || item.description,
        category: item.category,
        chapter: item.chapter,
        itemType: item.itemType,
        subItems: [],
        isStandalone: !item.isSubItem && !item.subItemName,
        groupTotal: 0,
      });
    }

    const grp = map.get(pCode)!;
    grp.subItems.push(item);
    grp.groupTotal += item.lineTotal || 0;
    if (item.isSubItem || item.subItemName) {
      grp.isStandalone = false;
    }
  }

  return order.map((k) => map.get(k)!);
}

/**
 * Reorders entire Main Item groups (and all their child sub-items together)
 * to adjust serial numbering (1, 2, 3...) without breaking parent-child grouping.
 */
export function reorderBoqGroups(
  items: BOQItem[],
  sourceParentCode: string,
  targetParentCode: string
): BOQItem[] {
  if (!sourceParentCode || !targetParentCode || sourceParentCode === targetParentCode) {
    return items;
  }
  const groupOrder: string[] = [];
  const buckets = new Map<string, BOQItem[]>();

  for (const it of items) {
    const pCode = it.parentCode || it.itemCode;
    if (!buckets.has(pCode)) {
      groupOrder.push(pCode);
      buckets.set(pCode, []);
    }
    buckets.get(pCode)!.push(it);
  }

  const fromIdx = groupOrder.indexOf(sourceParentCode);
  const toIdx = groupOrder.indexOf(targetParentCode);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return items;

  const [moved] = groupOrder.splice(fromIdx, 1);
  groupOrder.splice(toIdx, 0, moved);

  const next: BOQItem[] = [];
  for (const pCode of groupOrder) {
    next.push(...buckets.get(pCode)!);
  }
  return next;
}

/**
 * Reorders a sub-item strictly within its own parentCode group (adjusting 1.1, 1.2, 1.3...),
 * leaving all other groups and cross-group items untouched.
 */
export function reorderBoqSubItemWithinGroup(
  items: BOQItem[],
  parentCode: string,
  sourceItemId: string,
  targetItemId: string
): BOQItem[] {
  if (!parentCode || !sourceItemId || !targetItemId || sourceItemId === targetItemId) {
    return items;
  }

  const groupIndices: number[] = [];
  const groupItems: BOQItem[] = [];
  items.forEach((it, idx) => {
    const pCode = it.parentCode || it.itemCode;
    if (pCode === parentCode) {
      groupIndices.push(idx);
      groupItems.push(it);
    }
  });

  const fromSubIdx = groupItems.findIndex((it) => it.id === sourceItemId);
  const toSubIdx = groupItems.findIndex((it) => it.id === targetItemId);
  if (fromSubIdx < 0 || toSubIdx < 0 || fromSubIdx === toSubIdx) {
    return items;
  }

  const [moved] = groupItems.splice(fromSubIdx, 1);
  groupItems.splice(toSubIdx, 0, moved);

  const next = [...items];
  groupIndices.forEach((origIdx, i) => {
    next[origIdx] = groupItems[i];
  });
  return next;
}

export interface BoqDirectSearchEntry {
  key: string;
  code: string;
  parentCode: string;
  parentDescription: string;
  subName?: string;
  category: string;
  chapter: string;
  unit: string;
  rate: number;
  isVariant: boolean;
  activeVariantCount: number;
  item: DSRMasterItem;
  variant?: DSRVariantItem;
  searchBlob: string;
}

export function buildBoqSearchIndex(catalog: DSRMasterItem[]): BoqDirectSearchEntry[] {
  const entries: BoqDirectSearchEntry[] = [];
  for (const item of catalog) {
    if (item.isDeleted) continue;
    const activeVariants = (item.variants || []).filter((v) => !v.isDeleted);
    if (activeVariants.length > 0) {
      for (const v of activeVariants) {
        const rateNum = parseFloat(v.rate);
        entries.push({
          key: `${item.id}::${v.code}`,
          code: v.code,
          parentCode: item.c,
          parentDescription: item.d,
          subName: v.name,
          category: item.g,
          chapter: item.h,
          unit: v.unit || 'Each',
          rate: isNaN(rateNum) ? 0 : rateNum,
          isVariant: true,
          activeVariantCount: activeVariants.length,
          item,
          variant: v,
          searchBlob: `${v.code} ${item.c} ${v.name} ${item.d} ${item.g} ${item.h} ${item.t} ${v.unit}`.toLowerCase(),
        });
      }
    } else if (item.r) {
      const rateNum = parseFloat(item.r);
      entries.push({
        key: item.id,
        code: item.c,
        parentCode: item.c,
        parentDescription: item.d,
        subName: undefined,
        category: item.g,
        chapter: item.h,
        unit: item.u || 'Each',
        rate: isNaN(rateNum) ? 0 : rateNum,
        isVariant: false,
        activeVariantCount: 0,
        item,
        variant: undefined,
        searchBlob: `${item.c} ${item.d} ${item.g} ${item.h} ${item.t} ${item.u || ''}`.toLowerCase(),
      });
    }
  }
  return entries;
}
