import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Circle,
  Compass,
  Crosshair,
  FileSpreadsheet,
  FileText,
  FileUp,
  Hexagon,
  Layers,
  Lock,
  Maximize2,
  MousePointer,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  Ruler,
  ScanText,
  Sparkles,
  Square,
  Trash2,
  Unlock,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  FloorPlanExtractedTextItem,
  FloorPlanPoint,
  FloorPlanRoom,
  FloorPlanSheet,
} from '../types';
import { FLOOR_OPTIONS } from '../data/wattageTable';
import {
  detectRoomsFromPdfTextLayer,
  extractLabelFromPdfTexts,
  getRoomImageBoundingBox,
  isLikelyDimensionOrAreaText,
  parseDimensionPair,
} from '../utils/floorPlanTextParser';

async function loadPdfJs() {
  const [pdfjsLib, workerMod] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjsLib;
}

const STORAGE_KEY_FLOOR_PLAN = 'dsr_floor_plan_mapper_v1';
const FEET_PER_METER = 3.280839895;

const ROOM_PALETTE = [
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#f97316', // Orange
];

type ActiveTool = 'select' | 'rect' | 'polygon' | 'circle' | 'calibrate';
type DimUnit = 'm' | 'ft';

interface ComputedRoomMetrics {
  widthM: number;
  lengthM: number;
  diameterM: number;
  perimeterM: number;
  areaSqm: number;
  areaSqft: number;
  dimLabel: string;
}

interface PolygonEdgeInfo {
  index: number;
  fromIdx: number;
  toIdx: number;
  p1: FloorPlanPoint;
  p2: FloorPlanPoint;
  midX: number;
  midY: number;
  lengthPx: number;
  lengthM: number;
  angleDeg: number;
}

interface FloorPlanMapperProps {
  onSendRoomsToInventory: (
    mappedRooms: { floor: string; roomName: string; sqmt: number; sqft: number }[],
    mode: 'smart' | 'replace' | 'append'
  ) => void;
  onSkipToInventory: () => void;
  onNotify?: (msg: string) => void;
}

function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return Number(d.toFixed(1));
}

function computePolygonCentroid(points: FloorPlanPoint[]): FloorPlanPoint {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

function rotatePointAround(
  pt: FloorPlanPoint,
  origin: FloorPlanPoint,
  angleDeg: number
): FloorPlanPoint {
  if (!angleDeg) return pt;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = pt.x - origin.x;
  const dy = pt.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

function recenterRotatedPolygonPoints(
  localPts: FloorPlanPoint[],
  oldCenter: FloorPlanPoint,
  rotationDeg: number
): { points: FloorPlanPoint[]; cx: number; cy: number } {
  if (!rotationDeg) {
    const c = computePolygonCentroid(localPts);
    return { points: localPts, cx: c.x, cy: c.y };
  }
  const worldPts = localPts.map((p) => rotatePointAround(p, oldCenter, rotationDeg));
  const nextCenter = computePolygonCentroid(worldPts);
  const nextLocalPts = worldPts.map((wp) => rotatePointAround(wp, nextCenter, -rotationDeg));
  return { points: nextLocalPts, cx: nextCenter.x, cy: nextCenter.y };
}

function computePolygonEdges(points: FloorPlanPoint[], pixelsPerMeter: number): PolygonEdgeInfo[] {
  const ppm = pixelsPerMeter > 0 ? pixelsPerMeter : 40;
  if (!points || points.length < 2) return [];
  const edges: PolygonEdgeInfo[] = [];
  for (let i = 0; i < points.length; i++) {
    const toIdx = (i + 1) % points.length;
    const p1 = points[i];
    const p2 = points[toIdx];
    const lengthPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    edges.push({
      index: i,
      fromIdx: i,
      toIdx,
      p1,
      p2,
      midX: (p1.x + p2.x) / 2,
      midY: (p1.y + p2.y) / 2,
      lengthPx,
      lengthM: lengthPx / ppm,
      angleDeg: normalizeDeg((Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI),
    });
  }
  return edges;
}

function computeRoomMetrics(room: FloorPlanRoom, pixelsPerMeter: number): ComputedRoomMetrics {
  const ppm = pixelsPerMeter > 0 ? pixelsPerMeter : 40;
  const SQFT_PER_SQM = 10.7639104;

  if (room.shapeType === 'rect') {
    const wM = (room.widthPx || 0) / ppm;
    const hM = (room.heightPx || 0) / ppm;
    const areaSqm = wM * hM;
    return {
      widthM: wM,
      lengthM: hM,
      diameterM: 0,
      perimeterM: 2 * (wM + hM),
      areaSqm,
      areaSqft: areaSqm * SQFT_PER_SQM,
      dimLabel: `${wM.toFixed(2)} × ${hM.toFixed(2)} m`,
    };
  }

  if (room.shapeType === 'circle') {
    const rM = (room.radiusPx || 0) / ppm;
    const dM = rM * 2;
    const areaSqm = Math.PI * rM * rM;
    return {
      widthM: dM,
      lengthM: dM,
      diameterM: dM,
      perimeterM: 2 * Math.PI * rM,
      areaSqm,
      areaSqft: areaSqm * SQFT_PER_SQM,
      dimLabel: `Ø ${dM.toFixed(2)} m`,
    };
  }

  const pts = room.points || [];
  if (pts.length < 3) {
    return {
      widthM: 0,
      lengthM: 0,
      diameterM: 0,
      perimeterM: 0,
      areaSqm: 0,
      areaSqft: 0,
      dimLabel: `${pts.length} pts`,
    };
  }

  let area2 = 0;
  let perimPx = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    area2 += p1.x * p2.y - p2.x * p1.y;
    perimPx += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (p1.x < minX) minX = p1.x;
    if (p1.x > maxX) maxX = p1.x;
    if (p1.y < minY) minY = p1.y;
    if (p1.y > maxY) maxY = p1.y;
  }

  const areaPx = Math.abs(area2) / 2;
  const areaSqm = areaPx / (ppm * ppm);
  const wM = (maxX - minX) / ppm;
  const lM = (maxY - minY) / ppm;

  return {
    widthM: wM,
    lengthM: lM,
    diameterM: 0,
    perimeterM: perimPx / ppm,
    areaSqm,
    areaSqft: areaSqm * SQFT_PER_SQM,
    dimLabel: `${wM.toFixed(2)} × ${lM.toFixed(2)} m (${pts.length}v)`,
  };
}

function getRoomBoundingRadius(room: FloorPlanRoom): number {
  if (room.shapeType === 'circle') return room.radiusPx || 20;
  if (room.shapeType === 'rect') return (room.heightPx || 40) / 2;
  const pts = room.points || [];
  let minY = Infinity;
  for (const p of pts) {
    if (p.y < minY) minY = p.y;
  }
  return Math.max(24, room.cy - minY);
}

function acceptTwoDecimalInput(raw: string, prev: string): string | null {
  const cleaned = raw.trim();
  if (cleaned === '') return '';
  if (/^\d*(\.\d{0,2})?$/.test(cleaned)) return cleaned;
  const parsed = parseFloat(cleaned);
  if (!isNaN(parsed) && parsed >= 0 && cleaned.length - prev.length > 1) {
    return (Math.round(parsed * 100) / 100).toString();
  }
  return null;
}

function makeUprightLocalAngle(
  localAngleDeg: number,
  roomRotationDeg: number,
  canvasRotationDeg: number
): number {
  const screenDeg = normalizeDeg(localAngleDeg + roomRotationDeg + canvasRotationDeg);
  if (screenDeg > 90 && screenDeg <= 270) {
    return localAngleDeg + 180;
  }
  return localAngleDeg;
}

interface InteriorLabelSlot {
  x: number;
  y: number;
  angleDeg: number;
  availW: number;
  availH: number;
  score: number;
}

function findPolygonSlotForAngle(
  localPts: FloorPlanPoint[],
  angleDeg: number,
  idealW: number,
  idealH: number
): InteriorLabelSlot {
  const rad = (-angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotPts = localPts.map((p) => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  }));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of rotPts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const bboxW = Math.max(1, maxX - minX);
  const bboxH = Math.max(1, maxY - minY);
  const centroid = computePolygonCentroid(rotPts);

  const verticalBoundsAt = (x: number, targetY: number): { top: number; bot: number } | null => {
    const ys: number[] = [];
    for (let i = 0; i < rotPts.length; i++) {
      const p1 = rotPts[i];
      const p2 = rotPts[(i + 1) % rotPts.length];
      if ((p1.x <= x && p2.x > x) || (p2.x <= x && p1.x > x)) {
        const t = (x - p1.x) / (p2.x - p1.x);
        ys.push(p1.y + t * (p2.y - p1.y));
      }
    }
    ys.sort((a, b) => a - b);
    for (let k = 0; k + 1 < ys.length; k += 2) {
      if (targetY >= ys[k] && targetY <= ys[k + 1]) {
        return { top: ys[k], bot: ys[k + 1] };
      }
    }
    return null;
  };

  let best: InteriorLabelSlot | null = null;
  const steps = 15;
  for (let s = 1; s <= steps; s++) {
    const y = minY + (s / (steps + 1)) * bboxH;
    const xs: number[] = [];
    for (let i = 0; i < rotPts.length; i++) {
      const p1 = rotPts[i];
      const p2 = rotPts[(i + 1) % rotPts.length];
      if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
        const t = (y - p1.y) / (p2.y - p1.y);
        xs.push(p1.x + t * (p2.x - p1.x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xA = xs[k];
      const xB = xs[k + 1];
      const chordW = xB - xA;
      if (chordW < 2) continue;
      const midX = (xA + xB) / 2;
      const sampleXs = [xA + chordW * 0.25, midX, xB - chordW * 0.25];
      let minTopClear = Infinity;
      let minBotClear = Infinity;
      for (const sx of sampleXs) {
        const vb = verticalBoundsAt(sx, y);
        if (!vb) {
          minTopClear = 0;
          minBotClear = 0;
          break;
        }
        minTopClear = Math.min(minTopClear, y - vb.top);
        minBotClear = Math.min(minBotClear, vb.bot - y);
      }
      const safeH = Math.max(0, 2 * Math.min(minTopClear, minBotClear) * 0.88);
      const safeW = chordW * 0.88;
      if (safeH <= 0.5) continue;

      const wFit = Math.min(safeW / Math.max(1, idealW), 1.35);
      const hFit = Math.min(safeH / Math.max(1, idealH), 1.35);
      const distPenalty = Math.hypot(midX - centroid.x, y - centroid.y) / (Math.hypot(bboxW, bboxH) + 1);
      const areaBonus = Math.min(safeW * safeH, idealW * idealH * 4) / (idealW * idealH * 20 + 1);
      const score = wFit * 0.55 + hFit * 0.45 + areaBonus - distPenalty * 0.04;

      if (!best || score > best.score) {
        const backCos = Math.cos((angleDeg * Math.PI) / 180);
        const backSin = Math.sin((angleDeg * Math.PI) / 180);
        best = {
          x: midX * backCos - y * backSin,
          y: midX * backSin + y * backCos,
          angleDeg,
          availW: safeW,
          availH: safeH,
          score,
        };
      }
    }
  }

  if (best) return best;
  const backCos = Math.cos((angleDeg * Math.PI) / 180);
  const backSin = Math.sin((angleDeg * Math.PI) / 180);
  return {
    x: centroid.x * backCos - centroid.y * backSin,
    y: centroid.x * backSin + centroid.y * backCos,
    angleDeg,
    availW: bboxW * 0.55,
    availH: bboxH * 0.55,
    score: 0.01,
  };
}

function computeContainedLabelSlot(
  room: FloorPlanRoom,
  canvasRotationDeg: number,
  zoom: number
): InteriorLabelSlot {
  const idealW = 136 / zoom;
  const idealH = 36 / zoom;

  if (room.shapeType === 'rect') {
    const w = room.widthPx || 0;
    const h = room.heightPx || 0;
    const useVertical = h > w * 1.25 && w < idealW * 0.85;
    const rawAngle = useVertical ? -90 : 0;
    const angleDeg = makeUprightLocalAngle(rawAngle, room.rotationDeg, canvasRotationDeg);
    return {
      x: room.cx,
      y: room.cy,
      angleDeg,
      availW: (useVertical ? h : w) * 0.92,
      availH: (useVertical ? w : h) * 0.90,
      score: 1,
    };
  }

  if (room.shapeType === 'circle') {
    const r = room.radiusPx || 0;
    const angleDeg = makeUprightLocalAngle(
      -room.rotationDeg - canvasRotationDeg,
      room.rotationDeg,
      canvasRotationDeg
    );
    return {
      x: room.cx,
      y: room.cy,
      angleDeg,
      availW: r * 1.48,
      availH: r * 1.15,
      score: 1,
    };
  }

  const pts = room.points || [];
  if (pts.length < 3) {
    return {
      x: room.cx,
      y: room.cy,
      angleDeg: makeUprightLocalAngle(-room.rotationDeg - canvasRotationDeg, room.rotationDeg, canvasRotationDeg),
      availW: 20,
      availH: 20,
      score: 0,
    };
  }

  const horizAngle = makeUprightLocalAngle(
    -room.rotationDeg - canvasRotationDeg,
    room.rotationDeg,
    canvasRotationDeg
  );
  const vertAngle = makeUprightLocalAngle(
    -room.rotationDeg - canvasRotationDeg - 90,
    room.rotationDeg,
    canvasRotationDeg
  );

  const horizSlot = findPolygonSlotForAngle(pts, horizAngle, idealW, idealH);
  const vertSlot = findPolygonSlotForAngle(pts, vertAngle, idealW, idealH);
  return vertSlot.score > horizSlot.score * 1.28 ? vertSlot : horizSlot;
}

async function cropRoomImageDataUrl(
  sheet: FloorPlanSheet,
  room: FloorPlanRoom
): Promise<string | null> {
  const box = getRoomImageBoundingBox(room, 16);
  const sx = Math.max(0, Math.floor(box.x));
  const sy = Math.max(0, Math.floor(box.y));
  const sw = Math.min(sheet.width - sx, Math.max(24, Math.ceil(box.width)));
  const sh = Math.min(sheet.height - sy, Math.max(24, Math.ceil(box.height)));
  if (sw <= 10 || sh <= 10) return null;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load sheet image for crop.'));
    i.src = sheet.imageDataUrl;
  });

  const canvas = document.createElement('canvas');
  const scale = Math.min(2, Math.max(1, 512 / Math.max(sw, sh)));
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

async function prepareSheetImageForVision(sheet: FloorPlanSheet): Promise<string> {
  const maxDim = 1600;
  if (
    sheet.width <= maxDim &&
    sheet.height <= maxDim &&
    sheet.imageDataUrl.length < 1_200_000 &&
    !sheet.imageDataUrl.startsWith('data:image/svg')
  ) {
    return sheet.imageDataUrl;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load sheet image for optimization.'));
    i.src = sheet.imageDataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(sheet.width || img.naturalWidth, sheet.height || img.naturalHeight));
  const w = Math.max(1, Math.round((sheet.width || img.naturalWidth) * scale));
  const h = Math.max(1, Math.round((sheet.height || img.naturalHeight) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sheet.imageDataUrl;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.86);
}

async function safeReadJson(resp: Response): Promise<Record<string, unknown>> {
  const raw = await resp.text();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      error: raw?.slice(0, 220) || `HTTP ${resp.status} ${resp.statusText}`,
    };
  }
}

async function runLocalOcrFloorPlanScan(
  sheet: FloorPlanSheet
): Promise<FloorPlanExtractedTextItem[]> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load sheet image for local OCR.'));
    i.src = sheet.imageDataUrl;
  });

  // Render crisp high-contrast image at <= 2000px for Tesseract OCR
  const targetMax = 2000;
  const srcW = sheet.width || img.naturalWidth || 1600;
  const srcH = sheet.height || img.naturalHeight || 1000;
  const scale = Math.min(2, targetMax / Math.max(srcW, srcH));
  const cw = Math.max(1, Math.round(srcW * scale));
  const ch = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(img, 0, 0, cw, ch);

  const tMod = await import('tesseract.js');
  const TesseractApi = (tMod.default || tMod) as typeof import('tesseract.js');
  const worker = await TesseractApi.createWorker('eng');
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: TesseractApi.PSM.SPARSE_TEXT,
    });
    const result = await worker.recognize(canvas, {}, { blocks: true, text: true });
    const items: FloorPlanExtractedTextItem[] = [];
    const blocks = result.data.blocks || [];
    for (const block of blocks) {
      for (const para of block.paragraphs || []) {
        for (const line of para.lines || []) {
          for (const word of line.words || []) {
            const text = (word.text || '').trim();
            if (!text || word.confidence < 30) continue;
            const x0 = word.bbox.x0 / scale;
            const y0 = word.bbox.y0 / scale;
            const x1 = word.bbox.x1 / scale;
            const y1 = word.bbox.y1 / scale;
            items.push({
              text,
              x: Math.round(x0),
              y: Math.round(y1), // baseline approx matching PDF text coords
              width: Math.max(4, Math.round(x1 - x0)),
              height: Math.max(6, Math.round(y1 - y0)),
            });
          }
        }
      }
    }
    return items;
  } finally {
    await worker.terminate();
  }
}

