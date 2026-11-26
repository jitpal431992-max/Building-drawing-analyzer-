import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Range as XlsxRange } from 'xlsx';
import { 
  Calculator, 
  Trash2, 
  Printer, 
  Download, 
  Plus, 
  ArrowLeft, 
  FileSpreadsheet,
  CornerDownRight,
  AlertTriangle,
  X,
  Search,
  GripVertical
} from 'lucide-react';
import { BOQItem, DSRMasterItem, DSRVariantItem, InventoryRow, RawEmergencyColumnKey } from '../types';
import { formatINR, numberToIndianWords } from '../utils/formatters';
import {
  BoqDirectSearchEntry,
  buildBoqSearchIndex,
  groupBoqItems,
  reorderBoqGroups,
  reorderBoqSubItemWithinGroup,
} from '../utils/boqHelpers';
import {
  BuildingLoadSettings,
  DEFAULT_BUILDING_LOAD_SETTINGS,
  FLOOR_OPTIONS,
  RoomLoadCalc,
  computeRoomBuildingLoad,
} from '../data/wattageTable';
import {
  DEFAULT_HVAC_SETTINGS,
  HvacDesignSettings,
  RowHvacCalc,
  computeRowHvac,
} from '../data/hvacStandards';

const STORAGE_KEY_BUILDING_LOAD_SETTINGS = 'dsr_building_load_settings_v1';
const STORAGE_KEY_HVAC_SETTINGS = 'dsr_inventory_hvac_settings_v1';

interface ExportInventoryCol {
  key: keyof Omit<
    InventoryRow,
    | 'id'
    | 'floor'
    | 'luxCategoryId'
    | 'targetLux'
    | 'luxAutoSynced'
    | 'acRequired'
    | 'ventType'
    | 'ceilingHeightFt'
    | 'occupants'
    | 'exposureType'
    | 'powerSources'
  >;
  label: string;
  isNumeric: boolean;
  decimals?: number;
  width: number;
}

// Human-readable Inventory columns strictly WITHOUT any Column IDs
const EXPORT_INVENTORY_COLS: ExportInventoryCol[] = [
  { key: 'room', label: 'Room', isNumeric: false, width: 24 },
  { key: 'sqmt', label: 'SQMT', isNumeric: true, decimals: 2, width: 10 },
  { key: 'sqft', label: 'Sqft', isNumeric: true, decimals: 1, width: 10 },
  { key: 'tube20w', label: '20W Tube', isNumeric: true, decimals: 0, width: 11 },
  { key: 'tube40w', label: '40W Tube', isNumeric: true, decimals: 0, width: 11 },
  { key: 'surfaceLight36w', label: '36W Surface Light', isNumeric: true, decimals: 0, width: 16 },
  { key: 'recessLight20w', label: '20W Recess Light', isNumeric: true, decimals: 0, width: 16 },
  { key: 'recessLight36w', label: '36W Recess Light', isNumeric: true, decimals: 0, width: 16 },
  { key: 'ceilingFan1200', label: '1200 mm Ceiling Fan', isNumeric: true, decimals: 0, width: 18 },
  { key: 'ceilingFan1400', label: '1400 mm Ceiling Fan', isNumeric: true, decimals: 0, width: 18 },
  { key: 'wallFan400', label: '400 mm Wall Fan', isNumeric: true, decimals: 0, width: 15 },
  { key: 'exhaustFan225', label: '225 mm Exhaust Fan', isNumeric: true, decimals: 0, width: 17 },
  { key: 'exhaustFan300', label: '300 mm Exhaust Fan', isNumeric: true, decimals: 0, width: 17 },
  { key: 'bulbPoint20w', label: '20W Bulb Point', isNumeric: true, decimals: 0, width: 14 },
  { key: 'socket5aOnBoard', label: '5A on Board', isNumeric: true, decimals: 0, width: 12 },
  { key: 'socket2x5a', label: '2x5A Socket', isNumeric: true, decimals: 0, width: 12 },
  { key: 'socket20a', label: '20A Socket', isNumeric: true, decimals: 0, width: 12 },
  { key: 'computerBoard', label: 'Computer Board', isNumeric: true, decimals: 0, width: 15 },
  { key: 'socket3x20a', label: '3x20A Socket', isNumeric: true, decimals: 0, width: 13 },
  { key: 'noOfAc', label: 'No. of AC', isNumeric: true, decimals: 0, width: 11 },
  { key: 'tonnage', label: 'Tonnage (TR)', isNumeric: true, decimals: 2, width: 13 },
];

const POWER_SPLIT_KEYS = new Set<string>([
  'socket2x5a',
  'socket20a',
  'computerBoard',
  'socket3x20a',
  'noOfAc',
]);

function nNum(v?: string): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return isNaN(n) || n < 0 ? 0 : n;
}

function roundNum(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function getOrderedFloors(rows: InventoryRow[]): string[] {
  const present = new Set<string>(rows.map((r) => r.floor || 'Ground Floor'));
  const ordered: string[] = [];
  for (const f of FLOOR_OPTIONS) {
    if (present.has(f)) {
      ordered.push(f);
      present.delete(f);
    }
  }
  for (const extra of present) {
    ordered.push(extra);
  }
  return ordered;
}

function loadBuildingSettings(): BuildingLoadSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_BUILDING_LOAD_SETTINGS);
    if (saved) {
      return { ...DEFAULT_BUILDING_LOAD_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // fallback to defaults
  }
  return DEFAULT_BUILDING_LOAD_SETTINGS;
}

function loadHvacSettings(): HvacDesignSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_HVAC_SETTINGS);
    if (saved) {
      return { ...DEFAULT_HVAC_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // fallback to defaults
  }
  return DEFAULT_HVAC_SETTINGS;
}

