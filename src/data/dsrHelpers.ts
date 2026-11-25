import { DSRMasterItem } from '../types';

export const CATEGORIES = [
  'All categories',
  'Internal Electrical Work',
  'External Electrical Work',
  'Lift & Escalator',
  'Sub-Station Equipment',
  'Wet Riser & Sprinkler System',
  'Fire Detection & Alarm System',
  'DG Sets',
  'HVAC',
  'Low Voltage Systems',
  'Appendix – Labour & Hire',
  'Appendix – Basic Material Rates',
];

export function getItemTypesByCategory(items: DSRMasterItem[], category?: string): string[] {
  const filtered = category && category !== 'All categories'
    ? items.filter((it) => it.g === category)
    : items;
  const types = Array.from(new Set(filtered.map((it) => it.t))).filter(Boolean);
  return ['All item types', ...types.sort()];
}

export function getCategories(items: DSRMasterItem[]): string[] {
  const cats = Array.from(new Set(items.map((it) => it.g))).filter(Boolean);
  return ['All categories', ...cats];
}

export function getItemMinRate(item: DSRMasterItem): number {
  const rates: number[] = [];
  if (item.r !== null && item.r !== undefined && item.r !== '') {
    const rNum = parseFloat(String(item.r));
    if (!isNaN(rNum)) rates.push(rNum);
  }
  if (item.variants && item.variants.length > 0) {
    for (const v of item.variants) {
      if (!v.isDeleted) {
        const vNum = parseFloat(v.rate);
        if (!isNaN(vNum)) rates.push(vNum);
      }
    }
  }
  return rates.length > 0 ? Math.min(...rates) : Infinity;
}

export function getItemMaxRate(item: DSRMasterItem): number {
  const rates: number[] = [];
  if (item.r !== null && item.r !== undefined && item.r !== '') {
    const rNum = parseFloat(String(item.r));
    if (!isNaN(rNum)) rates.push(rNum);
  }
  if (item.variants && item.variants.length > 0) {
    for (const v of item.variants) {
      if (!v.isDeleted) {
        const vNum = parseFloat(v.rate);
        if (!isNaN(vNum)) rates.push(vNum);
      }
    }
  }
  return rates.length > 0 ? Math.max(...rates) : 0;
}
