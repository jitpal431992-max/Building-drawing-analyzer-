import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileSpreadsheet,
  ListChecks,
  Package,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  ToggleLeft,
  X,
  Zap,
} from 'lucide-react';
import { BOQItem, DSRMasterItem, InventoryRow } from '../types';
import { formatINR } from '../utils/formatters';
import { DEFAULT_MCBDB_SETTINGS, McbDbSettings } from '../data/mcbDbCalculator';
import {
  DEFAULT_DSR_MAPPING_OPTIONS,
  DsrMappingOptions,
  SuggestionGroup,
  SuggestedDsrRow,
  buildBoqItemsFromApproved,
  buildDsrSuggestions,
  flattenCatalogForPicker,
} from '../data/dsrInventoryMapper';

const STORAGE_KEY_MAPPING_OPTS = 'dsr_mapping_options_v1';
const STORAGE_KEY_MAPPING_OVERRIDES = 'dsr_mapping_code_overrides_v1';
const STORAGE_KEY_MCBDB_SETTINGS = 'dsr_mcbdb_settings_v1';

interface DsrInventoryBoqPageProps {
  rows: InventoryRow[];
  catalogItems: DSRMasterItem[];
  estimateItems: BOQItem[];
  onUpdateBoqFromSuggestions: (boqItems: BOQItem[], mode: 'merge' | 'replace') => void;
  onBackToMcbDb: () => void;
  onBackToInventory: () => void;
  onGoToEstimate: () => void;
  onNotify?: (msg: string) => void;
}

