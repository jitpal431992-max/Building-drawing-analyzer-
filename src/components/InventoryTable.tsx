import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  FileSpreadsheet,
  RotateCcw,
  CheckSquare,
  Square,
  ClipboardList,
  Hash,
  Sun,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  Columns3,
  ThermometerSnowflake,
  Layers,
  Zap,
} from 'lucide-react';
import {
  InventoryColumn,
  InventoryRow,
  PowerSourceType,
  RawEmergencyColumnKey,
  VentilationRoomType,
} from '../types';
import {
  IS_3646_LUX_REFERENCES,
  LUX_BUILDING_GROUPS,
  getLuxReferenceById,
} from '../data/luxLevels';
import {
  COOLING_LOAD_REFERENCE_CHART,
  DEFAULT_HVAC_SETTINGS,
  HvacDesignSettings,
  computeRowHvac,
  inferDefaultAcRequired,
  inferVentTypeFromRoom,
} from '../data/hvacStandards';
import { FLOOR_OPTIONS } from '../data/wattageTable';
import {
  INVENTORY_COLUMNS,
  STORAGE_KEY_INVENTORY,
  createEmptyRow,
} from '../data/inventorySchema';
import { LuxReferenceModal } from './LuxReferenceModal';
import { CoolingLoadChartSection } from './CoolingLoadChartSection';

export { STORAGE_KEY_INVENTORY, INVENTORY_COLUMNS, createEmptyRow };

const STORAGE_KEY_LUX_SETTINGS = 'dsr_inventory_lux_settings_v1';
const STORAGE_KEY_HVAC_SETTINGS = 'dsr_inventory_hvac_settings_v1';
const STORAGE_KEY_VISIBLE_COLS = 'dsr_inventory_visible_cols_v3';

type LuxColumnId =
  | 'inv_hdr_lux_category'
  | 'inv_hdr_target_lux'
  | 'inv_hdr_req_lumens'
  | 'inv_hdr_installed_lux'
  | 'inv_hdr_lux_status';

type HvacColumnId =
  | 'inv_hdr_ac_required'
  | 'inv_hdr_cfm_vent'
  | 'inv_hdr_cooling_load';

interface SelectableColumnMeta {
  id: string;
  badgeId: string;
  label: string;
  group:
    | 'Core & Area'
    | 'Lux Calc (IS:3646)'
    | 'CFM, Vent & Cooling Load'
    | 'Lights'
    | 'Fans & Exhaust'
    | 'Sockets & Power'
    | 'AC';
  isLux?: boolean;
  isHvac?: boolean;
}

const LUX_COLUMN_DEFS: { id: LuxColumnId; badgeId: string; label: string }[] = [
  { id: 'inv_hdr_lux_category', badgeId: 'H23', label: 'Lux Room Category (IS:3646)' },
  { id: 'inv_hdr_target_lux', badgeId: 'H24', label: 'Target Lux (lx)' },
  { id: 'inv_hdr_req_lumens', badgeId: 'H25', label: 'Req. Lumens (Area)' },
  { id: 'inv_hdr_installed_lux', badgeId: 'H26', label: 'Achieved Lux / lm' },
  { id: 'inv_hdr_lux_status', badgeId: 'H27', label: 'Lux Gap / Status' },
];

const HVAC_COLUMN_DEFS: { id: HvacColumnId; badgeId: string; label: string }[] = [
  { id: 'inv_hdr_ac_required', badgeId: 'H28', label: 'AC Required?' },
  { id: 'inv_hdr_cfm_vent', badgeId: 'H29', label: 'Room CFM & Vent Mode' },
  { id: 'inv_hdr_cooling_load', badgeId: 'H30', label: 'Cooling Load (TR / BTU)' },
];

const SELECTABLE_COLUMNS: SelectableColumnMeta[] = [
  ...INVENTORY_COLUMNS.slice(0, 5).map((c) => ({
    id: c.id,
    badgeId: c.badgeId,
    label: c.label,
    group: 'Core & Area' as const,
  })),
  ...LUX_COLUMN_DEFS.map((c) => ({
    id: c.id,
    badgeId: c.badgeId,
    label: c.label,
    group: 'Lux Calc (IS:3646)' as const,
    isLux: true,
  })),
  ...HVAC_COLUMN_DEFS.map((c) => ({
    id: c.id,
    badgeId: c.badgeId,
    label: c.label,
    group: 'CFM, Vent & Cooling Load' as const,
    isHvac: true,
  })),
  ...INVENTORY_COLUMNS.slice(5).map((c) => {
    let group: SelectableColumnMeta['group'] = 'Lights';
    if (['H10', 'H11', 'H12', 'H13', 'H14'].includes(c.badgeId)) group = 'Fans & Exhaust';
    else if (['H16', 'H17', 'H18', 'H19', 'H20'].includes(c.badgeId)) group = 'Sockets & Power';
    else if (['H21', 'H22'].includes(c.badgeId)) group = 'AC';
    return {
      id: c.id,
      badgeId: c.badgeId,
      label: c.label,
      group,
    };
  }),
];

const ALL_COLUMN_IDS = SELECTABLE_COLUMNS.map((c) => c.id);

const RAW_EMERGENCY_KEYS: RawEmergencyColumnKey[] = [
  'socket2x5a',
  'socket20a',
  'computerBoard',
  'socket3x20a',
  'noOfAc',
];

const RAW_EMERGENCY_KEY_SET = new Set<string>(RAW_EMERGENCY_KEYS);

function isRawEmergencyKey(key: string): key is RawEmergencyColumnKey {
  return RAW_EMERGENCY_KEY_SET.has(key);
}

function getRowPowerSource(row: InventoryRow, key: RawEmergencyColumnKey): PowerSourceType {
  return row.powerSources?.[key] === 'emergency' ? 'emergency' : 'raw';
}

const MANUAL_ONLY_FIELDS = new Set<string>([
  'ceilingFan1200',
  'ceilingFan1400',
  'wallFan400',
  'exhaustFan225',
  'exhaustFan300',
  'noOfAc',
  'tonnage',
]);

function applyHvacSyncToRow(row: InventoryRow, settings: HvacDesignSettings): InventoryRow {
  const calc = computeRowHvac(row, settings);
  if (calc.areaSqm <= 0) {
    return {
      ...row,
      noOfAc: calc.acEnabled ? row.noOfAc : '0',
      tonnage: calc.acEnabled ? row.tonnage : '0',
    };
  }
  return {
    ...row,
    ceilingFan1200: String(calc.recH10),
    ceilingFan1400: String(calc.recH11),
    wallFan400: String(calc.recH12),
    exhaustFan225: String(calc.recH13),
    exhaustFan300: String(calc.recH14),
    noOfAc: String(calc.recNoOfAc),
    tonnage: calc.acEnabled ? String(calc.recTonnage) : '0',
  };
}

interface LuxCalculationSettings {
  utilizationFactor: number; // UF (e.g. 0.8)
  maintenanceFactor: number; // MF (e.g. 0.8)
  lumenPer20wTube: number;
  lumenPer40wTube: number;
  lumenPer36wSurface: number;
  lumenPer20wRecess: number;
  lumenPer36wRecess: number;
  lumenPer20wBulb: number;
}

const DEFAULT_LUX_SETTINGS: LuxCalculationSettings = {
  utilizationFactor: 0.8,
  maintenanceFactor: 0.8,
  lumenPer20wTube: 2000,
  lumenPer40wTube: 4000,
  lumenPer36wSurface: 3600,
  lumenPer20wRecess: 2000,
  lumenPer36wRecess: 3600,
  lumenPer20wBulb: 2000,
};

const INITIAL_ROWS: InventoryRow[] = [
  createEmptyRow('Ground Floor'),
  createEmptyRow('Ground Floor'),
  createEmptyRow('Ground Floor'),
];

interface RowLuxCalc {
  areaSqm: number;
  targetLux: number;
  rawLuxAreaLumens: number; // Lux * Area(m2)
  requiredDesignLumens: number; // (Lux * Area) / (UF * MF)
  installedLumens: number;
  achievedLux: number; // (Installed Lumens * UF * MF) / Area(m2)
  luxGap: number; // achievedLux - targetLux
  lumenGap: number; // requiredDesignLumens - installedLumens
  luxRefLabel: string;
}

function numVal(v?: string): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return isNaN(n) || n < 0 ? 0 : n;
}

function computeRowLux(row: InventoryRow, settings: LuxCalculationSettings): RowLuxCalc {
  const sqmtVal = numVal(row.sqmt);
  const sqftVal = numVal(row.sqft);
  // Use SQMT if present, otherwise convert Sqft to m² (1 m² = 10.7639 sq.ft)
  const areaSqm = sqmtVal > 0 ? sqmtVal : sqftVal > 0 ? sqftVal / 10.7639 : 0;

  const ref = getLuxReferenceById(row.luxCategoryId);
  const overrideLux = numVal(row.targetLux);
  const targetLux = overrideLux > 0 ? overrideLux : (ref ? ref.recommendedLux : 0);

  const uf = settings.utilizationFactor > 0 ? settings.utilizationFactor : 0.8;
  const mf = settings.maintenanceFactor > 0 ? settings.maintenanceFactor : 0.8;

  const rawLuxAreaLumens = areaSqm * targetLux;
  const requiredDesignLumens = rawLuxAreaLumens > 0 ? rawLuxAreaLumens / (uf * mf) : 0;

  const installedLumens =
    numVal(row.tube20w) * settings.lumenPer20wTube +
    numVal(row.tube40w) * settings.lumenPer40wTube +
    numVal(row.surfaceLight36w) * settings.lumenPer36wSurface +
    numVal(row.recessLight20w) * settings.lumenPer20wRecess +
    numVal(row.recessLight36w) * settings.lumenPer36wRecess +
    numVal(row.bulbPoint20w) * settings.lumenPer20wBulb;

  const achievedLux = areaSqm > 0 ? (installedLumens * uf * mf) / areaSqm : 0;
  const luxGap = achievedLux - targetLux;
  const lumenGap = requiredDesignLumens - installedLumens;

  return {
    areaSqm,
    targetLux,
    rawLuxAreaLumens,
    requiredDesignLumens,
    installedLumens,
    achievedLux,
    luxGap,
    lumenGap,
    luxRefLabel: ref ? `${ref.slNo} ${ref.label} (${ref.luxDisplay} lx)` : 'Not selected',
  };
}

