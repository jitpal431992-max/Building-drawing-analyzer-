import { InventoryRow, RawEmergencyColumnKey } from '../types';

export const FLOOR_OPTIONS: string[] = [
  'Basement-2',
  'Basement-1',
  'Stilt / Parking',
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  '4th Floor',
  '5th Floor',
  '6th Floor',
  '7th Floor',
  '8th Floor',
  '9th Floor',
  '10th Floor',
  'Terrace / Roof',
];

export type LoadCategoryGroup = 'connected' | 'socket_5a' | 'raw_emergency';

export interface WattageTableEntry {
  badgeId: string;
  fieldKey: keyof Omit<
    InventoryRow,
    | 'id'
    | 'floor'
    | 'room'
    | 'luxCategoryId'
    | 'targetLux'
    | 'acRequired'
    | 'ventType'
    | 'ceilingHeightFt'
    | 'occupants'
    | 'exposureType'
    | 'powerSources'
    | 'sqmt'
    | 'sqft'
    | 'tonnage'
  >;
  itemLabel: string;
  pdfReferenceNote?: string;
  defaultWattage: number;
  group: LoadCategoryGroup;
}

/**
 * Standard Wattage Table mapped from Wattage_table.pdf to Inventory Columns #H05 - #H21.
 * - #H05 - #H15: Connected Load (Lights, Fans, Exhaust, Bulb Point) * Diversity Factor 0.7
 * - #H16: 5A on board (100W) — optional connected load toggle
 * - #H17 - #H21: Raw & Emergency Power/AC Load * Diversity Factor (0.5 - 0.7)
 */
export const DEFAULT_WATTAGE_TABLE: WattageTableEntry[] = [
  { badgeId: 'H05', fieldKey: 'tube20w', itemLabel: '20W tube', defaultWattage: 20, group: 'connected' },
  { badgeId: 'H06', fieldKey: 'tube40w', itemLabel: '40W tube', defaultWattage: 40, group: 'connected' },
  { badgeId: 'H07', fieldKey: 'surfaceLight36w', itemLabel: '36W surface light', defaultWattage: 36, group: 'connected' },
  { badgeId: 'H08', fieldKey: 'recessLight20w', itemLabel: '20W recess light', defaultWattage: 20, group: 'connected' },
  { badgeId: 'H09', fieldKey: 'recessLight36w', itemLabel: '36W recess light', defaultWattage: 36, group: 'connected' },
  { badgeId: 'H10', fieldKey: 'ceilingFan1200', itemLabel: '1200 mm ceiling fan', defaultWattage: 45, group: 'connected' },
  { badgeId: 'H11', fieldKey: 'ceilingFan1400', itemLabel: '1400 mm Ceiling fan', defaultWattage: 55, group: 'connected' },
  { badgeId: 'H12', fieldKey: 'wallFan400', itemLabel: '400mm Wall fan', defaultWattage: 70, group: 'connected' },
  { badgeId: 'H13', fieldKey: 'exhaustFan225', itemLabel: '225 mm Exhaust Fan', defaultWattage: 80, group: 'connected' },
  { badgeId: 'H14', fieldKey: 'exhaustFan300', itemLabel: '300 mm Exhaust Fan', defaultWattage: 110, group: 'connected' },
  {
    badgeId: 'H15',
    fieldKey: 'bulbPoint20w',
    itemLabel: '20W Bulb point',
    pdfReferenceNote: 'PDF lists 10W Bulb point (10W)',
    defaultWattage: 10,
    group: 'connected',
  },
  { badgeId: 'H16', fieldKey: 'socket5aOnBoard', itemLabel: '5A on board', defaultWattage: 100, group: 'socket_5a' },
  { badgeId: 'H17', fieldKey: 'socket2x5a', itemLabel: '2x5a', defaultWattage: 200, group: 'raw_emergency' },
  { badgeId: 'H18', fieldKey: 'socket20a', itemLabel: '20A', defaultWattage: 500, group: 'raw_emergency' },
  { badgeId: 'H19', fieldKey: 'computerBoard', itemLabel: 'computer board', defaultWattage: 500, group: 'raw_emergency' },
  { badgeId: 'H20', fieldKey: 'socket3x20a', itemLabel: '3x20A', defaultWattage: 1500, group: 'raw_emergency' },
  {
    badgeId: 'H21',
    fieldKey: 'noOfAc',
    itemLabel: 'AC (#H22 Tonnage × 1500 W/ton × #H21)',
    pdfReferenceNote: 'Formula: #H22 (Tonnage) × 1500 W/ton × #H21 (No. of AC)',
    defaultWattage: 1500,
    group: 'raw_emergency',
  },
];

export interface BuildingLoadSettings {
  connectedDiversityFactor: number; // #H05 - #H15 (default 0.7)
  rawDiversityFactor: number; // #H17 - #H21 Raw (range 0.5 - 0.7, default 0.5)
  emergencyDiversityFactor: number; // #H17 - #H21 Emergency (range 0.5 - 0.7, default 0.7)
  includeH16InConnected: boolean; // Whether #H16 5A on board (100W) joins Connected Load
  powerFactor: number; // Default 0.85 for kVA conversion
  wattageOverrides: Record<string, number>; // badgeId -> watts
}

