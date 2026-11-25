import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { DSRVariantItem } from '../types';

interface VariantEditModalProps {
  isOpen: boolean;
  itemCode: string;
  variant: DSRVariantItem | null;
  variantIndex: number;
  onClose: () => void;
  onSave: (updatedVariant: DSRVariantItem, variantIndex: number) => void;
}

export const VariantEditModal: React.FC<VariantEditModalProps> = ({
  isOpen,
  itemCode,
  variant,
  variantIndex,
  onClose,
  onSave,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('Each');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (variant) {
      setCode(variant.code || '');
      setName(variant.name || '');
      setUnit(variant.unit || 'Each');
      setRate(String(variant.rate ?? ''));
    } else {
      setCode(`${itemCode}.${variantIndex + 1}`);
      setName('');
      setUnit('Each');
      setRate('');
    }
    setError(null);
  }, [variant, variantIndex, itemCode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Variant name / rating is required (e.g. "Group A" or "100 A 36kA")');
      return;
    }
    if (!rate.trim() || isNaN(parseFloat(rate)) || parseFloat(rate) < 0) {
      setError('Please enter a valid positive rate in ₹');
      return;
    }

    onSave(
      {
        code: code.trim() || `${itemCode}.${variantIndex + 1}`,
        name: name.trim(),
        unit: unit.trim() || 'Each',
        rate: rate.trim(),
        isModified: true,
        isDeleted: variant?.isDeleted ?? false,
      },
      variantIndex
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl w-full max-w-lg shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
              {variant ? 'Edit Sub-Item / Variant' : 'Add New Variant Row'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              For master item <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{itemCode}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-800 dark:text-slate-300 mb-1">
                Variant Sub-Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 1.1.1"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-800 dark:text-slate-300 mb-1">
                Unit of Measurement
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. Point, Meter, Each"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 dark:text-slate-300 mb-1">
              Variant Name / Rating / Specification Size <span className="text-rose-600 dark:text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Group A, 63 A 10kA, 1.5 sq.mm"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 dark:text-slate-300 mb-1">
              CPWD DSR Rate (₹) <span className="text-rose-600 dark:text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-500 dark:text-slate-400 font-bold text-xs">₹</span>
              <input
                type="number"
                step="any"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 1417"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs font-mono text-slate-950 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                required
              />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              Rates are as per official CPWD DSR (E&amp;M) 2025 Schedule.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Variant</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
