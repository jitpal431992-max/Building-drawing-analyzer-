/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutGrid,
  List,
  ChevronDown,
  Check,
  Printer,
  Loader2,
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { DSRMasterItem, DSRVariantItem, BOQItem, ReviewState, ViewMode, FilterOptions, InventoryRow } from './types';
import {
  getItemTypesByCategory,
  getCategories,
  getItemMinRate,
} from './data/dsrHelpers';
import { STORAGE_KEY_INVENTORY, createEmptyRow } from './data/inventorySchema';
import { Header } from './components/Header';

// Route-level & modal-level lazy code splitting for fast initial load
const FloorPlanMapper = lazy(() =>
  import('./components/FloorPlanMapper').then((m) => ({ default: m.FloorPlanMapper }))
);
const InventoryTable = lazy(() =>
  import('./components/InventoryTable').then((m) => ({ default: m.InventoryTable }))
);
const BuildingLoadCalculation = lazy(() =>
  import('./components/BuildingLoadCalculation').then((m) => ({ default: m.BuildingLoadCalculation }))
);
const McbDbCalculation = lazy(() =>
  import('./components/McbDbCalculation').then((m) => ({ default: m.McbDbCalculation }))
);
const DsrInventoryBoqPage = lazy(() =>
  import('./components/DsrInventoryBoqPage').then((m) => ({ default: m.DsrInventoryBoqPage }))
);
const EstimateBuilder = lazy(() =>
  import('./components/EstimateBuilder').then((m) => ({ default: m.EstimateBuilder }))
);
const ReviewBanner = lazy(() =>
  import('./components/ReviewBanner').then((m) => ({ default: m.ReviewBanner }))
);
const FilterBar = lazy(() =>
  import('./components/FilterBar').then((m) => ({ default: m.FilterBar }))
);
const TagSidebar = lazy(() =>
  import('./components/TagSidebar').then((m) => ({ default: m.TagSidebar }))
);
const ItemCard = lazy(() =>
  import('./components/ItemCard').then((m) => ({ default: m.ItemCard }))
);
const ItemTable = lazy(() =>
  import('./components/ItemTable').then((m) => ({ default: m.ItemTable }))
);
const ItemEditModal = lazy(() =>
  import('./components/ItemEditModal').then((m) => ({ default: m.ItemEditModal }))
);
const VariantEditModal = lazy(() =>
  import('./components/VariantEditModal').then((m) => ({ default: m.VariantEditModal }))
);
const ConfirmationModal = lazy(() =>
  import('./components/ConfirmationModal').then((m) => ({ default: m.ConfirmationModal }))
);
const PdfViewerModal = lazy(() =>
  import('./components/PdfViewerModal').then((m) => ({ default: m.PdfViewerModal }))
);
const ShareModal = lazy(() =>
  import('./components/ShareModal').then((m) => ({ default: m.ShareModal }))
);

const STORAGE_KEY_MASTER_ITEMS = 'dsr_master_items_v4';
const STORAGE_KEY_ESTIMATE = 'dsr_master_estimate_items_v4';

const ViewFallback: React.FC<{ label?: string }> = ({ label = 'Loading workspace...' }) => (
  <div className="bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 rounded-xl p-10 flex items-center justify-center gap-2.5 text-slate-600 dark:text-slate-300 text-xs font-medium">
    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
    <span>{label}</span>
  </div>
);

