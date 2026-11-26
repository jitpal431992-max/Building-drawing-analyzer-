import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileSpreadsheet,
  Layers,
  RotateCcw,
  SlidersHorizontal,
  Table2,
  Zap,
} from 'lucide-react';
import { InventoryRow, RawEmergencyColumnKey } from '../types';
import { INVENTORY_COLUMNS } from '../data/inventorySchema';
import {
  BuildingLoadSettings,
  DEFAULT_BUILDING_LOAD_SETTINGS,
  DEFAULT_WATTAGE_TABLE,
  FLOOR_OPTIONS,
  RoomLoadCalc,
  computeRoomBuildingLoad,
  getEntryWattage,
} from '../data/wattageTable';

const STORAGE_KEY_BUILDING_LOAD_SETTINGS = 'dsr_building_load_settings_v1';

const FLOOR_INV_COLS = INVENTORY_COLUMNS.filter((c) => c.key !== 'floor');

const RAW_EMG_KEYS = new Set<string>([
  'socket2x5a',
  'socket20a',
  'computerBoard',
  'socket3x20a',
  'noOfAc',
]);

function floorAnchorId(floorName: string): string {
  return `floor-inv-${floorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

interface BuildingLoadCalculationProps {
  rows: InventoryRow[];
  onBackToInventory: () => void;
  onConfirmToMcbDb: () => void;
  onProceedToNext: () => void;
  onNotify?: (msg: string) => void;
}

function nQty(val?: string): number {
  if (!val) return 0;
  const parsed = parseFloat(val);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function clampDfRange(val: number, min: number, max: number): number {
  if (isNaN(val)) return min;
  return Math.min(max, Math.max(min, Number(val.toFixed(2))));
}

export const BuildingLoadCalculation: React.FC<BuildingLoadCalculationProps> = ({
  rows,
  onBackToInventory,
  onConfirmToMcbDb,
  onProceedToNext,
  onNotify,
}) => {
  const [settings, setSettings] = useState<BuildingLoadSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BUILDING_LOAD_SETTINGS);
      if (saved) {
        return { ...DEFAULT_BUILDING_LOAD_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load building load settings:', e);
    }
    return DEFAULT_BUILDING_LOAD_SETTINGS;
  });

  const [activeTab, setActiveTab] = useState<'floor-wise' | 'room-wise' | 'wattage-table'>(
    'floor-wise'
  );
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [inventoryFloorFilter, setInventoryFloorFilter] = useState<string>('ALL');
  const [collapsedFloors, setCollapsedFloors] = useState<Set<string>>(new Set());
  const [showDfControls, setShowDfControls] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BUILDING_LOAD_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to persist building load settings:', e);
    }
  }, [settings]);

  const roomLoads = useMemo(
    () => rows.map((row) => computeRoomBuildingLoad(row, settings)),
    [rows, settings]
  );

  // Ordered unique floors appearing in inventory
  const availableFloors = useMemo(() => {
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
  }, [rows]);

  // Building-wide totals
  const buildingTotals = useMemo(() => {
    const acc = roomLoads.reduce(
      (sum, r) => ({
        areaSqm: sum.areaSqm + r.areaSqm,
        connectedH05H15W: sum.connectedH05H15W + r.connectedWattsH05H15,
        connectedH16W: sum.connectedH16W + r.connectedWattsH16,
        connectedTotalW: sum.connectedTotalW + r.connectedWattsTotal,
        connectedDemandW: sum.connectedDemandW + r.connectedDemandWatts,
        rawW: sum.rawW + r.rawWattsH17H21,
        rawDemandW: sum.rawDemandW + r.rawDemandWatts,
        emergencyW: sum.emergencyW + r.emergencyWattsH17H21,
        emergencyDemandW: sum.emergencyDemandW + r.emergencyDemandWatts,
        totalConnectedW: sum.totalConnectedW + r.totalConnectedWatts,
        totalDemandW: sum.totalDemandW + r.totalDemandWatts,
        tonnageRaw: sum.tonnageRaw + r.tonnageRaw,
        tonnageEmergency: sum.tonnageEmergency + r.tonnageEmergency,
      }),
      {
        areaSqm: 0,
        connectedH05H15W: 0,
        connectedH16W: 0,
        connectedTotalW: 0,
        connectedDemandW: 0,
        rawW: 0,
        rawDemandW: 0,
        emergencyW: 0,
        emergencyDemandW: 0,
        totalConnectedW: 0,
        totalDemandW: 0,
        tonnageRaw: 0,
        tonnageEmergency: 0,
      }
    );

    const pf = settings.powerFactor > 0 && settings.powerFactor <= 1 ? settings.powerFactor : 0.85;
    const totalEmergencyDemandW = acc.connectedDemandW + acc.emergencyDemandW;
    const totalRawDemandW = acc.rawDemandW;
    const totalDemandKw = (totalEmergencyDemandW + totalRawDemandW) / 1000;
    const totalKva = totalDemandKw / pf;
    const emergencyDemandKva = totalEmergencyDemandW / 1000 / pf;
    const rawTotalKva = totalRawDemandW / 1000 / pf;

    return {
      ...acc,
      pf,
      totalEmergencyDemandW,
      totalRawDemandW,
      totalDemandKw,
      totalKva,
      emergencyDemandKva,
      rawTotalKva,
    };
  }, [roomLoads, settings.powerFactor]);

  // Floor-wise aggregation
  const floorSummaries = useMemo(() => {
    const pf = buildingTotals.pf;
    return availableFloors.map((floorName) => {
      const floorRooms = roomLoads.filter((r) => r.floor === floorName);
      const totals = floorRooms.reduce(
        (s, r) => ({
          rooms: s.rooms + 1,
          areaSqm: s.areaSqm + r.areaSqm,
          connectedW: s.connectedW + r.connectedWattsTotal,
          connectedDemandW: s.connectedDemandW + r.connectedDemandWatts,
          rawW: s.rawW + r.rawWattsH17H21,
          rawDemandW: s.rawDemandW + r.rawDemandWatts,
          emergencyW: s.emergencyW + r.emergencyWattsH17H21,
          emergencyDemandW: s.emergencyDemandW + r.emergencyDemandWatts,
          totalEmergencyDemandW: s.totalEmergencyDemandW + r.totalEmergencyDemandWatts,
          totalRawDemandW: s.totalRawDemandW + r.totalRawDemandWatts,
          totalConnectedW: s.totalConnectedW + r.totalConnectedWatts,
          totalDemandW: s.totalDemandW + r.totalDemandWatts,
        }),
        {
          rooms: 0,
          areaSqm: 0,
          connectedW: 0,
          connectedDemandW: 0,
          rawW: 0,
          rawDemandW: 0,
          emergencyW: 0,
          emergencyDemandW: 0,
          totalEmergencyDemandW: 0,
          totalRawDemandW: 0,
          totalConnectedW: 0,
          totalDemandW: 0,
        }
      );
      return {
        floorName,
        ...totals,
        kva: totals.totalDemandW / 1000 / pf,
      };
    });
  }, [availableFloors, roomLoads, buildingTotals.pf]);

  // Floor-wise separated inventory rows & column totals
  const floorGroupedInventory = useMemo(() => {
    const pf = buildingTotals.pf;
    return availableFloors.map((floorName) => {
      const entries: { row: InventoryRow; calc: RoomLoadCalc; floorSlNo: number }[] = [];
      const colTotals: Record<string, number> = {};
      const splitTotals: Record<string, { raw: number; emergency: number }> = {
        socket2x5a: { raw: 0, emergency: 0 },
        socket20a: { raw: 0, emergency: 0 },
        computerBoard: { raw: 0, emergency: 0 },
        socket3x20a: { raw: 0, emergency: 0 },
        noOfAc: { raw: 0, emergency: 0 },
        tonnage: { raw: 0, emergency: 0 },
      };

      let areaSqm = 0;
      let connectedW = 0;
      let connectedDemandW = 0;
      let rawW = 0;
      let rawDemandW = 0;
      let emergencyW = 0;
      let emergencyDemandW = 0;
      let totalEmergencyDemandW = 0;
      let totalRawDemandW = 0;
      let totalConnectedW = 0;
      let totalDemandW = 0;

      rows.forEach((row, idx) => {
        if ((row.floor || 'Ground Floor') !== floorName) return;
        const calc = roomLoads[idx];
        entries.push({ row, calc, floorSlNo: entries.length + 1 });

        areaSqm += calc.areaSqm;
        connectedW += calc.connectedWattsTotal;
        connectedDemandW += calc.connectedDemandWatts;
        rawW += calc.rawWattsH17H21;
        rawDemandW += calc.rawDemandWatts;
        emergencyW += calc.emergencyWattsH17H21;
        emergencyDemandW += calc.emergencyDemandWatts;
        totalEmergencyDemandW += calc.totalEmergencyDemandWatts;
        totalRawDemandW += calc.totalRawDemandWatts;
        totalConnectedW += calc.totalConnectedWatts;
        totalDemandW += calc.totalDemandWatts;

        for (const col of FLOOR_INV_COLS) {
          if (col.type !== 'number' || col.key === 'slNo') continue;
          const v = nQty(row[col.key]);
          colTotals[col.key] = (colTotals[col.key] || 0) + v;

          if (RAW_EMG_KEYS.has(col.key)) {
            const isEmg = row.powerSources?.[col.key as RawEmergencyColumnKey] === 'emergency';
            if (isEmg) splitTotals[col.key].emergency += v;
            else splitTotals[col.key].raw += v;
          } else if (col.key === 'tonnage') {
            const isAcEmg = row.powerSources?.noOfAc === 'emergency';
            if (isAcEmg) splitTotals.tonnage.emergency += v;
            else splitTotals.tonnage.raw += v;
          }
        }
      });

      return {
        floorName,
        entries,
        colTotals,
        splitTotals,
        summary: {
          areaSqm,
          connectedW,
          connectedDemandW,
          rawW,
          rawDemandW,
          emergencyW,
          emergencyDemandW,
          totalEmergencyDemandW,
          totalRawDemandW,
          totalConnectedW,
          totalDemandW,
          kva: totalDemandW / 1000 / pf,
        },
      };
    });
  }, [availableFloors, rows, roomLoads, buildingTotals.pf]);

  const toggleFloorCollapse = (floorName: string) => {
    setCollapsedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(floorName)) next.delete(floorName);
      else next.add(floorName);
      return next;
    });
  };

  // Filtered rooms for Room-Wise tab
  const filteredRoomLoads = useMemo(() => {
    if (floorFilter === 'ALL') return roomLoads;
    return roomLoads.filter((r) => r.floor === floorFilter);
  }, [roomLoads, floorFilter]);

  // Item-wise breakdown across the building matching Wattage_table.pdf
  const itemLoadBreakdown = useMemo(() => {
    const relevantRows =
      floorFilter === 'ALL'
        ? rows
        : rows.filter((r) => (r.floor || 'Ground Floor') === floorFilter);

    return DEFAULT_WATTAGE_TABLE.map((entry, idx) => {
      const unitW = getEntryWattage(entry, settings);
      const isAcEntry = entry.fieldKey === 'noOfAc';
      let rawQty = 0;
      let emergencyQty = 0;
      let rawWatts = 0;
      let emergencyWatts = 0;
      let rawTr = 0;
      let emergencyTr = 0;

      for (const row of relevantRows) {
        const q = nQty(row[entry.fieldKey]);
        if (q <= 0) continue;
        const rowTr = isAcEntry ? nQty(row.tonnage) * q : 0;
        const rowWatts = isAcEntry ? rowTr * unitW : q * unitW;

        if (entry.group === 'raw_emergency') {
          const mode =
            row.powerSources?.[entry.fieldKey as RawEmergencyColumnKey] === 'emergency'
              ? 'emergency'
              : 'raw';
          if (mode === 'emergency') {
            emergencyQty += q;
            emergencyWatts += rowWatts;
            emergencyTr += rowTr;
          } else {
            rawQty += q;
            rawWatts += rowWatts;
            rawTr += rowTr;
          }
        } else {
          rawQty += q;
          rawWatts += rowWatts;
        }
      }

      const totalQty = rawQty + emergencyQty;
      const connectedWatts = rawWatts + emergencyWatts;

      let demandWatts = 0;
      let dfDisplay = '–';
      if (entry.group === 'connected') {
        demandWatts = connectedWatts * settings.connectedDiversityFactor;
        dfDisplay = settings.connectedDiversityFactor.toFixed(2);
      } else if (entry.group === 'socket_5a') {
        demandWatts = settings.includeH16InConnected
          ? connectedWatts * settings.connectedDiversityFactor
          : 0;
        dfDisplay = settings.includeH16InConnected
          ? settings.connectedDiversityFactor.toFixed(2)
          : 'Excluded';
      } else {
        demandWatts =
          rawWatts * settings.rawDiversityFactor +
          emergencyWatts * settings.emergencyDiversityFactor;
        dfDisplay = `${settings.rawDiversityFactor.toFixed(2)} / ${settings.emergencyDiversityFactor.toFixed(2)}`;
      }

      return {
        slNo: idx + 1,
        entry,
        isAcEntry,
        unitW,
        rawQty,
        emergencyQty,
        totalQty,
        rawTr,
        emergencyTr,
        totalTr: rawTr + emergencyTr,
        rawWatts,
        emergencyWatts,
        connectedWatts,
        demandWatts,
        dfDisplay,
      };
    });
  }, [rows, floorFilter, settings]);

  const handleWattageOverride = (badgeId: string, valStr: string) => {
    const parsed = parseFloat(valStr);
    setSettings((prev) => ({
      ...prev,
      wattageOverrides: {
        ...prev.wattageOverrides,
        [badgeId]: isNaN(parsed) || parsed < 0 ? 0 : parsed,
      },
    }));
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_BUILDING_LOAD_SETTINGS);
    onNotify?.('Reset diversity factors and wattage table to default values.');
  };

  const handleExportBuildingLoadExcel = async () => {
    const XLSX = await import('xlsx');
    const fmtKw = (w: number) => Number((w / 1000).toFixed(3));

    const summarySheet = [
      ['Building Electrical Load Calculation Summary'],
      [`Generated on ${new Date().toLocaleDateString('en-IN')} | Based on Site Inventory & Wattage Table`],
      [],
      ['Load Group', 'Diversity Factor', 'Connected Load (kW)', 'Demand Load (kW)', 'Estimated kVA (PF ' + buildingTotals.pf + ')'],
      [
        `Connected Load (#H05–#H15${settings.includeH16InConnected ? ' + #H16' : ''})`,
        settings.connectedDiversityFactor,
        fmtKw(buildingTotals.connectedTotalW),
        fmtKw(buildingTotals.connectedDemandW),
        Number((buildingTotals.connectedDemandW / 1000 / buildingTotals.pf).toFixed(2)),
      ],
      [
        'Emergency Component (#H17–#H21 Emergency)',
        settings.emergencyDiversityFactor,
        fmtKw(buildingTotals.emergencyW),
        fmtKw(buildingTotals.emergencyDemandW),
        Number((buildingTotals.emergencyDemandW / 1000 / buildingTotals.pf).toFixed(2)),
      ],
      [
        'TOTAL EMERGENCY LOAD = (Connected × DF) + (Emergency × DF)',
        '',
        fmtKw(buildingTotals.connectedTotalW + buildingTotals.emergencyW),
        fmtKw(buildingTotals.totalEmergencyDemandW),
        Number(buildingTotals.emergencyDemandKva.toFixed(2)),
      ],
      [],
      [
        'TOTAL RAW LOAD = Raw Load (#H17–#H21 Raw) × DF',
        settings.rawDiversityFactor,
        fmtKw(buildingTotals.rawW),
        fmtKw(buildingTotals.totalRawDemandW),
        Number(buildingTotals.rawTotalKva.toFixed(2)),
      ],
      [],
      [
        'TOTAL LOAD = Total Emergency Load + Total Raw Load',
        '',
        fmtKw(buildingTotals.totalConnectedW),
        fmtKw(buildingTotals.totalEmergencyDemandW + buildingTotals.totalRawDemandW),
        Number(buildingTotals.totalKva.toFixed(2)),
      ],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summarySheet);
    ws1['!cols'] = [{ wch: 56 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 22 }];

    const floorSheet = [
      ['Floor-Wise Electrical Load Summary'],
      [],
      [
        'Floor',
        'Rooms',
        'Area (m²)',
        `Connected #H05–#H15 (kW)`,
        `Connected ×${settings.connectedDiversityFactor} (kW)`,
        `Emergency #H17–#H21 (kW)`,
        `Emergency ×${settings.emergencyDiversityFactor} (kW)`,
        'Total Emergency Load (kW)',
        `Raw #H17–#H21 (kW)`,
        `Total Raw Load ×${settings.rawDiversityFactor} (kW)`,
        'Total Load (kW)',
        `Est. kVA (PF ${buildingTotals.pf})`,
      ],
      ...floorSummaries.map((f) => [
        f.floorName,
        f.rooms,
        Number(f.areaSqm.toFixed(2)),
        fmtKw(f.connectedW),
        fmtKw(f.connectedDemandW),
        fmtKw(f.emergencyW),
        fmtKw(f.emergencyDemandW),
        fmtKw(f.totalEmergencyDemandW),
        fmtKw(f.rawW),
        fmtKw(f.totalRawDemandW),
        fmtKw(f.totalDemandW),
        Number(f.kva.toFixed(2)),
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(floorSheet);
    ws2['!cols'] = Array(12).fill({ wch: 20 });

    const roomSheet = [
      ['Room-Wise Electrical Load Schedule'],
      [],
      [
        'Sl.no.',
        'Floor',
        'Room',
        'IS:3646 Lux Category',
        'Target Lux (lx)',
        'Area (m²)',
        'Lighting #H05–#H09/#H15 (W)',
        'Connected #H05–#H15 (W)',
        `Connected ×${settings.connectedDiversityFactor} (W)`,
        'AC (#H21 × #H22)',
        'AC Load (W)',
        'Emg #H17–#H21 (W)',
        `Emg ×${settings.emergencyDiversityFactor} (W)`,
        'Total Emergency Load (kW)',
        'Raw #H17–#H21 (W)',
        `Total Raw Load ×${settings.rawDiversityFactor} (kW)`,
        'Total Load (kW)',
      ],
      ...roomLoads.map((r, i) => [
        i + 1,
        r.floor,
        r.room,
        r.luxCategoryLabel || '–',
        r.targetLux > 0 ? r.targetLux : '–',
        Number(r.areaSqm.toFixed(2)),
        Math.round(r.lightingWatts),
        Math.round(r.connectedWattsTotal),
        Math.round(r.connectedDemandWatts),
        r.acQty > 0 && r.acTonnagePerUnit > 0 ? `${r.acQty} × ${r.acTonnagePerUnit} TR` : '–',
        Math.round(r.acWatts),
        Math.round(r.emergencyWattsH17H21),
        Math.round(r.emergencyDemandWatts),
        fmtKw(r.totalEmergencyDemandWatts),
        Math.round(r.rawWattsH17H21),
        fmtKw(r.totalRawDemandWatts),
        fmtKw(r.totalDemandWatts),
      ]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(roomSheet);
    ws3['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 24 }, { wch: 30 }, { wch: 14 }, ...Array(12).fill({ wch: 19 })];

    const wattageSheet = [
      ['Item-Wise Wattage Table & Building Load Calculation (#H05–#H22)'],
      [],
      [
        'Sl.no.',
        'Header ID',
        'Item',
        'Load Group',
        'Unit Wattage (W or W/ton)',
        'Raw Qty',
        'Emergency Qty',
        'Total Qty',
        'Effective TR (#H22×#H21)',
        'Connected Load (kW)',
        'Diversity Factor',
        'Demand Load (kW)',
      ],
      ...itemLoadBreakdown.map((item) => [
        item.slNo,
        item.isAcEntry ? '#H21 / #H22' : `#${item.entry.badgeId}`,
        item.entry.itemLabel,
        item.entry.group === 'connected'
          ? 'Connected (#H05–#H15)'
          : item.entry.group === 'socket_5a'
          ? '5A on board (#H16)'
          : 'Raw / Emergency (#H17–#H21)',
        item.unitW,
        item.rawQty,
        item.emergencyQty,
        item.totalQty,
        item.isAcEntry ? Number(item.totalTr.toFixed(2)) : '',
        fmtKw(item.connectedWatts),
        item.dfDisplay,
        fmtKw(item.demandWatts),
      ]),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(wattageSheet);
    ws4['!cols'] = [
      { wch: 8 },
      { wch: 13 },
      { wch: 34 },
      { wch: 26 },
      { wch: 22 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
    ];

    const floorInvSheetData: (string | number)[][] = [
      ['Floor-Wise Separated Inventory & Electrical Load Schedule'],
      [`Generated on ${new Date().toLocaleDateString('en-IN')}`],
    ];

    for (const grp of floorGroupedInventory) {
      floorInvSheetData.push([]);
      floorInvSheetData.push([
        `FLOOR: ${grp.floorName}`,
        `${grp.entries.length} Rooms`,
        `Area: ${grp.summary.areaSqm.toFixed(2)} m²`,
        `Total Emergency Load: ${fmtKw(grp.summary.totalEmergencyDemandW)} kW`,
        `Total Raw Load: ${fmtKw(grp.summary.totalRawDemandW)} kW`,
        `Total Load: ${fmtKw(grp.summary.totalDemandW)} kW (${grp.summary.kva.toFixed(2)} kVA)`,
      ]);
      floorInvSheetData.push([
        ...FLOOR_INV_COLS.map((c) => `${c.badgeId} ${c.label}`),
        'Total Emergency (kW)',
        'Total Raw (kW)',
        'Total Load (kW)',
      ]);
      for (const { row, calc, floorSlNo } of grp.entries) {
        floorInvSheetData.push([
          ...FLOOR_INV_COLS.map((col) => {
            if (col.key === 'slNo') return floorSlNo;
            if (col.type === 'number') {
              const raw = row[col.key] || '';
              const parsed = parseFloat(raw);
              return raw !== '' && !isNaN(parsed) ? parsed : 0;
            }
            return row[col.key] || '';
          }),
          fmtKw(calc.totalEmergencyDemandWatts),
          fmtKw(calc.totalRawDemandWatts),
          fmtKw(calc.totalDemandWatts),
        ]);
      }
      floorInvSheetData.push([
        ...FLOOR_INV_COLS.map((col) => {
          if (col.key === 'slNo') return '';
          if (col.key === 'room') return `${grp.floorName} TOTAL`;
          return Number((grp.colTotals[col.key] || 0).toFixed(2));
        }),
        fmtKw(grp.summary.totalEmergencyDemandW),
        fmtKw(grp.summary.totalRawDemandW),
        fmtKw(grp.summary.totalDemandW),
      ]);
    }

    const ws5 = XLSX.utils.aoa_to_sheet(floorInvSheetData);
    ws5['!cols'] = [
      ...FLOOR_INV_COLS.map((c) => ({
        wch: c.key === 'slNo' ? 8 : c.key === 'room' ? 24 : 15,
      })),
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Building Load Summary');
    XLSX.utils.book_append_sheet(wb, ws2, 'Floor-Wise Load');
    XLSX.utils.book_append_sheet(wb, ws3, 'Room-Wise Load');
    XLSX.utils.book_append_sheet(wb, ws4, 'Wattage & Item Load');
    XLSX.utils.book_append_sheet(wb, ws5, 'Floor-Wise Inventory');
    XLSX.writeFile(wb, `Building_Load_Calculation_${Date.now()}.xlsx`);
    onNotify?.('Exported Building Electrical Load & Floor-Wise Inventory to Excel (.xlsx).');
  };

  return (
    <div className="space-y-3">
      {/* Compact Page Header & Controls */}
      <div className="bg-white dark:bg-slate-900/95 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 shadow-xs dark:shadow-none space-y-2">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 shrink-0">
              <Zap className="w-3 h-3" />
              Step 3 · Building Load
            </span>
            <h2 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white truncate">
              Building Electrical Load &amp; Demand
            </h2>
            <span className="hidden xl:inline text-[11px] text-slate-600 dark:text-slate-400">
              <code className="font-mono text-cyan-700 dark:text-cyan-300">#H05–#H15</code> Conn ·{' '}
              <code className="font-mono text-amber-700 dark:text-amber-300">#H17–#H21</code> Raw/Emg ·{' '}
              <code className="font-mono text-emerald-700 dark:text-emerald-300">#H22×1500W×#H21</code>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onBackToInventory}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Inventory</span>
            </button>

            <button
              type="button"
              onClick={handleExportBuildingLoadExcel}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap"
              title="Reset diversity factors & wattages to PDF defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={onConfirmToMcbDb}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold border border-emerald-500 shadow-sm transition-all whitespace-nowrap shrink-0"
              title="Confirm Building Load & Open MCBDB Calculation Page"
            >
              <span>Confirm · MCBDB Calculation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Summary Metrics Strip (Unboxed Tabular Figures) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">Connected (#H05–#H15)</span>
            <span className="font-mono tabular-nums font-bold text-cyan-700 dark:text-cyan-300 text-sm">
              {(buildingTotals.connectedTotalW / 1000).toFixed(2)} kW
            </span>
            <span className="block text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
              × DF {settings.connectedDiversityFactor}: {(buildingTotals.connectedDemandW / 1000).toFixed(2)} kW
            </span>
          </div>

          <div>
            <span className="text-slate-600 dark:text-slate-400 block">Emergency (#H17–#H21)</span>
            <span className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300 text-sm">
              {(buildingTotals.emergencyW / 1000).toFixed(2)} kW
            </span>
            <span className="block text-[11px] font-mono tabular-nums text-amber-800 dark:text-amber-200/80">
              × DF {settings.emergencyDiversityFactor}: {(buildingTotals.emergencyDemandW / 1000).toFixed(2)} kW
            </span>
          </div>

          <div>
            <span className="text-slate-600 dark:text-slate-400 block">RAW (#H17–#H21)</span>
            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 text-sm">
              {(buildingTotals.rawW / 1000).toFixed(2)} kW
            </span>
            <span className="block text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
              {availableFloors.length} {availableFloors.length === 1 ? 'floor' : 'floors'} · {rows.length} rooms
            </span>
          </div>

          <div>
            <span className="text-amber-800 dark:text-amber-300/90 font-medium block">
              Total Emergency Load
            </span>
            <span className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300 text-sm">
              {(buildingTotals.totalEmergencyDemandW / 1000).toFixed(2)} kW
            </span>
            <span className="block text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
              Conn×DF + Emg×DF · {buildingTotals.emergencyDemandKva.toFixed(2)} kVA
            </span>
          </div>

          <div>
            <span className="text-slate-700 dark:text-slate-300 font-medium block">
              Total Raw Load
            </span>
            <span className="font-mono tabular-nums font-bold text-slate-950 dark:text-white text-sm">
              {(buildingTotals.totalRawDemandW / 1000).toFixed(2)} kW
            </span>
            <span className="block text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
              Raw×DF ({settings.rawDiversityFactor}) · {buildingTotals.rawTotalKva.toFixed(2)} kVA
            </span>
          </div>

          <div>
            <span className="text-emerald-800 dark:text-emerald-300 font-medium block">
              Total Load (Emg + Raw)
            </span>
            <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 text-sm">
              {buildingTotals.totalDemandKw.toFixed(2)} kW
            </span>
            <span className="block text-[11px] font-mono tabular-nums text-emerald-800 dark:text-emerald-200/80">
              {buildingTotals.totalKva.toFixed(2)} kVA @ PF {buildingTotals.pf.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Compact Inline Diversity Factor Summary + Collapsible Controls */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[11px] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-200">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Parameters:
              </span>
              <span>
                Conn DF: <strong className="font-mono text-cyan-700 dark:text-cyan-300">{settings.connectedDiversityFactor.toFixed(2)}</strong>
              </span>
              <span>
                Raw DF: <strong className="font-mono text-slate-950 dark:text-white">{settings.rawDiversityFactor.toFixed(2)}</strong>
              </span>
              <span>
                Emg DF: <strong className="font-mono text-amber-700 dark:text-amber-300">{settings.emergencyDiversityFactor.toFixed(2)}</strong>
              </span>
              <span>
                PF: <strong className="font-mono text-emerald-700 dark:text-emerald-300">{buildingTotals.pf.toFixed(2)}</strong>
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={settings.includeH16InConnected}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, includeH16InConnected: e.target.checked }))
                  }
                  className="rounded border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-500"
                />
                <span>
                  #H16 ({getEntryWattage(DEFAULT_WATTAGE_TABLE.find((t) => t.badgeId === 'H16')!, settings)}W)
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setShowDfControls((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-300 font-medium transition-colors"
            >
              <span>{showDfControls ? 'Hide DF Controls' : 'Edit DF & PF'}</span>
              {showDfControls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showDfControls && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Connected Load DF */}
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-cyan-800 dark:text-cyan-300 font-semibold">
                  Connected Load DF (#H05–#H15)
                </span>
                <span className="font-mono text-xs font-bold text-slate-950 dark:text-white">
                  {settings.connectedDiversityFactor.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={settings.connectedDiversityFactor}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      connectedDiversityFactor: clampDfRange(parseFloat(e.target.value), 0.1, 1),
                    }))
                  }
                  className="w-20 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-right font-mono tabular-nums text-slate-950 dark:text-white"
                />
                <div className="flex items-center gap-1">
                  {[0.7, 0.8, 1.0].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, connectedDiversityFactor: v }))
                      }
                      className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                        Math.abs(settings.connectedDiversityFactor - v) < 0.001
                          ? 'bg-cyan-600 text-white border-cyan-600 dark:border-cyan-500'
                          : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RAW Power DF (0.5 - 0.7) */}
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-800 dark:text-slate-200 font-semibold">
                  RAW Power DF (#H17–#H21)
                </span>
                <span className="font-mono text-xs font-bold text-slate-950 dark:text-white">
                  {settings.rawDiversityFactor.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.5"
                  max="0.7"
                  step="0.05"
                  value={settings.rawDiversityFactor}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      rawDiversityFactor: clampDfRange(parseFloat(e.target.value), 0.5, 0.7),
                    }))
                  }
                  className="w-20 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-right font-mono tabular-nums text-slate-950 dark:text-white"
                />
                <div className="flex items-center gap-1">
                  {[0.5, 0.6, 0.7].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, rawDiversityFactor: v }))}
                      className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                        Math.abs(settings.rawDiversityFactor - v) < 0.001
                          ? 'bg-emerald-600 text-white border-emerald-600 dark:border-emerald-500'
                          : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Emergency Power DF (0.5 - 0.7) */}
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                  Emergency DF (#H17–#H21)
                </span>
                <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-200">
                  {settings.emergencyDiversityFactor.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.5"
                  max="0.7"
                  step="0.05"
                  value={settings.emergencyDiversityFactor}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      emergencyDiversityFactor: clampDfRange(parseFloat(e.target.value), 0.5, 0.7),
                    }))
                  }
                  className="w-20 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-right font-mono tabular-nums text-amber-800 dark:text-amber-200"
                />
                <div className="flex items-center gap-1">
                  {[0.5, 0.6, 0.7].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, emergencyDiversityFactor: v }))
                      }
                      className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                        Math.abs(settings.emergencyDiversityFactor - v) < 0.001
                          ? 'bg-amber-600 text-white border-amber-600 dark:border-amber-500'
                          : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Power Factor */}
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                  Power Factor (cos φ → kVA)
                </span>
                <span className="font-mono text-xs font-bold text-slate-950 dark:text-white">
                  {buildingTotals.pf.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.6"
                  max="1"
                  step="0.05"
                  value={settings.powerFactor}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      powerFactor: clampDfRange(parseFloat(e.target.value), 0.6, 1),
                    }))
                  }
                  className="w-20 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-right font-mono tabular-nums text-slate-950 dark:text-white"
                />
                <div className="flex items-center gap-1">
                  {[0.8, 0.85, 0.9].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, powerFactor: v }))}
                      className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                        Math.abs(settings.powerFactor - v) < 0.001
                          ? 'bg-emerald-600 text-white border-emerald-600 dark:border-emerald-500'
                          : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
          )}
        </div>
      </div>

      {/* Main Content Card with Segmented Tabs + Floor Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
        <div className="p-3.5 sm:px-5 border-b border-slate-300 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('floor-wise')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'floor-wise'
                  ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Floor-Wise Summary ({availableFloors.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('room-wise')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'room-wise'
                  ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Room-Wise Breakdown ({rows.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('wattage-table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'wattage-table'
                  ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs dark:shadow-none'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
              }`}
            >
              <Table2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Wattage Table &amp; Item Load (#H05–#H21)</span>
            </button>
          </div>

          {activeTab !== 'floor-wise' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-400">Filter Floor:</span>
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Floors ({rows.length} rooms)</option>
                {availableFloors.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Floor-Wise Summary */}
        {activeTab === 'floor-wise' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Floor</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Rooms</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Area (m²)</th>
                  <th className="py-2.5 px-3 font-semibold text-right text-cyan-800 dark:text-cyan-300">
                    Conn. ×{settings.connectedDiversityFactor} (kW)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right text-amber-800 dark:text-amber-200">
                    Emg ×{settings.emergencyDiversityFactor} (kW)
                  </th>
                  <th
                    className="py-2.5 px-3 font-semibold text-right text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20"
                    title="Total Emergency Load = Connected Load × DF + Emergency Load × DF"
                  >
                    Total Emg Load (kW)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right text-slate-700 dark:text-slate-300">
                    Raw #H17–#H21 (kW)
                  </th>
                  <th
                    className="py-2.5 px-3 font-semibold text-right text-slate-950 dark:text-white bg-slate-200/70 dark:bg-slate-900"
                    title="Total Raw Load = Raw Load × DF"
                  >
                    Total Raw Load (kW)
                  </th>
                  <th
                    className="py-2.5 px-3 font-semibold text-right text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
                    title="Total Load = Total Emergency Load + Total Raw Load"
                  >
                    Total Load (kW)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right text-emerald-700 dark:text-emerald-400">
                    Est. kVA
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono tabular-nums">
                {floorSummaries.map((f) => (
                  <tr key={f.floorName} className="hover:bg-slate-50 dark:hover:bg-slate-800/35 transition-colors">
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-950 dark:text-white">
                      <button
                        type="button"
                        onClick={() => {
                          setCollapsedFloors((prev) => {
                            const next = new Set(prev);
                            next.delete(f.floorName);
                            return next;
                          });
                          setInventoryFloorFilter('ALL');
                          document
                            .getElementById(floorAnchorId(f.floorName))
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="text-left hover:text-emerald-700 dark:hover:text-emerald-300 underline decoration-slate-400 dark:decoration-slate-700 hover:decoration-emerald-500 dark:hover:decoration-emerald-400 underline-offset-4 transition-colors"
                        title={`Jump to ${f.floorName} separated inventory table`}
                      >
                        {f.floorName}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">{f.rooms}</td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {f.areaSqm.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-700 dark:text-cyan-300">
                      {(f.connectedDemandW / 1000).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-800 dark:text-amber-200">
                      {(f.emergencyDemandW / 1000).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/10">
                      {(f.totalEmergencyDemandW / 1000).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {(f.rawW / 1000).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-950 dark:text-white bg-slate-100/70 dark:bg-slate-900/50">
                      {(f.totalRawDemandW / 1000).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/10">
                      {(f.totalDemandW / 1000).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                      {f.kva.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-300 dark:border-slate-700 font-mono tabular-nums font-bold">
                <tr>
                  <td className="py-2.5 px-3 font-sans uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Building Total
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-950 dark:text-white">{rows.length}</td>
                  <td className="py-2.5 px-3 text-right text-slate-950 dark:text-white">
                    {buildingTotals.areaSqm.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-cyan-700 dark:text-cyan-300">
                    {(buildingTotals.connectedDemandW / 1000).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-800 dark:text-amber-200">
                    {(buildingTotals.emergencyDemandW / 1000).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20">
                    {(buildingTotals.totalEmergencyDemandW / 1000).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-800 dark:text-slate-200">
                    {(buildingTotals.rawW / 1000).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-950 dark:text-white bg-slate-200/70 dark:bg-slate-900">
                    {(buildingTotals.totalRawDemandW / 1000).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
                    {buildingTotals.totalDemandKw.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
                    {buildingTotals.totalKva.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Tab 2: Room-Wise Load Breakdown */}
        {activeTab === 'room-wise' && (
          <div className="overflow-x-auto max-h-[62vh] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">Sl.</th>
                  <th className="py-2.5 px-3 min-w-[120px]">Floor</th>
                  <th className="py-2.5 px-3 min-w-[150px]">Room</th>
                  <th className="py-2.5 px-3 text-right">Area (m²)</th>
                  <th className="py-2.5 px-3 text-right text-cyan-800 dark:text-cyan-300">
                    Conn. ×DF (W)
                  </th>
                  <th className="py-2.5 px-3 text-right text-sky-800 dark:text-sky-300">
                    AC (#H22×1500×#H21)
                  </th>
                  <th className="py-2.5 px-3 text-right text-amber-800 dark:text-amber-200">
                    Emg ×DF (W)
                  </th>
                  <th
                    className="py-2.5 px-3 text-right text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20"
                    title="Total Emergency Load = Connected*DF + Emergency*DF"
                  >
                    Total Emg Load (kW)
                  </th>
                  <th className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">Raw (W)</th>
                  <th
                    className="py-2.5 px-3 text-right text-slate-950 dark:text-white bg-slate-200/70 dark:bg-slate-900"
                    title="Total Raw Load = Raw Load * DF"
                  >
                    Total Raw Load (kW)
                  </th>
                  <th
                    className="py-2.5 px-3 text-right text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
                    title="Total Load = Total Emergency Load + Total Raw Load"
                  >
                    Total Load (kW)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono tabular-nums">
                {filteredRoomLoads.map((r, idx) => (
                  <tr key={r.rowId} className="hover:bg-slate-50 dark:hover:bg-slate-800/35 transition-colors">
                    <td className="py-2 px-3 text-center text-emerald-700 dark:text-emerald-400 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-700 dark:text-slate-300">{r.floor}</td>
                    <td className="py-2 px-3 font-sans">
                      <div className="font-semibold text-slate-950 dark:text-white">{r.room}</div>
                      {(r.luxCategoryLabel || r.targetLux > 0) && (
                        <div className="text-[10px] text-amber-700 dark:text-amber-300/90 mt-0.5">
                          {r.luxCategoryLabel ? r.luxCategoryLabel : 'Custom Lux'}
                          {r.targetLux > 0 ? ` · ${r.targetLux} lx` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {r.areaSqm > 0 ? r.areaSqm.toFixed(1) : '–'}
                    </td>
                    <td className="py-2 px-3 text-right text-cyan-700 dark:text-cyan-300">
                      <div>{Math.round(r.connectedDemandWatts).toLocaleString()}</div>
                      {r.lightingWatts > 0 && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          Lights: {Math.round(r.lightingWatts).toLocaleString()} W
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-sky-700 dark:text-sky-300">
                      {r.acQty > 0 ? (
                        <div>
                          <div>{Math.round(r.acWatts).toLocaleString()} W</div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-400">
                            {r.acTonnagePerUnit}T × {r.acQty}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">–</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-800 dark:text-amber-200">
                      {Math.round(r.emergencyDemandWatts).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/10">
                      {(r.totalEmergencyDemandWatts / 1000).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {Math.round(r.rawWattsH17H21).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-950 dark:text-white bg-slate-100/70 dark:bg-slate-900/50">
                      {(r.totalRawDemandWatts / 1000).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-50/70 dark:bg-emerald-950/10">
                      {(r.totalDemandWatts / 1000).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Editable Wattage Table & Item-Wise Load */}
        {activeTab === 'wattage-table' && (
          <div className="overflow-x-auto max-h-[62vh] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">Sl.</th>
                  <th className="py-2.5 px-3">Header</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Item Description</th>
                  <th className="py-2.5 px-3">Load Classification</th>
                  <th className="py-2.5 px-3 text-right min-w-[115px]">Unit Wattage (W)</th>
                  <th className="py-2.5 px-3 text-right">Raw Qty</th>
                  <th className="py-2.5 px-3 text-right text-amber-800 dark:text-amber-300">Emg Qty</th>
                  <th className="py-2.5 px-3 text-right">Total Qty</th>
                  <th className="py-2.5 px-3 text-right">Connected (kW)</th>
                  <th className="py-2.5 px-3 text-right">DF</th>
                  <th className="py-2.5 px-3 text-right text-emerald-800 dark:text-emerald-300">Demand (kW)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {itemLoadBreakdown.map((item) => {
                  const isConnected = item.entry.group === 'connected';
                  const isSocket5a = item.entry.group === 'socket_5a';
                  return (
                    <tr key={item.entry.badgeId} className="hover:bg-slate-50 dark:hover:bg-slate-800/35 transition-colors">
                      <td className="py-2 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                        {item.slNo}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {item.isAcEntry ? '#H21 · #H22' : `#${item.entry.badgeId}`}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-950 dark:text-white">
                        <div>{item.entry.itemLabel}</div>
                        {item.entry.pdfReferenceNote && (
                          <div className="text-[10px] text-slate-600 dark:text-slate-400">
                            {item.entry.pdfReferenceNote}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-[11px]">
                        {isConnected ? (
                          <span className="text-cyan-700 dark:text-cyan-300 font-medium">
                            Connected Load (DF {settings.connectedDiversityFactor})
                          </span>
                        ) : isSocket5a ? (
                          <span className="text-slate-600 dark:text-slate-400">
                            5A Socket ({settings.includeH16InConnected ? 'Included' : 'Excluded'})
                          </span>
                        ) : (
                          <span className="text-amber-800 dark:text-amber-300 font-medium">
                            RAW ({settings.rawDiversityFactor}) / Emergency ({settings.emergencyDiversityFactor})
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitW}
                            onChange={(e) =>
                              handleWattageOverride(item.entry.badgeId, e.target.value)
                            }
                            className="w-24 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-400 rounded px-2 py-1 text-right font-mono tabular-nums text-xs text-slate-950 dark:text-white focus:outline-none"
                          />
                          <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 w-9 text-left">
                            {item.isAcEntry ? 'W/ton' : 'W'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        <div>{item.rawQty}</div>
                        {item.isAcEntry && item.rawTr > 0 && (
                          <div className="text-[10px] text-slate-600 dark:text-slate-400">{item.rawTr.toFixed(1)} TR</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-800 dark:text-amber-300">
                        <div>{item.emergencyQty}</div>
                        {item.isAcEntry && item.emergencyTr > 0 && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-200/80">
                            {item.emergencyTr.toFixed(1)} TR
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-950 dark:text-white">
                        <div>{item.totalQty}</div>
                        {item.isAcEntry && item.totalTr > 0 && (
                          <div className="text-[10px] text-cyan-700 dark:text-cyan-300">{item.totalTr.toFixed(1)} TR</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {(item.connectedWatts / 1000).toFixed(3)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {item.dfDisplay}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300">
                        {(item.demandWatts / 1000).toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floor-Wise Separated Inventory Tables Section */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-xl p-4 sm:px-5 flex flex-wrap items-center justify-between gap-3 shadow-xs dark:shadow-none">
          <div className="space-y-0.5">
            <h3 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Floor-Wise Separated Inventory Tables</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Submitted inventory split by floor with column totals (<code className="font-mono text-emerald-700 dark:text-emerald-300">#H05–#H22</code>) and per-room connected, RAW, emergency &amp; demand loads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={inventoryFloorFilter}
              onChange={(e) => setInventoryFloorFilter(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Floors ({availableFloors.length})</option>
              {availableFloors.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setCollapsedFloors(new Set())}
              className="px-2.5 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-medium"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => setCollapsedFloors(new Set(availableFloors))}
              className="px-2.5 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-medium"
            >
              Collapse All
            </button>
          </div>
        </div>

        {floorGroupedInventory
          .filter((grp) => inventoryFloorFilter === 'ALL' || grp.floorName === inventoryFloorFilter)
          .map((grp) => {
            const isCollapsed = collapsedFloors.has(grp.floorName);
            return (
              <div
                key={grp.floorName}
                id={floorAnchorId(grp.floorName)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-md scroll-mt-20"
              >
                {/* Floor Card Header */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/90 border-b border-slate-300 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleFloorCollapse(grp.floorName)}
                      className="inline-flex items-center gap-2 text-left text-slate-950 dark:text-white hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-bold text-sm">{grp.floorName}</span>
                    </button>
                    <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {grp.entries.length} {grp.entries.length === 1 ? 'room' : 'rooms'} · {grp.summary.areaSqm.toFixed(1)} m²
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                    <span className="text-amber-800 dark:text-amber-300">
                      Total Emergency: <strong>{(grp.summary.totalEmergencyDemandW / 1000).toFixed(2)} kW</strong>
                    </span>
                    <span className="text-slate-800 dark:text-slate-200">
                      Total Raw: <strong>{(grp.summary.totalRawDemandW / 1000).toFixed(2)} kW</strong>
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                      Total Load: {(grp.summary.totalDemandW / 1000).toFixed(2)} kW ({grp.summary.kva.toFixed(2)} kVA)
                    </span>
                  </div>
                </div>

                {/* Separated Inventory Table for this Floor */}
                {!isCollapsed && (
                  <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-950/95 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 sticky top-0 z-10">
                        <tr>
                          {FLOOR_INV_COLS.map((col) => {
                            const isConn = [
                              'H05',
                              'H06',
                              'H07',
                              'H08',
                              'H09',
                              'H10',
                              'H11',
                              'H12',
                              'H13',
                              'H14',
                              'H15',
                            ].includes(col.badgeId);
                            const isRawEmg = RAW_EMG_KEYS.has(col.key);
                            return (
                              <th
                                key={col.id}
                                className={`py-2 px-2.5 border-r border-slate-300 dark:border-slate-800 align-top ${
                                  col.key === 'slNo'
                                    ? 'text-center w-12'
                                    : col.type === 'number'
                                    ? 'text-right min-w-[78px]'
                                    : 'min-w-[140px]'
                                }`}
                              >
                                <span
                                  className={`inline-block font-mono text-[10px] px-1 rounded mb-0.5 border ${
                                    isRawEmg
                                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                                      : isConn
                                      ? 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/30'
                                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                                  }`}
                                >
                                  {col.badgeId}
                                </span>
                                <div className="font-semibold text-[11px] leading-tight text-slate-900 dark:text-slate-100">
                                  {col.label}
                                </div>
                              </th>
                            );
                          })}
                          <th
                            className="py-2 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right min-w-[105px] bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 font-semibold"
                            title="Total Emergency Load = Connected*DF + Emergency*DF"
                          >
                            Total Emg (kW)
                          </th>
                          <th
                            className="py-2 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right min-w-[98px] bg-slate-200/70 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold"
                            title="Total Raw Load = Raw Load * DF"
                          >
                            Total Raw (kW)
                          </th>
                          <th
                            className="py-2 px-2.5 text-right min-w-[108px] bg-emerald-50 dark:bg-emerald-950/25 text-emerald-800 dark:text-emerald-300 font-bold"
                            title="Total Load = Total Emergency Load + Total Raw Load"
                          >
                            Total Load (kW)
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono tabular-nums">
                        {grp.entries.map(({ row, calc, floorSlNo }) => (
                          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/35 transition-colors">
                            {FLOOR_INV_COLS.map((col) => {
                              if (col.key === 'slNo') {
                                return (
                                  <td
                                    key={col.id}
                                    className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800/80 text-center text-emerald-700 dark:text-emerald-400 font-bold"
                                  >
                                    {floorSlNo}
                                  </td>
                                );
                              }
                              if (col.key === 'room') {
                                return (
                                  <td
                                    key={col.id}
                                    className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800/80 font-sans font-semibold text-slate-950 dark:text-white"
                                  >
                                    {row.room || `Room ${floorSlNo}`}
                                  </td>
                                );
                              }

                              const rawVal = row[col.key] || '';
                              const num = nQty(rawVal);
                              const isRawEmg = RAW_EMG_KEYS.has(col.key);
                              const isEmg =
                                isRawEmg &&
                                row.powerSources?.[col.key as RawEmergencyColumnKey] === 'emergency';

                              return (
                                <td
                                  key={col.id}
                                  className={`py-2 px-2.5 border-r border-slate-200 dark:border-slate-800/80 text-right ${
                                    isEmg && num > 0
                                      ? 'bg-amber-50/70 dark:bg-amber-950/15 text-amber-800 dark:text-amber-200'
                                      : num > 0
                                      ? 'text-slate-900 dark:text-slate-100'
                                      : 'text-slate-400 dark:text-slate-600'
                                  }`}
                                >
                                  <div>{rawVal !== '' && num > 0 ? rawVal : '–'}</div>
                                  {isRawEmg && num > 0 && (
                                    <div
                                      className={`text-[9px] font-semibold ${
                                        isEmg ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      {isEmg ? 'EMG' : 'RAW'}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800/80 text-right font-semibold text-amber-800 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/10">
                              {(calc.totalEmergencyDemandWatts / 1000).toFixed(2)}
                            </td>
                            <td className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800/80 text-right font-semibold text-slate-950 dark:text-white bg-slate-100/60 dark:bg-slate-900/40">
                              {(calc.totalRawDemandWatts / 1000).toFixed(2)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/10">
                              {(calc.totalDemandWatts / 1000).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      <tfoot className="bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-300 dark:border-slate-700 font-mono tabular-nums font-bold">
                        <tr>
                          {FLOOR_INV_COLS.map((col) => {
                            if (col.key === 'slNo') {
                              return (
                                <td
                                  key={col.id}
                                  className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-center text-slate-600 dark:text-slate-400"
                                >
                                  Σ
                                </td>
                              );
                            }
                            if (col.key === 'room') {
                              return (
                                <td
                                  key={col.id}
                                  className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 font-sans text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
                                >
                                  {grp.floorName} Total
                                </td>
                              );
                            }
                            const tot = grp.colTotals[col.key] || 0;
                            const split = grp.splitTotals[col.key];
                            const isTonnage = col.key === 'tonnage';
                            const fmt = (n: number) =>
                              isTonnage
                                ? `${Number(n.toFixed(2))} TR`
                                : Number.isInteger(n)
                                ? n
                                : Number(n.toFixed(2));
                            return (
                              <td
                                key={col.id}
                                className="py-2 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right align-top text-emerald-700 dark:text-emerald-300"
                              >
                                <div>{tot > 0 ? fmt(tot) : '0'}</div>
                                {split && tot > 0 && (
                                  <div className="text-[9px] font-medium leading-tight mt-0.5">
                                    <div className="text-slate-600 dark:text-slate-400">R:{fmt(split.raw)}</div>
                                    {split.emergency > 0 && (
                                      <div className="text-amber-700 dark:text-amber-300">E:{fmt(split.emergency)}</div>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20">
                            {(grp.summary.totalEmergencyDemandW / 1000).toFixed(2)} kW
                          </td>
                          <td className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 text-right text-slate-950 dark:text-white bg-slate-200/70 dark:bg-slate-900">
                            {(grp.summary.totalRawDemandW / 1000).toFixed(2)} kW
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
                            {(grp.summary.totalDemandW / 1000).toFixed(2)} kW
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
