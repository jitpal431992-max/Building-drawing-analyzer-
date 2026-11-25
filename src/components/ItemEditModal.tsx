import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Tag, Plus, AlertCircle, Trash2, RotateCcw, Edit3, HelpCircle, Sparkles } from 'lucide-react';
import { DSRMasterItem, DSRVariantItem } from '../types';
import { CATEGORIES, getItemTypesByCategory } from '../data/dsrHelpers';
import { analyzeDescriptionForTags } from '../utils/tagAnalyzer';

interface ItemEditModalProps {
  isOpen: boolean;
  item: DSRMasterItem | null;
  allItems: DSRMasterItem[];
  onClose: () => void;
  onSave: (updatedItem: DSRMasterItem) => void;
}

export const ItemEditModal: React.FC<ItemEditModalProps> = ({
  isOpen,
  item,
  allItems,
  onClose,
  onSave,
}) => {
  const isNew = !item || item.id.startsWith('new-');

  const [code, setCode] = useState('');
  const [group, setGroup] = useState('Internal Electrical Work');
  const [chapter, setChapter] = useState('1. Wiring');
  const [itemType, setItemType] = useState('Wiring – Light/Fan/Call-bell Points');
  const [description, setDescription] = useState('');
  const [groupHeading, setGroupHeading] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [footnote, setFootnote] = useState('');
  const [standaloneUnit, setStandaloneUnit] = useState('Each');
  const [standaloneRate, setStandaloneRate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [variants, setVariants] = useState<DSRVariantItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New variant inline inputs
  const [newVarCode, setNewVarCode] = useState('');
  const [newVarName, setNewVarName] = useState('');
  const [newVarUnit, setNewVarUnit] = useState('Each');
  const [newVarRate, setNewVarRate] = useState('');

  useEffect(() => {
    if (item) {
      setCode(item.c || '');
      setGroup(item.g || 'Internal Electrical Work');
      setChapter(item.h || '1. Wiring');
      setItemType(item.t || 'Wiring – Light/Fan/Call-bell Points');
      setDescription(item.d || '');
      setGroupHeading(item.gr || '');
      setPageNumber(item.p || 1);
      setFootnote(item.f || '');
      setStandaloneUnit(item.u || 'Each');
      setStandaloneRate(item.r ? String(item.r) : '');
      setTags(item.tg || []);
      setVariants(item.variants ? JSON.parse(JSON.stringify(item.variants)) : []);
    } else {
      setCode('');
      setGroup('Internal Electrical Work');
      setChapter('1. Wiring');
      setItemType('Wiring – Light/Fan/Call-bell Points');
      setDescription('');
      setGroupHeading('');
      setPageNumber(1);
      setFootnote('');
      setStandaloneUnit('Each');
      setStandaloneRate('');
      setTags(['Electrical', 'DSR 2025']);
      setVariants([]);
    }
    setError(null);
  }, [item, isOpen]);

  const suggestedTags = useMemo(() => {
    const variantText = variants
      .filter((v) => !v.isDeleted)
      .map((v) => `${v.name} ${v.unit}`)
      .join(' ');
    return analyzeDescriptionForTags(
      {
        description,
        category: group,
        chapter,
        itemType,
        groupHeading,
        footnote,
        unit: standaloneUnit,
        variantText,
      },
      tags
    ).slice(0, 12);
  }, [description, group, chapter, itemType, groupHeading, footnote, standaloneUnit, variants, tags]);

  if (!isOpen) return null;

  const handleAddTag = (t: string) => {
    const clean = t.trim();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleApplyAllSuggestedTags = () => {
    if (suggestedTags.length === 0) return;
    const additions = suggestedTags.map((s) => s.tag).filter((t) => !tags.includes(t));
    if (additions.length > 0) {
      setTags([...tags, ...additions]);
    }
  };

  const handleRemoveTag = (tToRemove: string) => {
    setTags(tags.filter((t) => t !== tToRemove));
  };

  const handleAddVariantRow = () => {
    if (!newVarName.trim()) {
      setError('Variant name / rating is required to add variant row');
      return;
    }
    if (!newVarRate.trim() || isNaN(parseFloat(newVarRate)) || parseFloat(newVarRate) < 0) {
      setError('Please provide a valid numeric rate for the variant');
      return;
    }

    const varCode = newVarCode.trim() || (code ? `${code}.${variants.length + 1}` : `var-${variants.length + 1}`);
    setVariants([
      ...variants,
      {
        code: varCode,
        name: newVarName.trim(),
        unit: newVarUnit.trim() || 'Each',
        rate: newVarRate.trim(),
        isModified: true,
        isDeleted: false,
      },
    ]);

    setNewVarCode('');
    setNewVarName('');
    setNewVarRate('');
    setError(null);
  };

  const handleDeleteVariantToggle = (idx: number) => {
    setVariants(
      variants.map((v, i) => (i === idx ? { ...v, isDeleted: !v.isDeleted, isModified: true } : v))
    );
  };

  const handleVariantFieldChange = (idx: number, field: keyof DSRVariantItem, value: string) => {
    setVariants(
      variants.map((v, i) => (i === idx ? { ...v, [field]: value, isModified: true } : v))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Item code is required (e.g. 1.1 or 24.3)');
      return;
    }
    if (!description.trim()) {
      setError('Item description is required');
      return;
    }

    // If no variants, validate standalone rate
    if (variants.length === 0 && standaloneRate.trim()) {
      const numRate = parseFloat(standaloneRate);
      if (isNaN(numRate) || numRate < 0) {
        setError('Standalone rate must be a valid positive number');
        return;
      }
    }

    const updatedItem: DSRMasterItem = {
      id: item?.id || `new-${Date.now()}`,
      c: code.trim(),
      g: group.trim(),
      h: chapter.trim(),
      t: itemType.trim(),
      d: description.trim(),
      gr: groupHeading.trim() || '',
      p: Number(pageNumber) || 1,
      f: footnote.trim() || '',
      u: variants.length > 0 ? null : standaloneUnit.trim() || 'Each',
      r: variants.length > 0 ? null : (standaloneRate.trim() || null),
      variants: variants,
      tg: tags,
      s: item?.s || '',
      isModified: true,
      isCustomAdded: item?.isCustomAdded || isNew,
      isDeleted: item?.isDeleted ?? false,
      modifiedAt: new Date().toISOString(),
    };

    onSave(updatedItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
              {isNew ? 'Add Custom DSR Master Item' : `Edit DSR Item ${item?.c}`}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Refine specifications, item codes, tags, or variant rate table item-wise.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section: Primary Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300 mb-1">
                Item Code / Number <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 1.1 or 24.3"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300 mb-1">
                Main Category (Group)
              </label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              >
                {CATEGORIES.filter((c) => c !== 'All categories').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300 mb-1">
                Chapter Heading
              </label>
              <input
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="e.g. 1. Wiring"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300 mb-1">
                Item Type
              </label>
              <input
                type="text"
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                placeholder="e.g. Wiring – Light/Fan/Call-bell Points"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300 mb-1">
                Group Sub-heading (Optional)
              </label>
              <input
                type="text"
                value={groupHeading}
                onChange={(e) => setGroupHeading(e.target.value)}
                placeholder="e.g. CONDUIT (STEEL & PVC ) AND ACCESSORIES"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Master Specification Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300 mb-1">
              Specification Description <span className="text-rose-600 dark:text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full specification text for this schedule item..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 leading-relaxed font-sans text-xs sm:text-sm"
              required
            />
          </div>

          {/* Section: Variants Table Management */}
          <div className="p-3 sm:p-4 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Sub-Items &amp; Variant Rates Table
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Manage sized lines (e.g. Group A, Group B, ratings, sizes, units, and rates).
                </p>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                {variants.length} variant {variants.length === 1 ? 'row' : 'rows'}
              </span>
            </div>

            {variants.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-transparent">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-300 dark:border-slate-800 text-[11px]">
                      <th className="py-2 px-2.5 w-24">Sub-Code</th>
                      <th className="py-2 px-2.5">Variant / Size / Rating</th>
                      <th className="py-2 px-2.5 w-24">Unit</th>
                      <th className="py-2 px-2.5 w-28 text-right">Rate ₹</th>
                      <th className="py-2 px-2.5 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {variants.map((v, idx) => (
                      <tr 
                        key={idx}
                        className={v.isDeleted ? 'bg-rose-50 dark:bg-rose-950/30 opacity-60' : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'}
                      >
                        <td className="p-2">
                          <input
                            type="text"
                            value={v.code}
                            onChange={(e) => handleVariantFieldChange(idx, 'code', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400"
                            disabled={v.isDeleted}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={v.name}
                            onChange={(e) => handleVariantFieldChange(idx, 'name', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-950 dark:text-white"
                            disabled={v.isDeleted}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={v.unit}
                            onChange={(e) => handleVariantFieldChange(idx, 'unit', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-xs text-slate-950 dark:text-white"
                            disabled={v.isDeleted}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={v.rate}
                            onChange={(e) => handleVariantFieldChange(idx, 'rate', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-xs text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400"
                            disabled={v.isDeleted}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteVariantToggle(idx)}
                            className={`p-1 rounded transition-colors ${
                              v.isDeleted 
                                ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                            }`}
                            title={v.isDeleted ? 'Restore variant row' : 'Delete variant row'}
                          >
                            {v.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Standalone rate input if no variants */
              <div className="p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium block mb-2">
                  No variant table — configured as Single Standalone Item:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Rate (₹)</label>
                    <input
                      type="text"
                      value={standaloneRate}
                      onChange={(e) => setStandaloneRate(e.target.value)}
                      placeholder="e.g. 2090"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Unit</label>
                    <input
                      type="text"
                      value={standaloneUnit}
                      onChange={(e) => setStandaloneUnit(e.target.value)}
                      placeholder="e.g. Point, Set, Each"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Append New Variant Row Form */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">
                + Append New Variant to this Item:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newVarCode}
                    onChange={(e) => setNewVarCode(e.target.value)}
                    placeholder="Code (e.g. 1.1.4)"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-950 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-5">
                  <input
                    type="text"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    placeholder="Variant name / rating / size"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-950 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newVarUnit}
                    onChange={(e) => setNewVarUnit(e.target.value)}
                    placeholder="Unit"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-950 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newVarRate}
                    onChange={(e) => setNewVarRate(e.target.value)}
                    placeholder="Rate ₹"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-950 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="w-full h-full bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center justify-center p-1 text-xs transition-colors"
                    title="Add row"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Page, Footnote & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300 mb-1">
                Schedule Folio Page Number
              </label>
              <input
                type="number"
                min="1"
                value={pageNumber}
                onChange={(e) => setPageNumber(parseInt(e.target.value) || 1)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300 mb-1">
                Footnote / Civil DSR Note (Optional)
              </label>
              <input
                type="text"
                value={footnote}
                onChange={(e) => setFootnote(e.target.value)}
                placeholder="e.g. Rate to be taken from Civil DSR..."
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Tags Management */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300">
                Search &amp; Categorization Tags
              </label>
              {suggestedTags.length > 0 && (
                <button
                  type="button"
                  onClick={handleApplyAllSuggestedTags}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 px-2.5 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-500/30 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Add All Suggested ({suggestedTags.length})</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px] items-center">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="Type tag & press enter..."
                  className="bg-transparent text-xs text-slate-950 dark:text-white placeholder-slate-400 focus:outline-none w-full"
                />
              </div>
            </div>

            {/* Auto-Suggested Tags Bar */}
            {suggestedTags.length > 0 ? (
              <div className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-950/20 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Suggested Tags from Description (click to add):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTags.map((sug) => (
                    <button
                      key={sug.tag}
                      type="button"
                      onClick={() => handleAddTag(sug.tag)}
                      title={`${sug.domain} • ${sug.reason}`}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white dark:bg-slate-900 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40 transition-colors"
                    >
                      <Plus className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>{sug.tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              description.trim().length < 8 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enter an item specification description above to auto-suggest searchable tags (e.g., Wiring, Safety, Outdoor).
                </p>
              )
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 py-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