export default function App() {
  const [items, setItems] = useState<DSRMasterItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(false);
  const [originalCatalogCount, setOriginalCatalogCount] = useState<number>(0);
  const catalogReadyRef = useRef<boolean>(false);
  const catalogPromiseRef = useRef<Promise<void> | null>(null);

  const [estimateItems, setEstimateItems] = useState<BOQItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ESTIMATE);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load estimate from storage:', e);
    }
    return [];
  });

  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INVENTORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: InventoryRow) => ({ ...r, floor: r.floor || 'Ground Floor' }));
        }
      }
    } catch (e) {
      console.error('Failed to load inventory rows:', e);
    }
    return [
      createEmptyRow('Ground Floor'),
      createEmptyRow('Ground Floor'),
      createEmptyRow('Ground Floor'),
    ];
  });

  const [currentView, setCurrentView] = useState<ViewMode>('floor-plan');
  const [displayLayout, setDisplayLayout] = useState<'cards' | 'table'>('cards');
  const [visibleCount, setVisibleCount] = useState(30);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('cpwd_dsr_theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Refs holding latest state for safe beforeunload flushing
  const latestItemsRef = useRef<DSRMasterItem[]>(items);
  latestItemsRef.current = items;
  const latestEstimateRef = useRef<BOQItem[]>(estimateItems);
  latestEstimateRef.current = estimateItems;
  const latestInventoryRef = useRef<InventoryRow[]>(inventoryRows);
  latestInventoryRef.current = inventoryRows;

  // Hydrate the 2.1MB DSR 2025 master catalog asynchronously (idle after paint or on demand)
  const ensureCatalogLoaded = useCallback(async () => {
    if (catalogReadyRef.current) return;
    if (catalogPromiseRef.current) return catalogPromiseRef.current;

    catalogPromiseRef.current = (async () => {
      setIsCatalogLoading(true);
      try {
        let loadedFromStorage: DSRMasterItem[] | null = null;
        try {
          const saved = localStorage.getItem(STORAGE_KEY_MASTER_ITEMS);
          if (saved) {
            const parsed = JSON.parse(saved) as DSRMasterItem[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              const { enrichItemWithSuggestedTags } = await import('./utils/tagAnalyzer');
              loadedFromStorage = parsed.map((it) =>
                !it.isModified && !it.isCustomAdded
                  ? enrichItemWithSuggestedTags(it).item
                  : it
              );
            }
          }
        } catch (e) {
          console.error('Failed to load items from storage:', e);
        }

        if (loadedFromStorage) {
          setItems(loadedFromStorage);
          setOriginalCatalogCount(loadedFromStorage.filter((it) => !it.isCustomAdded).length);
          catalogReadyRef.current = true;
          // Also warm baseline count in background only if needed later
          return;
        }

        const { getInitialDsrMasterItems } = await import('./data/dsrData');
        const baseline = getInitialDsrMasterItems();
        setOriginalCatalogCount(baseline.length);
        setItems(baseline);
        catalogReadyRef.current = true;
      } finally {
        setIsCatalogLoading(false);
        catalogPromiseRef.current = null;
      }
    })();

    return catalogPromiseRef.current;
  }, []);

  // Schedule idle catalog hydration after initial Step 1 paint so landing renders instantaneously
  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const idleId = win.requestIdleCallback(() => {
        void ensureCatalogLoaded();
      }, { timeout: 1200 });
      return () => win.cancelIdleCallback?.(idleId);
    }
    const timer = window.setTimeout(() => {
      void ensureCatalogLoaded();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [ensureCatalogLoaded]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    try {
      localStorage.setItem('cpwd_dsr_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DSRMasterItem | null>(null);

  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [variantModalTarget, setVariantModalTarget] = useState<{
    item: DSRMasterItem;
    variant: DSRVariantItem | null;
    index: number;
  } | null>(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [targetPdfPage, setTargetPdfPage] = useState(20);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Trigger immediate catalog load if navigating to catalog-dependent views or modals
  useEffect(() => {
    if (
      currentView === 'catalog' ||
      currentView === 'review' ||
      currentView === 'dsr-mapping' ||
      currentView === 'estimate' ||
      isEditModalOpen ||
      isConfirmModalOpen
    ) {
      void ensureCatalogLoaded();
    }
  }, [currentView, isEditModalOpen, isConfirmModalOpen, ensureCatalogLoaded]);

  // Filter state
  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: '',
    selectedCategory: 'All categories',
    selectedItemType: 'All item types',
    selectedTags: [],
    sort: 'rel',
    reviewStatus: 'all',
  });

  // UI toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [csvCopied, setCsvCopied] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Debounced localStorage synchronization (guarded until catalog hydration finishes)
  useEffect(() => {
    if (!catalogReadyRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_MASTER_ITEMS, JSON.stringify(items));
      } catch (e) {
        console.error('Failed to persist items to localStorage:', e);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [items]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_ESTIMATE, JSON.stringify(estimateItems));
      } catch (e) {
        console.error('Failed to persist estimate to localStorage:', e);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [estimateItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(inventoryRows));
      } catch (e) {
        console.error('Failed to persist inventory rows:', e);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [inventoryRows]);

  // Flush pending writes before tab close/reload so debounced edits are never lost
  useEffect(() => {
    const flushAll = () => {
      try {
        if (catalogReadyRef.current && latestItemsRef.current.length > 0) {
          localStorage.setItem(STORAGE_KEY_MASTER_ITEMS, JSON.stringify(latestItemsRef.current));
        }
        localStorage.setItem(STORAGE_KEY_ESTIMATE, JSON.stringify(latestEstimateRef.current));
        localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(latestInventoryRef.current));
      } catch {
        // ignore storage quota errors on unload
      }
    };
    window.addEventListener('beforeunload', flushAll);
    return () => window.removeEventListener('beforeunload', flushAll);
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem('dsr_compare_ids_v1');
    } catch {
      // ignore storage errors
    }
  }, []);

  const isCatalogView = currentView === 'catalog' || currentView === 'review';

  // Review State computation
  const reviewState: ReviewState = useMemo(() => {
    if (!catalogReadyRef.current || items.length === 0) {
      return {
        isConfirmed: false,
        totalOriginal: originalCatalogCount,
        totalActive: 0,
        totalModified: 0,
        totalAdded: 0,
        totalDeleted: 0,
        totalVariants: 0,
      };
    }
    let modified = 0;
    let added = 0;
    let deleted = 0;
    let totalVars = 0;

    for (const item of items) {
      if (item.isDeleted) {
        deleted++;
      } else {
        if (item.isCustomAdded) added++;
        else if (item.isModified || (item.variants && item.variants.some(v => v.isModified || v.isDeleted))) {
          modified++;
        }

        if (item.variants && item.variants.length > 0) {
          totalVars += item.variants.filter(v => !v.isDeleted).length;
        } else if (item.r) {
          totalVars += 1;
        }
      }
    }

    const totalActive = items.length - deleted;
    return {
      isConfirmed: false,
      totalOriginal: originalCatalogCount || totalActive,
      totalActive,
      totalModified: modified,
      totalAdded: added,
      totalDeleted: deleted,
      totalVariants: totalVars,
    };
  }, [items, originalCatalogCount]);

  // Gated catalog selectors (only compute when viewing Catalog or Review)
  const categoriesList = useMemo(
    () => (isCatalogView ? getCategories(items) : []),
    [isCatalogView, items]
  );
  const itemTypesList = useMemo(
    () => (isCatalogView ? getItemTypesByCategory(items, filters.selectedCategory) : []),
    [isCatalogView, items, filters.selectedCategory]
  );

  // Pre-compiled search corpus for instant matching (gated to Catalog/Review view)
  const itemsWithSearch = useMemo(() => {
    if (!isCatalogView) return [];
    return items.map((item) => {
      const variantText = (item.variants || []).map((v) => `${v.code} ${v.name} ${v.unit} ${v.rate}`).join(' ');
      const searchBlob = [
        item.c,
        item.g,
        item.h,
        item.t,
        item.s,
        item.d,
        item.gr,
        (item.tg || []).join(' '),
        variantText,
      ].filter(Boolean).join(' ').toLowerCase();

      return {
        item,
        searchBlob,
      };
    });
  }, [isCatalogView, items]);

  // Filter items matching search, category, item type, and status (before tag facets)
  const searchBaseItems = useMemo(() => {
    if (!isCatalogView) return [];
    const queryWords = filters.searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

    return itemsWithSearch
      .filter(({ item, searchBlob }) => {
        if (filters.reviewStatus === 'modified') {
          const isMod = item.isModified || (item.variants && item.variants.some(v => v.isModified));
          if (!isMod || item.isDeleted) return false;
        } else if (filters.reviewStatus === 'added') {
          if (!item.isCustomAdded || item.isDeleted) return false;
        } else if (filters.reviewStatus === 'deleted') {
          if (!item.isDeleted) return false;
        } else if (filters.reviewStatus === 'has-variants') {
          if (!item.variants || item.variants.length === 0 || item.isDeleted) return false;
        } else if (filters.reviewStatus === 'single-item') {
          if (item.variants && item.variants.length > 0) return false;
          if (item.isDeleted) return false;
        } else if (filters.reviewStatus === 'active') {
          if (item.isDeleted) return false;
        }

        if (filters.selectedCategory !== 'All categories' && item.g !== filters.selectedCategory) {
          return false;
        }

        if (filters.selectedItemType !== 'All item types' && item.t !== filters.selectedItemType) {
          return false;
        }

        for (const word of queryWords) {
          if (!searchBlob.includes(word)) return false;
        }

        return true;
      })
      .map(({ item }) => item);
  }, [isCatalogView, itemsWithSearch, filters.reviewStatus, filters.selectedCategory, filters.selectedItemType, filters.searchQuery]);

  // Apply selected tags on top of searchBaseItems
  const filteredItems = useMemo(() => {
    if (!isCatalogView) return [];
    if (filters.selectedTags.length === 0) return searchBaseItems;
    const selectedTagsSet = new Set(filters.selectedTags);
    return searchBaseItems.filter((item) => {
      const itemTags = item.tg || [];
      for (const t of selectedTagsSet) {
        if (!itemTags.includes(t)) return false;
      }
      return true;
    });
  }, [isCatalogView, searchBaseItems, filters.selectedTags]);

  // Sorted items
  const sortedItems = useMemo(() => {
    if (!isCatalogView) return [];
    const list = [...filteredItems];
    if (filters.sort === 'lo') {
      list.sort((a, b) => getItemMinRate(a) - getItemMinRate(b));
    } else if (filters.sort === 'hi') {
      list.sort((a, b) => {
        const minA = getItemMinRate(a);
        const minB = getItemMinRate(b);
        const scoreA = minA === Infinity ? -1 : minA;
        const scoreB = minB === Infinity ? -1 : minB;
        return scoreB - scoreA;
      });
    }
    return list;
  }, [isCatalogView, filteredItems, filters.sort]);

  // Total priced lines in current view
  const totalPricedLines = useMemo(() => {
    if (!isCatalogView) return 0;
    return sortedItems.reduce((acc, it) => {
      if (it.variants && it.variants.length > 0) {
        return acc + it.variants.filter((v) => !v.isDeleted).length;
      }
      return acc + (it.r ? 1 : 0);
    }, 0);
  }, [isCatalogView, sortedItems]);

  // Dynamic tag facets updated based on current search & filters
  const tagFacets = useMemo(() => {
    if (!isCatalogView) return [];
    const counts: Record<string, number> = {};
    for (const it of searchBaseItems) {
      if (it.tg) {
        for (const t of it.tg) {
          counts[t] = (counts[t] || 0) + 1;
        }
      }
    }
    const topEntries = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60);
    const topMap = new Map<string, number>(topEntries);

    const result: [string, number][] = [];
    for (const sel of filters.selectedTags) {
      result.push([sel, counts[sel] || 0]);
      topMap.delete(sel);
    }
    for (const entry of topMap.entries()) {
      result.push(entry);
    }
    return result;
  }, [isCatalogView, searchBaseItems, filters.selectedTags]);

  // Handlers for Item-wise Actions
  const handleEditMasterItem = (item: DSRMasterItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleSaveMasterItem = async (updatedItem: DSRMasterItem) => {
    await ensureCatalogLoaded();
    if (latestItemsRef.current.some(it => it.id === updatedItem.id)) {
      setItems(prev => prev.map(it => (it.id === updatedItem.id ? updatedItem : it)));
      showToast(`Item ${updatedItem.c} updated successfully.`);
    } else {
      setItems(prev => [updatedItem, ...prev]);
      showToast(`Custom item ${updatedItem.c} added to schedule.`);
    }
  };

  const handleDeleteMasterItemToggle = (itemId: string) => {
    const target = latestItemsRef.current.find(i => i.id === itemId);
    setItems(prev =>
      prev.map(it => {
        if (it.id === itemId) {
          return {
            ...it,
            isDeleted: !it.isDeleted,
            isModified: true,
          };
        }
        return it;
      })
    );
    showToast(target?.isDeleted ? `Item ${target.c} restored.` : `Item ${target?.c} marked for deletion.`);
  };

  // Handlers for Variant-wise Actions
  const handleOpenEditVariant = (item: DSRMasterItem, variantIndex: number) => {
    setVariantModalTarget({
      item,
      variant: item.variants[variantIndex] || null,
      index: variantIndex,
    });
    setIsVariantModalOpen(true);
  };

  const handleOpenAddVariant = (item: DSRMasterItem) => {
    setVariantModalTarget({
      item,
      variant: null,
      index: item.variants ? item.variants.length : 0,
    });
    setIsVariantModalOpen(true);
  };

  const handleSaveVariant = (updatedVariant: DSRVariantItem, variantIndex: number) => {
    if (!variantModalTarget) return;
    const parentId = variantModalTarget.item.id;

    setItems(prev =>
      prev.map(it => {
        if (it.id === parentId) {
          const newVariants = [...(it.variants || [])];
          if (variantIndex < newVariants.length) {
            newVariants[variantIndex] = updatedVariant;
          } else {
            newVariants.push(updatedVariant);
          }
          return {
            ...it,
            variants: newVariants,
            isModified: true,
          };
        }
        return it;
      })
    );

    showToast(`Variant ${updatedVariant.code} saved.`);
  };

  const handleDeleteVariantToggle = (item: DSRMasterItem, variantIndex: number) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === item.id) {
          const newVariants = it.variants.map((v, i) =>
            i === variantIndex ? { ...v, isDeleted: !v.isDeleted, isModified: true } : v
          );
          return {
            ...it,
            variants: newVariants,
            isModified: true,
          };
        }
        return it;
      })
    );

    const v = item.variants[variantIndex];
    showToast(v?.isDeleted ? `Variant ${v.code} restored.` : `Variant ${v?.code} deleted.`);
  };

  // Handler for adding an item or variant to the Estimate (supports custom quantity from BOQ direct search)
  const handleAddToEstimate = (
    item: DSRMasterItem,
    variant?: DSRVariantItem,
    quantityToAdd = 1
  ) => {
    const qty = Number.isFinite(quantityToAdd) && quantityToAdd > 0 ? quantityToAdd : 1;
    const isVariant = !!variant;
    const itemCode = isVariant ? variant.code : item.c;
    const subName = isVariant ? variant.name : undefined;
    const desc = isVariant ? `${item.d} — Sub-item: ${variant.name}` : item.d;
    const unit = isVariant ? variant.unit : (item.u || 'Each');
    const rateVal = isVariant ? parseFloat(variant.rate) : (item.r ? parseFloat(item.r) : 0);
    const safeRate = isNaN(rateVal) ? 0 : rateVal;

    const existing = latestEstimateRef.current.find(it => it.itemCode === itemCode);
    if (existing) {
      const nextQty = existing.quantity + qty;
      setEstimateItems(prev =>
        prev.map(it =>
          it.itemCode === itemCode
            ? { ...it, quantity: nextQty, lineTotal: nextQty * it.rate }
            : it
        )
      );
      showToast(`Updated quantity of ${itemCode} to ${nextQty}.`);
      return;
    }

    const newBOQItem: BOQItem = {
      id: `boq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      itemCode,
      parentCode: item.c,
      parentDescription: item.d,
      subItemName: subName,
      description: desc,
      fullSpecification: item.d,
      category: item.g,
      chapter: item.h,
      itemType: item.t,
      unit,
      rate: safeRate,
      quantity: qty,
      lineTotal: qty * safeRate,
      isSubItem: isVariant,
    };

    setEstimateItems(prev => [...prev, newBOQItem]);
    showToast(`Added ${itemCode} (Qty ${qty}) to BOQ Estimate.`);
  };

  // Handler for adding all active variants under one master item at once
  const handleAddAllVariantsToEstimate = (item: DSRMasterItem) => {
    if (!item.variants || item.variants.length === 0) {
      handleAddToEstimate(item);
      return;
    }

    const activeVars = item.variants.filter(v => !v.isDeleted);
    if (activeVars.length === 0) return;

    setEstimateItems(prev => {
      const copy = [...prev];
      for (const v of activeVars) {
        const itemCode = v.code;
        const rateVal = parseFloat(v.rate) || 0;
        const existingIdx = copy.findIndex(it => it.itemCode === itemCode);
        if (existingIdx >= 0) {
          const updatedQty = copy[existingIdx].quantity + 1;
          copy[existingIdx] = {
            ...copy[existingIdx],
            quantity: updatedQty,
            lineTotal: updatedQty * copy[existingIdx].rate,
          };
        } else {
          copy.push({
            id: `boq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            itemCode,
            parentCode: item.c,
            parentDescription: item.d,
            subItemName: v.name,
            description: `${item.d} — Sub-item: ${v.name}`,
            fullSpecification: item.d,
            category: item.g,
            chapter: item.h,
            itemType: item.t,
            unit: v.unit || 'Each',
            rate: rateVal,
            quantity: 1,
            lineTotal: rateVal,
            isSubItem: true,
          });
        }
      }
      return copy;
    });

    showToast(`Added all ${activeVars.length} sub-items under Item ${item.c} to BOQ.`);
  };

  // Remove all sub-items under a parent item
  const handleRemoveGroupFromEstimate = (parentCode: string) => {
    setEstimateItems(prev => prev.filter(it => it.parentCode !== parentCode && it.itemCode !== parentCode));
    showToast(`Removed all sub-items under Item ${parentCode} from BOQ.`);
  };

  // BOQ Estimate management
  const handleUpdateQuantity = (boqItemId: string, qty: number) => {
    setEstimateItems(prev =>
      prev.map(it =>
        it.id === boqItemId
          ? { ...it, quantity: qty, lineTotal: qty * it.rate }
          : it
      )
    );
  };

  const handleRemoveFromEstimate = (boqItemId: string) => {
    setEstimateItems(prev => prev.filter(it => it.id !== boqItemId));
    showToast('Item removed from BOQ.');
  };

  const handleClearEstimate = () => {
    setEstimateItems([]);
    showToast('Estimate cleared.');
  };

  const handleUpdateBoqFromSuggestions = (
    suggestedBoqItems: BOQItem[],
    mode: 'merge' | 'replace'
  ) => {
    if (mode === 'replace') {
      setEstimateItems(suggestedBoqItems);
      showToast(`Replaced BOQ Estimate with ${suggestedBoqItems.length} confirmed DSR items.`);
      return;
    }

    setEstimateItems((prev) => {
      const updated = [...prev];
      for (const incoming of suggestedBoqItems) {
        const existingIdx = updated.findIndex((it) => it.itemCode === incoming.itemCode);
        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            rate: incoming.rate,
            quantity: incoming.quantity,
            lineTotal: incoming.quantity * incoming.rate,
            notes: incoming.notes,
          };
        } else {
          updated.push(incoming);
        }
      }
      return updated;
    });
    showToast(
      `Updated BOQ Estimate with ${suggestedBoqItems.length} confirmed DSR item${
        suggestedBoqItems.length === 1 ? '' : 's'
      }.`
    );
  };

  const handleSyncRoomsFromFloorPlan = (
    mappedRooms: { floor: string; roomName: string; sqmt: number; sqft: number }[],
    mode: 'smart' | 'replace' | 'append'
  ) => {
    const buildNewRow = (m: { floor: string; roomName: string; sqmt: number; sqft: number }) => ({
      ...createEmptyRow(m.floor),
      floor: m.floor,
      room: m.roomName,
      sqmt: m.sqmt > 0 ? String(m.sqmt) : '',
      sqft: m.sqft > 0 ? String(m.sqft) : '',
    });

    const isBlankRow = (r: InventoryRow) =>
      !r.room.trim() && !r.sqmt.trim() && !r.sqft.trim();

    setInventoryRows((prev) => {
      if (mode === 'replace') {
        return mappedRooms.map(buildNewRow);
      }

      const nonBlankPrev = prev.filter((r) => !isBlankRow(r));
      if (mode === 'append') {
        return [...nonBlankPrev, ...mappedRooms.map(buildNewRow)];
      }

      const next = [...nonBlankPrev];
      for (const m of mappedRooms) {
        const keyFloor = m.floor.trim().toLowerCase();
        const keyRoom = m.roomName.trim().toLowerCase();
        const matchIdx = next.findIndex(
          (r) =>
            (r.floor || 'Ground Floor').trim().toLowerCase() === keyFloor &&
            r.room.trim().toLowerCase() === keyRoom
        );
        if (matchIdx >= 0) {
          next[matchIdx] = {
            ...next[matchIdx],
            sqmt: m.sqmt > 0 ? String(m.sqmt) : next[matchIdx].sqmt,
            sqft: m.sqft > 0 ? String(m.sqft) : next[matchIdx].sqft,
          };
        } else {
          next.push(buildNewRow(m));
        }
      }
      return next.length > 0 ? next : mappedRooms.map(buildNewRow);
    });

    setCurrentView('inventory');
    showToast(
      `Synced ${mappedRooms.length} mapped ${mappedRooms.length === 1 ? 'room' : 'rooms'} from floor plan into Inventory.`
    );
  };

  // Tag filter toggle
  const handleToggleTag = (tag: string) => {
    setFilters(prev => {
      const exists = prev.selectedTags.includes(tag);
      return {
        ...prev,
        selectedTags: exists
          ? prev.selectedTags.filter(t => t !== tag)
          : [...prev.selectedTags, tag],
      };
    });
    setVisibleCount(30);
  };

  const handleClearTags = () => {
    setFilters(prev => ({ ...prev, selectedTags: [] }));
  };

  const handleAutoTagCatalog = async () => {
    await ensureCatalogLoaded();
    const { enrichCatalogWithSuggestedTags } = await import('./utils/tagAnalyzer');
    const result = enrichCatalogWithSuggestedTags(latestItemsRef.current);
    if (result.totalTagsAdded === 0) {
      showToast('All catalog items already include suggested description tags.');
      return;
    }
    setItems(result.items);
    showToast(
      `Added ${result.totalTagsAdded} suggested tag${result.totalTagsAdded === 1 ? '' : 's'} across ${result.updatedItems} item${result.updatedItems === 1 ? '' : 's'}.`
    );
  };

  // Copy results as CSV matching the HTML file feature
  const handleCopyResultsCsv = () => {
    const rows = [
      ['Item Code', 'Main Category', 'Chapter', 'Item Type', 'Specification', 'Variant Code', 'Variant Name', 'Unit', 'Rate INR']
    ];

    for (const it of sortedItems) {
      if (it.variants && it.variants.length > 0) {
        for (const v of it.variants) {
          if (!v.isDeleted) {
            rows.push([
              it.c,
              it.g,
              it.h,
              it.t,
              `"${it.d.replace(/"/g, '""')}"`,
              v.code,
              `"${v.name.replace(/"/g, '""')}"`,
              v.unit,
              v.rate,
            ]);
          }
        }
      } else {
        rows.push([
          it.c,
          it.g,
          it.h,
          it.t,
          `"${it.d.replace(/"/g, '""')}"`,
          '',
          '',
          it.u || '',
          it.r || '',
        ]);
      }
    }

    const csvStr = rows.map(r => r.join(',')).join('\n');
    navigator.clipboard.writeText(csvStr);
    setCsvCopied(true);
    showToast('Copied filtered items to clipboard as CSV.');
    setTimeout(() => setCsvCopied(false), 2500);
  };

  // Export full catalog backup as JSON
  const handleDownloadBackup = async () => {
    await ensureCatalogLoaded();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(latestItemsRef.current, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `CPWD_DSR_2025_Catalog_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Exported catalog as JSON.');
  };

  // Reset to original CPWD DSR dataset
  const handleResetOriginal = async () => {
    if (window.confirm('Reset all catalog modifications, custom additions, and deletions back to the original DSR 2025 schedule?')) {
      const { getInitialDsrMasterItems } = await import('./data/dsrData');
      const baseline = getInitialDsrMasterItems();
      setOriginalCatalogCount(baseline.length);
      catalogReadyRef.current = true;
      setItems(baseline);
      try {
        localStorage.removeItem(STORAGE_KEY_MASTER_ITEMS);
      } catch {
        // ignore
      }
      showToast('All changes have been reset to official CPWD DSR (E&M) 2025 baseline.');
    }
  };

  // Confirm final review
  const handleConfirmReview = async () => {
    await ensureCatalogLoaded();
    try {
      localStorage.setItem(STORAGE_KEY_MASTER_ITEMS, JSON.stringify(latestItemsRef.current));
      showToast('Schedule changes successfully confirmed and saved to active catalog.');
      setIsConfirmModalOpen(false);
      setCurrentView('catalog');
    } catch (e) {
      console.error(e);
      showToast('Error saving changes.');
    }
  };

  // Items for confirmation summary (gated to when confirmation modal is open)
  const modifiedItemsList = useMemo(() => {
    if (!isConfirmModalOpen) return [];
    return items.filter(it => !it.isDeleted && (it.isModified || (it.variants && it.variants.some(v => v.isModified))));
  }, [isConfirmModalOpen, items]);

  const addedItemsList = useMemo(() => {
    if (!isConfirmModalOpen) return [];
    return items.filter(it => !it.isDeleted && it.isCustomAdded);
  }, [isConfirmModalOpen, items]);

  const deletedItemsList = useMemo(() => {
    if (!isConfirmModalOpen) return [];
    return items.filter(it => it.isDeleted);
  }, [isConfirmModalOpen, items]);

  return (
    <div className="min-h-screen bg-[#f4f6f9] dark:bg-[#090d14] text-slate-900 dark:text-slate-100 font-sans flex flex-col selection:bg-emerald-500 selection:text-white dark:selection:text-slate-950 transition-colors duration-150">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 px-4 py-2.5 rounded-xl font-semibold shadow-2xl text-xs flex items-center gap-2 border border-emerald-500 dark:border-emerald-400 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-white dark:text-slate-950" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Application Header */}
      <Header
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          if (view === 'pdf-viewer') {
            setIsPdfModalOpen(true);
          }
        }}
        reviewState={reviewState}
        estimateCount={estimateItems.length}
        onOpenConfirmModal={() => setIsConfirmModalOpen(true)}
        onOpenAddItemModal={() => {
          setEditingItem(null);
          setIsEditModalOpen(true);
        }}
        onExportCatalog={handleDownloadBackup}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Container (80% screen width on desktop across all pages) */}
      <main className="flex-1 w-[96%] sm:w-[92%] lg:w-[80%] mx-auto px-2 sm:px-3 py-2.5 sm:py-3">
        <Suspense fallback={<ViewFallback />}>
          {currentView === 'floor-plan' ? (
            /* Step 1: Architectural Floor Plan Mapper before Inventory */
            <FloorPlanMapper
              onSendRoomsToInventory={handleSyncRoomsFromFloorPlan}
              onSkipToInventory={() => setCurrentView('inventory')}
              onNotify={showToast}
            />
          ) : currentView === 'inventory' ? (
            /* Step 2: Inventory Table View (before Building Load & DSR Review) */
            <InventoryTable
              rows={inventoryRows}
              onRowsChange={setInventoryRows}
              onSubmitInventory={() => {
                showToast('Inventory submitted. Building Electrical Load calculated.');
                setCurrentView('building-load');
              }}
              onProceedToNext={() => setCurrentView('review')}
              onNotify={showToast}
            />
          ) : currentView === 'building-load' ? (
            /* Step 3: Building Electrical Load Calculation Page */
            <BuildingLoadCalculation
              rows={inventoryRows}
              onBackToInventory={() => setCurrentView('inventory')}
              onConfirmToMcbDb={() => {
                showToast('Building Load confirmed. Floor-wise MCBDB schedule generated.');
                setCurrentView('mcb-db');
              }}
              onProceedToNext={() => setCurrentView('review')}
              onNotify={showToast}
            />
          ) : currentView === 'mcb-db' ? (
            /* Step 4: MCBDB Calculation Page */
            <McbDbCalculation
              rows={inventoryRows}
              onBackToLoadCalc={() => setCurrentView('building-load')}
              onBackToInventory={() => setCurrentView('inventory')}
              onProceedToNext={() => {
                showToast('MCBDB Schedule confirmed. Review suggested DSR items & update BOQ.');
                setCurrentView('dsr-mapping');
              }}
              onNotify={showToast}
            />
          ) : currentView === 'dsr-mapping' ? (
            /* Step 5: DSR Catalog Suggestions & BOQ Sync Page */
            isCatalogLoading && items.length === 0 ? (
              <ViewFallback label="Loading CPWD DSR 2025 catalog for matching..." />
            ) : (
              <DsrInventoryBoqPage
                rows={inventoryRows}
                catalogItems={items}
                estimateItems={estimateItems}
                onUpdateBoqFromSuggestions={handleUpdateBoqFromSuggestions}
                onBackToMcbDb={() => setCurrentView('mcb-db')}
                onBackToInventory={() => setCurrentView('inventory')}
                onGoToEstimate={() => setCurrentView('estimate')}
                onNotify={showToast}
              />
            )
          ) : currentView === 'estimate' ? (
            /* Estimate / BOQ Builder View */
            <EstimateBuilder
              estimateItems={estimateItems}
              inventoryRows={inventoryRows}
              catalogItems={items}
              onAddCatalogItem={handleAddToEstimate}
              onAddAllVariants={handleAddAllVariantsToEstimate}
              onReorderEstimateItems={setEstimateItems}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveFromEstimate}
              onRemoveGroup={handleRemoveGroupFromEstimate}
              onClearEstimate={handleClearEstimate}
              onBackToCatalog={() => setCurrentView('catalog')}
            />
          ) : isCatalogLoading && items.length === 0 ? (
            <ViewFallback label="Loading CPWD DSR 2025 catalog..." />
          ) : (
            /* Review or Catalog Schedule View */
            <div className="space-y-4">
              {currentView === 'review' && (
                <ReviewBanner
                  reviewState={reviewState}
                  onOpenConfirmModal={() => setIsConfirmModalOpen(true)}
                  onOpenAddItemModal={() => {
                    setEditingItem(null);
                    setIsEditModalOpen(true);
                  }}
                  onResetOriginal={handleResetOriginal}
                  onFilterStatus={(st) => setFilters(prev => ({ ...prev, reviewStatus: st }))}
                  currentStatusFilter={filters.reviewStatus}
                />
              )}

              <FilterBar
                filters={filters}
                categories={categoriesList}
                itemTypes={itemTypesList}
                onFilterChange={(newF) => {
                  setFilters(prev => ({ ...prev, ...newF }));
                  setVisibleCount(30);
                }}
                onResetFilters={() => {
                  setFilters({
                    searchQuery: '',
                    selectedCategory: 'All categories',
                    selectedItemType: 'All item types',
                    selectedTags: [],
                    sort: 'rel',
                    reviewStatus: 'all',
                  });
                  setVisibleCount(30);
                }}
                totalFilteredCount={sortedItems.length}
                totalPricedLines={totalPricedLines}
                totalCatalogCount={items.length}
              />

              {/* Print-Only Catalog Document Header */}
              <div className="print-only border-b-2 border-black pb-2 mb-3 text-center">
                <div className="text-[9pt] font-bold uppercase tracking-wider">
                  GOVERNMENT OF INDIA • CENTRAL PUBLIC WORKS DEPARTMENT
                </div>
                <h2 className="font-black mt-0.5">
                  DELHI SCHEDULE OF RATES (E&amp;M) 2025 — {currentView === 'review' ? 'REVIEW SCHEDULE' : 'CATALOG'}
                </h2>
                <p className="text-[9pt] mt-0.5">
                  {filters.selectedCategory} • {filters.selectedItemType} • {sortedItems.length.toLocaleString()} Items
                </p>
              </div>

              {/* Layout Bar: View toggles (Cards vs Table) & Summary */}
              <div className="no-print flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
                <div className="flex items-center gap-2">
                  <span>Display format:</span>
                  <div className="flex items-center bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => setDisplayLayout('cards')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                        displayLayout === 'cards'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>DSR Cards</span>
                    </button>
                    <button
                      onClick={() => setDisplayLayout('table')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                        displayLayout === 'table'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Compact Table</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span>
                    Showing <strong className="text-slate-900 dark:text-white font-mono">{Math.min(visibleCount, sortedItems.length)}</strong> of <strong className="text-slate-900 dark:text-white font-mono">{sortedItems.length.toLocaleString()}</strong> items
                  </span>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors"
                    title="Print single-column A4 document table"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print A4</span>
                  </button>
                </div>
              </div>

              {/* Main Content Grid: Fixed Tag Facets Aside + Fluid Item List */}
              <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start print-single-column">
                {/* Left Column: Category Tags Sidebar */}
                <div className="no-print">
                  <TagSidebar
                    allTags={tagFacets}
                    selectedTags={filters.selectedTags}
                    onToggleTag={handleToggleTag}
                    onClearTags={handleClearTags}
                    onAutoTagCatalog={handleAutoTagCatalog}
                    onCopyCsv={handleCopyResultsCsv}
                    csvCopied={csvCopied}
                  />
                </div>

                {/* Right Column: Items Feed or Table */}
                <div className="min-w-0 space-y-3">
                  {sortedItems.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
                      <p className="text-slate-600 dark:text-slate-400 text-sm">No matching DSR items found.</p>
                      <button
                        onClick={() =>
                          setFilters({
                            searchQuery: '',
                            selectedCategory: 'All categories',
                            selectedItemType: 'All item types',
                            selectedTags: [],
                            sort: 'rel',
                            reviewStatus: 'all',
                          })
                        }
                        className="no-print px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  ) : displayLayout === 'cards' ? (
                    <>
                      {sortedItems.slice(0, visibleCount).map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          searchQuery={filters.searchQuery}
                          isReviewMode={currentView === 'review'}
                          onEditItem={handleEditMasterItem}
                          onDeleteItemToggle={handleDeleteMasterItemToggle}
                          onEditVariant={handleOpenEditVariant}
                          onDeleteVariantToggle={handleDeleteVariantToggle}
                          onAddVariant={handleOpenAddVariant}
                          onAddToEstimate={handleAddToEstimate}
                          onAddAllVariantsToEstimate={handleAddAllVariantsToEstimate}
                          onTagClick={handleToggleTag}
                          onViewPdfPage={(p) => {
                            setTargetPdfPage(p);
                            setIsPdfModalOpen(true);
                          }}
                        />
                      ))}

                      <div className="print-only">
                        <ItemTable
                          items={sortedItems.slice(0, visibleCount)}
                          isReviewMode={currentView === 'review'}
                          onEdit={handleEditMasterItem}
                          onDeleteToggle={handleDeleteMasterItemToggle}
                          onAddToEstimate={handleAddToEstimate}
                          onTagClick={handleToggleTag}
                          onViewPdfPage={(p) => {
                            setTargetPdfPage(p);
                            setIsPdfModalOpen(true);
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <ItemTable
                      items={sortedItems.slice(0, visibleCount)}
                      isReviewMode={currentView === 'review'}
                      onEdit={handleEditMasterItem}
                      onDeleteToggle={handleDeleteMasterItemToggle}
                      onAddToEstimate={handleAddToEstimate}
                      onTagClick={handleToggleTag}
                      onViewPdfPage={(p) => {
                        setTargetPdfPage(p);
                        setIsPdfModalOpen(true);
                      }}
                    />
                  )}

                  {sortedItems.length > visibleCount && (
                    <div className="py-4 text-center no-print">
                      <button
                        onClick={() => setVisibleCount(prev => prev + 40)}
                        className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-1.5"
                      >
                        <ChevronDown className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                        <span>Show 40 more items ({sortedItems.length - visibleCount} remaining)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Suspense>
      </main>

      {/* Conditionally Mounted Lazy Modals */}
      <Suspense fallback={null}>
        {isEditModalOpen && (
          <ItemEditModal
            isOpen={isEditModalOpen}
            item={editingItem}
            allItems={items}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingItem(null);
            }}
            onSave={handleSaveMasterItem}
          />
        )}

        {isVariantModalOpen && variantModalTarget && (
          <VariantEditModal
            isOpen={isVariantModalOpen}
            itemCode={variantModalTarget.item.c}
            variant={variantModalTarget.variant}
            variantIndex={variantModalTarget.index}
            onClose={() => {
              setIsVariantModalOpen(false);
              setVariantModalTarget(null);
            }}
            onSave={handleSaveVariant}
          />
        )}

        {isConfirmModalOpen && (
          <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={handleConfirmReview}
            reviewState={reviewState}
            modifiedItems={modifiedItemsList}
            addedItems={addedItemsList}
            deletedItems={deletedItemsList}
            onDownloadBackup={handleDownloadBackup}
          />
        )}

        {isPdfModalOpen && (
          <PdfViewerModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            targetPage={targetPdfPage}
          />
        )}

        {isShareModalOpen && (
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            sharedUrl={typeof window !== 'undefined' ? window.location.href : 'https://ais-pre-3ecfb57sfon7a2ka7m3nnb-843606876752.asia-northeast1.run.app'}
          />
        )}
      </Suspense>
      <Analytics />
    </div>
  );
}
