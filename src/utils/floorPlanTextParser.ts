import {
  FloorPlanExtractedTextItem,
  FloorPlanPoint,
  FloorPlanRoom,
} from '../types';

export interface ParsedDimensionResult {
  rawDimText: string;
  widthMeters: number;
  lengthMeters: number;
}

const FEET_TO_METERS = 0.3048;

function normalizeDimChars(s: string): string {
  return s
    .replace(/[’‘′]/g, "'")
    .replace(/[”“″]/g, '"')
    .replace(/[✕×]/g, 'x')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSingleLengthToMeters(token: string, defaultUnit: 'm' | 'ft' | 'mm' | 'auto'): number {
  const s = normalizeDimChars(token);
  // Format like 12'-6" or 12' - 6" or 12' 6" or 12'6" or 12'
  const ftInchMatch = s.match(
    /^(\d+(?:\.\d+)?)\s*(?:'|ft)\s*(?:[- ]*\s*(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/i
  );
  if (ftInchMatch) {
    const feet = parseFloat(ftInchMatch[1]) || 0;
    const inches = parseFloat(ftInchMatch[2] || '0') || 0;
    return (feet + inches / 12) * FEET_TO_METERS;
  }

  // Format like 4.20m or 4200mm or 4.20
  const numMatch = s.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m|ft|')?$/i);
  if (!numMatch) return 0;
  const val = parseFloat(numMatch[1]);
  if (isNaN(val) || val <= 0) return 0;

  const unit = (numMatch[2] || '').toLowerCase();
  if (unit === 'mm') return val / 1000;
  if (unit === 'cm') return val / 100;
  if (unit === 'ft' || unit === "'") return val * FEET_TO_METERS;
  if (unit === 'm') return val;

  if (defaultUnit === 'ft') return val * FEET_TO_METERS;
  if (defaultUnit === 'mm') return val / 1000;
  if (defaultUnit === 'm') return val;

  // Heuristic for architectural CAD numbers without explicit unit
  if (val >= 500) return val / 1000; // mm e.g. 3600 -> 3.6 m
  return val; // meters e.g. 3.60 or 4.20
}

export function parseDimensionPair(text: string): ParsedDimensionResult | null {
  const cleaned = normalizeDimChars(text);
  // Match patterns like "12'-0" x 14'-6"", "3.60m x 4.20m", "3600 x 4200 mm", "4.5 x 3.2", "12' BY 14'"
  const dimToken =
    `(\\d+(?:\\.\\d+)?(?:\\s*(?:'|ft)\\s*(?:[- ]*\\s*\\d+(?:\\.\\d+)?\\s*(?:"|in)?)?|\\s*(?:mm|cm|m|ft)?))`;
  const pairRegex = new RegExp(
    `${dimToken}\\s*(?:[x*]|\\bby\\b)\\s*${dimToken}`,
    'i'
  );

  const match = cleaned.match(pairRegex);
  if (!match) return null;

  const rawDimText = match[0].trim();
  const hasFt = /'|ft|"/i.test(rawDimText);
  const hasMm = /mm/i.test(rawDimText);
  const hasM = /(?:\d|\s)m(?:\s|$|x|\*)/i.test(rawDimText);
  const defaultUnit: 'm' | 'ft' | 'mm' | 'auto' = hasFt
    ? 'ft'
    : hasMm
    ? 'mm'
    : hasM
    ? 'm'
    : 'auto';

  const wM = parseSingleLengthToMeters(match[1], defaultUnit);
  const lM = parseSingleLengthToMeters(match[2], defaultUnit);
  if (wM <= 0 || lM <= 0 || wM > 200 || lM > 200) return null;

  return {
    rawDimText,
    widthMeters: Number(wM.toFixed(2)),
    lengthMeters: Number(lM.toFixed(2)),
  };
}

export function isLikelyDimensionOrAreaText(text: string): boolean {
  const t = normalizeDimChars(text);
  if (!t) return true;
  if (parseDimensionPair(t)) return true;
  // Standalone numbers / area tags e.g. "15.20 SQM", "180 SQFT", "12'-6\"", "3600"
  if (/^[\d.\s'"-]+(?:m|m2|m²|sq\.?\s*m|sqmt|sq\.?\s*ft|sqft|ft|mm|cm)?$/i.test(t)) {
    return true;
  }
  return false;
}

function pointInPolygon(px: number, py: number, pts: FloorPlanPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInsideRoom(
  px: number,
  py: number,
  room: FloorPlanRoom,
  tolerancePx = 8
): boolean {
  // Rotate point back around room center
  const rad = (-room.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - room.cx;
  const dy = py - room.cy;
  const lx = room.cx + dx * cos - dy * sin;
  const ly = room.cy + dx * sin + dy * cos;

  if (room.shapeType === 'rect') {
    const hw = (room.widthPx || 0) / 2 + tolerancePx;
    const hh = (room.heightPx || 0) / 2 + tolerancePx;
    return Math.abs(lx - room.cx) <= hw && Math.abs(ly - room.cy) <= hh;
  }

  if (room.shapeType === 'circle') {
    const r = (room.radiusPx || 0) + tolerancePx;
    return Math.hypot(lx - room.cx, ly - room.cy) <= r;
  }

  if (room.shapeType === 'polygon' && room.points && room.points.length >= 3) {
    if (pointInPolygon(lx, ly, room.points)) return true;
    // Also check within tolerance of bounding box center edges
    return room.points.some((p) => Math.hypot(p.x - lx, p.y - ly) <= tolerancePx);
  }

  return false;
}

export function getRoomImageBoundingBox(
  room: FloorPlanRoom,
  paddingPx = 12
): { x: number; y: number; width: number; height: number } {
  const rad = (room.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  if (room.shapeType === 'circle') {
    const r = (room.radiusPx || 20) + paddingPx;
    return {
      x: room.cx - r,
      y: room.cy - r,
      width: r * 2,
      height: r * 2,
    };
  }

  let corners: FloorPlanPoint[] = [];
  if (room.shapeType === 'rect') {
    const hw = (room.widthPx || 40) / 2;
    const hh = (room.heightPx || 40) / 2;
    corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ].map((c) => ({
      x: room.cx + c.x * cos - c.y * sin,
      y: room.cy + c.x * sin + c.y * cos,
    }));
  } else {
    corners = (room.points || []).map((p) => {
      const dx = p.x - room.cx;
      const dy = p.y - room.cy;
      return {
        x: room.cx + dx * cos - dy * sin,
        y: room.cy + dx * sin + dy * cos,
      };
    });
  }

  if (corners.length === 0) {
    return { x: room.cx - 40, y: room.cy - 40, width: 80, height: 80 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }

  return {
    x: minX - paddingPx,
    y: minY - paddingPx,
    width: maxX - minX + paddingPx * 2,
    height: maxY - minY + paddingPx * 2,
  };
}

export interface ExtractedRoomLabelResult {
  roomName: string;
  printedDimensions: string;
  widthMeters: number;
  lengthMeters: number;
  rawText: string;
}

export function extractLabelFromPdfTexts(
  room: FloorPlanRoom,
  extractedTexts?: FloorPlanExtractedTextItem[]
): ExtractedRoomLabelResult | null {
  if (!extractedTexts || extractedTexts.length === 0) return null;

  const inside = extractedTexts.filter((item) => {
    const cx = item.x + item.width / 2;
    const cy = item.y - item.height / 2;
    return isPointInsideRoom(cx, cy, room, 10);
  });

  if (inside.length === 0) return null;

  // Sort top-to-bottom, left-to-right and merge close tokens on the same baseline
  const sorted = [...inside].sort((a, b) =>
    Math.abs(a.y - b.y) > 8 ? a.y - b.y : a.x - b.x
  );

  const lines: string[] = [];
  let curY = sorted[0].y;
  let curTokens: string[] = [];

  for (const item of sorted) {
    const t = item.text.trim();
    if (!t) continue;
    if (Math.abs(item.y - curY) > 10) {
      if (curTokens.length > 0) lines.push(curTokens.join(' '));
      curTokens = [t];
      curY = item.y;
    } else {
      curTokens.push(t);
    }
  }
  if (curTokens.length > 0) lines.push(curTokens.join(' '));

  const rawText = lines.join(' | ');
  let printedDimensions = '';
  let widthMeters = 0;
  let lengthMeters = 0;
  const labelParts: string[] = [];

  for (const line of lines) {
    const parsedDim = parseDimensionPair(line);
    if (parsedDim) {
      if (!printedDimensions) {
        printedDimensions = parsedDim.rawDimText;
        widthMeters = parsedDim.widthMeters;
        lengthMeters = parsedDim.lengthMeters;
      }
      // Keep non-dimension prefix if line contains both e.g. "BEDROOM 12'-0\" x 14'-0\""
      const stripped = line.replace(parsedDim.rawDimText, '').replace(/[()[\]]/g, '').trim();
      if (stripped && !isLikelyDimensionOrAreaText(stripped)) {
        labelParts.push(stripped);
      }
    } else if (!isLikelyDimensionOrAreaText(line)) {
      labelParts.push(line);
    }
  }

  const roomName = labelParts.join(' ').replace(/\s+/g, ' ').trim();
  if (!roomName && !printedDimensions) return null;

  return {
    roomName,
    printedDimensions,
    widthMeters,
    lengthMeters,
    rawText,
  };
}

export interface DetectedPdfRoomCluster {
  roomName: string;
  printedDimensions: string;
  widthMeters: number;
  lengthMeters: number;
  cx: number;
  cy: number;
}

/**
 * Offline CAD PDF Room & Dimension Auto-Scanner:
 * Scans embedded text items from vector PDFs to locate room titles + adjacent dimension labels.
 */
export function detectRoomsFromPdfTextLayer(
  extractedTexts: FloorPlanExtractedTextItem[],
  sheetWidth: number,
  sheetHeight: number
): DetectedPdfRoomCluster[] {
  if (!extractedTexts || extractedTexts.length === 0) return [];

  // Group horizontally aligned tokens on same baseline using token endX gap
  const lineYTol = Math.max(7, sheetHeight * 0.005);
  const maxGapX = Math.max(48, sheetWidth * 0.045);

  const sorted = [...extractedTexts]
    .filter((t) => t.text.trim().length > 0)
    .sort((a, b) => (Math.abs(a.y - b.y) > lineYTol ? a.y - b.y : a.x - b.x));

  interface TextLine {
    text: string;
    x: number;
    endX: number;
    y: number;
    cx: number;
  }

  const lines: TextLine[] = [];
  for (const item of sorted) {
    const t = item.text.trim();
    const w = Math.max(8, item.width || t.length * 6);
    const prev = lines[lines.length - 1];
    if (
      prev &&
      Math.abs(prev.y - item.y) <= lineYTol &&
      item.x - prev.endX >= -12 &&
      item.x - prev.endX <= maxGapX
    ) {
      prev.text = `${prev.text} ${t}`.replace(/\s+/g, ' ');
      prev.endX = Math.max(prev.endX, item.x + w);
      prev.cx = (prev.x + prev.endX) / 2;
    } else {
      lines.push({
        text: t,
        x: item.x,
        endX: item.x + w,
        y: item.y,
        cx: item.x + w / 2,
      });
    }
  }

  // Room label keywords (architectural & MEP spaces)
  const roomKeywords =
    /\b(rm|room|bedroom|bed|living|drawing|dining|kitchen|toilet|wc|bath|washroom|lobby|foyer|corridor|passage|hall|office|cabin|conference|meeting|stair|lift|balcony|terrace|store|pantry|utility|server|electrical|ahu|ups|mdf|idf|dg|pump|chiller|lab|ward|icu|opd|ot|reception|waiting|study|garage|verandah|pooja|closet|dress|workstation|lounge|bar|cafeteria|canteen|gym|clinic|studio|shop)\b/i;

  const usedIdx = new Set<number>();
  const results: DetectedPdfRoomCluster[] = [];
  const maxHorizPairDist = Math.max(120, sheetWidth * 0.08);
  const maxVertPairBelow = Math.max(70, sheetHeight * 0.06);

  for (let i = 0; i < lines.length; i++) {
    if (usedIdx.has(i)) continue;
    const line = lines[i];
    if (line.cx > sheetWidth * 0.94 || line.y > sheetHeight * 0.94) continue;
    if (isLikelyDimensionOrAreaText(line.text)) continue;

    // Look for a nearby dimension line right below or above
    let matchedDim: ParsedDimensionResult | null = parseDimensionPair(line.text);
    let cleanTitle = line.text;
    if (matchedDim) {
      cleanTitle = line.text.replace(matchedDim.rawDimText, '').replace(/[()[\]]/g, '').trim();
    }

    if (!matchedDim) {
      let bestDist = Infinity;
      let bestJ = -1;
      for (let j = 0; j < lines.length; j++) {
        if (i === j || usedIdx.has(j)) continue;
        const cand = lines[j];
        if (
          Math.abs(cand.cx - line.cx) <= maxHorizPairDist &&
          cand.y >= line.y - 26 &&
          cand.y <= line.y + maxVertPairBelow
        ) {
          const parsed = parseDimensionPair(cand.text);
          if (parsed) {
            const d = Math.hypot(cand.cx - line.cx, cand.y - line.y);
            if (d < bestDist) {
              bestDist = d;
              bestJ = j;
              matchedDim = parsed;
            }
          }
        }
      }
      if (bestJ >= 0) usedIdx.add(bestJ);
    }

    // Accept if it matches a room keyword OR has an adjacent architectural dimension pair
    const isRoom =
      roomKeywords.test(cleanTitle) ||
      (matchedDim !== null && cleanTitle.length >= 2 && cleanTitle.length <= 42 && /[a-zA-Z]{2,}/.test(cleanTitle));

    if (!isRoom || !cleanTitle) continue;
    usedIdx.add(i);

    results.push({
      roomName: cleanTitle,
      printedDimensions: matchedDim?.rawDimText || '',
      widthMeters: matchedDim?.widthMeters || 0,
      lengthMeters: matchedDim?.lengthMeters || 0,
      cx: line.cx,
      cy: line.y,
    });
  }

  return results;
}
