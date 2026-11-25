import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileSpreadsheet,
  GitFork,
  Layers,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { InventoryRow } from '../types';
import {
  DEFAULT_MCBDB_SETTINGS,
  DbCategoryType,
  McbDbSettings,
  calculateMcbDbSchedule,
} from '../data/mcbDbCalculator';
import {
  SldDocument,
  applySldOverridesToMcbDbResult,
  computeMcbDbScheduleSignature,
  generateSldFromMcbDb,
  reconcileSldDbSparesAndSizes,
} from '../utils/sldGenerator';

const SldWorkspace = React.lazy(() =>
  import('./SldWorkspace').then((m) => ({ default: m.SldWorkspace }))
);

const STORAGE_KEY_MCBDB_SETTINGS = 'dsr_mcbdb_settings_v1';
const STORAGE_KEY_MCBDB_SLD = 'dsr_mcbdb_sld_v1';

interface McbDbCalculationProps {
  rows: InventoryRow[];
  onBackToLoadCalc: () => void;
  onBackToInventory: () => void;
  onProceedToNext: () => void;
  onNotify?: (msg: string) => void;
}

const CATEGORY_TEXT_CLASS: Record<DbCategoryType, string> = {
  'Switch Board': 'text-slate-900 dark:text-slate-200',
  LDB: 'text-cyan-700 dark:text-cyan-300',
  'Emergency PDB': 'text-amber-700 dark:text-amber-300',
  'Raw PDB': 'text-sky-700 dark:text-sky-300',
  'Emergency VTPNDB': 'text-orange-700 dark:text-orange-300',
  'Raw VTPNDB': 'text-emerald-700 dark:text-emerald-300',
};

