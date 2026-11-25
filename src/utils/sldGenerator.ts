import {
  CategoryBoqTotal,
  DbCapacityOption,
  DbCategoryType,
  FloorDbSummary,
  FloorDbTableEntry,
  LDB_CAPACITIES,
  McbDbCalculationResult,
  McbDbSettings,
  PDB_CAPACITIES,
  VTPNDB_CAPACITIES,
} from '../data/mcbDbCalculator';

export type SldPortSide = 'top' | 'bottom' | 'left' | 'right' | `out-${string}`;

export type SldNodeKind =
  | 'source'
  | 'main-switch'
  | 'changeover-switch'
  | 'busbar-chamber'
  | 'db';

export type SldNodeCategory =
  | 'Utility Mains'
  | 'DG Backup'
  | 'Main Switch'
  | 'Changeover Switch'
  | 'Busbar Chamber'
  | Exclude<DbCategoryType, 'Switch Board'>;

export type SldLineStyle = 'main' | 'raw' | 'emergency' | 'custom';

export interface SldPoint {
  x: number;
  y: number;
}

export interface SldOutgoingNode {
  id: string;
  label: string;
}

export interface SldNode {
  id: string;
  kind: SldNodeKind;
  category: SldNodeCategory;
  code: string;
  title: string;
  scope: string;
  floorName?: string;
  sizeCode: string;
  incomingType: string;
  waysLabel: string;
  ratingText: string;
  capacityWays?: number;
  baseCapacityWays?: number;
  directUsedWays?: number;
  usedWays?: number;
  spareCount?: number;
  outgoingNodes?: SldOutgoingNode[];
  x: number;
  y: number;
  width: number;
  height: number;
  isCommon?: boolean;
  isManual?: boolean;
}

export interface SldGroup {
  id: string;
  label: string;
  nodeIds: string[];
  color?: string;
  isManual?: boolean;
}

export interface SldEdge {
  id: string;
  fromNodeId?: string;
  fromPort?: SldPortSide;
  toNodeId?: string;
  toPort?: SldPortSide;
  freeStart?: SldPoint;
  freeEnd?: SldPoint;
  waypoints?: SldPoint[];
  lineStyle: SldLineStyle;
  cableLabel: string;
  isManual?: boolean;
}

export interface SldDocument {
  version: number;
  generatedAt: string;
  sparePercent: number;
  scheduleSignature?: string;
  nodes: SldNode[];
  edges: SldEdge[];
  groups: SldGroup[];
  canvasWidth: number;
  canvasHeight: number;
}

export const GRID_SIZE = 20;

export function snapToGrid(val: number, gridSize = GRID_SIZE): number {
  return Math.round(val / gridSize) * gridSize;
}

export function isBottomLikePort(port?: SldPortSide): boolean {
  return !port || port === 'bottom' || port.startsWith('out-');
}

export function getNodePortPoint(node: SldNode, port: SldPortSide): SldPoint {
  if (port.startsWith('out-')) {
    const outList = node.outgoingNodes || [];
    const targetId = port.slice(4);
    const idx = outList.findIndex((o) => o.id === targetId);
    if (idx >= 0 && outList.length > 0) {
      return {
        x: Math.round(node.x + ((idx + 1) / (outList.length + 1)) * node.width),
        y: node.y + node.height,
      };
    }
    return { x: node.x + node.width / 2, y: node.y + node.height };
  }

  switch (port) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y };
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 };
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 };
    default:
      return { x: node.x + node.width / 2, y: node.y + node.height };
  }
}

export function getAllNodePorts(
  node: SldNode
): { port: SldPortSide; label?: string; point: SldPoint }[] {
  const result: { port: SldPortSide; label?: string; point: SldPoint }[] = [
    { port: 'top', point: getNodePortPoint(node, 'top') },
    { port: 'left', point: getNodePortPoint(node, 'left') },
    { port: 'right', point: getNodePortPoint(node, 'right') },
  ];
  if (node.outgoingNodes && node.outgoingNodes.length > 0) {
    for (const og of node.outgoingNodes) {
      const p: SldPortSide = `out-${og.id}`;
      result.push({ port: p, label: og.label, point: getNodePortPoint(node, p) });
    }
  } else {
    result.push({ port: 'bottom', point: getNodePortPoint(node, 'bottom') });
  }
  return result;
}

export function simplifyOrthogonalPoints(pts: SldPoint[]): SldPoint[] {
  if (pts.length <= 2) return pts;
  const deduped: SldPoint[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = deduped[deduped.length - 1];
    if (Math.abs(pts[i].x - prev.x) >= 0.5 || Math.abs(pts[i].y - prev.y) >= 0.5) {
      deduped.push(pts[i]);
    }
  }
  if (deduped.length <= 2) return deduped;

  const cleaned: SldPoint[] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = cleaned[cleaned.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];
    const sameX = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5;
    const sameY = Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5;
    if (!sameX && !sameY) {
      cleaned.push(b);
    }
  }
  cleaned.push(deduped[deduped.length - 1]);
  return cleaned;
}

function segmentHitsBox(
  a: SldPoint,
  b: SldPoint,
  box: { x: number; y: number; width: number; height: number },
  pad = 8
): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const bx1 = box.x - pad;
  const by1 = box.y - pad;
  const bx2 = box.x + box.width + pad;
  const by2 = box.y + box.height + pad;
  return maxX > bx1 && minX < bx2 && maxY > by1 && minY < by2;
}

function pathHitsAnyNode(
  pts: SldPoint[],
  nodes: SldNode[],
  ignoreIds: Set<string>
): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (const n of nodes) {
      if (ignoreIds.has(n.id)) continue;
      if (segmentHitsBox(a, b, n, 6)) return true;
    }
  }
  return false;
}

function findClearVerticalChannelX(
  preferredX: number,
  y1: number,
  y2: number,
  nodes: SldNode[],
  ignoreIds: Set<string>
): number {
  const candidates: number[] = [preferredX];
  for (const n of nodes) {
    if (ignoreIds.has(n.id)) continue;
    const ny1 = n.y - 8;
    const ny2 = n.y + n.height + 8;
    if (Math.max(y1, y2) > ny1 && Math.min(y1, y2) < ny2) {
      candidates.push(snapToGrid(n.x - 20, 10));
      candidates.push(snapToGrid(n.x + n.width + 20, 10));
    }
  }
  const unique = Array.from(new Set(candidates)).sort(
    (a, b) => Math.abs(a - preferredX) - Math.abs(b - preferredX)
  );
  for (const cx of unique) {
    const hits = nodes.some((n) => {
      if (ignoreIds.has(n.id)) return false;
      return segmentHitsBox({ x: cx, y: y1 }, { x: cx, y: y2 }, n, 6);
    });
    if (!hits) return cx;
  }
  return preferredX;
}

/**
 * Compute per-edge trunk ratios grouped by shared inter-row vertical band
 * so parallel horizontal feeders are evenly staggered rather than overlapping.
 */
export function computeEdgeTrunkRatios(
  edges: SldEdge[],
  nodeMap: Map<string, SldNode>
): Map<string, number> {
  const buckets = new Map<string, SldEdge[]>();
  for (const e of edges) {
    const sn = e.fromNodeId ? nodeMap.get(e.fromNodeId) : undefined;
    const en = e.toNodeId ? nodeMap.get(e.toNodeId) : undefined;
    const sy = sn && e.fromPort ? getNodePortPoint(sn, e.fromPort).y : e.freeStart?.y ?? 0;
    const ey = en && e.toPort ? getNodePortPoint(en, e.toPort).y : e.freeEnd?.y ?? 0;
    const bucketKey = `${Math.round(Math.min(sy, ey) / 60)}_${Math.round(Math.max(sy, ey) / 60)}`;
    const list = buckets.get(bucketKey) || [];
    list.push(e);
    buckets.set(bucketKey, list);
  }

  const ratios = new Map<string, number>();
  for (const list of buckets.values()) {
    list.forEach((e, idx) => {
      if (list.length === 1) {
        ratios.set(e.id, 0.5);
      } else {
        const t = idx / (list.length - 1);
        ratios.set(e.id, 0.24 + t * 0.52);
      }
    });
  }
  return ratios;
}

/**
 * Compute crisp AutoCAD-style orthogonal (90-degree) polyline points for an edge.
 * Avoids passing through intermediate boxes or same-row siblings automatically.
 */
export function computeOrthogonalPath(
  edge: SldEdge,
  nodeMap: Map<string, SldNode>,
  trunkRatio = 0.5
): SldPoint[] {
  const startNode = edge.fromNodeId ? nodeMap.get(edge.fromNodeId) : undefined;
  const endNode = edge.toNodeId ? nodeMap.get(edge.toNodeId) : undefined;

  const start: SldPoint | null =
    startNode && edge.fromPort
      ? getNodePortPoint(startNode, edge.fromPort)
      : edge.freeStart || null;

  const end: SldPoint | null =
    endNode && edge.toPort
      ? getNodePortPoint(endNode, edge.toPort)
      : edge.freeEnd || null;

  if (!start || !end) return [];

  // If user manually added waypoints, connect cleanly through them orthogonally
  if (edge.waypoints && edge.waypoints.length > 0) {
    const rawPts = [start, ...edge.waypoints, end];
    const ortho: SldPoint[] = [rawPts[0]];
    for (let i = 1; i < rawPts.length; i++) {
      const prev = ortho[ortho.length - 1];
      const next = rawPts[i];
      if (Math.abs(prev.x - next.x) >= 0.5 && Math.abs(prev.y - next.y) >= 0.5) {
        if (i === 1 && (edge.fromPort === 'left' || edge.fromPort === 'right')) {
          ortho.push({ x: next.x, y: prev.y });
        } else if (
          i === rawPts.length - 1 &&
          (edge.toPort === 'left' || edge.toPort === 'right')
        ) {
          ortho.push({ x: prev.x, y: next.y });
        } else if (i === 1) {
          ortho.push({ x: prev.x, y: next.y });
        } else {
          ortho.push({ x: next.x, y: prev.y });
        }
      }
      ortho.push(next);
    }
    return simplifyOrthogonalPoints(ortho);
  }

  const allNodes = Array.from(nodeMap.values());
  const ignoreIds = new Set<string>();
  if (startNode) ignoreIds.add(startNode.id);
  if (endNode) ignoreIds.add(endNode.id);

  // Straight alignment (verify no box lies strictly between endpoints)
  if (Math.abs(start.x - end.x) < 1 || Math.abs(start.y - end.y) < 1) {
    const direct = [start, end];
    if (!pathHitsAnyNode(direct, allNodes, ignoreIds)) {
      return direct;
    }
  }

  const fromVert = edge.fromPort === 'top' || isBottomLikePort(edge.fromPort);
  const toVert = edge.toPort === 'top' || isBottomLikePort(edge.toPort);

  if (fromVert && toVert) {
    const laneOffset = Math.round((trunkRatio - 0.5) * 40);

    // Same-row or upward connection from bottom outgoing port to top incoming port:
    // drop into channel below startNode, pass through guaranteed column gap beside endNode, drop into top.
    if (
      startNode &&
      endNode &&
      startNode.id !== endNode.id &&
      isBottomLikePort(edge.fromPort) &&
      edge.toPort === 'top' &&
      start.y >= end.y - 4
    ) {
      const underY = snapToGrid(
        Math.max(startNode.y + startNode.height, endNode.y + endNode.height) + 26 + laneOffset,
        10
      );
      const aboveY = snapToGrid(endNode.y - 24 - laneOffset, 10);
      const preferredGapX =
        start.x <= end.x
          ? snapToGrid(endNode.x - 22, 10)
          : snapToGrid(endNode.x + endNode.width + 22, 10);
      const corridorX = findClearVerticalChannelX(
        preferredGapX,
        underY,
        aboveY,
        allNodes,
        ignoreIds
      );
      return simplifyOrthogonalPoints([
        start,
        { x: start.x, y: underY },
        { x: corridorX, y: underY },
        { x: corridorX, y: aboveY },
        { x: end.x, y: aboveY },
        end,
      ]);
    }

    const midY = snapToGrid(start.y + (end.y - start.y) * trunkRatio, 10);
    const simple = simplifyOrthogonalPoints([
      start,
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      end,
    ]);

    if (!pathHitsAnyNode(simple, allNodes, ignoreIds)) {
      return simple;
    }

    // Obstacle-avoiding multi-row shaft route
    if (startNode && endNode && startNode.id !== endNode.id) {
      const dirDown = end.y >= start.y;
      const yExit = snapToGrid(start.y + (dirDown ? 24 : -24) + laneOffset, 10);
      const yEnter = snapToGrid(end.y + (dirDown ? -24 : 24) - laneOffset, 10);
      const channelX = findClearVerticalChannelX(
        snapToGrid((start.x + end.x) / 2, 10),
        yExit,
        yEnter,
        allNodes,
        ignoreIds
      );
      return simplifyOrthogonalPoints([
        start,
        { x: start.x, y: yExit },
        { x: channelX, y: yExit },
        { x: channelX, y: yEnter },
        { x: end.x, y: yEnter },
        end,
      ]);
    }

    return simple;
  }

  if (!fromVert && !toVert) {
    const midX = snapToGrid(start.x + (end.x - start.x) * trunkRatio, 10);
    return simplifyOrthogonalPoints([
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end,
    ]);
  }

  if (fromVert && !toVert) {
    return simplifyOrthogonalPoints([start, { x: start.x, y: end.y }, end]);
  }

  return simplifyOrthogonalPoints([start, { x: end.x, y: start.y }, end]);
}

