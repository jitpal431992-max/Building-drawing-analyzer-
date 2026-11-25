import React from 'react';
import { Edit3, Trash2, RotateCcw, Plus, Table, FileText } from 'lucide-react';
import { DSRMasterItem, DSRVariantItem } from '../types';
import { formatRateINR } from '../utils/formatters';

interface ItemTableProps {
  items: DSRMasterItem[];
  isReviewMode: boolean;
  onEdit: (item: DSRMasterItem) => void;
  onDeleteToggle: (itemId: string) => void;
  onAddToEstimate: (item: DSRMasterItem, variant?: DSRVariantItem) => void;
  onTagClick: (tag: string) => void;
  onViewPdfPage?: (page: number) => void;
}

export const ItemTable: React.FC<ItemTableProps> = ({
  items,
  isReviewMode,
  onEdit,
  onDeleteToggle,
  onAddToEstimate,
  onTagClick,
  onViewPdfPage,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-800 dark:text-slate-300">
          <thead className="bg-slate-100 dark:bg-slate-950/80 text-slate-700 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-300 dark:border-slate-800">
            <tr>
              <th className="py-3 px-3 w-28">Item Code</th>
              <th className="py-3 px-3 w-40">Item Type</th>
              <th className="py-3 px-3">Description &amp; Specification</th>
              <th className="py-3 px-3 w-36">Category</th>
              <th className="py-3 px-3 w-32 text-right">Rates / Variants</th>
              <th className="py-3 px-3 w-32 text-center no-print">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-normal">
            {items.map((item) => {
              const isDeleted = item.isDeleted;
              const hasVariants = item.variants && item.variants.length > 0;
              const activeVars = hasVariants ? item.variants.filter((v) => !v.isDeleted) : [];

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                    isDeleted ? 'bg-rose-50 dark:bg-rose-950/15 opacity-70' : ''
                  }`}
                >
                  {/* Item Code & Page */}
                  <td className="py-3 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 align-top">
                    <div className="flex items-center gap-1.5">
                      <span className={isDeleted ? 'line-through text-slate-500' : ''}>
                        {item.c}
                      </span>
                      {item.p && (
                        <button
                          onClick={() => onViewPdfPage && onViewPdfPage(item.p)}
                          className="text-[10px] text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 font-mono"
                          title={`Page ${item.p} in PDF`}
                        >
                          p.{item.p}
                        </button>
                      )}
                    </div>
                    {item.isModified && !isDeleted && (
                      <span className="inline-block mt-0.5 text-[9px] uppercase px-1 py-0.2 bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 rounded font-sans">
                        Refined
                      </span>
                    )}
                    {item.isCustomAdded && !isDeleted && (
                      <span className="inline-block mt-0.5 text-[9px] uppercase px-1 py-0.2 bg-cyan-100 dark:bg-cyan-500/20 text-cyan-900 dark:text-cyan-300 rounded font-sans">
                        New
                      </span>
                    )}
                  </td>

                  {/* Item Type */}
                  <td className="py-3 px-3 align-top">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 block">
                      {item.t || '–'}
                    </span>
                  </td>

                  {/* Description */}
                  <td className="py-3 px-3 align-top">
                    <p className={`line-clamp-3 text-slate-900 dark:text-slate-200 ${isDeleted ? 'line-through text-slate-500' : ''}`}>
                      {item.d}
                    </p>
                    {item.tg && item.tg.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 no-print">
                        {item.tg.slice(0, 6).map((t) => (
                          <button
                            key={t}
                            onClick={() => onTagClick(t)}
                            className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-800 rounded hover:text-slate-950 dark:hover:text-white"
                          >
                            {t}
                          </button>
                        ))}
                        {item.tg.length > 6 && (
                          <span className="text-[10px] text-slate-500">+{item.tg.length - 6}</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-3 px-3 align-top text-slate-700 dark:text-slate-400">
                    <div className="text-xs truncate max-w-[200px]" title={item.g}>
                      {item.g}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[200px]" title={item.h}>
                      {item.h}
                    </div>
                  </td>

                  {/* Rates / Variants */}
                  <td className="py-3 px-3 align-top text-right font-mono tabular-nums">
                    {hasVariants ? (
                      <div>
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center justify-end gap-1">
                          <Table className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                          <span>{activeVars.length} variants</span>
                        </span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 block">
                          ₹ {Math.min(...activeVars.map((v) => parseFloat(v.rate) || 0)).toLocaleString('en-IN')} – 
                          ₹ {Math.max(...activeVars.map((v) => parseFloat(v.rate) || 0)).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {formatRateINR(item.r)}
                        </span>
                        {item.u && (
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 block">/ {item.u}</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 align-top text-center no-print">
                    <div className="flex items-center justify-center gap-1">
                      {/* Add to estimate */}
                      {!isDeleted && (
                        <button
                          onClick={() => onAddToEstimate(item, hasVariants ? activeVars[0] : undefined)}
                          className="p-1 rounded bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors"
                          title="Add to Estimate"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => onEdit(item)}
                        className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Item"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete / Restore */}
                      <button
                        onClick={() => onDeleteToggle(item.id)}
                        className={`p-1 rounded transition-colors ${
                          isDeleted
                            ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            : 'text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={isDeleted ? 'Restore' : 'Delete'}
                      >
                        {isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
