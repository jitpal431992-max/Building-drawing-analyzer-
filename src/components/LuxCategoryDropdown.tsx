import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import {
  IS_3646_LUX_REFERENCES,
  LUX_BUILDING_GROUPS,
  LuxLevelReference,
  getLuxReferenceById,
} from '../data/luxLevels';

interface LuxCategoryDropdownProps {
  value?: string;
  onChange: (categoryId: string) => void;
}

interface PopoverCoords {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

const SHORT_GROUP_LABELS: Record<string, string> = {
  '1. HOMES': '1. Homes',
  '2. OFFICES': '2. Offices',
  '3. SCHOOLS & COLLEGES': '3. Schools',
  '4. HOSPITALS': '4. Hospitals',
  '5. DAIRIES': '5. Dairies',
  '6. SUB-STATION': '6. Sub-Stn',
  '7. CINEMA / THEATRE': '7. Cinema',
  '16. DISTRIBUTION AND STORAGE': '16. Storage',
  '17.3 BANKS & BUILDING SOCIETIES': '17.3 Banks',
  '18. SERVICES — GARAGES': '18. Garages',
  '20.1 & 20.8 PUBLIC ASSEMBLY & SPORTS': '20.1 Public',
  '20.5 HOTELS': '20.5 Hotels',
  '20.6 LIBRARIES': '20.6 Libraries',
  '20.7 MUSEUMS & ART GALLERIES': '20.7 Museums',
  '23. GENERAL BUILDING AREAS': '23. General',
};

export const LuxCategoryDropdown: React.FC<LuxCategoryDropdownProps> = ({
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedRef = useMemo(() => getLuxReferenceById(value), [value]);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = Math.min(Math.max(rect.width, 410), vw - 16);
    const left = Math.max(8, Math.min(rect.left, vw - width - 8));

    const spaceBelow = vh - rect.bottom - 10;
    const spaceAbove = rect.top - 10;

    if (spaceBelow >= 270 || spaceBelow >= spaceAbove) {
      setCoords({
        left,
        width,
        top: Math.max(8, rect.bottom + 4),
        maxHeight: Math.min(410, Math.max(180, spaceBelow)),
      });
    } else {
      setCoords({
        left,
        width,
        bottom: Math.max(8, vh - rect.top + 4),
        maxHeight: Math.min(410, Math.max(180, spaceAbove)),
      });
    }
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleViewportChange = (e: Event) => {
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      updatePosition();
    };

    document.addEventListener('mousedown', handlePointerDownOutside, true);
    document.addEventListener('touchstart', handlePointerDownOutside, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handlePointerDownOutside, true);
      document.removeEventListener('touchstart', handlePointerDownOutside, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isOpen]);

  const filteredByGroup = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, LuxLevelReference[]>();

    for (const group of LUX_BUILDING_GROUPS) {
      if (selectedGroup !== 'ALL' && group !== selectedGroup) continue;
      const items = IS_3646_LUX_REFERENCES.filter((item) => {
        if (item.buildingGroup !== group) return false;
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q) ||
          item.slNo.toLowerCase().includes(q) ||
          item.buildingGroup.toLowerCase().includes(q) ||
          item.luxDisplay.toLowerCase().includes(q)
        );
      });
      if (items.length > 0) {
        map.set(group, items);
      }
    }
    return map;
  }, [search, selectedGroup]);

  const totalMatches = useMemo(() => {
    let count = 0;
    filteredByGroup.forEach((arr) => {
      count += arr.length;
    });
    return count;
  }, [filteredByGroup]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-1">
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Lux Room Category (IS:3646)"
          onClick={() => {
            if (!isOpen) {
              setSearch('');
              setSelectedGroup('ALL');
            }
            setIsOpen((prev) => !prev);
          }}
          title={
            selectedRef
              ? `${selectedRef.slNo} ${selectedRef.label} (${selectedRef.luxDisplay} lx)`
              : 'Select IS:3646 Room Type'
          }
          className={`w-full min-w-0 flex items-center justify-between gap-1.5 bg-white dark:bg-slate-950/90 border rounded px-2 py-1.5 text-xs transition-colors text-left ${
            isOpen
              ? 'border-amber-500 ring-1 ring-amber-500/40'
              : 'border-slate-300 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600'
          }`}
        >
          {selectedRef ? (
            <span className="flex items-center justify-between gap-1.5 min-w-0 flex-1">
              <span className="truncate font-medium text-slate-950 dark:text-slate-100">
                <span className="font-mono text-[10px] text-amber-700 dark:text-amber-300 mr-1">
                  {selectedRef.slNo}
                </span>
                {selectedRef.label}
              </span>
              <span className="shrink-0 font-mono text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/80 px-1 py-0.5 rounded tabular-nums">
                {selectedRef.luxDisplay} lx
              </span>
            </span>
          ) : (
            <span className="truncate text-slate-500 dark:text-slate-400 flex-1">
              -- Select IS:3646 Room Type --
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400 transition-transform ${
              isOpen ? 'rotate-180 text-amber-600 dark:text-amber-400' : ''
            }`}
          />
        </button>

        {selectedRef && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect('');
            }}
            className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0 transition-colors"
            title="Clear Lux Room Category"
            aria-label="Clear Lux Room Category"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="IS:3646 Lux Room Categories"
            style={{
              position: 'fixed',
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              ...(coords.top !== undefined ? { top: coords.top } : {}),
              ...(coords.bottom !== undefined ? { bottom: coords.bottom } : {}),
              zIndex: 9999,
            }}
            className="flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl overflow-hidden text-xs text-slate-900 dark:text-slate-100"
          >
            {/* Search Bar */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 space-y-2 shrink-0">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search room, Ref. No. (17.1, 20.4), or Lux..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Group Quick Filter Strip */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedGroup('ALL')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                    selectedGroup === 'ALL'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  All ({IS_3646_LUX_REFERENCES.length})
                </button>
                {LUX_BUILDING_GROUPS.map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() =>
                      setSelectedGroup((prev) => (prev === group ? 'ALL' : group))
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shrink-0 border transition-colors ${
                      selectedGroup === group
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {SHORT_GROUP_LABELS[group] || group}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Options List */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800/70">
              {selectedRef && (
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelect('')}
                  className="w-full px-3 py-1.5 text-left text-[11px] text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium flex items-center justify-between"
                >
                  <span>-- Clear Room Category Selection --</span>
                </button>
              )}

              {totalMatches === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No IS:3646 room categories matched "{search}".
                </div>
              ) : (
                Array.from(filteredByGroup.entries()).map(([group, items]) => (
                  <div key={group}>
                    <div className="sticky top-0 z-10 px-3 py-1.5 bg-amber-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-amber-200/80 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center justify-between">
                      <span>{group}</span>
                      <span className="font-mono text-[10px] opacity-75">{items.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {items.map((item) => {
                        const isSelected = selectedRef?.id === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelect(item.id)}
                            className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 transition-colors ${
                              isSelected
                                ? 'bg-amber-100/80 dark:bg-amber-500/20 text-amber-950 dark:text-amber-200 font-semibold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <span className="flex items-start gap-2 min-w-0 flex-1">
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5">
                                {item.slNo}
                              </span>
                              <span className="leading-snug">{item.label}</span>
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0 mt-0.5">
                              <span className="font-mono text-[11px] font-bold text-amber-800 dark:text-amber-300 tabular-nums">
                                {item.luxDisplay} lx
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