interface EstimateBuilderProps {
  estimateItems: BOQItem[];
  inventoryRows?: InventoryRow[];
  catalogItems?: DSRMasterItem[];
  onAddCatalogItem?: (item: DSRMasterItem, variant?: DSRVariantItem, quantity?: number) => void;
  onAddAllVariants?: (item: DSRMasterItem) => void;
  onReorderEstimateItems?: (nextItems: BOQItem[]) => void;
  onUpdateQuantity: (itemId: string, qty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onRemoveGroup?: (parentCode: string) => void;
  onClearEstimate: () => void;
  onBackToCatalog: () => void;
}

type BoqDragState =
  | { kind: 'group'; parentCode: string }
  | { kind: 'sub'; parentCode: string; itemId: string };

export const EstimateBuilder: React.FC<EstimateBuilderProps> = ({
  estimateItems,
  inventoryRows = [],
  catalogItems = [],
  onAddCatalogItem,
  onAddAllVariants,
  onReorderEstimateItems,
  onUpdateQuantity,
  onRemoveItem,
  onRemoveGroup,
  onClearEstimate,
  onBackToCatalog,
}) => {
  const [projectName, setProjectName] = useState('Electrical & Mechanical Installation Project');
  const [department, setDepartment] = useState('Central Public Works Department (CPWD)');
  const [location, setLocation] = useState('New Delhi');
  const [contingencyPercent, setContingencyPercent] = useState<number>(3);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // Direct DSR Search Dropdown state
  const [dsrQuery, setDsrQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [quickQtys, setQuickQtys] = useState<Record<string, number>>({});
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Serial Drag-and-Drop Reorder state
  const [dragState, setDragState] = useState<BoqDragState | null>(null);
  const [dropTarget, setDropTarget] = useState<BoqDragState | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const searchIndex = useMemo(
    () => buildBoqSearchIndex(catalogItems),
    [catalogItems]
  );

  const searchResults: BoqDirectSearchEntry[] = useMemo(() => {
    const q = dsrQuery.trim().toLowerCase();
    if (!q) {
      return searchIndex.slice(0, 25);
    }
    const words = q.split(/\s+/).filter(Boolean);
    const out: BoqDirectSearchEntry[] = [];
    for (const entry of searchIndex) {
      let ok = true;
      for (const w of words) {
        if (!entry.searchBlob.includes(w)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        out.push(entry);
        if (out.length >= 35) break;
      }
    }
    return out;
  }, [searchIndex, dsrQuery]);

  // Group items under their Main Parent DSR Item
  const groupedBOQ = useMemo(() => groupBoqItems(estimateItems), [estimateItems]);

  // Total of DSR items
  const totalBeforeContingency = estimateItems.reduce((acc, curr) => acc + (curr.lineTotal || 0), 0);

  // Contingency (added in percentage after Total)
  const contingencyAmount = (totalBeforeContingency * contingencyPercent) / 100;
  const grandTotal = totalBeforeContingency + contingencyAmount;

  const handlePrint = () => {
    window.print();
  };

  // Download formatted Excel (.xlsx) workbook using SheetJS (dynamically imported)
  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const dateStr = new Date().toLocaleDateString('en-IN');
    const sheetData: (string | number)[][] = [
      ['GOVERNMENT OF INDIA - CENTRAL PUBLIC WORKS DEPARTMENT'],
      ['BILL OF QUANTITIES (BOQ) / DETAILED ESTIMATE'],
      ['Based on Delhi Schedule of Rates (E&M) 2025'],
      [],
      ['Name of Work:', projectName, '', '', 'Date:', dateStr],
      ['Department / Authority:', department, '', '', 'Location:', location],
      [],
      [
        'S.No',
        'DSR Item No.',
        'Description of Items & Specification',
        'Unit',
        'Rate (₹)',
        'Quantity',
        'Amount (₹)',
      ],
    ];

    const currencyRowIndices: number[] = [];
    const boldRowIndices: number[] = [0, 1, 7];

    let sNo = 1;
    for (const group of groupedBOQ) {
      const hasSubItems = !group.isStandalone || group.subItems.some(i => i.isSubItem || i.subItemName);

      if (!hasSubItems && group.subItems.length === 1) {
        const item = group.subItems[0];
        const rowIdx = sheetData.length;
        sheetData.push([
          sNo++,
          group.parentCode,
          group.parentDescription,
          item.unit || 'Each',
          Number(item.rate.toFixed(2)),
          item.quantity,
          Number(item.lineTotal.toFixed(2)),
        ]);
        currencyRowIndices.push(rowIdx);
      } else {
        // Main Item Header Row (no rate/amount so column sums cleanly without double-counting)
        const mainHeaderIdx = sheetData.length;
        sheetData.push([
          sNo,
          group.parentCode,
          `${group.parentDescription}${group.category ? ` [${group.category}]` : ''}`,
          '',
          '',
          '',
          '',
        ]);
        boldRowIndices.push(mainHeaderIdx);

        // Sub-Items listed under Main Item
        for (let subIdx = 0; subIdx < group.subItems.length; subIdx++) {
          const sub = group.subItems[subIdx];
          const subRowIdx = sheetData.length;
          const rawSubDesc = sub.subItemName || sub.description || '';
          const cleanSubDesc = rawSubDesc
            .replace(/^↳\s*Sub-item:\s*/i, '')
            .replace(/\s*—\s*Sub-item:\s*/gi, ' — ');
          sheetData.push([
            `${sNo}.${subIdx + 1}`,
            sub.itemCode,
            cleanSubDesc,
            sub.unit || 'Each',
            Number(sub.rate.toFixed(2)),
            sub.quantity,
            Number(sub.lineTotal.toFixed(2)),
          ]);
          currencyRowIndices.push(subRowIdx);
        }

        sNo++;
      }
    }

    // Blank spacer row before summary
    sheetData.push([]);

    const addSummaryRow = (label: string, amount: number, isBold = false) => {
      const idx = sheetData.length;
      sheetData.push(['', '', label, '', '', '', Number(amount.toFixed(2))]);
      currencyRowIndices.push(idx);
      if (isBold) boldRowIndices.push(idx);
    };

    addSummaryRow('Total', totalBeforeContingency, true);
    addSummaryRow(`Contingency (${contingencyPercent}%)`, contingencyAmount);
    addSummaryRow('Grand Total (Including Contingency)', grandTotal, true);

    sheetData.push([]);
    sheetData.push(['', '', `Total Estimated Amount in Words: ${numberToIndianWords(Math.round(grandTotal))}`, '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Format numeric rate & amount cells with Indian-friendly 2-decimal number format
    for (const rIdx of currencyRowIndices) {
      const rateRef = XLSX.utils.encode_cell({ r: rIdx, c: 4 });
      const amtRef = XLSX.utils.encode_cell({ r: rIdx, c: 6 });
      if (ws[rateRef] && typeof ws[rateRef].v === 'number') {
        ws[rateRef].z = '#,##0.00';
      }
      if (ws[amtRef] && typeof ws[amtRef].v === 'number') {
        ws[amtRef].z = '#,##0.00';
      }
    }

    // Set column widths for clean readability
    ws['!cols'] = [
      { wch: 8 },   // S.No
      { wch: 15 },  // DSR Item No.
      { wch: 75 },  // Description of Items & Specification
      { wch: 12 },  // Unit
      { wch: 15 },  // Rate
      { wch: 12 },  // Quantity
      { wch: 18 },  // Amount
    ];

    // Merge title rows across columns A-G
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOQ Estimate');

    // =========================================================================
    // SHEET 2: FLOOR-WISE INVENTORY (Strictly NO Column IDs)
    // =========================================================================
    const orderedFloors = getOrderedFloors(inventoryRows);
    const invTotalCols = 1 + EXPORT_INVENTORY_COLS.length; // Sl.no. + Inventory columns
    const invMerges: XlsxRange[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: invTotalCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: invTotalCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: invTotalCols - 1 } },
    ];

    const totalBuildingSqm = inventoryRows.reduce((s, r) => {
      const sqm = nNum(r.sqmt);
      const sft = nNum(r.sqft);
      return s + (sqm > 0 ? sqm : sft > 0 ? sft / 10.7639104 : 0);
    }, 0);

    const invSheetData: (string | number)[][] = [
      ['FLOOR-WISE ELECTRICAL & HVAC INVENTORY SCHEDULE'],
      [`Name of Work: ${projectName}  |  Department: ${department}`],
      [
        `Location: ${location}  |  Date: ${dateStr}  |  Floors: ${orderedFloors.length}  |  Total Rooms: ${inventoryRows.length}  |  Total Area: ${roundNum(totalBuildingSqm, 2)} m²`,
      ],
      [],
    ];

    if (inventoryRows.length === 0) {
      invSheetData.push(['No rooms available in inventory. Add rooms on the Inventory page to populate this schedule.']);
    } else {
      const grandTotals: Record<string, number> = {};
      const grandSplit: Record<string, { raw: number; emergency: number }> = {
        socket2x5a: { raw: 0, emergency: 0 },
        socket20a: { raw: 0, emergency: 0 },
        computerBoard: { raw: 0, emergency: 0 },
        socket3x20a: { raw: 0, emergency: 0 },
        noOfAc: { raw: 0, emergency: 0 },
        tonnage: { raw: 0, emergency: 0 },
      };

      for (const floorName of orderedFloors) {
        const floorRows = inventoryRows.filter((r) => (r.floor || 'Ground Floor') === floorName);
        if (floorRows.length === 0) continue;

        const floorSqm = floorRows.reduce((s, r) => {
          const sqm = nNum(r.sqmt);
          const sft = nNum(r.sqft);
          return s + (sqm > 0 ? sqm : sft > 0 ? sft / 10.7639104 : 0);
        }, 0);
        const floorSqft = floorRows.reduce((s, r) => {
          const sqm = nNum(r.sqmt);
          const sft = nNum(r.sqft);
          return s + (sft > 0 ? sft : sqm > 0 ? sqm * 10.7639104 : 0);
        }, 0);

        const bannerIdx = invSheetData.length;
        invSheetData.push([
          `FLOOR: ${floorName} — ${floorRows.length} ${floorRows.length === 1 ? 'Room' : 'Rooms'} | Area: ${roundNum(floorSqm, 2)} m² (${roundNum(floorSqft, 1)} sq.ft)`,
        ]);
        invMerges.push({ s: { r: bannerIdx, c: 0 }, e: { r: bannerIdx, c: invTotalCols - 1 } });

        // Clean human-readable column headers (no Column IDs)
        invSheetData.push(['Sl.no.', ...EXPORT_INVENTORY_COLS.map((c) => c.label)]);

        const floorTotals: Record<string, number> = {};
        const floorSplit: Record<string, { raw: number; emergency: number }> = {
          socket2x5a: { raw: 0, emergency: 0 },
          socket20a: { raw: 0, emergency: 0 },
          computerBoard: { raw: 0, emergency: 0 },
          socket3x20a: { raw: 0, emergency: 0 },
          noOfAc: { raw: 0, emergency: 0 },
          tonnage: { raw: 0, emergency: 0 },
        };

        floorRows.forEach((row, idx) => {
          const sqmRaw = nNum(row.sqmt);
          const sftRaw = nNum(row.sqft);
          const effSqm = sqmRaw > 0 ? sqmRaw : sftRaw > 0 ? sftRaw / 10.7639104 : 0;
          const effSqft = sftRaw > 0 ? sftRaw : sqmRaw > 0 ? sqmRaw * 10.7639104 : 0;

          const cells: (string | number)[] = [idx + 1];
          for (const col of EXPORT_INVENTORY_COLS) {
            if (!col.isNumeric) {
              cells.push(row[col.key] || 'Unnamed Room');
            } else {
              let numVal = nNum(row[col.key]);
              if (col.key === 'sqmt') numVal = effSqm;
              if (col.key === 'sqft') numVal = effSqft;
              const rounded = roundNum(numVal, col.decimals ?? 0);
              cells.push(rounded);

              floorTotals[col.key] = (floorTotals[col.key] || 0) + numVal;
              grandTotals[col.key] = (grandTotals[col.key] || 0) + numVal;

              if (POWER_SPLIT_KEYS.has(col.key)) {
                const isEmg = row.powerSources?.[col.key as RawEmergencyColumnKey] === 'emergency';
                if (isEmg) {
                  floorSplit[col.key].emergency += numVal;
                  grandSplit[col.key].emergency += numVal;
                } else {
                  floorSplit[col.key].raw += numVal;
                  grandSplit[col.key].raw += numVal;
                }
              } else if (col.key === 'tonnage') {
                const isAcEmg = row.powerSources?.noOfAc === 'emergency';
                if (isAcEmg) {
                  floorSplit.tonnage.emergency += numVal;
                  grandSplit.tonnage.emergency += numVal;
                } else {
                  floorSplit.tonnage.raw += numVal;
                  grandSplit.tonnage.raw += numVal;
                }
              }
            }
          }
          invSheetData.push(cells);
        });

        // Floor Total Row
        invSheetData.push([
          '',
          `${floorName} — Total (${floorRows.length} rooms)`,
          ...EXPORT_INVENTORY_COLS.slice(1).map((col) =>
            roundNum(floorTotals[col.key] || 0, col.decimals ?? 0)
          ),
        ]);

        // Floor Power Split Rows (Emergency vs Raw)
        invSheetData.push([
          '',
          `${floorName} — Emergency Marked`,
          ...EXPORT_INVENTORY_COLS.slice(1).map((col) => {
            if (POWER_SPLIT_KEYS.has(col.key)) {
              return roundNum(floorSplit[col.key].emergency, 0);
            }
            if (col.key === 'tonnage') {
              return roundNum(floorSplit.tonnage.emergency, 2);
            }
            return '';
          }),
        ]);
        invSheetData.push([
          '',
          `${floorName} — Raw Marked`,
          ...EXPORT_INVENTORY_COLS.slice(1).map((col) => {
            if (POWER_SPLIT_KEYS.has(col.key)) {
              return roundNum(floorSplit[col.key].raw, 0);
            }
            if (col.key === 'tonnage') {
              return roundNum(floorSplit.tonnage.raw, 2);
            }
            return '';
          }),
        ]);

        invSheetData.push([]);
      }

      // Building Grand Total
      invSheetData.push([
        '',
        `BUILDING GRAND TOTAL (${inventoryRows.length} rooms)`,
        ...EXPORT_INVENTORY_COLS.slice(1).map((col) =>
          roundNum(grandTotals[col.key] || 0, col.decimals ?? 0)
        ),
      ]);
      invSheetData.push([
        '',
        'Building Power Split — Emergency Total',
        ...EXPORT_INVENTORY_COLS.slice(1).map((col) => {
          if (POWER_SPLIT_KEYS.has(col.key)) return roundNum(grandSplit[col.key].emergency, 0);
          if (col.key === 'tonnage') return roundNum(grandSplit.tonnage.emergency, 2);
          return '';
        }),
      ]);
      invSheetData.push([
        '',
        'Building Power Split — Raw Total',
        ...EXPORT_INVENTORY_COLS.slice(1).map((col) => {
          if (POWER_SPLIT_KEYS.has(col.key)) return roundNum(grandSplit[col.key].raw, 0);
          if (col.key === 'tonnage') return roundNum(grandSplit.tonnage.raw, 2);
          return '';
        }),
      ]);
    }

    const wsInv = XLSX.utils.aoa_to_sheet(invSheetData);
    wsInv['!cols'] = [{ wch: 8 }, ...EXPORT_INVENTORY_COLS.map((c) => ({ wch: c.width }))];
    wsInv['!merges'] = invMerges;
    XLSX.utils.book_append_sheet(wb, wsInv, 'Floor-Wise Inventory');

    // =========================================================================
    // SHEET 3: LOAD CALCULATIONS (Building Summary + Floor-Wise + Room-Wise)
    // =========================================================================
    const loadSettings = loadBuildingSettings();
    const roomLoads: RoomLoadCalc[] = inventoryRows.map((row) =>
      computeRoomBuildingLoad(row, loadSettings)
    );
    const pf =
      loadSettings.powerFactor > 0 && loadSettings.powerFactor <= 1
        ? loadSettings.powerFactor
        : 0.85;

    const bAcc = roomLoads.reduce(
      (s, r) => ({
        areaSqm: s.areaSqm + r.areaSqm,
        connectedTotalW: s.connectedTotalW + r.connectedWattsTotal,
        connectedDemandW: s.connectedDemandW + r.connectedDemandWatts,
        emergencyW: s.emergencyW + r.emergencyWattsH17H21,
        emergencyDemandW: s.emergencyDemandW + r.emergencyDemandWatts,
        rawW: s.rawW + r.rawWattsH17H21,
        rawDemandW: s.rawDemandW + r.rawDemandWatts,
        totalEmergencyDemandW: s.totalEmergencyDemandW + r.totalEmergencyDemandWatts,
        totalRawDemandW: s.totalRawDemandW + r.totalRawDemandWatts,
        totalConnectedW: s.totalConnectedW + r.totalConnectedWatts,
        totalDemandW: s.totalDemandW + r.totalDemandWatts,
        acWatts: s.acWatts + r.acWatts,
      }),
      {
        areaSqm: 0,
        connectedTotalW: 0,
        connectedDemandW: 0,
        emergencyW: 0,
        emergencyDemandW: 0,
        rawW: 0,
        rawDemandW: 0,
        totalEmergencyDemandW: 0,
        totalRawDemandW: 0,
        totalConnectedW: 0,
        totalDemandW: 0,
        acWatts: 0,
      }
    );

    const loadSheetData: (string | number)[][] = [
      ['BUILDING ELECTRICAL LOAD CALCULATION SCHEDULE'],
      [`Name of Work: ${projectName}  |  Location: ${location}  |  Date: ${dateStr}`],
      [
        `Diversity Factors — Connected Load DF: ${loadSettings.connectedDiversityFactor} | Emergency DF: ${loadSettings.emergencyDiversityFactor} | Raw DF: ${loadSettings.rawDiversityFactor} | Power Factor: ${pf} | 5A on Board in Connected: ${loadSettings.includeH16InConnected ? 'Yes' : 'No'}`,
      ],
      [],
      ['1. BUILDING LOAD SUMMARY (FORMULA BASIS)'],
      ['Load Component', 'Formula / Basis', 'Connected / Rated (kW)', 'Diversity Factor', 'Demand Load (kW)', 'Est. kVA (@ PF)'],
      [
        'Connected Load',
        'Lighting, Ceiling/Wall/Exhaust Fans & Bulb Points',
        roundNum(bAcc.connectedTotalW / 1000, 3),
        loadSettings.connectedDiversityFactor,
        roundNum(bAcc.connectedDemandW / 1000, 3),
        roundNum(bAcc.connectedDemandW / 1000 / pf, 2),
      ],
      [
        'Emergency Load',
        'Power Sockets, Computer Boards & AC marked Emergency (AC = Tonnage × 1500 W/ton × No. of AC)',
        roundNum(bAcc.emergencyW / 1000, 3),
        loadSettings.emergencyDiversityFactor,
        roundNum(bAcc.emergencyDemandW / 1000, 3),
        roundNum(bAcc.emergencyDemandW / 1000 / pf, 2),
      ],
      [
        'Total Emergency Load',
        'Connected Load × DF + Emergency Load × DF',
        roundNum((bAcc.connectedTotalW + bAcc.emergencyW) / 1000, 3),
        '-',
        roundNum(bAcc.totalEmergencyDemandW / 1000, 3),
        roundNum(bAcc.totalEmergencyDemandW / 1000 / pf, 2),
      ],
      [
        'Total Raw Load',
        'Raw Load (Sockets, Computer Boards & AC marked Raw) × DF',
        roundNum(bAcc.rawW / 1000, 3),
        loadSettings.rawDiversityFactor,
        roundNum(bAcc.totalRawDemandW / 1000, 3),
        roundNum(bAcc.totalRawDemandW / 1000 / pf, 2),
      ],
      [
        'Total Building Load',
        'Total Emergency Load + Total Raw Load',
        roundNum(bAcc.totalConnectedW / 1000, 3),
        '-',
        roundNum(bAcc.totalDemandW / 1000, 3),
        roundNum(bAcc.totalDemandW / 1000 / pf, 2),
      ],
      [],
      ['2. FLOOR-WISE ELECTRICAL LOAD SUMMARY'],
      [
        'S.No',
        'Floor',
        'Rooms',
        'Area (m²)',
        'Connected Load (kW)',
        'Conn × DF (kW)',
        'Emergency Load (kW)',
        'Emg × DF (kW)',
        'Total Emergency Load (kW)',
        'Raw Load (kW)',
        'Total Raw Load (kW)',
        'Total Load (kW)',
        'Est. kVA',
      ],
    ];

    const loadMerges: XlsxRange[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 5 } },
      { s: { r: 12, c: 0 }, e: { r: 12, c: 12 } },
    ];

    orderedFloors.forEach((floorName, fIdx) => {
      const fRooms = roomLoads.filter((r) => r.floor === floorName);
      const fSum = fRooms.reduce(
        (s, r) => ({
          areaSqm: s.areaSqm + r.areaSqm,
          connW: s.connW + r.connectedWattsTotal,
          connDemW: s.connDemW + r.connectedDemandWatts,
          emgW: s.emgW + r.emergencyWattsH17H21,
          emgDemW: s.emgDemW + r.emergencyDemandWatts,
          totEmgW: s.totEmgW + r.totalEmergencyDemandWatts,
          rawW: s.rawW + r.rawWattsH17H21,
          totRawW: s.totRawW + r.totalRawDemandWatts,
          totDemW: s.totDemW + r.totalDemandWatts,
        }),
        {
          areaSqm: 0,
          connW: 0,
          connDemW: 0,
          emgW: 0,
          emgDemW: 0,
          totEmgW: 0,
          rawW: 0,
          totRawW: 0,
          totDemW: 0,
        }
      );

      loadSheetData.push([
        fIdx + 1,
        floorName,
        fRooms.length,
        roundNum(fSum.areaSqm, 2),
        roundNum(fSum.connW / 1000, 3),
        roundNum(fSum.connDemW / 1000, 3),
        roundNum(fSum.emgW / 1000, 3),
        roundNum(fSum.emgDemW / 1000, 3),
        roundNum(fSum.totEmgW / 1000, 3),
        roundNum(fSum.rawW / 1000, 3),
        roundNum(fSum.totRawW / 1000, 3),
        roundNum(fSum.totDemW / 1000, 3),
        roundNum(fSum.totDemW / 1000 / pf, 2),
      ]);
    });

    loadSheetData.push([
      '',
      'BUILDING TOTAL',
      roomLoads.length,
      roundNum(bAcc.areaSqm, 2),
      roundNum(bAcc.connectedTotalW / 1000, 3),
      roundNum(bAcc.connectedDemandW / 1000, 3),
      roundNum(bAcc.emergencyW / 1000, 3),
      roundNum(bAcc.emergencyDemandW / 1000, 3),
      roundNum(bAcc.totalEmergencyDemandW / 1000, 3),
      roundNum(bAcc.rawW / 1000, 3),
      roundNum(bAcc.totalRawDemandW / 1000, 3),
      roundNum(bAcc.totalDemandW / 1000, 3),
      roundNum(bAcc.totalDemandW / 1000 / pf, 2),
    ]);

    loadSheetData.push([]);
    const roomLoadHdrTitleIdx = loadSheetData.length;
    loadSheetData.push(['3. ROOM-WISE ELECTRICAL LOAD CALCULATION SCHEDULE']);
    loadMerges.push({ s: { r: roomLoadHdrTitleIdx, c: 0 }, e: { r: roomLoadHdrTitleIdx, c: 13 } });

    loadSheetData.push([
      'S.No',
      'Floor',
      'Room',
      'Area (m²)',
      'Connected (W)',
      'Conn × DF (W)',
      'AC Units × Tonnage',
      'AC Load (W)',
      'Emergency (W)',
      'Emg × DF (W)',
      'Total Emergency (kW)',
      'Raw (W)',
      'Total Raw (kW)',
      'Total Load (kW)',
    ]);

    roomLoads.forEach((r, idx) => {
      const acLabel =
        r.acQty > 0 && r.acTonnagePerUnit > 0
          ? `${r.acQty} × ${r.acTonnagePerUnit} TR`
          : '-';
      loadSheetData.push([
        idx + 1,
        r.floor,
        r.room,
        roundNum(r.areaSqm, 2),
        roundNum(r.connectedWattsTotal, 0),
        roundNum(r.connectedDemandWatts, 0),
        acLabel,
        roundNum(r.acWatts, 0),
        roundNum(r.emergencyWattsH17H21, 0),
        roundNum(r.emergencyDemandWatts, 0),
        roundNum(r.totalEmergencyDemandWatts / 1000, 3),
        roundNum(r.rawWattsH17H21, 0),
        roundNum(r.totalRawDemandWatts / 1000, 3),
        roundNum(r.totalDemandWatts / 1000, 3),
      ]);
    });

    const wsLoad = XLSX.utils.aoa_to_sheet(loadSheetData);
    wsLoad['!cols'] = [
      { wch: 8 },
      { wch: 24 },
      { wch: 24 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 15 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
    ];
    wsLoad['!merges'] = loadMerges;
    XLSX.utils.book_append_sheet(wb, wsLoad, 'Load Calculations');

    // =========================================================================
    // SHEET 4: COOLING LOAD & CFM CALCULATIONS
    // =========================================================================
    const hvacSettings = loadHvacSettings();
    const roomHvacs: { row: InventoryRow; hvac: RowHvacCalc }[] = inventoryRows.map((row) => ({
      row,
      hvac: computeRowHvac(row, hvacSettings),
    }));

    const hvacTotals = roomHvacs.reduce(
      (s, { hvac }) => ({
        areaSqm: s.areaSqm + hvac.areaSqm,
        areaSqft: s.areaSqft + hvac.areaSqft,
        occupants: s.occupants + hvac.effectiveOccupants,
        reqCfm: s.reqCfm + hvac.requiredCfm,
        acRooms: s.acRooms + (hvac.acEnabled ? 1 : 0),
        envelopeBtu: s.envelopeBtu + hvac.envelopeBtu,
        occupantBtu: s.occupantBtu + hvac.occupantBtu,
        lightingBtu: s.lightingBtu + hvac.lightingBtu,
        equipmentBtu: s.equipmentBtu + hvac.equipmentBtu,
        safetyBtu: s.safetyBtu + hvac.safetyBtu,
        totalBtuHr: s.totalBtuHr + hvac.totalBtuHr,
        calculatedTr: s.calculatedTr + hvac.calculatedTr,
        recNoOfAc: s.recNoOfAc + hvac.recNoOfAc,
        recTonnage: s.recTonnage + hvac.recTonnage,
      }),
      {
        areaSqm: 0,
        areaSqft: 0,
        occupants: 0,
        reqCfm: 0,
        acRooms: 0,
        envelopeBtu: 0,
        occupantBtu: 0,
        lightingBtu: 0,
        equipmentBtu: 0,
        safetyBtu: 0,
        totalBtuHr: 0,
        calculatedTr: 0,
        recNoOfAc: 0,
        recTonnage: 0,
      }
    );

    const coolingSheetData: (string | number)[][] = [
      ['COOLING LOAD (TR / BTU/hr) & VENTILATION (CFM) CALCULATION SCHEDULE'],
      [`Name of Work: ${projectName}  |  Location: ${location}  |  Date: ${dateStr}`],
      [
        `Design Parameters — Default Height: ${hvacSettings.defaultHeightFt} ft | ACH (General/Toilet/Kitchen): ${hvacSettings.generalAch}/${hvacSettings.toiletAch}/${hvacSettings.kitchenLabAch} | Occupant Gain: ${hvacSettings.btuPerPerson} BTU/person | Safety Factor: ${hvacSettings.safetyFactorPct}%`,
      ],
      [],
      ['1. FLOOR-WISE COOLING LOAD & CFM SUMMARY'],
      [
        'S.No',
        'Floor',
        'Rooms',
        'AC Rooms',
        'Area (m²)',
        'Area (sq.ft)',
        'Occupants',
        'Required CFM',
        'Envelope + Internal Heat (BTU/hr)',
        'Safety Factor (BTU/hr)',
        'Total Cooling Load (BTU/hr)',
        'Calculated TR',
        'Suggested AC Units',
        'Provided AC Tonnage (TR)',
      ],
    ];

    const coolingMerges: XlsxRange[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 13 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 13 } },
    ];

