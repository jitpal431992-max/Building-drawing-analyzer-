import { CoolingExposureType, InventoryRow, VentilationRoomType } from '../types';
import { getLuxReferenceById, resolveLuxReferenceId } from './luxLevels';

export interface HvacDesignSettings {
  defaultHeightFt: number;
  generalAch: number;
  toiletAch: number;
  kitchenLabAch: number;
  maxAreaPer1200FanSqm: number;
  maxAreaPer1400FanSqm: number;
  cfm225Exhaust: number;
  cfm300Exhaust: number;
  keepFansInAcRoom: boolean;
  btuPerPerson: number;
  wattsPerComputerBoard: number;
  safetyFactorPct: number;
  preferredAcUnitTr: number; // 0 = Auto optimal split/cassette sizing
}

export const DEFAULT_HVAC_SETTINGS: HvacDesignSettings = {
  defaultHeightFt: 10, // ~3.05 m standard ceiling height
  generalAch: 6, // 6 air changes/hour for offices & general rooms
  toiletAch: 12, // 12 air changes/hour per CPWD / NBC / ASHRAE for toilets
  kitchenLabAch: 15, // 15 air changes/hour for kitchens, pantries & labs
  maxAreaPer1200FanSqm: 14, // ~150 sq.ft coverage per 1200mm ceiling fan
  maxAreaPer1400FanSqm: 20, // ~215 sq.ft coverage per 1400mm ceiling fan
  cfm225Exhaust: 350, // 225 mm exhaust fan (~600 CMH / 350 CFM)
  cfm300Exhaust: 650, // 300 mm exhaust fan (~1100 CMH / 650 CFM)
  keepFansInAcRoom: true,
  btuPerPerson: 450, // 250 sensible + 200 latent BTU/hr per person
  wattsPerComputerBoard: 250, // PC / workstation heat dissipation
  safetyFactorPct: 10,
  preferredAcUnitTr: 0, // Auto
};

export interface ExposurePreset {
  id: CoolingExposureType;
  label: string;
  shortLabel: string;
  btuPerSqft: number;
  notes: string;
}

export const EXPOSURE_PRESETS: ExposurePreset[] = [
  {
    id: 'normal',
    label: 'Standard / Mid-Floor Interior (24 BTU/sq.ft)',
    shortLabel: 'Mid-Floor (24 BTU/sf)',
    btuPerSqft: 24,
    notes: 'Shaded walls, intermediate floor, standard window glazing',
  },
  {
    id: 'sunny',
    label: 'Top Floor / Direct Sun / West Glass (32 BTU/sq.ft)',
    shortLabel: 'Top/Sunny (32 BTU/sf)',
    btuPerSqft: 32,
    notes: 'Exposed roof slab or heavy solar glass facade',
  },
  {
    id: 'high-load',
    label: 'Conference / Classroom / Dense Hall (36 BTU/sq.ft)',
    shortLabel: 'Dense/Conf (36 BTU/sf)',
    btuPerSqft: 36,
    notes: 'Higher fresh-air intake & frequent door opening',
  },
  {
    id: 'server-ot',
    label: 'Server Room / Hospital OT / Lab (45 BTU/sq.ft)',
    shortLabel: 'Server/OT (45 BTU/sf)',
    btuPerSqft: 45,
    notes: '24x7 equipment / critical precision temperature control',
  },
];

export interface CoolingChartRefRow {
  areaSqft: number;
  areaSqm: number;
  normalBtu: number;
  normalTr: number;
  sunnyTr: number;
  denseTr: number;
  suggestedAc: string;
}