export function projectPointOntoPolyline(
  pt: SldPoint,
  pts: SldPoint[]
): { point: SldPoint; segmentIndex: number; distance: number } | null {
  if (pts.length < 2) return null;
  let best: { point: SldPoint; segmentIndex: number; distance: number } | null = null;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq));
    }
    const proj = {
      x: a.x + t * dx,
      y: a.y + t * dy,
    };
    const dist = Math.hypot(pt.x - proj.x, pt.y - proj.y);
    if (!best || dist < best.distance) {
      best = { point: proj, segmentIndex: i, distance: dist };
    }
  }
  return best;
}

/**
 * Slide segment `segIndex` perpendicular to its orientation while preserving 90-deg orthogonality.
 * Returns interior waypoints (excluding start and end anchors).
 */
export function moveOrthogonalSegment(
  pts: SldPoint[],
  segIndex: number,
  targetPt: SldPoint,
  snap = true
): SldPoint[] {
  if (pts.length < 2 || segIndex < 0 || segIndex >= pts.length - 1) {
    return pts.slice(1, -1);
  }
  const a = pts[segIndex];
  const b = pts[segIndex + 1];
  const isHoriz = Math.abs(a.y - b.y) <= Math.abs(a.x - b.x);
  const next = pts.map((p) => ({ ...p }));

  if (isHoriz) {
    const newY = snap ? snapToGrid(targetPt.y, 10) : Math.round(targetPt.y);
    if (pts.length === 2) {
      const result = [
        next[0],
        { x: next[0].x, y: newY },
        { x: next[1].x, y: newY },
        next[1],
      ];
      return simplifyOrthogonalPoints(result).slice(1, -1);
    }
    const touchesStart = segIndex === 0;
    const touchesEnd = segIndex === pts.length - 2;
    if (touchesStart && touchesEnd) {
      const result = [
        next[0],
        { x: next[0].x, y: newY },
        { x: next[1].x, y: newY },
        next[1],
      ];
      return simplifyOrthogonalPoints(result).slice(1, -1);
    }
    if (touchesStart) {
      next[1].y = newY;
      next.splice(1, 0, { x: next[0].x, y: newY });
      return simplifyOrthogonalPoints(next).slice(1, -1);
    }
    if (touchesEnd) {
      next[segIndex].y = newY;
      next.splice(segIndex + 1, 0, { x: next[next.length - 1].x, y: newY });
      return simplifyOrthogonalPoints(next).slice(1, -1);
    }
    next[segIndex].y = newY;
    next[segIndex + 1].y = newY;
    return simplifyOrthogonalPoints(next).slice(1, -1);
  } else {
    const newX = snap ? snapToGrid(targetPt.x, 10) : Math.round(targetPt.x);
    if (pts.length === 2) {
      const result = [
        next[0],
        { x: newX, y: next[0].y },
        { x: newX, y: next[1].y },
        next[1],
      ];
      return simplifyOrthogonalPoints(result).slice(1, -1);
    }
    const touchesStart = segIndex === 0;
    const touchesEnd = segIndex === pts.length - 2;
    if (touchesStart) {
      next[1].x = newX;
      next.splice(1, 0, { x: newX, y: next[0].y });
      return simplifyOrthogonalPoints(next).slice(1, -1);
    }
    if (touchesEnd) {
      next[segIndex].x = newX;
      next.splice(segIndex + 1, 0, { x: newX, y: next[next.length - 1].y });
      return simplifyOrthogonalPoints(next).slice(1, -1);
    }
    next[segIndex].x = newX;
    next[segIndex + 1].x = newX;
    return simplifyOrthogonalPoints(next).slice(1, -1);
  }
}

/**
 * Insert a clean orthogonal jog/bend on a selected segment so users can reroute around boxes.
 */
export function insertBendOnSegment(
  pts: SldPoint[],
  segIndex: number,
  snap = true
): SldPoint[] {
  if (pts.length < 2 || segIndex < 0 || segIndex >= pts.length - 1) {
    return pts.slice(1, -1);
  }
  const a = pts[segIndex];
  const b = pts[segIndex + 1];
  const isHoriz = Math.abs(a.y - b.y) <= Math.abs(a.x - b.x);
  const next = pts.map((p) => ({ ...p }));

  if (isHoriz) {
    const midX = snap ? snapToGrid((a.x + b.x) / 2, 10) : Math.round((a.x + b.x) / 2);
    const jogY = snap ? snapToGrid(a.y + 40, 10) : a.y + 40;
    next.splice(
      segIndex + 1,
      0,
      { x: midX, y: a.y },
      { x: midX, y: jogY },
      { x: b.x, y: jogY }
    );
  } else {
    const midY = snap ? snapToGrid((a.y + b.y) / 2, 10) : Math.round((a.y + b.y) / 2);
    const jogX = snap ? snapToGrid(a.x + 40, 10) : a.x + 40;
    next.splice(
      segIndex + 1,
      0,
      { x: a.x, y: midY },
      { x: jogX, y: midY },
      { x: jogX, y: b.y }
    );
  }
  return simplifyOrthogonalPoints(next).slice(1, -1);
}

/**
 * Split an existing feeder line into two independent segments at the clicked point.
 */
export function splitEdgeAtPoint(
  edge: SldEdge,
  rawClickPt: SldPoint,
  nodeMap: Map<string, SldNode>,
  trunkRatio = 0.5,
  snap = true
): [SldEdge, SldEdge] | null {
  const pts = computeOrthogonalPath(edge, nodeMap, trunkRatio);
  const proj = projectPointOntoPolyline(rawClickPt, pts);
  if (!proj) return null;

  const { segmentIndex, point } = proj;
  const segA = pts[segmentIndex];
  const segB = pts[segmentIndex + 1];
  const isHoriz = Math.abs(segA.y - segB.y) <= Math.abs(segA.x - segB.x);

  const minX = Math.min(segA.x, segB.x);
  const maxX = Math.max(segA.x, segB.x);
  const minY = Math.min(segA.y, segB.y);
  const maxY = Math.max(segA.y, segB.y);

  const splitPt: SldPoint = isHoriz
    ? {
        x: snap
          ? maxX - minX > 20
            ? Math.max(minX + 10, Math.min(maxX - 10, snapToGrid(point.x, 10)))
            : Math.round((minX + maxX) / 2)
          : Math.round(point.x),
        y: Math.round(segA.y),
      }
    : {
        x: Math.round(segA.x),
        y: snap
          ? maxY - minY > 20
            ? Math.max(minY + 10, Math.min(maxY - 10, snapToGrid(point.y, 10)))
            : Math.round((minY + maxY) / 2)
          : Math.round(point.y),
      };

  const partAPts = simplifyOrthogonalPoints([...pts.slice(0, segmentIndex + 1), splitPt]);
  const partBPts = simplifyOrthogonalPoints([splitPt, ...pts.slice(segmentIndex + 1)]);

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  const edgeA: SldEdge = {
    id: `${edge.id}-a-${stamp}`,
    fromNodeId: edge.fromNodeId,
    fromPort: edge.fromPort,
    freeStart: edge.fromNodeId ? undefined : edge.freeStart || partAPts[0],
    freeEnd: splitPt,
    waypoints: partAPts.length > 2 ? partAPts.slice(1, -1) : undefined,
    lineStyle: edge.lineStyle,
    cableLabel: edge.cableLabel,
    isManual: true,
  };

  const edgeB: SldEdge = {
    id: `${edge.id}-b-${stamp}`,
    freeStart: splitPt,
    toNodeId: edge.toNodeId,
    toPort: edge.toPort,
    freeEnd: edge.toNodeId ? undefined : edge.freeEnd || partBPts[partBPts.length - 1],
    waypoints: partBPts.length > 2 ? partBPts.slice(1, -1) : undefined,
    lineStyle: edge.lineStyle,
    cableLabel: edge.cableLabel,
    isManual: true,
  };

  return [edgeA, edgeB];
}

export function findNearestNodePort(
  pt: SldPoint,
  nodes: SldNode[],
  maxDist = 28,
  exclude?: { nodeId?: string; port?: SldPortSide }
): { nodeId: string; port: SldPortSide; point: SldPoint; label: string } | null {
  let best: {
    nodeId: string;
    port: SldPortSide;
    point: SldPoint;
    label: string;
    dist: number;
  } | null = null;
  for (const n of nodes) {
    for (const pInfo of getAllNodePorts(n)) {
      if (
        exclude?.nodeId === n.id &&
        exclude?.port === pInfo.port
      ) {
        continue;
      }
      const dist = Math.hypot(pt.x - pInfo.point.x, pt.y - pInfo.point.y);
      if (dist <= maxDist && (!best || dist < best.dist)) {
        const defaultLabel =
          pInfo.port === 'top'
            ? 'TOP'
            : pInfo.port === 'bottom'
            ? 'BOT'
            : pInfo.port === 'left'
            ? 'LEFT'
            : pInfo.port === 'right'
            ? 'RIGHT'
            : pInfo.port.replace(/^out-/, '');
        best = {
          nodeId: n.id,
          port: pInfo.port,
          point: pInfo.point,
          label: pInfo.label || defaultLabel,
          dist,
        };
      }
    }
  }
  return best
    ? {
        nodeId: best.nodeId,
        port: best.port,
        point: best.point,
        label: best.label,
      }
    : null;
}

function shortFloorTag(scope: string): string {
  const s = scope.trim();
  if (/ground/i.test(s)) return 'GF';
  if (/stilt|parking/i.test(s)) return 'ST';
  if (/terrace|roof/i.test(s)) return 'TF';
  if (/basement-?1/i.test(s)) return 'B1';
  if (/basement-?2/i.test(s)) return 'B2';
  if (/common/i.test(s)) return 'CMN';
  const floorNum = s.match(/^(\d+)/);
  if (floorNum) return `F${floorNum[1]}`;
  return s
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 4)
    .toUpperCase() || 'DB';
}

