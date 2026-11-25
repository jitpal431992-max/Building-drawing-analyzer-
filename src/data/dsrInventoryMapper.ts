import { BOQItem, DSRMasterItem, InventoryRow } from '../types';
import {
  DEFAULT_MCBDB_SETTINGS,
  McbDbSettings,
  calculateMcbDbSchedule,
} from './mcbDbCalculator';

export type WiringSystemType = 'modular' | 'non-modular';
export type ConduitType = 'pvc' | 'steel';
export type PointGroupType = 'A' | 'B' | 'C';

export interface DsrMappingOptions {
  wiringType: WiringSystemType;
  conduitType: ConduitType;
  pointGroup: PointGroupType;
  includeFanRegulators: boolean;
  includeSwitchBoxes: boolean;
}

export const DEFAULT_DSR_MAPPING_OPTIONS: DsrMappingOptions = {
  wiringType: 'modular',
  conduitType: 'pvc',
  pointGroup: 'A',
  includeFanRegulators: true,
  includeSwitchBoxes: false,
};

export type SuggestionGroup = 'points' | 'inventory' | 'db';

export interface SuggestedDsrRow {
  id: string;
  group: SuggestionGroup;
  badgeCode: string;
  sourceLabel: string;
  sourceDetail: string;
  calculatedQty: number;
  defaultDsrCode: string;
  isSubItemDefault: boolean;
  resolvedDsrCode: string;
  parentCode: string;
  parentDescription: string;
  subItemName?: string;
  category: string;
  chapter: string;
  itemType: string;
  unit: string;
  rate: number;
  isSubItem: boolean;
  foundInCatalog: boolean;
  notes?: string;
}

export interface DsrMappingSummary {
  totalPoints: number;
  pointsBreakdown: {
    badgeId: string;
    label: string;
    qty: number;
  }[];
  totalInventoryUnits: number;
  totalDbBoards: number;
  totalSwitchBoards: number;
  mcbDbResult: ReturnType<typeof calculateMcbDbSchedule>;
  suggestions: SuggestedDsrRow[];
}

export const POINT_COLUMNS: {
  key: keyof InventoryRow;
  badgeId: string;
  label: string;
}[] = [
  { key: 'tube20w', badgeId: '#H05', label: '20W Tube Light (4ft)' },
  { key: 'tube40w', badgeId: '#H06', label: '40W Tube Light' },
  { key: 'surfaceLight36w', badgeId: '#H07', label: '36W Surface Light' },
  { key: 'recessLight20w', badgeId: '#H08', label: '20W Recess Light' },
  { key: 'recessLight36w', badgeId: '#H09', label: '36W Recess Light' },
  { key: 'ceilingFan1200', badgeId: '#H10', label: '1200mm Ceiling Fan' },
  { key: 'ceilingFan1400', badgeId: '#H11', label: '1400mm Ceiling Fan' },
  { key: 'wallFan400', badgeId: '#H12', label: '400mm Wall Fan' },
  { key: 'exhaustFan225', badgeId: '#H13', label: '225mm Exhaust Fan' },
  { key: 'exhaustFan300', badgeId: '#H14', label: '300mm Exhaust Fan' },
  { key: 'bulbPoint20w', badgeId: '#H15', label: '20W Bulb Point' },
];

function num(v?: string): number {
  const n = parseFloat(v || '0');
  return isNaN(n) || n < 0 ? 0 : n;
}

export interface ResolvedCatalogEntry {
  resolvedCode: string;
  parentCode: string;
  parentDescription: string;
  subItemName?: string;
  category: string;
  chapter: string;
  itemType: string;
  unit: string;
  rate: number;
  isSubItem: boolean;
  foundInCatalog: boolean;
}