export const COOLING_LOAD_REFERENCE_CHART: CoolingChartRefRow[] = [
  { areaSqft: 100, areaSqm: 9.3, normalBtu: 6000, normalTr: 0.5, sunnyTr: 0.75, denseTr: 0.85, suggestedAc: '1 × 1.0 TR Split' },
  { areaSqft: 150, areaSqm: 13.9, normalBtu: 9600, normalTr: 0.8, sunnyTr: 1.0, denseTr: 1.2, suggestedAc: '1 × 1.0 TR Split' },
  { areaSqft: 200, areaSqm: 18.6, normalBtu: 12000, normalTr: 1.0, sunnyTr: 1.35, denseTr: 1.5, suggestedAc: '1 × 1.5 TR Split' },
  { areaSqft: 250, areaSqm: 23.2, normalBtu: 15600, normalTr: 1.3, sunnyTr: 1.6, denseTr: 1.85, suggestedAc: '1 × 1.5 TR (or 2.0 TR Top Flr)' },
  { areaSqft: 300, areaSqm: 27.9, normalBtu: 18000, normalTr: 1.5, sunnyTr: 1.9, denseTr: 2.2, suggestedAc: '1 × 2.0 TR Split' },
  { areaSqft: 400, areaSqm: 37.2, normalBtu: 24000, normalTr: 2.0, sunnyTr: 2.5, denseTr: 2.9, suggestedAc: '2 × 1.5 TR (or 1 × 2.0 TR)' },
  { areaSqft: 500, areaSqm: 46.5, normalBtu: 30000, normalTr: 2.5, sunnyTr: 3.1, denseTr: 3.6, suggestedAc: '2 × 1.5 TR = 3.0 TR' },
  { areaSqft: 650, areaSqm: 60.4, normalBtu: 39600, normalTr: 3.3, sunnyTr: 4.1, denseTr: 4.7, suggestedAc: '2 × 2.0 TR = 4.0 TR' },
  { areaSqft: 800, areaSqm: 74.3, normalBtu: 48000, normalTr: 4.0, sunnyTr: 5.0, denseTr: 5.8, suggestedAc: '3 × 1.5 TR or 2 × 2.0 TR' },
  { areaSqft: 1000, areaSqm: 92.9, normalBtu: 60000, normalTr: 5.0, sunnyTr: 6.2, denseTr: 7.2, suggestedAc: '3 × 2.0 TR or 2 × 3.0 TR' },
];

export const FAN_EXHAUST_SPECS = [
  { badge: 'H10', item: '1200 mm Ceiling Fan', airDeliveryCfm: '7,400 CFM (210 CMM)', coverage: '12–14 m² (~150 sq.ft) per fan', application: 'Standard offices, bedrooms, cabins' },
  { badge: 'H11', item: '1400 mm Ceiling Fan', airDeliveryCfm: '9,000 CFM (255 CMM)', coverage: '18–22 m² (~220 sq.ft) per fan', application: 'Large halls, classrooms, wards' },
  { badge: 'H12', item: '400 mm Wall Fan', airDeliveryCfm: '2,600 CFM (75 CMM)', coverage: '6–9 m² spot circulation', application: 'Kitchens, corridors, guard booths' },
  { badge: 'H13', item: '225 mm Exhaust Fan', airDeliveryCfm: '350 CFM (600 CMH)', coverage: 'Up to 350 CFM @ 12 ACH', application: 'Standard toilets / washrooms (≤ 18 m²)' },
  { badge: 'H14', item: '300 mm Exhaust Fan', airDeliveryCfm: '650 CFM (1,100 CMH)', coverage: '350–650 CFM @ 12–15 ACH', application: 'Large toilets, kitchens, pantries, labs' },
];

export function inferVentTypeFromRoom(roomName?: string, luxCategoryId?: string): VentilationRoomType {
  const name = (roomName || '').toLowerCase();
  const ref = getLuxReferenceById(luxCategoryId);
  const resolvedId = resolveLuxReferenceId(luxCategoryId);
  const combinedText = `${name} ${ref?.label || ''} ${ref?.buildingGroup || ''}`.toLowerCase();

  if (
    resolvedId === 'home-bathroom' ||
    resolvedId === 'hotel-bathroom' ||
    resolvedId === 'gen-staff-changing-lavatory' ||
    /\b(toilet|toilets|wc|w\.c|washroom|bath|bathroom|restroom|lavatory|lavatories|urinal|powder room)\b/.test(
      combinedText
    )
  ) {
    return 'toilet';
  }

  if (
    resolvedId === 'home-kitchen' ||
    resolvedId === 'school-laboratory' ||
    resolvedId === 'hospital-laboratories' ||
    resolvedId === 'hospital-lab-examination' ||
    resolvedId === 'hospital-dental-lab' ||
    resolvedId === 'hospital-pathology-general' ||
    resolvedId === 'hospital-pathology-exam' ||
    resolvedId === 'gen-restaurant-kitchen' ||
    resolvedId === 'gen-restaurant-servery' ||
    resolvedId === 'hotel-food-prep-corridors' ||
    resolvedId === 'garage-spray-booths' ||
    /\b(kitchen|pantry|food preparation|cooking|servery|washing-up|lab|laboratory|laboratories|pathology|spray booths|boiler)\b/.test(
      combinedText
    )
  ) {
    return 'kitchen_lab';
  }

  return 'general';
}

