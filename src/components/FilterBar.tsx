import React from 'react';
import { 
  Search, 
  X, 
  ArrowUpDown, 
  SlidersHorizontal,
  RotateCcw,
  Layers,
  Sparkles,
  Trash2,
  Table,
  FileText
} from 'lucide-react';
import { FilterOptions } from '../types';

interface FilterBarProps {
  filters: FilterOptions;
  categories: string[];
  itemTypes: string[];
  onFilterChange: (newFilters: Partial<FilterOptions>) => void;
  onResetFilters: () => void;
  totalFilteredCount: number;
  totalPricedLines: number;
  totalCatalogCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  categories,
  itemTypes,
  onFilterChange,
  onResetFilters,
  totalFilteredCount,
  totalPricedLines,
  totalCatalogCount,
}) => {
  const hasActiveFilters = 
    filters.searchQuery !== '' ||
    filters.selectedCategory !== 'All categories' ||
    filters.selectedItemType !== 'All item types' ||
    filters.selectedTags.length > 0 ||
    filters.sort !== 'rel' ||
    filters.reviewStatus !== 'all';

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2.5 mb-3 shadow-sm space-y-2 no-print">
      {/* Top Row: Search Input & Primary Dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
        {/* Full-text search bar */}
        <div className="sm:col-span-2 lg:col-span-5 relative">
          <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <input
            type="search"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            placeholder="Search items, e.g. 63 A MCB, 1.5 sq.mm FRLS, 500 KVA, CCTV…"
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-lg pl-8.5 pr-8 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition-colors"
            autoComplete="off"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({ searchQuery: '' })}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Selector */}
        <div className="lg:col-span-3">
          <select
            value={filters.selectedCategory}
            onChange={(e) => {
              onFilterChange({
                selectedCategory: e.target.value,
                selectedItemType: 'All item types',
              });
            }}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 truncate"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Item Type Selector */}
        <div className="lg:col-span-2">
          <select
            value={filters.selectedItemType}
            onChange={(e) => onFilterChange({ selectedItemType: e.target.value })}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 truncate"
          >
            {itemTypes.map((typ) => (
              <option key={typ} value={typ}>{typ}</option>
            ))}
          </select>
        </div>

        {/* Sort Selector */}
        <div className="lg:col-span-2">
          <select
            value={filters.sort}
            onChange={(e) => onFilterChange({ sort: e.target.value as 'rel' | 'lo' | 'hi' })}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
          >
            <option value="rel">Order: DSR sequence</option>
            <option value="lo">Rate: low → high</option>
            <option value="hi">Rate: high → low</option>
          </select>
        </div>
      </div>

      {/* Second Row: Status Filter Tabs & Summary Counts */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/80 text-xs">
        {/* Quick status filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onFilterChange({ reviewStatus: 'all' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filters.reviewStatus === 'all'
                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 font-bold'
                : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800'
            }`}
          >
            All Items
          </button>

          <button
            onClick={() => onFilterChange({ reviewStatus: 'has-variants' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              filters.reviewStatus === 'has-variants'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800'
            }`}
          >
            <Table className="w-3 h-3" />
            <span>With Variants</span>
          </button>

          <button
            onClick={() => onFilterChange({ reviewStatus: 'single-item' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              filters.reviewStatus === 'single-item'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Single Rate</span>
          </button>

          <button
            onClick={() => onFilterChange({ reviewStatus: 'modified' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              filters.reviewStatus === 'modified'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800'
            }`}
          >
            <Sparkles className={`w-3 h-3 ${filters.reviewStatus === 'modified' ? 'text-slate-950' : 'text-amber-600 dark:text-amber-400'}`} />
            <span>Refined Items</span>
          </button>

          <button
            onClick={() => onFilterChange({ reviewStatus: 'added' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              filters.reviewStatus === 'added'
                ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-bold'
                : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800'
            }`}
          >
            <span>Custom Added</span>
          </button>

          <button
            onClick={() => onFilterChange({ reviewStatus: 'deleted' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              filters.reviewStatus === 'deleted'
                ? 'bg-rose-600 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800'
            }`}
          >
            <Trash2 className={`w-3 h-3 ${filters.reviewStatus === 'deleted' ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`} />
            <span>Deleted Items</span>
          </button>
        </div>

        {/* Counts & Clear Filters */}
        <div className="flex items-center gap-3 ml-auto text-slate-600 dark:text-slate-400">
          <span>
            Showing <strong className="text-slate-900 dark:text-white font-mono">{totalFilteredCount.toLocaleString()}</strong> items
            <span className="text-slate-400 dark:text-slate-500 mx-1">·</span>
            <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{totalPricedLines.toLocaleString()}</strong> priced lines
          </span>

          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 flex items-center gap-1 hover:underline font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