interface InventoryTableProps {
  rows?: InventoryRow[];
  onRowsChange?: React.Dispatch<React.SetStateAction<InventoryRow[]>>;
  onSubmitInventory?: () => void;
  onProceedToNext: () => void;
  onNotify?: (msg: string) => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  rows: propRows,
  onRowsChange,
  onSubmitInventory,
  onProceedToNext,
  onNotify,
}) => {
  const [internalRows, setInternalRows] = useState<InventoryRow[]>(() => {
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
    return INITIAL_ROWS;
  });

  const rows = propRows ?? internalRows;
  const setRows = onRowsChange ?? setInternalRows;

  const [luxSettings, setLuxSettings] = useState<LuxCalculationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LUX_SETTINGS);
      if (saved) {
        return { ...DEFAULT_LUX_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load lux settings:', e);
    }
    return DEFAULT_LUX_SETTINGS;
  });

  const [hvacSettings, setHvacSettings] = useState<HvacDesignSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HVAC_SETTINGS);
      if (saved) {
        return { ...DEFAULT_HVAC_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load hvac settings:', e);
    }
    return DEFAULT_HVAC_SETTINGS;
  });

  const [autoSyncHvac, setAutoSyncHvac] = useState(true);
  const [defaultFloor, setDefaultFloor] = useState<string>('Ground Floor');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState('Electrical & AC Room-wise Survey Inventory');
  const [showLuxSettings, setShowLuxSettings] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [exportVisibleOnly, setExportVisibleOnly] = useState(true);
  const [isLuxRefModalOpen, setIsLuxRefModalOpen] = useState(false);

  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VISIBLE_COLS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((id) => ALL_COLUMN_IDS.includes(id));
          if (valid.length > 0) return new Set(valid);
        }
      }
    } catch (e) {
      console.error('Failed to load visible columns:', e);
    }
    return new Set(ALL_COLUMN_IDS);
  });

  useEffect(() => {
    if (propRows !== undefined) return;
    try {
      localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(internalRows));
    } catch (e) {
      console.error('Failed to persist inventory rows:', e);
    }
  }, [internalRows, propRows]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LUX_SETTINGS, JSON.stringify(luxSettings));
    } catch (e) {
      console.error('Failed to persist lux settings:', e);
    }
  }, [luxSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HVAC_SETTINGS, JSON.stringify(hvacSettings));
    } catch (e) {
      console.error('Failed to persist hvac settings:', e);
    }
  }, [hvacSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VISIBLE_COLS, JSON.stringify(Array.from(visibleColumnIds)));
    } catch (e) {
      console.error('Failed to persist visible columns:', e);
    }
  }, [visibleColumnIds]);

  const toggleColumnVisibility = (colId: string) => {
    setVisibleColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) {
        if (next.size <= 1) {
          onNotify?.('At least one column must remain visible.');
          return prev;
        }
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const applyColumnPreset = (ids: string[], label: string) => {
    setVisibleColumnIds(new Set(ids));
    onNotify?.(`Column preset applied: ${label} (${ids.length} columns)`);
  };

  const toggleColumnGroup = (group: SelectableColumnMeta['group']) => {
    const groupIds = SELECTABLE_COLUMNS.filter((c) => c.group === group).map((c) => c.id);
    const allInGroupVisible = groupIds.every((id) => visibleColumnIds.has(id));
    setVisibleColumnIds((prev) => {
      const next = new Set(prev);
      if (allInGroupVisible) {
        groupIds.forEach((id) => next.delete(id));
        if (next.size === 0) {
          next.add('inv_hdr_sl_no');
          next.add('inv_hdr_room');
        }
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const visibleCoreCols = useMemo(
    () => INVENTORY_COLUMNS.slice(0, 5).filter((c) => visibleColumnIds.has(c.id)),
    [visibleColumnIds]
  );
  const visibleLuxCols = useMemo(
    () => LUX_COLUMN_DEFS.filter((c) => visibleColumnIds.has(c.id)),
    [visibleColumnIds]
  );
  const visibleHvacCols = useMemo(
    () => HVAC_COLUMN_DEFS.filter((c) => visibleColumnIds.has(c.id)),
    [visibleColumnIds]
  );
  const visibleRemainingCols = useMemo(
    () => INVENTORY_COLUMNS.slice(5).filter((c) => visibleColumnIds.has(c.id)),
    [visibleColumnIds]
  );

  const presentFloors = useMemo(() => {
    const present = new Set<string>(rows.map((r) => r.floor || 'Ground Floor'));
    const ordered: string[] = [];
    for (const f of FLOOR_OPTIONS) {
      if (present.has(f)) {
        ordered.push(f);
        present.delete(f);
      }
    }
    for (const extra of present) ordered.push(extra);
    return ordered;
  }, [rows]);

  const displayedRowEntries = useMemo(() => {
    return rows
      .map((row, origIdx) => ({ row, origIdx }))
      .filter(({ row }) => floorFilter === 'ALL' || (row.floor || 'Ground Floor') === floorFilter);
  }, [rows, floorFilter]);

  // Add a new empty row at the end (assigned to selected floor or defaultFloor)
  const handleAddRow = () => {
    const targetFloor = floorFilter !== 'ALL' ? floorFilter : defaultFloor;
    const newRow = createEmptyRow(targetFloor);
    setRows((prev) => [...prev, newRow]);
    onNotify?.(`Added row Sl.no. ${rows.length + 1} (${targetFloor})`);
  };

  const handleApplyFloorToSelected = (targetFloor: string) => {
    if (!targetFloor || selectedIds.size === 0) return;
    const count = selectedIds.size;
    setRows((prev) =>
      prev.map((r) => (selectedIds.has(r.id) ? { ...r, floor: targetFloor } : r))
    );
    onNotify?.(`Assigned "${targetFloor}" to ${count} selected ${count === 1 ? 'row' : 'rows'}.`);
  };

  const handleSubmit = () => {
    try {
      localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(rows));
    } catch (e) {
      console.error('Failed to persist inventory on submit:', e);
    }
    if (onSubmitInventory) {
      onSubmitInventory();
    } else {
      onProceedToNext();
    }
  };

  // Toggle selection for one row
  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all rows
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  // Delete all selected rows
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
    onNotify?.(`Deleted ${count} selected ${count === 1 ? 'row' : 'rows'}. Serial numbers updated.`);
  };

  // Update individual cell value (with bidirectional SQMT <-> Sqft conversion and HVAC auto-sync)
  const handleCellChange = (
    rowId: string,
    key: keyof Omit<InventoryRow, 'id'>,
    value: string
  ) => {
    const SQFT_PER_SQMT = 10.7639104;
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        let nextRow: InventoryRow = { ...row, [key]: value };

        if (key === 'sqmt') {
          if (value.trim() === '') {
            nextRow.sqft = '';
          } else {
            const parsed = parseFloat(value);
            if (!isNaN(parsed) && parsed >= 0) {
              nextRow.sqft = Number((parsed * SQFT_PER_SQMT).toFixed(2)).toString();
            }
          }
        } else if (key === 'sqft') {
          if (value.trim() === '') {
            nextRow.sqmt = '';
          } else {
            const parsed = parseFloat(value);
            if (!isNaN(parsed) && parsed >= 0) {
              nextRow.sqmt = Number((parsed / SQFT_PER_SQMT).toFixed(2)).toString();
            }
          }
        }

        if (key === 'room' && !row.ventType) {
          const inferredVent = inferVentTypeFromRoom(value, row.luxCategoryId);
          if (inferredVent === 'toilet') {
            nextRow.acRequired = 'no';
          }
        }
        if (autoSyncHvac && !MANUAL_ONLY_FIELDS.has(key)) {
          nextRow = applyHvacSyncToRow(nextRow, hvacSettings);
        }
        return nextRow;
      })
    );
  };

  // Patch arbitrary HVAC/Vent fields on a row
  const handlePatchRow = (
    rowId: string,
    patch: Partial<InventoryRow>,
    skipAutoSync?: boolean
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const nextRow: InventoryRow = { ...row, ...patch };
        return autoSyncHvac && !skipAutoSync
          ? applyHvacSyncToRow(nextRow, hvacSettings)
          : nextRow;
      })
    );
  };

  // Toggle Raw vs Emergency supply for a specific room and column (#H17-#H21)
  const handlePowerSourceChange = (
    rowId: string,
    colKey: RawEmergencyColumnKey,
    mode: PowerSourceType
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          powerSources: {
            ...(row.powerSources || {}),
            [colKey]: mode,
          },
        };
      })
    );
  };

  // Apply Raw or Emergency across all rooms for a single column (#H17-#H21)
  const handleColumnPowerSourceAll = (
    colKey: RawEmergencyColumnKey,
    colLabel: string,
    mode: PowerSourceType
  ) => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        powerSources: {
          ...(row.powerSources || {}),
          [colKey]: mode,
        },
      }))
    );
    onNotify?.(
      `Set ${colLabel} supply to ${mode === 'emergency' ? 'Emergency' : 'Raw'} for all ${rows.length} rooms.`
    );
  };

  // Select room Lux category from IS:3646 dropdown
  const handleLuxCategoryChange = (rowId: string, categoryId: string) => {
    const ref = getLuxReferenceById(categoryId);
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const inferredVent = inferVentTypeFromRoom(row.room, categoryId);
        const defaultAc = inferDefaultAcRequired(row.room, categoryId);
        const nextRow: InventoryRow = {
          ...row,
          luxCategoryId: categoryId,
          targetLux: ref ? String(ref.recommendedLux) : '',
          ventType: row.ventType || inferredVent,
          acRequired: defaultAc ? 'yes' : 'no',
        };
        return autoSyncHvac ? applyHvacSyncToRow(nextRow, hvacSettings) : nextRow;
      })
    );
  };

  // Update HVAC settings & optionally re-sync rows
  const handleUpdateHvacSettings = (nextSettings: HvacDesignSettings) => {
    setHvacSettings(nextSettings);
    if (autoSyncHvac) {
      setRows((prev) => prev.map((r) => applyHvacSyncToRow(r, nextSettings)));
    }
  };

  // Sync calculated #H10-#H14 & #H21-#H22 across all rows
  const handleSyncAllHvacToInventory = () => {
    setRows((prev) => prev.map((r) => applyHvacSyncToRow(r, hvacSettings)));
    onNotify?.('Updated #H10–#H14 (Fans/Toilet Exhaust) & #H21–#H22 (AC/Tonnage) for all rooms.');
  };

  // Sync single row
  const handleSyncSingleHvacRow = (rowId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? applyHvacSyncToRow(r, hvacSettings) : r))
    );
    onNotify?.('Updated #H10–#H14 & #H21–#H22 for selected room.');
  };

  // Drag-and-drop row reordering (automatically updates Sl.no. based on array index)
  const handleDragStart = (index: number, e: React.DragEvent<HTMLTableRowElement>) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index: number, e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (dropIndex: number, e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    const fromIndex = draggedIndex !== null ? draggedIndex : parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== dropIndex && fromIndex >= 0 && fromIndex < rows.length) {
      setRows((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(dropIndex, 0, moved);
        return updated;
      });
      onNotify?.(`Moved item from Sl.no. ${fromIndex + 1} to Sl.no. ${dropIndex + 1}`);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Explicit move up / move down helper buttons
  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.splice(target, 0, moved);
      return updated;
    });
  };

  // Reset inventory rows
  const handleResetRows = () => {
    if (window.confirm('Clear all entries and reset the inventory table to 3 blank rows?')) {
      setRows([
        createEmptyRow(defaultFloor),
        createEmptyRow(defaultFloor),
        createEmptyRow(defaultFloor),
      ]);
      setSelectedIds(new Set());
      setFloorFilter('ALL');
      onNotify?.('Inventory table reset.');
    }
  };

  // Calculate Lux requirements for every row
  const rowLuxCalcs = useMemo(() => {
    return rows.map((row) => computeRowLux(row, luxSettings));
  }, [rows, luxSettings]);

  // Calculate CFM, Toilet Ventilation (#H10-#H14) & Cooling Load (#H21-#H22) for every row
  const rowHvacCalcs = useMemo(() => {
    return rows.map((row) => computeRowHvac(row, hvacSettings));
  }, [rows, hvacSettings]);

  // Calculate column totals across all rows
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of INVENTORY_COLUMNS) {
      if (col.type === 'number' && col.key !== 'slNo') {
        const fieldKey = col.key;
        totals[fieldKey] = rows.reduce((sum, row) => {
          const val = parseFloat(row[fieldKey] || '');
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
      }
    }
    return totals;
  }, [rows]);

  // Calculate Raw vs Emergency breakdown for columns #H17-#H21
  const rawEmergencyTotals = useMemo(() => {
    const breakdown: Record<
      RawEmergencyColumnKey,
      { raw: number; emergency: number; rawRooms: number; emergencyRooms: number }
    > = {
      socket2x5a: { raw: 0, emergency: 0, rawRooms: 0, emergencyRooms: 0 },
      socket20a: { raw: 0, emergency: 0, rawRooms: 0, emergencyRooms: 0 },
      computerBoard: { raw: 0, emergency: 0, rawRooms: 0, emergencyRooms: 0 },
      socket3x20a: { raw: 0, emergency: 0, rawRooms: 0, emergencyRooms: 0 },
      noOfAc: { raw: 0, emergency: 0, rawRooms: 0, emergencyRooms: 0 },
    };

    for (const row of rows) {
      for (const key of RAW_EMERGENCY_KEYS) {
        const mode = getRowPowerSource(row, key);
        const val = parseFloat(row[key] || '');
        const numeric = isNaN(val) ? 0 : val;
        if (mode === 'emergency') {
          breakdown[key].emergency += numeric;
          breakdown[key].emergencyRooms += 1;
        } else {
          breakdown[key].raw += numeric;
          breakdown[key].rawRooms += 1;
        }
      }
    }

    return breakdown;
  }, [rows]);

  // Calculate Total Raw vs Emergency Tonnage (#H22) based on #H21 (no of AC) Raw/Emergency toggle
  const tonnageSplit = useMemo(() => {
    let raw = 0;
    let emergency = 0;
    for (const row of rows) {
      const trVal = parseFloat(row.tonnage || '');
      const numericTr = isNaN(trVal) ? 0 : trVal;
      if (getRowPowerSource(row, 'noOfAc') === 'emergency') {
        emergency += numericTr;
      } else {
        raw += numericTr;
      }
    }
    return { raw, emergency };
  }, [rows]);

  // Overall Lux Totals across all rooms
  const luxTotals = useMemo(() => {
    return rowLuxCalcs.reduce(
      (acc, c) => ({
        totalAreaSqm: acc.totalAreaSqm + c.areaSqm,
        totalRequiredDesignLumens: acc.totalRequiredDesignLumens + c.requiredDesignLumens,
        totalInstalledLumens: acc.totalInstalledLumens + c.installedLumens,
      }),
      { totalAreaSqm: 0, totalRequiredDesignLumens: 0, totalInstalledLumens: 0 }
    );
  }, [rowLuxCalcs]);

  // Export Inventory + Room-wise Lux + Cooling Load & CFM to Excel (.xlsx)
  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const activeCoreCols = exportVisibleOnly ? visibleCoreCols : INVENTORY_COLUMNS.slice(0, 5);
    const activeLuxCols = exportVisibleOnly ? visibleLuxCols : LUX_COLUMN_DEFS;
    const activeHvacCols = exportVisibleOnly ? visibleHvacCols : HVAC_COLUMN_DEFS;
    const activeRemCols = exportVisibleOnly ? visibleRemainingCols : INVENTORY_COLUMNS.slice(5);
    const activeInvCols = [...activeCoreCols, ...activeRemCols];

    const luxBadgeMap: Record<LuxColumnId, string> = {
      inv_hdr_lux_category: 'H23',
      inv_hdr_target_lux: 'H24',
      inv_hdr_req_lumens: 'H25',
      inv_hdr_installed_lux: 'H26',
      inv_hdr_lux_status: 'H27',
    };
    const luxLabelMap: Record<LuxColumnId, string> = {
      inv_hdr_lux_category: 'Room Lux Category (IS:3646)',
      inv_hdr_target_lux: 'Target Lux (lx)',
      inv_hdr_req_lumens: 'Req. Lumens (Design)',
      inv_hdr_installed_lux: 'Installed Lumens / Achieved Lux',
      inv_hdr_lux_status: 'Lux Status / Gap',
    };
    const hvacBadgeMap: Record<HvacColumnId, string> = {
      inv_hdr_ac_required: 'H28',
      inv_hdr_cfm_vent: 'H29',
      inv_hdr_cooling_load: 'H30',
    };
    const hvacLabelMap: Record<HvacColumnId, string> = {
      inv_hdr_ac_required: 'AC Required?',
      inv_hdr_cfm_vent: 'Room CFM & Vent Mode',
      inv_hdr_cooling_load: 'Cooling Load (TR / BTU)',
    };

    const headerIdsRow = [
      ...activeCoreCols.map((c) => c.badgeId),
      ...activeLuxCols.map((c) => luxBadgeMap[c.id]),
      ...activeHvacCols.map((c) => hvacBadgeMap[c.id]),
      ...activeRemCols.map((c) => c.badgeId),
    ];
    const headersRow = [
      ...activeCoreCols.map((c) => c.label),
      ...activeLuxCols.map((c) => luxLabelMap[c.id]),
      ...activeHvacCols.map((c) => hvacLabelMap[c.id]),
      ...activeRemCols.map((c) => c.label),
    ];

    const mapInvCell = (row: InventoryRow, idx: number, col: InventoryColumn) => {
      if (col.key === 'slNo') return idx + 1;
      if (col.key === 'floor') return row.floor || 'Ground Floor';
      const raw = row[col.key] || '';
      if (col.type === 'number' && raw !== '') {
        const parsed = parseFloat(raw);
        return isNaN(parsed) ? raw : parsed;
      }
      return raw;
    };

    const bodyRows = rows.map((row, idx) => {
      const calc = rowLuxCalcs[idx];
      const hCalc = rowHvacCalcs[idx];
      const statusText =
        calc.areaSqm <= 0 || calc.targetLux <= 0
          ? 'Enter Area & Lux Category'
          : calc.luxGap >= 0
          ? `OK (+${Math.round(calc.luxGap)} lx)`
          : `Deficit ${Math.round(calc.luxGap)} lx (Need +${Math.round(calc.lumenGap).toLocaleString()} lm)`;

      const luxValues: Record<LuxColumnId, string | number> = {
        inv_hdr_lux_category: calc.luxRefLabel,
        inv_hdr_target_lux: calc.targetLux || '',
        inv_hdr_req_lumens: calc.requiredDesignLumens > 0 ? Math.round(calc.requiredDesignLumens) : '',
        inv_hdr_installed_lux:
          calc.installedLumens > 0
            ? `${Math.round(calc.installedLumens)} lm (${Math.round(calc.achievedLux)} lx)`
            : 0,
        inv_hdr_lux_status: statusText,
      };

      const hvacValues: Record<HvacColumnId, string | number> = {
        inv_hdr_ac_required: hCalc.acEnabled ? 'Yes' : 'No',
        inv_hdr_cfm_vent:
          hCalc.areaSqm > 0
            ? `${Math.round(hCalc.requiredCfm)} CFM (${hCalc.effectiveVentType === 'toilet' ? 'Toilet 12 ACH' : hCalc.effectiveVentType === 'kitchen_lab' ? 'Kitchen/Lab' : 'General'})`
            : hCalc.effectiveVentType,
        inv_hdr_cooling_load:
          hCalc.acEnabled && hCalc.areaSqm > 0
            ? `${hCalc.calculatedTr.toFixed(2)} TR (${Math.round(hCalc.totalBtuHr).toLocaleString()} BTU/hr)`
            : hCalc.acEnabled
            ? 'Enter Area'
            : 'No AC',
      };

      return [
        ...activeCoreCols.map((col) => mapInvCell(row, idx, col)),
        ...activeLuxCols.map((col) => luxValues[col.id]),
        ...activeHvacCols.map((col) => hvacValues[col.id]),
        ...activeRemCols.map((col) => mapInvCell(row, idx, col)),
      ];
    });

    const mapTotalCell = (col: InventoryColumn) => {
      if (col.key === 'slNo' || col.key === 'floor') return '';
      if (col.key === 'room') return 'TOTAL';
      const totalVal = columnTotals[col.key] || 0;
      return Number(totalVal.toFixed(2));
    };

    const luxTotalValues: Record<LuxColumnId, string | number> = {
      inv_hdr_lux_category: `UF=${luxSettings.utilizationFactor}, MF=${luxSettings.maintenanceFactor}`,
      inv_hdr_target_lux: '',
      inv_hdr_req_lumens: Math.round(luxTotals.totalRequiredDesignLumens),
      inv_hdr_installed_lux: Math.round(luxTotals.totalInstalledLumens),
      inv_hdr_lux_status:
        luxTotals.totalRequiredDesignLumens > 0
          ? `Gap: ${Math.round(luxTotals.totalInstalledLumens - luxTotals.totalRequiredDesignLumens).toLocaleString()} lm`
          : '',
    };

    const totalCfmSum = rowHvacCalcs.reduce((s, c) => s + c.requiredCfm, 0);
    const totalTrSum = rowHvacCalcs.reduce((s, c) => s + c.calculatedTr, 0);
    const totalAcRooms = rowHvacCalcs.filter((c) => c.acEnabled).length;
    const hvacTotalValues: Record<HvacColumnId, string | number> = {
      inv_hdr_ac_required: `${totalAcRooms}/${rows.length} AC`,
      inv_hdr_cfm_vent: `${Math.round(totalCfmSum).toLocaleString()} CFM`,
      inv_hdr_cooling_load: `${totalTrSum.toFixed(2)} TR`,
    };

    const totalRow = [
      ...activeCoreCols.map(mapTotalCell),
      ...activeLuxCols.map((col) => luxTotalValues[col.id]),
      ...activeHvacCols.map((col) => hvacTotalValues[col.id]),
      ...activeRemCols.map(mapTotalCell),
    ];

    const mapPowerSplitCell = (col: InventoryColumn, mode: PowerSourceType): string | number => {
      if (col.key === 'slNo' || col.key === 'floor') return '';
      if (col.key === 'room') {
        return mode === 'raw' ? 'RAW POWER TOTAL (#H17–#H21 & TR)' : 'EMERGENCY POWER TOTAL (#H17–#H21 & TR)';
      }
      if (isRawEmergencyKey(col.key)) {
        const val = rawEmergencyTotals[col.key][mode];
        return Number(val.toFixed(2));
      }
      if (col.key === 'tonnage') {
        return Number(tonnageSplit[mode].toFixed(2));
      }
      return '';
    };

    const rawPowerTotalRow = [
      ...activeCoreCols.map((col) => mapPowerSplitCell(col, 'raw')),
      ...activeLuxCols.map(() => ''),
      ...activeHvacCols.map(() => ''),
      ...activeRemCols.map((col) => mapPowerSplitCell(col, 'raw')),
    ];

    const emergencyPowerTotalRow = [
      ...activeCoreCols.map((col) => mapPowerSplitCell(col, 'emergency')),
      ...activeLuxCols.map(() => ''),
      ...activeHvacCols.map(() => ''),
      ...activeRemCols.map((col) => mapPowerSplitCell(col, 'emergency')),
    ];

    const sheetData = [
      [projectTitle],
      [`Generated on ${new Date().toLocaleDateString('en-IN')} | IS : 3646 Lux & HVAC Cooling Load / CFM Sizing | ${activeInvCols.length + activeLuxCols.length + activeHvacCols.length} columns`],
      [],
      headerIdsRow,
      headersRow,
      ...bodyRows,
      totalRow,
      rawPowerTotalRow,
      emergencyPowerTotalRow,
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sheetData);
    const luxWidths: Record<LuxColumnId, number> = {
      inv_hdr_lux_category: 36,
      inv_hdr_target_lux: 15,
      inv_hdr_req_lumens: 20,
      inv_hdr_installed_lux: 26,
      inv_hdr_lux_status: 28,
    };
    const hvacWidths: Record<HvacColumnId, number> = {
      inv_hdr_ac_required: 14,
      inv_hdr_cfm_vent: 28,
      inv_hdr_cooling_load: 26,
    };
    ws1['!cols'] = [
      ...activeCoreCols.map((col) => ({
        wch: col.key === 'slNo' ? 8 : col.key === 'floor' ? 16 : col.key === 'room' ? 24 : 15,
      })),
      ...activeLuxCols.map((col) => ({ wch: luxWidths[col.id] })),
      ...activeHvacCols.map((col) => ({ wch: hvacWidths[col.id] })),
      ...activeRemCols.map(() => ({ wch: 15 })),
    ];

    // Second sheet: IS 3646 Lux Reference Table
    const refData = [
      ['Recommended Lux Values For Interior Illumination (As per IS : 3646 Part II - 1966)'],
      [],
      ['Building Group', 'Sl. No.', 'Classification of Building / Room', 'IS:3646 Lux', 'Default Target Lux'],
      ...IS_3646_LUX_REFERENCES.map((r) => [
        r.buildingGroup,
        r.slNo,
        r.label,
        r.luxDisplay,
        r.recommendedLux,
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(refData);
    ws2['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 46 }, { wch: 18 }, { wch: 18 }];

    // Third sheet: Room-wise Cooling Load & CFM Chart + Reference Table
    const coolingSheetData = [
      ['Room-Wise Cooling Load, CFM & Toilet Ventilation Chart'],
      [`Default Ceiling Ht: ${hvacSettings.defaultHeightFt} ft | Room ACH: ${hvacSettings.generalAch} | Toilet ACH: ${hvacSettings.toiletAch} | Safety Margin: ${hvacSettings.safetyFactorPct}%`],
      [],
      [
        'Sl.no.',
        'Room',
        'Area (m²)',
        'Area (sq.ft)',
        'Vent Mode',
        'AC Required?',
        'Height (ft)',
        'People',
        'Required CFM',
        'H10 (1200mm)',
        'H11 (1400mm)',
        'H12 (Wall Fan)',
        'H13 (225mm Exh)',
        'H14 (300mm Exh)',
        'Envelope BTU/hr',
        'Occupant BTU/hr',
        'Lighting BTU/hr',
        'Equipment BTU/hr',
        'Total BTU/hr',
        'Calculated TR',
        'H21 (No. of AC)',
        'H22 (Total Tonnage TR)',
      ],
      ...rows.map((row, idx) => {
        const c = rowHvacCalcs[idx];
        return [
          idx + 1,
          row.room || `Room ${idx + 1}`,
          Number(c.areaSqm.toFixed(2)),
          Number(c.areaSqft.toFixed(1)),
          c.effectiveVentType,
          c.acEnabled ? 'Yes' : 'No',
          c.heightFt,
          c.effectiveOccupants,
          Math.round(c.requiredCfm),
          c.recH10,
          c.recH11,
          c.recH12,
          c.recH13,
          c.recH14,
          Math.round(c.envelopeBtu),
          Math.round(c.occupantBtu),
          Math.round(c.lightingBtu),
          Math.round(c.equipmentBtu),
          Math.round(c.totalBtuHr),
          Number(c.calculatedTr.toFixed(2)),
          c.recNoOfAc,
          c.recTonnage,
        ];
      }),
      [],
      ['Standard Area-Wise Cooling Load Reference Chart (10 ft Ceiling Height)'],
      ['Area (sq.ft)', 'Area (m²)', 'Standard BTU/hr', 'Mid-Floor TR', 'Top/Sunny TR', 'Dense/Conf TR', 'Suggested AC'],
      ...COOLING_LOAD_REFERENCE_CHART.map((r) => [
        r.areaSqft,
        r.areaSqm,
        r.normalBtu,
        r.normalTr,
        r.sunnyTr,
        r.denseTr,
        r.suggestedAc,
      ]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(coolingSheetData);
    ws3['!cols'] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 11 },
      { wch: 12 },
      { wch: 14 },
      { wch: 13 },
      { wch: 11 },
      { wch: 9 },
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
      { wch: 14 },
      { wch: 14 },
      { wch: 15 },
      { wch: 15 },
      { wch: 14 },
      { wch: 15 },
      { wch: 14 },
      { wch: 13 },
      { wch: 14 },
      { wch: 18 },
    ];

    // Fourth sheet: Raw vs Emergency Supply Breakdown for #H17 - #H21 + AC Tonnage (#H22)
    const rawEmgCols = INVENTORY_COLUMNS.filter((c) => isRawEmergencyKey(c.key));
    const powerModeSheetData = [
      ['Room-Wise Raw vs Emergency Supply Schedule (#H17–#H21 & AC Tonnage #H22)'],
      [`Generated on ${new Date().toLocaleDateString('en-IN')}`],
      [],
      [
        'Sl.no.',
        'Room',
        ...rawEmgCols.flatMap((c) => [`${c.badgeId} ${c.label} (Qty)`, `${c.badgeId} Supply Mode`]),
        'H22 Tonnage (TR)',
        'H22 AC Supply Mode (from H21)',
      ],
      ...rows.map((row, idx) => {
        const trParsed = row.tonnage ? parseFloat(row.tonnage) : 0;
        const trVal = isNaN(trParsed) ? 0 : trParsed;
        const acMode = getRowPowerSource(row, 'noOfAc') === 'emergency' ? 'EMERGENCY' : 'RAW';
        return [
          idx + 1,
          row.room || `Room ${idx + 1}`,
          ...rawEmgCols.flatMap((c) => {
            const key = c.key as RawEmergencyColumnKey;
            const rawVal = row[key] || '';
            const parsed = rawVal !== '' ? parseFloat(rawVal) : 0;
            const qty = isNaN(parsed) ? 0 : parsed;
            const mode = getRowPowerSource(row, key) === 'emergency' ? 'EMERGENCY' : 'RAW';
            return [qty, mode];
          }),
          trVal,
          acMode,
        ];
      }),
      [],
      [
        '',
        'RAW POWER TOTAL',
        ...rawEmgCols.flatMap((c) => {
          const key = c.key as RawEmergencyColumnKey;
          return [Number(rawEmergencyTotals[key].raw.toFixed(2)), 'RAW'];
        }),
        Number(tonnageSplit.raw.toFixed(2)),
        'RAW',
      ],
      [
        '',
        'EMERGENCY SUPPLY TOTAL',
        ...rawEmgCols.flatMap((c) => {
          const key = c.key as RawEmergencyColumnKey;
          return [Number(rawEmergencyTotals[key].emergency.toFixed(2)), 'EMERGENCY'];
        }),
        Number(tonnageSplit.emergency.toFixed(2)),
        'EMERGENCY',
      ],
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(powerModeSheetData);
    ws4['!cols'] = [
      { wch: 8 },
      { wch: 24 },
      ...rawEmgCols.flatMap(() => [{ wch: 16 }, { wch: 16 }]),
      { wch: 16 },
      { wch: 24 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Inventory Lux & HVAC');
    XLSX.utils.book_append_sheet(wb, ws2, 'IS 3646 Lux Reference');
    XLSX.utils.book_append_sheet(wb, ws3, 'Cooling Load & CFM Chart');
    XLSX.utils.book_append_sheet(wb, ws4, 'Raw vs Emergency (H17-H22)');
    XLSX.writeFile(wb, `Site_Inventory_Lux_CoolingLoad_${Date.now()}.xlsx`);
    onNotify?.(`Exported ${activeInvCols.length + activeLuxCols.length + activeHvacCols.length} columns + Raw/Emergency & Cooling Load Charts to Excel.`);
  };

  return (
    <div className="space-y-2.5">
      {/* Compact Top Page Header & Consolidated Actions */}
      <div className="bg-white dark:bg-slate-900/95 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 shadow-xs dark:shadow-md space-y-1.5">
        {/* Row 1: Compact Title & Workflow / Export Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shrink-0">
              <ClipboardList className="w-3 h-3" />
              Step 2 · Inventory
            </span>

            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="text-sm font-bold text-slate-950 dark:text-white bg-transparent border-b border-transparent hover:border-slate-400 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none px-1 py-0.5 min-w-[200px] flex-1 max-w-xl truncate"
              title="Click to edit inventory title"
            />

            <span className="hidden xl:inline text-[11px] text-slate-600 dark:text-slate-400 shrink-0">
              IS:3646 · CFM · Cooling (<code className="text-emerald-700 dark:text-emerald-400 font-mono">H01–H30</code>)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap"
              title="Download Inventory, Lux & Cooling Load Chart as Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleResetRows}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white text-[11px] font-medium border border-slate-300 dark:border-slate-700/80 transition-colors whitespace-nowrap"
              title="Reset inventory table"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>

            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold border border-emerald-500 shadow-sm transition-all whitespace-nowrap"
              title="Submit Inventory & Open Building Load Calculation (Wattage Table)"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Submit · Building Load</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Row 2: Table Action Buttons & Floor Controls (All within Top Section) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold border border-emerald-500 dark:border-emerald-400/40 shadow-xs transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                selectedIds.size > 0
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 dark:border-rose-400/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed'
              }`}
              title={selectedIds.size > 0 ? 'Delete selected rows' : 'Select rows using checkboxes to delete'}
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}</span>
            </button>

            <span className="h-4 w-px bg-slate-300 dark:bg-slate-800 mx-0.5 hidden sm:inline-block" />

            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap ${
                showColumnSelector
                  ? 'bg-emerald-50 dark:bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
              title="Select which columns (H01–H30) to display in the table"
            >
              <Columns3 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Columns ({visibleColumnIds.size}/{ALL_COLUMN_IDS.length})</span>
            </button>

            <button
              onClick={() => setIsLuxRefModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-[11px] font-semibold border border-amber-300 dark:border-amber-500/30 transition-colors whitespace-nowrap"
              title="Open IS:3646 (Part II) - 1966 Recommended Lux Reference Chart"
            >
              <Sun className="w-3 h-3" />
              <span>IS:3646 Lux</span>
            </button>

            <button
              type="button"
              onClick={() => {
                document
                  .getElementById('cooling-load-chart-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-50 dark:bg-cyan-500/15 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 text-cyan-800 dark:text-cyan-300 text-[11px] font-semibold border border-cyan-300 dark:border-cyan-500/30 transition-colors whitespace-nowrap"
              title="Jump to Cooling Load Chart & CFM Sizing section"
            >
              <ThermometerSnowflake className="w-3 h-3" />
              <span>Cooling Chart</span>
            </button>

            <button
              onClick={() => setShowLuxSettings(!showLuxSettings)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap ${
                showLuxSettings
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-950 dark:text-white border-slate-400 dark:border-slate-600'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
              title="Configure Utilization Factor, Maintenance Factor, and Fixture Lumens"
            >
              <SlidersHorizontal className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Lux Factors</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                <Layers className="w-3 h-3" />
                Default:
              </span>
              <select
                value={defaultFloor}
                onChange={(e) => setDefaultFloor(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded px-2 py-1 text-[11px] text-slate-950 dark:text-white focus:outline-none"
                title="Default floor assigned to newly added rows"
              >
                {FLOOR_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-medium">View:</span>
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 rounded px-2 py-1 text-[11px] text-slate-950 dark:text-white focus:outline-none"
                title="Filter visible inventory rows by floor"
              >
                <option value="ALL">All Floors ({rows.length})</option>
                {presentFloors.map((f) => (
                  <option key={f} value={f}>
                    {f} ({rows.filter((r) => (r.floor || 'Ground Floor') === f).length})
                  </option>
                ))}
              </select>
              {floorFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setFloorFilter('ALL')}
                  className="text-[11px] text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-200 underline"
                >
                  All
                </button>
              )}
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  Assign ({selectedIds.size}):
                </span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleApplyFloorToSelected(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="bg-amber-50 dark:bg-amber-950/40 border border-amber-400 dark:border-amber-500/40 rounded px-2 py-1 text-[11px] text-amber-900 dark:text-amber-200 focus:outline-none"
                >
                  <option value="" disabled>
                    Select floor...
                  </option>
                  {FLOOR_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Column Selection Panel */}
        {showColumnSelector && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-emerald-300 dark:border-emerald-500/30 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Columns3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-slate-950 dark:text-white">
                  Column Selection ({visibleColumnIds.size} of {ALL_COLUMN_IDS.length} visible)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyColumnPreset(ALL_COLUMN_IDS, 'All Columns')}
                  className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-[11px] font-medium"
                >
                  Select All ({ALL_COLUMN_IDS.length})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyColumnPreset(
                      [
                        'inv_hdr_sl_no',
                        'inv_hdr_floor',
                        'inv_hdr_room',
                        'inv_hdr_sqmt',
                        'inv_hdr_sqft',
                        ...HVAC_COLUMN_DEFS.map((c) => c.id),
                        'inv_hdr_1200_ceiling_fan',
                        'inv_hdr_1400_ceiling_fan',
                        'inv_hdr_400_wall_fan',
                        'inv_hdr_225_exhaust_fan',
                        'inv_hdr_300_exhaust_fan',
                        'inv_hdr_no_of_ac',
                        'inv_hdr_tonnage',
                      ],
                      'HVAC, CFM & Cooling Load'
                    )
                  }
                  className="px-2.5 py-1 rounded bg-cyan-50 dark:bg-cyan-500/15 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30 text-[11px] font-medium"
                >
                  HVAC, CFM &amp; Cooling Load
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyColumnPreset(
                      ['inv_hdr_sl_no', 'inv_hdr_floor', 'inv_hdr_room', 'inv_hdr_sqmt', 'inv_hdr_sqft', ...LUX_COLUMN_DEFS.map((c) => c.id)],
                      'Area & Lux Calc'
                    )
                  }
                  className="px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 text-[11px] font-medium"
                >
                  Area &amp; Lux Only
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyColumnPreset(
                      [
                        'inv_hdr_sl_no',
                        'inv_hdr_floor',
                        'inv_hdr_room',
                        'inv_hdr_sqmt',
                        'inv_hdr_sqft',
                        ...LUX_COLUMN_DEFS.map((c) => c.id),
                        'inv_hdr_20w_tube',
                        'inv_hdr_40w_tube',
                        'inv_hdr_36w_surface_light',
                        'inv_hdr_20w_recess_light',
                        'inv_hdr_36w_recess_light',
                        'inv_hdr_20w_bulb_point',
                      ],
                      'Lights & Lux'
                    )
                  }
                  className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[11px] font-medium"
                >
                  Lights &amp; Lux
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyColumnPreset(
                      INVENTORY_COLUMNS.map((c) => c.id),
                      'PDF Original (H01–H22)'
                    )
                  }
                  className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[11px] font-medium"
                >
                  PDF Original (H01–H22)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {([
                'Core & Area',
                'Lux Calc (IS:3646)',
                'CFM, Vent & Cooling Load',
                'Lights',
                'Fans & Exhaust',
                'Sockets & Power',
                'AC',
              ] as const).map((groupName) => {
                const groupCols = SELECTABLE_COLUMNS.filter((c) => c.group === groupName);
                const checkedCount = groupCols.filter((c) => visibleColumnIds.has(c.id)).length;
                return (
                  <div key={groupName} className="bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-1.5">
                      <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {groupName}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleColumnGroup(groupName)}
                        className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-medium"
                      >
                        {checkedCount === groupCols.length ? 'Uncheck' : 'Select'} ({checkedCount}/{groupCols.length})
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {groupCols.map((col) => {
                        const isChecked = visibleColumnIds.has(col.id);
                        return (
                          <label
                            key={col.id}
                            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer border text-[11px] transition-colors ${
                              isChecked
                                ? 'bg-slate-50 dark:bg-slate-950/90 border-slate-300 dark:border-slate-700 text-slate-950 dark:text-white'
                                : 'bg-transparent dark:bg-slate-950/30 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleColumnVisibility(col.id)}
                              className="rounded border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500/40"
                            />
                            <span
                              className={`font-mono text-[10px] px-1 rounded ${
                                col.isLux
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                                  : col.isHvac
                                  ? 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                              }`}
                            >
                              {col.badgeId}
                            </span>
                            <span className="truncate" title={col.label}>
                              {col.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400">
              <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={exportVisibleOnly}
                  onChange={(e) => setExportVisibleOnly(e.target.checked)}
                  className="rounded border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500/40"
                />
                <span>Excel export includes only selected columns</span>
              </label>
              <span>Row selection (SEL) &amp; reordering (DRAG) stay pinned on the left.</span>
            </div>
          </div>
        )}

        {/* Collapsible Lux Design Parameters (UF, MF, Fixture Lumens) */}
        {showLuxSettings && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-amber-300 dark:border-amber-500/30 space-y-3 text-xs animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5" />
                Lumen Method Parameters: Required Lumens = (Target Lux × Area m²) ÷ (UF × MF)
              </span>
              <button
                onClick={() => setLuxSettings(DEFAULT_LUX_SETTINGS)}
                className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white underline"
              >
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">Utilization Factor (UF)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1"
                  value={luxSettings.utilizationFactor}
                  onChange={(e) => setLuxSettings({ ...luxSettings, utilizationFactor: parseFloat(e.target.value) || 0.8 })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">Maintenance Factor (MF)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1"
                  value={luxSettings.maintenanceFactor}
                  onChange={(e) => setLuxSettings({ ...luxSettings, maintenanceFactor: parseFloat(e.target.value) || 0.8 })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">20W Tube (lm)</label>
                <input
                  type="number"
                  min="0"
                  value={luxSettings.lumenPer20wTube}
                  onChange={(e) => setLuxSettings({ ...luxSettings, lumenPer20wTube: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">40W Tube (lm)</label>
                <input
                  type="number"
                  min="0"
                  value={luxSettings.lumenPer40wTube}
                  onChange={(e) => setLuxSettings({ ...luxSettings, lumenPer40wTube: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">36W Surface (lm)</label>
                <input
                  type="number"
                  min="0"
                  value={luxSettings.lumenPer36wSurface}
                  onChange={(e) => setLuxSettings({ ...luxSettings, lumenPer36wSurface: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">20W Recess (lm)</label>
                <input
                  type="number"
                  min="0"
                  value={luxSettings.lumenPer20wRecess}
                  onChange={(e) => setLuxSettings({ ...luxSettings, lumenPer20wRecess: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">36W Recess (lm)</label>
                <input
                  type="number"
                  min="0"
                  value={luxSettings.lumenPer36wRecess}
                  onChange={(e) => setLuxSettings({ ...luxSettings, lumenPer36wRecess: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">20W Bulb (lm)</label>
                <input
                  type="number"
                  min="0"
                  value={luxSettings.lumenPer20wBulb}
                  onChange={(e) => setLuxSettings({ ...luxSettings, lumenPer20wBulb: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-slate-950 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Compact Status & Summary strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/70 text-[11px] text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <span>
              Rows: <strong className="text-slate-950 dark:text-white font-mono">{rows.length}</strong>
            </span>
            <span>
              Selected: <strong className="text-rose-700 dark:text-rose-400 font-mono">{selectedIds.size}</strong>
            </span>
            <span>
              Area: <strong className="text-emerald-700 dark:text-emerald-300 font-mono">{luxTotals.totalAreaSqm.toFixed(2)} m²</strong>
            </span>
            <span>
              Req. Lumens: <strong className="text-amber-700 dark:text-amber-300 font-mono">{Math.round(luxTotals.totalRequiredDesignLumens).toLocaleString()} lm</strong>
            </span>
            <span>
              Installed: <strong className="text-cyan-700 dark:text-cyan-300 font-mono">{Math.round(luxTotals.totalInstalledLumens).toLocaleString()} lm</strong>
            </span>
            <span>
              H17–H21 Emg:{' '}
              <strong className="text-amber-700 dark:text-amber-300 font-mono tabular-nums">
                {RAW_EMERGENCY_KEYS.reduce(
                  (sum, k) => sum + rawEmergencyTotals[k].emergency,
                  0
                )}{' '}
                pts
              </strong>
            </span>
            <span>
              AC:{' '}
              <strong className="text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                Raw {tonnageSplit.raw.toFixed(1)} TR
              </strong>{' '}
              ·{' '}
              <strong className="text-amber-700 dark:text-amber-300 font-mono tabular-nums">
                Emg {tonnageSplit.emergency.toFixed(1)} TR
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden md:flex items-center gap-1">
            <GripVertical className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Drag or ↑↓ to reorder Sl.no.
          </span>
        </div>
      </div>

      {/* Scrollable Inventory + Lux Calculation Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-xs dark:shadow-md overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-235px)] min-h-[380px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 sticky top-0 z-20 shadow-xs">
              <tr>
                {/* Selection Checkbox Header */}
                <th
                  id="inv_hdr_select"
                  className="py-2.5 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 text-center w-12 bg-slate-100 dark:bg-slate-950 sticky left-0 z-30"
                  title="Select rows to delete"
                >
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center justify-center p-0.5"
                    title={allSelected ? 'Deselect all rows' : 'Select all rows'}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  <span className="block text-[9px] font-mono text-slate-500 mt-0.5">SEL</span>
                </th>

                {/* Drag Handle Header */}
                <th
                  id="inv_hdr_reorder"
                  className="py-2.5 px-2 border-b border-r border-slate-300 dark:border-slate-800 text-center w-20 bg-slate-100 dark:bg-slate-950 sticky left-12 z-30"
                  title="Drag up or down to change serial no"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                    Order
                  </span>
                  <span className="block text-[9px] font-mono text-slate-500 mt-0.5">DRAG</span>
                </th>

                {/* Core / Area Columns (subset of H01 - H04) */}
                {visibleCoreCols.map((col) => (
                  <th
                    key={col.id}
                    id={col.id}
                    data-header-id={col.badgeId}
                    className={`py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 align-top ${col.minWidth} ${
                      col.key === 'slNo' ? 'text-center' : ''
                    }`}
                    title={`Header ID: ${col.badgeId} (${col.id}) — ${col.label}`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-0.5 self-start px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 font-mono text-[10px] font-bold">
                        <Hash className="w-2.5 h-2.5" />
                        {col.badgeId}
                      </span>
                      <span className="font-semibold text-[11px] leading-tight text-slate-950 dark:text-white">
                        {col.label}
                      </span>
                    </div>
                  </th>
                ))}

                {/* Lux Room Category & Requirement Calculation Columns (subset of H23 - H27) */}
                {visibleColumnIds.has('inv_hdr_lux_category') && (
                  <th
                    id="inv_hdr_lux_category"
                    data-header-id="H23"
                    className="py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 align-top min-w-[230px] bg-amber-50 dark:bg-amber-950/20"
                    title="Header ID: H23 — Room classification as per IS:3646 (Part II) - 1966"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-0.5 self-start px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-mono text-[10px] font-bold">
                        <Hash className="w-2.5 h-2.5" />
                        H23
                      </span>
                      <span className="font-semibold text-[11px] leading-tight text-amber-900 dark:text-amber-200">
                        Lux Room Category (IS:3646)
                      </span>
                    </div>
                  </th>
                )}

                {visibleColumnIds.has('inv_hdr_target_lux') && (
                  <th
                    id="inv_hdr_target_lux"
                    data-header-id="H24"
                    className="py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 align-top min-w-[96px] bg-amber-50 dark:bg-amber-950/20"
                    title="Header ID: H24 — Target Illumination in Lux"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-0.5 self-start px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-mono text-[10px] font-bold">
                        <Hash className="w-2.5 h-2.5" />
                        H24
                      </span>
                      <span className="font-semibold text-[11px] leading-tight text-amber-900 dark:text-amber-200">
                        Target Lux (lx)
                      </span>
                    </div>
                  </th>
                )}

                {visibleColumnIds.has('inv_hdr_req_lumens') && (
                  <th
                    id="inv_hdr_req_lumens"
                    data-header-id="H25"
                    className="py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 align-top min-w-[130px] bg-amber-50 dark:bg-amber-950/20 text-right"
                    title="Header ID: H25 — Required Lumens based on Room Area & Lux"
                  >
                    <div className="flex flex-col gap-1 items-end">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-mono text-[10px] font-bold">
                        <Hash className="w-2.5 h-2.5" />
                        H25
                      </span>
                      <span className="font-semibold text-[11px] leading-tight text-amber-900 dark:text-amber-200">
                        Req. Lumens (Area)
                      </span>
                    </div>
                  </th>
                )}

                {visibleColumnIds.has('inv_hdr_installed_lux') && (
                  <th
                    id="inv_hdr_installed_lux"
                    data-header-id="H26"
                    className="py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 align-top min-w-[130px] bg-amber-50 dark:bg-amber-950/20 text-right"
                    title="Header ID: H26 — Installed Lumens & Achieved Lux from Room Fixtures"
                  >
                    <div className="flex flex-col gap-1 items-end">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-mono text-[10px] font-bold">
                        <Hash className="w-2.5 h-2.5" />
                        H26
                      </span>
                      <span className="font-semibold text-[11px] leading-tight text-amber-900 dark:text-amber-200">
                        Achieved Lux / lm
                      </span>
                    </div>
                  </th>
                )}

                {/* Lux Gap / Status */}
                {visibleColumnIds.has('inv_hdr_lux_status') && (
                  <th
                    id="inv_hdr_lux_status"
                    data-header-id="H27"
                    className="py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 align-top min-w-[140px] bg-amber-50 dark:bg-amber-950/20"
                    title="Header ID: H27 — Illumination Compliance Status"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-0.5 self-start px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-mono text-[10px] font-bold">
                        <Hash className="w-2.5 h-2.5" />
                        H27
                      </span>
                      <span className="font-semibold text-[11px] leading-tight text-amber-900 dark:text-amber-200">
                        Lux Gap / Status
                      </span>
                    </div>
                  </th>
                )}

                {/* H28 - H30: AC Requirement, CFM & Vent Mode, Cooling Load */}
                {visibleColumnIds.has('inv_hdr_ac_required') && (
                  <th
                    id="inv_hdr_ac_required"
                    data-header-id="H28"
                    className="py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 align-top min-w-[110px] bg-cyan-50 dark:bg-cyan-950/25"
                    title="Header ID: H28 — Select whether room requires AC (updates #H21-#H22)"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-0.5 self-start px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950/90 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-mono text-[10px] font-bold">
                        <Hash className="w-2.5 h-2.5" />
                        H28
                      </span>
                      <span className="font-semibold text-[11px] leading-tight text-cyan-900 dark:text-cyan-200">
                        AC Required?
                      </span>
                    </div>
                  </th>
                )}

                {visibleColumnIds.has('inv_hdr_cfm_vent') && (
                  <th
                    id="inv_hdr_cfm_vent"
                    data-header-id="H29"
                    className="py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 align-top min-w-[165px] bg-cyan-50 dark:bg-cyan-950/25"
                    title="Header ID: H29 — Room-wise CFM & Toilet Ventilation mode (updates #H10-#H14)"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-0.5 self-start px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950/90 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-mono text-[10px] font-bold">
                        <Hash className="w-2.5 h-2.5" />
                        H29
                      </span>
                      <span className="font-semibold text-[11px] leading-tight text-cyan-900 dark:text-cyan-200">
                        CFM &amp; Vent Mode
                      </span>
                    </div>
                  </th>
                )}

                {visibleColumnIds.has('inv_hdr_cooling_load') && (
                  <th
                    id="inv_hdr_cooling_load"
                    data-header-id="H30"
                    className="py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 align-top min-w-[135px] bg-cyan-50 dark:bg-cyan-950/25 text-right"
                    title="Header ID: H30 — Calculated Room Cooling Load TR & BTU/hr (updates #H21-#H22)"
                  >
                    <div className="flex flex-col gap-1 items-end">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950/90 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-mono text-[10px] font-bold">
                        <Hash className="w-2.5 h-2.5" />
                        H30
                      </span>
                      <span className="font-semibold text-[11px] leading-tight text-cyan-900 dark:text-cyan-200">
                        Cooling Load (TR)
                      </span>
                    </div>
                  </th>
                )}

                {/* Remaining Inventory Columns (subset of H05 - H22; #H17-#H21 have Raw/Emergency toggle) */}
                {visibleRemainingCols.map((col) => {
                  const hasPowerToggle = isRawEmergencyKey(col.key);
                  const powerKey = hasPowerToggle ? (col.key as RawEmergencyColumnKey) : null;
                  const emgRoomCount = powerKey ? rawEmergencyTotals[powerKey].emergencyRooms : 0;
                  return (
                    <th
                      key={col.id}
                      id={col.id}
                      data-header-id={col.badgeId}
                      className={`py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-800 align-top ${col.minWidth}`}
                      title={`Header ID: ${col.badgeId} (${col.id}) — ${col.label}${
                        hasPowerToggle ? ' (Per-room Raw / Emergency toggle)' : ''
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-0.5 self-start px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 font-mono text-[10px] font-bold">
                          <Hash className="w-2.5 h-2.5" />
                          {col.badgeId}
                        </span>
                        <span className="font-semibold text-[11px] leading-tight text-slate-950 dark:text-white">
                          {col.label}
                        </span>
                        {powerKey && (
                          <div className="inline-flex items-center self-start p-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/90 mt-0.5">
                            <button
                              type="button"
                              onClick={() => handleColumnPowerSourceAll(powerKey, col.label, 'raw')}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                                emgRoomCount === 0
                                  ? 'bg-slate-700 text-white'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                              }`}
                              title={`Set all rooms' ${col.label} to Raw supply`}
                            >
                              All Raw
                            </button>
                            <button
                              type="button"
                              onClick={() => handleColumnPowerSourceAll(powerKey, col.label, 'emergency')}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                                emgRoomCount === rows.length && rows.length > 0
                                  ? 'bg-amber-600 text-white'
                                  : 'text-amber-800 dark:text-amber-300/80 hover:text-amber-950 dark:hover:text-amber-200'
                              }`}
                              title={`Set all rooms' ${col.label} to Emergency supply`}
                            >
                              All Emergency
                            </button>
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {displayedRowEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumnIds.size + 2}
                    className="py-12 px-4 text-center text-slate-600 dark:text-slate-400"
                  >
                    <p className="mb-3">
                      {floorFilter !== 'ALL'
                        ? `No rooms assigned to "${floorFilter}".`
                        : 'No rows in inventory table.'}
                    </p>
                    <button
                      onClick={handleAddRow}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{floorFilter !== 'ALL' ? `Add Room to ${floorFilter}` : 'Add First Row'}</span>
                    </button>
                  </td>
                </tr>
              ) : (
                displayedRowEntries.map(({ row, origIdx }) => {
                  const idx = origIdx;
                  const isSelected = selectedIds.has(row.id);
                  const isDragging = draggedIndex === idx;
                  const isDragOver = dragOverIndex === idx && draggedIndex !== idx;
                  const calc = rowLuxCalcs[idx];
                  const hCalc = rowHvacCalcs[idx];
                  const luxRef = getLuxReferenceById(row.luxCategoryId);
                  const currentFloor = row.floor || 'Ground Floor';

                  return (
                    <tr
                      key={row.id}
                      draggable={floorFilter === 'ALL'}
                      onDragStart={(e) => handleDragStart(idx, e)}
                      onDragOver={(e) => handleDragOver(idx, e)}
                      onDrop={(e) => handleDrop(idx, e)}
                      onDragEnd={handleDragEnd}
                      className={`transition-colors ${
                        isDragging
                          ? 'opacity-40 bg-slate-200 dark:bg-slate-800'
                          : isDragOver
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-inset ring-emerald-500/70'
                          : isSelected
                          ? 'bg-rose-50 dark:bg-rose-950/25 hover:bg-rose-100/70 dark:hover:bg-rose-950/35'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800/80 text-center bg-white dark:bg-slate-900 sticky left-0 z-10">
                        <button
                          type="button"
                          onClick={() => toggleRowSelection(row.id)}
                          className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center justify-center p-1"
                          title={isSelected ? 'Unselect row' : 'Select row for deletion'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Drag Handle + Up/Down Arrows */}
                      <td className="py-1.5 px-1.5 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 sticky left-12 z-10">
                        <div className="flex items-center justify-center gap-0.5">
                          <span
                            className={`p-1 rounded ${
                              floorFilter === 'ALL'
                                ? 'cursor-grab active:cursor-grabbing text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                            }`}
                            title={
                              floorFilter === 'ALL'
                                ? 'Drag up or down to reorder'
                                : 'Show All Floors to reorder rows'
                            }
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moveRow(idx, -1)}
                              disabled={floorFilter !== 'ALL' || idx === 0}
                              className="text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white disabled:opacity-25 p-0.5"
                              title="Move up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveRow(idx, 1)}
                              disabled={floorFilter !== 'ALL' || idx === rows.length - 1}
                              className="text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white disabled:opacity-25 p-0.5"
                              title="Move down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Core / Area Columns (subset of Sl.no., Floor, Room, SQMT, Sqft) */}
                      {visibleCoreCols.map((col) => {
                        if (col.key === 'slNo') {
                          return (
                            <td
                              key={col.id}
                              headers={col.id}
                              className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800/80 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400"
                            >
                              {idx + 1}
                            </td>
                          );
                        }

                        if (col.key === 'floor') {
                          return (
                            <td
                              key={col.id}
                              headers={col.id}
                              className="p-1 border-r border-slate-200 dark:border-slate-800/80"
                            >
                              <select
                                value={currentFloor}
                                onChange={(e) => handleCellChange(row.id, 'floor', e.target.value)}
                                className="w-full bg-white dark:bg-slate-950/90 hover:bg-slate-50 dark:hover:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded px-2 py-1.5 text-xs text-emerald-800 dark:text-emerald-200 focus:outline-none transition-colors"
                              >
                                {!FLOOR_OPTIONS.includes(currentFloor) && (
                                  <option value={currentFloor}>{currentFloor}</option>
                                )}
                                {FLOOR_OPTIONS.map((f) => (
                                  <option key={f} value={f}>
                                    {f}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        }

                        const fieldKey = col.key;
                        return (
                          <td
                            key={col.id}
                            headers={col.id}
                            className="p-1 border-r border-slate-200 dark:border-slate-800/80"
                          >
                            <input
                              type={col.type === 'number' ? 'number' : 'text'}
                              min={col.type === 'number' ? '0' : undefined}
                              step={col.type === 'number' ? 'any' : undefined}
                              value={row[fieldKey] || ''}
                              onChange={(e) => handleCellChange(row.id, fieldKey, e.target.value)}
                              placeholder={col.key === 'room' ? `Room ${idx + 1}` : '0'}
                              className={`w-full bg-white dark:bg-slate-950/70 hover:bg-slate-50 dark:hover:bg-slate-950 focus:bg-white dark:focus:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded px-2 py-1.5 text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none transition-colors ${
                                col.type === 'number' ? 'text-right font-mono' : 'text-left'
                              }`}
                            />
                          </td>
                        );
                      })}

                      {/* H23: Room Lux Category Selector (IS:3646) */}
                      {visibleColumnIds.has('inv_hdr_lux_category') && (
                        <td
                          headers="inv_hdr_lux_category"
                          className="p-1 border-r border-slate-200 dark:border-slate-800/80 bg-amber-50/50 dark:bg-amber-950/10"
                        >
                          <select
                            value={row.luxCategoryId || ''}
                            onChange={(e) => handleLuxCategoryChange(row.id, e.target.value)}
                            className="w-full bg-white dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 focus:border-amber-500 rounded px-2 py-1.5 text-xs text-slate-950 dark:text-slate-100 focus:outline-none"
                          >
                            <option value="">-- Select IS:3646 Room Type --</option>
                            {LUX_BUILDING_GROUPS.map((group) => (
                              <optgroup key={group} label={group}>
                                {IS_3646_LUX_REFERENCES.filter((r) => r.buildingGroup === group).map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.slNo} {r.label} ({r.luxDisplay} lx)
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* H24: Target Lux (editable, defaults from IS:3646) */}
                      {visibleColumnIds.has('inv_hdr_target_lux') && (
                        <td
                          headers="inv_hdr_target_lux"
                          className="p-1 border-r border-slate-200 dark:border-slate-800/80 bg-amber-50/50 dark:bg-amber-950/10"
                        >
                          <div className="flex flex-col gap-0.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.targetLux ?? (luxRef ? String(luxRef.recommendedLux) : '')}
                              onChange={(e) => handleCellChange(row.id, 'targetLux', e.target.value)}
                              placeholder="Lux"
                              className="w-full bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 focus:border-amber-500 rounded px-2 py-1 text-xs text-right font-mono text-amber-800 dark:text-amber-300 focus:outline-none"
                            />
                            {luxRef && (
                              <span className="text-[9px] text-slate-600 dark:text-slate-400 text-right font-mono px-0.5">
                                IS: {luxRef.luxDisplay}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* H25: Calculated Required Lumens based on Area */}
                      {visibleColumnIds.has('inv_hdr_req_lumens') && (
                        <td
                          headers="inv_hdr_req_lumens"
                          className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800/80 bg-amber-50/50 dark:bg-amber-950/10 text-right font-mono"
                          title={
                            calc.areaSqm > 0 && calc.targetLux > 0
                              ? `Effective Area: ${calc.areaSqm.toFixed(2)} m² | Raw (Lux×Area): ${Math.round(calc.rawLuxAreaLumens).toLocaleString()} lm | Design (÷ UF×MF): ${Math.round(calc.requiredDesignLumens).toLocaleString()} lm`
                              : 'Enter Area (SQMT or Sqft) and Lux Category'
                          }
                        >
                          {calc.areaSqm > 0 && calc.targetLux > 0 ? (
                            <div>
                              <div className="font-bold text-amber-800 dark:text-amber-300 text-xs">
                                {Math.round(calc.requiredDesignLumens).toLocaleString()} lm
                              </div>
                              <div className="text-[9px] text-slate-600 dark:text-slate-400">
                                {calc.areaSqm.toFixed(1)} m² · raw {Math.round(calc.rawLuxAreaLumens).toLocaleString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">–</span>
                          )}
                        </td>
                      )}

                      {/* H26: Installed Lumens & Achieved Lux */}
                      {visibleColumnIds.has('inv_hdr_installed_lux') && (
                        <td
                          headers="inv_hdr_installed_lux"
                          className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800/80 bg-amber-50/50 dark:bg-amber-950/10 text-right font-mono"
                        >
                          {calc.installedLumens > 0 ? (
                            <div>
                              <div className="font-semibold text-cyan-700 dark:text-cyan-300 text-xs">
                                {calc.areaSqm > 0 ? `${Math.round(calc.achievedLux)} lx` : `${Math.round(calc.installedLumens).toLocaleString()} lm`}
                              </div>
                              <div className="text-[9px] text-slate-600 dark:text-slate-400">
                                {Math.round(calc.installedLumens).toLocaleString()} lm
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">0 lm</span>
                          )}
                        </td>
                      )}

                      {/* H27: Lux Gap / Status */}
                      {visibleColumnIds.has('inv_hdr_lux_status') && (
                        <td
                          headers="inv_hdr_lux_status"
                          className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800/80 bg-amber-50/50 dark:bg-amber-950/10 text-xs"
                        >
                          {calc.areaSqm <= 0 || calc.targetLux <= 0 ? (
                            <span className="text-[10px] text-slate-500 italic">
                              {calc.areaSqm <= 0 ? 'Enter area' : 'Select lux'}
                            </span>
                          ) : calc.luxGap >= 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>OK (+{Math.round(calc.luxGap)} lx)</span>
                            </span>
                          ) : (
                            <div className="text-[11px] text-rose-700 dark:text-rose-300 font-medium leading-tight">
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                {Math.round(calc.luxGap)} lx
                              </span>
                              <span className="block text-[9px] text-slate-600 dark:text-slate-400 font-mono">
                                Need +{Math.round(calc.lumenGap).toLocaleString()} lm
                              </span>
                            </div>
                          )}
                        </td>
                      )}

                      {/* H28: AC Required Yes / No Selector */}
                      {visibleColumnIds.has('inv_hdr_ac_required') && (
                        <td
                          headers="inv_hdr_ac_required"
                          className="p-1.5 border-r border-slate-200 dark:border-slate-800/80 bg-cyan-50/50 dark:bg-cyan-950/10 text-center"
                        >
                          <div className="inline-flex items-center p-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => handlePatchRow(row.id, { acRequired: 'yes' })}
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                                hCalc.acEnabled
                                  ? 'bg-cyan-600 text-white'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePatchRow(row.id, { acRequired: 'no' })}
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                                !hCalc.acEnabled
                                  ? 'bg-slate-700 text-white'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              No
                            </button>
                          </div>
                        </td>
                      )}

                      {/* H29: Room CFM & Toilet Ventilation Mode */}
                      {visibleColumnIds.has('inv_hdr_cfm_vent') && (
                        <td
                          headers="inv_hdr_cfm_vent"
                          className="p-1.5 border-r border-slate-200 dark:border-slate-800/80 bg-cyan-50/50 dark:bg-cyan-950/10"
                        >
                          <div className="space-y-1">
                            <select
                              value={hCalc.effectiveVentType}
                              onChange={(e) => {
                                const nextVent = e.target.value as VentilationRoomType;
                                handlePatchRow(row.id, {
                                  ventType: nextVent,
                                  acRequired: nextVent === 'toilet' ? 'no' : row.acRequired,
                                });
                              }}
                              className="w-full bg-white dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 focus:border-cyan-600 dark:focus:border-cyan-500 rounded px-1.5 py-1 text-[11px] text-slate-900 dark:text-slate-100 focus:outline-none"
                            >
                              <option value="general">General ({hvacSettings.generalAch} ACH)</option>
                              <option value="toilet">Toilet Vent ({hvacSettings.toiletAch} ACH)</option>
                              <option value="kitchen_lab">Kitchen / Lab ({hvacSettings.kitchenLabAch} ACH)</option>
                            </select>
                            <div className="flex items-center justify-between text-[10px] font-mono tabular-nums px-0.5">
                              <span className="text-sky-700 dark:text-sky-300 font-semibold">
                                {hCalc.areaSqm > 0 ? `${Math.round(hCalc.requiredCfm)} CFM` : '– CFM'}
                              </span>
                              <span className="text-slate-600 dark:text-slate-400 truncate max-w-[95px]" title={hCalc.ventSummary}>
                                {hCalc.effectiveVentType === 'toilet'
                                  ? `Exh: ${hCalc.recH13 > 0 ? `${hCalc.recH13}×225` : `${hCalc.recH14}×300`}`
                                  : hCalc.ventSummary}
                              </span>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* H30: Calculated Cooling Load (TR / BTU) */}
                      {visibleColumnIds.has('inv_hdr_cooling_load') && (
                        <td
                          headers="inv_hdr_cooling_load"
                          className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800/80 bg-cyan-50/50 dark:bg-cyan-950/10 text-right font-mono tabular-nums"
                        >
                          {!hCalc.acEnabled ? (
                            <span className="text-[11px] text-slate-500">No AC</span>
                          ) : hCalc.areaSqm > 0 ? (
                            <div>
                              <div className="font-bold text-cyan-800 dark:text-cyan-300 text-xs">
                                {hCalc.calculatedTr.toFixed(2)} TR
                              </div>
                              <div className="text-[9px] text-slate-600 dark:text-slate-400">
                                {Math.round(hCalc.totalBtuHr).toLocaleString()} BTU/h · {hCalc.acSizingLabel}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">Enter area</span>
                          )}
                        </td>
                      )}

                      {/* Remaining Columns (subset of H05 - H22; #H17-#H21 include Raw / Emergency toggle) */}
                      {visibleRemainingCols.map((col) => {
                        const fieldKey = col.key as Exclude<InventoryColumn['key'], 'slNo'>;
                        const hasPowerToggle = isRawEmergencyKey(fieldKey);
                        const powerMode: PowerSourceType = hasPowerToggle
                          ? getRowPowerSource(row, fieldKey as RawEmergencyColumnKey)
                          : fieldKey === 'tonnage'
                          ? getRowPowerSource(row, 'noOfAc')
                          : 'raw';
                        const isEmergency = hasPowerToggle && powerMode === 'emergency';

                        return (
                          <td
                            key={col.id}
                            headers={col.id}
                            className={`p-1 border-r border-slate-200 dark:border-slate-800/80 align-top ${
                              isEmergency ? 'bg-amber-50/70 dark:bg-amber-950/15' : ''
                            }`}
                          >
                            <div className="flex flex-col gap-1">
                              <input
                                type={col.type === 'number' ? 'number' : 'text'}
                                min={col.type === 'number' ? '0' : undefined}
                                step={col.type === 'number' ? 'any' : undefined}
                                value={row[fieldKey] || ''}
                                onChange={(e) => handleCellChange(row.id, fieldKey, e.target.value)}
                                placeholder="0"
                                className={`w-full bg-white dark:bg-slate-950/70 hover:bg-slate-50 dark:hover:bg-slate-950 focus:bg-white dark:focus:bg-slate-950 border rounded px-2 py-1.5 text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none transition-colors text-right font-mono tabular-nums ${
                                  isEmergency
                                    ? 'border-amber-400 dark:border-amber-500/50 focus:border-amber-600 dark:focus:border-amber-400 text-amber-800 dark:text-amber-200'
                                    : 'border-slate-300 dark:border-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-900 dark:text-white'
                                }`}
                              />
                              {hasPowerToggle && (
                                <div
                                  className="flex items-center p-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 gap-0.5"
                                  role="group"
                                  aria-label={`${col.label} power supply mode for ${row.room || `Room ${idx + 1}`}`}
                                >
                                  <button
                                    type="button"
                                    aria-pressed={!isEmergency}
                                    onClick={() =>
                                      handlePowerSourceChange(
                                        row.id,
                                        fieldKey as RawEmergencyColumnKey,
                                        'raw'
                                      )
                                    }
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors shrink-0 ${
                                      !isEmergency
                                        ? 'bg-slate-700 text-white'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                    title="Raw Power Supply"
                                  >
                                    Raw
                                  </button>
                                  <button
                                    type="button"
                                    aria-pressed={isEmergency}
                                    onClick={() =>
                                      handlePowerSourceChange(
                                        row.id,
                                        fieldKey as RawEmergencyColumnKey,
                                        'emergency'
                                      )
                                    }
                                    className={`flex-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors whitespace-nowrap ${
                                      isEmergency
                                        ? 'bg-amber-600 text-white'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300'
                                    }`}
                                    title="Emergency / UPS / DG Supply"
                                  >
                                    Emergency
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Totals Footer */}
            {rows.length > 0 && (
              <tfoot className="bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-300 dark:border-slate-700 sticky bottom-0 z-20">
                <tr>
                  <td className="py-2.5 px-2 border-r border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 sticky left-0 z-30" />
                  <td className="py-2.5 px-2 border-r border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 sticky left-12 z-30" />

                  {/* Totals for visible core columns */}
                  {visibleCoreCols.map((col) => {
                    if (col.key === 'slNo') {
                      return (
                        <td
                          key={col.id}
                          className="py-2.5 px-2 border-r border-slate-300 dark:border-slate-800 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400"
                        >
                          Σ
                        </td>
                      );
                    }
                    if (col.key === 'floor') {
                      return (
                        <td
                          key={col.id}
                          className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                        >
                          {presentFloors.length} {presentFloors.length === 1 ? 'floor' : 'floors'}
                        </td>
                      );
                    }
                    if (col.key === 'room') {
                      return (
                        <td
                          key={col.id}
                          className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
                        >
                          Total ({rows.length} {rows.length === 1 ? 'room' : 'rooms'})
                        </td>
                      );
                    }
                    const total = columnTotals[col.key] || 0;
                    return (
                      <td
                        key={col.id}
                        className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 text-xs"
                      >
                        {Number.isInteger(total) ? total : total.toFixed(2)}
                      </td>
                    );
                  })}

                  {/* Lux Totals Columns (subset of H23 - H27) */}
                  {visibleColumnIds.has('inv_hdr_lux_category') && (
                    <td className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-[10px] text-amber-800 dark:text-amber-300/90 font-mono bg-amber-50 dark:bg-amber-950/20">
                      UF {luxSettings.utilizationFactor} · MF {luxSettings.maintenanceFactor}
                    </td>
                  )}
                  {visibleColumnIds.has('inv_hdr_target_lux') && (
                    <td className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right text-[10px] text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/20">
                      –
                    </td>
                  )}
                  {visibleColumnIds.has('inv_hdr_req_lumens') && (
                    <td className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right font-mono font-bold text-amber-800 dark:text-amber-300 text-xs bg-amber-50 dark:bg-amber-950/20">
                      {Math.round(luxTotals.totalRequiredDesignLumens).toLocaleString()} lm
                    </td>
                  )}
                  {visibleColumnIds.has('inv_hdr_installed_lux') && (
                    <td className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right font-mono font-bold text-cyan-800 dark:text-cyan-300 text-xs bg-amber-50 dark:bg-amber-950/20">
                      {Math.round(luxTotals.totalInstalledLumens).toLocaleString()} lm
                    </td>
                  )}
                  {visibleColumnIds.has('inv_hdr_lux_status') && (
                    <td className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-xs font-mono font-semibold bg-amber-50 dark:bg-amber-950/20">
                      {luxTotals.totalRequiredDesignLumens > 0 ? (
                        luxTotals.totalInstalledLumens >= luxTotals.totalRequiredDesignLumens ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            +{Math.round(luxTotals.totalInstalledLumens - luxTotals.totalRequiredDesignLumens).toLocaleString()} lm
                          </span>
                        ) : (
                          <span className="text-rose-700 dark:text-rose-300">
                            {Math.round(luxTotals.totalInstalledLumens - luxTotals.totalRequiredDesignLumens).toLocaleString()} lm
                          </span>
                        )
                      ) : (
                        <span className="text-slate-500">–</span>
                      )}
                    </td>
                  )}

                  {/* HVAC Totals Columns (subset of H28 - H30) */}
                  {visibleColumnIds.has('inv_hdr_ac_required') && (
                    <td className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-center text-[11px] font-mono font-semibold text-cyan-800 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/20">
                      {rowHvacCalcs.filter((c) => c.acEnabled).length}/{rows.length} AC
                    </td>
                  )}
                  {visibleColumnIds.has('inv_hdr_cfm_vent') && (
                    <td className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right font-mono font-bold text-sky-800 dark:text-sky-300 text-xs bg-cyan-50 dark:bg-cyan-950/20">
                      {Math.round(rowHvacCalcs.reduce((s, c) => s + c.requiredCfm, 0)).toLocaleString()} CFM
                    </td>
                  )}
                  {visibleColumnIds.has('inv_hdr_cooling_load') && (
                    <td className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right font-mono font-bold text-cyan-800 dark:text-cyan-300 text-xs bg-cyan-50 dark:bg-cyan-950/20">
                      {rowHvacCalcs.reduce((s, c) => s + c.calculatedTr, 0).toFixed(2)} TR
                    </td>
                  )}

                  {/* Totals for visible remaining columns (subset of H05 - H22) */}
                  {visibleRemainingCols.map((col) => {
                    const total = columnTotals[col.key] || 0;
                    const split = isRawEmergencyKey(col.key)
                      ? rawEmergencyTotals[col.key]
                      : col.key === 'tonnage'
                      ? tonnageSplit
                      : null;
                    const isTonnageCol = col.key === 'tonnage';
                    const fmt = (n: number) =>
                      isTonnageCol
                        ? `${Number(n.toFixed(2))} TR`
                        : Number.isInteger(n)
                        ? n
                        : Number(n.toFixed(2));
                    return (
                      <td
                        key={col.id}
                        className="py-2 px-2 border-r border-slate-300 dark:border-slate-800 text-right font-mono tabular-nums align-top"
                      >
                        <div className="font-bold text-emerald-700 dark:text-emerald-300 text-xs">{fmt(total)}</div>
                        {split && (
                          <div className="mt-0.5 space-y-0.5 text-[10px] leading-tight font-medium">
                            <div className="text-slate-700 dark:text-slate-300">Raw: {fmt(split.raw)}</div>
                            <div className={split.emergency > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}>
                              Emg: {fmt(split.emergency)}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Room-wise Lux Requirement Breakdown Cards */}
      {rows.some((_, i) => rowLuxCalcs[i].areaSqm > 0 && rowLuxCalcs[i].targetLux > 0) && (
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Room-Wise Illumination &amp; Lux Requirement Summary (IS:3646)</span>
            </h3>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              Design Formula: Lumens = (Lux × Area m²) ÷ (UF {luxSettings.utilizationFactor} × MF {luxSettings.maintenanceFactor})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((row, idx) => {
              const calc = rowLuxCalcs[idx];
              if (calc.areaSqm <= 0 || calc.targetLux <= 0) return null;
              const isCompliant = calc.luxGap >= 0;
              // Suggest additional 20W tubes (default) or 36W panels if deficit exists
              const needed20wTubes = calc.lumenGap > 0 && luxSettings.lumenPer20wTube > 0
                ? Math.ceil(calc.lumenGap / luxSettings.lumenPer20wTube)
                : 0;
              const needed36wPanels = calc.lumenGap > 0 && luxSettings.lumenPer36wSurface > 0
                ? Math.ceil(calc.lumenGap / luxSettings.lumenPer36wSurface)
                : 0;

              return (
                <div
                  key={row.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    isCompliant
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-amber-50/50 dark:bg-slate-950/80 border-amber-300 dark:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">Sl.no. {idx + 1}</span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {row.room || `Room ${idx + 1}`}
                      </h4>
                      <span className="text-[11px] text-amber-800 dark:text-amber-300/90 block">
                        {calc.luxRefLabel}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isCompliant
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                      }`}
                    >
                      {isCompliant ? 'Lux Met' : 'Additional Light Req.'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80 text-[11px]">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400 block">Effective Area</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{calc.areaSqm.toFixed(2)} m²</span>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400 block">Target / Achieved Lux</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {calc.targetLux} / <span className={isCompliant ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}>{Math.round(calc.achievedLux)} lx</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400 block">Required Lumens</span>
                      <span className="font-mono font-bold text-amber-800 dark:text-amber-300">{Math.round(calc.requiredDesignLumens).toLocaleString()} lm</span>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400 block">Installed Lumens</span>
                      <span className="font-mono font-semibold text-cyan-800 dark:text-cyan-300">{Math.round(calc.installedLumens).toLocaleString()} lm</span>
                    </div>
                  </div>

                  {!isCompliant && calc.lumenGap > 0 && (
                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-700 dark:text-slate-300">
                      <span className="text-amber-800 dark:text-amber-300 font-semibold">Deficit: {Math.round(calc.lumenGap).toLocaleString()} lm</span>
                      <span className="text-slate-600 dark:text-slate-400 block">
                        Suggested: +{needed20wTubes} nos. 20W Tube OR +{needed36wPanels} nos. 36W Light
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dedicated Cooling Load Chart, CFM & Toilet Ventilation Section */}
      <CoolingLoadChartSection
        rows={rows}
        rowHvacCalcs={rowHvacCalcs}
        hvacSettings={hvacSettings}
        onUpdateHvacSettings={handleUpdateHvacSettings}
        autoSyncEnabled={autoSyncHvac}
        onToggleAutoSync={setAutoSyncHvac}
        onUpdateRowField={handlePatchRow}
        onSyncAllToInventory={handleSyncAllHvacToInventory}
        onSyncSingleRowToInventory={handleSyncSingleHvacRow}
      />

      {/* IS:3646 Lux Reference Chart Modal */}
      <LuxReferenceModal
        isOpen={isLuxRefModalOpen}
        onClose={() => setIsLuxRefModalOpen(false)}
      />
    </div>
  );
};