const NON_AC_LUX_IDS = new Set([
  'home-bathroom',
  'home-stairs',
  'home-garage',
  'hotel-bathroom',
  'hotel-cloak-baggage',
  'substation-switchroom',
  'dist-work-stores-general',
  'dist-work-stores-unpacking',
  'dist-work-stores-large',
  'dist-work-stores-small-rack',
  'dist-warehouse-limited',
  'dist-warehouse-detail',
  'dist-highbay-gangway',
  'dist-highbay-packing',
  'dist-highbay-loading',
  'dist-coldstore-general',
  'dist-coldstore-breakdown',
  'dist-coldstore-loading',
  'garage-interior-parking',
  'garage-repairs',
  'garage-workbench',
  'garage-spray-booths',
  'hospital-corridors-general',
  'hospital-ward-corr-day-screened',
  'hospital-ward-corr-day-natural',
  'hospital-ward-corr-morning-evening',
  'hospital-ward-corr-night',
  'hospital-ward-circ-night',
  'hospital-xray-darkroom',
  'lib-workroom-remote-store',
  'gen-entrance-gatehouses',
  'gen-circ-lifts',
  'gen-circ-corridors',
  'gen-circ-escalators',
  'gen-staff-changing-lavatory',
  'gen-restaurant-stores',
  'gen-services-boiler-general',
  'gen-services-boiler-front',
  'gen-services-mechanical-plant',
  'gen-services-electrical-dist',
  'gen-services-store-rooms',
  'gen-carpark-covered-floors',
  'gen-carpark-covered-ramps',
  'gen-carpark-covered-entrances',
  'gen-carpark-outdoor',
]);

export function inferDefaultAcRequired(roomName?: string, luxCategoryId?: string): boolean {
  const vent = inferVentTypeFromRoom(roomName, luxCategoryId);
  if (vent === 'toilet') return false;

  const resolvedId = resolveLuxReferenceId(luxCategoryId);
  if (resolvedId && NON_AC_LUX_IDS.has(resolvedId)) return false;

  const ref = getLuxReferenceById(luxCategoryId);
  const label = (ref?.label || '').toLowerCase();
  if (
    /\b(corridor|corridors|stair|stairs|car park|parking|gangway|loading bay|cold store|boiler|garage|lift|lifts|escalator|cellar|store room|gatehouse)\b/.test(
      label
    )
  ) {
    return false;
  }

  const name = (roomName || '').toLowerCase();
  if (
    /\b(corridor|stair|stairs|staircase|passage|lobby|garage|store|parking|balcony|verandah|shaft)\b/.test(
      name
    )
  ) {
    return false;
  }
  return true;
}

export function inferDefaultExposureType(luxCategoryId?: string): CoolingExposureType {
  const resolvedId = resolveLuxReferenceId(luxCategoryId);
  if (!resolvedId) return 'normal';
  if (
    resolvedId.includes('ot-') ||
    resolvedId.includes('icu-') ||
    resolvedId.includes('lab') ||
    resolvedId.includes('pathology') ||
    resolvedId.includes('anaesthetic') ||
    resolvedId.includes('surgeries') ||
    resolvedId.includes('computer') ||
    resolvedId.includes('control') ||
    resolvedId.includes('switchboard')
  ) {
    return 'server-ot';
  }
  if (
    resolvedId.includes('conference') ||
    resolvedId.includes('assembly') ||
    resolvedId.includes('lecture') ||
    resolvedId.includes('seminar') ||
    resolvedId.includes('teaching') ||
    resolvedId.includes('auditorium') ||
    resolvedId.includes('sports') ||
    resolvedId.includes('canteen') ||
    resolvedId.includes('bars-dining')
  ) {
    return 'high-load';
  }
  return 'normal';
}

export interface RowHvacCalc {
  areaSqm: number;
  areaSqft: number;
  heightFt: number;
  volumeCuFt: number;
  effectiveVentType: VentilationRoomType;
  achUsed: number;
  requiredCfm: number;
  // Recommended #H10 - #H14 counts
  recH10: number; // 1200 mm ceiling fan
  recH11: number; // 1400 mm ceiling fan
  recH12: number; // 400 mm wall fan
  recH13: number; // 225 mm exhaust fan
  recH14: number; // 300 mm exhaust fan
  deliveredExhaustCfm: number;
  ventSummary: string;
  // Cooling Load & AC (#H21 - #H22)
  acEnabled: boolean;
  exposure: ExposurePreset;
  effectiveOccupants: number;
  lightingWatts: number;
  equipmentWatts: number;
  envelopeBtu: number;
  occupantBtu: number;
  lightingBtu: number;
  equipmentBtu: number;
  safetyBtu: number;
  totalBtuHr: number;
  calculatedTr: number;
  recNoOfAc: number; // #H21
  recTonnage: number; // #H22 (total tonnage for room)
  unitSizeTr: number; // unit rating e.g. 1.5 TR
  acSizingLabel: string;
}

