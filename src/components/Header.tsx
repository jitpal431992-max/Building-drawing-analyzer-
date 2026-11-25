import React from 'react';
import {
  FileText,
  CheckCircle2,
  Calculator,
  BookOpen,
  Plus,
  Download,
  Eye,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  ClipboardList,
  Compass,
  Zap,
  Cpu,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { ViewMode, ReviewState } from '../types';

interface HeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  reviewState: ReviewState;
  estimateCount: number;
  onOpenConfirmModal: () => void;
  onOpenAddItemModal: () => void;
  onExportCatalog: () => void;
  onOpenShareModal: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  reviewState,
  estimateCount,
  onOpenConfirmModal,
  onOpenAddItemModal,
  onExportCatalog,
  onOpenShareModal,
  theme,
  onToggleTheme,
}) => {
  const workflowTabs: {
    id: ViewMode;
    step: string;
    label: string;
    icon: React.ReactNode;
    activeClass: string;
  }[] = [
    {
      id: 'floor-plan',
      step: '1',
      label: 'Floor Plan',
      icon: <Compass className="w-3.5 h-3.5" />,
      activeClass:
        'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-600/25 dark:text-emerald-300 dark:border-emerald-500/40',
    },
    {
      id: 'inventory',
      step: '2',
      label: 'Inventory',
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      activeClass:
        'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-600/25 dark:text-emerald-300 dark:border-emerald-500/40',
    },
    {
      id: 'building-load',
      step: '3',
      label: 'Building Load',
      icon: <Zap className="w-3.5 h-3.5" />,
      activeClass:
        'bg-cyan-100 text-cyan-900 border-cyan-400 dark:bg-cyan-600/25 dark:text-cyan-300 dark:border-cyan-500/40',
    },
    {
      id: 'mcb-db',
      step: '4',
      label: 'MCBDB',
      icon: <Cpu className="w-3.5 h-3.5" />,
      activeClass:
        'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-600/25 dark:text-emerald-300 dark:border-emerald-500/40',
    },
    {
      id: 'dsr-mapping',
      step: '5',
      label: 'DSR Suggest',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      activeClass:
        'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-600/25 dark:text-emerald-300 dark:border-emerald-500/40',
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0c1017]/95 backdrop-blur border-b border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 no-print transition-colors duration-150">
      <div className="w-[96%] sm:w-[92%] lg:w-[80%] mx-auto px-2 sm:px-3">
        {/* Band 1: Ultra-compact Brand + Utility Actions (h-10) */}
        <div className="flex items-center justify-between h-10 gap-3 border-b border-slate-200 dark:border-slate-800/70">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-600/20 border border-emerald-400/60 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 shrink-0">
                CPWD DSR 2025
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
              <h1 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate hidden sm:block">
                Delhi Schedule of Rates (E&amp;M) · Electrical Load, MCBDB &amp; BOQ
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to high-contrast light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to High-Contrast Light Mode (Print / Document Prep)' : 'Switch to Dark Mode'}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                  <span className="hidden md:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3 h-3 text-indigo-700" />
                  <span className="hidden md:inline">Dark</span>
                </>
              )}
            </button>

            {!reviewState.isConfirmed ? (
              <button
                onClick={onOpenConfirmModal}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md border border-emerald-500 dark:border-emerald-400/30 transition-colors whitespace-nowrap shrink-0"
                title="Confirm & Finalize DSR Catalog"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Confirm</span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/30 px-2 py-1 rounded-md">
                <ShieldCheck className="w-3 h-3" />
                <span>Confirmed</span>
              </div>
            )}

            <button
              onClick={onOpenAddItemModal}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
              title="Add Custom DSR Item"
            >
              <Plus className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
              <span className="hidden md:inline">Add Item</span>
            </button>

            <button
              onClick={onOpenShareModal}
              className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-800 dark:text-blue-300 dark:hover:text-white text-[11px] font-medium px-2 py-1 rounded-md border border-blue-300 dark:border-blue-500/30 transition-colors whitespace-nowrap shrink-0"
              title="Host in Google Drive / Live Cloud URL"
            >
              <HardDrive className="w-3 h-3 text-blue-700 dark:text-blue-400" />
              <span className="hidden sm:inline">GDrive</span>
            </button>

            <button
              onClick={onExportCatalog}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 dark:hover:text-white text-[11px] font-medium px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700/80 transition-colors whitespace-nowrap shrink-0"
              title="Export DSR Catalog Backup (JSON)"
            >
              <Download className="w-3 h-3" />
              <span className="hidden md:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Band 2: Unified Single-Row Workflow & Section Switcher (h-9) */}
        <nav
          aria-label="Primary sections"
          className="flex items-center justify-between gap-2 h-9 overflow-x-auto no-scrollbar"
        >
          {/* Left: 5-Step Engineering Workflow */}
          <div className="flex items-center gap-1 shrink-0">
            {workflowTabs.map((tab) => {
              const isActive = currentView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onViewChange(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? tab.activeClass
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium'
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      isActive ? 'text-current' : 'text-slate-500 dark:text-slate-500'
                    }`}
                  >
                    {tab.step}.
                  </span>
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <span className="h-4 w-px bg-slate-300 dark:bg-slate-800 shrink-0" aria-hidden="true" />

          {/* Right: Catalog, Review, BOQ & Original PDF */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onViewChange('review')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'review'
                  ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium'
              }`}
              title={reviewState.isConfirmed ? 'Catalog saved' : 'Unsaved catalog changes'}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Review</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  reviewState.isConfirmed ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'
                }`}
              />
            </button>

            <button
              onClick={() => onViewChange('catalog')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'catalog'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-semibold dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/30'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Catalog</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                ({reviewState.totalActive.toLocaleString()})
              </span>
            </button>

            <button
              onClick={() => onViewChange('estimate')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'estimate'
                  ? 'bg-blue-100 text-blue-900 border-blue-400 font-semibold dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/30'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>BOQ Estimate</span>
              {estimateCount > 0 && (
                <span className="px-1.5 py-0 text-[10px] bg-blue-600 text-white dark:bg-blue-500/30 dark:text-blue-200 rounded font-mono font-semibold tabular-nums">
                  {estimateCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onViewChange('pdf-viewer')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'pdf-viewer'
                  ? 'bg-purple-100 text-purple-900 border-purple-400 font-semibold dark:bg-purple-600/20 dark:text-purple-300 dark:border-purple-500/30'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
};
