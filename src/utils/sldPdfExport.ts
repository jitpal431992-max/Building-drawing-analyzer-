import type { jsPDF } from 'jspdf';
import {
  SldDocument,
  SldLineStyle,
  SldNode,
  SldNodeCategory,
  computeEdgeTrunkRatios,
  computeGroupBounds,
  computeOrthogonalPath,
  getNodePortPoint,
} from './sldGenerator';

type RgbTuple = [number, number, number];

interface CadPalette {
  bg: RgbTuple;
  frame: RgbTuple;
  grid: RgbTuple;
  textPrimary: RgbTuple;
  textMuted: RgbTuple;
  boxFill: RgbTuple;
  headerText: RgbTuple;
  titleBg: RgbTuple;
  lineMain: RgbTuple;
  lineRaw: RgbTuple;
  lineEmg: RgbTuple;
  lineCustom: RgbTuple;
  categoryColors: Record<SldNodeCategory, RgbTuple>;
}

const CAD_DARK_PALETTE: CadPalette = {
  bg: [11, 15, 20],
  frame: [148, 163, 184],
  grid: [24, 33, 45],
  textPrimary: [241, 245, 249],
  textMuted: [148, 163, 184],
  boxFill: [15, 23, 34],
  headerText: [11, 15, 20],
  titleBg: [16, 22, 32],
  lineMain: [226, 232, 240],
  lineRaw: [52, 211, 153],
  lineEmg: [251, 191, 36],
  lineCustom: [96, 165, 250],
  categoryColors: {
    'Utility Mains': [226, 232, 240],
    'DG Backup': [251, 146, 60],
    'Main Switch': [248, 250, 252],
    'Changeover Switch': [192, 132, 252],
    'Busbar Chamber': [56, 189, 248],
    'Emergency VTPNDB': [251, 146, 60],
    'Raw VTPNDB': [52, 211, 153],
    'Emergency PDB': [251, 191, 36],
    'Raw PDB': [56, 189, 248],
    LDB: [34, 211, 238],
  },
};

const CAD_LIGHT_PALETTE: CadPalette = {
  bg: [255, 255, 255],
  frame: [15, 23, 42],
  grid: [236, 240, 245],
  textPrimary: [15, 23, 42],
  textMuted: [71, 85, 105],
  boxFill: [255, 255, 255],
  headerText: [255, 255, 255],
  titleBg: [248, 250, 252],
  lineMain: [15, 23, 42],
  lineRaw: [4, 120, 87],
  lineEmg: [180, 83, 9],
  lineCustom: [29, 78, 216],
  categoryColors: {
    'Utility Mains': [30, 41, 59],
    'DG Backup': [194, 65, 12],
    'Main Switch': [15, 23, 42],
    'Changeover Switch': [109, 40, 217],
    'Busbar Chamber': [3, 105, 161],
    'Emergency VTPNDB': [194, 65, 12],
    'Raw VTPNDB': [4, 120, 87],
    'Emergency PDB': [180, 83, 9],
    'Raw PDB': [3, 105, 161],
    LDB: [14, 116, 144],
  },
};

function getLineRgb(style: SldLineStyle, pal: CadPalette): RgbTuple {
  switch (style) {
    case 'main':
      return pal.lineMain;
    case 'raw':
      return pal.lineRaw;
    case 'emergency':
      return pal.lineEmg;
    case 'custom':
      return pal.lineCustom;
  }
}