export function resolveDsrCode(
  code: string,
  catalog: DSRMasterItem[]
): ResolvedCatalogEntry {
  for (const item of catalog) {
    if (item.isDeleted) continue;
    if (item.variants && item.variants.length > 0) {
      const matchedVariant = item.variants.find(
        (v) => !v.isDeleted && v.code === code
      );
      if (matchedVariant) {
        const rateNum = parseFloat(matchedVariant.rate);
        return {
          resolvedCode: matchedVariant.code,
          parentCode: item.c,
          parentDescription: item.d,
          subItemName: matchedVariant.name,
          category: item.g,
          chapter: item.h,
          itemType: item.t,
          unit: matchedVariant.unit || 'Each',
          rate: isNaN(rateNum) ? 0 : rateNum,
          isSubItem: true,
          foundInCatalog: true,
        };
      }
    }
    if (item.c === code) {
      const rateNum = item.r ? parseFloat(item.r) : 0;
      return {
        resolvedCode: item.c,
        parentCode: item.c,
        parentDescription: item.d,
        subItemName: undefined,
        category: item.g,
        chapter: item.h,
        itemType: item.t,
        unit: item.u || 'Each',
        rate: isNaN(rateNum) ? 0 : rateNum,
        isSubItem: false,
        foundInCatalog: true,
      };
    }
  }

  return {
    resolvedCode: code,
    parentCode: code,
    parentDescription: `DSR Item ${code} (Not found in active catalog — pick replacement)`,
    subItemName: undefined,
    category: 'Unmatched',
    chapter: '',
    itemType: '',
    unit: 'Each',
    rate: 0,
    isSubItem: false,
    foundInCatalog: false,
  };
}

export function getPointWiringDsrCode(options: DsrMappingOptions): string {
  const baseCode =
    options.wiringType === 'modular'
      ? options.conduitType === 'steel'
        ? '1.3'
        : '1.10'
      : options.conduitType === 'steel'
      ? '1.1'
      : '1.8';
  const groupIdx = options.pointGroup === 'A' ? '1' : options.pointGroup === 'B' ? '2' : '3';
  return `${baseCode}.${groupIdx}`;
}

function getAcDsrCodeForTonnage(tonnage: number): { code: string; bucketLabel: string } {
  if (tonnage <= 0.85) {
    return { code: '32.2.1', bucketLabel: '0.75 TR Split AC' };
  }
  if (tonnage <= 1.25) {
    return { code: '32.2.2', bucketLabel: '1.0 TR Split AC' };
  }
  if (tonnage <= 1.75) {
    return { code: '32.2.3', bucketLabel: '1.5 TR Split AC' };
  }
  return { code: '32.2.4', bucketLabel: '2.0 TR Split AC' };
}

function getDbDsrCode(category: string, sizeCode: string): string {
  if (category === 'LDB') {
    if (sizeCode.includes('2+4')) return '2.3.1';
    if (sizeCode.includes('2+6')) return '2.3.2';
    if (sizeCode.includes('2+10')) return '2.3.3';
    return '2.3.4';
  }
  if (category === 'Emergency PDB' || category === 'Raw PDB') {
    if (sizeCode.includes('4+12')) return '2.4.1';
    if (sizeCode.includes('4+18')) return '2.4.2';
    return '2.4.3';
  }
  if (category === 'Emergency VTPNDB' || category === 'Raw VTPNDB') {
    if (sizeCode.includes('4+12')) return '2.5.1';
    if (sizeCode.includes('4+24')) return '2.5.2';
    return '2.5.3';
  }
  return '2.3.1';
}