export const DEFAULT_BUILDING_LOAD_SETTINGS: BuildingLoadSettings = {
  connectedDiversityFactor: 0.7,
  rawDiversityFactor: 0.5,
  emergencyDiversityFactor: 0.7,
  includeH16InConnected: false,
  powerFactor: 0.85,
  wattageOverrides: {},
};

export function getEntryWattage(entry: WattageTableEntry, settings: BuildingLoadSettings): number {
  const override = settings.wattageOverrides[entry.badgeId];
  return typeof override === 'number' && !isNaN(override) && override >= 0
    ? override
    : entry.defaultWattage;
}

function nQty(val?: string): number {
  if (!val) return 0;
  const parsed = parseFloat(val);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

export interface RoomLoadCalc {
  rowId: string;
  floor: string;
  room: string;
  areaSqm: number;
  connectedWattsH05H15: number;
  connectedWattsH16: number;
  connectedWattsTotal: number;
  connectedDemandWatts: number;
  rawWattsH17H21: number;
  rawDemandWatts: number;
  emergencyWattsH17H21: number;
  emergencyDemandWatts: number;
  totalEmergencyDemandWatts: number; // Connected Load * DF + Emergency Load * DF
  totalRawDemandWatts: number; // Raw Load * DF
  totalConnectedWatts: number;
  totalDemandWatts: number; // Total Emergency Load + Total Raw Load
  acQty: number;
  acTonnagePerUnit: number;
  acWatts: number;
  tonnageRaw: number;
  tonnageEmergency: number;
}

export function computeRoomBuildingLoad(
  row: InventoryRow,
  settings: BuildingLoadSettings
): RoomLoadCalc {
  const sqmtRaw = nQty(row.sqmt);
  const sqftRaw = nQty(row.sqft);
  const areaSqm = sqmtRaw > 0 ? sqmtRaw : sqftRaw > 0 ? sqftRaw / 10.7639104 : 0;

  let connectedWattsH05H15 = 0;
  let connectedWattsH16 = 0;
  let rawWattsH17H21 = 0;
  let emergencyWattsH17H21 = 0;
  let acWatts = 0;

  const acQty = nQty(row.noOfAc);
  const acTonnagePerUnit = nQty(row.tonnage);

  for (const entry of DEFAULT_WATTAGE_TABLE) {
    const qty = nQty(row[entry.fieldKey]);
    if (qty <= 0) continue;

    const unitWattage = getEntryWattage(entry, settings);
    // AC Load (#H21 & #H22): #H22 (Tonnage) * 1500/ton * #H21 (No. of AC)
    const watts =
      entry.fieldKey === 'noOfAc' ? acTonnagePerUnit * unitWattage * qty : qty * unitWattage;

    if (entry.fieldKey === 'noOfAc') {
      acWatts = watts;
    }

    if (entry.group === 'connected') {
      connectedWattsH05H15 += watts;
    } else if (entry.group === 'socket_5a') {
      connectedWattsH16 += watts;
    } else if (entry.group === 'raw_emergency') {
      const key = entry.fieldKey as RawEmergencyColumnKey;
      const mode = row.powerSources?.[key] === 'emergency' ? 'emergency' : 'raw';
      if (mode === 'emergency') {
        emergencyWattsH17H21 += watts;
      } else {
        rawWattsH17H21 += watts;
      }
    }
  }

  const connectedWattsTotal =
    connectedWattsH05H15 + (settings.includeH16InConnected ? connectedWattsH16 : 0);
  const connectedDemandWatts = connectedWattsTotal * settings.connectedDiversityFactor;
  const rawDemandWatts = rawWattsH17H21 * settings.rawDiversityFactor;
  const emergencyDemandWatts = emergencyWattsH17H21 * settings.emergencyDiversityFactor;

  const totalEmergencyDemandWatts = connectedDemandWatts + emergencyDemandWatts;
  const totalRawDemandWatts = rawDemandWatts;
  const totalConnectedWatts = connectedWattsTotal + rawWattsH17H21 + emergencyWattsH17H21;
  const totalDemandWatts = totalEmergencyDemandWatts + totalRawDemandWatts;

  const totalRoomTr = acTonnagePerUnit * acQty;
  const isAcEmg = row.powerSources?.noOfAc === 'emergency';

  return {
    rowId: row.id,
    floor: row.floor || 'Ground Floor',
    room: row.room || 'Unnamed Room',
    areaSqm,
    connectedWattsH05H15,
    connectedWattsH16,
    connectedWattsTotal,
    connectedDemandWatts,
    rawWattsH17H21,
    rawDemandWatts,
    emergencyWattsH17H21,
    emergencyDemandWatts,
    totalEmergencyDemandWatts,
    totalRawDemandWatts,
    totalConnectedWatts,
    totalDemandWatts,
    acQty,
    acTonnagePerUnit,
    acWatts,
    tonnageRaw: isAcEmg ? 0 : totalRoomTr,
    tonnageEmergency: isAcEmg ? totalRoomTr : 0,
  };
}