export function defaultBreakerRating(category: SldNodeCategory, sizeCode: string): string {
  switch (category) {
    case 'Utility Mains':
      return '415V · 3Ph · 4W · 50Hz';
    case 'DG Backup':
      return '415V · 3Ph · Standby DG';
    case 'Main Switch':
      return '250A 4P MCCB / Isolator';
    case 'Changeover Switch':
      return '160A 4P Auto/Man. COS';
    case 'Busbar Chamber':
      return '400A TPN Cu Busbar';
    case 'Emergency VTPNDB':
    case 'Raw VTPNDB':
      return sizeCode.includes('36')
        ? '250A 4P MCCB Inc.'
        : sizeCode.includes('24')
        ? '160A 4P MCCB Inc.'
        : '100A 4P MCCB Inc.';
    case 'Emergency PDB':
    case 'Raw PDB':
      return sizeCode.includes('24')
        ? '63A 4P MCB + RCCB'
        : sizeCode.includes('18')
        ? '63A 4P MCB Inc.'
        : '40A 4P MCB Inc.';
    case 'LDB':
      return sizeCode.includes('14') || sizeCode.includes('10')
        ? '40A 2P MCB + RCCB'
        : '32A 2P MCB + RCCB';
  }
}

export function getCatalogForCategory(category: SldNodeCategory): DbCapacityOption[] {
  switch (category) {
    case 'LDB':
      return LDB_CAPACITIES;
    case 'Emergency PDB':
    case 'Raw PDB':
      return PDB_CAPACITIES;
    case 'Emergency VTPNDB':
    case 'Raw VTPNDB':
      return VTPNDB_CAPACITIES;
    default:
      return [];
  }
}

export function getCatalogOptionForNode(
  category: SldNodeCategory,
  sizeCode: string
): DbCapacityOption | undefined {
  const catalog = getCatalogForCategory(category);
  if (catalog.length === 0) return undefined;
  return catalog.find((c) => c.sizeCode === sizeCode) || catalog[0];
}

export function computeMcbDbScheduleSignature(result: McbDbCalculationResult): string {
  return result.tableEntries
    .map((e) => `${e.id}:${e.baseWays}:${e.reqWaysWithSpare}:${e.qty}`)
    .join('|');
}

const DB_BOX_W = 216;
const DB_BOX_H = 104;
const SW_BOX_W = 220;
const SW_BOX_H = 112;
const BUSBAR_BOX_W = 300;
const BUSBAR_BOX_H = 104;
const SRC_BOX_W = 200;
const SRC_BOX_H = 88;
const COL_GAP = 40;
const ROW_GAP = 96;

interface DbSpawnSpec {
  id: string;
  category: Exclude<DbCategoryType, 'Switch Board'>;
  code: string;
  title: string;
  scope: string;
  sizeCode: string;
  incomingType: string;
  waysLabel: string;
  ratingText: string;
  capacityWays: number;
  spareCount: number;
  directUsedWays: number;
  isCommon: boolean;
  floorName: string;
}

/**
 * Distribute `totalAmount` integers proportionally across `caps` (never exceeding each cap).
 */
function distributeAmounts(caps: number[], totalAmount: number): number[] {
  if (caps.length === 0) return [];
  const totalCap = caps.reduce((s, c) => s + c, 0);
  const clamped = Math.min(totalCap, Math.max(0, totalAmount));
  const used = caps.map((c) =>
    totalCap > 0 ? Math.min(c, Math.floor((clamped * c) / totalCap)) : 0
  );
  let remaining = clamped - used.reduce((s, u) => s + u, 0);
  let idx = 0;
  while (remaining > 0 && idx < caps.length * 6) {
    const i = idx % caps.length;
    if (used[i] < caps[i]) {
      used[i]++;
      remaining--;
    }
    idx++;
  }
  return used;
}

/**
 * Compute per-box spare ways count so each individual DB box accurately displays
 * its allocated spare count based on active baseWays vs provided capacity.
 */
function distributeBoxSpares(
  specList: { ways: number; qty: number }[],
  baseWays: number
): number[] {
  const caps: number[] = [];
  for (const item of specList) {
    for (let q = 0; q < item.qty; q++) {
      caps.push(item.ways);
    }
  }
  const usedPerBox = distributeAmounts(caps, baseWays);
  return caps.map((c, i) => Math.max(0, c - usedPerBox[i]));
}

/**
 * Generate a complete AutoCAD-style Single Line Diagram from MCBDB calculation results.
 * Includes Distribution Boards only (no Switch Boards), showing Category, Floor Level, DB Size & Spare Number on DBs,
 * separate outgoing connection nodes on DBs, Busbar Chamber with outgoing main switch nodes,
 * and an auto-labeled L.T. PANEL grouping enclosure.
 */