export function buildDsrSuggestions(
  rows: InventoryRow[],
  catalog: DSRMasterItem[],
  options: DsrMappingOptions,
  mcbSettings: McbDbSettings = DEFAULT_MCBDB_SETTINGS,
  overrides: Record<string, string> = {}
): DsrMappingSummary {
  const mcbDbResult = calculateMcbDbSchedule(rows, mcbSettings);

  // 1. Sum all inventory columns
  const columnSums: Record<string, number> = {};
  for (const r of rows) {
    for (const col of POINT_COLUMNS) {
      columnSums[col.key] = (columnSums[col.key] || 0) + num(r[col.key] as string);
    }
    columnSums.socket5aOnBoard = (columnSums.socket5aOnBoard || 0) + num(r.socket5aOnBoard);
    columnSums.socket2x5a = (columnSums.socket2x5a || 0) + num(r.socket2x5a);
    columnSums.socket20a = (columnSums.socket20a || 0) + num(r.socket20a);
    columnSums.computerBoard = (columnSums.computerBoard || 0) + num(r.computerBoard);
    columnSums.socket3x20a = (columnSums.socket3x20a || 0) + num(r.socket3x20a);
    columnSums.noOfAc = (columnSums.noOfAc || 0) + num(r.noOfAc);
  }

  const pointsBreakdown = POINT_COLUMNS.map((c) => ({
    badgeId: c.badgeId,
    label: c.label,
    qty: columnSums[c.key] || 0,
  }));
  const totalPoints = pointsBreakdown.reduce((s, p) => s + p.qty, 0);

  const suggestions: SuggestedDsrRow[] = [];

  const pushSuggestion = (params: {
    id: string;
    group: SuggestionGroup;
    badgeCode: string;
    sourceLabel: string;
    sourceDetail: string;
    calculatedQty: number;
    defaultDsrCode: string;
    notes?: string;
  }) => {
    const activeCode = overrides[params.id] || params.defaultDsrCode;
    const resolved = resolveDsrCode(activeCode, catalog);
    suggestions.push({
      id: params.id,
      group: params.group,
      badgeCode: params.badgeCode,
      sourceLabel: params.sourceLabel,
      sourceDetail: params.sourceDetail,
      calculatedQty: params.calculatedQty,
      defaultDsrCode: params.defaultDsrCode,
      isSubItemDefault: params.defaultDsrCode.split('.').length >= 3,
      resolvedDsrCode: resolved.resolvedCode,
      parentCode: resolved.parentCode,
      parentDescription: resolved.parentDescription,
      subItemName: resolved.subItemName,
      category: resolved.category,
      chapter: resolved.chapter,
      itemType: resolved.itemType,
      unit: resolved.unit,
      rate: resolved.rate,
      isSubItem: resolved.isSubItem,
      foundInCatalog: resolved.foundInCatalog,
      notes: params.notes,
    });
  };

  // A. Total Points (#H05-#H15) -> Modular vs Non-Modular Point Wiring
  const pointWiringCode = getPointWiringDsrCode(options);
  pushSuggestion({
    id: 'total-points',
    group: 'points',
    badgeCode: '#H05–#H15',
    sourceLabel: `Total Point Wiring (${options.wiringType === 'modular' ? 'Modular' : 'Non-Modular / Piano'})`,
    sourceDetail: `${options.conduitType === 'pvc' ? 'PVC' : 'Steel'} Conduit · Group ${options.pointGroup} · Sum of #H05–#H15`,
    calculatedQty: totalPoints,
    defaultDsrCode: pointWiringCode,
    notes: `${options.wiringType === 'modular' ? 'Modular' : 'Non-Modular'} point wiring (${totalPoints} points across #H05–#H15)`,
  });

  // Optional Modular Electronic Fan Regulators when Modular + Ceiling Fans > 0
  const totalCeilingFans = (columnSums.ceilingFan1200 || 0) + (columnSums.ceilingFan1400 || 0);
  if (options.includeFanRegulators && options.wiringType === 'modular' && totalCeilingFans > 0) {
    pushSuggestion({
      id: 'fan-regulators',
      group: 'points',
      badgeCode: '#H10+#H11',
      sourceLabel: 'Modular Electronic Fan Regulators',
      sourceDetail: 'For 1200mm + 1400mm Ceiling Fans (2-module stepped regulator)',
      calculatedQty: totalCeilingFans,
      defaultDsrCode: '1.25',
      notes: 'Stepped electronic regulator for ceiling fans',
    });
  }

  // B. All Inventory Items (#H05 - #H22)
  const inventoryCatalogDefaults: {
    id: string;
    badgeCode: string;
    label: string;
    detail: string;
    qty: number;
    defaultCode: string;
    note?: string;
  }[] = [
    {
      id: 'inv-tube20w',
      badgeCode: '#H05',
      label: '20W Tube Light Fitting (4ft)',
      detail: 'Supplying, Installation, Testing & Commissioning of 18–22W LED Batten',
      qty: columnSums.tube20w || 0,
      defaultCode: '8.9.1',
    },
    {
      id: 'inv-tube40w',
      badgeCode: '#H06',
      label: '40W Tube Light Fitting',
      detail: 'Supplying, Installation, Testing & Commissioning of 40W LED Batten',
      qty: columnSums.tube40w || 0,
      defaultCode: '8.9.4',
    },
    {
      id: 'inv-surface36w',
      badgeCode: '#H07',
      label: '36W Surface LED Light',
      detail: 'Supplying, Installation, Testing & Commissioning of 2x2 ft 36W LED Panel',
      qty: columnSums.surfaceLight36w || 0,
      defaultCode: '8.6.4',
    },
    {
      id: 'inv-recess20w',
      badgeCode: '#H08',
      label: '20W Recess LED Light',
      detail: 'Supplying, Installation, Testing & Commissioning of 22W LED SMD Downlighter',
      qty: columnSums.recessLight20w || 0,
      defaultCode: '8.1.5',
    },
    {
      id: 'inv-recess36w',
      badgeCode: '#H09',
      label: '36W Recess LED Light',
      detail: 'Supplying, Installation, Testing & Commissioning of 36W Recess LED Panel',
      qty: columnSums.recessLight36w || 0,
      defaultCode: '8.6.10',
    },
    {
      id: 'inv-fan1200',
      badgeCode: '#H10',
      label: '1200mm Ceiling Fan',
      detail: 'SITC of 1200mm BLDC Ceiling Fan (or swap to 1.44 ITC only)',
      qty: columnSums.ceilingFan1200 || 0,
      defaultCode: '9.2.3',
    },
    {
      id: 'inv-fan1400',
      badgeCode: '#H11',
      label: '1400mm Ceiling Fan',
      detail: 'SITC of 1400mm BLDC Ceiling Fan (or swap to 1.44 ITC only)',
      qty: columnSums.ceilingFan1400 || 0,
      defaultCode: '9.2.4',
    },
    {
      id: 'inv-wallfan400',
      badgeCode: '#H12',
      label: '400mm Wall Fan (ITC)',
      detail: 'Installation, Testing & Commissioning of wall bracket / fan fitting',
      qty: columnSums.wallFan400 || 0,
      defaultCode: '1.35',
    },
    {
      id: 'inv-exhaust225',
      badgeCode: '#H13',
      label: '225mm Exhaust Fan (ITC)',
      detail: 'Installation, Testing & Commissioning of Exhaust Fan up to 450mm sweep',
      qty: columnSums.exhaustFan225 || 0,
      defaultCode: '1.50.1',
    },
    {
      id: 'inv-exhaust300',
      badgeCode: '#H14',
      label: '300mm Exhaust Fan (ITC)',
      detail: 'Installation, Testing & Commissioning of Exhaust Fan up to 450mm sweep',
      qty: columnSums.exhaustFan300 || 0,
      defaultCode: '1.50.1',
    },
    {
      id: 'inv-bulb20w',
      badgeCode: '#H15',
      label: '20W Bulb Point Fitting',
      detail: 'Installation & Commissioning of wall/ceiling lamp holder/fitting',
      qty: columnSums.bulbPoint20w || 0,
      defaultCode: '1.35',
    },
    {
      id: 'inv-socket5a',
      badgeCode: '#H16',
      label: `5A Socket on Switch Board (${options.wiringType === 'modular' ? 'Modular' : 'Piano'})`,
      detail: options.wiringType === 'modular' ? 'Modular 3-pin 5/6A socket outlet' : 'Piano 3-pin 5/6A socket outlet',
      qty: columnSums.socket5aOnBoard || 0,
      defaultCode: options.wiringType === 'modular' ? '1.24.4' : '1.23.4',
    },
    {
      id: 'inv-socket2x5a',
      badgeCode: '#H17',
      label: `2×5A Socket Point (${options.wiringType === 'modular' ? 'Modular' : 'Piano'})`,
      detail:
        options.wiringType === 'modular'
          ? 'GI box + modular plate with 2 nos. 3-pin 5/6A socket & switch'
          : 'Metal box + 2 nos. 5/6A piano switch & socket',
      qty: columnSums.socket2x5a || 0,
      defaultCode: options.wiringType === 'modular' ? '1.56' : '1.29',
    },
    {
      id: 'inv-socket20a',
      badgeCode: '#H18',
      label: `20A Power Socket (${options.wiringType === 'modular' ? 'Modular' : 'Piano'})`,
      detail:
        options.wiringType === 'modular'
          ? 'GI box + modular plate with 25A modular socket & SP MCB'
          : 'Metal box + 15/16A piano switch & 6-pin socket',
      qty: columnSums.socket20a || 0,
      defaultCode: options.wiringType === 'modular' ? '1.57' : '1.30',
    },
    {
      id: 'inv-compboard',
      badgeCode: '#H19',
      label: `Computer Board (${options.wiringType === 'modular' ? 'Modular' : 'Piano'})`,
      detail:
        options.wiringType === 'modular'
          ? 'GI box + modular plate with dual 5/6A sockets & switch'
          : 'Metal box + piano sockets for workstation',
      qty: columnSums.computerBoard || 0,
      defaultCode: options.wiringType === 'modular' ? '1.56' : '1.29',
    },
    {
      id: 'inv-socket3x20a',
      badgeCode: '#H20',
      label: `3×20A Power Socket (${options.wiringType === 'modular' ? 'Modular' : 'Piano'})`,
      detail:
        options.wiringType === 'modular'
          ? '20A 240V SPN industrial socket outlet with MCB (or modular 25A)'
          : '15/16A 6-pin heavy power outlet box',
      qty: columnSums.socket3x20a || 0,
      defaultCode: options.wiringType === 'modular' ? '2.18' : '1.30',
    },
  ];

  for (const item of inventoryCatalogDefaults) {
    pushSuggestion({
      id: item.id,
      group: 'inventory',
      badgeCode: item.badgeCode,
      sourceLabel: item.label,
      sourceDetail: item.detail,
      calculatedQty: item.qty,
      defaultDsrCode: item.defaultCode,
      notes: item.note,
    });
  }

  // AC Units grouped by Tonnage (#H21 & #H22)
  const acBuckets = new Map<string, { code: string; bucketLabel: string; count: number; tonDetails: string[] }>();
  for (const r of rows) {
    const acQty = num(r.noOfAc);
    if (acQty <= 0) continue;
    const ton = num(r.tonnage) > 0 ? num(r.tonnage) : 1.5;
    const { code, bucketLabel } = getAcDsrCodeForTonnage(ton);
    const existing = acBuckets.get(code);
    if (existing) {
      existing.count += acQty;
      existing.tonDetails.push(`${acQty}×${ton}TR`);
    } else {
      acBuckets.set(code, {
        code,
        bucketLabel,
        count: acQty,
        tonDetails: [`${acQty}×${ton}TR`],
      });
    }
  }

  if (acBuckets.size === 0) {
    pushSuggestion({
      id: 'inv-ac-none',
      group: 'inventory',
      badgeCode: '#H21/#H22',
      sourceLabel: 'Air Conditioner Units (1.5 TR Split AC)',
      sourceDetail: 'No AC units entered in Inventory yet',
      calculatedQty: 0,
      defaultDsrCode: '32.2.3',
    });
  } else {
    Array.from(acBuckets.values()).forEach((bucket) => {
      pushSuggestion({
        id: `inv-ac-${bucket.code}`,
        group: 'inventory',
        badgeCode: '#H21/#H22',
        sourceLabel: `Air Conditioner · ${bucket.bucketLabel}`,
        sourceDetail: `Grouped from #H21/#H22 (${bucket.tonDetails.join(', ')})`,
        calculatedQty: bucket.count,
        defaultDsrCode: bucket.code,
        notes: `${bucket.bucketLabel} (${bucket.tonDetails.join(', ')})`,
      });
    });
  }

  // C. Distribution Boards & Switch Boards from MCBDB Schedule
  if (mcbDbResult.grandTotals.switchBoards > 0 || options.includeSwitchBoxes) {
    pushSuggestion({
      id: 'db-switchboards',
      group: 'db',
      badgeCode: 'SB',
      sourceLabel: `Room Switch Boards (${options.wiringType === 'modular' ? 'Modular GI Box' : 'Metal Box'})`,
      sourceDetail: `Calculated from Rule 1: ${mcbDbResult.grandTotals.switchBoards} switch boards across rooms`,
      calculatedQty: mcbDbResult.grandTotals.switchBoards,
      defaultDsrCode: options.wiringType === 'modular' ? '1.31' : '1.29',
      notes: 'Switch board enclosure / plate (verify if separate from point wiring)',
    });
  }

  for (const db of mcbDbResult.boqTotals) {
    const dbCode = getDbDsrCode(db.category, db.sizeCode);
    const idSlug = `db-${db.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${db.sizeCode
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}`;
    pushSuggestion({
      id: idSlug,
      group: 'db',
      badgeCode: db.category.includes('VTPNDB')
        ? 'VTPNDB'
        : db.category.includes('PDB')
        ? 'PDB'
        : 'LDB',
      sourceLabel: `${db.category} · ${db.sizeCode}`,
      sourceDetail: `Incoming: ${db.incomingType} · MCBDB Floor Schedule Total`,
      calculatedQty: db.totalQty,
      defaultDsrCode: dbCode,
      notes: `${db.category} (${db.sizeCode}, ${db.incomingType})`,
    });
  }

  const totalInventoryUnits = suggestions
    .filter((s) => s.group === 'inventory')
    .reduce((sum, s) => sum + s.calculatedQty, 0);

  const totalDbBoards = mcbDbResult.boqTotals.reduce((sum, b) => sum + b.totalQty, 0);

  return {
    totalPoints,
    pointsBreakdown,
    totalInventoryUnits,
    totalDbBoards,
    totalSwitchBoards: mcbDbResult.grandTotals.switchBoards,
    mcbDbResult,
    suggestions,
  };
}

