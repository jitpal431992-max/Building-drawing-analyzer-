import React, { useState } from 'react';
import {
  ThermometerSnowflake,
  Wind,
  RefreshCw,
  SlidersHorizontal,
  Table2,
  BarChart3,
} from 'lucide-react';
import {
  CoolingExposureType,
  InventoryRow,
  VentilationRoomType,
} from '../types';
import {
  COOLING_LOAD_REFERENCE_CHART,
  DEFAULT_HVAC_SETTINGS,
  EXPOSURE_PRESETS,
  FAN_EXHAUST_SPECS,
  HvacDesignSettings,
  RowHvacCalc,
} from '../data/hvacStandards';

interface CoolingLoadChartSectionProps {
  rows: InventoryRow[];
  rowHvacCalcs: RowHvacCalc[];
  hvacSettings: HvacDesignSettings;
  onUpdateHvacSettings: (next: HvacDesignSettings) => void;
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  onUpdateRowField: (
    rowId: string,
    patch: Partial<InventoryRow>,
    skipAutoSync?: boolean
  ) => void;
  onSyncAllToInventory: () => void;
  onSyncSingleRowToInventory: (rowId: string) => void;
}

export const CoolingLoadChartSection: React.FC<CoolingLoadChartSectionProps> = ({
  rows,
  rowHvacCalcs,
  hvacSettings,
  onUpdateHvacSettings,
  autoSyncEnabled,
  onToggleAutoSync,
  onUpdateRowField,
  onSyncAllToInventory,
  onSyncSingleRowToInventory,
}) => {
  const [activeTab, setActiveTab] = useState<'room-chart' | 'reference-chart'>('room-chart');
  const [showParameters, setShowParameters] = useState(false);

  const acRoomsCount = rowHvacCalcs.filter((c) => c.acEnabled).length;
  const toiletCount = rowHvacCalcs.filter((c) => c.effectiveVentType === 'toilet').length;
  const totalRoomCfm = rowHvacCalcs.reduce((sum, c) => sum + c.requiredCfm, 0);
  const totalExhaustCfm = rowHvacCalcs.reduce((sum, c) => sum + c.deliveredExhaustCfm, 0);
  const totalBtuHr = rowHvacCalcs.reduce((sum, c) => sum + c.totalBtuHr, 0);
  const totalCalcTr = rowHvacCalcs.reduce((sum, c) => sum + c.calculatedTr, 0);
  const totalRecUnits = rowHvacCalcs.reduce((sum, c) => sum + c.recNoOfAc, 0);
  const totalRecTonnage = rowHvacCalcs.reduce((sum, c) => sum + c.recTonnage, 0);

  return (
    <section
      id="cooling-load-chart-section"
      className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none"
    >
      {/* Section Header & Actions */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-cyan-700 dark:text-cyan-300">Cooling Load &amp; Ventilation Chart</span>
              <span aria-hidden="true">·</span>
              <span>Room-wise CFM, Toilet Exhaust (#H10–#H14) &amp; AC Sizing (#H21–#H22)</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <ThermometerSnowflake className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>Cooling Load Chart &amp; HVAC / CFM Sizing</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Segmented Tab Controls */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('room-chart')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'room-chart'
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs dark:shadow-none'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Room-wise Chart</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reference-chart')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'reference-chart'
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs dark:shadow-none'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
                }`}
              >
                <Table2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>IS / Standard Reference Chart</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowParameters(!showParameters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                showParameters
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-950 dark:text-white border-slate-400 dark:border-slate-600'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Design Factors</span>
            </button>

            <button
              type="button"
              onClick={onSyncAllToInventory}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold border border-cyan-500 dark:border-cyan-400/30 whitespace-nowrap transition-colors"
              title="Recalculate and update #H10-#H14 (Fans/Exhaust) and #H21-#H22 (AC/Tonnage) across all rows"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Update #H10–#H14 &amp; #H21–#H22</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Strip (Unboxed Tabular Figures) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">AC Conditioned Rooms</span>
            <span className="font-mono tabular-nums font-bold text-slate-950 dark:text-white text-sm">
              {acRoomsCount} / {rows.length}
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">Toilets / Exhaust Zones</span>
            <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300 text-sm">
              {toiletCount} {toiletCount === 1 ? 'zone' : 'zones'}
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">Total Room Vent CFM</span>
            <span className="font-mono tabular-nums font-bold text-sky-700 dark:text-sky-300 text-sm">
              {Math.round(totalRoomCfm).toLocaleString()} CFM
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">Installed Exhaust CFM</span>
            <span className="font-mono tabular-nums font-bold text-teal-700 dark:text-teal-300 text-sm">
              {Math.round(totalExhaustCfm).toLocaleString()} CFM
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">Calculated Cooling Load</span>
            <span className="font-mono tabular-nums font-bold text-cyan-700 dark:text-cyan-300 text-sm">
              {totalCalcTr.toFixed(2)} TR ({Math.round(totalBtuHr).toLocaleString()} BTU/h)
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">Sized AC (#H21 / #H22)</span>
            <span className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300 text-sm">
              {totalRecUnits} nos. · {totalRecTonnage.toFixed(1)} TR
            </span>
          </div>
        </div>

        {/* Collapsible HVAC & Cooling Load Parameters */}
        {showParameters && (
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="font-semibold text-cyan-800 dark:text-cyan-300">
                HVAC Formula: CFM = (Area ft² × Height ft × ACH) ÷ 60 · TR = Total BTU/hr ÷ 12,000
              </span>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={(e) => onToggleAutoSync(e.target.checked)}
                    className="rounded border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-500"
                  />
                  <span>Auto-update #H10–#H14 &amp; #H21–#H22 on edit</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hvacSettings.keepFansInAcRoom}
                    onChange={(e) =>
                      onUpdateHvacSettings({ ...hvacSettings, keepFansInAcRoom: e.target.checked })
                    }
                    className="rounded border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-500"
                  />
                  <span>Keep ceiling fans in AC rooms</span>
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateHvacSettings(DEFAULT_HVAC_SETTINGS)}
                  className="text-[11px] text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white underline"
                >
                  Reset Defaults
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">Default Ht (ft)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  step="any"
                  value={hvacSettings.defaultHeightFt}
                  onChange={(e) =>
                    onUpdateHvacSettings({
                      ...hvacSettings,
                      defaultHeightFt: parseFloat(e.target.value) || 10,
                    })
                  }
                  className="w-full min-w-[76px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono tabular-nums text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">Room ACH</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={hvacSettings.generalAch}
                  onChange={(e) =>
                    onUpdateHvacSettings({
                      ...hvacSettings,
                      generalAch: parseFloat(e.target.value) || 6,
                    })
                  }
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono tabular-nums text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">Toilet ACH</label>
                <input
                  type="number"
                  min="4"
                  max="30"
                  value={hvacSettings.toiletAch}
                  onChange={(e) =>
                    onUpdateHvacSettings({
                      ...hvacSettings,
                      toiletAch: parseFloat(e.target.value) || 12,
                    })
                  }
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono tabular-nums text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">225mm Exh (CFM)</label>
                <input
                  type="number"
                  min="100"
                  value={hvacSettings.cfm225Exhaust}
                  onChange={(e) =>
                    onUpdateHvacSettings({
                      ...hvacSettings,
                      cfm225Exhaust: parseFloat(e.target.value) || 350,
                    })
                  }
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono tabular-nums text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">300mm Exh (CFM)</label>
                <input
                  type="number"
                  min="100"
                  value={hvacSettings.cfm300Exhaust}
                  onChange={(e) =>
                    onUpdateHvacSettings({
                      ...hvacSettings,
                      cfm300Exhaust: parseFloat(e.target.value) || 650,
                    })
                  }
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono tabular-nums text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">BTU / Person</label>
                <input
                  type="number"
                  min="200"
                  value={hvacSettings.btuPerPerson}
                  onChange={(e) =>
                    onUpdateHvacSettings({
                      ...hvacSettings,
                      btuPerPerson: parseFloat(e.target.value) || 450,
                    })
                  }
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono tabular-nums text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">Safety Factor (%)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={hvacSettings.safetyFactorPct}
                  onChange={(e) =>
                    onUpdateHvacSettings({
                      ...hvacSettings,
                      safetyFactorPct: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono tabular-nums text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">AC Unit Rating</label>
                <select
                  value={hvacSettings.preferredAcUnitTr}
                  onChange={(e) =>
                    onUpdateHvacSettings({
                      ...hvacSettings,
                      preferredAcUnitTr: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-slate-950 dark:text-white"
                >
                  <option value={0}>Auto (1 / 1.5 / 2 / 3 TR)</option>
                  <option value={1}>Fixed 1.0 TR</option>
                  <option value={1.5}>Fixed 1.5 TR</option>
                  <option value={2}>Fixed 2.0 TR</option>
                  <option value={3}>Fixed 3.0 TR</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'room-chart' ? (
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 font-semibold w-12 text-center">Sl.</th>
                <th className="py-2.5 px-3 font-semibold min-w-[140px]">Room</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Area (m² / ft²)</th>
                <th className="py-2.5 px-3 font-semibold min-w-[130px]">Ventilation Mode</th>
                <th className="py-2.5 px-3 font-semibold min-w-[105px]">AC Required?</th>
                <th className="py-2.5 px-3 font-semibold min-w-[104px] text-right whitespace-nowrap">Ht (ft)</th>
                <th className="py-2.5 px-3 font-semibold min-w-[92px] text-right whitespace-nowrap">People</th>
                <th className="py-2.5 px-3 font-semibold min-w-[165px]">Solar / Exposure</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">CFM (#H10–#H14)</th>
                <th className="py-2.5 px-3 font-semibold min-w-[210px]">Heat Gain Breakdown (BTU/hr)</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Cooling Load</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">AC (#H21 · #H22)</th>
                <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {rows.map((row, idx) => {
                const c = rowHvacCalcs[idx];
                const totalBaseBtu =
                  c.envelopeBtu + c.occupantBtu + c.lightingBtu + c.equipmentBtu || 1;
                const envPct = (c.envelopeBtu / totalBaseBtu) * 100;
                const occPct = (c.occupantBtu / totalBaseBtu) * 100;
                const lightPct = (c.lightingBtu / totalBaseBtu) * 100;
                const eqPct = (c.equipmentBtu / totalBaseBtu) * 100;

                return (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/35 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-950 dark:text-white truncate max-w-[160px]" title={row.room || `Room ${idx + 1}`}>
                        {row.room || `Room ${idx + 1}`}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {c.effectiveVentType === 'toilet'
                          ? `Toilet · ${c.achUsed} ACH`
                          : c.effectiveVentType === 'kitchen_lab'
                          ? `Kitchen/Lab · ${c.achUsed} ACH`
                          : `General · ${c.achUsed} ACH`}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {c.areaSqm > 0 ? (
                        <div>
                          <div className="text-slate-900 dark:text-slate-100 font-semibold">{c.areaSqm.toFixed(1)} m²</div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">{Math.round(c.areaSqft)} ft²</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">–</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={c.effectiveVentType}
                        onChange={(e) => {
                          const nextVent = e.target.value as VentilationRoomType;
                          onUpdateRowField(row.id, {
                            ventType: nextVent,
                            acRequired: nextVent === 'toilet' ? 'no' : row.acRequired,
                          });
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-cyan-500 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-200 focus:outline-none"
                      >
                        <option value="general">General Room</option>
                        <option value="toilet">Toilet / Washroom</option>
                        <option value="kitchen_lab">Kitchen / Lab</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="inline-flex items-center p-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => onUpdateRowField(row.id, { acRequired: 'yes' })}
                          className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                            c.acEnabled
                              ? 'bg-cyan-600 text-white'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateRowField(row.id, { acRequired: 'no' })}
                          className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                            !c.acEnabled
                              ? 'bg-slate-700 text-white'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 min-w-[104px]">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="any"
                        value={row.ceilingHeightFt ?? ''}
                        placeholder={String(hvacSettings.defaultHeightFt)}
                        onChange={(e) =>
                          onUpdateRowField(row.id, { ceilingHeightFt: e.target.value })
                        }
                        aria-label={`Ceiling height in ft for ${row.room || `Room ${idx + 1}`}`}
                        className="w-full min-w-[84px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 focus:border-cyan-500 rounded px-2.5 py-1.5 text-right font-mono tabular-nums text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-2.5 min-w-[92px]">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.occupants ?? ''}
                        placeholder={c.areaSqft > 0 ? String(c.effectiveOccupants) : '0'}
                        onChange={(e) => onUpdateRowField(row.id, { occupants: e.target.value })}
                        aria-label={`Occupants count for ${row.room || `Room ${idx + 1}`}`}
                        className="w-full min-w-[74px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 focus:border-cyan-500 rounded px-2.5 py-1.5 text-right font-mono tabular-nums text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <select
                        value={row.exposureType || 'normal'}
                        disabled={!c.acEnabled}
                        onChange={(e) =>
                          onUpdateRowField(row.id, {
                            exposureType: e.target.value as CoolingExposureType,
                          })
                        }
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-cyan-500 disabled:opacity-40 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-200 focus:outline-none"
                      >
                        {EXPOSURE_PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.shortLabel}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {c.areaSqm > 0 ? (
                        <div>
                          <div className="text-sky-700 dark:text-sky-300 font-semibold">
                            {Math.round(c.requiredCfm).toLocaleString()} CFM
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">
                            {c.effectiveVentType === 'toilet'
                              ? `H13:${c.recH13} · H14:${c.recH14}`
                              : `H10:${c.recH10} · H11:${c.recH11} · H12:${c.recH12}`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">–</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {!c.acEnabled ? (
                        <span className="text-[11px] text-slate-500">
                          No AC selected for this room
                        </span>
                      ) : c.areaSqm <= 0 ? (
                        <span className="text-[11px] text-slate-500">Enter SQMT / Sqft above</span>
                      ) : (
                        <div className="space-y-1">
                          <div className="w-full h-2 rounded bg-slate-200 dark:bg-slate-950 overflow-hidden flex">
                            <div
                              style={{ width: `${envPct}%` }}
                              className="bg-cyan-500"
                              title={`Envelope/Solar: ${Math.round(c.envelopeBtu).toLocaleString()} BTU/hr`}
                            />
                            <div
                              style={{ width: `${occPct}%` }}
                              className="bg-amber-400"
                              title={`People (${c.effectiveOccupants}): ${Math.round(c.occupantBtu).toLocaleString()} BTU/hr`}
                            />
                            <div
                              style={{ width: `${lightPct}%` }}
                              className="bg-emerald-400"
                              title={`Lights (${c.lightingWatts}W): ${Math.round(c.lightingBtu).toLocaleString()} BTU/hr`}
                            />
                            <div
                              style={{ width: `${eqPct}%` }}
                              className="bg-rose-400"
                              title={`Equipment (${c.equipmentWatts}W): ${Math.round(c.equipmentBtu).toLocaleString()} BTU/hr`}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            <span>Env {Math.round(c.envelopeBtu)}</span>
                            <span>Ppl {Math.round(c.occupantBtu)}</span>
                            <span>Lgt {Math.round(c.lightingBtu)}</span>
                            <span>Eqp {Math.round(c.equipmentBtu)}</span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {c.acEnabled && c.areaSqm > 0 ? (
                        <div>
                          <div className="font-bold text-cyan-700 dark:text-cyan-300">{c.calculatedTr.toFixed(2)} TR</div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">
                            {Math.round(c.totalBtuHr).toLocaleString()} BTU/h
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">0.00 TR</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {c.acEnabled && c.areaSqm > 0 ? (
                        <div>
                          <div className="font-bold text-amber-700 dark:text-amber-300">
                            {c.recNoOfAc} AC · {c.recTonnage.toFixed(1)} TR
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">
                            Inv: H21={row.noOfAc || '0'} · H22={row.tonnage || '0'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          H21={row.noOfAc || '0'} · H22={row.tonnage || '0'}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onSyncSingleRowToInventory(row.id)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-cyan-600 text-slate-800 dark:bg-slate-800 dark:text-slate-200 hover:text-white border border-slate-300 dark:border-slate-700 text-[11px] font-medium whitespace-nowrap transition-colors"
                        title="Copy calculated #H10-#H14 & #H21-#H22 into this inventory row"
                      >
                        Sync Row
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Heat-Load Legend */}
          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-medium text-slate-800 dark:text-slate-300">Heat Load Bar Legend:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500 inline-block" /> Envelope / Solar
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block" /> Occupants
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 inline-block" /> Lights (#H05–#H09, #H15)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-400 inline-block" /> Computers / Sockets (#H18–#H20)
              </span>
            </div>
            <span>1 Ton of Refrigeration (TR) = 12,000 BTU/hr = 3.517 kW</span>
          </div>
        </div>
      ) : (
        /* Tab 2: Standard Cooling Load Reference Chart & Ventilation Table */
        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                Standard Area-Wise Cooling Load Chart (10 ft Ceiling Height)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                CPWD / ISHRAE thumb-rule reference showing Tonnage (TR) across room area &amp; thermal exposure.
              </p>
            </div>
            <div className="border border-slate-300 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Area (sq.ft)</th>
                    <th className="py-2 px-3">Area (m²)</th>
                    <th className="py-2 px-3 text-right">Std BTU/hr</th>
                    <th className="py-2 px-3 text-right">Mid-Floor TR</th>
                    <th className="py-2 px-3 text-right">Top/Sunny TR</th>
                    <th className="py-2 px-3 text-right">Dense/Conf TR</th>
                    <th className="py-2 px-3">Recommended AC (#H21–#H22)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono tabular-nums">
                  {COOLING_LOAD_REFERENCE_CHART.map((ref) => (
                    <tr key={ref.areaSqft} className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                      <td className="py-2 px-3 text-slate-950 dark:text-white font-semibold">{ref.areaSqft}</td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{ref.areaSqm.toFixed(1)}</td>
                      <td className="py-2 px-3 text-right text-cyan-700 dark:text-cyan-300">{ref.normalBtu.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-300">{ref.normalTr.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-amber-700 dark:text-amber-300">{ref.sunnyTr.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-rose-700 dark:text-rose-300">{ref.denseTr.toFixed(2)}</td>
                      <td className="py-2 px-3 font-sans text-slate-800 dark:text-slate-200">{ref.suggestedAc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>CFM, Toilet Ventilation &amp; Fan Sizing (#H10–#H14)</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Basis for automatic #H10–#H14 inventory allocation (Toilets @ 12 ACH · General Rooms @ 6 ACH).
              </p>
            </div>
            <div className="border border-slate-300 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-2.5">ID</th>
                    <th className="py-2 px-2.5">Equipment</th>
                    <th className="py-2 px-2.5">Rated CFM</th>
                    <th className="py-2 px-2.5">Design Rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                  {FAN_EXHAUST_SPECS.map((spec) => (
                    <tr key={spec.badge} className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                      <td className="py-2 px-2.5 font-mono text-emerald-700 dark:text-emerald-400 font-bold">{spec.badge}</td>
                      <td className="py-2 px-2.5 text-slate-950 dark:text-white font-medium">
                        <div>{spec.item}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 font-normal">{spec.application}</div>
                      </td>
                      <td className="py-2 px-2.5 font-mono tabular-nums text-sky-700 dark:text-sky-300 whitespace-nowrap">
                        {spec.airDeliveryCfm}
                      </td>
                      <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300">{spec.coverage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