export function generateSldFromMcbDb(
  result: McbDbCalculationResult,
  settings: McbDbSettings,
  existingDoc?: SldDocument | null,
  preserveManual = false
): SldDocument {
  const nodes: SldNode[] = [];
  const edges: SldEdge[] = [];

  // Track board groups for hierarchy edge generation
  const emgVtpnByFloor = new Map<string, SldNode[]>();
  const rawVtpnByFloor = new Map<string, SldNode[]>();
  const emgPdbByFloor = new Map<string, SldNode[]>();
  const rawPdbByFloor = new Map<string, SldNode[]>();
  const ldbByFloor = new Map<string, SldNode[]>();

  const commonEmgVtpnNodes: SldNode[] = [];
  const commonRawVtpnNodes: SldNode[] = [];
  const commonEmgPdbNodes: SldNode[] = [];

  // Helper to expand allocated board items (qty -> N separate boxes with spareCount)
  const expandCategory = (
    specList: { sizeCode: string; incoming: string; ways: number; qty: number }[],
    category: Exclude<DbCategoryType, 'Switch Board'>,
    scope: string,
    isCommon: boolean,
    baseWays: number,
    reqWays: number,
    wayUnit: string,
    shortPrefix: string,
    directWaysTotal = 0
  ): DbSpawnSpec[] => {
    const spares = distributeBoxSpares(specList, baseWays);
    const caps: number[] = [];
    for (const item of specList) {
      for (let q = 0; q < item.qty; q++) caps.push(item.ways);
    }
    const directPerBox = distributeAmounts(caps, directWaysTotal);
    const out: DbSpawnSpec[] = [];
    let seq = 1;
    let boxIdx = 0;
    const fTag = shortFloorTag(scope);
    for (const item of specList) {
      for (let q = 0; q < item.qty; q++) {
        out.push({
          id: `db-${fTag.toLowerCase()}-${shortPrefix.toLowerCase()}-${seq}`,
          category,
          code: `${fTag}-${shortPrefix}-${seq}`,
          title: `${category} #${seq}`,
          scope,
          sizeCode: item.sizeCode,
          incomingType: item.incoming,
          waysLabel: `${reqWays} req / ${item.ways} ${wayUnit}`,
          ratingText: defaultBreakerRating(category, item.sizeCode),
          capacityWays: item.ways,
          spareCount: spares[boxIdx] ?? 0,
          directUsedWays: directPerBox[boxIdx] ?? 0,
          isCommon,
          floorName: isCommon ? 'Common Panel' : scope,
        });
        seq++;
        boxIdx++;
      }
    }
    return out;
  };

  const tierVtpn: SldNode[] = [];
  const tierPdb: SldNode[] = [];
  const tierLdb: SldNode[] = [];

  const pushDbNode = (
    spec: DbSpawnSpec,
    targetTier: SldNode[],
    floorMap?: Map<string, SldNode[]>
  ) => {
    const node: SldNode = {
      id: spec.id,
      kind: 'db',
      category: spec.category,
      code: spec.code,
      title: spec.title,
      scope: spec.scope,
      floorName: spec.floorName,
      sizeCode: spec.sizeCode,
      incomingType: spec.incomingType,
      waysLabel: spec.waysLabel,
      ratingText: spec.ratingText,
      capacityWays: spec.capacityWays,
      baseCapacityWays: spec.capacityWays,
      directUsedWays: spec.directUsedWays,
      usedWays: Math.max(0, spec.capacityWays - spec.spareCount),
      spareCount: spec.spareCount,
      outgoingNodes: [
        { id: 'og-1', label: 'O1' },
        { id: 'og-2', label: 'O2' },
      ],
      x: 0,
      y: 0,
      width: DB_BOX_W,
      height: DB_BOX_H,
      isCommon: spec.isCommon,
      isManual: false,
    };
    targetTier.push(node);
    if (floorMap && !spec.isCommon) {
      const list = floorMap.get(spec.floorName) || [];
      list.push(node);
      floorMap.set(spec.floorName, list);
    }
    return node;
  };

  // 1. Collect all Floor DBs & Common DBs (EXCLUDING Switch Boards)
  for (const f of result.floors) {
    const emgV = expandCategory(
      f.emgVtpndbAlloc.items.map((i) => ({ ...i.option, qty: i.qty })),
      'Emergency VTPNDB',
      f.floorName,
      false,
      f.emgVtpndbBaseTpWays,
      f.emgVtpndbReqTpWays,
      '3P',
      'EVTPN',
      0
    );
    emgV.forEach((s) => pushDbNode(s, tierVtpn, emgVtpnByFloor));

    const rawV = expandCategory(
      f.rawVtpndbAlloc.items.map((i) => ({ ...i.option, qty: i.qty })),
      'Raw VTPNDB',
      f.floorName,
      false,
      f.rawVtpndbBaseTpWays,
      f.rawVtpndbReqTpWays,
      '3P',
      'RVTPN',
      0
    );
    rawV.forEach((s) => pushDbNode(s, tierVtpn, rawVtpnByFloor));

    const emgP = expandCategory(
      f.emgPdbAlloc.items.map((i) => ({ ...i.option, qty: i.qty })),
      'Emergency PDB',
      f.floorName,
      false,
      f.emgPdbBaseWays,
      f.emgPdbReqWays,
      'SP',
      'EPDB',
      f.emgPowerTotal
    );
    emgP.forEach((s) => pushDbNode(s, tierPdb, emgPdbByFloor));

    const rawP = expandCategory(
      f.rawPdbAlloc.items.map((i) => ({ ...i.option, qty: i.qty })),
      'Raw PDB',
      f.floorName,
      false,
      f.rawPdbBaseWays,
      f.rawPdbReqWays,
      'SP',
      'RPDB',
      f.rawPowerTotal
    );
    rawP.forEach((s) => pushDbNode(s, tierPdb, rawPdbByFloor));

    const ldbs = expandCategory(
      f.ldbAlloc.items.map((i) => ({ ...i.option, qty: i.qty })),
      'LDB',
      f.floorName,
      false,
      f.ldbBaseWays,
      f.ldbReqWays,
      'SP',
      'LDB',
      f.ldbBaseWays
    );
    ldbs.forEach((s) => pushDbNode(s, tierLdb, ldbByFloor));
  }

  // Common Panels
  expandCategory(
    result.common.commonEmgVtpndbAlloc.items.map((i) => ({ ...i.option, qty: i.qty })),
    'Emergency VTPNDB',
    'Common Panel',
    true,
    result.common.commonEmgVtpndbBaseTpWays,
    result.common.commonEmgVtpndbReqTpWays,
    '3P',
    'EVTPN'
  ).forEach((s) => commonEmgVtpnNodes.push(pushDbNode(s, tierVtpn)));

  expandCategory(
    result.common.commonRawVtpndbAlloc.items.map((i) => ({ ...i.option, qty: i.qty })),
    'Raw VTPNDB',
    'Common Panel',
    true,
    result.common.commonRawVtpndbBaseTpWays,
    result.common.commonRawVtpndbReqTpWays,
    '3P',
    'RVTPN'
  ).forEach((s) => commonRawVtpnNodes.push(pushDbNode(s, tierVtpn)));

  expandCategory(
    result.common.commonEmgPdbAlloc.items.map((i) => ({ ...i.option, qty: i.qty })),
    'Emergency PDB',
    'Common Panel',
    true,
    result.common.commonEmgPdbBaseWays,
    result.common.commonEmgPdbReqWays,
    'SP',
    'EPDB'
  ).forEach((s) => commonEmgPdbNodes.push(pushDbNode(s, tierPdb)));

  // Calculate total horizontal canvas width from the widest tier
  const maxCols = Math.max(
    4,
    tierVtpn.length,
    tierPdb.length,
    tierLdb.length
  );
  const contentWidth = maxCols * (DB_BOX_W + COL_GAP) + 200;
  const canvasWidth = Math.max(1340, snapToGrid(contentWidth));
  const centerX = snapToGrid(canvasWidth / 2);

  // Row Y coordinates (Sources -> Incoming Main Switch -> Busbar Chamber -> Outgoing Switches + COS -> DB Tiers)
  const Y_SOURCES = 60;
  const Y_INCOMING_SW = Y_SOURCES + SRC_BOX_H + 84;
  const Y_BUSBAR = Y_INCOMING_SW + SW_BOX_H + 64;
  const Y_OUTGOING_SW = Y_BUSBAR + BUSBAR_BOX_H + 64;
  const Y_VTPN = Y_OUTGOING_SW + SW_BOX_H + 104;
  const Y_PDB = tierVtpn.length > 0 ? Y_VTPN + DB_BOX_H + ROW_GAP : Y_VTPN;
  const Y_LDB = tierPdb.length > 0 ? Y_PDB + DB_BOX_H + ROW_GAP : Y_PDB;

  // 2. Top Tier: Utility Mains, DG Backup, L.T. Panel (Incoming Main Switch, Busbar Chamber, Outgoing Main Switches, Changeover)
  const utilityMainsNode: SldNode = {
    id: 'src-mains',
    kind: 'source',
    category: 'Utility Mains',
    code: 'INCOMER-1',
    title: 'Utility Mains Supply',
    scope: 'EB / Transformer LT',
    sizeCode: '415V 3Ph 4W',
    incomingType: 'Main LT Cable',
    waysLabel: 'Primary Source',
    ratingText: defaultBreakerRating('Utility Mains', ''),
    x: snapToGrid(centerX - 240),
    y: Y_SOURCES,
    width: SRC_BOX_W,
    height: SRC_BOX_H,
  };

  const dgBackupNode: SldNode = {
    id: 'src-dg',
    kind: 'source',
    category: 'DG Backup',
    code: 'INCOMER-2',
    title: 'DG Set Supply',
    scope: 'Standby Power',
    sizeCode: '415V 3Ph 4W',
    incomingType: 'DG Feeder',
    waysLabel: 'Emergency Source',
    ratingText: defaultBreakerRating('DG Backup', ''),
    x: snapToGrid(centerX + 200),
    y: Y_SOURCES,
    width: SRC_BOX_W,
    height: SRC_BOX_H,
  };

  const incomingMainSwitchNode: SldNode = {
    id: 'sw-main-incomer',
    kind: 'main-switch',
    category: 'Main Switch',
    code: 'MS-INCOMER',
    title: 'Incoming Main Switch',
    scope: 'Incoming Main Switch',
    sizeCode: '4P MCCB / ACB',
    incomingType: 'Mains Incomer',
    waysLabel: 'L.T. Panel Incomer',
    ratingText: '400A 4P MCCB',
    x: snapToGrid(centerX - 250),
    y: Y_INCOMING_SW,
    width: SW_BOX_W,
    height: SW_BOX_H,
  };

  const busbarChamberNode: SldNode = {
    id: 'busbar-lt-1',
    kind: 'busbar-chamber',
    category: 'Busbar Chamber',
    code: 'BUSBAR-1',
    title: 'L.T. Busbar Chamber',
    scope: 'Main Copper Busbar',
    sizeCode: '400A TPN + N',
    incomingType: '415V 3Ph 4W Bus',
    waysLabel: '2 Outgoing Switch Nodes',
    ratingText: defaultBreakerRating('Busbar Chamber', ''),
    outgoingNodes: [
      { id: 'og-1', label: 'OG-MS1' },
      { id: 'og-2', label: 'OG-MS2' },
    ],
    x: snapToGrid(centerX - 290),
    y: Y_BUSBAR,
    width: BUSBAR_BOX_W,
    height: BUSBAR_BOX_H,
  };

  const outgoingRawSwitchNode: SldNode = {
    id: 'sw-out-raw',
    kind: 'main-switch',
    category: 'Main Switch',
    code: 'OG-MS1',
    title: 'Outgoing Main Switch (Raw)',
    scope: 'Outgoing Main Switch',
    sizeCode: '4P MCCB / SFU',
    incomingType: 'From Busbar OG-MS1',
    waysLabel: 'Raw DBs Feeder',
    ratingText: '250A 4P MCCB',
    x: snapToGrid(centerX - 370),
    y: Y_OUTGOING_SW,
    width: SW_BOX_W,
    height: SW_BOX_H,
  };

  const outgoingEssSwitchNode: SldNode = {
    id: 'sw-out-ess',
    kind: 'main-switch',
    category: 'Main Switch',
    code: 'OG-MS2',
    title: 'Outgoing Main Switch (Ess.)',
    scope: 'Outgoing Main Switch',
    sizeCode: '4P MCCB / SFU',
    incomingType: 'From Busbar OG-MS2',
    waysLabel: 'To COS / Emg. Bus',
    ratingText: '160A 4P MCCB',
    x: snapToGrid(centerX - 110),
    y: Y_OUTGOING_SW,
    width: SW_BOX_W,
    height: SW_BOX_H,
  };

  const changeoverNode: SldNode = {
    id: 'sw-cos-1',
    kind: 'changeover-switch',
    category: 'Changeover Switch',
    code: 'COS-1',
    title: 'Changeover Switch',
    scope: 'Mains / DG Interlock',
    sizeCode: '4P Changeover',
    incomingType: 'Dual Supply',
    waysLabel: 'Emergency Bus Feed',
    ratingText: defaultBreakerRating('Changeover Switch', ''),
    x: snapToGrid(centerX + 190),
    y: Y_OUTGOING_SW,
    width: SW_BOX_W,
    height: SW_BOX_H,
  };

  nodes.push(
    utilityMainsNode,
    dgBackupNode,
    incomingMainSwitchNode,
    busbarChamberNode,
    outgoingRawSwitchNode,
    outgoingEssSwitchNode,
    changeoverNode
  );

  // Create default L.T. PANEL grouping box containing Incoming Main Switch, Busbar Chamber, Outgoing Main Switches & Changeover
  const ltPanelGroup: SldGroup = {
    id: 'grp-lt-panel',
    label: 'L.T. PANEL',
    nodeIds: [
      incomingMainSwitchNode.id,
      busbarChamberNode.id,
      outgoingRawSwitchNode.id,
      outgoingEssSwitchNode.id,
      changeoverNode.id,
    ],
    color: '#38bdf8',
    isManual: false,
  };

  const groups: SldGroup[] = [ltPanelGroup];

  // 3. Auto-generate Hierarchy Orthogonal Edges
  let edgeSeq = 1;
  const addEdge = (
    fromNodeId: string,
    fromPort: SldPortSide,
    toNodeId: string,
    toPort: SldPortSide,
    lineStyle: SldLineStyle,
    cableLabel: string
  ) => {
    edges.push({
      id: `edge-auto-${edgeSeq++}`,
      fromNodeId,
      fromPort,
      toNodeId,
      toPort,
      lineStyle,
      cableLabel,
      isManual: false,
    });
  };

  // Track next available outgoing port index per DB so every outgoing DB feeder uses a separate node
  const dbOutCounter = new Map<string, number>();
  const allocateDbOutgoingPort = (parentNode: SldNode): SldPortSide => {
    const nextIdx = dbOutCounter.get(parentNode.id) || 0;
    dbOutCounter.set(parentNode.id, nextIdx + 1);
    const list = parentNode.outgoingNodes || [];
    while (list.length <= nextIdx) {
      const nNum = list.length + 1;
      list.push({ id: `og-${nNum}`, label: `O${nNum}` });
    }
    parentNode.outgoingNodes = list;
    // Widen DB slightly if many outgoing nodes are needed so terminal nodes stay readable
    if (list.length > 3) {
      parentNode.width = Math.max(parentNode.width, snapToGrid(list.length * 52));
    }
    return `out-${list[nextIdx].id}`;
  };

  // Sources -> Incoming Main Switch -> Busbar Chamber -> Outgoing Main Switches -> Changeover
  addEdge(
    utilityMainsNode.id,
    'bottom',
    incomingMainSwitchNode.id,
    'top',
    'main',
    'XLPE Mains Incomer'
  );
  addEdge(
    incomingMainSwitchNode.id,
    'bottom',
    busbarChamberNode.id,
    'top',
    'main',
    'Main LT Busbar Feed'
  );
  addEdge(
    busbarChamberNode.id,
    'out-og-1',
    outgoingRawSwitchNode.id,
    'top',
    'raw',
    'Busbar OG-1'
  );
  addEdge(
    busbarChamberNode.id,
    'out-og-2',
    outgoingEssSwitchNode.id,
    'top',
    'main',
    'Busbar OG-2'
  );
  addEdge(
    outgoingEssSwitchNode.id,
    'right',
    changeoverNode.id,
    'left',
    'main',
    'Mains to COS'
  );
  addEdge(
    dgBackupNode.id,
    'bottom',
    changeoverNode.id,
    'top',
    'emergency',
    'DG Standby Feeder'
  );

  // 1) Outgoing Raw Main Switch -> Raw VTPNDBs (floor + common)
  const allRawVtpn = [
    ...Array.from(rawVtpnByFloor.values()).flat(),
    ...commonRawVtpnNodes,
  ];
  for (const rv of allRawVtpn) {
    addEdge(outgoingRawSwitchNode.id, 'bottom', rv.id, 'top', 'raw', '3Ph Raw Bus Feeder');
  }

  // 2) Floor Raw PDBs <- Floor Raw VTPNDB (separate outgoing node!) OR Common Raw VTPNDB OR Outgoing Raw Main Switch
  for (const f of result.floors) {
    const floorRawPdbs = rawPdbByFloor.get(f.floorName) || [];
    if (floorRawPdbs.length === 0) continue;

    const floorRawVtpns = rawVtpnByFloor.get(f.floorName) || [];
    if (floorRawVtpns.length > 0) {
      floorRawPdbs.forEach((pdb, idx) => {
        const parent = floorRawVtpns[idx % floorRawVtpns.length];
        addEdge(parent.id, allocateDbOutgoingPort(parent), pdb.id, 'top', 'raw', '4P Sub-Main');
      });
    } else if (f.rawVtpndbSkippedSinglePdb && commonRawVtpnNodes.length > 0) {
      floorRawPdbs.forEach((pdb, idx) => {
        const parent = commonRawVtpnNodes[idx % commonRawVtpnNodes.length];
        addEdge(
          parent.id,
          allocateDbOutgoingPort(parent),
          pdb.id,
          'top',
          'raw',
          '4P Common Sub-Main'
        );
      });
    } else {
      floorRawPdbs.forEach((pdb) => {
        addEdge(outgoingRawSwitchNode.id, 'bottom', pdb.id, 'top', 'raw', '4P Raw Feeder');
      });
    }
  }

  // 3) Changeover Switch -> Emergency VTPNDBs (floor + common)
  const allEmgVtpn = [
    ...Array.from(emgVtpnByFloor.values()).flat(),
    ...commonEmgVtpnNodes,
  ];
  for (const ev of allEmgVtpn) {
    addEdge(changeoverNode.id, 'bottom', ev.id, 'top', 'emergency', '3Ph Emergency Feeder');
  }

  // 4) Common Emergency PDB <- Common Emergency VTPNDB (separate outgoing node!)
  commonEmgPdbNodes.forEach((cpdb, idx) => {
    if (commonEmgVtpnNodes.length > 0) {
      const parent = commonEmgVtpnNodes[idx % commonEmgVtpnNodes.length];
      addEdge(
        parent.id,
        allocateDbOutgoingPort(parent),
        cpdb.id,
        'top',
        'emergency',
        '4P Emg. Sub-Main'
      );
    } else {
      addEdge(changeoverNode.id, 'bottom', cpdb.id, 'top', 'emergency', '4P Emg. Feeder');
    }
  });

  // 5) Floor Emergency PDBs <- Floor Emg VTPNDB (or Common Emg VTPNDB, or Changeover)
  for (const f of result.floors) {
    const floorEmgPdbs = emgPdbByFloor.get(f.floorName) || [];
    if (floorEmgPdbs.length === 0) continue;

    const floorEmgVtpns = emgVtpnByFloor.get(f.floorName) || [];
    if (floorEmgVtpns.length > 0) {
      floorEmgPdbs.forEach((pdb, idx) => {
        const parent = floorEmgVtpns[idx % floorEmgVtpns.length];
        addEdge(
          parent.id,
          allocateDbOutgoingPort(parent),
          pdb.id,
          'top',
          'emergency',
          '4P Emg. Sub-Main'
        );
      });
    } else if (f.emgVtpndbSkippedSinglePdb && commonEmgVtpnNodes.length > 0) {
      floorEmgPdbs.forEach((pdb, idx) => {
        const parent = commonEmgVtpnNodes[idx % commonEmgVtpnNodes.length];
        addEdge(
          parent.id,
          allocateDbOutgoingPort(parent),
          pdb.id,
          'top',
          'emergency',
          '4P Common Emg. Sub-Main'
        );
      });
    } else {
      floorEmgPdbs.forEach((pdb) => {
        addEdge(changeoverNode.id, 'bottom', pdb.id, 'top', 'emergency', '4P Emg. Feeder');
      });
    }
  }

  // 6) Floor LDBs <- Floor Emergency PDB (or Common Emergency PDB, or Changeover)
  for (const f of result.floors) {
    const floorLdbs = ldbByFloor.get(f.floorName) || [];
    if (floorLdbs.length === 0) continue;

    const floorEmgPdbs = emgPdbByFloor.get(f.floorName) || [];
    if (floorEmgPdbs.length > 0) {
      floorLdbs.forEach((ldb, idx) => {
        const parent = floorEmgPdbs[idx % floorEmgPdbs.length];
        addEdge(
          parent.id,
          allocateDbOutgoingPort(parent),
          ldb.id,
          'top',
          'emergency',
          '2P LDB Circuit'
        );
      });
    } else if (f.emgPdbSkippedSingleLdb && commonEmgPdbNodes.length > 0) {
      floorLdbs.forEach((ldb, idx) => {
        const parent = commonEmgPdbNodes[idx % commonEmgPdbNodes.length];
        addEdge(
          parent.id,
          allocateDbOutgoingPort(parent),
          ldb.id,
          'top',
          'emergency',
          '2P Common LDB Circuit'
        );
      });
    } else {
      floorLdbs.forEach((ldb) => {
        addEdge(changeoverNode.id, 'bottom', ldb.id, 'top', 'emergency', '2P LDB Direct');
      });
    }
  }

  // Position DB tiers centered horizontally AFTER any DB width adjustments for outgoing nodes
  const layoutTier = (tierNodes: SldNode[], yPos: number) => {
    if (tierNodes.length === 0) return;
    const totalW =
      tierNodes.reduce((s, n) => s + n.width, 0) + (tierNodes.length - 1) * COL_GAP;
    let curX = snapToGrid(Math.max(60, (canvasWidth - totalW) / 2));
    tierNodes.forEach((node) => {
      node.x = snapToGrid(curX);
      node.y = snapToGrid(yPos);
      curX += node.width + COL_GAP;
      nodes.push(node);
    });
  };

  layoutTier(tierVtpn, Y_VTPN);
  layoutTier(tierPdb, Y_PDB);
  layoutTier(tierLdb, Y_LDB);

  // Align each Emergency PDB's directUsedWays (non-LDB direct circuits) so directUsedWays + connectedLdbCount matches floor allocation
  for (const f of result.floors) {
    const floorEmgPdbs = emgPdbByFloor.get(f.floorName) || [];
    if (floorEmgPdbs.length === 0) continue;
    const remainingCaps = floorEmgPdbs.map((pdb) => {
      const ldbCount = edges.filter(
        (e) => e.fromNodeId === pdb.id && e.toNodeId && ldbByFloor.get(f.floorName)?.some((l) => l.id === e.toNodeId)
      ).length;
      return Math.max(0, (pdb.capacityWays || 12) - ldbCount);
    });
    const directShares = distributeAmounts(remainingCaps, f.emgPowerTotal);
    floorEmgPdbs.forEach((pdb, i) => {
      pdb.directUsedWays = directShares[i] ?? 0;
    });
  }

  // Preserve manual switches, busbars, DB edits, lines & groups if requested
  if (preserveManual && existingDoc) {
    const manualNodes = existingDoc.nodes.filter((n) => n.isManual);
    const allNodeIds = new Set([...nodes.map((n) => n.id), ...manualNodes.map((n) => n.id)]);
    const manualEdges = existingDoc.edges.filter((e) => {
      if (!e.isManual) return false;
      const fromOk = !e.fromNodeId || allNodeIds.has(e.fromNodeId);
      const toOk = !e.toNodeId || allNodeIds.has(e.toNodeId);
      return fromOk && toOk;
    });
    const manualGroups = (existingDoc.groups || [])
      .filter((g) => g.isManual)
      .map((g) => ({
        ...g,
        nodeIds: g.nodeIds.filter((id) => allNodeIds.has(id)),
      }))
      .filter((g) => g.nodeIds.length > 0);

    nodes.push(...manualNodes);
    edges.push(...manualEdges);
    groups.push(...manualGroups);
  }

  const rawDoc: SldDocument = {
    version: 3,
    generatedAt: new Date().toISOString(),
    sparePercent: settings.sparePercent,
    scheduleSignature: computeMcbDbScheduleSignature(result),
    nodes,
    edges,
    groups,
    canvasWidth,
    canvasHeight: 880,
  };

  return autoLayoutSldDocument(reconcileSldDbSparesAndSizes(rawDoc).doc, {
    clearAutoWaypoints: true,
  });
}