    orderedFloors.forEach((floorName, fIdx) => {
      const fItems = roomHvacs.filter((x) => (x.row.floor || 'Ground Floor') === floorName);
      const fAcc = fItems.reduce(
        (s, { hvac }) => ({
          acRooms: s.acRooms + (hvac.acEnabled ? 1 : 0),
          areaSqm: s.areaSqm + hvac.areaSqm,
          areaSqft: s.areaSqft + hvac.areaSqft,
          occupants: s.occupants + hvac.effectiveOccupants,
          reqCfm: s.reqCfm + hvac.requiredCfm,
          baseBtu:
            s.baseBtu +
            hvac.envelopeBtu +
            hvac.occupantBtu +
            hvac.lightingBtu +
            hvac.equipmentBtu,
          safetyBtu: s.safetyBtu + hvac.safetyBtu,
          totalBtuHr: s.totalBtuHr + hvac.totalBtuHr,
          calculatedTr: s.calculatedTr + hvac.calculatedTr,
          recNoOfAc: s.recNoOfAc + hvac.recNoOfAc,
          recTonnage: s.recTonnage + hvac.recTonnage,
        }),
        {
          acRooms: 0,
          areaSqm: 0,
          areaSqft: 0,
          occupants: 0,
          reqCfm: 0,
          baseBtu: 0,
          safetyBtu: 0,
          totalBtuHr: 0,
          calculatedTr: 0,
          recNoOfAc: 0,
          recTonnage: 0,
        }
      );

      coolingSheetData.push([
        fIdx + 1,
        floorName,
        fItems.length,
        fAcc.acRooms,
        roundNum(fAcc.areaSqm, 2),
        roundNum(fAcc.areaSqft, 1),
        fAcc.occupants,
        roundNum(fAcc.reqCfm, 0),
        roundNum(fAcc.baseBtu, 0),
        roundNum(fAcc.safetyBtu, 0),
        roundNum(fAcc.totalBtuHr, 0),
        roundNum(fAcc.calculatedTr, 2),
        fAcc.recNoOfAc,
        roundNum(fAcc.recTonnage, 1),
      ]);
    });

