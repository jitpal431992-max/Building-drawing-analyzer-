import React from 'react';
import { Tag as TagIcon, X, Copy, Check, SlidersHorizontal, Sparkles } from 'lucide-react';

interface TagSidebarProps {
  allTags: [string, number][];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  onAutoTagCatalog?: () => void;
  onCopyCsv: () => void;
  csvCopied: boolean;
}

export const TagSidebar: React.FC<TagSidebarProps> = ({
  allTags,
  selectedTags,
  onToggleTag,
  onClearTags,
  onAutoTagCatalog,
  onCopyCsv,
  csvCopied,
}) => {
  return (
    <aside className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-xl p-3.5 space-y-3 lg:sticky lg:top-24 h-fit max-h-[calc(100vh-7rem)] overflow-y-auto shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 flex items-center gap-1.5">
          <TagIcon className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          <span>Category Tags</span>
          {selectedTags.length > 0 && (
            <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-semibold lowercase">
              ({selectedTags.length} active)
            </span>
          )}
        </h3>

        {selectedTags.length > 0 && (
          <button
            onClick={onClearTags}
            className="text-[11px] text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* Tag Chips Grid */}
      <div className="flex flex-wrap gap-1.5 max-h-96 overflow-y-auto pr-1">
        {allTags.map(([tag, count]) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => onToggleTag(tag)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all text-left flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 border-emerald-500 dark:border-emerald-400 font-semibold shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <span className="truncate max-w-[140px]">{tag}</span>
              <small className={`text-[10px] font-mono ${isSelected ? 'text-emerald-50 dark:text-slate-900 font-bold' : 'text-slate-500 dark:text-slate-500'}`}>
                {count}
              </small>
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {onAutoTagCatalog && (
          <button
            type="button"
            onClick={onAutoTagCatalog}
            className="w-full flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs font-semibold py-2 px-3 rounded-lg border border-emerald-300 dark:border-emerald-500/30 transition-colors"
            title="Analyze item descriptions across the catalog and attach missing searchable tags (Wiring, Safety, Outdoor, etc.)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Suggest Missing Tags</span>
          </button>
        )}

        <button
          onClick={onCopyCsv}
          className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors shadow-xs"
        >
          {csvCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-white" />
              <span>Copied CSV to Clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Results as CSV</span>
            </>
          )}
        </button>

        {selectedTags.length > 0 && (
          <button
            onClick={onClearTags}
            className="w-full text-xs text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white py-1 transition-colors text-center"
          >
            Clear all tag filters
          </button>
        )}
      </div>
    </aside>
  );
};