/**
 * Recompute every DB node's usedWays, spareCount, and DB size from live SLD parent->child connections:
 * - PDB (Emergency/Raw) counts downstream connected LDBs + its directUsedWays (room sockets/ACs)
 * - VTPNDB (Emergency/Raw) counts downstream connected PDBs
 * - If any DB's spare reaches 0 (or <= 0), automatically select the nearest upper DB size where spare > 0
 */
export function reconcileSldDbSparesAndSizes(doc: SldDocument): {
  doc: SldDocument;
  upgradedMessages: string[];
} {
  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));
  const upgradedMessages: string[] = [];

  const nextNodes = doc.nodes.map((n) => {
    if (n.kind !== 'db') return n;

    const childIds = new Set<string>();
    if (n.category === 'Emergency PDB' || n.category === 'Raw PDB') {
      for (const e of doc.edges) {
        if (e.fromNodeId === n.id && e.toNodeId) {
          const target = nodeMap.get(e.toNodeId);
          if (target?.kind === 'db' && target.category === 'LDB') {
            childIds.add(target.id);
          }
        }
      }
    } else if (n.category === 'Emergency VTPNDB' || n.category === 'Raw VTPNDB') {
      for (const e of doc.edges) {
        if (e.fromNodeId === n.id && e.toNodeId) {
          const target = nodeMap.get(e.toNodeId);
          if (
            target?.kind === 'db' &&
            (target.category === 'Emergency PDB' || target.category === 'Raw PDB')
          ) {
            childIds.add(target.id);
          }
        }
      }
    }

    const catalog = [...getCatalogForCategory(n.category)].sort((a, b) => a.ways - b.ways);
    const currentOpt = getCatalogOptionForNode(n.category, n.sizeCode);
    const currentCap = n.capacityWays ?? currentOpt?.ways ?? 0;

    // Preserve directUsedWays if tracked; fallback cleanly for older docs
    const directUsed =
      n.directUsedWays !== undefined
        ? n.directUsedWays
        : Math.max(0, (n.usedWays ?? Math.max(0, currentCap - (n.spareCount ?? 0))) - childIds.size);

    const usedWays = directUsed + childIds.size;

    if (catalog.length === 0) {
      return {
        ...n,
        floorName: n.floorName || (n.isCommon ? 'Common Panel' : n.scope),
        usedWays,
        spareCount: Math.max(0, currentCap - usedWays),
      };
    }

    const minAllowedWays = n.baseCapacityWays ?? currentOpt?.ways ?? catalog[0].ways;
    // Must satisfy minimum scheduled capacity AND strictly have spare > 0 if an upper DB size exists
    const chosenOpt =
      catalog.find((opt) => opt.ways >= minAllowedWays && opt.ways > usedWays) ||
      catalog[catalog.length - 1];

    const newCap = chosenOpt.ways;
    const newSpare = Math.max(0, newCap - usedWays);
    const unit =
      n.category === 'Emergency VTPNDB' || n.category === 'Raw VTPNDB' ? '3P' : 'SP';

    if (chosenOpt.ways > currentCap) {
      upgradedMessages.push(
        `${n.code} (${n.floorName || n.scope}) spare reached 0 — upgraded to ${chosenOpt.sizeCode} (Spare: ${newSpare}).`
      );
    }

    return {
      ...n,
      floorName: n.floorName || (n.isCommon ? 'Common Panel' : n.scope),
      sizeCode: chosenOpt.sizeCode,
      incomingType: chosenOpt.incoming,
      capacityWays: newCap,
      baseCapacityWays: minAllowedWays,
      directUsedWays: directUsed,
      usedWays,
      spareCount: newSpare,
      waysLabel: `${usedWays} used / ${newSpare} spare ${unit}`,
      ratingText: defaultBreakerRating(n.category, chosenOpt.sizeCode),
    };
  });

  return {
    doc: {
      ...doc,
      nodes: nextNodes,
    },
    upgradedMessages,
  };
}

/**
 * Determine whether `parentCat` is a direct parent DB tier for `childCat`
 * (PDB -> LDB or VTPNDB -> PDB).
 */
export function isDbParentChildPair(
  parentCat: SldNodeCategory,
  childCat: SldNodeCategory
): boolean {
  if (childCat === 'LDB') {
    return parentCat === 'Emergency PDB' || parentCat === 'Raw PDB';
  }
  if (childCat === 'Emergency PDB' || childCat === 'Raw PDB') {
    return parentCat === 'Emergency VTPNDB' || parentCat === 'Raw VTPNDB';
  }
  return false;
}

/**
 * Reassign a child DB (LDB -> new PDB, or PDB -> new VTPNDB) in the SLD document,
 * removing its previous parent DB incoming edge, wiring a dedicated outgoing node on the target parent DB,
 * and reconciling both DBs' spare counts + nearest-upper DB size upgrades.
 */