    const totalBaseBtu =
      hvacTotals.envelopeBtu +
      hvacTotals.occupantBtu +
      hvacTotals.lightingBtu +
      hvacTotals.equipmentBtu;
    coolingSheetData.push([
      '',
      'BUILDING TOTAL',
      roomHvacs.length,
      hvacTotals.acRooms,
      roundNum(hvacTotals.areaSqm, 2),
      roundNum(hvacTotals.areaSqft, 1),
      hvacTotals.occupants,
      roundNum(hvacTotals.reqCfm, 0),
      roundNum(totalBaseBtu, 0),
      roundNum(hvacTotals.safetyBtu, 0),
      roundNum(hvacTotals.totalBtuHr, 0),
      roundNum(hvacTotals.calculatedTr, 2),
      hvacTotals.recNoOfAc,
      roundNum(hvacTotals.recTonnage, 1),
    ]);

    coolingSheetData.push([]);
    const roomCoolingTitleIdx = coolingSheetData.length;
    coolingSheetData.push(['2. ROOM-WISE COOLING LOAD & VENTILATION (CFM) SCHEDULE']);
    coolingMerges.push({ s: { r: roomCoolingTitleIdx, c: 0 }, e: { r: roomCoolingTitleIdx, c: 26 } });

    coolingSheetData.push([
      'S.No',
      'Floor',
      'Room',
      'Area (m²)',
      'Area (sq.ft)',
      'Ceiling Ht (ft)',
      'Vent Mode',
      'ACH',
      'AC Required?',
      'Exposure',
      'Occupants',
      'Required CFM',
      '1200mm Fan (Rec)',
      '1400mm Fan (Rec)',
      '400mm Wall Fan (Rec)',
      '225mm Exhaust (Rec)',
      '300mm Exhaust (Rec)',
      'Envelope BTU/hr',
      'Occupant BTU/hr',
      'Lighting BTU/hr',
      'Equipment BTU/hr',
      'Safety BTU/hr',
      'Total BTU/hr',
      'Calculated TR',
      'Suggested AC Sizing',
      'Suggested AC Units',
      'Provided Tonnage (TR)',
    ]);