function drawVectorSymbol(
  pdf: jsPDF,
  node: SldNode,
  sx: (x: number) => number,
  sy: (y: number) => number,
  scale: number,
  strokeRgb: RgbTuple
) {
  pdf.setDrawColor(...strokeRgb);
  pdf.setLineWidth(0.35);

  const symCx = sx(node.x + node.width - 28);
  const symCy = sy(node.y + 52);
  const r = 6.5 * scale;

  if (node.kind === 'source') {
    // AC / DG Circle symbol
    pdf.circle(symCx, symCy, r * 1.4, 'S');
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(Math.max(5.5, 8 * scale));
    pdf.setTextColor(...strokeRgb);
    pdf.text(node.category === 'DG Backup' ? 'DG' : '~', symCx, symCy + 1, {
      align: 'center',
      baseline: 'middle',
    });
    return;
  }

  if (node.kind === 'main-switch') {
    // IEC Single-line Isolator / Switch open-blade symbol
    const topY = symCy - 7 * scale;
    const botY = symCy + 7 * scale;
    pdf.line(symCx, topY - 4 * scale, symCx, topY);
    pdf.circle(symCx, topY, 1.3 * scale, 'S');
    pdf.line(symCx, botY, symCx - 5 * scale, topY + 1 * scale);
    pdf.circle(symCx, botY, 1.3 * scale, 'S');
    pdf.line(symCx, botY, symCx, botY + 4 * scale);
    return;
  }

  if (node.kind === 'changeover-switch') {
    // Dual-supply Changeover Switch symbol
    const topY = symCy - 7 * scale;
    const botY = symCy + 8 * scale;
    pdf.circle(symCx - 5 * scale, topY, 1.3 * scale, 'S');
    pdf.circle(symCx + 5 * scale, topY, 1.3 * scale, 'S');
    pdf.circle(symCx, botY, 1.4 * scale, 'S');
    pdf.line(symCx, botY, symCx - 4.5 * scale, topY + 1 * scale);
    pdf.setLineDashPattern([1.2, 1.2], 0);
    pdf.line(symCx, botY, symCx + 4.5 * scale, topY + 1 * scale);
    pdf.setLineDashPattern([], 0);
    return;
  }

  if (node.kind === 'busbar-chamber') {
    // Heavy copper busbar chamber symbol (double parallel busbars + incoming/outgoing stubs)
    const busY = symCy - 2 * scale;
    pdf.setLineWidth(0.75);
    pdf.line(symCx - 16 * scale, busY - 2 * scale, symCx + 16 * scale, busY - 2 * scale);
    pdf.line(symCx - 16 * scale, busY + 2 * scale, symCx + 16 * scale, busY + 2 * scale);
    pdf.setLineWidth(0.32);
    pdf.line(symCx, busY - 8 * scale, symCx, busY - 2 * scale);
    pdf.line(symCx - 10 * scale, busY + 2 * scale, symCx - 10 * scale, busY + 8 * scale);
    pdf.line(symCx + 10 * scale, busY + 2 * scale, symCx + 10 * scale, busY + 8 * scale);
    return;
  }

  // DB internal busbar + outgoing feeder ticks
  const busY = symCy - 4 * scale;
  pdf.setLineWidth(0.55);
  pdf.line(symCx - 12 * scale, busY, symCx + 12 * scale, busY);
  pdf.setLineWidth(0.3);
  // Incoming tick
  pdf.line(symCx, busY - 6 * scale, symCx, busY);
  // 3 outgoing feeder ticks
  [-8, 0, 8].forEach((dx) => {
    pdf.line(symCx + dx * scale, busY, symCx + dx * scale, busY + 7 * scale);
  });
}