export function reassignDbParentInSld(
  doc: SldDocument,
  childNodeId: string,
  newParentNodeId: string
): { doc: SldDocument; upgradedMessages: string[] } {
  const child = doc.nodes.find((n) => n.id === childNodeId);
  const newParent = doc.nodes.find((n) => n.id === newParentNodeId);
  if (!child || !newParent) {
    return { doc, upgradedMessages: [] };
  }

  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));
  // Remove previous parent-DB incoming edge to this child DB
  const filteredEdges = doc.edges.filter((e) => {
    if (e.toNodeId !== childNodeId || !e.fromNodeId) return true;
    const prevParent = nodeMap.get(e.fromNodeId);
    if (!prevParent) return true;
    return !isDbParentChildPair(prevParent.category, child.category);
  });

  // Find a free outgoing node on newParent, or create a new one if all are occupied
  const usedPorts = new Set(
    filteredEdges
      .filter((e) => e.fromNodeId === newParent.id && e.fromPort?.startsWith('out-'))
      .map((e) => e.fromPort!)
  );
  const existingOg = [...(newParent.outgoingNodes || [])];
  let chosenPort: SldPortSide | undefined;
  for (const og of existingOg) {
    const p: SldPortSide = `out-${og.id}`;
    if (!usedPorts.has(p)) {
      chosenPort = p;
      break;
    }
  }
  let nextNodes = doc.nodes;
  if (!chosenPort) {
    const nNum = existingOg.length + 1;
    const newOg: SldOutgoingNode = { id: `og-${Date.now().toString(36)}-${nNum}`, label: `O${nNum}` };
    existingOg.push(newOg);
    chosenPort = `out-${newOg.id}`;
    nextNodes = doc.nodes.map((n) =>
      n.id === newParent.id
        ? {
            ...n,
            outgoingNodes: existingOg,
            width: existingOg.length > 3 ? Math.max(n.width, snapToGrid(existingOg.length * 52)) : n.width,
          }
        : n
    );
  }

  const lineStyle: SldLineStyle = newParent.category.includes('Raw') ? 'raw' : 'emergency';
  const cableLabel =
    child.category === 'LDB'
      ? lineStyle === 'raw'
        ? '2P Raw LDB Circuit'
        : '2P LDB Circuit'
      : lineStyle === 'raw'
      ? '4P Sub-Main'
      : '4P Emg. Sub-Main';

  const newEdge: SldEdge = {
    id: `edge-man-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    fromNodeId: newParent.id,
    fromPort: chosenPort,
    toNodeId: child.id,
    toPort: 'top',
    lineStyle,
    cableLabel,
    isManual: true,
  };

  const reconciled = reconcileSldDbSparesAndSizes({
    ...doc,
    nodes: nextNodes,
    edges: [...filteredEdges, newEdge],
  });
  return {
    doc: autoLayoutSldDocument(reconciled.doc, { clearAutoWaypoints: true }),
    upgradedMessages: reconciled.upgradedMessages,
  };
}

/**
 * Synchronize SLD DB reassignments, updated spare counts, and upgraded DB sizes
 * back into the Floor-Wise DB Categories & Quantity table, BOQ totals, and grand totals.
 */
export function applySldOverridesToMcbDbResult(
  baseResult: McbDbCalculationResult,
  sldDoc: SldDocument | null,
  settings: McbDbSettings
): McbDbCalculationResult {
  if (!sldDoc) return baseResult;
  const sig = computeMcbDbScheduleSignature(baseResult);
  if (sldDoc.scheduleSignature && sldDoc.scheduleSignature !== sig) {
    return baseResult;
  }

  const reconciled = reconcileSldDbSparesAndSizes(sldDoc).doc;
  const dbNodes = reconciled.nodes.filter((n) => n.kind === 'db');
  if (dbNodes.length === 0) return baseResult;

  const sparePct = settings.sparePercent >= 0 ? settings.sparePercent : 20;
  const nodeMap = new Map(reconciled.nodes.map((n) => [n.id, n]));

  // Keep Switch Board entries directly from baseResult
  const switchBoardEntries = baseResult.tableEntries.filter(
    (e) => e.category === 'Switch Board'
  );

  // Group SLD DB nodes by (isCommon, floorScope, category, sizeCode)
  interface DbAgg {
    isCommon: boolean;
    floorScope: string;
    category: Exclude<DbCategoryType, 'Switch Board'>;
    sizeCode: string;
    incomingType: string;
    qty: number;
    providedWays: number;
    usedWays: number;
    spareWays: number;
    childCount: number;
    directUsed: number;
    upgradedCount: number;
  }

  const groupMap = new Map<string, DbAgg>();
  for (const n of dbNodes) {
    const cat = n.category as Exclude<DbCategoryType, 'Switch Board'>;
    const isCommon = Boolean(n.isCommon);
    const floorScope = isCommon
      ? cat === 'Emergency PDB'
        ? 'Common (Consolidated Single-LDB Floors)'
        : cat === 'Emergency VTPNDB'
        ? 'Common (Consolidated Single-PDB Floors)'
        : 'Common (Consolidated Single-Raw-PDB Floors)'
      : n.floorName || n.scope;

    const opt = getCatalogOptionForNode(cat, n.sizeCode);
    const cap = n.capacityWays ?? opt?.ways ?? 0;
    const used = n.usedWays ?? Math.max(0, cap - (n.spareCount ?? 0));
    const spare = n.spareCount ?? Math.max(0, cap - used);

    const childIds = new Set<string>();
    for (const e of reconciled.edges) {
      if (e.fromNodeId === n.id && e.toNodeId) {
        const tgt = nodeMap.get(e.toNodeId);
        if (tgt?.kind === 'db' && isDbParentChildPair(cat, tgt.category)) {
          childIds.add(tgt.id);
        }
      }
    }
    const directUsed = n.directUsedWays ?? Math.max(0, used - childIds.size);
    const upgraded = n.baseCapacityWays !== undefined && cap > n.baseCapacityWays ? 1 : 0;

    const key = `${isCommon ? 'CMN' : floorScope}__${cat}__${n.sizeCode}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.qty += 1;
      existing.providedWays += cap;
      existing.usedWays += used;
      existing.spareWays += spare;
      existing.childCount += childIds.size;
      existing.directUsed += directUsed;
      existing.upgradedCount += upgraded;
    } else {
      groupMap.set(key, {
        isCommon,
        floorScope,
        category: cat,
        sizeCode: n.sizeCode,
        incomingType: n.incomingType || opt?.incoming || '',
        qty: 1,
        providedWays: cap,
        usedWays: used,
        spareWays: spare,
        childCount: childIds.size,
        directUsed,
        upgradedCount: upgraded,
      });
    }
  }

  // Compute total used per (isCommon, floorScope, category) for baseWays/reqWaysWithSpare
  const catScopeUsed = new Map<string, number>();
  for (const agg of groupMap.values()) {
    const k = `${agg.isCommon ? 'CMN' : agg.floorScope}__${agg.category}`;
    catScopeUsed.set(k, (catScopeUsed.get(k) || 0) + agg.usedWays);
  }

  const dbEntries: FloorDbTableEntry[] = [];
  for (const [key, agg] of groupMap.entries()) {
    const scopeCatKey = `${agg.isCommon ? 'CMN' : agg.floorScope}__${agg.category}`;
    const totalScopeUsed = catScopeUsed.get(scopeCatKey) ?? agg.usedWays;
    const isVtpn =
      agg.category === 'Emergency VTPNDB' || agg.category === 'Raw VTPNDB';
    const wayUnit: FloorDbTableEntry['wayUnit'] = isVtpn ? '3P Ways' : 'SP Ways';
    const reqWaysWithSpare =
      totalScopeUsed > 0 ? Math.ceil(totalScopeUsed * (1 + sparePct / 100)) : 0;

    const baseNoteParts: string[] = [];
    if (agg.category === 'LDB') {
      baseNoteParts.push(`${agg.usedWays} used / ${agg.spareWays} spare SP ways`);
    } else if (isVtpn) {
      baseNoteParts.push(`${agg.childCount} connected PDB(s)`);
    } else {
      baseNoteParts.push(
        `${agg.childCount} connected LDB(s) + ${agg.directUsed} direct = ${agg.usedWays} used`
      );
    }
    if (agg.upgradedCount > 0) {
      baseNoteParts.push(`Upgraded to ${agg.sizeCode} (spare hit 0)`);
    }

    dbEntries.push({
      id: `sld-${key}`,
      scope: agg.floorScope,
      isCommon: agg.isCommon,
      category: agg.category,
      incomingType: agg.incomingType,
      sizeCode: agg.sizeCode,
      qty: agg.qty,
      baseWays: totalScopeUsed,
      reqWaysWithSpare,
      providedWays: agg.providedWays,
      usedWays: agg.usedWays,
      spareWays: agg.spareWays,
      wayUnit,
      basisNote: baseNoteParts.join(' · '),
    });
  }

  // Sort combined table entries cleanly by floor order -> Common panels -> category order
  const floorOrder = baseResult.floors.map((f) => f.floorName);
  const catOrder: DbCategoryType[] = [
    'Switch Board',
    'LDB',
    'Emergency PDB',
    'Raw PDB',
    'Emergency VTPNDB',
    'Raw VTPNDB',
  ];

  const tableEntries = [...switchBoardEntries, ...dbEntries].sort((a, b) => {
    if (a.isCommon !== b.isCommon) return a.isCommon ? 1 : -1;
    if (!a.isCommon) {
      const fDiff = floorOrder.indexOf(a.scope) - floorOrder.indexOf(b.scope);
      if (fDiff !== 0) return fDiff;
    }
    const cDiff = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
    if (cDiff !== 0) return cDiff;
    return a.sizeCode.localeCompare(b.sizeCode, undefined, { numeric: true });
  });

  // Recompute BOQ totals & grand totals
  const boqMap = new Map<string, CategoryBoqTotal>();
  for (const entry of tableEntries) {
    const k = `${entry.category}__${entry.sizeCode}`;
    const existing = boqMap.get(k);
    if (existing) {
      existing.totalQty += entry.qty;
      existing.totalProvidedWays += entry.providedWays;
    } else {
      boqMap.set(k, {
        category: entry.category,
        incomingType: entry.incomingType,
        sizeCode: entry.sizeCode,
        totalQty: entry.qty,
        totalProvidedWays: entry.providedWays,
        wayUnit: entry.wayUnit,
      });
    }
  }

  const boqTotals = Array.from(boqMap.values()).sort((a, b) => {
    const catDiff = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.sizeCode.localeCompare(b.sizeCode, undefined, { numeric: true });
  });

  const sumByCat = (cat: DbCategoryType) =>
    tableEntries
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + e.qty, 0);

  return {
    ...baseResult,
    tableEntries,
    boqTotals,
    grandTotals: {
      switchBoards: sumByCat('Switch Board'),
      ldb: sumByCat('LDB'),
      emgPdb: sumByCat('Emergency PDB'),
      rawPdb: sumByCat('Raw PDB'),
      emgVtpndb: sumByCat('Emergency VTPNDB'),
      rawVtpndb: sumByCat('Raw VTPNDB'),
    },
  };
}

export function createManualSwitchNode(
  kind: 'main-switch' | 'changeover-switch',
  x: number,
  y: number,
  existingNodes: SldNode[]
): SldNode {
  const count = existingNodes.filter((n) => n.kind === kind).length + 1;
  const isMain = kind === 'main-switch';
  return {
    id: `manual-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    category: isMain ? 'Main Switch' : 'Changeover Switch',
    code: isMain ? `MS-${count}` : `COS-${count}`,
    title: isMain ? `Main Switch #${count}` : `Changeover Switch #${count}`,
    scope: isMain ? 'Manual Switch Block' : 'Mains / DG Transfer',
    sizeCode: isMain ? '4P MCCB / SFU' : '4P Changeover',
    incomingType: isMain ? 'Single Supply' : 'Dual Supply',
    waysLabel: isMain ? 'Isolator / Breaker' : 'Auto / Manual COS',
    ratingText: isMain ? '160A 4P MCCB' : '160A 4P COS',
    x: snapToGrid(x - SW_BOX_W / 2),
    y: snapToGrid(y - SW_BOX_H / 2),
    width: SW_BOX_W,
    height: SW_BOX_H,
    isManual: true,
  };
}

export function createManualBusbarNode(
  x: number,
  y: number,
  existingNodes: SldNode[]
): SldNode {
  const count = existingNodes.filter((n) => n.kind === 'busbar-chamber').length + 1;
  return {
    id: `manual-busbar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'busbar-chamber',
    category: 'Busbar Chamber',
    code: `BUSBAR-${count}`,
    title: `Busbar Chamber #${count}`,
    scope: 'Copper Busbar Chamber',
    sizeCode: '400A TPN + N',
    incomingType: '415V 3Ph 4W Bus',
    waysLabel: '2 Outgoing Switch Nodes',
    ratingText: '400A TPN Cu Busbar',
    outgoingNodes: [
      { id: 'og-1', label: 'OG-MS1' },
      { id: 'og-2', label: 'OG-MS2' },
    ],
    x: snapToGrid(x - BUSBAR_BOX_W / 2),
    y: snapToGrid(y - BUSBAR_BOX_H / 2),
    width: BUSBAR_BOX_W,
    height: BUSBAR_BOX_H,
    isManual: true,
  };
}