function nVal(v?: string): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return isNaN(n) || n < 0 ? 0 : n;
}

export function computeRowHvac(row: InventoryRow, settings: HvacDesignSettings): RowHvacCalc {
  const sqmtRaw = nVal(row.sqmt);
  const sqftRaw = nVal(row.sqft);
  const areaSqm = sqmtRaw > 0 ? sqmtRaw : sqftRaw > 0 ? sqftRaw / 10.7639 : 0;
  const areaSqft = sqftRaw > 0 ? sqftRaw : areaSqm > 0 ? areaSqm * 10.7639 : 0;

  const heightOverride = nVal(row.ceilingHeightFt);
  const heightFt = heightOverride > 0 ? heightOverride : settings.defaultHeightFt || 10;
  const volumeCuFt = areaSqft * heightFt;

  const effectiveVentType: VentilationRoomType =
    row.ventType || inferVentTypeFromRoom(row.room, row.luxCategoryId);

  const acEnabled: boolean =
    row.acRequired === 'yes'
      ? true
      : row.acRequired === 'no'
      ? false
      : inferDefaultAcRequired(row.room, row.luxCategoryId);

  const achUsed =
    effectiveVentType === 'toilet'
      ? settings.toiletAch
      : effectiveVentType === 'kitchen_lab'
      ? settings.kitchenLabAch
      : settings.generalAch;

  const requiredCfm = volumeCuFt > 0 ? (volumeCuFt * achUsed) / 60 : 0;

  // Compute recommended #H10 - #H14 counts
  let recH10 = 0;
  let recH11 = 0;
  let recH12 = 0;
  let recH13 = 0;
  let recH14 = 0;
  let ventSummary = 'Enter Area';

  if (areaSqm > 0) {
    if (effectiveVentType === 'toilet') {
      // Toilet ventilation uses exhaust fans sized at Toilet ACH (default 12 ACH)
      if (requiredCfm <= settings.cfm225Exhaust) {
        recH13 = Math.max(1, Math.ceil(requiredCfm / settings.cfm225Exhaust));
        ventSummary = `${recH13}×225mm Exhaust (${recH13 * settings.cfm225Exhaust} CFM)`;
      } else {
        recH14 = Math.max(1, Math.ceil(requiredCfm / settings.cfm300Exhaust));
        ventSummary = `${recH14}×300mm Exhaust (${recH14 * settings.cfm300Exhaust} CFM)`;
      }
    } else if (effectiveVentType === 'kitchen_lab') {
      if (requiredCfm <= settings.cfm225Exhaust) {
        recH13 = 1;
      } else {
        recH14 = Math.max(1, Math.ceil(requiredCfm / settings.cfm300Exhaust));
      }
      if (!acEnabled || settings.keepFansInAcRoom) {
        if (areaSqm <= 16) {
          recH12 = 1; // Wall fan in kitchen/pantry
        } else {
          recH10 = Math.max(1, Math.ceil(areaSqm / settings.maxAreaPer1200FanSqm));
        }
      }
      ventSummary = `Exhaust + Circ (${Math.round(requiredCfm)} CFM)`;
    } else {
      // General room
      if (!acEnabled || settings.keepFansInAcRoom) {
        if (areaSqm <= 6.5) {
          recH12 = 1; // Narrow/small space -> 400mm Wall Fan
          ventSummary = `1×400mm Wall Fan`;
        } else if (areaSqm <= 30) {
          recH10 = Math.max(1, Math.ceil(areaSqm / (settings.maxAreaPer1200FanSqm || 14)));
          ventSummary = `${recH10}×1200mm Fan`;
        } else {
          recH11 = Math.max(1, Math.ceil(areaSqm / (settings.maxAreaPer1400FanSqm || 20)));
          ventSummary = `${recH11}×1400mm Fan`;
        }
      } else {
        ventSummary = `AC Only (${Math.round(requiredCfm)} CFM fresh air)`;
      }
    }
  }

  const deliveredExhaustCfm =
    recH13 * settings.cfm225Exhaust + recH14 * settings.cfm300Exhaust;

  // Lighting & Equipment heat gains tied to Inventory columns
  const lightingWatts =
    nVal(row.tube20w) * 20 +
    nVal(row.tube40w) * 40 +
    nVal(row.surfaceLight36w) * 36 +
    nVal(row.recessLight20w) * 20 +
    nVal(row.recessLight36w) * 36 +
    nVal(row.bulbPoint20w) * 20;

  const equipmentWatts =
    nVal(row.computerBoard) * settings.wattsPerComputerBoard +
    nVal(row.socket20a) * 150 +
    nVal(row.socket3x20a) * 300;

  const exposureId: CoolingExposureType = row.exposureType || 'normal';
  const exposure = EXPOSURE_PRESETS.find((e) => e.id === exposureId) || EXPOSURE_PRESETS[0];

  const occOverride = nVal(row.occupants);
  const effectiveOccupants =
    areaSqft <= 0
      ? 0
      : occOverride > 0
      ? occOverride
      : exposureId === 'high-load'
      ? Math.max(2, Math.round(areaSqft / 40))
      : Math.max(1, Math.round(areaSqft / 100));

  let envelopeBtu = 0;
  let occupantBtu = 0;
  let lightingBtu = 0;
  let equipmentBtu = 0;
  let safetyBtu = 0;
  let totalBtuHr = 0;
  let calculatedTr = 0;
  let recNoOfAc = 0;
  let recTonnage = 0;
  let unitSizeTr = 0;
  let acSizingLabel = acEnabled ? 'Enter Area' : 'No AC Required';

  if (acEnabled && areaSqft > 0) {
    const heightMultiplier = Math.max(0.85, heightFt / 10);
    envelopeBtu = areaSqft * exposure.btuPerSqft * heightMultiplier;
    occupantBtu = effectiveOccupants * settings.btuPerPerson;
    lightingBtu = lightingWatts * 3.412 * 1.15;
    equipmentBtu = equipmentWatts * 3.412;

    const baseBtu = envelopeBtu + occupantBtu + lightingBtu + equipmentBtu;
    safetyBtu = baseBtu * (settings.safetyFactorPct / 100);
    totalBtuHr = baseBtu + safetyBtu;
    calculatedTr = totalBtuHr / 12000;

    if (settings.preferredAcUnitTr > 0) {
      unitSizeTr = settings.preferredAcUnitTr;
      recNoOfAc = Math.max(1, Math.ceil(calculatedTr / unitSizeTr));
      recTonnage = Number((recNoOfAc * unitSizeTr).toFixed(1));
    } else {
      if (calculatedTr <= 1.05) {
        recNoOfAc = 1;
        unitSizeTr = 1.0;
      } else if (calculatedTr <= 1.6) {
        recNoOfAc = 1;
        unitSizeTr = 1.5;
      } else if (calculatedTr <= 2.15) {
        recNoOfAc = 1;
        unitSizeTr = 2.0;
      } else if (calculatedTr <= 3.1) {
        recNoOfAc = 2;
        unitSizeTr = 1.5;
      } else if (calculatedTr <= 4.15) {
        recNoOfAc = 2;
        unitSizeTr = 2.0;
      } else if (calculatedTr <= 6.2) {
        unitSizeTr = 2.0;
        recNoOfAc = Math.ceil(calculatedTr / 2.0);
      } else {
        unitSizeTr = 3.0;
        recNoOfAc = Math.ceil(calculatedTr / 3.0);
      }
      recTonnage = Number((recNoOfAc * unitSizeTr).toFixed(1));
    }

    acSizingLabel = `${recNoOfAc} × ${unitSizeTr.toFixed(1)} TR (${recTonnage.toFixed(1)} TR)`;
  }

  return {
    areaSqm,
    areaSqft,
    heightFt,
    volumeCuFt,
    effectiveVentType,
    achUsed,
    requiredCfm,
    recH10,
    recH11,
    recH12,
    recH13,
    recH14,
    deliveredExhaustCfm,
    ventSummary,
    acEnabled,
    exposure,
    effectiveOccupants,
    lightingWatts,
    equipmentWatts,
    envelopeBtu,
    occupantBtu,
    lightingBtu,
    equipmentBtu,
    safetyBtu,
    totalBtuHr,
    calculatedTr,
    recNoOfAc,
    recTonnage,
    unitSizeTr,
    acSizingLabel,
  };
}