export async function exportSldToPdf(
  docData: SldDocument,
  cadMode: 'dark' | 'light' = 'light'
): Promise<string> {
  const { jsPDF } = await import('jspdf');
  // A3 Landscape (420mm x 297mm) gives spacious room for CAD schematic readability
  const pageW = 420;
  const pageH = 297;
  const margin = 10;
  const frameW = pageW - margin * 2;
  const frameH = pageH - margin * 2;
  const titleBlockH = 26;
  const drawAreaH = frameH - titleBlockH - 4;
  const drawAreaW = frameW - 6;

  const pal = cadMode === 'dark' ? CAD_DARK_PALETTE : CAD_LIGHT_PALETTE;
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
    compress: true,
  });

  // Page Background
  pdf.setFillColor(...pal.bg);
  pdf.rect(0, 0, pageW, pageH, 'F');

  // Compute bounding box of schematic nodes & free points
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of docData.nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const e of docData.edges) {
    if (e.freeStart) {
      minX = Math.min(minX, e.freeStart.x);
      minY = Math.min(minY, e.freeStart.y);
      maxX = Math.max(maxX, e.freeStart.x);
      maxY = Math.max(maxY, e.freeStart.y);
    }
    if (e.freeEnd) {
      minX = Math.min(minX, e.freeEnd.x);
      minY = Math.min(minY, e.freeEnd.y);
      maxX = Math.max(maxX, e.freeEnd.x);
      maxY = Math.max(maxY, e.freeEnd.y);
    }
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = docData.canvasWidth;
    maxY = docData.canvasHeight;
  }

  const contentW = Math.max(400, maxX - minX + 80);
  const contentH = Math.max(300, maxY - minY + 80);
  const scale = Math.min(drawAreaW / contentW, drawAreaH / contentH);
  const offsetX = margin + 3 + (drawAreaW - contentW * scale) / 2 - (minX - 40) * scale;
  const offsetY = margin + 3 + (drawAreaH - contentH * scale) / 2 - (minY - 40) * scale;

  const sx = (x: number) => offsetX + x * scale;
  const sy = (y: number) => offsetY + y * scale;

  // Subtle CAD reference grid inside drawing border
  pdf.setDrawColor(...pal.grid);
  pdf.setLineWidth(0.15);
  for (let gx = margin + 15; gx < pageW - margin; gx += 15) {
    pdf.line(gx, margin, gx, margin + drawAreaH);
  }
  for (let gy = margin + 15; gy < margin + drawAreaH; gy += 15) {
    pdf.line(margin, gy, pageW - margin, gy);
  }

  // CAD Outer Double Border Frame
  pdf.setDrawColor(...pal.frame);
  pdf.setLineWidth(0.55);
  pdf.rect(margin, margin, frameW, frameH);
  pdf.setLineWidth(0.22);
  pdf.rect(margin + 1.5, margin + 1.5, frameW - 3, frameH - 3);

  // Draw Group Enclosures (e.g. L.T. PANEL) behind lines and blocks
  const nodeMap = new Map(docData.nodes.map((n) => [n.id, n]));
  for (const grp of docData.groups || []) {
    const bounds = computeGroupBounds(grp, nodeMap);
    if (!bounds) continue;
    const gx = sx(bounds.x);
    const gy = sy(bounds.y);
    const gw = bounds.width * scale;
    const gh = bounds.height * scale;
    const grpRgb: RgbTuple = cadMode === 'dark' ? [56, 189, 248] : [3, 105, 161];

    pdf.setDrawColor(...grpRgb);
    pdf.setLineWidth(0.45);
    pdf.setLineDashPattern([2.5, 1.8], 0);
    pdf.rect(gx, gy, gw, gh);
    pdf.setLineDashPattern([], 0);

    // Group label tab
    const tabW = Math.max(24, grp.label.length * 2.1 + 6);
    const tabH = Math.max(4.5, 16 * scale);
    pdf.setFillColor(...grpRgb);
    pdf.rect(gx, gy, tabW, tabH, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(Math.max(5.5, Math.min(8, 8.5 * scale)));
    pdf.setTextColor(...pal.headerText);
    pdf.text(grp.label.toUpperCase(), gx + 2, gy + tabH * 0.68);
  }

  // Draw Orthogonal Feeder Lines
  const trunkRatios = computeEdgeTrunkRatios(docData.edges, nodeMap);
  docData.edges.forEach((edge) => {
    const pts = computeOrthogonalPath(edge, nodeMap, trunkRatios.get(edge.id) ?? 0.5);
    if (pts.length < 2) return;

    const lineRgb = getLineRgb(edge.lineStyle, pal);
    pdf.setDrawColor(...lineRgb);
    pdf.setLineWidth(edge.lineStyle === 'main' ? 0.55 : 0.38);

    if (edge.lineStyle === 'emergency') {
      pdf.setLineDashPattern([2.4, 1.4], 0);
    } else if (edge.lineStyle === 'custom') {
      pdf.setLineDashPattern([1.2, 1.2], 0);
    } else {
      pdf.setLineDashPattern([], 0);
    }

    for (let i = 0; i < pts.length - 1; i++) {
      pdf.line(sx(pts[i].x), sy(pts[i].y), sx(pts[i + 1].x), sy(pts[i + 1].y));
    }
    pdf.setLineDashPattern([], 0);

    // Junction dots at endpoints
    pdf.setFillColor(...lineRgb);
    const pFirst = pts[0];
    const pLast = pts[pts.length - 1];
    pdf.circle(sx(pFirst.x), sy(pFirst.y), 0.75, 'F');
    pdf.circle(sx(pLast.x), sy(pLast.y), 0.75, 'F');

    // Cable label near midpoint of longest segment
    if (edge.cableLabel) {
      const midIdx = Math.floor(pts.length / 2);
      const a = pts[Math.max(0, midIdx - 1)];
      const b = pts[midIdx];
      const lx = sx((a.x + b.x) / 2);
      const ly = sy((a.y + b.y) / 2) - 1.2;
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(Math.max(4.8, Math.min(7, 8 * scale)));
      pdf.setTextColor(...lineRgb);
      pdf.text(edge.cableLabel, lx, ly, { align: 'center' });
    }
  });

  // Draw All DB, Busbar Chamber, Main Switch, Changeover Switch, and Source Nodes
  for (const node of docData.nodes) {
    const catRgb = pal.categoryColors[node.category] || pal.frame;
    const bx = sx(node.x);
    const by = sy(node.y);
    const bw = node.width * scale;
    const bh = node.height * scale;
    const headerH = Math.max(4.5, 22 * scale);

    // Outer CAD rectangle
    pdf.setFillColor(...pal.boxFill);
    pdf.setDrawColor(...catRgb);
    pdf.setLineWidth(
      node.kind === 'main-switch' ||
        node.kind === 'changeover-switch' ||
        node.kind === 'busbar-chamber'
        ? 0.55
        : 0.4
    );
    pdf.rect(bx, by, bw, bh, 'FD');

    // Category Header Strip
    pdf.setFillColor(...catRgb);
    pdf.rect(bx, by, bw, headerH, 'F');

    // Category Label inside Header Strip
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(Math.max(5.5, Math.min(8.5, 9.5 * scale)));
    pdf.setTextColor(...pal.headerText);
    pdf.text(node.category.toUpperCase(), bx + 2, by + headerH * 0.65);

    if (node.kind === 'db') {
      // Display Floor Level, DB Size, and Spare Number inside DB box (Category is in header)
      const bodyLeft = bx + 2.4;
      const maxTextW = Math.max(12, bw - 14 * scale);
      const lineStep = Math.max(3.1, 13 * scale);
      let cursorY = by + headerH + Math.max(3.6, 13 * scale);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(Math.max(5.5, Math.min(8.5, 9.5 * scale)));
      pdf.setTextColor(...pal.textPrimary);
      pdf.text((node.floorName || node.scope).slice(0, 22), bodyLeft, cursorY, {
        maxWidth: maxTextW,
      });
      cursorY += lineStep;

      pdf.setFont('courier', 'normal');
      pdf.setFontSize(Math.max(4.8, Math.min(7.5, 8.5 * scale)));
      pdf.setTextColor(...pal.textMuted);
      pdf.text(node.sizeCode.slice(0, 22), bodyLeft, cursorY, { maxWidth: maxTextW });
      cursorY += lineStep;

      pdf.setFont('courier', 'bold');
      pdf.setFontSize(Math.max(5.8, Math.min(9, 10 * scale)));
      pdf.setTextColor(...catRgb);
      pdf.text(`SPARE: ${node.spareCount ?? 0}`, bodyLeft, cursorY, { maxWidth: maxTextW });
    } else {
      // Code tag right-aligned in header strip for switches, busbar, and sources
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(Math.max(5, Math.min(8, 8.5 * scale)));
      pdf.text(node.code, bx + bw - 2, by + headerH * 0.65, { align: 'right' });

      const bodyLeft = bx + 2.2;
      const maxTextW = Math.max(12, bw - 14 * scale);
      let cursorY = by + headerH + Math.max(3.5, 13 * scale);
      const lineStep = Math.max(3.2, 12.5 * scale);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(Math.max(5.5, Math.min(8.5, 9.5 * scale)));
      pdf.setTextColor(...pal.textPrimary);
      pdf.text(node.scope || node.title, bodyLeft, cursorY, { maxWidth: maxTextW });
      cursorY += lineStep;

      pdf.setFont('courier', 'normal');
      pdf.setFontSize(Math.max(4.8, Math.min(7.5, 8.2 * scale)));
      pdf.setTextColor(...pal.textMuted);
      pdf.text(`${node.sizeCode} · ${node.incomingType}`, bodyLeft, cursorY, { maxWidth: maxTextW });
      cursorY += lineStep;

      pdf.setFont('courier', 'bold');
      pdf.setTextColor(...catRgb);
      pdf.text(node.ratingText, bodyLeft, cursorY, { maxWidth: maxTextW });
    }

    // Internal IEC CAD Symbol
    drawVectorSymbol(pdf, node, sx, sy, scale, catRgb);

    // Separate outgoing terminal nodes along bottom edge (for Busbar Chamber and DBs)
    if (node.outgoingNodes && node.outgoingNodes.length > 0) {
      node.outgoingNodes.forEach((og) => {
        const pt = getNodePortPoint(node, `out-${og.id}`);
        const px = sx(pt.x);
        const py = sy(pt.y);
        pdf.setFillColor(...pal.boxFill);
        pdf.setDrawColor(...catRgb);
        pdf.setLineWidth(0.35);
        pdf.circle(px, py, Math.max(0.85, 2.8 * scale), 'FD');
        pdf.setFont('courier', 'bold');
        pdf.setFontSize(Math.max(4, Math.min(6, 6.8 * scale)));
        pdf.setTextColor(...pal.textMuted);
        pdf.text(og.label, px, py - Math.max(1.5, 5 * scale), { align: 'center' });
      });
    }
  }

  // Bottom Title Block & Legend Strip (AutoCAD Engineering Border Footer)
  const footerY = margin + frameH - titleBlockH;
  pdf.setFillColor(...pal.titleBg);
  pdf.setDrawColor(...pal.frame);
  pdf.setLineWidth(0.4);
  pdf.rect(margin + 1.5, footerY, frameW - 3, titleBlockH - 1.5, 'FD');

  // Left section: Layer & Symbol Legend
  const legendW = 225;
  pdf.line(margin + 1.5 + legendW, footerY, margin + 1.5 + legendW, margin + frameH - 1.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...pal.textPrimary);
  pdf.text('CAD LAYER & FEEDER LEGEND (DISTRIBUTION BOARDS ONLY)', margin + 4.5, footerY + 5.5);

  const legendItems: { label: string; color: RgbTuple }[] = [
    { label: 'Main Switch', color: pal.categoryColors['Main Switch'] },
    { label: 'Busbar Chamber', color: pal.categoryColors['Busbar Chamber'] },
    { label: 'Changeover Switch', color: pal.categoryColors['Changeover Switch'] },
    { label: 'Emergency VTPNDB', color: pal.categoryColors['Emergency VTPNDB'] },
    { label: 'Raw VTPNDB', color: pal.categoryColors['Raw VTPNDB'] },
    { label: 'Emergency PDB', color: pal.categoryColors['Emergency PDB'] },
    { label: 'Raw PDB', color: pal.categoryColors['Raw PDB'] },
    { label: 'LDB (2P)', color: pal.categoryColors['LDB'] },
  ];

  legendItems.forEach((lg, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const lx = margin + 4.5 + col * 54;
    const ly = footerY + 11.5 + row * 6.5;
    pdf.setFillColor(...lg.color);
    pdf.rect(lx, ly - 2.8, 3.8, 3.2, 'F');
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(6.8);
    pdf.setTextColor(...pal.textPrimary);
    pdf.text(lg.label, lx + 5.2, ly - 0.3);
  });

  // Right section: AutoCAD Title Block
  const tbX = margin + 1.5 + legendW;
  const tbW = frameW - 3 - legendW;
  pdf.line(tbX, footerY + 9, tbX + tbW, footerY + 9);
  pdf.line(tbX, footerY + 17, tbX + tbW, footerY + 17);
  pdf.line(tbX + tbW * 0.55, footerY + 9, tbX + tbW * 0.55, margin + frameH - 1.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...pal.textPrimary);
  pdf.text('CPWD DSR (E&M) 2025 · SINGLE LINE DIAGRAM (SLD)', tbX + 3, footerY + 5.8);

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...pal.textMuted);
  const dbCount = docData.nodes.filter((n) => n.kind === 'db').length;
  const swCount = docData.nodes.filter(
    (n) => n.kind === 'main-switch' || n.kind === 'changeover-switch'
  ).length;
  pdf.text(`TOTAL DBs: ${dbCount}  |  SWITCHES: ${swCount}`, tbX + 3, footerY + 14.2);
  pdf.text(`SPARE CAPACITY: ${docData.sparePercent}%`, tbX + tbW * 0.55 + 3, footerY + 14.2);

  const dateStr = new Date().toLocaleDateString('en-IN');
  pdf.text(`DWG NO: E-SLD-001 (CAD PLOT)`, tbX + 3, footerY + 22);
  pdf.text(`DATE: ${dateStr}  |  SCALE: NTS`, tbX + tbW * 0.55 + 3, footerY + 22);

  const fileName = `CPWD_DSR_SLD_${Date.now()}.pdf`;
  pdf.save(fileName);
  return fileName;
}