export const McbDbCalculation: React.FC<McbDbCalculationProps> = ({
  rows,
  onBackToLoadCalc,
  onBackToInventory,
  onProceedToNext,
  onNotify,
}) => {
  const [settings, setSettings] = useState<McbDbSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MCBDB_SETTINGS);
      if (saved) {
        return { ...DEFAULT_MCBDB_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load MCBDB settings:', e);
    }
    return DEFAULT_MCBDB_SETTINGS;
  });

  const [activeTab, setActiveTab] = useState<'chart' | 'pivot' | 'sld'>('chart');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showRules, setShowRules] = useState(false);
  const [sldDoc, setSldDoc] = useState<SldDocument | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MCBDB_SLD);
      if (saved) {
        const parsed = JSON.parse(saved) as SldDocument;
        const normalized: SldDocument = {
          ...parsed,
          groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        };
        return reconcileSldDbSparesAndSizes(normalized).doc;
      }
    } catch (e) {
      console.error('Failed to load SLD document:', e);
    }
    return null;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MCBDB_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to persist MCBDB settings:', e);
    }
  }, [settings]);

  useEffect(() => {
    if (!sldDoc) return;
    try {
      localStorage.setItem(STORAGE_KEY_MCBDB_SLD, JSON.stringify(sldDoc));
    } catch (e) {
      console.error('Failed to persist SLD document:', e);
    }
  }, [sldDoc]);

  const baseResult = useMemo(() => calculateMcbDbSchedule(rows, settings), [rows, settings]);
  const currentScheduleSignature = useMemo(
    () => computeMcbDbScheduleSignature(baseResult),
    [baseResult]
  );
  const result = useMemo(
    () => applySldOverridesToMcbDbResult(baseResult, sldDoc, settings),
    [baseResult, sldDoc, settings]
  );
  const isSldSynced = Boolean(
    sldDoc && (!sldDoc.scheduleSignature || sldDoc.scheduleSignature === currentScheduleSignature)
  );

  const handleGenerateSld = (preserveManual = false) => {
    const generated = generateSldFromMcbDb(baseResult, settings, sldDoc, preserveManual);
    setSldDoc(generated);
    setActiveTab('sld');
    const dbCount = generated.nodes.filter((n) => n.kind === 'db').length;
    onNotify?.(
      `Generated AutoCAD-style Single Line Diagram (${dbCount} DB boxes with Floor, Size & Spare, Busbar Chamber, Switches & L.T. Panel group).`
    );
  };

  const floorNames = useMemo(
    () => result.floors.map((f) => f.floorName),
    [result.floors]
  );

  const hasCommonBoards =
    result.common.commonEmgPdbAlloc.totalBoards > 0 ||
    result.common.commonEmgVtpndbAlloc.totalBoards > 0 ||
    result.common.commonRawVtpndbAlloc.totalBoards > 0;

  const filteredEntries = useMemo(() => {
    return result.tableEntries.filter((entry) => {
      if (floorFilter !== 'ALL') {
        if (floorFilter === 'COMMON') {
          if (!entry.isCommon) return false;
        } else if (entry.scope !== floorFilter) {
          return false;
        }
      }
      if (categoryFilter !== 'ALL' && entry.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [result.tableEntries, floorFilter, categoryFilter]);

  const filteredFloors = useMemo(() => {
    if (floorFilter === 'ALL' || floorFilter === 'COMMON') return result.floors;
    return result.floors.filter((f) => f.floorName === floorFilter);
  }, [result.floors, floorFilter]);

  const filteredRooms = useMemo(() => {
    if (floorFilter === 'ALL' || floorFilter === 'COMMON') return result.rooms;
    return result.rooms.filter((r) => r.floor === floorFilter);
  }, [result.rooms, floorFilter]);

  const totalBoqBoards = useMemo(
    () => result.boqTotals.reduce((sum, b) => sum + b.totalQty, 0),
    [result.boqTotals]
  );

  const handleResetSettings = () => {
    setSettings(DEFAULT_MCBDB_SETTINGS);
    onNotify?.('Reset MCBDB spare % (20%) and switchboard point limit (8 pts) to defaults.');
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const scheduleSheet = [
      ['Floor-Wise MCB & Distribution Board (MCBDB) Schedule'],
      [`Spare: ${settings.sparePercent}% | Switch Board Max Points: ${settings.pointsPerSwitchBoard}`],
      [],
      ['Sl.no.', 'Floor / Scope', 'DB Category', 'DB Size', 'Req. Ways', 'Provided Ways', 'Utilised Ways (Used / Spare)', 'Qty', 'Rule Note'],
      ...result.tableEntries.map((e, idx) => [
        idx + 1,
        e.scope,
        e.category,
        e.sizeCode,
        `${e.reqWaysWithSpare} ${e.wayUnit === 'Boards' ? 'pts' : e.wayUnit}`,
        `${e.providedWays} ${e.wayUnit}`,
        `${e.usedWays} / ${e.spareWays} ${e.wayUnit === 'Boards' ? 'pts' : e.wayUnit === '3P Ways' ? 'TP' : 'SP'}`,
        e.qty,
        e.basisNote,
      ]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(scheduleSheet);
    ws1['!cols'] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 },
      { wch: 10 },
      { wch: 52 },
    ];

    const boqSheet = [
      ['Building Total by DB Category & Size'],
      [],
      ['DB Category', 'Incoming Type', 'DB Size', 'Total Qty'],
      ...result.boqTotals.map((b) => [b.category, b.incomingType, b.sizeCode, b.totalQty]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(boqSheet);
    ws2['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 12 }];

    const roomSheet = [
      ['Room-Wise Switch Board Calculation (Rule 1)'],
      [],
      ['Sl.no.', 'Floor', 'Room', '#H05-#H15 Points', `Switch Boards (ceil ÷ ${settings.pointsPerSwitchBoard})`],
      ...result.rooms.map((r, i) => [i + 1, r.floor, r.room, r.pointsH05H15, r.switchBoards]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(roomSheet);
    ws3['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Floor-Wise DB Chart');
    XLSX.utils.book_append_sheet(wb, ws2, 'Building DB Totals');
    XLSX.utils.book_append_sheet(wb, ws3, 'Room Switch Boards');
    XLSX.writeFile(wb, `MCBDB_Calculation_${Date.now()}.xlsx`);
    onNotify?.('Exported simplified Floor-Wise MCBDB Schedule to Excel (.xlsx).');
  };

  const formatBoardList = (items: { qty: number; option: { sizeCode: string } }[]) =>
    items.map((i) => `${i.qty} × ${i.option.sizeCode}`).join(', ');

  return (
    <div className="space-y-3">
      {/* Compact Header & Totals */}
      <div className="bg-white dark:bg-slate-900/95 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 space-y-2 shadow-xs dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shrink-0">
              <Cpu className="w-3 h-3" />
              Step 4 · MCBDB
            </span>
            <h2 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white truncate">
              Floor-Wise MCB Distribution Board (DB) Chart
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onBackToLoadCalc}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Load Calc</span>
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
              onClick={() => handleGenerateSld(false)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold border border-indigo-500 dark:border-indigo-400/40 transition-colors whitespace-nowrap shrink-0"
              title="Generate AutoCAD-style Single Line Diagram (DBs only, with Main Switch & Changeover Switch)"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>SLD Generate</span>
            </button>

            <button
              type="button"
              onClick={onProceedToNext}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold border border-emerald-500 dark:border-emerald-400/30 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Confirm · DSR &amp; BOQ Suggest</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Clean 6-Column DB Totals Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">Switch Boards</span>
            <span className="font-mono tabular-nums font-bold text-slate-950 dark:text-white text-sm">
              {result.grandTotals.switchBoards}
            </span>
          </div>
          <div>
            <span className="text-cyan-700 dark:text-cyan-300 block">LDB (2P)</span>
            <span className="font-mono tabular-nums font-bold text-cyan-700 dark:text-cyan-300 text-sm">
              {result.grandTotals.ldb}
            </span>
          </div>
          <div>
            <span className="text-amber-700 dark:text-amber-300 block">Emergency PDB (4P)</span>
            <span className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300 text-sm">
              {result.grandTotals.emgPdb}
            </span>
          </div>
          <div>
            <span className="text-sky-700 dark:text-sky-300 block">Raw PDB (4P)</span>
            <span className="font-mono tabular-nums font-bold text-sky-700 dark:text-sky-300 text-sm">
              {result.grandTotals.rawPdb}
            </span>
          </div>
          <div>
            <span className="text-orange-700 dark:text-orange-300 block">Emergency VTPNDB</span>
            <span className="font-mono tabular-nums font-bold text-orange-700 dark:text-orange-300 text-sm">
              {result.grandTotals.emgVtpndb}
            </span>
          </div>
          <div>
            <span className="text-emerald-700 dark:text-emerald-300 block">Raw VTPNDB</span>
            <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300 text-sm">
              {result.grandTotals.rawVtpndb}
            </span>
          </div>
        </div>

        {/* Inline Parameters & Rules Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/80 text-[11px]">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Spare %:</span>
              <input
                type="number"
                min={0}
                max={50}
                step={5}
                value={settings.sparePercent}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSettings((prev) => ({
                    ...prev,
                    sparePercent: isNaN(val) ? 20 : Math.min(50, Math.max(0, val)),
                  }));
                }}
                className="w-14 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-right font-mono tabular-nums text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span>Pts / Switch Board:</span>
              <input
                type="number"
                min={1}
                max={24}
                step={1}
                value={settings.pointsPerSwitchBoard}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSettings((prev) => ({
                    ...prev,
                    pointsPerSwitchBoard: isNaN(val) || val < 1 ? 8 : val,
                  }));
                }}
                className="w-14 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-right font-mono tabular-nums text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={handleResetSettings}
              className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowRules((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            <span>{showRules ? 'Hide Rules' : 'Calculation Rules (1–7)'}</span>
            {showRules ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showRules && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed">
            <div><strong className="text-slate-950 dark:text-white">1. Switch Boards:</strong> ceil(#H05–#H15 ÷ {settings.pointsPerSwitchBoard}) per room per floor.</div>
            <div><strong className="text-slate-950 dark:text-white">2–3. LDB (2P: 2+4, 2+6, 2+10, 2+14):</strong> Switch Boards + #H17 + #H19 + {settings.sparePercent}% spare.</div>
            <div><strong className="text-slate-950 dark:text-white">4. Emergency PDB (4P: 4+12, 4+18, 4+24):</strong> LDBs + Emergency (#H18 + #H20 + #H21) + {settings.sparePercent}% spare.</div>
            <div><strong className="text-slate-950 dark:text-white">4a. Raw PDB &amp; Raw VTPNDB:</strong> Raw (#H18 + #H20 + #H21) + {settings.sparePercent}% spare; Raw VTPNDB = Raw PDBs + {settings.sparePercent}% spare.</div>
            <div><strong className="text-slate-950 dark:text-white">5 &amp; 7. VTPNDB (4P MCCB: 4+12, 4+24, 4+36; 3P = size ÷ 3):</strong> Single-LDB / single-PDB floors skip floor DB and merge into Common PDB / Common VTPNDB when &gt;1 qualifies.</div>
          </div>
        )}
      </div>

      {/* Simple 3-Tab Switcher & Floor Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'chart'
                ? 'bg-emerald-600/15 dark:bg-emerald-600/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 dark:border-emerald-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            Floor-Wise DB Chart
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pivot')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'pivot'
                ? 'bg-cyan-600/15 dark:bg-cyan-600/25 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40 dark:border-cyan-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            Floor Summary &amp; Rooms
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                (!sldDoc || (sldDoc.version || 1) < 3 || sldDoc.scheduleSignature !== currentScheduleSignature) &&
                baseResult.tableEntries.length > 0
              ) {
                handleGenerateSld(Boolean(sldDoc));
              } else {
                setActiveTab('sld');
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'sld'
                ? 'bg-indigo-600/15 dark:bg-indigo-600/25 text-indigo-800 dark:text-indigo-300 border border-indigo-500/40 dark:border-indigo-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Single Line Diagram (SLD)</span>
          </button>
        </div>

        {activeTab !== 'sld' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Floors</option>
                {floorNames.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                {hasCommonBoards && <option value="COMMON">Common Panels</option>}
              </select>
            </div>

            {activeTab === 'chart' && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">All DB Categories</option>
                <option value="Switch Board">Switch Board</option>
                <option value="LDB">LDB</option>
                <option value="Emergency PDB">Emergency PDB</option>
                <option value="Raw PDB">Raw PDB</option>
                <option value="Emergency VTPNDB">Emergency VTPNDB</option>
                <option value="Raw VTPNDB">Raw VTPNDB</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {rows.length === 0 || result.tableEntries.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
            No electrical points, sockets, or AC loads entered in the Inventory Table yet.
          </p>
          <button
            type="button"
            onClick={onBackToInventory}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Inventory Table</span>
          </button>
        </div>
      ) : activeTab === 'sld' ? (
        <Suspense
          fallback={
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl h-[68vh] min-h-[560px] flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400">
              Loading Single Line Diagram CAD Workspace...
            </div>
          }
        >
          <SldWorkspace
            doc={sldDoc || generateSldFromMcbDb(baseResult, settings)}
            onChangeDoc={setSldDoc}
            onRegenerate={(preserveManual) => handleGenerateSld(preserveManual)}
            onNotify={onNotify}
          />
        </Suspense>
      ) : activeTab === 'chart' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Primary Simple Table: Floor-Wise DB Categories & Qty */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">Floor-Wise DB Categories &amp; Quantity</h3>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Includes {settings.sparePercent}% spare
                {isSldSynced ? ' · Synced with SLD' : ''}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[64vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">Floor</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">DB Category</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">DB Size</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-right whitespace-nowrap">Ways (Req / Cap)</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-right whitespace-nowrap">Utilised Ways (Used / Spare)</th>
                    <th className="py-2.5 px-3 text-right w-16">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                  {filteredEntries.map((entry, idx) => {
                    const unitShort =
                      entry.wayUnit === 'Boards'
                        ? 'pts'
                        : entry.wayUnit === '3P Ways'
                        ? 'TP'
                        : 'SP';
                    const totalSlotWays = entry.usedWays + entry.spareWays;
                    return (
                      <tr
                        key={entry.id}
                        title={entry.basisNote}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/35 transition-colors ${
                          entry.isCommon ? 'bg-amber-50/70 dark:bg-amber-950/10' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-center font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 font-medium text-slate-950 dark:text-white">
                          {entry.isCommon ? 'Common Panel' : entry.scope}
                        </td>
                        <td
                          className={`py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 font-semibold ${CATEGORY_TEXT_CLASS[entry.category]}`}
                        >
                          {entry.category}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 font-mono text-slate-900 dark:text-slate-100">
                          {entry.sizeCode}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {entry.wayUnit === 'Boards'
                            ? `${entry.baseWays} pts`
                            : `${entry.reqWaysWithSpare} / ${entry.providedWays} ${unitShort}`}
                        </td>
                        <td
                          title={`${entry.usedWays} used + ${entry.spareWays} spare = ${totalSlotWays} total ${unitShort}`}
                          className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-right font-mono tabular-nums whitespace-nowrap"
                        >
                          <span className="font-semibold text-slate-950 dark:text-white">
                            {entry.usedWays}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500"> / </span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                            {entry.spareWays}
                          </span>
                          <span className="ml-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {unitShort}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                          {entry.qty}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Side: Total DB Summary Chart */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">Total DB Summary</h3>
              <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300 font-semibold">
                {totalBoqBoards} nos.
              </span>
            </div>

            <div className="overflow-x-auto max-h-[64vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">DB Category</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">Size</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono tabular-nums">
                  {result.boqTotals.map((item) => (
                    <tr key={`${item.category}-${item.sizeCode}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                      <td
                        className={`py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 font-sans font-semibold ${CATEGORY_TEXT_CLASS[item.category]}`}
                      >
                        {item.category}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-200">
                        {item.sizeCode}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700 dark:text-emerald-300">
                        {item.totalQty}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 dark:bg-slate-950 border-t border-slate-300 dark:border-slate-700 font-mono tabular-nums font-bold">
                  <tr>
                    <td colSpan={2} className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-sans text-slate-800 dark:text-slate-300">
                      Total Boards
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-300">{totalBoqBoards}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Clean Floor-by-Floor Pivot DB Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">Floor-by-Floor DB Overview</h3>
              <span className="text-xs text-slate-600 dark:text-slate-400">Quantity &amp; rating per floor</span>
            </div>

            <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">Floor</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-right">Switch Boards</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-cyan-800 dark:text-cyan-300">LDB (2P)</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-amber-800 dark:text-amber-300">Emergency PDB</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-sky-800 dark:text-sky-300">Raw PDB</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-orange-800 dark:text-orange-300">Emergency VTPNDB</th>
                    <th className="py-2.5 px-3 text-emerald-800 dark:text-emerald-300">Raw VTPNDB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono tabular-nums">
                  {filteredFloors.map((f) => (
                    <tr key={f.floorName} className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 font-sans font-semibold text-slate-950 dark:text-white">
                        {f.floorName}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-right font-bold text-slate-950 dark:text-white">
                        {f.switchBoards || '–'}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-cyan-700 dark:text-cyan-300">
                        {f.ldbAlloc.totalBoards > 0 ? formatBoardList(f.ldbAlloc.items) : '–'}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-amber-700 dark:text-amber-300">
                        {f.emgPdbSkippedSingleLdb
                          ? 'Common PDB'
                          : f.emgPdbAlloc.totalBoards > 0
                          ? formatBoardList(f.emgPdbAlloc.items)
                          : '–'}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-sky-700 dark:text-sky-300">
                        {f.rawPdbAlloc.totalBoards > 0 ? formatBoardList(f.rawPdbAlloc.items) : '–'}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-orange-700 dark:text-orange-300">
                        {f.emgVtpndbSkippedSinglePdb
                          ? 'Common VTPNDB'
                          : f.emgVtpndbAlloc.totalBoards > 0
                          ? formatBoardList(f.emgVtpndbAlloc.items)
                          : '–'}
                      </td>
                      <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-300">
                        {f.rawVtpndbSkippedSinglePdb
                          ? 'Common VTPNDB'
                          : f.rawVtpndbAlloc.totalBoards > 0
                          ? formatBoardList(f.rawVtpndbAlloc.items)
                          : '–'}
                      </td>
                    </tr>
                  ))}

                  {hasCommonBoards && floorFilter === 'ALL' && (
                    <tr className="bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/10 dark:hover:bg-amber-950/20">
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 font-sans font-semibold text-amber-800 dark:text-amber-300">
                        Common Panels
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-right text-slate-400 dark:text-slate-500">–</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-500">–</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-amber-700 dark:text-amber-300">
                        {result.common.commonEmgPdbAlloc.totalBoards > 0
                          ? formatBoardList(result.common.commonEmgPdbAlloc.items)
                          : '–'}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-500">–</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-orange-700 dark:text-orange-300">
                        {result.common.commonEmgVtpndbAlloc.totalBoards > 0
                          ? formatBoardList(result.common.commonEmgVtpndbAlloc.items)
                          : '–'}
                      </td>
                      <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-300">
                        {result.common.commonRawVtpndbAlloc.totalBoards > 0
                          ? formatBoardList(result.common.commonRawVtpndbAlloc.items)
                          : '–'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Simplified Room-Wise Switch Boards Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">Room-Wise Switch Boards</h3>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                ceil(#H05–#H15 ÷ {settings.pointsPerSwitchBoard})
              </span>
            </div>

            <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 w-10 text-center">#</th>
                    <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-800">Floor</th>
                    <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-800">Room</th>
                    <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 text-right">Points (#H05–#H15)</th>
                    <th className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-300">Switch Boards</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono tabular-nums">
                  {filteredRooms.map((r, i) => (
                    <tr key={r.rowId} className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 text-center text-slate-500 dark:text-slate-400">
                        {i + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 font-sans text-slate-700 dark:text-slate-300">
                        {r.floor}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 font-sans font-semibold text-slate-950 dark:text-white">
                        {r.room}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 text-right text-slate-800 dark:text-slate-200">
                        {r.pointsH05H15}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700 dark:text-emerald-300">
                        {r.switchBoards}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
