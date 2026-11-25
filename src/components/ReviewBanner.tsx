import React from 'react';
import {
  Eye,
  RotateCcw,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { ReviewState } from '../types';

interface ReviewBannerProps {
  reviewState: ReviewState;
  onOpenConfirmModal: () => void;
  onOpenAddItemModal: () => void;
  onResetOriginal: () => void;
  onFilterStatus?: (status: 'all' | 'modified' | 'added' | 'deleted') => void;
  currentStatusFilter?: string;
}

export const ReviewBanner: React.FC<ReviewBannerProps> = ({
  reviewState,
  onOpenConfirmModal,
  onOpenAddItemModal,
  onResetOriginal,
}) => {
  return (
    <div className="no-print bg-amber-50/90 dark:bg-slate-900/95 border border-amber-300 dark:border-amber-500/30 rounded-xl px-3.5 py-2.5 mb-3 text-slate-800 dark:text-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
      {/* Left: Compact status & counts */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 shrink-0">
          <Eye className="w-3.5 h-3.5" />
          <span>Preview &amp; Review Mode</span>
        </span>
        <span className="text-amber-300 dark:text-slate-700 hidden sm:inline">|</span>
        <span className="text-xs text-slate-700 dark:text-slate-300">
          <strong className="font-mono text-slate-900 dark:text-white">{reviewState.totalOriginal.toLocaleString()}</strong> items ·{' '}
          <strong className="font-mono text-emerald-700 dark:text-emerald-300">{reviewState.totalVariants.toLocaleString()}</strong> priced lines
          {reviewState.totalModified > 0 && (
            <> · <span className="text-amber-800 dark:text-amber-300 font-mono font-semibold">{reviewState.totalModified} edited</span></>
          )}
          {reviewState.totalAdded > 0 && (
            <> · <span className="text-cyan-800 dark:text-cyan-300 font-mono font-semibold">{reviewState.totalAdded} added</span></>
          )}
          {reviewState.totalDeleted > 0 && (
            <> · <span className="text-rose-700 dark:text-rose-300 font-mono font-semibold">{reviewState.totalDeleted} deleted</span></>
          )}
        </span>
      </div>

      {/* Right: Compact single-row action buttons */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenAddItemModal}
          className="flex items-center gap-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors"
        >
          <Plus className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
          <span>Add Item</span>
        </button>

        <button
          onClick={onResetOriginal}
          className="flex items-center gap-1 bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors"
          title="Reset all changes back to original DSR 2025 baseline"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>

        <button
          onClick={onOpenConfirmModal}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg border border-emerald-500 dark:border-emerald-400/40 transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Confirm &amp; Save</span>
        </button>
      </div>
    </div>
  );
};