export function computeGroupBounds(
  group: SldGroup,
  nodeMap: Map<string, SldNode>
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  for (const id of group.nodeIds) {
    const n = nodeMap.get(id);
    if (!n) continue;
    count++;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  if (count === 0) return null;

  const padX = 24;
  const padTop = 36;
  const padBottom = 22;
  return {
    x: minX - padX,
    y: minY - padTop,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padTop + padBottom,
  };
}

const CATEGORY_LAYOUT_ORDER: Record<SldNodeCategory, number> = {
  'Utility Mains': 0,
  'DG Backup': 1,
  'Main Switch': 2,
  'Busbar Chamber': 3,
  'Changeover Switch': 4,
  'Emergency VTPNDB': 5,
  'Raw VTPNDB': 6,
  'Emergency PDB': 7,
  'Raw PDB': 8,
  LDB: 9,
};

function getFloorSortTuple(floorLabel: string, isCommon?: boolean): [number, number, string] {
  if (isCommon) return [-1000, 0, 'common panel'];
  const s = floorLabel.trim().toLowerCase();
  if (!s) return [500, 0, ''];
  if (s === 'common panel' || s.startsWith('common (')) return [-1000, 0, s];

  const baseMatch = s.match(/^(?:b|basement)\s*-?\s*(\d+)?/i);
  if (baseMatch) {
    const num = baseMatch[1] ? parseInt(baseMatch[1], 10) : 1;
    return [-200 + num, 0, s];
  }
  if (/stilt|parking|podium/.test(s)) return [-50, 0, s];
  if (/lower\s*ground|\blg\b/.test(s)) return [-30, 0, s];
  if (/^(?:gf|g\.?f\.?|ground(?:\s*floor)?)$/.test(s)) return [0, 0, s];
  if (/upper\s*ground|\bug\b/.test(s)) return [0, 5, s];
  if (/mezzanine|\bmezz\b/.test(s)) return [0, 8, s];

  const floorMatch = s.match(/^(?:f|fl|floor)?\s*(\d+)(?:st|nd|rd|th)?(?:\s*floor)?/i);
  if (floorMatch) {
    return [parseInt(floorMatch[1], 10), 0, s];
  }
  if (/terrace|roof|mumty/.test(s)) return [900, 0, s];
  return [500, 0, s];
}

function compareFloorKeys(
  a: { floorLabel: string; isCommon?: boolean },
  b: { floorLabel: string; isCommon?: boolean }
): number {
  const ta = getFloorSortTuple(a.floorLabel, a.isCommon);
  const tb = getFloorSortTuple(b.floorLabel, b.isCommon);
  if (ta[0] !== tb[0]) return ta[0] - tb[0];
  if (ta[1] !== tb[1]) return ta[1] - tb[1];
  return ta[2].localeCompare(tb[2], undefined, { numeric: true });
}

function isLateralPort(port?: SldPortSide): boolean {
  return port === 'left' || port === 'right';
}

/**
 * Hierarchy-aware Strict Horizontal Floor-Row Auto-Layout for Single Line Diagrams.
 * - Arranges Upstream Sources & Switchgear (L.T. PANEL) top-down by topological connection depth.
 * - Groups all Distribution Boards into strict horizontal floor rows ordered logically (Common -> Basement -> Ground -> 1..N -> Terrace).
 * - Orders nodes inside each row using parent/child connection barycenters to minimize feeder crossings.
 * - Guarantees zero box-to-box and group-enclosure overlaps, clears outdated auto-routed waypoints, and resizes canvas bounds cleanly.
 */
export function autoLayoutSldDocument(
  doc: SldDocument,
  options?: { clearAutoWaypoints?: boolean }
): SldDocument {
  if (doc.nodes.length === 0) return doc;

  const clonedNodes: SldNode[] = doc.nodes.map((n) => ({ ...n }));
  const nodeMap = new Map(clonedNodes.map((n) => [n.id, n]));
  const groups = doc.groups || [];

  // Map each node to its group membership signature for overlap-free group border padding
  const nodeGroupKey = new Map<string, string>();
  const nodeGroupSet = new Map<string, Set<string>>();
  for (const n of clonedNodes) {
    const gIds = groups.filter((g) => g.nodeIds.includes(n.id)).map((g) => g.id).sort();
    nodeGroupKey.set(n.id, gIds.join('|'));
    nodeGroupSet.set(n.id, new Set(gIds));
  }

  // Build valid connected edges (ignoring self-loops)
  const validEdges = doc.edges.filter(
    (e) =>
      e.fromNodeId &&
      e.toNodeId &&
      e.fromNodeId !== e.toNodeId &&
      nodeMap.has(e.fromNodeId) &&
      nodeMap.has(e.toNodeId)
  );

  const incomingEdges = new Map<string, SldEdge[]>();
  const outgoingEdges = new Map<string, SldEdge[]>();
  for (const e of validEdges) {
    const inList = incomingEdges.get(e.toNodeId!) || [];
    inList.push(e);
    incomingEdges.set(e.toNodeId!, inList);

    const outList = outgoingEdges.get(e.fromNodeId!) || [];
    outList.push(e);
    outgoingEdges.set(e.fromNodeId!, outList);
  }

  // Determine which non-DB nodes have a DB ancestor (e.g., manual switch wired downstream of a DB)
  const hasDbAncestor = new Set<string>();
  const dbQueue = clonedNodes.filter((n) => n.kind === 'db').map((n) => n.id);
  const visitedFromDb = new Set<string>(dbQueue);
  while (dbQueue.length > 0) {
    const curId = dbQueue.shift()!;
    for (const e of outgoingEdges.get(curId) || []) {
      const nextId = e.toNodeId!;
      if (!visitedFromDb.has(nextId)) {
        visitedFromDb.add(nextId);
        const target = nodeMap.get(nextId);
        if (target && target.kind !== 'db') {
          hasDbAncestor.add(nextId);
        }
        dbQueue.push(nextId);
      }
    }
  }

  const upstreamNodes = clonedNodes.filter(
    (n) => n.kind !== 'db' && !hasDbAncestor.has(n.id)
  );
  const upstreamIds = new Set(upstreamNodes.map((n) => n.id));
  const dbNodes = clonedNodes.filter((n) => n.kind === 'db');
  const downstreamSwitchNodes = clonedNodes.filter(
    (n) => n.kind !== 'db' && hasDbAncestor.has(n.id)
  );

  // 1. Topological vertical layering for Upstream Switchgear & Sources
  const upRank = new Map<string, number>();
  for (const n of upstreamNodes) {
    upRank.set(n.id, n.kind === 'source' ? 0 : 1);
  }

  const maxIters = Math.max(1, upstreamNodes.length * 2);
  for (let iter = 0; iter < maxIters; iter++) {
    let changed = false;
    for (const e of validEdges) {
      const u = e.fromNodeId!;
      const v = e.toNodeId!;
      if (!upstreamIds.has(u) || !upstreamIds.has(v)) continue;
      const ru = upRank.get(u) ?? 0;
      const rv = upRank.get(v) ?? 0;
      const lateral = isLateralPort(e.fromPort) || isLateralPort(e.toPort);
      const targetRank = lateral ? ru : ru + 1;
      if (targetRank > rv) {
        upRank.set(v, targetRank);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Keep lateral pairs in the exact same row (equalize to max rank of the lateral pair)
  for (let iter = 0; iter < upstreamNodes.length; iter++) {
    let changed = false;
    for (const e of validEdges) {
      const u = e.fromNodeId!;
      const v = e.toNodeId!;
      if (!upstreamIds.has(u) || !upstreamIds.has(v)) continue;
      if (isLateralPort(e.fromPort) || isLateralPort(e.toPort)) {
        const m = Math.max(upRank.get(u) ?? 0, upRank.get(v) ?? 0);
        if (upRank.get(u) !== m) {
          upRank.set(u, m);
          changed = true;
        }
        if (upRank.get(v) !== m) {
          upRank.set(v, m);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  const distinctUpRanks = Array.from(new Set(upRank.values())).sort((a, b) => a - b);
  const upRows: SldNode[][] = distinctUpRanks.map((r) =>
    upstreamNodes.filter((n) => upRank.get(n.id) === r)
  );

  // 2. Strict Horizontal Floor Rows for DBs
  const floorGroups = new Map<
    string,
    { floorLabel: string; isCommon: boolean; nodes: SldNode[] }
  >();
  for (const n of dbNodes) {
    const isCommon = Boolean(n.isCommon);
    const label = isCommon ? 'Common Panel' : (n.floorName || n.scope || 'Floor').trim();
    const key = isCommon ? '__COMMON__' : label.toLowerCase();
    const bucket = floorGroups.get(key);
    if (bucket) {
      bucket.nodes.push(n);
    } else {
      floorGroups.set(key, { floorLabel: label, isCommon, nodes: [n] });
    }
  }

  const sortedFloorBuckets = Array.from(floorGroups.values()).sort((a, b) =>
    compareFloorKeys(a, b)
  );

  const floorIndexMap = new Map<string, number>();
  sortedFloorBuckets.forEach((b, idx) => {
    for (const n of b.nodes) {
      floorIndexMap.set(n.id, idx);
    }
  });

  // Attach any downstream manual switches after the floor row of their deepest parent DB
  const afterFloorAux = new Map<number, SldNode[]>();
  for (const n of downstreamSwitchNodes) {
    let maxParentFloor = sortedFloorBuckets.length - 1;
    // BFS backwards to find nearest DB ancestor
    const q = [n.id];
    const seen = new Set<string>([n.id]);
    let foundFloor = -1;
    while (q.length > 0) {
      const cur = q.shift()!;
      for (const e of incomingEdges.get(cur) || []) {
        const pId = e.fromNodeId!;
        if (floorIndexMap.has(pId)) {
          foundFloor = Math.max(foundFloor, floorIndexMap.get(pId)!);
        } else if (!seen.has(pId)) {
          seen.add(pId);
          q.push(pId);
        }
      }
    }
    if (foundFloor >= 0) maxParentFloor = foundFloor;
    const list = afterFloorAux.get(maxParentFloor) || [];
    list.push(n);
    afterFloorAux.set(maxParentFloor, list);
  }

  const rows: SldNode[][] = [...upRows];
  const isDbRow: boolean[] = upRows.map(() => false);
  sortedFloorBuckets.forEach((b, idx) => {
    rows.push(b.nodes);
    isDbRow.push(true);
    const aux = afterFloorAux.get(idx);
    if (aux && aux.length > 0) {
      rows.push(aux);
      isDbRow.push(false);
    }
  });

  // Track which row index each node belongs to
  const nodeRowIdx = new Map<string, number>();
  rows.forEach((rowNodes, rIdx) => {
    for (const n of rowNodes) {
      nodeRowIdx.set(n.id, rIdx);
    }
  });

  // Helper: compute horizontal minimum gap between adjacent nodes in the same row
  const minGapBetween = (a: SldNode, b: SldNode): number => {
    const base = 60;
    const ga = nodeGroupKey.get(a.id) || '';
    const gb = nodeGroupKey.get(b.id) || '';
    if (ga !== gb) {
      // Extra margin so group dashed border (padX=24) never touches adjacent blocks
      return 100;
    }
    return base;
  };

  // Helper: pack nodes horizontally around target X centers with strict zero-overlap
  const packRowHorizontally = (
    rowNodes: SldNode[],
    desiredCenterX: Map<string, number>,
    fallbackCenterX: number
  ) => {
    if (rowNodes.length === 0) return;
    // Total minimal span
    let minTotalW = rowNodes.reduce((s, n) => s + n.width, 0);
    for (let i = 0; i < rowNodes.length - 1; i++) {
      minTotalW += minGapBetween(rowNodes[i], rowNodes[i + 1]);
    }

    // Initial placement: respect desiredCenterX while enforcing left-to-right non-overlap
    let cursor = snapToGrid(fallbackCenterX - minTotalW / 2);
    for (let i = 0; i < rowNodes.length; i++) {
      const n = rowNodes[i];
      const targetCenter = desiredCenterX.get(n.id);
      const desiredLeft =
        targetCenter !== undefined ? snapToGrid(targetCenter - n.width / 2) : cursor;
      const minLeft =
        i === 0
          ? desiredLeft
          : rowNodes[i - 1].x + rowNodes[i - 1].width + minGapBetween(rowNodes[i - 1], n);
      n.x = Math.max(snapToGrid(minLeft), desiredLeft);
      cursor = n.x + n.width + (i < rowNodes.length - 1 ? minGapBetween(n, rowNodes[i + 1]) : 0);
    }

    // Gentle centering balance: if row was pushed right solely by left neighbors, shift block cluster
    // so average center aligns with average desired center without violating minLeft.
    const anchoredNodes = rowNodes.filter((n) => desiredCenterX.has(n.id));
    if (anchoredNodes.length > 0 && anchoredNodes.length === rowNodes.length) {
      const avgActual =
        anchoredNodes.reduce((s, n) => s + (n.x + n.width / 2), 0) / anchoredNodes.length;
      const avgTarget =
        anchoredNodes.reduce((s, n) => s + desiredCenterX.get(n.id)!, 0) / anchoredNodes.length;
      const delta = snapToGrid(avgTarget - avgActual);
      if (delta < 0) {
        // Check if shifting left violates minGap anywhere? Shifting ALL nodes equally preserves gaps!
        for (const n of rowNodes) {
          n.x = snapToGrid(n.x + delta);
        }
      }
    }
  };

  // Seed provisional X for row 0 before top-down barycenter sweep
  const seedCenter = 700;
  for (let r = 0; r < rows.length; r++) {
    const rowNodes = rows[r];
    const parentTargetX = new Map<string, number>();

    // Determine lateral constraints within this row (e.g. sw-out-ess.right -> sw-cos-1.left)
    const lateralRightOf = new Map<string, Set<string>>();
    for (const e of validEdges) {
      const u = e.fromNodeId!;
      const v = e.toNodeId!;
      if (nodeRowIdx.get(u) !== r || nodeRowIdx.get(v) !== r) continue;
      if (e.fromPort === 'right' || e.toPort === 'left') {
        const set = lateralRightOf.get(u) || new Set<string>();
        set.add(v);
        lateralRightOf.set(u, set);
      } else if (e.fromPort === 'left' || e.toPort === 'right') {
        const set = lateralRightOf.get(v) || new Set<string>();
        set.add(u);
        lateralRightOf.set(v, set);
      }
    }

    for (const n of rowNodes) {
      const parentXs: number[] = [];
      for (const e of incomingEdges.get(n.id) || []) {
        const pId = e.fromNodeId!;
        const pRow = nodeRowIdx.get(pId);
        if (pRow !== undefined && pRow < r) {
          const pNode = nodeMap.get(pId)!;
          parentXs.push(getNodePortPoint(pNode, e.fromPort || 'bottom').x);
        }
      }
      if (parentXs.length > 0) {
        parentTargetX.set(
          n.id,
          parentXs.reduce((s, v) => s + v, 0) / parentXs.length
        );
      }
    }

    // Sort nodes inside row r by lateral constraints, parent X barycenter, category order, and code
    rowNodes.sort((a, b) => {
      if (lateralRightOf.get(a.id)?.has(b.id)) return -1;
      if (lateralRightOf.get(b.id)?.has(a.id)) return 1;

      const ax = parentTargetX.get(a.id);
      const bx = parentTargetX.get(b.id);
      if (ax !== undefined && bx !== undefined && Math.abs(ax - bx) > 10) {
        return ax - bx;
      }
      if (ax !== undefined && bx === undefined) return -1;
      if (ax === undefined && bx !== undefined) return 1;

      const ca = CATEGORY_LAYOUT_ORDER[a.category] ?? 99;
      const cb = CATEGORY_LAYOUT_ORDER[b.category] ?? 99;
      if (ca !== cb) return ca - cb;

      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });

    packRowHorizontally(rowNodes, parentTargetX, seedCenter);
  }

  // 3. Bottom-up refinement pass for Upstream rows (aligns Utility Mains above Incoming Switch,
  // DG Backup above Changeover Switch, Busbar above Outgoing Switches, etc.)
  for (let r = upRows.length - 1; r >= 0; r--) {
    const rowNodes = rows[r];
    const childTargetX = new Map<string, number>();

    for (const n of rowNodes) {
      const childXs: number[] = [];
      for (const e of outgoingEdges.get(n.id) || []) {
        const cId = e.toNodeId!;
        const cRow = nodeRowIdx.get(cId);
        if (cRow !== undefined && cRow > r) {
          const cNode = nodeMap.get(cId)!;
          // Offset by outgoing port delta from node center so multi-port parents center between their ports
          const portRelX = getNodePortPoint({ ...n, x: 0, y: 0 }, e.fromPort || 'bottom').x;
          const desiredNodeCenter = cNode.x + cNode.width / 2 - (portRelX - n.width / 2);
          childXs.push(desiredNodeCenter);
        }
      }
      if (childXs.length > 0) {
        childTargetX.set(n.id, childXs.reduce((s, v) => s + v, 0) / childXs.length);
      }
    }

    if (childTargetX.size > 0) {
      // Re-order only if nodes aren't laterally locked
      rowNodes.sort((a, b) => {
        const ax = childTargetX.get(a.id);
        const bx = childTargetX.get(b.id);
        if (ax !== undefined && bx !== undefined && Math.abs(ax - bx) > 10) {
          return ax - bx;
        }
        return a.x - b.x;
      });
      packRowHorizontally(rowNodes, childTargetX, seedCenter);
    }
  }

  // 4. Normalize horizontal origin so every node & group sits safely inside CAD border (x >= 80)
  let minNodeX = Infinity;
  let maxNodeX = -Infinity;
  for (const n of clonedNodes) {
    const hasGrp = (nodeGroupSet.get(n.id)?.size || 0) > 0;
    minNodeX = Math.min(minNodeX, n.x - (hasGrp ? 28 : 0));
    maxNodeX = Math.max(maxNodeX, n.x + n.width + (hasGrp ? 28 : 0));
  }
  const targetLeftMargin = 80;
  const shiftX = snapToGrid(targetLeftMargin - minNodeX);
  for (const n of clonedNodes) {
    n.x = snapToGrid(n.x + shiftX);
  }

  // Center rows that have NO parent anchors (or upstream centered cluster) cleanly across final width
  const finalContentSpan = Math.max(1140, maxNodeX - minNodeX);
  const diagramCenterX = snapToGrid(targetLeftMargin + finalContentSpan / 2);
  for (let r = 0; r < rows.length; r++) {
    const rowNodes = rows[r];
    if (rowNodes.length === 0) continue;
    const hasConnectedRef = rowNodes.some((n) => {
      const hasUp = (incomingEdges.get(n.id) || []).some((e) => (nodeRowIdx.get(e.fromNodeId!) ?? r) < r);
      const hasDown = (outgoingEdges.get(n.id) || []).some((e) => (nodeRowIdx.get(e.toNodeId!) ?? r) > r);
      return hasUp || hasDown;
    });
    if (!hasConnectedRef) {
      const rMin = Math.min(...rowNodes.map((n) => n.x));
      const rMax = Math.max(...rowNodes.map((n) => n.x + n.width));
      const rShift = snapToGrid(diagramCenterX - (rMin + rMax) / 2);
      if (rMin + rShift >= targetLeftMargin) {
        for (const n of rowNodes) {
          n.x = snapToGrid(n.x + rShift);
        }
      }
    }
  }

  // 5. Assign strict horizontal row Y coordinates with group-enclosure & inter-row wiring clearance
  let curY = 64;
  for (let r = 0; r < rows.length; r++) {
    const rowNodes = rows[r];
    if (rowNodes.length === 0) continue;
    const rowY = snapToGrid(curY);
    let rowMaxH = 0;
    for (const n of rowNodes) {
      n.y = rowY;
      rowMaxH = Math.max(rowMaxH, n.height);
    }

    if (r < rows.length - 1) {
      const nextRow = rows[r + 1];
      let gap = isDbRow[r] && isDbRow[r + 1] ? 104 : !isDbRow[r] && !isDbRow[r + 1] ? 84 : 116;

      // Group enclosure boundary padding (padBottom=22, padTop=36)
      const curGrps = new Set<string>();
      const nextGrps = new Set<string>();
      rowNodes.forEach((n) => nodeGroupSet.get(n.id)?.forEach((g) => curGrps.add(g)));
      nextRow.forEach((n) => nodeGroupSet.get(n.id)?.forEach((g) => nextGrps.add(g)));

      const groupEndsHere = Array.from(curGrps).some((g) => !nextGrps.has(g));
      const groupStartsNext = Array.from(nextGrps).some((g) => !curGrps.has(g));
      if (groupEndsHere) gap += 28;
      if (groupStartsNext) gap += 44;

      // Extra vertical channel room when many feeders cross between these rows
      const curIds = new Set(rowNodes.map((n) => n.id));
      const nextIds = new Set(nextRow.map((n) => n.id));
      const crossCount = validEdges.filter(
        (e) =>
          (curIds.has(e.fromNodeId!) && nextIds.has(e.toNodeId!)) ||
          (curIds.has(e.fromNodeId!) && (nodeRowIdx.get(e.toNodeId!) ?? -1) > r)
      ).length;
      if (crossCount > 4) {
        gap += Math.min(48, Math.floor((crossCount - 4) * 5));
      }

      curY = snapToGrid(rowY + rowMaxH + gap);
    }
  }

  // 6. Compute final canvas bounds cleanly containing all nodes, groups, and bottom-right Title Block
  let maxRight = 1140;
  let maxBottom = 620;
  let bottomRightZoneBottom = 0;

  for (const n of clonedNodes) {
    maxRight = Math.max(maxRight, n.x + n.width);
    maxBottom = Math.max(maxBottom, n.y + n.height);
  }
  const laidOutMap = new Map(clonedNodes.map((n) => [n.id, n]));
  for (const grp of groups) {
    const b = computeGroupBounds(grp, laidOutMap);
    if (b) {
      maxRight = Math.max(maxRight, b.x + b.width);
      maxBottom = Math.max(maxBottom, b.y + b.height);
    }
  }

  const canvasWidth = Math.max(1340, snapToGrid(maxRight + 100));
  for (const n of clonedNodes) {
    if (n.x + n.width > canvasWidth - 480) {
      bottomRightZoneBottom = Math.max(bottomRightZoneBottom, n.y + n.height);
    }
  }
  const minHeightForTitleBlock =
    bottomRightZoneBottom > 0 ? bottomRightZoneBottom + 160 : maxBottom + 140;
  const canvasHeight = Math.max(
    880,
    snapToGrid(Math.max(maxBottom + 140, minHeightForTitleBlock))
  );

  const shouldClearWaypoints = options?.clearAutoWaypoints !== false;
  const nextEdges = shouldClearWaypoints
    ? doc.edges.map((e) =>
        e.fromNodeId && e.toNodeId && e.waypoints?.length
          ? { ...e, waypoints: undefined }
          : e
      )
    : doc.edges;

  return {
    ...doc,
    nodes: clonedNodes,
    edges: nextEdges,
    canvasWidth,
    canvasHeight,
  };
}

export function getFloorSummariesCount(floors: FloorDbSummary[]): number {
  return floors.length;
}