    roomHvacs.forEach(({ row, hvac }, idx) => {
      const ventLabel =
        hvac.effectiveVentType === 'toilet'
          ? 'Toilet / Washroom'
          : hvac.effectiveVentType === 'kitchen_lab'
          ? 'Kitchen / Lab'
          : 'General Room';
      coolingSheetData.push([
        idx + 1,
        row.floor || 'Ground Floor',
        row.room || 'Unnamed Room',
        roundNum(hvac.areaSqm, 2),
        roundNum(hvac.areaSqft, 1),
        roundNum(hvac.heightFt, 1),
        ventLabel,
        hvac.achUsed,
        hvac.acEnabled ? 'Yes' : 'No',
        hvac.exposure.shortLabel,
        hvac.effectiveOccupants,
        roundNum(hvac.requiredCfm, 0),
        hvac.recH10,
        hvac.recH11,
        hvac.recH12,
        hvac.recH13,
        hvac.recH14,
        roundNum(hvac.envelopeBtu, 0),
        roundNum(hvac.occupantBtu, 0),
        roundNum(hvac.lightingBtu, 0),
        roundNum(hvac.equipmentBtu, 0),
        roundNum(hvac.safetyBtu, 0),
        roundNum(hvac.totalBtuHr, 0),
        roundNum(hvac.calculatedTr, 2),
        hvac.acSizingLabel,
        hvac.recNoOfAc,
        roundNum(hvac.recTonnage, 1),
      ]);
    });

    const wsCooling = XLSX.utils.aoa_to_sheet(coolingSheetData);
    wsCooling['!cols'] = [
      { wch: 7 },
      { wch: 16 },
      { wch: 22 },
      { wch: 11 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 8 },
      { wch: 13 },
      { wch: 20 },
      { wch: 11 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 17 },
      { wch: 15 },
      { wch: 15 },
      { wch: 14 },
      { wch: 24 },
      { wch: 17 },
      { wch: 19 },
    ];
    wsCooling['!merges'] = coolingMerges;
    XLSX.utils.book_append_sheet(wb, wsCooling, 'Cooling Load & CFM');