async function runLocalOcrRoomCrop(
  croppedImageDataUrl: string
): Promise<{ roomName: string; printedDimensions: string }> {
  const tMod = await import('tesseract.js');
  const TesseractApi = (tMod.default || tMod) as typeof import('tesseract.js');
  const worker = await TesseractApi.createWorker('eng');
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: TesseractApi.PSM.SPARSE_TEXT,
    });
    const result = await worker.recognize(croppedImageDataUrl, {}, { blocks: true, text: true });
    const rawLines = (result.data.text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let printedDimensions = '';
    const nameParts: string[] = [];
    for (const line of rawLines) {
      const dim = parseDimensionPair(line);
      if (dim) {
        if (!printedDimensions) printedDimensions = dim.rawDimText;
        const stripped = line.replace(dim.rawDimText, '').replace(/[()[\]]/g, '').trim();
        if (stripped && !isLikelyDimensionOrAreaText(stripped)) {
          nameParts.push(stripped);
        }
      } else if (!isLikelyDimensionOrAreaText(line) && line.length >= 2) {
        nameParts.push(line);
      }
    }
    return {
      roomName: nameParts.join(' ').replace(/\s+/g, ' ').trim(),
      printedDimensions,
    };
  } finally {
    await worker.terminate();
  }
}

export const FloorPlanMapper: React.FC<FloorPlanMapperProps> = ({
  onSendRoomsToInventory,
  onSkipToInventory,
  onNotify,
}) => {
  const [sheets, setSheets] = useState<FloorPlanSheet[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FLOOR_PLAN);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.sheets)) return parsed.sheets;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [rooms, setRooms] = useState<FloorPlanRoom[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FLOOR_PLAN);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.rooms)) return parsed.rooms;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [activeSheetId, setActiveSheetId] = useState<string | null>(() => sheets[0]?.id || null);
  const [activeFloor, setActiveFloor] = useState<string>('Ground Floor');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [activeTool, setActiveTool] = useState<ActiveTool>('rect');

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  // Viewport Transform State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // AI / Auto-Read & Label Extraction state
  const [autoReadLoading, setAutoReadLoading] = useState(false);
  const [extractingRoomId, setExtractingRoomId] = useState<string | null>(null);
  const [autoExtractOnDraw, setAutoExtractOnDraw] = useState<boolean>(true);
  const [detectedPrintScaleSuggestion, setDetectedPrintScaleSuggestion] = useState<{
    ppm: number;
    sampleCount: number;
  } | null>(null);

  // Typed Geometry / Resize / Edge Length Inputs State
  const [dimUnit, setDimUnit] = useState<DimUnit>('m');
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [typedWidthInput, setTypedWidthInput] = useState<string>('');
  const [typedLengthInput, setTypedLengthInput] = useState<string>('');
  const [typedDiaInput, setTypedDiaInput] = useState<string>('');
  const [typedScalePct, setTypedScalePct] = useState<string>('100');
  const [typedEdgeInputs, setTypedEdgeInputs] = useState<Record<number, string>>({});
  const [nextPolyEdgeLen, setNextPolyEdgeLen] = useState<string>('');

  // Interactive drawing drafts
  const [rectDraft, setRectDraft] = useState<{
    cx: number;
    cy: number;
    widthPx: number;
    heightPx: number;
    rotationDeg: number;
  } | null>(null);
  const [circleDraft, setCircleDraft] = useState<{
    cx: number;
    cy: number;
    radiusPx: number;
  } | null>(null);
  const [polyPoints, setPolyPoints] = useState<FloorPlanPoint[]>([]);
  const [cursorImgPt, setCursorImgPt] = useState<FloorPlanPoint | null>(null);

  // Calibration state
  const [calPts, setCalPts] = useState<FloorPlanPoint[]>([]);
  const [calModalOpen, setCalModalOpen] = useState(false);
  const [calRealDist, setCalRealDist] = useState('5');
  const [calUnit, setCalUnit] = useState<'m' | 'ft'>('m');

  // Sync mode choice for sending to inventory
  const [syncMode, setSyncMode] = useState<'smart' | 'replace' | 'append'>('smart');

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tableRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const focusedDimFieldRef = useRef<string | null>(null);

  // Pointer interaction ref for zero-lag drag operations
  const dragSessionRef = useRef<{
    kind:
      | 'pan'
      | 'draw-rect'
      | 'draw-circle'
      | 'move-room'
      | 'rotate-room'
      | 'resize-rect-corner'
      | 'resize-rect-edge'
      | 'resize-circle'
      | 'move-poly-vertex';
    startClientX: number;
    startClientY: number;
    startPan: { x: number; y: number };
    startImgPt: FloorPlanPoint;
    roomSnapshot?: FloorPlanRoom;
    handleIndex?: number; // corner 0..3, edge 0..3 (Top,Right,Bottom,Left), or vertex idx
  } | null>(null);

  const activeSheet = useMemo(
    () => sheets.find((s) => s.id === activeSheetId) || sheets[0] || null,
    [sheets, activeSheetId]
  );

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) || null,
    [rooms, selectedRoomId]
  );

  // Keep typed dimension inputs synchronized whenever selected room / unit / scale changes (without clobbering the currently focused input)
  useEffect(() => {
    if (!selectedRoom || !activeSheet) return;
    const ppm = activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
    const mult = dimUnit === 'ft' ? FEET_PER_METER : 1;
    const metrics = computeRoomMetrics(selectedRoom, ppm);

    if (focusedDimFieldRef.current !== 'rect-w' && focusedDimFieldRef.current !== 'poly-w') {
      setTypedWidthInput((metrics.widthM * mult).toFixed(2));
    }
    if (focusedDimFieldRef.current !== 'rect-l' && focusedDimFieldRef.current !== 'poly-l') {
      setTypedLengthInput((metrics.lengthM * mult).toFixed(2));
    }
    if (focusedDimFieldRef.current !== 'circle-d') {
      setTypedDiaInput((metrics.diameterM * mult).toFixed(2));
    }
    if (focusedDimFieldRef.current !== 'scale-pct') {
      setTypedScalePct('100');
    }

    if (selectedRoom.shapeType === 'polygon' && selectedRoom.points) {
      const edges = computePolygonEdges(selectedRoom.points, ppm);
      setTypedEdgeInputs((prev) => {
        const map: Record<number, string> = {};
        edges.forEach((ed) => {
          if (focusedDimFieldRef.current === `edge-${ed.index}` && prev[ed.index] !== undefined) {
            map[ed.index] = prev[ed.index];
          } else {
            map[ed.index] = (ed.lengthM * mult).toFixed(2);
          }
        });
        return map;
      });
    } else {
      setTypedEdgeInputs({});
    }
  }, [selectedRoom, activeSheet?.pixelsPerMeter, dimUnit]);

  useEffect(() => {
    if (activeSheet && !activeSheetId) {
      setActiveSheetId(activeSheet.id);
    }
  }, [activeSheet, activeSheetId]);

  // Persist to localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FLOOR_PLAN, JSON.stringify({ sheets, rooms }));
      setStorageWarning(null);
    } catch {
      try {
        // Fallback: drop extractedTexts from persistence if quota exceeded
        const compactSheets = sheets.map(({ extractedTexts: _et, ...rest }) => rest);
        localStorage.setItem(
          STORAGE_KEY_FLOOR_PLAN,
          JSON.stringify({ sheets: compactSheets, rooms })
        );
        setStorageWarning(null);
      } catch {
        setStorageWarning(
          'Drawing file exceeds browser local-save quota; rooms remain active in this session.'
        );
      }
    }
  }, [sheets, rooms]);

  // Fit drawing nicely to viewport
  const fitSheetToViewport = useCallback((sheet: FloorPlanSheet | null) => {
    if (!sheet || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const rad = (sheet.canvasRotationDeg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rotW = sheet.width * cos + sheet.height * sin;
    const rotH = sheet.width * sin + sheet.height * cos;

    const pad = 36;
    const zx = (rect.width - pad) / rotW;
    const zy = (rect.height - pad) / rotH;
    const nextZoom = Math.min(2, Math.max(0.12, Math.min(zx, zy)));
    setZoom(Number(nextZoom.toFixed(3)));
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (activeSheet) {
      const id = window.setTimeout(() => fitSheetToViewport(activeSheet), 60);
      return () => window.clearTimeout(id);
    }
  }, [activeSheet?.id, fitSheetToViewport]);

  useEffect(() => {
    if (!hoveredRoomId) return;
    const tr = tableRowRefs.current[hoveredRoomId];
    if (tr) {
      tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [hoveredRoomId]);

  // Keyboard shortcuts (Esc, polygon Backspace/Enter, Delete, Arrow nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        setPolyPoints([]);
        setRectDraft(null);
        setCircleDraft(null);
        setCalPts([]);
        setCalModalOpen(false);
        dragSessionRef.current = null;
      } else if (e.key === 'Backspace' && activeTool === 'polygon' && polyPoints.length > 0) {
        e.preventDefault();
        setPolyPoints((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter' && activeTool === 'polygon' && polyPoints.length >= 3) {
        e.preventDefault();
        finalizePolygon(polyPoints);
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedRoomId &&
        activeTool === 'select'
      ) {
        e.preventDefault();
        handleDeleteRoom(selectedRoomId);
      } else if (
        selectedRoom &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        relocateRoomByDelta(selectedRoom, dx, dy);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Screen <-> Image inverse coordinate transform
  const clientToImagePoint = useCallback(
    (clientX: number, clientY: number): FloorPlanPoint | null => {
      if (!viewportRef.current || !activeSheet) return null;
      const rect = viewportRef.current.getBoundingClientRect();
      const vx = clientX - rect.left;
      const vy = clientY - rect.top;

      const dx = (vx - (rect.width / 2 + pan.x)) / zoom;
      const dy = (vy - (rect.height / 2 + pan.y)) / zoom;

      const rad = (-activeSheet.canvasRotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      return {
        x: dx * cos - dy * sin + activeSheet.width / 2,
        y: dx * sin + dy * cos + activeSheet.height / 2,
      };
    },
    [activeSheet, pan.x, pan.y, zoom]
  );

  const screenDeltaToImageDelta = useCallback(
    (sdx: number, sdy: number): FloorPlanPoint => {
      if (!activeSheet) return { x: sdx / zoom, y: sdy / zoom };
      const dx = sdx / zoom;
      const dy = sdy / zoom;
      const rad = (-activeSheet.canvasRotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return {
        x: dx * cos - dy * sin,
        y: dx * sin + dy * cos,
      };
    },
    [activeSheet, zoom]
  );

  // Process uploaded Image or PDF architectural drawing (including PDF vector text layer!)
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsLoadingFile(true);

    try {
      const newlyAddedSheets: FloorPlanSheet[] = [];

      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        const lowerName = file.name.toLowerCase();

        if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
          const pdfjsLib = await loadPdfJs();
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const totalPages = Math.min(pdf.numPages, 12);

          for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
            const page = await pdf.getPage(pageNo);
            const rawVp = page.getViewport({ scale: 1 });
            const targetScale = Math.min(
              2.2,
              Math.max(1.2, 2000 / Math.max(rawVp.width, rawVp.height))
            );
            const vp = page.getViewport({ scale: targetScale });

            const canvas = document.createElement('canvas');
            canvas.width = Math.round(vp.width);
            canvas.height = Math.round(vp.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

            // Extract embedded CAD text items mapped to canvas pixel space
            const extractedTexts: FloorPlanExtractedTextItem[] = [];
            try {
              const textContent = await page.getTextContent();
              for (const item of textContent.items) {
                if (!('str' in item) || !item.str.trim()) continue;
                const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
                const fontHeight = Math.hypot(tx[2], tx[3]) || (item.height || 10) * targetScale;
                extractedTexts.push({
                  text: item.str.trim(),
                  x: Math.round(tx[4]),
                  y: Math.round(tx[5]),
                  width: Math.round((item.width || 0) * targetScale),
                  height: Math.round(fontHeight),
                });
              }
            } catch {
              // ignore non-standard text layers
            }

            const guessedFloor =
              totalPages === 1
                ? activeFloor
                : FLOOR_OPTIONS[Math.min(FLOOR_OPTIONS.length - 1, 3 + pageNo - 1)] || activeFloor;

            newlyAddedSheets.push({
              id: `sheet_${Date.now()}_${fIdx}_${pageNo}`,
              name:
                totalPages > 1
                  ? `${file.name.replace(/\.pdf$/i, '')} · Pg ${pageNo}`
                  : file.name.replace(/\.pdf$/i, ''),
              defaultFloor: guessedFloor,
              imageDataUrl: dataUrl,
              width: canvas.width,
              height: canvas.height,
              pixelsPerMeter: 40,
              isCalibrated: false,
              canvasRotationDeg: 0,
              sourceType: 'pdf',
              pageNumber: pageNo,
              extractedTexts,
            });
          }
        } else if (
          file.type.startsWith('image/') ||
          /\.(png|jpe?g|webp|svg|bmp|gif)$/i.test(lowerName)
        ) {
          const rawUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Failed to read image file.'));
            reader.readAsDataURL(file);
          });

          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('Invalid image file.'));
            i.src = rawUrl;
          });

          const maxDim = 2200;
          let finalUrl = rawUrl;
          let w = img.naturalWidth || 1600;
          let h = img.naturalHeight || 1000;

          if (w > maxDim || h > maxDim || lowerName.endsWith('.svg')) {
            const scale = Math.min(1, maxDim / Math.max(w, h));
            w = Math.round(w * scale);
            h = Math.round(h * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              finalUrl = canvas.toDataURL('image/png');
            }
          }

          newlyAddedSheets.push({
            id: `sheet_${Date.now()}_${fIdx}`,
            name: file.name.replace(/\.[^/.]+$/, ''),
            defaultFloor: activeFloor,
            imageDataUrl: finalUrl,
            width: w,
            height: h,
            pixelsPerMeter: 40,
            isCalibrated: false,
            canvasRotationDeg: 0,
            sourceType: 'image',
          });
        } else {
          setUploadError(
            `Unsupported file "${file.name}". Please upload PNG, JPG, SVG, or PDF floor plans.`
          );
        }
      }

      if (newlyAddedSheets.length > 0) {
        setSheets((prev) => [...prev, ...newlyAddedSheets]);
        setActiveSheetId(newlyAddedSheets[0].id);
        setActiveFloor(newlyAddedSheets[0].defaultFloor);
        const textCount = newlyAddedSheets[0].extractedTexts?.length || 0;
        onNotify?.(
          textCount > 0
            ? `Uploaded ${newlyAddedSheets.length} sheet(s) with ${textCount} embedded PDF text labels ready for extraction.`
            : `Uploaded ${newlyAddedSheets.length} floor plan sheet(s). Draw rooms or click "Auto Read Labels & Dims".`
        );
      }
    } catch (err) {
      console.error('Architectural plan upload error:', err);
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Could not process the architectural drawing. Try a PNG/JPG or PDF file.'
      );
    } finally {
      setIsLoadingFile(false);
    }
  };

  const updateActiveSheet = (patch: Partial<FloorPlanSheet>) => {
    if (!activeSheet) return;
    setSheets((prev) => prev.map((s) => (s.id === activeSheet.id ? { ...s, ...patch } : s)));
  };

  const rotateSheetBy = (deltaDeg: number) => {
    if (!activeSheet) return;
    const nextRot = normalizeDeg(activeSheet.canvasRotationDeg + deltaDeg);
    updateActiveSheet({ canvasRotationDeg: nextRot });
  };

  const handleDeleteSheet = (sheetId: string) => {
    setSheets((prev) => {
      const remaining = prev.filter((s) => s.id !== sheetId);
      if (activeSheetId === sheetId) {
        setActiveSheetId(remaining[0]?.id || null);
      }
      return remaining;
    });
    setRooms((prev) => prev.filter((r) => r.sheetId !== sheetId));
    setSelectedRoomId(null);
  };

  const handleUpdateRoom = (roomId: string, patch: Partial<FloorPlanRoom>) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, ...patch } : r)));
  };

  const handleDeleteRoom = (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    if (selectedRoomId === roomId) setSelectedRoomId(null);
    if (hoveredRoomId === roomId) setHoveredRoomId(null);
  };

  const relocateRoomByDelta = (room: FloorPlanRoom, dx: number, dy: number) => {
    if (room.shapeType === 'polygon' && room.points) {
      handleUpdateRoom(room.id, {
        cx: room.cx + dx,
        cy: room.cy + dy,
        points: room.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      });
    } else {
      handleUpdateRoom(room.id, {
        cx: room.cx + dx,
        cy: room.cy + dy,
      });
    }
  };

  // Extract Room Name & Printed Dimensions for a specific drawn overlay shape
  const handleExtractRoomLabel = async (room: FloorPlanRoom, forceVision = false) => {
    if (!activeSheet) return;

    // Step 1: Check embedded PDF text inside the shape first (instant, zero cost)
    if (!forceVision && activeSheet.extractedTexts && activeSheet.extractedTexts.length > 0) {
      const pdfExtracted = extractLabelFromPdfTexts(room, activeSheet.extractedTexts);
      if (pdfExtracted && (pdfExtracted.roomName || pdfExtracted.printedDimensions)) {
        handleUpdateRoom(room.id, {
          roomName: pdfExtracted.roomName || room.roomName,
          printedDimText: pdfExtracted.printedDimensions || room.printedDimText,
        });
        onNotify?.(
          `Extracted from PDF: "${pdfExtracted.roomName || room.roomName}"${
            pdfExtracted.printedDimensions ? ` (${pdfExtracted.printedDimensions})` : ''
          }`
        );
        return;
      }
    }

    // Step 2: Crop room image and call Vision text extractor endpoint
    setExtractingRoomId(room.id);
    try {
      const cropped = await cropRoomImageDataUrl(activeSheet, room);
      if (!cropped) return;

      const resp = await fetch('/api/floor-plan/extract-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croppedImageDataUrl: cropped }),
      });
      const data = await safeReadJson(resp);

      let extractedName = resp.ok ? String(data.roomName || '').trim() : '';
      let extractedDim = resp.ok ? String(data.printedDimensions || '').trim() : '';

      if (!resp.ok) {
        // Fallback 1: check embedded/cached text items inside room bounds
        if (activeSheet.extractedTexts?.length) {
          const pdfHit = extractLabelFromPdfTexts(room, activeSheet.extractedTexts);
          if (pdfHit) {
            extractedName = pdfHit.roomName;
            extractedDim = pdfHit.printedDimensions;
          }
        }
        // Fallback 2: run local OCR on the cropped room box
        if (!extractedName && !extractedDim) {
          try {
            const ocr = await runLocalOcrRoomCrop(cropped);
            extractedName = ocr.roomName;
            extractedDim = ocr.printedDimensions;
          } catch {
            // ignore OCR failure and report original error if forceVision
          }
        }
      }

      if (extractedName || extractedDim) {
        handleUpdateRoom(room.id, {
          roomName: extractedName || room.roomName,
          printedDimText: extractedDim || room.printedDimText,
        });
        onNotify?.(
          `Extracted room text: "${extractedName || room.roomName}"${
            extractedDim ? ` (${extractedDim})` : ''
          }`
        );
      } else if (!resp.ok && forceVision) {
        setUploadError(String(data?.error || 'Could not extract room label.'));
      } else if (forceVision) {
        onNotify?.('No readable room label text found inside that overlay.');
      }
    } catch (err) {
      if (forceVision) {
        setUploadError(
          err instanceof Error ? err.message : 'Room text extraction failed.'
        );
      }
    } finally {
      setExtractingRoomId(null);
    }
  };

  // Create a room overlay (and auto-extract room label if enabled)
  const addMappedRoom = (
    partial: Omit<FloorPlanRoom, 'id' | 'sheetId' | 'floor' | 'roomName' | 'color'>
  ) => {
    if (!activeSheet) return;
    const nextNum = rooms.length + 1;
    const color = ROOM_PALETTE[(nextNum - 1) % ROOM_PALETTE.length];
    const newRoom: FloorPlanRoom = {
      id: `fp_room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sheetId: activeSheet.id,
      floor: activeFloor,
      roomName: `Room ${nextNum}`,
      color,
      ...partial,
    };

    // Instant synchronous check on embedded PDF text so initial name populates immediately
    if (autoExtractOnDraw && activeSheet.extractedTexts?.length) {
      const hit = extractLabelFromPdfTexts(newRoom, activeSheet.extractedTexts);
      if (hit) {
        if (hit.roomName) newRoom.roomName = hit.roomName;
        if (hit.printedDimensions) newRoom.printedDimText = hit.printedDimensions;
      }
    }

    setRooms((prev) => [...prev, newRoom]);
    setSelectedRoomId(newRoom.id);
    setHoveredRoomId(newRoom.id);

    // If auto-extract is enabled and no embedded PDF text matched inside this shape, try Vision crop async
    if (
      autoExtractOnDraw &&
      (!activeSheet.extractedTexts?.length || newRoom.roomName === `Room ${nextNum}`)
    ) {
      void handleExtractRoomLabel(newRoom, false);
    }
  };

  const finalizePolygon = (pts: FloorPlanPoint[]) => {
    if (pts.length < 3) return;
    const centroid = computePolygonCentroid(pts);
    addMappedRoom({
      shapeType: 'polygon',
      rotationDeg: 0,
      cx: centroid.x,
      cy: centroid.y,
      points: pts,
    });
    setPolyPoints([]);
  };

  // Apply text-layer / OCR room clusters onto the active sheet
  const applyTextClustersAsRooms = (
    clusters: ReturnType<typeof detectRoomsFromPdfTextLayer>,
    sourceLabel: string
  ) => {
    if (!activeSheet || clusters.length === 0) return;
    const ppm = activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
    const created: FloorPlanRoom[] = clusters.map((c, idx) => {
      const wPx = c.widthMeters > 0 ? c.widthMeters * ppm : 140;
      const hPx = c.lengthMeters > 0 ? c.lengthMeters * ppm : 110;
      return {
        id: `fp_room_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
        sheetId: activeSheet.id,
        floor: activeFloor,
        roomName: c.roomName,
        printedDimText: c.printedDimensions || undefined,
        shapeType: 'rect',
        color: ROOM_PALETTE[(rooms.length + idx) % ROOM_PALETTE.length],
        rotationDeg: 0,
        cx: c.cx,
        cy: c.cy,
        widthPx: wPx,
        heightPx: hPx,
      };
    });

    setRooms((prev) => [...prev, ...created]);
    setSelectedRoomId(created[0].id);
    setActiveTool('select');
    onNotify?.(
      `Extracted ${created.length} room labels & dimensions via ${sourceLabel}. Drag boxes to align walls.`
    );
  };

  // Auto-Read FULL Floor Plan Labels & Dimensions (Vision AI + CAD PDF Text + Local OCR Fallback)
  const handleAutoReadFloorPlan = async (mode: 'vision' | 'pdf' | 'ocr' = 'vision') => {
    if (!activeSheet) return;
    setUploadError(null);
    setAutoReadLoading(true);
    setDetectedPrintScaleSuggestion(null);

    try {
      if (mode === 'pdf' && activeSheet.extractedTexts?.length) {
        const clusters = detectRoomsFromPdfTextLayer(
          activeSheet.extractedTexts,
          activeSheet.width,
          activeSheet.height
        );
        if (clusters.length === 0) {
          onNotify?.('No standard room text clusters detected in PDF text layer.');
          return;
        }
        applyTextClustersAsRooms(clusters, 'PDF text layer');
        return;
      }

      if (mode === 'ocr') {
        const ocrTokens = await runLocalOcrFloorPlanScan(activeSheet);
        if (ocrTokens.length > 0) {
          updateActiveSheet({ extractedTexts: ocrTokens });
        }
        const clusters = detectRoomsFromPdfTextLayer(
          ocrTokens,
          activeSheet.width,
          activeSheet.height
        );
        if (clusters.length === 0) {
          onNotify?.(
            ocrTokens.length > 0
              ? 'OCR read text on the sheet, but no standard room label/dimension pairs matched. Draw a shape with Auto Name On to extract text per room.'
              : 'Local OCR did not detect readable room text on this image.'
          );
          return;
        }
        applyTextClustersAsRooms(clusters, 'Local OCR');
        return;
      }

      const visionImageUrl = await prepareSheetImageForVision(activeSheet);
      const resp = await fetch('/api/floor-plan/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: visionImageUrl,
          sheetName: activeSheet.name,
        }),
      });

      const data = await safeReadJson(resp);
      if (!resp.ok) {
        // Fallback 1: CAD PDF embedded text layer
        if (activeSheet.extractedTexts && activeSheet.extractedTexts.length > 0) {
          const clusters = detectRoomsFromPdfTextLayer(
            activeSheet.extractedTexts,
            activeSheet.width,
            activeSheet.height
          );
          if (clusters.length > 0) {
            applyTextClustersAsRooms(clusters, 'PDF text fallback (Vision AI busy)');
            return;
          }
        }
        // Fallback 2: Local client-side OCR scan for raster PNG/JPG or scanned PDFs
        try {
          const ocrTokens = await runLocalOcrFloorPlanScan(activeSheet);
          if (ocrTokens.length > 0) {
            updateActiveSheet({ extractedTexts: ocrTokens });
            const clusters = detectRoomsFromPdfTextLayer(
              ocrTokens,
              activeSheet.width,
              activeSheet.height
            );
            if (clusters.length > 0) {
              applyTextClustersAsRooms(clusters, 'Local OCR fallback (Vision AI busy)');
              return;
            }
          }
        } catch {
          // fall through to show Vision error message
        }
        setUploadError(String(data?.error || 'Auto-read failed.'));
        return;
      }

      const detectedList = Array.isArray(data.rooms)
        ? (data.rooms as Record<string, unknown>[])
        : [];
      if (detectedList.length === 0) {
        if (activeSheet.extractedTexts && activeSheet.extractedTexts.length > 0) {
          const clusters = detectRoomsFromPdfTextLayer(
            activeSheet.extractedTexts,
            activeSheet.width,
            activeSheet.height
          );
          if (clusters.length > 0) {
            applyTextClustersAsRooms(clusters, 'PDF text layer');
            return;
          }
        }
        onNotify?.('No labeled rooms detected on this sheet.');
        return;
      }

      // Compute auto-scale candidate from boxes that also have printed dimensions
      const ppmSamples: number[] = [];
      for (const d of detectedList) {
        if (!Array.isArray(d.box2d) || d.box2d.length < 4) continue;
        const [ymin, xmin, ymax, xmax] = d.box2d.map(Number);
        const bwPx = (Math.abs(xmax - xmin) / 1000) * activeSheet.width;
        const bhPx = (Math.abs(ymax - ymin) / 1000) * activeSheet.height;
        let wM = Number(d.widthMeters) || 0;
        let lM = Number(d.lengthMeters) || 0;
        if ((wM <= 0 || lM <= 0) && d.printedDimensions) {
          const parsedDim = parseDimensionPair(String(d.printedDimensions));
          if (parsedDim) {
            wM = parsedDim.widthMeters;
            lM = parsedDim.lengthMeters;
          }
        }
        if (bwPx > 15 && bhPx > 15 && wM > 0.5 && lM > 0.5) {
          const ratio1 = bwPx / wM;
          const ratio2 = bhPx / lM;
          const alt1 = bwPx / lM;
          const alt2 = bhPx / wM;
          const errDirect = Math.abs(ratio1 - ratio2);
          const errSwapped = Math.abs(alt1 - alt2);
          ppmSamples.push(
            errDirect <= errSwapped ? (ratio1 + ratio2) / 2 : (alt1 + alt2) / 2
          );
        }
      }

      let effectivePpm = activeSheet.pixelsPerMeter;
      if (ppmSamples.length > 0) {
        ppmSamples.sort((a, b) => a - b);
        const medianPpm = Number(ppmSamples[Math.floor(ppmSamples.length / 2)].toFixed(2));
        if (!activeSheet.isCalibrated && medianPpm > 3) {
          effectivePpm = medianPpm;
          updateActiveSheet({ pixelsPerMeter: medianPpm, isCalibrated: true });
        } else if (medianPpm > 3) {
          setDetectedPrintScaleSuggestion({
            ppm: medianPpm,
            sampleCount: ppmSamples.length,
          });
        }
      }

      const createdRooms: FloorPlanRoom[] = [];
      detectedList.forEach((d, idx) => {
        const box = Array.isArray(d.box2d) && d.box2d.length === 4 ? d.box2d.map(Number) : null;
        if (!box) return;
        const [ymin, xmin, ymax, xmax] = box;
        const rawX1 = (Math.max(0, Math.min(1000, xmin)) / 1000) * activeSheet.width;
        const rawX2 = (Math.max(0, Math.min(1000, xmax)) / 1000) * activeSheet.width;
        const rawY1 = (Math.max(0, Math.min(1000, ymin)) / 1000) * activeSheet.height;
        const rawY2 = (Math.max(0, Math.min(1000, ymax)) / 1000) * activeSheet.height;
        const x1 = Math.min(rawX1, rawX2);
        const x2 = Math.max(rawX1, rawX2);
        const y1 = Math.min(rawY1, rawY2);
        const y2 = Math.max(rawY1, rawY2);
        const wPx = Math.max(18, x2 - x1);
        const hPx = Math.max(18, y2 - y1);
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;

        const hint = String(d.shapeHint || '').toLowerCase();
        const isCircle = hint === 'circle';
        let roomName = String(d.roomName || '').trim() || `Room ${rooms.length + idx + 1}`;
        let printedDimText = String(d.printedDimensions || '').trim() || undefined;
        const color = ROOM_PALETTE[(rooms.length + idx) % ROOM_PALETTE.length];

        const draftRoom: FloorPlanRoom = isCircle
          ? {
              id: `fp_room_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
              sheetId: activeSheet.id,
              floor: activeFloor,
              roomName,
              printedDimText,
              shapeType: 'circle',
              color,
              rotationDeg: 0,
              cx,
              cy,
              radiusPx: Math.min(wPx, hPx) / 2,
            }
          : {
              id: `fp_room_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
              sheetId: activeSheet.id,
              floor: activeFloor,
              roomName,
              printedDimText,
              shapeType: 'rect',
              color,
              rotationDeg: 0,
              cx,
              cy,
              widthPx: wPx,
              heightPx: hPx,
            };

        // Cross-enrich from embedded PDF CAD text if available inside that room bounds
        if (activeSheet.extractedTexts?.length) {
          const pdfHit = extractLabelFromPdfTexts(draftRoom, activeSheet.extractedTexts);
          if (pdfHit) {
            if (!printedDimText && pdfHit.printedDimensions) {
              printedDimText = pdfHit.printedDimensions;
              draftRoom.printedDimText = printedDimText;
            }
            if (roomName.startsWith('Room ') && pdfHit.roomName) {
              roomName = pdfHit.roomName;
              draftRoom.roomName = roomName;
            }
          }
        }

        createdRooms.push(draftRoom);
      });

      if (createdRooms.length > 0) {
        setRooms((prev) => [...prev, ...createdRooms]);
        setSelectedRoomId(createdRooms[0].id);
        setActiveTool('select');
        onNotify?.(
          `Auto-mapped ${createdRooms.length} rooms with labels & dimensions (Scale: ${effectivePpm.toFixed(1)} px/m).`
        );
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Auto-read room labels & dimensions failed.'
      );
    } finally {
      setAutoReadLoading(false);
    }
  };

  // Manual Geometry & Edge Typing Handlers
  const unitFactorToMeters = dimUnit === 'ft' ? 0.3048 : 1;

  const applyTypedRectSize = (nextWStr: string, nextLStr: string) => {
    if (!selectedRoom || selectedRoom.shapeType !== 'rect' || !activeSheet) return;
    const ppm = activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
    const wVal = parseFloat(nextWStr);
    const lVal = parseFloat(nextLStr);
    const patch: Partial<FloorPlanRoom> = {};
    if (!isNaN(wVal) && wVal > 0) {
      patch.widthPx = Math.max(8, wVal * unitFactorToMeters * ppm);
    }
    if (!isNaN(lVal) && lVal > 0) {
      patch.heightPx = Math.max(8, lVal * unitFactorToMeters * ppm);
    }
    if (Object.keys(patch).length > 0) {
      handleUpdateRoom(selectedRoom.id, patch);
    }
  };

  const applyTypedPolygonResize = (targetWStr: string, targetLStr: string, changedAxis: 'w' | 'l') => {
    if (!selectedRoom || selectedRoom.shapeType !== 'polygon' || !selectedRoom.points || !activeSheet) return;
    const ppm = activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
    const curMetrics = computeRoomMetrics(selectedRoom, ppm);
    if (curMetrics.widthM <= 0 || curMetrics.lengthM <= 0) return;

    const wVal = parseFloat(targetWStr) * unitFactorToMeters;
    const lVal = parseFloat(targetLStr) * unitFactorToMeters;

    let sx = !isNaN(wVal) && wVal > 0 ? wVal / curMetrics.widthM : 1;
    let sy = !isNaN(lVal) && lVal > 0 ? lVal / curMetrics.lengthM : 1;

    if (lockAspect) {
      if (changedAxis === 'w' && !isNaN(wVal) && wVal > 0) sy = sx;
      if (changedAxis === 'l' && !isNaN(lVal) && lVal > 0) sx = sy;
    }

    const nextPts = selectedRoom.points.map((p) => ({
      x: selectedRoom.cx + (p.x - selectedRoom.cx) * sx,
      y: selectedRoom.cy + (p.y - selectedRoom.cy) * sy,
    }));
    const nextCentroid = computePolygonCentroid(nextPts);
    handleUpdateRoom(selectedRoom.id, {
      points: nextPts,
      cx: nextCentroid.x,
      cy: nextCentroid.y,
    });
  };

  const applyTypedScalePct = () => {
    if (!selectedRoom) return;
    const pct = parseFloat(typedScalePct);
    if (isNaN(pct) || pct <= 0) return;
    const factor = pct / 100;

    if (selectedRoom.shapeType === 'rect') {
      handleUpdateRoom(selectedRoom.id, {
        widthPx: Math.max(8, (selectedRoom.widthPx || 20) * factor),
        heightPx: Math.max(8, (selectedRoom.heightPx || 20) * factor),
      });
    } else if (selectedRoom.shapeType === 'circle') {
      handleUpdateRoom(selectedRoom.id, {
        radiusPx: Math.max(6, (selectedRoom.radiusPx || 20) * factor),
      });
    } else if (selectedRoom.shapeType === 'polygon' && selectedRoom.points) {
      const nextPts = selectedRoom.points.map((p) => ({
        x: selectedRoom.cx + (p.x - selectedRoom.cx) * factor,
        y: selectedRoom.cy + (p.y - selectedRoom.cy) * factor,
      }));
      handleUpdateRoom(selectedRoom.id, { points: nextPts });
    }
    setTypedScalePct('100');
  };

  const applyTypedCircleSize = (diaStr: string) => {
    if (!selectedRoom || selectedRoom.shapeType !== 'circle' || !activeSheet) return;
    const ppm = activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
    const dVal = parseFloat(diaStr);
    if (!isNaN(dVal) && dVal > 0) {
      handleUpdateRoom(selectedRoom.id, {
        radiusPx: Math.max(6, ((dVal * unitFactorToMeters) / 2) * ppm),
      });
    }
  };

  // Manual edge length typing for individual Polygon edge Ei (moves end vertex P_{toIdx} along edge direction)
  const applyPolygonEdgeLength = (edgeIndex: number, rawLengthStr: string) => {
    if (!selectedRoom || selectedRoom.shapeType !== 'polygon' || !selectedRoom.points || !activeSheet) return;
    const val = parseFloat(rawLengthStr);
    if (isNaN(val) || val <= 0) return;
    const ppm = activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
    const targetPx = val * unitFactorToMeters * ppm;

    const pts = selectedRoom.points.map((p) => ({ ...p }));
    const fromIdx = edgeIndex;
    const toIdx = (edgeIndex + 1) % pts.length;
    const p1 = pts[fromIdx];
    const p2 = pts[toIdx];
    const curLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const ux = curLen > 0.001 ? (p2.x - p1.x) / curLen : 1;
    const uy = curLen > 0.001 ? (p2.y - p1.y) / curLen : 0;

    pts[toIdx] = {
      x: p1.x + ux * targetPx,
      y: p1.y + uy * targetPx,
    };

    const recentered = recenterRotatedPolygonPoints(
      pts,
      { x: selectedRoom.cx, y: selectedRoom.cy },
      selectedRoom.rotationDeg
    );
    handleUpdateRoom(selectedRoom.id, {
      points: recentered.points,
      cx: recentered.cx,
      cy: recentered.cy,
    });
  };

  // Extend live polygon draft along cursor direction by typed edge length
  const addPolygonPointByTypedLength = () => {
    if (!activeSheet || polyPoints.length === 0) return;
    const val = parseFloat(nextPolyEdgeLen);
    if (isNaN(val) || val <= 0) return;
    const ppm = activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
    const lenPx = val * unitFactorToMeters * ppm;
    const last = polyPoints[polyPoints.length - 1];
    const refPt = cursorImgPt || { x: last.x + 100, y: last.y };
    const dx = refPt.x - last.x;
    const dy = refPt.y - last.y;
    const d = Math.hypot(dx, dy);
    const ux = d > 1 ? dx / d : 1;
    const uy = d > 1 ? dy / d : 0;
    setPolyPoints((prev) => [...prev, { x: last.x + ux * lenPx, y: last.y + uy * lenPx }]);
    setNextPolyEdgeLen('');
  };

  // Mouse / Pointer handlers on canvas
  const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeSheet) return;
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      dragSessionRef.current = {
        kind: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPan: { ...pan },
        startImgPt: { x: 0, y: 0 },
      };
      return;
    }

    if (e.button !== 0) return;
    const pt = clientToImagePoint(e.clientX, e.clientY);
    if (!pt) return;

    if (activeTool === 'calibrate') {
      if (calPts.length === 0 || calPts.length >= 2) {
        setCalPts([pt]);
        setCalModalOpen(false);
      } else {
        setCalPts([calPts[0], pt]);
        setCalModalOpen(true);
      }
      return;
    }

    if (activeTool === 'polygon') {
      if (polyPoints.length >= 3) {
        const first = polyPoints[0];
        const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
        if (dist <= 16 / zoom) {
          finalizePolygon(polyPoints);
          return;
        }
      }
      setPolyPoints((prev) => [...prev, pt]);
      return;
    }

    if (activeTool === 'rect') {
      setSelectedRoomId(null);
      dragSessionRef.current = {
        kind: 'draw-rect',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPan: { ...pan },
        startImgPt: pt,
      };
      setRectDraft({
        cx: pt.x,
        cy: pt.y,
        widthPx: 0,
        heightPx: 0,
        rotationDeg: normalizeDeg(-activeSheet.canvasRotationDeg),
      });
      return;
    }

    if (activeTool === 'circle') {
      setSelectedRoomId(null);
      dragSessionRef.current = {
        kind: 'draw-circle',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPan: { ...pan },
        startImgPt: pt,
      };
      setCircleDraft({ cx: pt.x, cy: pt.y, radiusPx: 0 });
      return;
    }

    if (activeTool === 'select') {
      setSelectedRoomId(null);
      dragSessionRef.current = {
        kind: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPan: { ...pan },
        startImgPt: pt,
      };
    }
  };

  const handleViewportDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'polygon' && polyPoints.length >= 3) {
      e.preventDefault();
      finalizePolygon(polyPoints);
    }
  };

  const handleShapeMouseDown = (
    e: React.MouseEvent,
    room: FloorPlanRoom,
    kind:
      | 'move-room'
      | 'rotate-room'
      | 'resize-rect-corner'
      | 'resize-rect-edge'
      | 'resize-circle'
      | 'move-poly-vertex',
    handleIndex?: number
  ) => {
    if (e.button !== 0 || e.altKey) return;
    // Allow dragging/selecting existing shapes when in select tool OR when clicking inside selected room handles
    if (activeTool !== 'select' && kind === 'move-room') return;
    e.stopPropagation();
    const pt = clientToImagePoint(e.clientX, e.clientY);
    if (!pt) return;
    setSelectedRoomId(room.id);
    dragSessionRef.current = {
      kind,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPan: { ...pan },
      startImgPt: pt,
      roomSnapshot: {
        ...room,
        points: room.points ? room.points.map((p) => ({ ...p })) : undefined,
      },
      handleIndex,
    };
  };

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pt = clientToImagePoint(e.clientX, e.clientY);
    if (pt) setCursorImgPt(pt);

    const session = dragSessionRef.current;
    if (!session || !activeSheet) return;

    if (session.kind === 'pan') {
      setPan({
        x: session.startPan.x + (e.clientX - session.startClientX),
        y: session.startPan.y + (e.clientY - session.startClientY),
      });
      return;
    }

    if (!pt) return;

    if (session.kind === 'draw-rect') {
      const rot = normalizeDeg(-activeSheet.canvasRotationDeg);
      const rad = (-rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = pt.x - session.startImgPt.x;
      const dy = pt.y - session.startImgPt.y;
      const localW = dx * cos - dy * sin;
      const localH = dx * sin + dy * cos;

      setRectDraft({
        cx: (session.startImgPt.x + pt.x) / 2,
        cy: (session.startImgPt.y + pt.y) / 2,
        widthPx: Math.abs(localW),
        heightPx: Math.abs(localH),
        rotationDeg: rot,
      });
      return;
    }

    if (session.kind === 'draw-circle') {
      const r = Math.hypot(pt.x - session.startImgPt.x, pt.y - session.startImgPt.y);
      setCircleDraft({
        cx: session.startImgPt.x,
        cy: session.startImgPt.y,
        radiusPx: r,
      });
      return;
    }

    const snap = session.roomSnapshot;
    if (!snap) return;

    if (session.kind === 'move-room') {
      const delta = screenDeltaToImageDelta(
        e.clientX - session.startClientX,
        e.clientY - session.startClientY
      );
      if (snap.shapeType === 'polygon' && snap.points) {
        handleUpdateRoom(snap.id, {
          cx: snap.cx + delta.x,
          cy: snap.cy + delta.y,
          points: snap.points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
        });
      } else {
        handleUpdateRoom(snap.id, {
          cx: snap.cx + delta.x,
          cy: snap.cy + delta.y,
        });
      }
      return;
    }

    if (session.kind === 'rotate-room') {
      const angleRad = Math.atan2(pt.y - snap.cy, pt.x - snap.cx);
      let deg = (angleRad * 180) / Math.PI + 90;
      if (e.shiftKey) {
        deg = Math.round(deg / 15) * 15;
      }
      handleUpdateRoom(snap.id, { rotationDeg: normalizeDeg(deg) });
      return;
    }

    if (session.kind === 'resize-circle') {
      const newR = Math.max(8, Math.hypot(pt.x - snap.cx, pt.y - snap.cy));
      handleUpdateRoom(snap.id, { radiusPx: newR });
      return;
    }

    // Opposite-corner or opposite-edge anchored Rectangle Resize in local rotated coords
    if (session.kind === 'resize-rect-corner' || session.kind === 'resize-rect-edge') {
      const rad = (-snap.rotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = pt.x - snap.cx;
      const dy = pt.y - snap.cy;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;

      const hw = (snap.widthPx || 40) / 2;
      const hh = (snap.heightPx || 40) / 2;
      let left = -hw;
      let right = hw;
      let top = -hh;
      let bottom = hh;
      const minSz = 12;

      if (session.kind === 'resize-rect-corner') {
        const cIdx = session.handleIndex ?? 2;
        if (cIdx === 0) {
          // Top-Left
          left = Math.min(right - minSz, lx);
          top = Math.min(bottom - minSz, ly);
        } else if (cIdx === 1) {
          // Top-Right
          right = Math.max(left + minSz, lx);
          top = Math.min(bottom - minSz, ly);
        } else if (cIdx === 2) {
          // Bottom-Right
          right = Math.max(left + minSz, lx);
          bottom = Math.max(top + minSz, ly);
        } else {
          // Bottom-Left
          left = Math.min(right - minSz, lx);
          bottom = Math.max(top + minSz, ly);
        }
      } else {
        const eIdx = session.handleIndex ?? 1;
        if (eIdx === 0) top = Math.min(bottom - minSz, ly); // Top edge
        else if (eIdx === 1) right = Math.max(left + minSz, lx); // Right edge
        else if (eIdx === 2) bottom = Math.max(top + minSz, ly); // Bottom edge
        else left = Math.min(right - minSz, lx); // Left edge
      }

      const newW = right - left;
      const newH = bottom - top;
      const dcxLocal = (left + right) / 2;
      const dcyLocal = (top + bottom) / 2;

      // Rotate local center shift back into image coordinates
      const fwdRad = (snap.rotationDeg * Math.PI) / 180;
      const fCos = Math.cos(fwdRad);
      const fSin = Math.sin(fwdRad);
      const worldShiftX = dcxLocal * fCos - dcyLocal * fSin;
      const worldShiftY = dcxLocal * fSin + dcyLocal * fCos;

      handleUpdateRoom(snap.id, {
        cx: snap.cx + worldShiftX,
        cy: snap.cy + worldShiftY,
        widthPx: newW,
        heightPx: newH,
      });
      return;
    }

    // Drag individual Polygon vertex (keeping unmoved vertices anchored in world space)
    if (session.kind === 'move-poly-vertex' && snap.points && session.handleIndex !== undefined) {
      const localPt = rotatePointAround(pt, { x: snap.cx, y: snap.cy }, -snap.rotationDeg);
      const updatedPts = snap.points.map((p, i) =>
        i === session.handleIndex ? localPt : p
      );
      const recentered = recenterRotatedPolygonPoints(
        updatedPts,
        { x: snap.cx, y: snap.cy },
        snap.rotationDeg
      );
      handleUpdateRoom(snap.id, {
        points: recentered.points,
        cx: recentered.cx,
        cy: recentered.cy,
      });
    }
  };

  const handleViewportMouseUp = () => {
    const session = dragSessionRef.current;
    dragSessionRef.current = null;
    if (!session) return;

    if (session.kind === 'draw-rect' && rectDraft) {
      if (rectDraft.widthPx >= 10 && rectDraft.heightPx >= 10) {
        addMappedRoom({
          shapeType: 'rect',
          cx: rectDraft.cx,
          cy: rectDraft.cy,
          widthPx: rectDraft.widthPx,
          heightPx: rectDraft.heightPx,
          rotationDeg: rectDraft.rotationDeg,
        });
      }
      setRectDraft(null);
    }

    if (session.kind === 'draw-circle' && circleDraft) {
      if (circleDraft.radiusPx >= 8) {
        addMappedRoom({
          shapeType: 'circle',
          cx: circleDraft.cx,
          cy: circleDraft.cy,
          radiusPx: circleDraft.radiusPx,
          rotationDeg: 0,
        });
      }
      setCircleDraft(null);
    }
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!activeSheet) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((prev) => Number(Math.min(5, Math.max(0.15, prev * factor)).toFixed(3)));
  };

  // Insert vertex along polygon edge midpoint
  const splitPolygonEdge = (room: FloorPlanRoom, edgeIdx: number) => {
    if (!room.points || room.points.length < 3) return;
    const p1 = room.points[edgeIdx];
    const p2 = room.points[(edgeIdx + 1) % room.points.length];
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const nextPts = [
      ...room.points.slice(0, edgeIdx + 1),
      mid,
      ...room.points.slice(edgeIdx + 1),
    ];
    const recentered = recenterRotatedPolygonPoints(
      nextPts,
      { x: room.cx, y: room.cy },
      room.rotationDeg
    );
    handleUpdateRoom(room.id, {
      points: recentered.points,
      cx: recentered.cx,
      cy: recentered.cy,
    });
  };

  // Remove polygon vertex on double-click if > 3 vertices
  const removePolygonVertex = (room: FloorPlanRoom, vertexIdx: number) => {
    if (!room.points || room.points.length <= 3) return;
    const nextPts = room.points.filter((_, i) => i !== vertexIdx);
    const recentered = recenterRotatedPolygonPoints(
      nextPts,
      { x: room.cx, y: room.cy },
      room.rotationDeg
    );
    handleUpdateRoom(room.id, {
      points: recentered.points,
      cx: recentered.cx,
      cy: recentered.cy,
    });
  };

  // Apply 2-point calibration
  const applyCalibration = () => {
    if (!activeSheet || calPts.length < 2) return;
    const distPx = Math.hypot(calPts[1].x - calPts[0].x, calPts[1].y - calPts[0].y);
    const entered = parseFloat(calRealDist);
    if (!entered || entered <= 0 || distPx <= 1) return;
    const meters = calUnit === 'ft' ? entered * 0.3048 : entered;
    const nextPpm = distPx / meters;
    updateActiveSheet({ pixelsPerMeter: Number(nextPpm.toFixed(3)), isCalibrated: true });
    setCalPts([]);
    setCalModalOpen(false);
    setActiveTool('select');
    onNotify?.(
      `Scale calibrated: ${nextPpm.toFixed(1)} px/m (${entered} ${calUnit}). All room dimensions updated.`
    );
  };

  const focusRoomOnCanvas = (room: FloorPlanRoom) => {
    if (room.sheetId !== activeSheet?.id) {
      setActiveSheetId(room.sheetId);
    }
    setSelectedRoomId(room.id);
    setHoveredRoomId(room.id);
    const targetSheet = sheets.find((s) => s.id === room.sheetId);
    if (!targetSheet) return;
    const rad = (targetSheet.canvasRotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = room.cx - targetSheet.width / 2;
    const dy = room.cy - targetSheet.height / 2;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    setPan({ x: -rx * zoom, y: -ry * zoom });
  };

  const tableEntries = useMemo(() => {
    return rooms
      .filter((r) => floorFilter === 'ALL' || r.floor === floorFilter)
      .map((room) => {
        const sheet = sheets.find((s) => s.id === room.sheetId);
        const ppm = sheet?.pixelsPerMeter || 40;
        const metrics = computeRoomMetrics(room, ppm);
        return { room, sheet, metrics };
      });
  }, [rooms, sheets, floorFilter]);

  const activeSheetRooms = useMemo(
    () => (activeSheet ? rooms.filter((r) => r.sheetId === activeSheet.id) : []),
    [rooms, activeSheet]
  );

  const handleTableRowEnter = (room: FloorPlanRoom) => {
    setHoveredRoomId(room.id);
    if (activeSheet && room.sheetId !== activeSheet.id) {
      setActiveSheetId(room.sheetId);
    }
  };

  const totals = useMemo(() => {
    return tableEntries.reduce(
      (acc, item) => ({
        count: acc.count + 1,
        areaSqm: acc.areaSqm + item.metrics.areaSqm,
        areaSqft: acc.areaSqft + item.metrics.areaSqft,
      }),
      { count: 0, areaSqm: 0, areaSqft: 0 }
    );
  }, [tableEntries]);

  const allMappedEntries = useMemo(() => {
    return rooms.map((room) => {
      const sheet = sheets.find((s) => s.id === room.sheetId);
      const metrics = computeRoomMetrics(room, sheet?.pixelsPerMeter || 40);
      return { room, sheet, metrics };
    });
  }, [rooms, sheets]);

  const floorBreakdown = useMemo(() => {
    const map = new Map<string, { rooms: number; sqm: number; sqft: number }>();
    for (const { room, metrics } of allMappedEntries) {
      const cur = map.get(room.floor) || { rooms: 0, sqm: 0, sqft: 0 };
      cur.rooms += 1;
      cur.sqm += metrics.areaSqm;
      cur.sqft += metrics.areaSqft;
      map.set(room.floor, cur);
    }
    return FLOOR_OPTIONS.filter((f) => map.has(f)).map((f) => ({
      floor: f,
      ...map.get(f)!,
    }));
  }, [allMappedEntries]);

  const handleExportTakeoffExcel = async () => {
    if (allMappedEntries.length === 0) return;
    const XLSX = await import('xlsx');
    const dateStr = new Date().toLocaleDateString('en-IN');

    const sheet1Rows: (string | number)[][] = [
      ['ARCHITECTURAL FLOOR PLAN — ROOM DIMENSION & AREA TAKEOFF SCHEDULE'],
      [
        `Generated: ${dateStr}  |  Total Rooms: ${allMappedEntries.length}  |  Total Area: ${allMappedEntries
          .reduce((s, e) => s + e.metrics.areaSqm, 0)
          .toFixed(2)} m²`,
      ],
      [],
      [
        'S.No',
        'Floor / Level',
        'Room Name',
        'Printed Label / Dims',
        'Overlay Shape',
        'Calculated Dimensions (m)',
        'Perimeter (m)',
        'Rotation (°)',
        'Area (SQMT)',
        'Area (Sqft)',
        'Plan Sheet',
      ],
    ];

    allMappedEntries.forEach(({ room, sheet, metrics }, idx) => {
      sheet1Rows.push([
        idx + 1,
        room.floor,
        room.roomName,
        room.printedDimText || '-',
        room.shapeType === 'rect' ? 'Rectangle' : room.shapeType === 'polygon' ? 'Polygon' : 'Circle',
        metrics.dimLabel,
        Number(metrics.perimeterM.toFixed(2)),
        room.rotationDeg,
        Number(metrics.areaSqm.toFixed(2)),
        Number(metrics.areaSqft.toFixed(1)),
        sheet?.name || '-',
      ]);
    });

    sheet1Rows.push([
      '',
      'GRAND TOTAL',
      `${allMappedEntries.length} rooms`,
      '',
      '',
      '',
      '',
      '',
      Number(allMappedEntries.reduce((s, e) => s + e.metrics.areaSqm, 0).toFixed(2)),
      Number(allMappedEntries.reduce((s, e) => s + e.metrics.areaSqft, 0).toFixed(1)),
      '',
    ]);

    const floorRows: (string | number)[][] = [
      ['FLOOR-WISE AREA SUMMARY FROM ARCHITECTURAL DRAWING'],
      [],
      ['S.No', 'Floor / Level', 'Rooms Mapped', 'Total Area (SQMT)', 'Total Area (Sqft)'],
    ];
    floorBreakdown.forEach((f, idx) => {
      floorRows.push([idx + 1, f.floor, f.rooms, Number(f.sqm.toFixed(2)), Number(f.sqft.toFixed(1))]);
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
    ws1['!cols'] = [
      { wch: 7 },
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
      { wch: 13 },
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
    ];
    ws1['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Mapped Rooms');

    const ws2 = XLSX.utils.aoa_to_sheet(floorRows);
    ws2['!cols'] = [{ wch: 7 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
    ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Floor Summary');

    XLSX.writeFile(wb, `Floor_Plan_Room_Takeoff_${Date.now()}.xlsx`);
    onNotify?.('Exported mapped rooms and floor summary to Excel (.xlsx).');
  };

  const handleSyncToInventory = () => {
    if (allMappedEntries.length === 0) return;
    onSendRoomsToInventory(
      allMappedEntries.map(({ room, metrics }) => ({
        floor: room.floor,
        roomName: room.roomName.trim() || 'Unnamed Room',
        sqmt: Number(metrics.areaSqm.toFixed(2)),
        sqft: Number(metrics.areaSqft.toFixed(1)),
      })),
      syncMode
    );
  };

  const hoveredRoomMeta = useMemo(() => {
    if (!hoveredRoomId || !activeSheet) return null;
    const room = activeSheetRooms.find((r) => r.id === hoveredRoomId);
    if (!room) return null;
    return { room, metrics: computeRoomMetrics(room, activeSheet.pixelsPerMeter) };
  }, [hoveredRoomId, activeSheet, activeSheetRooms]);

  const selectedRoomPolygonEdges = useMemo(() => {
    if (!selectedRoom || selectedRoom.shapeType !== 'polygon' || !selectedRoom.points || !activeSheet) {
      return [];
    }
    return computePolygonEdges(selectedRoom.points, activeSheet.pixelsPerMeter);
  }, [selectedRoom, activeSheet]);

  const selectedRoomMetrics = useMemo(() => {
    if (!selectedRoom || !activeSheet) return null;
    return computeRoomMetrics(selectedRoom, activeSheet.pixelsPerMeter);
  }, [selectedRoom, activeSheet]);

  // SVG overlay shape renderer with move grip, rotation handle, corner & edge handles, polygon vertex handles & edge badges
  const renderRoomShape = (room: FloorPlanRoom) => {
    if (!activeSheet) return null;
    const metrics = computeRoomMetrics(room, activeSheet.pixelsPerMeter);
    const isHovered = hoveredRoomId === room.id;
    const isSelected = selectedRoomId === room.id;
    const someHovered = hoveredRoomId !== null;
    const dimOpacity = someHovered && !isHovered ? 0.32 : 1;

    const strokeW = (isHovered ? 3.5 : isSelected ? 2.8 : 2) / zoom;
    const fillAlpha = isHovered ? 0.36 : isSelected ? 0.28 : 0.16;
    const handleRadius = 5.5 / zoom;
    const rotStemLen = 28 / zoom;
    const topOffset = getRoomBoundingRadius(room);
    const polyEdges =
      isSelected && room.shapeType === 'polygon' && room.points
        ? computePolygonEdges(room.points, activeSheet.pixelsPerMeter)
        : [];

    const clipId = `room-clip-${room.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const labelSlot = computeContainedLabelSlot(room, activeSheet.canvasRotationDeg, zoom);
    const boxW = Math.min(136 / zoom, Math.max(0, labelSlot.availW));
    const boxH = Math.min(36 / zoom, Math.max(0, labelSlot.availH));
    const showLabel = boxW >= 4 / zoom && boxH >= 4 / zoom;
    const showSubLine = boxH >= 20 / zoom && boxW >= 42 / zoom;
    const rawName = (room.roomName || 'Room').trim() || 'Room';
    const targetNameSize = Math.min(11.5 / zoom, showSubLine ? boxH * 0.34 : boxH * 0.56);
    const minNameSize = Math.min(targetNameSize, 7 / zoom);
    const nameFitSize = Math.max(
      minNameSize,
      Math.min(targetNameSize, (boxW * 0.88) / Math.max(rawName.length * 0.58, 1))
    );
    const maxNameChars = Math.max(2, Math.floor((boxW * 0.88) / Math.max(0.01, nameFitSize * 0.58)));
    const displayName =
      rawName.length > maxNameChars ? `${rawName.slice(0, Math.max(1, maxNameChars - 1))}…` : rawName;

    const fullSub = `${metrics.areaSqm.toFixed(1)} m² · ${metrics.dimLabel}`;
    const shortSub = `${metrics.areaSqm.toFixed(1)} m²`;
    const subFitSize = Math.min(9.5 / zoom, boxH * 0.27);
    const fitsFullSub = fullSub.length * subFitSize * 0.6 <= boxW * 0.90;
    const rawSub = fitsFullSub ? fullSub : shortSub;
    const maxSubChars = Math.max(2, Math.floor((boxW * 0.90) / Math.max(0.01, subFitSize * 0.6)));
    const displaySub =
      rawSub.length > maxSubChars ? `${rawSub.slice(0, Math.max(1, maxSubChars - 1))}…` : rawSub;

    return (
      <g
        key={room.id}
        style={{
          opacity: dimOpacity,
          transition: 'opacity 140ms ease',
          cursor: activeTool === 'select' ? 'move' : 'crosshair',
        }}
        onMouseEnter={() => setHoveredRoomId(room.id)}
        onMouseLeave={() => setHoveredRoomId((cur) => (cur === room.id ? null : cur))}
        onMouseDown={(e) => handleShapeMouseDown(e, room, 'move-room')}
      >
        {/* Main Rotated Shape Geometry */}
        <g transform={`rotate(${room.rotationDeg}, ${room.cx}, ${room.cy})`}>
          <defs>
            <clipPath id={clipId}>
              {room.shapeType === 'rect' && (
                <rect
                  x={room.cx - (room.widthPx || 0) / 2}
                  y={room.cy - (room.heightPx || 0) / 2}
                  width={room.widthPx || 0}
                  height={room.heightPx || 0}
                  rx={2 / zoom}
                />
              )}
              {room.shapeType === 'circle' && (
                <circle cx={room.cx} cy={room.cy} r={room.radiusPx || 0} />
              )}
              {room.shapeType === 'polygon' && room.points && room.points.length >= 3 && (
                <polygon points={room.points.map((p) => `${p.x},${p.y}`).join(' ')} />
              )}
            </clipPath>
          </defs>

          {room.shapeType === 'rect' && (
            <rect
              x={room.cx - (room.widthPx || 0) / 2}
              y={room.cy - (room.heightPx || 0) / 2}
              width={room.widthPx || 0}
              height={room.heightPx || 0}
              fill={room.color}
              fillOpacity={fillAlpha}
              stroke={isHovered ? '#ffffff' : room.color}
              strokeWidth={strokeW}
              rx={2 / zoom}
            />
          )}

          {room.shapeType === 'circle' && (
            <circle
              cx={room.cx}
              cy={room.cy}
              r={room.radiusPx || 0}
              fill={room.color}
              fillOpacity={fillAlpha}
              stroke={isHovered ? '#ffffff' : room.color}
              strokeWidth={strokeW}
            />
          )}

          {room.shapeType === 'polygon' && room.points && room.points.length >= 3 && (
            <polygon
              points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={room.color}
              fillOpacity={fillAlpha}
              stroke={isHovered ? '#ffffff' : room.color}
              strokeWidth={strokeW}
              strokeLinejoin="round"
            />
          )}

          {/* Contained Room Label — clipped and scaled strictly inside the shape */}
          {showLabel && (
            <g clipPath={`url(#${clipId})`} style={{ pointerEvents: 'none' }}>
              <g transform={`translate(${labelSlot.x}, ${labelSlot.y}) rotate(${labelSlot.angleDeg})`}>
                <rect
                  x={-boxW / 2}
                  y={-boxH / 2}
                  width={boxW}
                  height={boxH}
                  rx={Math.min(4 / zoom, boxW * 0.12, boxH * 0.2)}
                  fill={isHovered ? '#0f172a' : 'rgba(15, 23, 42, 0.86)'}
                  stroke={isHovered ? '#ffffff' : room.color}
                  strokeWidth={Math.min((isHovered ? 1.6 : 0.9) / zoom, boxW * 0.04, boxH * 0.08)}
                />
                <text
                  x={0}
                  y={showSubLine ? -boxH * 0.13 : nameFitSize * 0.34}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={nameFitSize}
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {displayName}
                </text>
                {showSubLine && (
                  <text
                    x={0}
                    y={boxH * 0.27}
                    textAnchor="middle"
                    fill={isHovered ? '#6ee7b7' : '#cbd5e1'}
                    fontSize={subFitSize}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {displaySub}
                  </text>
                )}
              </g>
            </g>
          )}

          {/* Outer spotlight glow ring when hovered */}
          {isHovered && room.shapeType === 'rect' && (
            <rect
              x={room.cx - (room.widthPx || 0) / 2 - 4 / zoom}
              y={room.cy - (room.heightPx || 0) / 2 - 4 / zoom}
              width={(room.widthPx || 0) + 8 / zoom}
              height={(room.heightPx || 0) + 8 / zoom}
              fill="none"
              stroke={room.color}
              strokeWidth={2 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
            />
          )}
          {isHovered && room.shapeType === 'circle' && (
            <circle
              cx={room.cx}
              cy={room.cy}
              r={(room.radiusPx || 0) + 4 / zoom}
              fill="none"
              stroke={room.color}
              strokeWidth={2 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
            />
          )}

          {/* Selection Handles (Relocate grip, Rotation handle, Corner & Side Edge resize, Polygon Vertex handles) */}
          {isSelected && (
            <>
              {/* Rotation Handle above top center */}
              <line
                x1={room.cx}
                y1={room.cy - topOffset}
                x2={room.cx}
                y2={room.cy - topOffset - rotStemLen}
                stroke="#f8fafc"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              />
              <circle
                cx={room.cx}
                cy={room.cy - topOffset - rotStemLen}
                r={handleRadius * 1.15}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={1.8 / zoom}
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => handleShapeMouseDown(e, room, 'rotate-room')}
              />

              {/* Rectangle Corner & Side-Edge Midpoint Handles */}
              {room.shapeType === 'rect' && (
                <>
                  {[
                    { x: room.cx - (room.widthPx || 0) / 2, y: room.cy - (room.heightPx || 0) / 2 },
                    { x: room.cx + (room.widthPx || 0) / 2, y: room.cy - (room.heightPx || 0) / 2 },
                    { x: room.cx + (room.widthPx || 0) / 2, y: room.cy + (room.heightPx || 0) / 2 },
                    { x: room.cx - (room.widthPx || 0) / 2, y: room.cy + (room.heightPx || 0) / 2 },
                  ].map((corner, cIdx) => (
                    <rect
                      key={`c_${cIdx}`}
                      x={corner.x - handleRadius}
                      y={corner.y - handleRadius}
                      width={handleRadius * 2}
                      height={handleRadius * 2}
                      fill="#ffffff"
                      stroke={room.color}
                      strokeWidth={1.6 / zoom}
                      style={{ cursor: 'nwse-resize' }}
                      onMouseDown={(e) => handleShapeMouseDown(e, room, 'resize-rect-corner', cIdx)}
                    />
                  ))}

                  {/* Side Edge Midpoint Handles (Top, Right, Bottom, Left) */}
                  {[
                    { x: room.cx, y: room.cy - (room.heightPx || 0) / 2, cur: 'ns-resize' },
                    { x: room.cx + (room.widthPx || 0) / 2, y: room.cy, cur: 'ew-resize' },
                    { x: room.cx, y: room.cy + (room.heightPx || 0) / 2, cur: 'ns-resize' },
                    { x: room.cx - (room.widthPx || 0) / 2, y: room.cy, cur: 'ew-resize' },
                  ].map((edgePt, eIdx) => (
                    <rect
                      key={`e_${eIdx}`}
                      x={edgePt.x - handleRadius * 0.85}
                      y={edgePt.y - handleRadius * 0.85}
                      width={handleRadius * 1.7}
                      height={handleRadius * 1.7}
                      rx={2 / zoom}
                      fill="#06b6d4"
                      stroke="#ffffff"
                      strokeWidth={1.4 / zoom}
                      style={{ cursor: edgePt.cur }}
                      onMouseDown={(e) => handleShapeMouseDown(e, room, 'resize-rect-edge', eIdx)}
                    />
                  ))}
                </>
              )}

              {/* Polygon Vertex Handles + Midpoint Split Handles + Edge Length Labels */}
              {room.shapeType === 'polygon' && room.points && (
                <>
                  {polyEdges.map((ed) => (
                    <g key={`pe_${ed.index}`}>
                      {/* Midpoint click to split edge */}
                      <circle
                        cx={ed.midX}
                        cy={ed.midY}
                        r={handleRadius * 0.85}
                        fill="#0f172a"
                        stroke="#38bdf8"
                        strokeWidth={1.3 / zoom}
                        style={{ cursor: 'copy' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          splitPolygonEdge(room, ed.index);
                        }}
                      />
                      {/* Edge number badge E1..En */}
                      <g
                        transform={`translate(${ed.midX}, ${ed.midY - 12 / zoom}) rotate(${
                          -room.rotationDeg - activeSheet.canvasRotationDeg
                        })`}
                        style={{ pointerEvents: 'none' }}
                      >
                        <rect
                          x={-29 / zoom}
                          y={-8 / zoom}
                          width={58 / zoom}
                          height={15 / zoom}
                          rx={3 / zoom}
                          fill="rgba(15, 23, 42, 0.92)"
                          stroke="#38bdf8"
                          strokeWidth={0.9 / zoom}
                        />
                        <text
                          x={0}
                          y={2.5 / zoom}
                          textAnchor="middle"
                          fill="#bae6fd"
                          fontSize={8.5 / zoom}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          E{ed.index + 1}:{ed.lengthM.toFixed(2)}m
                        </text>
                      </g>
                    </g>
                  ))}

                  {/* Draggable Corner Vertices */}
                  {room.points.map((pt, vIdx) => (
                    <rect
                      key={`pv_${vIdx}`}
                      x={pt.x - handleRadius}
                      y={pt.y - handleRadius}
                      width={handleRadius * 2}
                      height={handleRadius * 2}
                      fill="#ffffff"
                      stroke={room.color}
                      strokeWidth={1.8 / zoom}
                      style={{ cursor: 'crosshair' }}
                      onMouseDown={(e) => handleShapeMouseDown(e, room, 'move-poly-vertex', vIdx)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        removePolygonVertex(room, vIdx);
                      }}
                    />
                  ))}
                </>
              )}

              {/* Resize Handle for Circle rim */}
              {room.shapeType === 'circle' && (
                <circle
                  cx={room.cx + (room.radiusPx || 0)}
                  cy={room.cy}
                  r={handleRadius}
                  fill="#ffffff"
                  stroke={room.color}
                  strokeWidth={1.6 / zoom}
                  style={{ cursor: 'ew-resize' }}
                  onMouseDown={(e) => handleShapeMouseDown(e, room, 'resize-circle')}
                />
              )}

              {/* Dedicated Center Relocate Grip Handle */}
              <circle
                cx={labelSlot.x}
                cy={labelSlot.y}
                r={5.5 / zoom}
                fill="#f59e0b"
                fillOpacity={0.9}
                stroke="#ffffff"
                strokeWidth={1.5 / zoom}
                style={{ cursor: 'move' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedRoomId(room.id);
                  const pt = clientToImagePoint(e.clientX, e.clientY);
                  if (!pt) return;
                  dragSessionRef.current = {
                    kind: 'move-room',
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startPan: { ...pan },
                    startImgPt: pt,
                    roomSnapshot: {
                      ...room,
                      points: room.points ? room.points.map((p) => ({ ...p })) : undefined,
                    },
                  };
                }}
              />
            </>
          )}
        </g>
      </g>
    );
  };

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Compact Page Header */}
      <div className="bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-800 rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs dark:shadow-none">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Step 1 · Floor Plan Takeoff</span>
            <span aria-hidden="true">·</span>
            <span>CAD Overlay &amp; Auto Label Reader</span>
            {activeSheet && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {activeSheet.isCalibrated
                    ? `Calibrated ${activeSheet.pixelsPerMeter.toFixed(1)} px/m`
                    : `Default ${activeSheet.pixelsPerMeter.toFixed(0)} px/m`}
                </span>
              </>
            )}
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white truncate">
            Architectural Floor Plan Room Mapper
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{sheets.length > 0 ? 'Add Floor Sheet' : 'Upload Drawing (PDF / Image)'}</span>
          </button>

          {allMappedEntries.length > 0 && (
            <button
              type="button"
              onClick={handleExportTakeoffExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap"
              title="Download mapped rooms & floor summary Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSkipToInventory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap"
            title="Proceed directly to Step 2 Inventory without a drawing"
          >
            <span>Skip to Inventory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {allMappedEntries.length > 0 && (
            <button
              type="button"
              onClick={handleSyncToInventory}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold border border-emerald-500 dark:border-emerald-400/30 transition-colors whitespace-nowrap"
              title="Send all mapped rooms, levels & areas (SQMT/Sqft) into Step 2 Inventory"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Send {allMappedEntries.length} Rooms to Inventory</span>
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200 text-xs px-3.5 py-2 rounded-lg flex items-center justify-between gap-2">
          <span>{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="text-rose-700 dark:text-rose-300 hover:text-rose-950 dark:hover:text-white text-xs shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {storageWarning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs px-3.5 py-1.5 rounded-lg">
          {storageWarning}
        </div>
      )}

      {detectedPrintScaleSuggestion && activeSheet && (
        <div className="bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-300 dark:border-cyan-500/40 text-cyan-950 dark:text-cyan-100 text-xs px-3.5 py-2 rounded-lg flex flex-wrap items-center justify-between gap-2">
          <span>
            Detected printed dimensions match a scale of{' '}
            <strong className="font-mono">{detectedPrintScaleSuggestion.ppm} px/m</strong> across{' '}
            {detectedPrintScaleSuggestion.sampleCount} rooms.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                updateActiveSheet({
                  pixelsPerMeter: detectedPrintScaleSuggestion.ppm,
                  isCalibrated: true,
                });
                setDetectedPrintScaleSuggestion(null);
                onNotify?.(
                  `Applied auto-detected scale (${detectedPrintScaleSuggestion.ppm} px/m).`
                );
              }}
              className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
            >
              Apply Scale
            </button>
            <button
              type="button"
              onClick={() => setDetectedPrintScaleSuggestion(null)}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {!activeSheet ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingFile(false);
            handleFilesSelected(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors min-h-[calc(100vh-215px)] flex flex-col items-center justify-center ${
            isDraggingFile
              ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
              : 'border-slate-300 dark:border-slate-700/80 bg-white dark:bg-[#0f172a]'
          }`}
        >
          <div className="max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <FileUp className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                {isLoadingFile
                  ? 'Rendering Architectural Drawing...'
                  : 'Upload Civil Architectural Floor Plan (If Available)'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Drop PNG, JPG, SVG, or multi-page PDF architectural plans here. Auto-read room labels
                and dimensions or map rooms manually using{' '}
                <strong className="text-slate-900 dark:text-slate-200">Rectangle</strong>,{' '}
                <strong className="text-slate-900 dark:text-slate-200">Polygon</strong>, or{' '}
                <strong className="text-slate-900 dark:text-slate-200">Circle</strong> overlays with drag relocation,
                typed edge sizing, rotation, and direct Inventory sync.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                disabled={isLoadingFile}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>{isLoadingFile ? 'Processing File...' : 'Select Floor Plan File'}</span>
              </button>

              <button
                type="button"
                onClick={onSkipToInventory}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors"
              >
                <span>No Drawing Available · Go to Inventory</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* SIDE-BY-SIDE VIEW: Architectural Drawing (Left) & Mapped Rooms Table + Geometry Editor (Right) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* LEFT PANEL: Architectural Plan Canvas & CAD Controls */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-800 rounded-lg flex flex-col overflow-hidden min-h-[540px] lg:h-[calc(100vh-175px)] shadow-xs dark:shadow-none">
            {/* Sheet Switcher & Auto-Read Bar */}
            <div className="px-3 py-1.5 border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#0b111d] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {sheets.map((sheet) => {
                  const isActive = sheet.id === activeSheet.id;
                  const count = rooms.filter((r) => r.sheetId === sheet.id).length;
                  return (
                    <div
                      key={sheet.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border transition-colors shrink-0 ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500/40 font-semibold'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-950 dark:hover:text-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSheetId(sheet.id);
                          setActiveFloor(sheet.defaultFloor);
                          setPolyPoints([]);
                          setCalPts([]);
                        }}
                        className="truncate max-w-[140px]"
                      >
                        {sheet.name} ({count})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSheet(sheet.id)}
                        className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                        title="Remove sheet"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 shrink-0"
                  title="Add another floor plan sheet"
                >
                  <Plus className="w-3 h-3" />
                  <span>Sheet</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] shrink-0">
                <div className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">Level:</span>
                  <select
                    value={activeFloor}
                    onChange={(e) => {
                      setActiveFloor(e.target.value);
                      updateActiveSheet({ defaultFloor: e.target.value });
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-950 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {FLOOR_OPTIONS.map((fl) => (
                      <option key={fl} value={fl}>
                        {fl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Auto Read Room Labels & Dimensions */}
                <button
                  type="button"
                  disabled={autoReadLoading}
                  onClick={() => handleAutoReadFloorPlan('vision')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-50 dark:bg-cyan-600/20 hover:bg-cyan-100 dark:hover:bg-cyan-600/35 disabled:opacity-50 text-cyan-800 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-500/40 font-semibold transition-colors whitespace-nowrap"
                  title="Automatically read room labels, printed dimensions & map overlays from the uploaded floor plan"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" />
                  <span>{autoReadLoading ? 'Reading Plan...' : 'Auto Read Labels & Dims'}</span>
                </button>

                <button
                  type="button"
                  disabled={autoReadLoading}
                  onClick={() => handleAutoReadFloorPlan('ocr')}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap"
                  title="Run fast browser OCR directly on drawing text & dimensions (works offline from Gemini API)"
                >
                  <ScanText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>OCR Scan</span>
                </button>

                {activeSheet.extractedTexts && activeSheet.extractedTexts.length > 0 && (
                  <button
                    type="button"
                    disabled={autoReadLoading}
                    onClick={() => handleAutoReadFloorPlan('pdf')}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap"
                    title="Scan embedded CAD PDF text layer directly offline"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>PDF Text</span>
                  </button>
                )}
              </div>
            </div>

            {/* CAD Toolbar: Tools, Auto-Extract Toggle, Drawing Rotation & Zoom */}
            <div className="px-3 py-2 border-b border-slate-300 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: 'select', label: 'Select / Drag', icon: <MousePointer className="w-3.5 h-3.5" /> },
                    { id: 'rect', label: 'Rectangle', icon: <Square className="w-3.5 h-3.5" /> },
                    { id: 'polygon', label: 'Polygon', icon: <Hexagon className="w-3.5 h-3.5" /> },
                    { id: 'circle', label: 'Circle', icon: <Circle className="w-3.5 h-3.5" /> },
                    { id: 'calibrate', label: 'Calibrate', icon: <Ruler className="w-3.5 h-3.5" /> },
                  ] as { id: ActiveTool; label: string; icon: React.ReactNode }[]
                ).map((tool) => {
                  const isOn = activeTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => {
                        setActiveTool(tool.id);
                        setPolyPoints([]);
                        setCalPts([]);
                        setCalModalOpen(false);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        isOn
                          ? tool.id === 'calibrate'
                            ? 'bg-amber-100 dark:bg-amber-600/25 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-500/50'
                            : 'bg-emerald-100 dark:bg-emerald-600/25 text-emerald-900 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500/50'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {tool.icon}
                      <span>{tool.label}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setAutoExtractOnDraw((v) => !v)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    autoExtractOnDraw
                      ? 'bg-emerald-50 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-950 dark:hover:text-slate-200'
                  }`}
                  title="Automatically extract room label text when finishing a Rectangle, Polygon, or Circle"
                >
                  <ScanText className="w-3.5 h-3.5" />
                  <span>Auto Name: {autoExtractOnDraw ? 'On' : 'Off'}</span>
                </button>
              </div>

              {/* Drawing Rotation & Zoom Controls */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-1.5 py-0.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <button
                    type="button"
                    onClick={() => rotateSheetBy(-90)}
                    className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    title="Rotate floor plan 90° CCW"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    step={1}
                    value={activeSheet.canvasRotationDeg}
                    onChange={(e) =>
                      updateActiveSheet({
                        canvasRotationDeg: normalizeDeg(parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-12 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 text-center font-mono tabular-nums text-[11px] text-cyan-700 dark:text-cyan-300 focus:outline-none focus:border-cyan-500"
                    title="Drawing rotation angle (-180° to +180°)"
                  />
                  <span className="text-[10px] text-slate-500">°</span>
                  <button
                    type="button"
                    onClick={() => rotateSheetBy(90)}
                    className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    title="Rotate floor plan 90° CW"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  {activeSheet.canvasRotationDeg !== 0 && (
                    <button
                      type="button"
                      onClick={() => updateActiveSheet({ canvasRotationDeg: 0 })}
                      className="text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white px-1"
                    >
                      0°
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Number(Math.max(0.15, z / 1.2).toFixed(3)))}
                    className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono tabular-nums text-[11px] text-slate-700 dark:text-slate-300 px-1.5 min-w-[44px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Number(Math.min(5, z * 1.2).toFixed(3)))}
                    className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fitSheetToViewport(activeSheet)}
                    className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    title="Fit floor plan to view"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Contextual Tool Helper Bar: Calibrate OR Polygon Edge-Length Entry */}
            {(activeTool === 'calibrate' || activeTool === 'polygon') && (
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/95 border-b border-slate-300 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                {activeTool === 'calibrate' && (
                  <div className="flex flex-wrap items-center gap-2 text-amber-800 dark:text-amber-200">
                    <Ruler className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    {calPts.length === 0 && (
                      <span>Click Point 1 on a known dimension line or wall.</span>
                    )}
                    {calPts.length === 1 && (
                      <span>Click Point 2 at the opposite end of that dimension line.</span>
                    )}
                    {calPts.length >= 2 && calModalOpen && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono">
                          Span: {Math.hypot(calPts[1].x - calPts[0].x, calPts[1].y - calPts[0].y).toFixed(1)} px =
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={calRealDist}
                          onChange={(e) => {
                            const next = acceptTwoDecimalInput(e.target.value, calRealDist);
                            if (next !== null) setCalRealDist(next);
                          }}
                          className="w-20 bg-white dark:bg-slate-950 border border-amber-400 dark:border-amber-500/60 rounded px-2 py-0.5 text-slate-950 dark:text-white font-mono text-xs focus:outline-none"
                          autoFocus
                        />
                        <select
                          value={calUnit}
                          onChange={(e) => setCalUnit(e.target.value as 'm' | 'ft')}
                          className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-950 dark:text-white text-xs"
                        >
                          <option value="m">Meters (m)</option>
                          <option value="ft">Feet (ft)</option>
                        </select>
                        <button
                          type="button"
                          onClick={applyCalibration}
                          className="px-2.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                        >
                          Apply Scale
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCalPts([]);
                            setCalModalOpen(false);
                          }}
                          className="text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTool === 'polygon' && (
                  <div className="flex flex-wrap items-center justify-between w-full gap-2 text-emerald-800 dark:text-emerald-200">
                    <span>
                      Click vertices ({polyPoints.length} placed). Double-click, press Enter, or click first dot to close.
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {polyPoints.length >= 1 && (
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5">
                          <span className="text-slate-600 dark:text-slate-400">Next Edge ({dimUnit}):</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="e.g. 4.25"
                            value={nextPolyEdgeLen}
                            onChange={(e) => {
                              const next = acceptTwoDecimalInput(e.target.value, nextPolyEdgeLen);
                              if (next !== null) setNextPolyEdgeLen(next);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addPolygonPointByTypedLength();
                              }
                            }}
                            className="w-16 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 py-0 text-slate-950 dark:text-white font-mono text-[11px] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={addPolygonPointByTypedLength}
                            className="px-1.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                          >
                            +Pt
                          </button>
                        </div>
                      )}
                      {polyPoints.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPolyPoints((p) => p.slice(0, -1))}
                          className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                        >
                          Undo Pt
                        </button>
                      )}
                      {polyPoints.length >= 3 && (
                        <button
                          type="button"
                          onClick={() => finalizePolygon(polyPoints)}
                          className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                        >
                          Finish Polygon
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Main Interactive Architectural Canvas Viewport */}
            <div
              ref={viewportRef}
              onMouseDown={handleViewportMouseDown}
              onDoubleClick={handleViewportDoubleClick}
              onMouseMove={handleViewportMouseMove}
              onMouseUp={handleViewportMouseUp}
              onMouseLeave={() => {
                setCursorImgPt(null);
                handleViewportMouseUp();
              }}
              onWheel={handleWheelZoom}
              className="relative flex-1 min-h-[420px] bg-slate-200 dark:bg-[#080c12] overflow-hidden select-none"
              style={{
                cursor: activeTool === 'select' ? 'grab' : 'crosshair',
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none opacity-35 dark:opacity-25"
                style={{
                  backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />

              {/* Transformed Stage (Drawing + SVG Overlay) */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: activeSheet.width,
                  height: activeSheet.height,
                  marginLeft: -activeSheet.width / 2,
                  marginTop: -activeSheet.height / 2,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${activeSheet.canvasRotationDeg}deg)`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={activeSheet.imageDataUrl}
                  alt={activeSheet.name}
                  draggable={false}
                  referrerPolicy="no-referrer"
                  style={{
                    width: activeSheet.width,
                    height: activeSheet.height,
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                />

                <svg
                  width={activeSheet.width}
                  height={activeSheet.height}
                  viewBox={`0 0 ${activeSheet.width} ${activeSheet.height}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'visible',
                  }}
                >
                  {activeSheetRooms.map((room) => renderRoomShape(room))}

                  {/* Live Rectangle Draft */}
                  {rectDraft && rectDraft.widthPx > 2 && rectDraft.heightPx > 2 && (() => {
                    const useVert = rectDraft.heightPx > rectDraft.widthPx * 1.25 && rectDraft.widthPx < 100 / zoom;
                    const draftAngle = makeUprightLocalAngle(
                      useVert ? -90 : 0,
                      rectDraft.rotationDeg,
                      activeSheet.canvasRotationDeg
                    );
                    const availW = (useVert ? rectDraft.heightPx : rectDraft.widthPx) * 0.92;
                    const availH = (useVert ? rectDraft.widthPx : rectDraft.heightPx) * 0.88;
                    const dw = Math.min(110 / zoom, availW);
                    const dh = Math.min(24 / zoom, availH);
                    const fontS = Math.min(10.5 / zoom, dh * 0.55, dw * 0.11);
                    return (
                      <g transform={`rotate(${rectDraft.rotationDeg}, ${rectDraft.cx}, ${rectDraft.cy})`}>
                        <defs>
                          <clipPath id="rect-draft-clip">
                            <rect
                              x={rectDraft.cx - rectDraft.widthPx / 2}
                              y={rectDraft.cy - rectDraft.heightPx / 2}
                              width={rectDraft.widthPx}
                              height={rectDraft.heightPx}
                            />
                          </clipPath>
                        </defs>
                        <rect
                          x={rectDraft.cx - rectDraft.widthPx / 2}
                          y={rectDraft.cy - rectDraft.heightPx / 2}
                          width={rectDraft.widthPx}
                          height={rectDraft.heightPx}
                          fill="#10b981"
                          fillOpacity={0.22}
                          stroke="#34d399"
                          strokeWidth={2.5 / zoom}
                          strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                        />
                        {dw >= 8 / zoom && dh >= 6 / zoom && (
                          <g clipPath="url(#rect-draft-clip)" style={{ pointerEvents: 'none' }}>
                            <g transform={`translate(${rectDraft.cx}, ${rectDraft.cy}) rotate(${draftAngle})`}>
                              <rect
                                x={-dw / 2}
                                y={-dh / 2}
                                width={dw}
                                height={dh}
                                rx={Math.min(4 / zoom, dh * 0.25)}
                                fill="#0f172a"
                                stroke="#34d399"
                                strokeWidth={Math.min(1 / zoom, dh * 0.08)}
                              />
                              <text
                                x={0}
                                y={fontS * 0.35}
                                textAnchor="middle"
                                fill="#6ee7b7"
                                fontSize={fontS}
                                fontFamily="JetBrains Mono, monospace"
                              >
                                {(rectDraft.widthPx / activeSheet.pixelsPerMeter).toFixed(2)}×
                                {(rectDraft.heightPx / activeSheet.pixelsPerMeter).toFixed(2)}m
                              </text>
                            </g>
                          </g>
                        )}
                      </g>
                    );
                  })()}

                  {/* Live Circle Draft */}
                  {circleDraft && circleDraft.radiusPx > 2 && (
                    <g>
                      <circle
                        cx={circleDraft.cx}
                        cy={circleDraft.cy}
                        r={circleDraft.radiusPx}
                        fill="#06b6d4"
                        fillOpacity={0.22}
                        stroke="#22d3ee"
                        strokeWidth={2.5 / zoom}
                        strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                      />
                      <line
                        x1={circleDraft.cx}
                        y1={circleDraft.cy}
                        x2={circleDraft.cx + circleDraft.radiusPx}
                        y2={circleDraft.cy}
                        stroke="#22d3ee"
                        strokeWidth={1.5 / zoom}
                      />
                      <g
                        transform={`translate(${circleDraft.cx}, ${circleDraft.cy}) rotate(${-activeSheet.canvasRotationDeg})`}
                      >
                        <rect
                          x={-48 / zoom}
                          y={-12 / zoom}
                          width={96 / zoom}
                          height={22 / zoom}
                          rx={4 / zoom}
                          fill="#0f172a"
                          stroke="#22d3ee"
                          strokeWidth={1 / zoom}
                        />
                        <text
                          x={0}
                          y={3 / zoom}
                          textAnchor="middle"
                          fill="#67e8f9"
                          fontSize={10 / zoom}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          Ø {((circleDraft.radiusPx * 2) / activeSheet.pixelsPerMeter).toFixed(2)}m
                        </text>
                      </g>
                    </g>
                  )}

                  {/* Live Polygon Draft + Edge Length Readout */}
                  {polyPoints.length > 0 && (
                    <g>
                      <polyline
                        points={[...polyPoints, ...(cursorImgPt ? [cursorImgPt] : [])]
                          .map((p) => `${p.x},${p.y}`)
                          .join(' ')}
                        fill="rgba(16, 185, 129, 0.14)"
                        stroke="#34d399"
                        strokeWidth={2.2 / zoom}
                        strokeDasharray={`${5 / zoom} ${3 / zoom}`}
                      />
                      {cursorImgPt && polyPoints.length >= 1 && (
                        <g
                          transform={`translate(${
                            (polyPoints[polyPoints.length - 1].x + cursorImgPt.x) / 2
                          }, ${
                            (polyPoints[polyPoints.length - 1].y + cursorImgPt.y) / 2 - 12 / zoom
                          }) rotate(${-activeSheet.canvasRotationDeg})`}
                          style={{ pointerEvents: 'none' }}
                        >
                          <rect
                            x={-28 / zoom}
                            y={-9 / zoom}
                            width={56 / zoom}
                            height={16 / zoom}
                            rx={3 / zoom}
                            fill="#0f172a"
                            stroke="#34d399"
                            strokeWidth={1 / zoom}
                          />
                          <text
                            x={0}
                            y={2.5 / zoom}
                            textAnchor="middle"
                            fill="#6ee7b7"
                            fontSize={9.5 / zoom}
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {(
                              Math.hypot(
                                cursorImgPt.x - polyPoints[polyPoints.length - 1].x,
                                cursorImgPt.y - polyPoints[polyPoints.length - 1].y
                              ) / activeSheet.pixelsPerMeter
                            ).toFixed(2)}
                            m
                          </text>
                        </g>
                      )}
                      {polyPoints.map((pt, idx) => (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r={(idx === 0 && polyPoints.length >= 3 ? 7 : 4.5) / zoom}
                          fill={idx === 0 ? '#fbbf24' : '#34d399'}
                          stroke="#0f172a"
                          strokeWidth={1.5 / zoom}
                        />
                      ))}
                    </g>
                  )}

                  {/* Calibration Line */}
                  {calPts.length > 0 && (
                    <g>
                      {calPts.length === 1 && cursorImgPt && (
                        <line
                          x1={calPts[0].x}
                          y1={calPts[0].y}
                          x2={cursorImgPt.x}
                          y2={cursorImgPt.y}
                          stroke="#fbbf24"
                          strokeWidth={2.5 / zoom}
                          strokeDasharray={`${5 / zoom} ${4 / zoom}`}
                        />
                      )}
                      {calPts.length >= 2 && (
                        <line
                          x1={calPts[0].x}
                          y1={calPts[0].y}
                          x2={calPts[1].x}
                          y2={calPts[1].y}
                          stroke="#fbbf24"
                          strokeWidth={3 / zoom}
                        />
                      )}
                      {calPts.map((pt, i) => (
                        <circle
                          key={i}
                          cx={pt.x}
                          cy={pt.y}
                          r={6 / zoom}
                          fill="#fbbf24"
                          stroke="#0f172a"
                          strokeWidth={1.5 / zoom}
                        />
                      ))}
                    </g>
                  )}
                </svg>
              </div>

              {/* Floating Spotlight Callout */}
              {hoveredRoomMeta && (
                <div className="absolute top-3 left-3 pointer-events-none bg-white/95 dark:bg-slate-950/95 border border-emerald-500/60 rounded-lg px-3 py-2 shadow-lg text-xs max-w-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-950 dark:text-white">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: hoveredRoomMeta.room.color }}
                    />
                    <span className="truncate">{hoveredRoomMeta.room.roomName}</span>
                    <span className="text-slate-600 dark:text-slate-400 font-normal">
                      · {hoveredRoomMeta.room.floor}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 font-mono tabular-nums text-[11px] text-emerald-700 dark:text-emerald-300">
                    <span>{hoveredRoomMeta.metrics.areaSqm.toFixed(2)} m²</span>
                    <span className="text-slate-400 dark:text-slate-500">·</span>
                    <span>{hoveredRoomMeta.metrics.areaSqft.toFixed(1)} sq.ft</span>
                    <span className="text-slate-400 dark:text-slate-500">·</span>
                    <span className="text-cyan-700 dark:text-cyan-300">{hoveredRoomMeta.metrics.dimLabel}</span>
                    {hoveredRoomMeta.room.printedDimText && (
                      <>
                        <span className="text-slate-400 dark:text-slate-500">·</span>
                        <span className="text-amber-700 dark:text-amber-300">
                          Plan: {hoveredRoomMeta.room.printedDimText}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom Canvas Helper */}
              <div className="absolute bottom-2.5 left-3 right-3 pointer-events-none flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="pointer-events-auto bg-white/95 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1 text-slate-700 dark:text-slate-300 flex items-center gap-2 shadow-xs">
                  <span>
                    Sheet: <strong className="text-slate-950 dark:text-white">{activeSheet.name}</strong>
                  </span>
                  <span className="text-slate-400 dark:text-slate-600">|</span>
                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {activeSheet.width}×{activeSheet.height}px · Rot {activeSheet.canvasRotationDeg}°
                  </span>
                </div>

                <div className="pointer-events-auto bg-white/95 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1 text-slate-600 dark:text-slate-400 hidden sm:block shadow-xs">
                  Drag shape in Select tool to relocate · Drag handles to resize/rotate · Arrow keys nudge
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Geometry/Resize Editor (when selected) + Side-by-Side Table */}
          <div className="lg:col-span-5 bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-800 rounded-lg flex flex-col overflow-hidden min-h-[540px] lg:h-[calc(100vh-175px)] shadow-xs dark:shadow-none">
            {/* Table Header & Floor Filter */}
            <div className="px-3.5 py-2.5 border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#0b111d] space-y-2 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white">
                    Mapped Rooms &amp; Dimensions Table
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                    <span>
                      {totals.count} {totals.count === 1 ? 'room' : 'rooms'}
                    </span>
                    <span>·</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      {totals.areaSqm.toFixed(2)} m²
                    </span>
                    <span>·</span>
                    <span>{totals.areaSqft.toFixed(1)} sq.ft</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={floorFilter}
                    onChange={(e) => setFloorFilter(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                    title="Filter table by floor level"
                  >
                    <option value="ALL">All Floors ({rooms.length})</option>
                    {FLOOR_OPTIONS.filter((fl) => rooms.some((r) => r.floor === fl)).map((fl) => (
                      <option key={fl} value={fl}>
                        {fl} ({rooms.filter((r) => r.floor === fl).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scale & Sync bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/80 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 dark:text-slate-400">Scale (px/m):</span>
                  <input
                    type="number"
                    min={1}
                    step="0.5"
                    value={activeSheet.pixelsPerMeter}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val > 0) updateActiveSheet({ pixelsPerMeter: val, isCalibrated: true });
                    }}
                    className="w-16 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 font-mono tabular-nums text-cyan-700 dark:text-cyan-300 text-[11px] focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool('calibrate');
                      setCalPts([]);
                    }}
                    className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 underline underline-offset-2 ml-1"
                  >
                    2-Pt Calibrate
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 dark:text-slate-400">Sync:</span>
                  <select
                    value={syncMode}
                    onChange={(e) => setSyncMode(e.target.value as 'smart' | 'replace' | 'append')}
                    className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-800 dark:text-slate-200"
                  >
                    <option value="smart">Smart Merge</option>
                    <option value="replace">Replace All</option>
                    <option value="append">Append Rows</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Selected Room Geometry, Resize, Relocate & Manual Edge Length Panel */}
            {selectedRoom && selectedRoomMetrics && (
              <div className="px-3.5 py-2.5 border-b border-slate-300 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/80 space-y-2 shrink-0 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: selectedRoom.color }}
                    />
                    <span className="font-bold text-slate-950 dark:text-white truncate">
                      {selectedRoom.roomName}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 capitalize">
                      ({selectedRoom.shapeType})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Unit Switch m / ft */}
                    <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded p-0.5">
                      {(['m', 'ft'] as DimUnit[]).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setDimUnit(u)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            dimUnit === u
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>

                    {/* Extract Room Label Text & Dims inside this shape */}
                    <button
                      type="button"
                      disabled={extractingRoomId === selectedRoom.id}
                      onClick={() => handleExtractRoomLabel(selectedRoom, true)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-600/20 hover:bg-cyan-100 dark:hover:bg-cyan-600/35 disabled:opacity-50 text-cyan-800 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-500/40 font-medium"
                      title="Extract printed room label text inside this shape"
                    >
                      <ScanText className="w-3 h-3" />
                      <span>
                        {extractingRoomId === selectedRoom.id ? 'Reading...' : 'Extract Name'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Rectangle Typed Resize */}
                {selectedRoom.shapeType === 'rect' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <span>Width ({dimUnit}):</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={typedWidthInput}
                        onFocus={() => {
                          focusedDimFieldRef.current = 'rect-w';
                        }}
                        onChange={(e) => {
                          const next = acceptTwoDecimalInput(e.target.value, typedWidthInput);
                          if (next === null) return;
                          setTypedWidthInput(next);
                          applyTypedRectSize(next, typedLengthInput);
                        }}
                        onBlur={() => {
                          focusedDimFieldRef.current = null;
                          const ppm = activeSheet && activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
                          const mult = dimUnit === 'ft' ? FEET_PER_METER : 1;
                          const parsed = parseFloat(typedWidthInput);
                          if (!isNaN(parsed) && parsed > 0) {
                            const rounded = Math.round(parsed * 100) / 100;
                            applyTypedRectSize(rounded.toFixed(2), typedLengthInput);
                            setTypedWidthInput(rounded.toFixed(2));
                          } else {
                            setTypedWidthInput((computeRoomMetrics(selectedRoom, ppm).widthM * mult).toFixed(2));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded px-1.5 py-0.5 font-mono text-slate-950 dark:text-white"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <span>Length ({dimUnit}):</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={typedLengthInput}
                        onFocus={() => {
                          focusedDimFieldRef.current = 'rect-l';
                        }}
                        onChange={(e) => {
                          const next = acceptTwoDecimalInput(e.target.value, typedLengthInput);
                          if (next === null) return;
                          setTypedLengthInput(next);
                          applyTypedRectSize(typedWidthInput, next);
                        }}
                        onBlur={() => {
                          focusedDimFieldRef.current = null;
                          const ppm = activeSheet && activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
                          const mult = dimUnit === 'ft' ? FEET_PER_METER : 1;
                          const parsed = parseFloat(typedLengthInput);
                          if (!isNaN(parsed) && parsed > 0) {
                            const rounded = Math.round(parsed * 100) / 100;
                            applyTypedRectSize(typedWidthInput, rounded.toFixed(2));
                            setTypedLengthInput(rounded.toFixed(2));
                          } else {
                            setTypedLengthInput((computeRoomMetrics(selectedRoom, ppm).lengthM * mult).toFixed(2));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded px-1.5 py-0.5 font-mono text-slate-950 dark:text-white"
                      />
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 dark:text-slate-400">Scale %:</span>
                      <input
                        type="number"
                        min="5"
                        step="5"
                        value={typedScalePct}
                        onFocus={() => {
                          focusedDimFieldRef.current = 'scale-pct';
                        }}
                        onBlur={() => {
                          focusedDimFieldRef.current = null;
                        }}
                        onChange={(e) => setTypedScalePct(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyTypedScalePct()}
                        className="w-12 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 font-mono text-cyan-700 dark:text-cyan-300"
                      />
                      <button
                        type="button"
                        onClick={applyTypedScalePct}
                        className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}

                {/* Circle Typed Resize */}
                {selectedRoom.shapeType === 'circle' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <span>Diameter ({dimUnit}):</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={typedDiaInput}
                        onFocus={() => {
                          focusedDimFieldRef.current = 'circle-d';
                        }}
                        onChange={(e) => {
                          const next = acceptTwoDecimalInput(e.target.value, typedDiaInput);
                          if (next === null) return;
                          setTypedDiaInput(next);
                          applyTypedCircleSize(next);
                        }}
                        onBlur={() => {
                          focusedDimFieldRef.current = null;
                          const ppm = activeSheet && activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
                          const mult = dimUnit === 'ft' ? FEET_PER_METER : 1;
                          const parsed = parseFloat(typedDiaInput);
                          if (!isNaN(parsed) && parsed > 0) {
                            const rounded = Math.round(parsed * 100) / 100;
                            applyTypedCircleSize(rounded.toFixed(2));
                            setTypedDiaInput(rounded.toFixed(2));
                          } else {
                            setTypedDiaInput((computeRoomMetrics(selectedRoom, ppm).diameterM * mult).toFixed(2));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded px-1.5 py-0.5 font-mono text-slate-950 dark:text-white"
                      />
                    </label>
                  </div>
                )}

                {/* Polygon Resize Options + Manual Individual Edge Length Typing */}
                {selectedRoom.shapeType === 'polygon' && (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <span>W ({dimUnit}):</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={typedWidthInput}
                          onFocus={() => {
                            focusedDimFieldRef.current = 'poly-w';
                          }}
                          onChange={(e) => {
                            const next = acceptTwoDecimalInput(e.target.value, typedWidthInput);
                            if (next !== null) setTypedWidthInput(next);
                          }}
                          onBlur={() => {
                            focusedDimFieldRef.current = null;
                            const parsed = parseFloat(typedWidthInput);
                            if (!isNaN(parsed) && parsed > 0) {
                              const rounded = (Math.round(parsed * 100) / 100).toFixed(2);
                              applyTypedPolygonResize(rounded, typedLengthInput, 'w');
                              setTypedWidthInput(rounded);
                            } else if (activeSheet) {
                              const ppm = activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
                              const mult = dimUnit === 'ft' ? FEET_PER_METER : 1;
                              setTypedWidthInput((computeRoomMetrics(selectedRoom, ppm).widthM * mult).toFixed(2));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded px-1.5 py-0.5 font-mono text-slate-950 dark:text-white"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setLockAspect((v) => !v)}
                        className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                        title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                      >
                        {lockAspect ? <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Unlock className="w-3 h-3" />}
                      </button>
                      <label className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <span>L ({dimUnit}):</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={typedLengthInput}
                          onFocus={() => {
                            focusedDimFieldRef.current = 'poly-l';
                          }}
                          onChange={(e) => {
                            const next = acceptTwoDecimalInput(e.target.value, typedLengthInput);
                            if (next !== null) setTypedLengthInput(next);
                          }}
                          onBlur={() => {
                            focusedDimFieldRef.current = null;
                            const parsed = parseFloat(typedLengthInput);
                            if (!isNaN(parsed) && parsed > 0) {
                              const rounded = (Math.round(parsed * 100) / 100).toFixed(2);
                              applyTypedPolygonResize(typedWidthInput, rounded, 'l');
                              setTypedLengthInput(rounded);
                            } else if (activeSheet) {
                              const ppm = activeSheet.pixelsPerMeter > 0 ? activeSheet.pixelsPerMeter : 40;
                              const mult = dimUnit === 'ft' ? FEET_PER_METER : 1;
                              setTypedLengthInput((computeRoomMetrics(selectedRoom, ppm).lengthM * mult).toFixed(2));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded px-1.5 py-0.5 font-mono text-slate-950 dark:text-white"
                        />
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-600 dark:text-slate-400">Scale %:</span>
                        <input
                          type="number"
                          min="5"
                          step="5"
                          value={typedScalePct}
                          onFocus={() => {
                            focusedDimFieldRef.current = 'scale-pct';
                          }}
                          onBlur={() => {
                            focusedDimFieldRef.current = null;
                          }}
                          onChange={(e) => setTypedScalePct(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && applyTypedScalePct()}
                          className="w-12 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 font-mono text-cyan-700 dark:text-cyan-300"
                        />
                        <button
                          type="button"
                          onClick={applyTypedScalePct}
                          className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                        >
                          Resize
                        </button>
                      </div>
                    </div>

                    {/* Edge-by-Edge Manual Size Typing */}
                    {selectedRoomPolygonEdges.length > 0 && (
                      <div className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded p-1.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 mb-1">
                          <span>Manual Edge Lengths ({dimUnit}) — Press Enter or Set:</span>
                          <span>Click blue dot on canvas to split edge</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                          {selectedRoomPolygonEdges.map((ed) => (
                            <div
                              key={ed.index}
                              className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-1.5 py-0.5"
                            >
                              <span className="font-mono text-sky-700 dark:text-sky-300 font-semibold">
                                E{ed.index + 1}
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={typedEdgeInputs[ed.index] ?? ''}
                                onFocus={() => {
                                  focusedDimFieldRef.current = `edge-${ed.index}`;
                                }}
                                onChange={(e) => {
                                  const prevVal = typedEdgeInputs[ed.index] ?? '';
                                  const next = acceptTwoDecimalInput(e.target.value, prevVal);
                                  if (next === null) return;
                                  setTypedEdgeInputs((prev) => ({
                                    ...prev,
                                    [ed.index]: next,
                                  }));
                                }}
                                onBlur={() => {
                                  focusedDimFieldRef.current = null;
                                  const raw = typedEdgeInputs[ed.index] || '';
                                  const parsed = parseFloat(raw);
                                  const mult = dimUnit === 'ft' ? FEET_PER_METER : 1;
                                  const curDisp = Math.round(ed.lengthM * mult * 100) / 100;
                                  if (!isNaN(parsed) && parsed > 0) {
                                    const rounded = Math.round(parsed * 100) / 100;
                                    if (Math.abs(rounded - curDisp) >= 0.005) {
                                      applyPolygonEdgeLength(ed.index, rounded.toFixed(2));
                                    }
                                    setTypedEdgeInputs((prev) => ({
                                      ...prev,
                                      [ed.index]: rounded.toFixed(2),
                                    }));
                                  } else {
                                    setTypedEdgeInputs((prev) => ({
                                      ...prev,
                                      [ed.index]: curDisp.toFixed(2),
                                    }));
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const raw = typedEdgeInputs[ed.index] || '';
                                    const parsed = parseFloat(raw);
                                    if (!isNaN(parsed) && parsed > 0) {
                                      applyPolygonEdgeLength(
                                        ed.index,
                                        (Math.round(parsed * 100) / 100).toFixed(2)
                                      );
                                    }
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-14 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 py-0 font-mono text-slate-950 dark:text-white text-[11px]"
                              />
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  focusedDimFieldRef.current = null;
                                  const raw = typedEdgeInputs[ed.index] || '';
                                  const parsed = parseFloat(raw);
                                  if (!isNaN(parsed) && parsed > 0) {
                                    applyPolygonEdgeLength(
                                      ed.index,
                                      (Math.round(parsed * 100) / 100).toFixed(2)
                                    );
                                  }
                                }}
                                className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-semibold"
                              >
                                Set
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Relocate Controls (Drag instruction + Precision Nudge) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/70">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Move className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Relocate (or drag shape / amber dot):</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => relocateRoomByDelta(selectedRoom, -5, 0)}
                      className="p-1 rounded bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      title="Move Left"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => relocateRoomByDelta(selectedRoom, 0, -5)}
                      className="p-1 rounded bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => relocateRoomByDelta(selectedRoom, 0, 5)}
                      className="p-1 rounded bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => relocateRoomByDelta(selectedRoom, 5, 0)}
                      className="p-1 rounded bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      title="Move Right"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool('select')}
                      className={`ml-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${
                        activeTool === 'select'
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-500/40'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      Drag Tool
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable Rooms Table */}
            <div className="flex-1 overflow-auto">
              {tableEntries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                    <Square className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">No Rooms Mapped Yet</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed">
                    Click <strong className="text-cyan-700 dark:text-cyan-300">Auto Read Labels &amp; Dims</strong> above
                    the drawing, or pick <strong className="text-emerald-700 dark:text-emerald-300">Rectangle</strong>,{' '}
                    <strong className="text-emerald-700 dark:text-emerald-300">Polygon</strong>, or{' '}
                    <strong className="text-emerald-700 dark:text-emerald-300">Circle</strong> to trace rooms directly.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-300 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-2 w-10 text-center">#</th>
                      <th className="py-2 px-2">Room Name</th>
                      <th className="py-2 px-2 w-28">Level</th>
                      <th className="py-2 px-2">Dim &amp; Rot (°)</th>
                      <th className="py-2 px-2 text-right w-20">SQMT</th>
                      <th className="py-2 px-2 text-right w-20">Sqft</th>
                      <th className="py-2 px-1.5 text-center w-20">Act</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                    {tableEntries.map(({ room, metrics }, idx) => {
                      const isHovered = hoveredRoomId === room.id;
                      const isSelected = selectedRoomId === room.id;
                      return (
                        <tr
                          key={room.id}
                          ref={(el) => {
                            tableRowRefs.current[room.id] = el;
                          }}
                          onMouseEnter={() => handleTableRowEnter(room)}
                          onMouseLeave={() =>
                            setHoveredRoomId((cur) => (cur === room.id ? null : cur))
                          }
                          onClick={() => setSelectedRoomId(room.id)}
                          className={`transition-colors cursor-pointer ${
                            isHovered
                              ? 'bg-emerald-50 dark:bg-emerald-500/20 ring-1 ring-inset ring-emerald-500/60 dark:ring-emerald-400/60'
                              : isSelected
                              ? 'bg-cyan-50 dark:bg-cyan-950/35'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="py-1.5 px-2 text-center align-middle">
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className="w-2.5 h-2.5 rounded-xs"
                                style={{ backgroundColor: room.color }}
                                title={room.shapeType}
                              />
                              <span className="font-mono tabular-nums text-[10px] text-slate-600 dark:text-slate-400">
                                {idx + 1}
                              </span>
                            </div>
                          </td>

                          {/* Editable Room Name */}
                          <td className="py-1.5 px-2 align-middle">
                            <input
                              type="text"
                              value={room.roomName}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRoomId(room.id);
                              }}
                              onChange={(e) =>
                                handleUpdateRoom(room.id, { roomName: e.target.value })
                              }
                              className={`w-full min-w-[96px] rounded px-1.5 py-1 text-xs font-medium focus:outline-none ${
                                isHovered
                                  ? 'bg-white dark:bg-slate-950 border border-emerald-500 dark:border-emerald-400 text-slate-950 dark:text-white'
                                  : 'bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/80 text-slate-950 dark:text-slate-100 focus:border-emerald-500'
                              }`}
                              placeholder="Enter room name"
                            />
                            {room.printedDimText && (
                              <span className="block text-[10px] font-mono text-amber-700 dark:text-amber-300/90 mt-0.5 truncate">
                                Plan: {room.printedDimText}
                              </span>
                            )}
                          </td>

                          {/* Editable Level / Floor */}
                          <td className="py-1.5 px-2 align-middle">
                            <select
                              value={room.floor}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateRoom(room.id, { floor: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded px-1 py-1 text-[11px] text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                            >
                              {FLOOR_OPTIONS.map((fl) => (
                                <option key={fl} value={fl}>
                                  {fl}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Dimensions & Editable Rotation */}
                          <td className="py-1.5 px-2 align-middle">
                            <div className="font-mono tabular-nums text-[11px] text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {metrics.dimLabel}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-slate-500">Rot:</span>
                              <input
                                type="number"
                                step={1}
                                value={room.rotationDeg}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  handleUpdateRoom(room.id, {
                                    rotationDeg: normalizeDeg(parseFloat(e.target.value) || 0),
                                  })
                                }
                                className="w-12 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded px-1 py-0 text-center font-mono tabular-nums text-[10px] text-cyan-700 dark:text-cyan-300 focus:outline-none focus:border-cyan-500"
                              />
                              <span className="text-[10px] text-slate-500">°</span>
                            </div>
                          </td>

                          {/* Area SQMT */}
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 align-middle">
                            {metrics.areaSqm.toFixed(2)}
                          </td>

                          {/* Area Sqft */}
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 align-middle">
                            {metrics.areaSqft.toFixed(1)}
                          </td>

                          {/* Extract Label, Locate & Delete */}
                          <td className="py-1.5 px-1.5 text-center align-middle">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                disabled={extractingRoomId === room.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleExtractRoomLabel(room, true);
                                }}
                                className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40"
                                title="Extract room label & dimensions from drawing inside this shape"
                              >
                                <ScanText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  focusRoomOnCanvas(room);
                                }}
                                className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                                title="Center room on drawing"
                              >
                                <Crosshair className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRoom(room.id);
                                }}
                                className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50"
                                title="Delete room"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pinned Floor Summary & Sync Footer */}
            {allMappedEntries.length > 0 && (
              <div className="px-3.5 py-2.5 border-t border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#0b111d] space-y-2 shrink-0">
                {floorBreakdown.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                    <span className="text-slate-600 dark:text-slate-400 font-semibold">By Level:</span>
                    {floorBreakdown.map((f) => (
                      <span key={f.floor} className="font-mono tabular-nums">
                        <span className="text-slate-800 dark:text-slate-200">{f.floor}</span> ({f.rooms}) ·{' '}
                        <span className="text-emerald-700 dark:text-emerald-400">{f.sqm.toFixed(1)} m²</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Populate Step 2 Inventory with mapped room names, levels &amp; areas.
                  </span>
                  <button
                    type="button"
                    onClick={handleSyncToInventory}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Push to Inventory</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