export interface ApprovedSuggestionInput {
  row: SuggestedDsrRow;
  qty: number;
}

/**
 * Merges / upserts approved DSR suggestion rows into BOQItem[].
 * Aggregates quantities if multiple approved rows resolve to the same DSR itemCode (e.g., Emg PDB 4+12 + Raw PDB 4+12 -> 2.4.1).
 */
export function buildBoqItemsFromApproved(
  approvedRows: ApprovedSuggestionInput[],
  catalog: DSRMasterItem[]
): BOQItem[] {
  const aggregated = new Map<
    string,
    {
      itemCode: string;
      qty: number;
      sources: string[];
    }
  >();

  for (const { row, qty } of approvedRows) {
    if (qty <= 0 || !row.foundInCatalog) continue;
    const code = row.resolvedDsrCode;
    const existing = aggregated.get(code);
    const labelWithQty = `${row.sourceLabel} (${qty})`;
    if (existing) {
      existing.qty += qty;
      existing.sources.push(labelWithQty);
    } else {
      aggregated.set(code, {
        itemCode: code,
        qty,
        sources: [labelWithQty],
      });
    }
  }

  const result: BOQItem[] = [];
  for (const entry of aggregated.values()) {
    const resolved = resolveDsrCode(entry.itemCode, catalog);
    if (!resolved.foundInCatalog) continue;
    const desc = resolved.isSubItem && resolved.subItemName
      ? `${resolved.parentDescription} — Sub-item: ${resolved.subItemName}`
      : resolved.parentDescription;

    result.push({
      id: `boq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      itemCode: resolved.resolvedCode,
      parentCode: resolved.parentCode,
      parentDescription: resolved.parentDescription,
      subItemName: resolved.subItemName,
      description: desc,
      fullSpecification: resolved.parentDescription,
      category: resolved.category,
      chapter: resolved.chapter,
      itemType: resolved.itemType,
      unit: resolved.unit,
      rate: resolved.rate,
      quantity: entry.qty,
      lineTotal: entry.qty * resolved.rate,
      isSubItem: resolved.isSubItem,
      notes: `From Inventory/MCBDB: ${entry.sources.join(' + ')}`,
    });
  }

  return result;
}

export interface SearchableCatalogChoice {
  code: string;
  parentCode: string;
  label: string;
  subName?: string;
  unit: string;
  rate: number;
  category: string;
  searchBlob: string;
}

export function flattenCatalogForPicker(catalog: DSRMasterItem[]): SearchableCatalogChoice[] {
  const out: SearchableCatalogChoice[] = [];
  for (const item of catalog) {
    if (item.isDeleted) continue;
    if (item.variants && item.variants.length > 0) {
      for (const v of item.variants) {
        if (v.isDeleted) continue;
        const rateNum = parseFloat(v.rate);
        out.push({
          code: v.code,
          parentCode: item.c,
          label: item.d,
          subName: v.name,
          unit: v.unit || 'Each',
          rate: isNaN(rateNum) ? 0 : rateNum,
          category: item.g,
          searchBlob: `${v.code} ${item.c} ${v.name} ${item.d} ${item.g} ${item.h} ${item.t}`.toLowerCase(),
        });
      }
    } else if (item.r) {
      const rateNum = parseFloat(item.r);
      out.push({
        code: item.c,
        parentCode: item.c,
        label: item.d,
        subName: undefined,
        unit: item.u || 'Each',
        rate: isNaN(rateNum) ? 0 : rateNum,
        category: item.g,
        searchBlob: `${item.c} ${item.d} ${item.g} ${item.h} ${item.t}`.toLowerCase(),
      });
    }
  }
  return out;
}
