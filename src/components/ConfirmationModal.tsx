import React from 'react';
import { 
  X, 
  CheckCircle2, 
  FileCheck, 
  Trash2, 
  Edit3, 
  PlusCircle, 
  ShieldCheck,
  Download,
  Table
} from 'lucide-react';
import { DSRMasterItem, ReviewState } from '../types';
import { formatRateINR } from '../utils/formatters';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  reviewState: ReviewState;
  modifiedItems: DSRMasterItem[];
  addedItems: DSRMasterItem[];
  deletedItems: DSRMasterItem[];
  onDownloadBackup: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  reviewState,
  modifiedItems,
  addedItems,
  deletedItems,
  onDownloadBackup,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-400/60 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-lg font-bold text-slate-950 dark:text-white">
                Confirm &amp; Finalize DSR Schedule
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Review your item-wise refinements and variant changes before final saving.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Changes Summary */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-sm">
          {/* Summary metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-300 dark:border-slate-700/60">
              <span className="text-xs text-slate-600 dark:text-slate-400 block">Active Master Items</span>
              <span className="text-xl font-bold font-mono text-slate-950 dark:text-white tabular-nums">
                {reviewState.totalActive.toLocaleString()}
              </span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-300 dark:border-amber-500/30">
              <span className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5" /> Refined / Edited
              </span>
              <span className="text-xl font-bold font-mono text-amber-900 dark:text-amber-300 tabular-nums">
                {modifiedItems.length}
              </span>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-500/10 p-3 rounded-xl border border-cyan-300 dark:border-cyan-500/30">
              <span className="text-xs text-cyan-800 dark:text-cyan-300 flex items-center gap-1">
                <PlusCircle className="w-3.5 h-3.5" /> Custom Added
              </span>
              <span className="text-xl font-bold font-mono text-cyan-900 dark:text-cyan-300 tabular-nums">
                {addedItems.length}
              </span>
            </div>
            <div className="bg-rose-50 dark:bg-rose-500/10 p-3 rounded-xl border border-rose-300 dark:border-rose-500/30">
              <span className="text-xs text-rose-800 dark:text-rose-300 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Deleted Items
              </span>
              <span className="text-xl font-bold font-mono text-rose-900 dark:text-rose-300 tabular-nums">
                {deletedItems.length}
              </span>
            </div>
          </div>

          {/* Compliance note */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30 rounded-xl p-3.5 text-xs text-emerald-900 dark:text-emerald-200/90 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-950 dark:text-white block font-semibold mb-0.5">
                Official CPWD DSR (E&amp;M) 2025 Schedule Integrity
              </strong>
              Items comply with CPWD specification guidelines. All unedited official master items and variants retain their verified DSR 2025 rates, units, and tags.
            </div>
          </div>

          {/* List of modifications if any */}
          {modifiedItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />
                Refined / Modified Master Items ({modifiedItems.length})
              </h4>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-2 space-y-2 text-xs">
                {modifiedItems.map((item) => (
                  <div key={item.id} className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-800 dark:text-amber-300">{item.c}</span>
                        <span className="text-slate-600 dark:text-slate-400 text-[11px] truncate">{item.g} › {item.h}</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-300 line-clamp-1 mt-0.5">{item.d}</p>
                      {item.variants && item.variants.length > 0 ? (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
                          <Table className="w-3 h-3" />
                          <span>{item.variants.filter(v => !v.isDeleted).length} active variants in table</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                          Rate: {formatRateINR(item.r)} {item.u ? `per ${item.u}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* List of deleted items if any */}
          {deletedItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                Excluded / Deleted Master Items ({deletedItems.length})
              </h4>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-2 space-y-1.5 text-xs">
                {deletedItems.map((item) => (
                  <div key={item.id} className="p-2 rounded bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-rose-700 dark:text-rose-400 line-through">{item.c}</span>
                      <span className="truncate line-through">{item.d}</span>
                    </div>
                    <span className="text-[11px] font-mono shrink-0 ml-2 text-slate-500">
                      {item.variants.length > 0 ? `${item.variants.length} vars` : formatRateINR(item.r)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Newly added items if any */}
          {addedItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-800 dark:text-cyan-400 flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" />
                Custom Added Items ({addedItems.length})
              </h4>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-2 space-y-1.5 text-xs">
                {addedItems.map((item) => (
                  <div key={item.id} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-cyan-800 dark:text-cyan-300">{item.c}</span>
                        <span className="text-slate-800 dark:text-slate-300 truncate">{item.d}</span>
                      </div>
                    </div>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                      {item.variants.length > 0 ? `${item.variants.length} variants` : formatRateINR(item.r)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onDownloadBackup}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700/80 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Draft JSON</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-300 dark:border-slate-700"
            >
              Continue Reviewing
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md shadow-emerald-950/20 dark:shadow-emerald-950 transition-all border border-emerald-500 dark:border-emerald-400/40"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm &amp; Save Schedule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
