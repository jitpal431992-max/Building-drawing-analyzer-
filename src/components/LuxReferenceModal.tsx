import React, { useState } from 'react';
import { X, Sun, Search, Image as ImageIcon, Table as TableIcon, FileText } from 'lucide-react';
import { IS_3646_LUX_REFERENCES, LUX_BUILDING_GROUPS } from '../data/luxLevels';

interface LuxReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LuxReferenceModal: React.FC<LuxReferenceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'table' | 'pdf' | 'image'>('table');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = IS_3646_LUX_REFERENCES.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.buildingGroup.toLowerCase().includes(q) ||
      item.slNo.toLowerCase().includes(q) ||
      item.luxDisplay.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 border border-amber-400/60 dark:border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                Recommended Service Illuminance (Lux) Standards
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                As per IS : 3646 (Part 1) : 1992 (Sections 16–23.8.1) &amp; Part II · Reference Standards for Room-wise Load
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'table'
                    ? 'bg-white dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Reference Table</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pdf')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'pdf'
                    ? 'bg-white dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>IS:3646 Part 1 (PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('image')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'image'
                    ? 'bg-white dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Part II Chart</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'pdf' ? (
            <div className="rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-950 h-[66vh]">
              <iframe
                src="/assets/aistudio/IS_3646_Part1_Sections_16_to_23_8_1_Illuminance_efe12c79.pdf"
                title="IS 3646 (Part 1) : 1992 — Recommended Service Illuminance (Sections 16 to 23.8.1)"
                className="w-full h-full border-0"
              />
            </div>
          ) : activeTab === 'image' ? (
            <div className="bg-white rounded-xl p-2 flex justify-center border border-slate-200 dark:border-none">
              <img
                src="/assets/aistudio/Lux_level_32f8387b.png"
                alt="Recommended Lux Values For Interior Illumination As per IS : 3646 (Part II) - 1966"
                className="max-w-full h-auto rounded"
              />
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search room classification or Ref. No. (e.g. 17.1, 20.4, Hospital, Hotel, Garage, Library, Car Park)..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
                />
              </div>

              <div className="space-y-4">
                {LUX_BUILDING_GROUPS.map((groupName) => {
                  const groupItems = filtered.filter((r) => r.buildingGroup === groupName);
                  if (groupItems.length === 0) return null;

                  return (
                    <div key={groupName} className="rounded-xl border border-slate-300 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950/50">
                      <div className="px-4 py-2 bg-amber-50 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 font-bold text-xs text-amber-900 dark:text-amber-300 tracking-wide flex items-center justify-between">
                        <span>{groupName}</span>
                        <span className="font-mono text-[10px] font-semibold text-amber-700/80 dark:text-amber-400/80">
                          {groupItems.length} {groupItems.length === 1 ? 'category' : 'categories'}
                        </span>
                      </div>
                      <table className="w-full text-left text-xs">
                        <thead className="text-[11px] text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-300 dark:border-slate-800">
                          <tr>
                            <th className="py-2 px-3 w-24">Ref. No.</th>
                            <th className="py-2 px-3">Type of Interior / Room Classification</th>
                            <th className="py-2 px-3 text-right w-36">IS:3646 Lux</th>
                            <th className="py-2 px-3 text-right w-36">Calc. Default (Lux)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                          {groupItems.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">{item.slNo}</td>
                              <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-200">{item.label}</td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-amber-800 dark:text-amber-300 tabular-nums">
                                {item.luxDisplay}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                {item.isSpecialLighting ? `${item.recommendedLux} (Editable)` : `${item.recommendedLux} lx`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>Formula: Required Lumens = (Target Lux × Area in m²) ÷ (UF × MF) · {IS_3646_LUX_REFERENCES.length} categories</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold border border-slate-300 dark:border-slate-700 whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
