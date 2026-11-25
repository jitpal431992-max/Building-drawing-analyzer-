import { InventoryRow, RawEmergencyColumnKey } from '../types';
import { FLOOR_OPTIONS } from './wattageTable';

export interface McbDbSettings {
  sparePercent: number; // Default 20%
  pointsPerSwitchBoard: number; // Default 8 (#H05-#H15 ÷ 8)
}

export const DEFAULT_MCBDB_SETTINGS: McbDbSettings = {
  sparePercent: 20,
  pointsPerSwitchBoard: 8,
};

export interface DbCapacityOption {
  sizeCode: string;
  label: string;
  ways: number; // Effective ways (SP ways for LDB/PDB, 3-pole ways for VTPNDB)
  spModules: number; // Nominal module ways (e.g. 12, 24, 36)
  incoming: string;
}

// Rule 3: LDB (2P incoming; 2+4, 2+6, 2+10, 2+14 way)
export const LDB_CAPACITIES: DbCapacityOption[] = [
  { sizeCode: '2+4 Way', label: '2+4 Way SPN LDB', ways: 4, spModules: 4, incoming: '2P MCB' },
  { sizeCode: '2+6 Way', label: '2+6 Way SPN LDB', ways: 6, spModules: 6, incoming: '2P MCB' },
  { sizeCode: '2+10 Way', label: '2+10 Way SPN LDB', ways: 10, spModules: 10, incoming: '2P MCB' },
  { sizeCode: '2+14 Way', label: '2+14 Way SPN LDB', ways: 14, spModules: 14, incoming: '2P MCB' },
];

// Rule 4 & 4a: PDB / Raw PDB (4P incoming; 4+12, 4+18, 4+24 way)
export const PDB_CAPACITIES: DbCapacityOption[] = [
  { sizeCode: '4+12 Way', label: '4+12 Way TPN PDB', ways: 12, spModules: 12, incoming: '4P MCB' },
  { sizeCode: '4+18 Way', label: '4+18 Way TPN PDB', ways: 18, spModules: 18, incoming: '4P MCB' },
  { sizeCode: '4+24 Way', label: '4+24 Way TPN PDB', ways: 24, spModules: 24, incoming: '4P MCB' },
];

// Rule 7: VTPNDB (4P MCCB incoming; 4+12, 4+24, 4+36 way, 3-pole ways = size ÷ 3)
export const VTPNDB_CAPACITIES: DbCapacityOption[] = [
  { sizeCode: '4+12 Way (4 TP)', label: '4+12 Way VTPNDB (4 × 3P)', ways: 4, spModules: 12, incoming: '4P MCCB' },
  { sizeCode: '4+24 Way (8 TP)', label: '4+24 Way VTPNDB (8 × 3P)', ways: 8, spModules: 24, incoming: '4P MCCB' },
  { sizeCode: '4+36 Way (12 TP)', label: '4+36 Way VTPNDB (12 × 3P)', ways: 12, spModules: 36, incoming: '4P MCCB' },
];

export interface AllocatedBoardItem {
  option: DbCapacityOption;
  qty: number;
}

export interface BoardAllocationResult {
  items: AllocatedBoardItem[];
  totalBoards: number;
  providedWays: number;
}

export function allocateBoards(
  requiredWays: number,
  capacities: DbCapacityOption[]
): BoardAllocationResult {
  if (requiredWays <= 0 || capacities.length === 0) {
    return { items: [], totalBoards: 0, providedWays: 0 };
  }

  const sorted = [...capacities].sort((a, b) => a.ways - b.ways);
  const maxCap = sorted[sorted.length - 1];
  const counts = new Map<string, number>();

  const fullMaxCount = Math.floor(requiredWays / maxCap.ways);
  const remainder = requiredWays % maxCap.ways;

  if (fullMaxCount > 0) {
    counts.set(maxCap.sizeCode, fullMaxCount);
  }

  if (remainder > 0) {
    const bestFit = sorted.find((c) => c.ways >= remainder) || maxCap;
    counts.set(bestFit.sizeCode, (counts.get(bestFit.sizeCode) || 0) + 1);
  }

  const items: AllocatedBoardItem[] = [];
  let totalBoards = 0;
  let providedWays = 0;

  for (const cap of sorted) {
    const qty = counts.get(cap.sizeCode) || 0;
    if (qty > 0) {
      items.push({ option: cap, qty });
      totalBoards += qty;
      providedWays += qty * cap.ways;
    }
  }

  return { items, totalBoards, providedWays };
}