export const DsrInventoryBoqPage: React.FC<DsrInventoryBoqPageProps> = ({
  rows,
  catalogItems,
  estimateItems,
  onUpdateBoqFromSuggestions,
  onBackToMcbDb,
  onBackToInventory,
  onGoToEstimate,
  onNotify,
}) => {
  const [options, setOptions] = useState<DsrMappingOptions>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MAPPING_OPTS);
      if (saved) return { ...DEFAULT_DSR_MAPPING_OPTIONS, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to load DSR mapping options:', e);
    }
    return DEFAULT_DSR_MAPPING_OPTIONS;
  });

  const [codeOverrides, setCodeOverrides] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MAPPING_OVERRIDES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load DSR code overrides:', e);
    }
    return {};
  });

  // Read the active MCBDB settings configured in Step 4 so DB counts always stay aligned
  const mcbSettings: McbDbSettings = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MCBDB_SETTINGS);
      if (saved) return { ...DEFAULT_MCBDB_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to load MCBDB settings:', e);
    }
    return DEFAULT_MCBDB_SETTINGS;
  }, []);

  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [rejectedIds, setRejectedIds] = useState<Record<string, boolean>>({});
  const [activeGroupFilter, setActiveGroupFilter] = useState<'all' | SuggestionGroup>('all');
  const [showZeroQty, setShowZeroQty] = useState(false);
  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>('merge');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // DSR Catalog Picker Modal state
  const [pickerTargetRow, setPickerTargetRow] = useState<SuggestedDsrRow | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MAPPING_OPTS, JSON.stringify(options));
    } catch (e) {
      console.error(e);
    }
  }, [options]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MAPPING_OVERRIDES, JSON.stringify(codeOverrides));
    } catch (e) {
      console.error(e);
    }
  }, [codeOverrides]);

  const summary = useMemo(
    () => buildDsrSuggestions(rows, catalogItems, options, mcbSettings, codeOverrides),
    [rows, catalogItems, options, mcbSettings, codeOverrides]
  );

  const flatCatalogChoices = useMemo(
    () => flattenCatalogForPicker(catalogItems),
    [catalogItems]
  );

  const pickerResults = useMemo(() => {
    if (!pickerTargetRow) return [];
    const words = pickerSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return flatCatalogChoices.slice(0, 60);
    }
    const matched: typeof flatCatalogChoices = [];
    for (const c of flatCatalogChoices) {
      let ok = true;
      for (const w of words) {
        if (!c.searchBlob.includes(w)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        matched.push(c);
        if (matched.length >= 60) break;
      }
    }
    return matched;
  }, [pickerTargetRow, pickerSearch, flatCatalogChoices]);

  const getEffectiveQty = (row: SuggestedDsrRow): number => {
    if (qtyOverrides[row.id] !== undefined) return qtyOverrides[row.id];
    return row.calculatedQty;
  };

  const isRowApproved = (row: SuggestedDsrRow): boolean => {
    if (rejectedIds[row.id] !== undefined) return !rejectedIds[row.id];
    return getEffectiveQty(row) > 0 && row.foundInCatalog;
  };

  const visibleSuggestions = useMemo(() => {
    return summary.suggestions.filter((s) => {
      if (activeGroupFilter !== 'all' && s.group !== activeGroupFilter) return false;
      const qty = getEffectiveQty(s);
      if (!showZeroQty && qty <= 0 && s.group === 'inventory') return false;
      return true;
    });
  }, [summary.suggestions, activeGroupFilter, showZeroQty, qtyOverrides]);

  const approvedRowsList = useMemo(() => {
    return summary.suggestions
      .map((row) => ({ row, qty: getEffectiveQty(row), approved: isRowApproved(row) }))
      .filter((entry) => entry.approved && entry.qty > 0 && entry.row.foundInCatalog);
  }, [summary.suggestions, qtyOverrides, rejectedIds]);

  const totalApprovedAmount = useMemo(() => {
    return approvedRowsList.reduce((sum, entry) => sum + entry.qty * entry.row.rate, 0);
  }, [approvedRowsList]);

  const zeroQtyInventoryCount = useMemo(
    () =>
      summary.suggestions.filter(
        (s) => s.group === 'inventory' && getEffectiveQty(s) <= 0
      ).length,
    [summary.suggestions, qtyOverrides]
  );

  const totalPointRow = summary.suggestions.find((s) => s.id === 'total-points');

  const handleToggleApprove = (row: SuggestedDsrRow) => {
    const currentlyApproved = isRowApproved(row);
    setRejectedIds((prev) => ({ ...prev, [row.id]: currentlyApproved }));
  };

  const handleApproveAllActive = () => {
    const next: Record<string, boolean> = {};
    for (const s of summary.suggestions) {
      if (getEffectiveQty(s) > 0 && s.foundInCatalog) {
        next[s.id] = false;
      }
    }
    setRejectedIds(next);
    onNotify?.('Marked all active suggested DSR items as confirmed.');
  };

  const handleUncheckAll = () => {
    const next: Record<string, boolean> = {};
    for (const s of summary.suggestions) {
      next[s.id] = true;
    }
    setRejectedIds(next);
  };

  const handleResetOverrides = () => {
    setCodeOverrides({});
    setQtyOverrides({});
    setRejectedIds({});
    onNotify?.('Reset all manual DSR item swaps and quantity overrides.');
  };

  const handleConfirmUpdateBoq = (openAfter = false) => {
    if (approvedRowsList.length === 0) {
      onNotify?.('Select at least one confirmed item with Quantity > 0 to update BOQ.');
      return;
    }
    const builtItems = buildBoqItemsFromApproved(
      approvedRowsList.map((e) => ({ row: e.row, qty: e.qty })),
      catalogItems
    );
    onUpdateBoqFromSuggestions(builtItems, syncMode);
    setLastSyncedAt(new Date().toLocaleTimeString('en-IN'));
    if (openAfter) {
      onGoToEstimate();
    }
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const header = [
      ['CPWD DSR 2025 — Inventory & DB Suggestion Sheet'],
      [
        `Wiring Mode: ${
          options.wiringType === 'modular' ? 'Modular' : 'Non-Modular (Piano)'
        } | Conduit: ${options.conduitType === 'pvc' ? 'PVC' : 'Steel'} | Group ${
          options.pointGroup
        } | Total Points (#H05–#H15): ${summary.totalPoints}`,
      ],
      [],
      [
        'Confirmed',
        'Sl.No',
        'Source Code',
        'Section',
        'Inventory / DB Requirement',
        'DSR Item Sl.No',
        'DSR Description',
        'Unit',
        'DSR Rate (INR)',
        'Quantity',
        'Amount (INR)',
      ],
      ...summary.suggestions.map((s, idx) => {
        const qty = getEffectiveQty(s);
        const ok = isRowApproved(s);
        return [
          ok ? 'YES' : 'NO',
          idx + 1,
          s.badgeCode,
          s.group === 'points' ? 'Total Points' : s.group === 'inventory' ? 'Inventory' : 'DB',
          s.sourceLabel,
          s.resolvedDsrCode,
          s.subItemName ? `${s.parentDescription} — Sub-item: ${s.subItemName}` : s.parentDescription,
          s.unit,
          Number(s.rate.toFixed(2)),
          qty,
          Number((qty * s.rate).toFixed(2)),
        ];
      }),
      [],
      ['', '', '', '', '', '', 'Approved Estimate Subtotal', '', '', '', Number(totalApprovedAmount.toFixed(2))],
    ];

    const ws = XLSX.utils.aoa_to_sheet(header);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 7 },
      { wch: 12 },
      { wch: 14 },
      { wch: 34 },
      { wch: 14 },
      { wch: 64 },
      { wch: 10 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DSR Suggestions');
    XLSX.writeFile(wb, `DSR_Catalog_Suggestions_${Date.now()}.xlsx`);
    onNotify?.('Exported DSR Catalog Suggestions sheet to Excel (.xlsx).');
  };

  return (
    <div className="space-y-3">
      {/* Compact Header & Primary Action Bar */}
      <div className="bg-white dark:bg-slate-900/95 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 space-y-2 shadow-xs dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shrink-0">
              <Sparkles className="w-3 h-3" />
              Step 5 · DSR Suggest
            </span>
            <h2 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white truncate">
              DSR Catalog Item Suggestions &amp; BOQ Estimate Sync
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onBackToMcbDb}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>MCBDB</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={() => handleConfirmUpdateBoq(false)}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold border border-emerald-500 dark:border-emerald-400/30 transition-colors whitespace-nowrap shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Update BOQ ({approvedRowsList.length})</span>
            </button>

            <button
              type="button"
              onClick={onGoToEstimate}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold border border-blue-500 dark:border-blue-400/30 transition-colors whitespace-nowrap shrink-0"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>BOQ ({estimateItems.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modular / Non-Modular Point Wiring Configuration Bar */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            {/* Modular vs Non-Modular Switch */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                <ToggleLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Wiring:</span>
              </span>
              <div className="inline-flex rounded-md bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-0.5">
                <button
                  type="button"
                  onClick={() => setOptions((p) => ({ ...p, wiringType: 'modular' }))}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    options.wiringType === 'modular'
                      ? 'bg-emerald-600/15 dark:bg-emerald-600/30 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Modular
                </button>
                <button
                  type="button"
                  onClick={() => setOptions((p) => ({ ...p, wiringType: 'non-modular' }))}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    options.wiringType === 'non-modular'
                      ? 'bg-amber-600/15 dark:bg-amber-600/30 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Non-Modular (Piano)
                </button>
              </div>
            </div>

            {/* Conduit Type */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 dark:text-slate-400">Conduit:</span>
              <div className="inline-flex rounded-md bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-0.5">
                <button
                  type="button"
                  onClick={() => setOptions((p) => ({ ...p, conduitType: 'pvc' }))}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    options.conduitType === 'pvc'
                      ? 'bg-cyan-600/15 dark:bg-cyan-600/25 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  PVC
                </button>
                <button
                  type="button"
                  onClick={() => setOptions((p) => ({ ...p, conduitType: 'steel' }))}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    options.conduitType === 'steel'
                      ? 'bg-cyan-600/15 dark:bg-cyan-600/25 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Steel
                </button>
              </div>
            </div>

            {/* Point Wiring Group A / B / C */}
            <div className="flex items-center gap-1">
              <span className="text-slate-600 dark:text-slate-400">Group:</span>
              <select
                value={options.pointGroup}
                onChange={(e) =>
                  setOptions((p) => ({
                    ...p,
                    pointGroup: e.target.value as 'A' | 'B' | 'C',
                  }))
                }
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="A">Group A (Short)</option>
                <option value="B">Group B (Medium)</option>
                <option value="C">Group C (Long)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-700 dark:text-slate-300">
            {options.wiringType === 'modular' && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.includeFanRegulators}
                  onChange={(e) =>
                    setOptions((p) => ({ ...p, includeFanRegulators: e.target.checked }))
                  }
                  className="accent-emerald-600 dark:accent-emerald-500 rounded"
                />
                <span>Fan Regulators (1.25)</span>
              </label>
            )}
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.includeSwitchBoxes}
                onChange={(e) =>
                  setOptions((p) => ({ ...p, includeSwitchBoxes: e.target.checked }))
                }
                className="accent-emerald-600 dark:accent-emerald-500 rounded"
              />
              <span>Switch Boxes</span>
            </label>
          </div>
        </div>

        {/* Clean 4-Metric KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total Points (#H05–#H15)</span>
              <button
                type="button"
                onClick={() => setShowPointsBreakdown((v) => !v)}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 inline-flex items-center gap-0.5"
              >
                <span>Breakdown</span>
                {showPointsBreakdown ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-mono tabular-nums font-bold text-slate-950 dark:text-white text-base">
                {summary.totalPoints}
              </span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono">
                DSR {totalPointRow?.resolvedDsrCode} ({options.wiringType === 'modular' ? 'Modular' : 'Non-Mod'})
              </span>
            </div>
          </div>

          <div>
            <span className="text-slate-600 dark:text-slate-400 block">Inventory Equipment (#H05–#H22)</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-mono tabular-nums font-bold text-cyan-700 dark:text-cyan-300 text-base">
                {summary.totalInventoryUnits}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">units across active items</span>
            </div>
          </div>

          <div>
            <span className="text-slate-600 dark:text-slate-400 block">Distribution Boards (MCBDB)</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300 text-base">
                {summary.totalDbBoards}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                LDB/PDB/VTPNDB · {summary.totalSwitchBoards} SBs
              </span>
            </div>
          </div>

          <div>
            <span className="text-slate-600 dark:text-slate-400 block">
              Confirmed for BOQ ({approvedRowsList.length} items)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300 text-base">
                {formatINR(totalApprovedAmount)}
              </span>
              {lastSyncedAt && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">Synced {lastSyncedAt}</span>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible #H05-#H15 Total Points Breakdown */}
        {showPointsBreakdown && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-950 dark:text-white">
                Point Calculation (#H05–#H15) = {summary.totalPoints} Points
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                Mapped to DSR {totalPointRow?.resolvedDsrCode} @{' '}
                <strong className="text-emerald-700 dark:text-emerald-300 font-mono">
                  {formatINR(totalPointRow?.rate || 0)}
                </strong>{' '}
                / Point
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px]">
              {summary.pointsBreakdown.map((pt) => (
                <div
                  key={pt.badgeId}
                  className={`px-2.5 py-1.5 rounded border flex items-center justify-between ${
                    pt.qty > 0
                      ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800/70 text-slate-500'
                  }`}
                >
                  <span className="truncate pr-2">
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 mr-1">{pt.badgeId}</span>
                    {pt.label}
                  </span>
                  <span className="font-mono tabular-nums font-bold">{pt.qty}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter & Bulk Verification Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveGroupFilter('all')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeGroupFilter === 'all'
                ? 'bg-emerald-600/15 dark:bg-emerald-600/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 dark:border-emerald-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            All Suggested Items
          </button>
          <button
            type="button"
            onClick={() => setActiveGroupFilter('points')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeGroupFilter === 'points'
                ? 'bg-emerald-600/15 dark:bg-emerald-600/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 dark:border-emerald-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Total Points</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveGroupFilter('inventory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeGroupFilter === 'inventory'
                ? 'bg-cyan-600/15 dark:bg-cyan-600/25 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40 dark:border-cyan-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Inventory Items</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveGroupFilter('db')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeGroupFilter === 'db'
                ? 'bg-amber-600/15 dark:bg-amber-600/25 text-amber-800 dark:text-amber-300 border border-amber-500/40 dark:border-amber-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Distribution Boards</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {zeroQtyInventoryCount > 0 && (
            <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showZeroQty}
                onChange={(e) => setShowZeroQty(e.target.checked)}
                className="accent-cyan-600 dark:accent-cyan-500 rounded"
              />
              <span>Show zero-qty inventory ({zeroQtyInventoryCount})</span>
            </label>
          )}

          <button
            type="button"
            onClick={handleApproveAllActive}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-slate-300 dark:border-slate-700 transition-colors"
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>Confirm All</span>
          </button>

          <button
            type="button"
            onClick={handleUncheckAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors"
          >
            <span>Uncheck All</span>
          </button>

          {(Object.keys(codeOverrides).length > 0 || Object.keys(qtyOverrides).length > 0) && (
            <button
              type="button"
              onClick={handleResetOverrides}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-400/60 dark:border-amber-500/30 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Edits</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Suggested DSR Catalog Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-bold text-slate-950 dark:text-white">
            Inventory, Points &amp; DB Catalog Suggestions
          </div>
          <div className="text-slate-600 dark:text-slate-400">
            Verify each suggested DSR Sl.No (or click <strong className="text-slate-900 dark:text-slate-200">Swap</strong> to pick another catalog item), check if correct, then update BOQ Estimate.
          </div>
        </div>

        <div className="overflow-x-auto max-h-[calc(100vh-330px)] min-h-[340px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-center w-14">OK</th>
                <th className="py-2.5 px-2.5 border-r border-slate-200 dark:border-slate-800 text-center w-10">#</th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 w-24">Ref</th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 min-w-[210px]">
                  Inventory / DB Item
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 w-36">
                  DSR Item Sl.No
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 min-w-[280px]">
                  Suggested DSR Specification &amp; Sub-Item
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-center w-16">Unit</th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-right w-24">
                  Rate (₹)
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-right w-24">
                  Qty
                </th>
                <th className="py-2.5 px-3 text-right w-28">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {visibleSuggestions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-600 dark:text-slate-400">
                    No active items in this section. Enter quantities in the Inventory Table or toggle &ldquo;Show zero-qty inventory&rdquo;.
                  </td>
                </tr>
              ) : (
                visibleSuggestions.map((row, idx) => {
                  const qty = getEffectiveQty(row);
                  const approved = isRowApproved(row);
                  const amount = qty * row.rate;
                  const isCodeOverridden = Boolean(codeOverrides[row.id]);
                  const isQtyOverridden = qtyOverrides[row.id] !== undefined;

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        approved
                          ? 'bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20'
                          : qty <= 0
                          ? 'opacity-55 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/35'
                      }`}
                    >
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleApprove(row)}
                          disabled={!row.foundInCatalog}
                          title={approved ? 'Confirmed for BOQ' : 'Include in BOQ'}
                          className={`inline-flex items-center justify-center p-1 rounded transition-colors ${
                            approved
                              ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'
                              : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
                          }`}
                        >
                          {approved ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-2.5 border-r border-slate-200 dark:border-slate-800/80 text-center font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 font-mono">
                        <span
                          className={`font-semibold ${
                            row.group === 'points'
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : row.group === 'db'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-cyan-700 dark:text-cyan-300'
                          }`}
                        >
                          {row.badgeCode}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">
                        <div className="font-semibold text-slate-950 dark:text-white">{row.sourceLabel}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {row.sourceDetail}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-bold ${
                              row.foundInCatalog ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {row.resolvedDsrCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPickerTargetRow(row);
                              setPickerSearch('');
                            }}
                            title="Change or search DSR Catalog Item Sl.No"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white border border-slate-300 dark:border-slate-700 text-[10px] font-medium whitespace-nowrap shrink-0"
                          >
                            <Search className="w-2.5 h-2.5" />
                            <span>Swap</span>
                          </button>
                          {isCodeOverridden && (
                            <button
                              type="button"
                              onClick={() =>
                                setCodeOverrides((prev) => {
                                  const next = { ...prev };
                                  delete next[row.id];
                                  return next;
                                })
                              }
                              title={`Revert to default DSR ${row.defaultDsrCode}`}
                              className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 p-0.5"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">
                        {row.subItemName ? (
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{row.subItemName}</div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1">
                              {row.parentCode}: {row.parentDescription}
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-800 dark:text-slate-200 line-clamp-2">{row.parentDescription}</div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-center font-mono text-slate-700 dark:text-slate-300">
                        {row.unit}
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {formatINR(row.rate, false)}
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={qty}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              setQtyOverrides((prev) => ({
                                ...prev,
                                [row.id]: isNaN(parsed) || parsed < 0 ? 0 : parsed,
                              }));
                            }}
                            className={`w-16 bg-white dark:bg-slate-950 border rounded px-2 py-1 text-right font-mono tabular-nums text-slate-950 dark:text-white focus:outline-none focus:border-emerald-500 ${
                              isQtyOverridden ? 'border-amber-500/80 dark:border-amber-500/60' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                          {isQtyOverridden && (
                            <button
                              type="button"
                              onClick={() =>
                                setQtyOverrides((prev) => {
                                  const next = { ...prev };
                                  delete next[row.id];
                                  return next;
                                })
                              }
                              title={`Revert to calculated qty (${row.calculatedQty})`}
                              className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300">
                        {formatINR(amount, false)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {visibleSuggestions.length > 0 && (
              <tfoot className="bg-slate-100 dark:bg-slate-950 border-t border-slate-300 dark:border-slate-700 text-xs font-bold sticky bottom-0 z-10">
                <tr>
                  <td colSpan={9} className="py-2.5 px-4 text-right text-slate-800 dark:text-slate-300">
                    Total Confirmed BOQ Value ({approvedRowsList.length} items):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-300 text-sm">
                    {formatINR(totalApprovedAmount, false)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Bottom Sync / Confirm Bar */}
      <div className="bg-white dark:bg-slate-900/95 border border-slate-300 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs dark:shadow-none">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-800 dark:text-slate-300 font-medium">BOQ Sync Mode:</span>
          <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="radio"
              name="boqSyncMode"
              checked={syncMode === 'merge'}
              onChange={() => setSyncMode('merge')}
              className="accent-emerald-600 dark:accent-emerald-500"
            />
            <span>Merge / Update matching DSR codes</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="radio"
              name="boqSyncMode"
              checked={syncMode === 'replace'}
              onChange={() => setSyncMode('replace')}
              className="accent-emerald-600 dark:accent-emerald-500"
            />
            <span>Replace BOQ Estimate list</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleConfirmUpdateBoq(false)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-400 dark:border-emerald-500/40 transition-colors whitespace-nowrap shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Update BOQ Quantities</span>
          </button>

          <button
            type="button"
            onClick={() => handleConfirmUpdateBoq(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold border border-emerald-500 dark:border-emerald-400/30 transition-colors whitespace-nowrap shrink-0"
          >
            <span>Found Correct · Update &amp; Open BOQ Estimate</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* DSR Catalog Item Picker Modal */}
      {pickerTargetRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                  Select DSR Catalog Item Sl.No
                </div>
                <div className="text-sm font-bold text-slate-950 dark:text-white">
                  Mapping for: {pickerTargetRow.badgeCode} · {pickerTargetRow.sourceLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickerTargetRow(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search by DSR Item Sl.No (e.g. 1.10, 2.3, 8.9, 32.2) or description..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/80">
              {pickerResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-600 dark:text-slate-400">
                  No catalog entries match &ldquo;{pickerSearch}&rdquo;.
                </div>
              ) : (
                pickerResults.map((choice) => {
                  const isCurrent = choice.code === pickerTargetRow.resolvedDsrCode;
                  return (
                    <button
                      key={choice.code}
                      type="button"
                      onClick={() => {
                        setCodeOverrides((prev) => ({
                          ...prev,
                          [pickerTargetRow.id]: choice.code,
                        }));
                        setRejectedIds((prev) => ({
                          ...prev,
                          [pickerTargetRow.id]: false,
                        }));
                        setPickerTargetRow(null);
                        onNotify?.(
                          `Mapped "${pickerTargetRow.sourceLabel}" to DSR Sl.No ${choice.code}.`
                        );
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors flex items-start justify-between gap-4 ${
                        isCurrent ? 'bg-emerald-50 dark:bg-emerald-950/25' : ''
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            {choice.code}
                          </span>
                          {choice.subName && (
                            <span className="font-semibold text-slate-950 dark:text-white">{choice.subName}</span>
                          )}
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            {choice.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">{choice.label}</p>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums text-xs">
                        <div className="font-bold text-slate-950 dark:text-white">{formatINR(choice.rate, false)}</div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400">/{choice.unit}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
