import React, { useState } from 'react';
import { 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Plus, 
  Copy, 
  Check, 
  FileText, 
  Tag as TagIcon,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calculator,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';
import { DSRMasterItem, DSRVariantItem } from '../types';
import { formatRateINR } from '../utils/formatters';

interface ItemCardProps {
  item: DSRMasterItem;
  searchQuery?: string;
  isReviewMode: boolean;
  onEditItem: (item: DSRMasterItem) => void;
  onDeleteItemToggle: (itemId: string) => void;
  onEditVariant: (item: DSRMasterItem, variantIndex: number) => void;
  onDeleteVariantToggle: (item: DSRMasterItem, variantIndex: number) => void;
  onAddVariant: (item: DSRMasterItem) => void;
  onAddToEstimate: (item: DSRMasterItem, variant?: DSRVariantItem) => void;
  onAddAllVariantsToEstimate?: (item: DSRMasterItem) => void;
  onTagClick: (tag: string) => void;
  onViewPdfPage?: (page: number) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  searchQuery = '',
  isReviewMode,
  onEditItem,
  onDeleteItemToggle,
  onEditVariant,
  onDeleteVariantToggle,
  onAddVariant,
  onAddToEstimate,
  onAddAllVariantsToEstimate,
  onTagClick,
  onViewPdfPage,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopy = () => {
    let text = `CPWD DSR (E&M) 2025 - Item ${item.c}: ${item.d}`;
    if (item.variants && item.variants.length > 0) {
      const activeVars = item.variants.filter(v => !v.isDeleted);
      text += `\nVariants:\n` + activeVars.map(v => `• ${v.code} - ${v.name}: ₹ ${v.rate} / ${v.unit}`).join('\n');
    } else if (item.r) {
      text += `\nRate: ₹ ${item.r} per ${item.u || 'Unit'}`;
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDeleted = item.isDeleted;
  const isModified = item.isModified;
  const isNew = item.isCustomAdded;

  // Highlight search keywords in text
  const highlightText = (text: string) => {
    if (!searchQuery || !searchQuery.trim()) return text;
    const words = searchQuery.trim().split(/\s+/).filter(w => w.length > 1);
    if (!words.length) return text;

    try {
      const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) => 
        words.some(w => w.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-amber-300 text-slate-900 px-0.5 rounded font-medium">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  const hasVariants = item.variants && item.variants.length > 0;
  const activeVariants = hasVariants ? item.variants.filter(v => !v.isDeleted) : [];

  return (
    <div
      className={`dsr-card border rounded-xl transition-all relative overflow-hidden ${
        isDeleted
          ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/40 opacity-80'
          : isModified
          ? 'bg-white dark:bg-slate-900/90 border-amber-400 dark:border-amber-500/40 hover:border-amber-500 dark:hover:border-amber-500/60 shadow-xs'
          : isNew
          ? 'bg-white dark:bg-slate-900/90 border-cyan-400 dark:border-cyan-500/40 hover:border-cyan-500 dark:hover:border-cyan-500/60 shadow-xs'
          : 'bg-white dark:bg-slate-900/80 border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 shadow-xs'
      }`}
    >
      {/* Top Banner if Deleted */}
      {isDeleted && (
        <div className="bg-rose-100 dark:bg-rose-950/80 border-b border-rose-300 dark:border-rose-900/50 px-4 py-1.5 flex items-center justify-between text-xs text-rose-800 dark:text-rose-300 font-medium">
          <span className="flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> This entire master item is marked for deletion
          </span>
          <button
            onClick={() => onDeleteItemToggle(item.id)}
            className="text-white bg-rose-700 hover:bg-rose-600 dark:bg-rose-800/80 dark:hover:bg-rose-700 px-2.5 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Restore Item
          </button>
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Header Metadata Row: Code, Item Type, Category › Chapter, Page, and Master Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Monospaced Item Code Badge */}
            <span className="font-mono font-bold text-sm px-2.5 py-1 rounded bg-emerald-50 dark:bg-slate-950 border border-emerald-300 dark:border-slate-700/80 text-emerald-800 dark:text-emerald-400">
              {item.c || 'N/A'}
            </span>

            {/* Item Type Badge */}
            {item.t && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800/50">
                {highlightText(item.t)}
              </span>
            )}

            {/* Category › Chapter Heading */}
            <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <span className="font-semibold text-slate-800 dark:text-slate-300">{item.g}</span>
              <span>›</span>
              <span className="text-slate-600 dark:text-slate-400">{item.h}</span>
            </span>

            {/* Page Reference button */}
            {item.p && (
              <button
                onClick={() => onViewPdfPage && onViewPdfPage(item.p)}
                className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 font-mono bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-800 flex items-center gap-1 transition-colors"
                title={`View in DSR 2025 PDF on Page ${item.p}`}
              >
                <span>· p.{item.p}</span>
              </button>
            )}
          </div>

          {/* Master Item Actions & Status Badges */}
          <div className="flex items-center gap-1.5 ml-auto">
            {isModified && !isDeleted && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                Refined
              </span>
            )}
            {isNew && !isDeleted && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-cyan-100 dark:bg-cyan-500/20 text-cyan-900 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30">
                Custom Added
              </span>
            )}

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
              title="Copy Item Info"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Edit Master Item Button */}
            <button
              onClick={() => onEditItem(item)}
              className="px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
              title="Edit master description, code, type, tags, and variants"
            >
              <Edit3 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Edit Item</span>
            </button>

            {/* Delete / Restore Master Item Button */}
            <button
              onClick={() => onDeleteItemToggle(item.id)}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                isDeleted
                  ? 'text-emerald-700 dark:text-emerald-400 border-emerald-400 dark:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  : 'text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700/60 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800'
              }`}
              title={isDeleted ? 'Restore Master Item' : 'Delete Master Item'}
            >
              {isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Group Sub-heading banner if present */}
        {item.gr && (
          <div className="mb-2.5 px-3 py-1 rounded bg-slate-100 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-800/80 text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400">
            <span className="text-slate-500 mr-1.5 font-normal">Group:</span>
            {item.gr}
          </div>
        )}

        {/* Specification Description with expand/collapse */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs sm:text-sm text-slate-900 dark:text-slate-200 leading-relaxed cursor-pointer mb-3 select-text group"
          title="Click to expand/collapse full description"
        >
          <div className={isExpanded ? '' : 'line-clamp-3'}>
            {highlightText(item.d)}
          </div>
          {item.d && item.d.length > 180 && (
            <button 
              type="button" 
              className="text-[11px] text-emerald-700 dark:text-emerald-400/90 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 font-semibold mt-1 inline-flex items-center gap-1"
            >
              {isExpanded ? (
                <>Show less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Show full specification <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}
        </div>

        {/* Variants Table OR Standalone Rate */}
        {hasVariants ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-400 text-[11px] font-semibold border-b border-slate-300 dark:border-slate-800">
                    <th className="py-2 px-3 w-24">No.</th>
                    <th className="py-2 px-3">Size / rating / variant</th>
                    <th className="py-2 px-3 w-20">Unit</th>
                    <th className="py-2 px-3 text-right w-28">Rate ₹</th>
                    <th className="py-2 px-3 text-right w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-transparent">
                  {item.variants.map((v, idx) => {
                    const isVarDeleted = v.isDeleted;
                    const isVarModified = v.isModified;
                    return (
                      <tr
                        key={`${v.code}-${idx}`}
                        className={`transition-colors ${
                          isVarDeleted 
                            ? 'bg-rose-50 dark:bg-rose-950/30 text-slate-500 line-through' 
                            : isVarModified
                            ? 'bg-amber-50/70 dark:bg-amber-950/15 hover:bg-amber-100/60 dark:hover:bg-slate-800/60 text-slate-900 dark:text-slate-200'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-900 dark:text-slate-200'
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400/90">
                          {v.code || `${item.c}.${idx + 1}`}
                          {isVarModified && !isVarDeleted && (
                            <span className="ml-1 text-[9px] text-amber-600 dark:text-amber-400 no-underline font-sans">•</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-medium">
                          {highlightText(v.name)}
                          {isVarDeleted && (
                            <span className="ml-2 text-[10px] text-rose-700 dark:text-rose-400 no-underline bg-rose-100 dark:bg-rose-950 px-1.5 py-0.2 rounded border border-rose-300 dark:border-rose-900/60">
                              Deleted
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                          {v.unit || '–'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-950 dark:text-slate-100 tabular-nums">
                          {formatRateINR(v.rate)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Add to BOQ Estimate */}
                            {!isVarDeleted && (
                              <button
                                onClick={() => onAddToEstimate(item, v)}
                                className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 border border-emerald-400/70 dark:border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                title="Add this variant to BOQ Estimate"
                              >
                                <Plus className="w-3 h-3" />
                                <span>BOQ</span>
                              </button>
                            )}

                            {/* Inline Edit Variant */}
                            <button
                              onClick={() => onEditVariant(item, idx)}
                              className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit variant row"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>

                            {/* Inline Delete / Restore Variant */}
                            <button
                              onClick={() => onDeleteVariantToggle(item, idx)}
                              className={`p-1 rounded transition-colors ${
                                isVarDeleted
                                  ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              title={isVarDeleted ? 'Restore variant' : 'Delete variant'}
                            >
                              {isVarDeleted ? <RotateCcw className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer: Add variant row button & count */}
            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-300 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>
                {activeVariants.length} active {activeVariants.length === 1 ? 'variant' : 'variants'}
                {item.variants.length > activeVariants.length && (
                  <span className="text-rose-700 dark:text-rose-400 ml-1">
                    ({item.variants.length - activeVariants.length} deleted)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {onAddAllVariantsToEstimate && activeVariants.length > 0 && (
                  <button
                    onClick={() => onAddAllVariantsToEstimate(item)}
                    className="text-xs text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:underline flex items-center gap-1 font-semibold mr-2"
                    title="Add all active variants of this item to BOQ"
                  >
                    <Plus className="w-3 h-3" /> Add All Sub-Items to BOQ
                  </button>
                )}
                <button
                  onClick={() => onAddVariant(item)}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Plus className="w-3 h-3" /> Add Variant Row
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Standalone Rate Card */
          <div className="mt-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-500 tracking-wider block">
                  Official Rate
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatRateINR(item.r)}
                  </span>
                  {item.u && (
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      per {item.u}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onAddToEstimate(item)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-white dark:text-emerald-300 border border-emerald-600 dark:border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Add to BOQ Estimate"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to BOQ</span>
              </button>
            </div>
          </div>
        )}

        {/* Tags Chips Bar */}
        {item.tg && item.tg.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            <TagIcon className="w-3 h-3 text-slate-500 shrink-0 mr-0.5" />
            {item.tg.map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white border border-slate-300 dark:border-slate-700/60 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Footnote Warning Badge if present */}
        {item.f && (
          <div className="mt-2.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/50 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-300/90">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>{item.f}</span>
          </div>
        )}
      </div>
    </div>
  );
};