function nQty(val?: string): number {
  if (!val) return 0;
  const parsed = parseFloat(val);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function applySpare(baseWays: number, sparePercent: number): number {
  if (baseWays <= 0) return 0;
  return Math.ceil(baseWays * (1 + sparePercent / 100));
}

export type DbCategoryType =
  | 'Switch Board'
  | 'LDB'
  | 'Emergency PDB'
  | 'Raw PDB'
  | 'Emergency VTPNDB'
  | 'Raw VTPNDB';

export interface RoomSwitchBoardCalc {
  rowId: string;
  floor: string;
  room: string;
  pointsH05H15: number;
  switchBoards: number;
  h17Socket2x5a: number;
  h19ComputerBoard: number;
  emgH18Socket20a: number;
  emgH20Socket3x20a: number;
  emgH21Ac: number;
  rawH18Socket20a: number;
  rawH20Socket3x20a: number;
  rawH21Ac: number;
}

export interface FloorDbSummary {
  floorName: string;
  roomCount: number;
  pointsH05H15: number;
  switchBoards: number;
  h17Socket2x5a: number;
  h19ComputerBoard: number;
  emgH18: number;
  emgH20: number;
  emgH21: number;
  emgPowerTotal: number;
  rawH18: number;
  rawH20: number;
  rawH21: number;
  rawPowerTotal: number;

  // LDB (Rule 3)
  ldbBaseWays: number;
  ldbReqWays: number;
  ldbAlloc: BoardAllocationResult;

  // Emergency PDB (Rule 4 & Rule 5)
  emgPdbSkippedSingleLdb: boolean;
  emgPdbBaseWays: number;
  emgPdbReqWays: number;
  emgPdbAlloc: BoardAllocationResult;

  // Raw PDB (Rule 4a)
  rawPdbBaseWays: number;
  rawPdbReqWays: number;
  rawPdbAlloc: BoardAllocationResult;

  // Emergency VTPNDB (Rule 5 & Rule 7)
  emgVtpndbSkippedSinglePdb: boolean;
  emgVtpndbBaseTpWays: number;
  emgVtpndbReqTpWays: number;
  emgVtpndbAlloc: BoardAllocationResult;

  // Raw VTPNDB (Rule 4a, Rule 5/6a & Rule 7)
  rawVtpndbSkippedSinglePdb: boolean;
  rawVtpndbBaseTpWays: number;
  rawVtpndbReqTpWays: number;
  rawVtpndbAlloc: BoardAllocationResult;
}

export interface FloorDbTableEntry {
  id: string;
  scope: string; // Floor name or 'Common / Main Building Panel'
  isCommon: boolean;
  category: DbCategoryType;
  incomingType: string;
  sizeCode: string;
  qty: number;
  baseWays: number;
  reqWaysWithSpare: number;
  providedWays: number;
  usedWays: number;
  spareWays: number;
  wayUnit: 'Boards' | 'SP Ways' | '3P Ways';
  basisNote: string;
}

export interface CommonDbSummary {
  singleLdbFloorNames: string[];
  commonEmgPdbBaseWays: number;
  commonEmgPdbReqWays: number;
  commonEmgPdbAlloc: BoardAllocationResult;

  singleEmgPdbFloorNames: string[];
  commonEmgVtpndbBaseTpWays: number;
  commonEmgVtpndbReqTpWays: number;
  commonEmgVtpndbAlloc: BoardAllocationResult;

  singleRawPdbFloorNames: string[];
  commonRawVtpndbBaseTpWays: number;
  commonRawVtpndbReqTpWays: number;
  commonRawVtpndbAlloc: BoardAllocationResult;
}

export interface CategoryBoqTotal {
  category: DbCategoryType;
  incomingType: string;
  sizeCode: string;
  totalQty: number;
  totalProvidedWays: number;
  wayUnit: 'Boards' | 'SP Ways' | '3P Ways';
}

export interface McbDbCalculationResult {
  rooms: RoomSwitchBoardCalc[];
  floors: FloorDbSummary[];
  common: CommonDbSummary;
  tableEntries: FloorDbTableEntry[];
  boqTotals: CategoryBoqTotal[];
  grandTotals: {
    switchBoards: number;
    ldb: number;
    emgPdb: number;
    rawPdb: number;
    emgVtpndb: number;
    rawVtpndb: number;
  };
}

export function calculateMcbDbSchedule(
  rows: InventoryRow[],
  settings: McbDbSettings = DEFAULT_MCBDB_SETTINGS
): McbDbCalculationResult {
  const sparePct = settings.sparePercent >= 0 ? settings.sparePercent : 20;
  const ptsPerSb = settings.pointsPerSwitchBoard > 0 ? settings.pointsPerSwitchBoard : 8;

  const isEmergency = (row: InventoryRow, key: RawEmergencyColumnKey) =>
    row.powerSources?.[key] === 'emergency';

  // Rule 1 & 2: Room-wise switch boards and SP MCB counts
  const rooms: RoomSwitchBoardCalc[] = rows.map((row) => {
    const floor = row.floor || 'Ground Floor';
    const room = row.room || 'Unnamed Room';

    const pointsH05H15 =
      nQty(row.tube20w) +
      nQty(row.tube40w) +
      nQty(row.surfaceLight36w) +
      nQty(row.recessLight20w) +
      nQty(row.recessLight36w) +
      nQty(row.ceilingFan1200) +
      nQty(row.ceilingFan1400) +
      nQty(row.wallFan400) +
      nQty(row.exhaustFan225) +
      nQty(row.exhaustFan300) +
      nQty(row.bulbPoint20w);

    const switchBoards = pointsH05H15 > 0 ? Math.ceil(pointsH05H15 / ptsPerSb) : 0;

    const h17Socket2x5a = nQty(row.socket2x5a);
    const h19ComputerBoard = nQty(row.computerBoard);

    const h18Qty = nQty(row.socket20a);
    const h20Qty = nQty(row.socket3x20a);
    const h21Qty = nQty(row.noOfAc);

    return {
      rowId: row.id,
      floor,
      room,
      pointsH05H15,
      switchBoards,
      h17Socket2x5a,
      h19ComputerBoard,
      emgH18Socket20a: isEmergency(row, 'socket20a') ? h18Qty : 0,
      emgH20Socket3x20a: isEmergency(row, 'socket3x20a') ? h20Qty : 0,
      emgH21Ac: isEmergency(row, 'noOfAc') ? h21Qty : 0,
      rawH18Socket20a: !isEmergency(row, 'socket20a') ? h18Qty : 0,
      rawH20Socket3x20a: !isEmergency(row, 'socket3x20a') ? h20Qty : 0,
      rawH21Ac: !isEmergency(row, 'noOfAc') ? h21Qty : 0,
    };
  });

  // Preserve canonical floor order
  const present = new Set<string>(rooms.map((r) => r.floor));
  const orderedFloors: string[] = [];
  for (const f of FLOOR_OPTIONS) {
    if (present.has(f)) {
      orderedFloors.push(f);
      present.delete(f);
    }
  }
  for (const extra of present) {
    orderedFloors.push(extra);
  }

  // Per-floor calculation (Rules 3, 4, 4a, 5, 7)
  const floors: FloorDbSummary[] = orderedFloors.map((floorName) => {
    const floorRooms = rooms.filter((r) => r.floor === floorName);

    const agg = floorRooms.reduce(
      (s, r) => ({
        pointsH05H15: s.pointsH05H15 + r.pointsH05H15,
        switchBoards: s.switchBoards + r.switchBoards,
        h17Socket2x5a: s.h17Socket2x5a + r.h17Socket2x5a,
        h19ComputerBoard: s.h19ComputerBoard + r.h19ComputerBoard,
        emgH18: s.emgH18 + r.emgH18Socket20a,
        emgH20: s.emgH20 + r.emgH20Socket3x20a,
        emgH21: s.emgH21 + r.emgH21Ac,
        rawH18: s.rawH18 + r.rawH18Socket20a,
        rawH20: s.rawH20 + r.rawH20Socket3x20a,
        rawH21: s.rawH21 + r.rawH21Ac,
      }),
      {
        pointsH05H15: 0,
        switchBoards: 0,
        h17Socket2x5a: 0,
        h19ComputerBoard: 0,
        emgH18: 0,
        emgH20: 0,
        emgH21: 0,
        rawH18: 0,
        rawH20: 0,
        rawH21: 0,
      }
    );

    const emgPowerTotal = agg.emgH18 + agg.emgH20 + agg.emgH21;
    const rawPowerTotal = agg.rawH18 + agg.rawH20 + agg.rawH21;

    // Rule 3: LDB
    const ldbBaseWays = agg.switchBoards + agg.h17Socket2x5a + agg.h19ComputerBoard;
    const ldbReqWays = applySpare(ldbBaseWays, sparePct);
    const ldbAlloc = allocateBoards(ldbReqWays, LDB_CAPACITIES);

    // Rule 4 & Rule 5: Emergency PDB
    // "A floor with a single LDB (and no emergency-marked 20A, 3x20A or AC loads) needs no PDB"
    const emgPdbSkippedSingleLdb = ldbAlloc.totalBoards === 1 && emgPowerTotal === 0;
    const emgPdbBaseWays =
      emgPdbSkippedSingleLdb || (ldbAlloc.totalBoards === 0 && emgPowerTotal === 0)
        ? 0
        : ldbAlloc.totalBoards + emgPowerTotal;
    const emgPdbReqWays = applySpare(emgPdbBaseWays, sparePct);
    const emgPdbAlloc = allocateBoards(emgPdbReqWays, PDB_CAPACITIES);

    // Rule 4a: Raw PDB
    const rawPdbBaseWays = rawPowerTotal;
    const rawPdbReqWays = applySpare(rawPdbBaseWays, sparePct);
    const rawPdbAlloc = allocateBoards(rawPdbReqWays, PDB_CAPACITIES);

    // Rule 5 & Rule 7: Emergency VTPNDB
    // "and a floor with a single PDB needs no VTPNDB."
    const emgVtpndbSkippedSinglePdb = emgPdbAlloc.totalBoards === 1;
    const emgVtpndbBaseTpWays = emgPdbAlloc.totalBoards > 1 ? emgPdbAlloc.totalBoards : 0;
    const emgVtpndbReqTpWays = applySpare(emgVtpndbBaseTpWays, sparePct);
    const emgVtpndbAlloc = allocateBoards(emgVtpndbReqTpWays, VTPNDB_CAPACITIES);

    // Rule 4a + Rule 5/6a + Rule 7: Raw VTPNDB
    const rawVtpndbSkippedSinglePdb = rawPdbAlloc.totalBoards === 1;
    const rawVtpndbBaseTpWays = rawPdbAlloc.totalBoards > 1 ? rawPdbAlloc.totalBoards : 0;
    const rawVtpndbReqTpWays = applySpare(rawVtpndbBaseTpWays, sparePct);
    const rawVtpndbAlloc = allocateBoards(rawVtpndbReqTpWays, VTPNDB_CAPACITIES);

    return {
      floorName,
      roomCount: floorRooms.length,
      ...agg,
      emgPowerTotal,
      rawPowerTotal,
      ldbBaseWays,
      ldbReqWays,
      ldbAlloc,
      emgPdbSkippedSingleLdb,
      emgPdbBaseWays,
      emgPdbReqWays,
      emgPdbAlloc,
      rawPdbBaseWays,
      rawPdbReqWays,
      rawPdbAlloc,
      emgVtpndbSkippedSinglePdb,
      emgVtpndbBaseTpWays,
      emgVtpndbReqTpWays,
      emgVtpndbAlloc,
      rawVtpndbSkippedSinglePdb,
      rawVtpndbBaseTpWays,
      rawVtpndbReqTpWays,
      rawVtpndbAlloc,
    };
  });

  // Rule 5 & Rule 4a Common Board Consolidation across floors
  const singleLdbFloorNames = floors
    .filter((f) => f.emgPdbSkippedSingleLdb)
    .map((f) => f.floorName);

  const commonEmgPdbBaseWays =
    singleLdbFloorNames.length > 1 ? singleLdbFloorNames.length : 0;
  const commonEmgPdbReqWays = applySpare(commonEmgPdbBaseWays, sparePct);
  const commonEmgPdbAlloc = allocateBoards(commonEmgPdbReqWays, PDB_CAPACITIES);

  const singleEmgPdbFloorNames = floors
    .filter((f) => f.emgVtpndbSkippedSinglePdb)
    .map((f) => f.floorName);

  // "one common VTPNDB (for those single PDBs, plus the common PDB)"
  const totalSingleEmgPdbsForCommon =
    singleEmgPdbFloorNames.length + commonEmgPdbAlloc.totalBoards;
  const commonEmgVtpndbBaseTpWays =
    totalSingleEmgPdbsForCommon > 1 ? totalSingleEmgPdbsForCommon : 0;
  const commonEmgVtpndbReqTpWays = applySpare(commonEmgVtpndbBaseTpWays, sparePct);
  const commonEmgVtpndbAlloc = allocateBoards(commonEmgVtpndbReqTpWays, VTPNDB_CAPACITIES);

  // Rule 4a / 6a: Common Raw VTPNDB if >1 floor has a single Raw PDB
  const singleRawPdbFloorNames = floors
    .filter((f) => f.rawVtpndbSkippedSinglePdb)
    .map((f) => f.floorName);

  const commonRawVtpndbBaseTpWays =
    singleRawPdbFloorNames.length > 1 ? singleRawPdbFloorNames.length : 0;
  const commonRawVtpndbReqTpWays = applySpare(commonRawVtpndbBaseTpWays, sparePct);
  const commonRawVtpndbAlloc = allocateBoards(commonRawVtpndbReqTpWays, VTPNDB_CAPACITIES);

  const common: CommonDbSummary = {
    singleLdbFloorNames,
    commonEmgPdbBaseWays,
    commonEmgPdbReqWays,
    commonEmgPdbAlloc,
    singleEmgPdbFloorNames,
    commonEmgVtpndbBaseTpWays,
    commonEmgVtpndbReqTpWays,
    commonEmgVtpndbAlloc,
    singleRawPdbFloorNames,
    commonRawVtpndbBaseTpWays,
    commonRawVtpndbReqTpWays,
    commonRawVtpndbAlloc,
  };

  const distributeEntryUsedSpare = (
    alloc: BoardAllocationResult,
    baseWays: number
  ): { usedWays: number; spareWays: number }[] => {
    const caps = alloc.items.map((item) => item.qty * item.option.ways);
    if (caps.length === 0) return [];
    const totalCap = caps.reduce((s, c) => s + c, 0);
    const clampedUsed = Math.min(totalCap, Math.max(0, baseWays));

    const usedPerEntry = caps.map((c) =>
      totalCap > 0 ? Math.min(c, Math.floor((clampedUsed * c) / totalCap)) : 0
    );
    let remaining = clampedUsed - usedPerEntry.reduce((s, u) => s + u, 0);
    let idx = 0;
    while (remaining > 0 && idx < caps.length * 4) {
      const i = idx % caps.length;
      if (usedPerEntry[i] < caps[i]) {
        usedPerEntry[i]++;
        remaining--;
      }
      idx++;
    }
    return caps.map((c, i) => ({
      usedWays: usedPerEntry[i],
      spareWays: Math.max(0, c - usedPerEntry[i]),
    }));
  };

  // Build flat Floor-wise & Common DB Categories Table Entries
  const tableEntries: FloorDbTableEntry[] = [];

  for (const f of floors) {
    if (f.switchBoards > 0) {
      const totalSbPts = f.switchBoards * ptsPerSb;
      const usedSbPts = Math.min(totalSbPts, f.pointsH05H15);
      const spareSbPts = Math.max(0, totalSbPts - usedSbPts);
      tableEntries.push({
        id: `${f.floorName}-sb`,
        scope: f.floorName,
        isCommon: false,
        category: 'Switch Board',
        incomingType: 'Room Sub-Circuit',
        sizeCode: `${ptsPerSb}-Point Module`,
        qty: f.switchBoards,
        baseWays: f.pointsH05H15,
        reqWaysWithSpare: f.pointsH05H15,
        providedWays: f.switchBoards,
        usedWays: usedSbPts,
        spareWays: spareSbPts,
        wayUnit: 'Boards',
        basisNote: `${f.pointsH05H15} pts (#H05–#H15) ÷ ${ptsPerSb} = ${f.switchBoards} SB (${usedSbPts} used / ${spareSbPts} spare pts)`,
      });
    }

    const ldbUsage = distributeEntryUsedSpare(f.ldbAlloc, f.ldbBaseWays);
    f.ldbAlloc.items.forEach((item, idx) => {
      const usage = ldbUsage[idx] || { usedWays: 0, spareWays: item.qty * item.option.ways };
      tableEntries.push({
        id: `${f.floorName}-ldb-${item.option.sizeCode}`,
        scope: f.floorName,
        isCommon: false,
        category: 'LDB',
        incomingType: item.option.incoming,
        sizeCode: item.option.sizeCode,
        qty: item.qty,
        baseWays: f.ldbBaseWays,
        reqWaysWithSpare: f.ldbReqWays,
        providedWays: item.qty * item.option.ways,
        usedWays: usage.usedWays,
        spareWays: usage.spareWays,
        wayUnit: 'SP Ways',
        basisNote: `${f.switchBoards} SB + ${f.h17Socket2x5a} (#H17) + ${f.h19ComputerBoard} (#H19) = ${f.ldbBaseWays} + ${sparePct}% spare = ${f.ldbReqWays} SP ways`,
      });
    });

    const emgPdbUsage = distributeEntryUsedSpare(f.emgPdbAlloc, f.emgPdbBaseWays);
    f.emgPdbAlloc.items.forEach((item, idx) => {
      const usage = emgPdbUsage[idx] || { usedWays: 0, spareWays: item.qty * item.option.ways };
      tableEntries.push({
        id: `${f.floorName}-emg-pdb-${item.option.sizeCode}`,
        scope: f.floorName,
        isCommon: false,
        category: 'Emergency PDB',
        incomingType: item.option.incoming,
        sizeCode: item.option.sizeCode,
        qty: item.qty,
        baseWays: f.emgPdbBaseWays,
        reqWaysWithSpare: f.emgPdbReqWays,
        providedWays: item.qty * item.option.ways,
        usedWays: usage.usedWays,
        spareWays: usage.spareWays,
        wayUnit: 'SP Ways',
        basisNote: `${f.ldbAlloc.totalBoards} LDB + ${f.emgH18} (#H18) + ${f.emgH20} (#H20) + ${f.emgH21} (#H21) Emg = ${f.emgPdbBaseWays} + ${sparePct}% spare = ${f.emgPdbReqWays} SP ways`,
      });
    });

    const rawPdbUsage = distributeEntryUsedSpare(f.rawPdbAlloc, f.rawPdbBaseWays);
    f.rawPdbAlloc.items.forEach((item, idx) => {
      const usage = rawPdbUsage[idx] || { usedWays: 0, spareWays: item.qty * item.option.ways };
      tableEntries.push({
        id: `${f.floorName}-raw-pdb-${item.option.sizeCode}`,
        scope: f.floorName,
        isCommon: false,
        category: 'Raw PDB',
        incomingType: item.option.incoming,
        sizeCode: item.option.sizeCode,
        qty: item.qty,
        baseWays: f.rawPdbBaseWays,
        reqWaysWithSpare: f.rawPdbReqWays,
        providedWays: item.qty * item.option.ways,
        usedWays: usage.usedWays,
        spareWays: usage.spareWays,
        wayUnit: 'SP Ways',
        basisNote: `${f.rawH18} (#H18) + ${f.rawH20} (#H20) + ${f.rawH21} (#H21) Raw = ${f.rawPdbBaseWays} + ${sparePct}% spare = ${f.rawPdbReqWays} SP ways`,
      });
    });

    const emgVtpnUsage = distributeEntryUsedSpare(f.emgVtpndbAlloc, f.emgVtpndbBaseTpWays);
    f.emgVtpndbAlloc.items.forEach((item, idx) => {
      const usage = emgVtpnUsage[idx] || { usedWays: 0, spareWays: item.qty * item.option.ways };
      tableEntries.push({
        id: `${f.floorName}-emg-vtpndb-${item.option.sizeCode}`,
        scope: f.floorName,
        isCommon: false,
        category: 'Emergency VTPNDB',
        incomingType: item.option.incoming,
        sizeCode: item.option.sizeCode,
        qty: item.qty,
        baseWays: f.emgVtpndbBaseTpWays,
        reqWaysWithSpare: f.emgVtpndbReqTpWays,
        providedWays: item.qty * item.option.ways,
        usedWays: usage.usedWays,
        spareWays: usage.spareWays,
        wayUnit: '3P Ways',
        basisNote: `${f.emgPdbAlloc.totalBoards} Emg PDB + ${sparePct}% spare = ${f.emgVtpndbReqTpWays} 3-pole ways`,
      });
    });

    const rawVtpnUsage = distributeEntryUsedSpare(f.rawVtpndbAlloc, f.rawVtpndbBaseTpWays);
    f.rawVtpndbAlloc.items.forEach((item, idx) => {
      const usage = rawVtpnUsage[idx] || { usedWays: 0, spareWays: item.qty * item.option.ways };
      tableEntries.push({
        id: `${f.floorName}-raw-vtpndb-${item.option.sizeCode}`,
        scope: f.floorName,
        isCommon: false,
        category: 'Raw VTPNDB',
        incomingType: item.option.incoming,
        sizeCode: item.option.sizeCode,
        qty: item.qty,
        baseWays: f.rawVtpndbBaseTpWays,
        reqWaysWithSpare: f.rawVtpndbReqTpWays,
        providedWays: item.qty * item.option.ways,
        usedWays: usage.usedWays,
        spareWays: usage.spareWays,
        wayUnit: '3P Ways',
        basisNote: `${f.rawPdbAlloc.totalBoards} Raw PDB + ${sparePct}% spare = ${f.rawVtpndbReqTpWays} 3-pole ways`,
      });
    });
  }

  // Add Common DB rows if triggered by Rule 5 / Rule 4a
  const commonEmgPdbUsage = distributeEntryUsedSpare(commonEmgPdbAlloc, commonEmgPdbBaseWays);
  commonEmgPdbAlloc.items.forEach((item, idx) => {
    const usage = commonEmgPdbUsage[idx] || { usedWays: 0, spareWays: item.qty * item.option.ways };
    tableEntries.push({
      id: `common-emg-pdb-${item.option.sizeCode}`,
      scope: 'Common (Consolidated Single-LDB Floors)',
      isCommon: true,
      category: 'Emergency PDB',
      incomingType: item.option.incoming,
      sizeCode: item.option.sizeCode,
      qty: item.qty,
      baseWays: commonEmgPdbBaseWays,
      reqWaysWithSpare: commonEmgPdbReqWays,
      providedWays: item.qty * item.option.ways,
      usedWays: usage.usedWays,
      spareWays: usage.spareWays,
      wayUnit: 'SP Ways',
      basisNote: `Rule 5: Feeds ${singleLdbFloorNames.length} single-LDB floors (${singleLdbFloorNames.join(', ')}) + ${sparePct}% spare`,
    });
  });

  const commonEmgVtpnUsage = distributeEntryUsedSpare(
    commonEmgVtpndbAlloc,
    commonEmgVtpndbBaseTpWays
  );
  commonEmgVtpndbAlloc.items.forEach((item, idx) => {
    const usage = commonEmgVtpnUsage[idx] || { usedWays: 0, spareWays: item.qty * item.option.ways };
    tableEntries.push({
      id: `common-emg-vtpndb-${item.option.sizeCode}`,
      scope: 'Common (Consolidated Single-PDB Floors)',
      isCommon: true,
      category: 'Emergency VTPNDB',
      incomingType: item.option.incoming,
      sizeCode: item.option.sizeCode,
      qty: item.qty,
      baseWays: commonEmgVtpndbBaseTpWays,
      reqWaysWithSpare: commonEmgVtpndbReqTpWays,
      providedWays: item.qty * item.option.ways,
      usedWays: usage.usedWays,
      spareWays: usage.spareWays,
      wayUnit: '3P Ways',
      basisNote: `Rule 5: Feeds ${singleEmgPdbFloorNames.length} single-PDB floor(s)${
        commonEmgPdbAlloc.totalBoards > 0 ? ` + ${commonEmgPdbAlloc.totalBoards} Common PDB` : ''
      } + ${sparePct}% spare`,
    });
  });

  const commonRawVtpnUsage = distributeEntryUsedSpare(
    commonRawVtpndbAlloc,
    commonRawVtpndbBaseTpWays
  );
  commonRawVtpndbAlloc.items.forEach((item, idx) => {
    const usage = commonRawVtpnUsage[idx] || { usedWays: 0, spareWays: item.qty * item.option.ways };
    tableEntries.push({
      id: `common-raw-vtpndb-${item.option.sizeCode}`,
      scope: 'Common (Consolidated Single-Raw-PDB Floors)',
      isCommon: true,
      category: 'Raw VTPNDB',
      incomingType: item.option.incoming,
      sizeCode: item.option.sizeCode,
      qty: item.qty,
      baseWays: commonRawVtpndbBaseTpWays,
      reqWaysWithSpare: commonRawVtpndbReqTpWays,
      providedWays: item.qty * item.option.ways,
      usedWays: usage.usedWays,
      spareWays: usage.spareWays,
      wayUnit: '3P Ways',
      basisNote: `Rule 4a/6a: Feeds ${singleRawPdbFloorNames.length} single-Raw-PDB floors (${singleRawPdbFloorNames.join(', ')}) + ${sparePct}% spare`,
    });
  });

  // BOQ-ready aggregated totals by DB Category + Size
  const boqMap = new Map<string, CategoryBoqTotal>();
  for (const entry of tableEntries) {
    const k = `${entry.category}__${entry.sizeCode}`;
    const existing = boqMap.get(k);
    if (existing) {
      existing.totalQty += entry.qty;
      existing.totalProvidedWays += entry.providedWays;
    } else {
      boqMap.set(k, {
        category: entry.category,
        incomingType: entry.incomingType,
        sizeCode: entry.sizeCode,
        totalQty: entry.qty,
        totalProvidedWays: entry.providedWays,
        wayUnit: entry.wayUnit,
      });
    }
  }

  const categoryOrder: DbCategoryType[] = [
    'Switch Board',
    'LDB',
    'Emergency PDB',
    'Raw PDB',
    'Emergency VTPNDB',
    'Raw VTPNDB',
  ];
  const boqTotals = Array.from(boqMap.values()).sort((a, b) => {
    const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.sizeCode.localeCompare(b.sizeCode, undefined, { numeric: true });
  });

  const grandTotals = {
    switchBoards: floors.reduce((s, f) => s + f.switchBoards, 0),
    ldb: floors.reduce((s, f) => s + f.ldbAlloc.totalBoards, 0),
    emgPdb:
      floors.reduce((s, f) => s + f.emgPdbAlloc.totalBoards, 0) +
      commonEmgPdbAlloc.totalBoards,
    rawPdb: floors.reduce((s, f) => s + f.rawPdbAlloc.totalBoards, 0),
    emgVtpndb:
      floors.reduce((s, f) => s + f.emgVtpndbAlloc.totalBoards, 0) +
      commonEmgVtpndbAlloc.totalBoards,
    rawVtpndb:
      floors.reduce((s, f) => s + f.rawVtpndbAlloc.totalBoards, 0) +
      commonRawVtpndbAlloc.totalBoards,
  };

  return {
    rooms,
    floors,
    common,
    tableEntries,
    boqTotals,
    grandTotals,
  };
}