    const safeName = projectName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'CPWD_DSR_2025';
    XLSX.writeFile(wb, `${safeName}_BOQ_Estimate.xlsx`);
  };

  // Export CSV conforming to "First Item then Sub-item, sub-items listed under main items"
  const handleExportCSV = () => {
    const headers = [
      'S.No',
      'Main Item Code',
      'Main Item Specification',
      'Sub-Item Code',
      'Sub-Item / Variant Name',
      'Full Description (Item + Sub-item)',
      'Category',
      'Unit',
      'Rate (INR)',
      'Quantity',
      'Total Amount (INR)'
    ];

    const rows: (string | number)[][] = [];
    let sNo = 1;

    for (const group of groupedBOQ) {
      if (group.isStandalone && group.subItems.length === 1) {
        const item = group.subItems[0];
        rows.push([
          sNo++,
          `"${group.parentCode}"`,
          `"${group.parentDescription.replace(/"/g, '""')}"`,
          `"-"`,
          `"-"`,
          `"${group.parentDescription.replace(/"/g, '""')}"`,
          `"${item.category || ''}"`,
          `"${item.unit || ''}"`,
          item.rate,
          item.quantity,
          item.lineTotal,
        ]);
      } else {
        for (let subIdx = 0; subIdx < group.subItems.length; subIdx++) {
          const sub = group.subItems[subIdx];
          const fullDesc = `${group.parentDescription} — Sub-item: ${sub.subItemName || sub.description}`;
          rows.push([
            `${sNo}.${subIdx + 1}`,
            `"${group.parentCode}"`,
            `"${group.parentDescription.replace(/"/g, '""')}"`,
            `"${sub.itemCode}"`,
            `"${(sub.subItemName || sub.description).replace(/"/g, '""')}"`,
            `"${fullDesc.replace(/"/g, '""')}"`,
            `"${sub.category || ''}"`,
            `"${sub.unit || ''}"`,
            sub.rate,
            sub.quantity,
            sub.lineTotal,
          ]);
        }
        sNo++;
      }
    }

    rows.push(['', '', '', '', '', 'Total', '', '', '', '', totalBeforeContingency]);
    rows.push(['', '', '', '', '', `Contingency (${contingencyPercent}%)`, '', '', '', '', contingencyAmount]);
    rows.push(['', '', '', '', '', 'Grand Total (Including Contingency)', '', '', '', '', grandTotal]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CPWD_DSR_2025_BOQ_Estimate_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3">
      {/* Top action bar (hidden during print) */}
      <div className="flex flex-wrap items-center justify-between gap-2 no-print bg-white dark:bg-slate-900/95 border border-slate-300 dark:border-slate-800 px-3.5 py-2 rounded-xl shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToCatalog}
            className="flex items-center gap-1 text-[11px] text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Catalog</span>
          </button>
          <span className="text-xs font-bold text-slate-900 dark:text-white hidden sm:inline">
            BOQ / Detailed Estimate ({estimateItems.length} items)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {estimateItems.length > 0 && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 text-[11px] text-slate-900 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 transition-colors font-medium"
              title="Print CPWD Official BOQ Sheet"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          )}

          {(estimateItems.length > 0 || inventoryRows.length > 0) && (
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 rounded-md border border-emerald-500 dark:border-emerald-400/40 transition-colors shadow-xs"
              title="Download multi-sheet Excel (.xlsx): BOQ Estimate, Floor-Wise Inventory, Load Calculations & Cooling Load"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel (.xlsx)</span>
            </button>
          )}

          {estimateItems.length > 0 && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1 text-[11px] text-slate-800 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 transition-colors font-medium"
                title="Download CSV formatted with Main Item and Sub-items"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(true)}
                className="flex items-center gap-1 text-[11px] text-rose-800 dark:text-rose-300 hover:text-rose-950 dark:hover:text-white bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 px-2.5 py-1 rounded-md border border-rose-300 dark:border-rose-500/30 transition-colors font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main printable Estimate Sheet */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-md text-slate-900 dark:text-slate-100 print:bg-white print:text-black print:border-none print:p-0">
        {/* CPWD Estimate Official Header */}
        <div className="border-b border-slate-300 dark:border-slate-700 print:border-b-2 print:border-black pb-3 mb-4 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 print:text-gray-800">
            GOVERNMENT OF INDIA • CENTRAL PUBLIC WORKS DEPARTMENT
          </span>
          <h2 className="text-base sm:text-lg font-black mt-0.5 text-slate-950 dark:text-white print:text-black">
            BILL OF QUANTITIES (BOQ) / DETAILED ESTIMATE
          </h2>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 print:text-gray-600 mt-0.5">
            Delhi Schedule of Rates (E&amp;M) 2025 • Main Item Specification with Sub-Items Listed Underneath
          </p>

          {/* Project Details inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 text-left text-xs bg-slate-50 dark:bg-slate-950/60 print:bg-gray-100 p-2.5 rounded-lg border border-slate-300 dark:border-slate-800 print:border-gray-300 print-single-column">
            <div>
              <label className="text-slate-600 dark:text-slate-400 print:text-gray-600 block text-[10px] mb-0.5 font-medium">
                Name of Work:
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 print:bg-transparent border border-slate-300 dark:border-slate-700 print:border-none rounded px-2 py-1 text-slate-900 dark:text-white print:text-black font-semibold text-xs focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-slate-600 dark:text-slate-400 print:text-gray-600 block text-[10px] mb-0.5 font-medium">
                Department / Authority:
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 print:bg-transparent border border-slate-300 dark:border-slate-700 print:border-none rounded px-2 py-1 text-slate-900 dark:text-white print:text-black font-semibold text-xs focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-slate-600 dark:text-slate-400 print:text-gray-600 block text-[10px] mb-0.5 font-medium">
                Location &amp; Date:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 print:bg-transparent border border-slate-300 dark:border-slate-700 print:border-none rounded px-2 py-1 text-slate-900 dark:text-white print:text-black font-semibold text-xs focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                />
                <span className="text-slate-600 dark:text-slate-400 print:text-gray-600 self-center font-mono text-[11px]">
                  {new Date().toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Inline Direct DSR Search & Quick-Add Bar */}
        {onAddCatalogItem && (
          <div ref={searchContainerRef} className="relative mb-4 no-print">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 focus-within:border-emerald-500 transition-colors">
              <Search className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <input
                type="text"
                value={dsrQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setDsrQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                  }
                }}
                placeholder="Direct DSR Search: type item code (e.g. 1.10.1, 2.3), specification, or category to add directly to BOQ..."
                className="flex-1 min-w-0 bg-transparent text-xs text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none"
              />
              {dsrQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setDsrQuery('');
                    setIsSearchOpen(true);
                  }}
                  className="p-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  title="Clear DSR search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 hidden sm:inline">
                {searchIndex.length > 0 ? `${searchIndex.length.toLocaleString()} DSR lines` : 'Loading catalog...'}
              </span>
            </div>

            {isSearchOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>
                    {dsrQuery.trim()
                      ? `Showing top ${searchResults.length} matching DSR items`
                      : `Showing first ${searchResults.length} DSR items — type code or keywords to filter`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium"
                  >
                    Close
                  </button>
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No DSR items matched &ldquo;{dsrQuery}&rdquo;. Try a different code or keyword.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                    {searchResults.map((entry) => {
                      const qtyVal = quickQtys[entry.key] ?? 1;
                      return (
                        <div
                          key={entry.key}
                          className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {entry.code}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {entry.category} · {entry.unit}
                              </span>
                            </div>
                            <div className="text-slate-900 dark:text-slate-100 font-medium line-clamp-1">
                              {entry.subName
                                ? `${entry.subName} — ${entry.parentDescription}`
                                : entry.parentDescription}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-200 text-xs w-24 text-right">
                              {formatINR(entry.rate, false)}
                            </span>
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              value={qtyVal}
                              onChange={(e) => {
                                const parsed = parseFloat(e.target.value);
                                setQuickQtys((prev) => ({
                                  ...prev,
                                  [entry.key]: isNaN(parsed) || parsed <= 0 ? 1 : parsed,
                                }));
                              }}
                              aria-label={`Quantity for ${entry.code}`}
                              className="w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-center font-mono tabular-nums text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => onAddCatalogItem(entry.item, entry.variant, qtyVal)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                            {entry.isVariant && entry.activeVariantCount > 1 && onAddAllVariants && (
                              <button
                                type="button"
                                onClick={() => onAddAllVariants(entry.item)}
                                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors"
                                title={`Add all ${entry.activeVariantCount} sub-items under Item ${entry.parentCode}`}
                              >
                                + All ({entry.activeVariantCount})
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {estimateItems.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-3">
            <Calculator className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-300">No Items Added to BOQ Yet</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Use the direct DSR search bar above or browse the DSR (E&amp;M) 2025 catalog to add items directly to your BOQ.
            </p>
            <button
              onClick={onBackToCatalog}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Browse Catalog Items</span>
            </button>
          </div>
        ) : (
          <>
            {/* Table of Estimate Items with Grouping: Main Item first, then Sub-items listed underneath */}
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-xl border border-slate-300 dark:border-slate-800 print:border-black">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-950 print:bg-gray-200 text-slate-800 dark:text-slate-300 print:text-black uppercase text-[10px] font-bold border-b border-slate-300 dark:border-slate-800 print:border-black sticky top-0 z-10 print:static">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-20">
                      S.No
                    </th>
                    <th className="py-2.5 px-3 w-28">
                      DSR Item No.
                    </th>
                    <th className="py-2.5 px-4">
                      Description of Items &amp; Specification (First Item then Sub-Item)
                    </th>
                    <th className="py-2.5 px-3 text-center w-20">
                      Unit
                    </th>
                    <th className="py-2.5 px-3 text-right w-28">
                      Rate (₹)
                    </th>
                    <th className="py-2.5 px-3 text-center w-28">
                      Quantity
                    </th>
                    <th className="py-2.5 px-3 text-right w-32">
                      Amount (₹)
                    </th>
                    <th className="py-2.5 px-2 text-center w-12 no-print">
                      Act
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 print:divide-gray-400">
                  {groupedBOQ.map((group, groupIdx) => {
                    const hasSubItems = !group.isStandalone || group.subItems.some(i => i.isSubItem || i.subItemName);
                    const isGroupDropTarget =
                      dropTarget?.kind === 'group' && dropTarget.parentCode === group.parentCode;
                    const isGroupDragging =
                      dragState?.kind === 'group' && dragState.parentCode === group.parentCode;

                    return (
                      <React.Fragment key={group.parentCode}>
                        {/* 1. MAIN ITEM HEADER ROW (Draggable for serial group reordering) */}
                        <tr
                          onDragOver={(e) => {
                            if (
                              onReorderEstimateItems &&
                              dragState?.kind === 'group' &&
                              dragState.parentCode !== group.parentCode
                            ) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDropTarget({ kind: 'group', parentCode: group.parentCode });
                            }
                          }}
                          onDragLeave={() => {
                            if (
                              dropTarget?.kind === 'group' &&
                              dropTarget.parentCode === group.parentCode
                            ) {
                              setDropTarget(null);
                            }
                          }}
                          onDrop={(e) => {
                            if (
                              onReorderEstimateItems &&
                              dragState?.kind === 'group' &&
                              dragState.parentCode !== group.parentCode
                            ) {
                              e.preventDefault();
                              onReorderEstimateItems(
                                reorderBoqGroups(
                                  estimateItems,
                                  dragState.parentCode,
                                  group.parentCode
                                )
                              );
                            }
                            setDragState(null);
                            setDropTarget(null);
                          }}
                          className={`border-t-2 border-slate-300 dark:border-slate-700/80 print:border-black transition-colors ${
                            isGroupDropTarget
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-inset ring-emerald-500'
                              : isGroupDragging
                              ? 'opacity-60 bg-slate-100 dark:bg-slate-900'
                              : 'bg-slate-50 dark:bg-slate-950/90 print:bg-gray-100'
                          }`}
                        >
                          <td className="py-3 px-2 text-center font-mono tabular-nums font-bold text-slate-900 dark:text-white print:text-black align-top text-xs">
                            <div className="inline-flex items-center justify-center gap-1">
                              {onReorderEstimateItems && groupedBOQ.length > 1 && (
                                <span
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', `group:${group.parentCode}`);
                                    const rowEl = (e.currentTarget as HTMLElement).closest('tr');
                                    if (rowEl) {
                                      e.dataTransfer.setDragImage(rowEl, 24, 18);
                                    }
                                    setDragState({ kind: 'group', parentCode: group.parentCode });
                                  }}
                                  onDragEnd={() => {
                                    setDragState(null);
                                    setDropTarget(null);
                                  }}
                                  className="no-print cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded"
                                  title="Drag main item group to reorder serial number"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <span>{groupIdx + 1}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top">
                            <span className="font-mono font-black text-sm px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 print:bg-transparent text-emerald-800 dark:text-emerald-400 print:text-black border border-emerald-400/70 dark:border-emerald-500/30 print:border-none inline-block">
                              {group.parentCode}
                            </span>
                            {hasSubItems && (
                              <span className="block text-[10px] text-slate-600 dark:text-slate-400 print:text-gray-600 mt-1">
                                {group.subItems.length} {group.subItems.length === 1 ? 'sub-item' : 'sub-items'}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 align-top" colSpan={hasSubItems ? 2 : 1}>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 print:text-gray-700">
                                <span className="font-semibold text-slate-800 dark:text-slate-300 print:text-black uppercase tracking-wider">
                                  {group.category}
                                </span>
                                {group.chapter && (
                                  <>
                                    <span>›</span>
                                    <span>{group.chapter}</span>
                                  </>
                                )}
                                {group.itemType && (
                                  <span className="text-blue-700 dark:text-blue-300 print:text-black font-medium">
                                    · {group.itemType}
                                  </span>
                                )}
                              </div>

                              <div>
                                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 print:text-black uppercase tracking-wider block mb-0.5">
                                  Main Item Specification:
                                </span>
                                <p className="text-slate-900 dark:text-slate-200 print:text-black text-xs leading-relaxed font-normal">
                                  {group.parentDescription}
                                </p>
                              </div>

                              {hasSubItems && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 print:text-gray-600 italic pt-1">
                                  Selected sub-items under this item:
                                </p>
                              )}
                            </div>
                          </td>

                          {!hasSubItems ? (
                            <>
                              <td className="py-3 px-3 text-center font-mono text-slate-700 dark:text-slate-300 print:text-black align-top text-xs">
                                {group.subItems[0]?.unit || '–'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-slate-900 dark:text-slate-200 print:text-black align-top text-xs font-semibold tabular-nums">
                                {formatINR(group.subItems[0]?.rate || 0, false)}
                              </td>
                              <td className="py-3 px-3 text-center align-top">
                                <input
                                  type="number"
                                  min="0.1"
                                  step="any"
                                  value={group.subItems[0]?.quantity || 1}
                                  onChange={(e) => onUpdateQuantity(group.subItems[0].id, parseFloat(e.target.value) || 0)}
                                  className="w-20 bg-white dark:bg-slate-900 print:bg-transparent border border-slate-300 dark:border-slate-700 print:border-gray-400 rounded px-1.5 py-1 text-center font-mono text-slate-900 dark:text-white print:text-black font-semibold text-xs focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                                />
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-950 dark:text-white print:text-black align-top text-xs tabular-nums">
                                {formatINR(group.subItems[0]?.lineTotal || 0, false)}
                              </td>
                              <td className="py-3 px-2 text-center align-top no-print">
                                <button
                                  onClick={() => onRemoveItem(group.subItems[0].id)}
                                  className="text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 p-1"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-3" colSpan={3} />
                              <td className="py-3 px-2 text-center align-top no-print">
                                {onRemoveGroup && (
                                  <button
                                    onClick={() => onRemoveGroup(group.parentCode)}
                                    className="text-slate-500 hover:text-rose-700 dark:hover:text-rose-400 p-1"
                                    title={`Remove all sub-items under Item ${group.parentCode}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </>
                          )}
                        </tr>

                        {/* 2. SUB-ITEMS ROWS LISTED UNDER MAIN ITEM (Draggable within same parentCode group) */}
                        {hasSubItems && group.subItems.map((sub, subIdx) => {
                          const canDragSub = Boolean(onReorderEstimateItems && group.subItems.length > 1);
                          const isSubDropTarget =
                            dropTarget?.kind === 'sub' &&
                            dropTarget.parentCode === group.parentCode &&
                            dropTarget.itemId === sub.id;
                          const isSubDragging =
                            dragState?.kind === 'sub' &&
                            dragState.parentCode === group.parentCode &&
                            dragState.itemId === sub.id;

                          return (
                            <tr 
                              key={sub.id}
                              onDragOver={(e) => {
                                if (
                                  onReorderEstimateItems &&
                                  dragState?.kind === 'sub' &&
                                  dragState.parentCode === group.parentCode &&
                                  dragState.itemId !== sub.id
                                ) {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                  setDropTarget({
                                    kind: 'sub',
                                    parentCode: group.parentCode,
                                    itemId: sub.id,
                                  });
                                }
                              }}
                              onDragLeave={() => {
                                if (
                                  dropTarget?.kind === 'sub' &&
                                  dropTarget.itemId === sub.id
                                ) {
                                  setDropTarget(null);
                                }
                              }}
                              onDrop={(e) => {
                                if (
                                  onReorderEstimateItems &&
                                  dragState?.kind === 'sub' &&
                                  dragState.parentCode === group.parentCode &&
                                  dragState.itemId !== sub.id
                                ) {
                                  e.preventDefault();
                                  onReorderEstimateItems(
                                    reorderBoqSubItemWithinGroup(
                                      estimateItems,
                                      group.parentCode,
                                      dragState.itemId,
                                      sub.id
                                    )
                                  );
                                }
                                setDragState(null);
                                setDropTarget(null);
                              }}
                              className={`transition-colors ${
                                isSubDropTarget
                                  ? 'bg-cyan-50 dark:bg-cyan-950/40 ring-2 ring-inset ring-cyan-500'
                                  : isSubDragging
                                  ? 'opacity-60 bg-slate-100 dark:bg-slate-800'
                                  : 'bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 print:hover:bg-transparent'
                              }`}
                            >
                              <td className="py-2.5 px-2 text-center font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-400 print:text-gray-600">
                                <div className="inline-flex items-center justify-center gap-1">
                                  {canDragSub && (
                                    <span
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData(
                                          'text/plain',
                                          `sub:${group.parentCode}:${sub.id}`
                                        );
                                        const rowEl = (e.currentTarget as HTMLElement).closest('tr');
                                        if (rowEl) {
                                          e.dataTransfer.setDragImage(rowEl, 24, 16);
                                        }
                                        setDragState({
                                          kind: 'sub',
                                          parentCode: group.parentCode,
                                          itemId: sub.id,
                                        });
                                      }}
                                      onDragEnd={() => {
                                        setDragState(null);
                                        setDropTarget(null);
                                      }}
                                      className="no-print cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded"
                                      title="Drag sub-item to reorder within this group"
                                    >
                                      <GripVertical className="w-3 h-3" />
                                    </span>
                                  )}
                                  <span>{groupIdx + 1}.{subIdx + 1}</span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300 print:text-black">
                                <div className="flex items-center gap-1">
                                  <CornerDownRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500/70 shrink-0" />
                                  <span>{sub.itemCode}</span>
                                </div>
                              </td>

                              <td className="py-2.5 px-4 text-slate-900 dark:text-slate-200 print:text-black">
                                <div className="flex items-start gap-2">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-950 dark:text-white print:text-black">
                                        {sub.subItemName || sub.description}
                                      </span>
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 print:text-black font-mono">
                                        · {sub.itemCode}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 print:text-gray-600 line-clamp-1">
                                      Under Item {group.parentCode}: {group.parentDescription}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-center font-mono text-slate-700 dark:text-slate-300 print:text-black text-xs">
                                {sub.unit}
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-200 print:text-black text-xs tabular-nums">
                                {formatINR(sub.rate, false)}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="number"
                                  min="0.1"
                                  step="any"
                                  value={sub.quantity}
                                  onChange={(e) => onUpdateQuantity(sub.id, parseFloat(e.target.value) || 0)}
                                  className="w-20 bg-white dark:bg-slate-950 print:bg-transparent border border-slate-300 dark:border-slate-700 print:border-gray-400 rounded px-1.5 py-1 text-center font-mono text-slate-900 dark:text-white print:text-black font-semibold text-xs focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                                />
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-950 dark:text-slate-100 print:text-black text-xs tabular-nums">
                                {formatINR(sub.lineTotal, false)}
                              </td>

                              <td className="py-2.5 px-2 text-center no-print">
                                <button
                                  onClick={() => onRemoveItem(sub.id)}
                                  className="text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 p-1 transition-colors"
                                  title={`Remove Sub-item ${sub.itemCode}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculations & Cost Breakdown Section */}
            <div className="mt-6 flex flex-col md:flex-row justify-between gap-6 pt-5 border-t border-slate-300 dark:border-slate-800 print:border-gray-400 print-single-column">
              {/* Left: Notes & In-words amount */}
              <div className="flex-1 space-y-3">
                <div className="bg-slate-50 dark:bg-slate-950/60 print:bg-gray-100 p-4 rounded-xl border border-slate-300 dark:border-slate-800 print:border-gray-300">
                  <span className="text-xs uppercase font-bold text-slate-600 dark:text-slate-400 print:text-gray-600 block mb-1">
                    Total Estimated Amount in Words (After Contingency):
                  </span>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 print:text-black italic">
                    {numberToIndianWords(Math.round(grandTotal))}
                  </p>
                </div>

                {/* CPWD Standard Clauses */}
                <div className="text-[11px] text-slate-600 dark:text-slate-400 print:text-gray-700 space-y-1">
                  <p>1. Rates are as per CPWD Delhi Schedule of Rates (E&amp;M) 2025.</p>
                  <p>2. Quantities are tentative and subject to site measurement.</p>
                  <p>3. Execution to be in accordance with CPWD General Specifications for Electrical Works.</p>
                  <p>4. Contingency ({contingencyPercent}%) applied over Total Estimated Cost as per CPWD estimate norms.</p>
                </div>
              </div>

              {/* Right: Calculations summary card */}
              <div className="w-full md:w-96 bg-slate-50 dark:bg-slate-950/80 print:bg-gray-50 border border-slate-300 dark:border-slate-800 print:border-gray-400 rounded-xl p-4 space-y-2.5 text-xs">
                {/* Total (Before Contingency) */}
                <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-slate-200 print:text-black">
                  <span>Total:</span>
                  <span className="font-mono tabular-nums">{formatINR(totalBeforeContingency)}</span>
                </div>

                {/* Contingency in Percentage */}
                <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 print:text-gray-800">
                  <div className="flex items-center gap-1">
                    <span>Add Contingency:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="any"
                      value={contingencyPercent}
                      onChange={(e) => setContingencyPercent(parseFloat(e.target.value) || 0)}
                      className="w-14 bg-white dark:bg-slate-900 print:bg-white border border-amber-400 dark:border-amber-500/40 print:border-gray-400 rounded px-1 text-center font-mono text-[11px] text-amber-900 dark:text-amber-200 print:text-black"
                    />
                    <span>%</span>
                  </div>
                  <span className="font-mono font-semibold tabular-nums">{formatINR(contingencyAmount)}</span>
                </div>

                {/* Final Grand Total (After Contingency) */}
                <div className="pt-2.5 border-t-2 border-slate-300 dark:border-slate-700 print:border-black flex items-center justify-between text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400 print:text-black">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base sm:text-lg tabular-nums">{formatINR(grandTotal)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Clear All BOQ Items Confirmation Popup */}
      {isClearConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-boq-confirm-title"
          onClick={() => setIsClearConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/30 flex items-center justify-center text-rose-700 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="clear-boq-confirm-title" className="text-sm font-bold text-slate-950 dark:text-white">
                    Clear All BOQ Estimate Items?
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    This will remove every line item from your current BOQ.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
                aria-label="Close confirmation dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-500/30 p-3 space-y-1">
                <div className="flex items-center justify-between font-medium text-slate-800 dark:text-slate-200">
                  <span>Items to be cleared:</span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                    {estimateItems.length} {estimateItems.length === 1 ? 'item' : 'items'} ({groupedBOQ.length} {groupedBOQ.length === 1 ? 'heading' : 'headings'})
                  </span>
                </div>
                <div className="flex items-center justify-between font-medium text-slate-800 dark:text-slate-200">
                  <span>Current Estimate Grand Total:</span>
                  <span className="font-mono font-bold text-slate-950 dark:text-white">
                    {formatINR(grandTotal)}
                  </span>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Are you sure you want to clear all items from the BOQ estimate? Your Room Inventory, Floor Plan, and DSR Catalog schedule will not be affected.
              </p>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsClearConfirmOpen(false);
                  onClearEstimate();
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 border border-rose-500 shadow-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear All Items</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
