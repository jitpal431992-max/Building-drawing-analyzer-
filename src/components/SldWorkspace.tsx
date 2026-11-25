import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CornerDownRight,
  Cpu,
  Download,
  Grid,
  Hand,
  Layers,
  LayoutGrid,
  Magnet,
  Maximize2,
  Minimize2,
  MousePointer,
  PenLine,
  Plus,
  PlusSquare,
  Redo2,
  RefreshCw,
  RotateCcw,
  Scissors,
  Sliders,
  ToggleLeft,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  GRID_SIZE,
  SldDocument,
  SldEdge,
  SldGroup,
  SldLineStyle,
  SldNode,
  SldNodeCategory,
  SldOutgoingNode,
  SldPoint,
  SldPortSide,
  autoLayoutSldDocument,
  computeEdgeTrunkRatios,
  computeGroupBounds,
  computeOrthogonalPath,
  createManualBusbarNode,
  createManualSwitchNode,
  defaultBreakerRating,
  findNearestNodePort,
  getAllNodePorts,
  getCatalogForCategory,
  getCatalogOptionForNode,
  getNodePortPoint,
  insertBendOnSegment,
  isDbParentChildPair,
  moveOrthogonalSegment,
  projectPointOntoPolyline,
  reassignDbParentInSld,
  reconcileSldDbSparesAndSizes,
  snapToGrid,
  splitEdgeAtPoint,
} from '../utils/sldGenerator';
import { exportSldToPdf } from '../utils/sldPdfExport';

type CadToolMode =
  | 'select'
  | 'pan'
  | 'insert-main-switch'
  | 'insert-changeover'
  | 'insert-busbar'
  | 'draw-line'
  | 'cut-line';

interface CadLayerColors {
  stroke: string;
  headerBg: string;
  headerText: string;
  accentText: string;
}

const DARK_LAYER_COLORS: Record<SldNodeCategory, CadLayerColors> = {
  'Utility Mains': {
    stroke: '#e2e8f0',
    headerBg: '#cbd5e1',
    headerText: '#0b0f14',
    accentText: '#e2e8f0',
  },
  'DG Backup': {
    stroke: '#fb923c',
    headerBg: '#fb923c',
    headerText: '#0b0f14',
    accentText: '#fdba74',
  },
  'Main Switch': {
    stroke: '#f8fafc',
    headerBg: '#f1f5f9',
    headerText: '#0b0f14',
    accentText: '#f8fafc',
  },
  'Changeover Switch': {
    stroke: '#c084fc',
    headerBg: '#c084fc',
    headerText: '#0b0f14',
    accentText: '#d8b4fe',
  },
  'Busbar Chamber': {
    stroke: '#38bdf8',
    headerBg: '#38bdf8',
    headerText: '#0b0f14',
    accentText: '#7dd3fc',
  },
  'Emergency VTPNDB': {
    stroke: '#fb923c',
    headerBg: '#fb923c',
    headerText: '#0b0f14',
    accentText: '#fdba74',
  },
  'Raw VTPNDB': {
    stroke: '#34d399',
    headerBg: '#34d399',
    headerText: '#0b0f14',
    accentText: '#6ee7b7',
  },
  'Emergency PDB': {
    stroke: '#fbbf24',
    headerBg: '#fbbf24',
    headerText: '#0b0f14',
    accentText: '#fcd34d',
  },
  'Raw PDB': {
    stroke: '#38bdf8',
    headerBg: '#38bdf8',
    headerText: '#0b0f14',
    accentText: '#7dd3fc',
  },
  LDB: {
    stroke: '#22d3ee',
    headerBg: '#22d3ee',
    headerText: '#0b0f14',
    accentText: '#67e8f9',
  },
};

const LIGHT_LAYER_COLORS: Record<SldNodeCategory, CadLayerColors> = {
  'Utility Mains': {
    stroke: '#1e293b',
    headerBg: '#1e293b',
    headerText: '#ffffff',
    accentText: '#0f172a',
  },
  'DG Backup': {
    stroke: '#c2410c',
    headerBg: '#c2410c',
    headerText: '#ffffff',
    accentText: '#9a3412',
  },
  'Main Switch': {
    stroke: '#0f172a',
    headerBg: '#0f172a',
    headerText: '#ffffff',
    accentText: '#0f172a',
  },
  'Changeover Switch': {
    stroke: '#6d28d9',
    headerBg: '#6d28d9',
    headerText: '#ffffff',
    accentText: '#5b21b6',
  },
  'Busbar Chamber': {
    stroke: '#0369a1',
    headerBg: '#0369a1',
    headerText: '#ffffff',
    accentText: '#075985',
  },
  'Emergency VTPNDB': {
    stroke: '#c2410c',
    headerBg: '#c2410c',
    headerText: '#ffffff',
    accentText: '#9a3412',
  },
  'Raw VTPNDB': {
    stroke: '#047857',
    headerBg: '#047857',
    headerText: '#ffffff',
    accentText: '#065f46',
  },
  'Emergency PDB': {
    stroke: '#b45309',
    headerBg: '#b45309',
    headerText: '#ffffff',
    accentText: '#92400e',
  },
  'Raw PDB': {
    stroke: '#0369a1',
    headerBg: '#0369a1',
    headerText: '#ffffff',
    accentText: '#075985',
  },
  LDB: {
    stroke: '#0e7490',
    headerBg: '#0e7490',
    headerText: '#ffffff',
    accentText: '#155e75',
  },
};

interface SldWorkspaceProps {
  doc: SldDocument;
  onChangeDoc: (nextDoc: SldDocument) => void;
  onRegenerate: (preserveManual: boolean) => void;
  onNotify?: (msg: string) => void;
}

interface DraftLineState {
  fromNodeId?: string;
  fromPort?: SldPortSide;
  freeStart?: SldPoint;
  waypoints: SldPoint[];
}

export const SldWorkspace: React.FC<SldWorkspaceProps> = ({
  doc,
  onChangeDoc,
  onRegenerate,
  onNotify,
}) => {
  const [tool, setTool] = useState<CadToolMode>('select');
  const [cadPlotMode, setCadPlotMode] = useState<'dark' | 'light'>('dark');
  const [isExpanded, setIsExpanded] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [nodeSnapEnabled, setNodeSnapEnabled] = useState(true);
  const [preserveManualOnRegen, setPreserveManualOnRegen] = useState(true);
  const [activeLineStyle, setActiveLineStyle] = useState<SldLineStyle>('main');

  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState<SldPoint>({ x: 24, y: 20 });
  const zoomPanRef = useRef({ zoom: 0.85, pan: { x: 24, y: 20 } });

  const [cutMode, setCutMode] = useState<'split' | 'remove'>('split');
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [multiSelectedNodeIds, setMultiSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState(true);
  const [newOutgoingLabel, setNewOutgoingLabel] = useState('');

  const [cursorSvgPt, setCursorSvgPt] = useState<SldPoint | null>(null);
  const [rawCursorSvgPt, setRawCursorSvgPt] = useState<SldPoint | null>(null);
  const [draftLine, setDraftLine] = useState<DraftLineState | null>(null);
  const [isDraggingEndpoint, setIsDraggingEndpoint] = useState(false);
  const [endpointSnapTarget, setEndpointSnapTarget] = useState<{
    nodeId: string;
    port: SldPortSide;
    point: SldPoint;
    label: string;
  } | null>(null);
  const [drawPortSnapTarget, setDrawPortSnapTarget] = useState<{
    nodeId: string;
    port: SldPortSide;
    point: SldPoint;
    label: string;
  } | null>(null);

  const dragNodeRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const panDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);

  const rerouteDragRef = useRef<
    | {
        type: 'segment';
        edgeId: string;
        segIndex: number;
        basePts: SldPoint[];
      }
    | {
        type: 'endpoint-start' | 'endpoint-end';
        edgeId: string;
      }
    | null
  >(null);

  const svgViewportRef = useRef<HTMLDivElement | null>(null);

  // Undo / Redo history state (tracks connections, node drags, auto-layout, and edits)
  const MAX_HISTORY = 60;
  const [past, setPast] = useState<SldDocument[]>([]);
  const [future, setFuture] = useState<SldDocument[]>([]);
  const pastRef = useRef<SldDocument[]>([]);
  const futureRef = useRef<SldDocument[]>([]);
  const docRef = useRef(doc);
  docRef.current = doc;
  const preDragDocRef = useRef<SldDocument | null>(null);
  const dragDidMutateRef = useRef(false);
  const lastTextEditMetaRef = useRef<{ key: string; ts: number } | null>(null);
  const expectingRegenRef = useRef(false);
  const lastGeneratedAtRef = useRef(doc.generatedAt);

  const setPastSynced = useCallback((nextPast: SldDocument[]) => {
    pastRef.current = nextPast;
    setPast(nextPast);
  }, []);

  const setFutureSynced = useCallback((nextFuture: SldDocument[]) => {
    futureRef.current = nextFuture;
    setFuture(nextFuture);
  }, []);

  useEffect(() => {
    if (doc.generatedAt !== lastGeneratedAtRef.current) {
      lastGeneratedAtRef.current = doc.generatedAt;
      if (expectingRegenRef.current) {
        expectingRegenRef.current = false;
      } else {
        setPastSynced([]);
        setFutureSynced([]);
        lastTextEditMetaRef.current = null;
      }
    }
  }, [doc.generatedAt, setPastSynced, setFutureSynced]);

  const pushSnapshotToPast = useCallback(
    (snapshot: SldDocument) => {
      const next = [...pastRef.current, snapshot];
      const bounded = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      setPastSynced(bounded);
      setFutureSynced([]);
    },
    [setPastSynced, setFutureSynced]
  );

  const commitDocChange = useCallback(
    (nextDoc: SldDocument, options?: { coalesceKey?: string; skipHistory?: boolean }) => {
      if (!options?.skipHistory) {
        if (options?.coalesceKey) {
          const now = Date.now();
          const last = lastTextEditMetaRef.current;
          if (last && last.key === options.coalesceKey && now - last.ts < 650) {
            last.ts = now;
          } else {
            pushSnapshotToPast(docRef.current);
            lastTextEditMetaRef.current = { key: options.coalesceKey, ts: now };
          }
        } else {
          lastTextEditMetaRef.current = null;
          pushSnapshotToPast(docRef.current);
        }
      }
      onChangeDoc(nextDoc);
    },
    [onChangeDoc, pushSnapshotToPast]
  );

  const handleUndo = useCallback(() => {
    const prevPast = pastRef.current;
    if (prevPast.length === 0) return;
    const previousDoc = prevPast[prevPast.length - 1];
    const currentSnapshot = docRef.current;
    setPastSynced(prevPast.slice(0, -1));
    setFutureSynced([currentSnapshot, ...futureRef.current].slice(0, MAX_HISTORY));
    lastTextEditMetaRef.current = null;
    onChangeDoc(previousDoc);
    onNotify?.('Undid last SLD change.');
  }, [onChangeDoc, onNotify, setPastSynced, setFutureSynced]);

  const handleRedo = useCallback(() => {
    const prevFuture = futureRef.current;
    if (prevFuture.length === 0) return;
    const [nextDoc, ...rest] = prevFuture;
    const currentSnapshot = docRef.current;
    const nextPast = [...pastRef.current, currentSnapshot];
    setPastSynced(nextPast.length > MAX_HISTORY ? nextPast.slice(nextPast.length - MAX_HISTORY) : nextPast);
    setFutureSynced(rest);
    lastTextEditMetaRef.current = null;
    onChangeDoc(nextDoc);
    onNotify?.('Redid SLD change.');
  }, [onChangeDoc, onNotify, setPastSynced, setFutureSynced]);

  useEffect(() => {
    zoomPanRef.current = { zoom, pan };
  }, [zoom, pan]);

  const layerColors = cadPlotMode === 'dark' ? DARK_LAYER_COLORS : LIGHT_LAYER_COLORS;
  const groupsList = useMemo(() => doc.groups || [], [doc.groups]);

  const nodeMap = useMemo(
    () => new Map(doc.nodes.map((n) => [n.id, n])),
    [doc.nodes]
  );

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodeMap.get(selectedNodeId) || null : null),
    [nodeMap, selectedNodeId]
  );

  const selectedEdge = useMemo(
    () => (selectedEdgeId ? doc.edges.find((e) => e.id === selectedEdgeId) || null : null),
    [doc.edges, selectedEdgeId]
  );

  const selectedGroup = useMemo(
    () => (selectedGroupId ? groupsList.find((g) => g.id === selectedGroupId) || null : null),
    [groupsList, selectedGroupId]
  );

  const trunkRatios = useMemo(
    () => computeEdgeTrunkRatios(doc.edges, nodeMap),
    [doc.edges, nodeMap]
  );

  const commitDocWithReconcile = useCallback(
    (
      nextDoc: SldDocument,
      notifyUpgrades = true,
      runAutoLayout = false,
      skipHistory = false
    ) => {
      const { doc: reconciled, upgradedMessages } = reconcileSldDbSparesAndSizes(nextDoc);
      const finalDoc = runAutoLayout
        ? autoLayoutSldDocument(reconciled, { clearAutoWaypoints: true })
        : reconciled;
      commitDocChange(finalDoc, { skipHistory });
      if (notifyUpgrades && upgradedMessages.length > 0) {
        onNotify?.(upgradedMessages.join(' '));
      }
    },
    [commitDocChange, onNotify]
  );

  const handleAutoLayout = useCallback(() => {
    const { doc: reconciled } = reconcileSldDbSparesAndSizes(doc);
    const laidOut = autoLayoutSldDocument(reconciled, { clearAutoWaypoints: true });
    commitDocChange(laidOut);
    onNotify?.('Auto-arranged blocks into strict floor rows by connection hierarchy.');
  }, [doc, commitDocChange, onNotify]);

  useEffect(() => {
    if (tool !== 'draw-line') {
      setDrawPortSnapTarget(null);
    }
  }, [tool]);

  const getLineStroke = useCallback(
    (style: SldLineStyle) => {
      if (cadPlotMode === 'dark') {
        switch (style) {
          case 'main':
            return '#e2e8f0';
          case 'raw':
            return '#34d399';
          case 'emergency':
            return '#fbbf24';
          case 'custom':
            return '#60a5fa';
        }
      }
      switch (style) {
        case 'main':
          return '#0f172a';
        case 'raw':
          return '#047857';
        case 'emergency':
          return '#b45309';
        case 'custom':
          return '#1d4ed8';
      }
    },
    [cadPlotMode]
  );

  const fitView = useCallback(() => {
    const el = svgViewportRef.current;
    const nodes = docRef.current.nodes;
    if (!el || nodes.length === 0) {
      setZoom(0.85);
      setPan({ x: 20, y: 20 });
      return;
    }
    const rect = el.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    const pad = 60;
    const contentW = Math.max(400, maxX - minX + pad * 2);
    const contentH = Math.max(300, maxY - minY + pad * 2);
    const fitZ = Math.min(
      1.15,
      Math.max(0.28, Math.min(rect.width / contentW, rect.height / contentH))
    );
    const nextZoom = Number(fitZ.toFixed(2));
    const nextPan = {
      x: (rect.width - (maxX - minX) * nextZoom) / 2 - minX * nextZoom,
      y: Math.max(16, (rect.height - (maxY - minY) * nextZoom) / 2 - minY * nextZoom),
    };
    zoomPanRef.current = { zoom: nextZoom, pan: nextPan };
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fitView(), 60);
    return () => clearTimeout(timer);
  }, [doc.generatedAt, isExpanded, fitView]);

  // Plain scroll-wheel zoom anchored at cursor without requiring Ctrl key
  useEffect(() => {
    const el = svgViewportRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { zoom: oldZoom, pan: oldPan } = zoomPanRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nextZoom = Math.min(2.5, Math.max(0.2, Number((oldZoom * factor).toFixed(3))));
      if (nextZoom === oldZoom) return;
      const worldX = (mouseX - oldPan.x) / oldZoom;
      const worldY = (mouseY - oldPan.y) / oldZoom;
      const nextPan = {
        x: mouseX - worldX * nextZoom,
        y: mouseY - worldY * nextZoom,
      };
      zoomPanRef.current = { zoom: nextZoom, pan: nextPan };
      setZoom(nextZoom);
      setPan(nextPan);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const zoomAtViewportCenter = useCallback((deltaFactor: number) => {
    const el = svgViewportRef.current;
    const { zoom: oldZoom, pan: oldPan } = zoomPanRef.current;
    const nextZoom = Math.min(2.5, Math.max(0.2, Number((oldZoom * deltaFactor).toFixed(3))));
    if (!el) {
      setZoom(nextZoom);
      return;
    }
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const worldX = (cx - oldPan.x) / oldZoom;
    const worldY = (cy - oldPan.y) / oldZoom;
    const nextPan = {
      x: cx - worldX * nextZoom,
      y: cy - worldY * nextZoom,
    };
    zoomPanRef.current = { zoom: nextZoom, pan: nextPan };
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  const clientToRawSvgPoint = useCallback(
    (clientX: number, clientY: number): SldPoint => {
      const el = svgViewportRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  const clientToSvgPoint = useCallback(
    (clientX: number, clientY: number): SldPoint => {
      const raw = clientToRawSvgPoint(clientX, clientY);
      return {
        x: snapEnabled ? snapToGrid(raw.x) : Math.round(raw.x),
        y: snapEnabled ? snapToGrid(raw.y) : Math.round(raw.y),
      };
    },
    [clientToRawSvgPoint, snapEnabled]
  );

  // Keyboard shortcuts (Ctrl/Cmd+Z Undo, Ctrl/Cmd+Y/Shift+Z Redo, Esc cancel, Enter commit line)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && !e.altKey) {
        const lower = e.key.toLowerCase();
        if (lower === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }
        if (lower === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (e.key === 'Escape') {
        if (draftLine) {
          setDraftLine(null);
          setDrawPortSnapTarget(null);
        } else if (tool !== 'select') {
          setTool('select');
          setDrawPortSnapTarget(null);
        } else if (isExpanded) {
          setIsExpanded(false);
        }
      } else if (e.key === 'Enter' && draftLine) {
        if (nodeSnapEnabled && drawPortSnapTarget) {
          const target = drawPortSnapTarget;
          const newEdge: SldEdge = {
            id: `edge-man-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            fromNodeId: draftLine.fromNodeId,
            fromPort: draftLine.fromPort,
            freeStart: draftLine.freeStart,
            toNodeId: target.nodeId,
            toPort: target.port,
            waypoints: draftLine.waypoints.length > 0 ? draftLine.waypoints : undefined,
            lineStyle: activeLineStyle,
            cableLabel:
              activeLineStyle === 'emergency'
                ? 'Emg. Feeder'
                : activeLineStyle === 'raw'
                ? 'Raw Feeder'
                : 'Main Cable',
            isManual: true,
          };
          const fromN = draftLine.fromNodeId ? nodeMap.get(draftLine.fromNodeId) : undefined;
          const toN = nodeMap.get(target.nodeId);
          let baseEdges = doc.edges;
          if (fromN && toN && isDbParentChildPair(fromN.category, toN.category)) {
            baseEdges = doc.edges.filter((ed) => {
              if (ed.toNodeId !== target.nodeId || !ed.fromNodeId) return true;
              const prevParent = nodeMap.get(ed.fromNodeId);
              return !(prevParent && isDbParentChildPair(prevParent.category, toN.category));
            });
          }
          commitDocWithReconcile({ ...doc, edges: [...baseEdges, newEdge] }, true, true);
          setSelectedEdgeId(newEdge.id);
          setSelectedNodeId(null);
          setDraftLine(null);
          setDrawPortSnapTarget(null);
          onNotify?.('Connected feeder line between blocks.');
          return;
        }
        // Commit free-ended line at last waypoint or cursor
        const endPt =
          draftLine.waypoints.length > 0
            ? draftLine.waypoints[draftLine.waypoints.length - 1]
            : cursorSvgPt;
        if (endPt) {
          const newEdge: SldEdge = {
            id: `edge-man-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            fromNodeId: draftLine.fromNodeId,
            fromPort: draftLine.fromPort,
            freeStart: draftLine.freeStart,
            freeEnd: endPt,
            waypoints:
              draftLine.waypoints.length > 1
                ? draftLine.waypoints.slice(0, -1)
                : undefined,
            lineStyle: activeLineStyle,
            cableLabel:
              activeLineStyle === 'emergency'
                ? 'Emg. Feeder'
                : activeLineStyle === 'raw'
                ? 'Raw Feeder'
                : 'Main Cable',
            isManual: true,
          };
          commitDocWithReconcile({ ...doc, edges: [...doc.edges, newEdge] }, true, true);
          setSelectedEdgeId(newEdge.id);
          setSelectedNodeId(null);
          setDraftLine(null);
          onNotify?.('Manual feeder line added.');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    draftLine,
    tool,
    isExpanded,
    cursorSvgPt,
    activeLineStyle,
    doc,
    nodeMap,
    nodeSnapEnabled,
    drawPortSnapTarget,
    commitDocWithReconcile,
    handleUndo,
    handleRedo,
    onNotify,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (rerouteDragRef.current) {
      const drag = rerouteDragRef.current;
      const rawPt = clientToRawSvgPoint(e.clientX, e.clientY);

      if (drag.type === 'segment') {
        const nextWaypoints = moveOrthogonalSegment(
          drag.basePts,
          drag.segIndex,
          rawPt,
          snapEnabled
        );
        dragDidMutateRef.current = true;
        onChangeDoc({
          ...doc,
          edges: doc.edges.map((ed) =>
            ed.id === drag.edgeId
              ? {
                  ...ed,
                  waypoints: nextWaypoints.length > 0 ? nextWaypoints : undefined,
                  isManual: true,
                }
              : ed
          ),
        });
        return;
      }

      const snappedPt = clientToSvgPoint(e.clientX, e.clientY);
      const candidate = nodeSnapEnabled ? findNearestNodePort(rawPt, doc.nodes, 34) : null;
      setEndpointSnapTarget(candidate);

      const nextEdges = doc.edges.map((ed) => {
        if (ed.id !== drag.edgeId) return ed;
        if (drag.type === 'endpoint-start') {
          return candidate
            ? {
                ...ed,
                fromNodeId: candidate.nodeId,
                fromPort: candidate.port,
                freeStart: undefined,
                isManual: true,
              }
            : {
                ...ed,
                fromNodeId: undefined,
                fromPort: undefined,
                freeStart: snappedPt,
                isManual: true,
              };
        }
        return candidate
          ? {
              ...ed,
              toNodeId: candidate.nodeId,
              toPort: candidate.port,
              freeEnd: undefined,
              isManual: true,
            }
          : {
              ...ed,
              toNodeId: undefined,
              toPort: undefined,
              freeEnd: snappedPt,
              isManual: true,
            };
      });

      dragDidMutateRef.current = true;
      commitDocWithReconcile({ ...doc, edges: nextEdges }, false, false, true);
      return;
    }

    if (dragNodeRef.current) {
      const { nodeId, startClientX, startClientY, origX, origY } = dragNodeRef.current;
      const dx = (e.clientX - startClientX) / zoom;
      const dy = (e.clientY - startClientY) / zoom;
      const nextX = Math.max(20, snapEnabled ? snapToGrid(origX + dx) : Math.round(origX + dx));
      const nextY = Math.max(20, snapEnabled ? snapToGrid(origY + dy) : Math.round(origY + dy));
      const currentNode = nodeMap.get(nodeId);
      if (currentNode && (currentNode.x !== nextX || currentNode.y !== nextY)) {
        dragDidMutateRef.current = true;
        onChangeDoc({
          ...doc,
          nodes: doc.nodes.map((n) =>
            n.id === nodeId ? { ...n, x: nextX, y: nextY } : n
          ),
        });
      }
      return;
    }

    if (panDragRef.current) {
      const { startClientX, startClientY, origPanX, origPanY } = panDragRef.current;
      setPan({
        x: origPanX + (e.clientX - startClientX),
        y: origPanY + (e.clientY - startClientY),
      });
      return;
    }

    if (tool === 'draw-line') {
      const rawPt = clientToRawSvgPoint(e.clientX, e.clientY);
      if (nodeSnapEnabled) {
        const candidate = findNearestNodePort(
          rawPt,
          doc.nodes,
          34,
          draftLine
            ? { nodeId: draftLine.fromNodeId, port: draftLine.fromPort }
            : undefined
        );
        setDrawPortSnapTarget(candidate);
        if (candidate) {
          setCursorSvgPt(candidate.point);
          return;
        }
      } else {
        setDrawPortSnapTarget(null);
      }
      setCursorSvgPt(
        snapEnabled
          ? { x: snapToGrid(rawPt.x), y: snapToGrid(rawPt.y) }
          : { x: Math.round(rawPt.x), y: Math.round(rawPt.y) }
      );
    } else if (
      tool === 'insert-main-switch' ||
      tool === 'insert-changeover' ||
      tool === 'insert-busbar'
    ) {
      setCursorSvgPt(clientToSvgPoint(e.clientX, e.clientY));
    } else if (tool === 'cut-line') {
      setRawCursorSvgPt(clientToRawSvgPoint(e.clientX, e.clientY));
    }
  };

  const handleMouseUp = () => {
    if (rerouteDragRef.current) {
      const finishedDrag = rerouteDragRef.current;
      rerouteDragRef.current = null;
      setEndpointSnapTarget(null);
      setIsDraggingEndpoint(false);

      if (finishedDrag.type === 'endpoint-start' || finishedDrag.type === 'endpoint-end') {
        const activeEdge = doc.edges.find((ed) => ed.id === finishedDrag.edgeId);
        let cleanedEdges = doc.edges;
        if (activeEdge?.fromNodeId && activeEdge?.toNodeId) {
          const fromN = nodeMap.get(activeEdge.fromNodeId);
          const toN = nodeMap.get(activeEdge.toNodeId);
          if (fromN && toN && isDbParentChildPair(fromN.category, toN.category)) {
            cleanedEdges = doc.edges.filter((ed) => {
              if (ed.id === activeEdge.id) return true;
              if (ed.toNodeId !== activeEdge.toNodeId || !ed.fromNodeId) return true;
              const prevParent = nodeMap.get(ed.fromNodeId);
              return !(prevParent && isDbParentChildPair(prevParent.category, toN.category));
            });
          }
        }
        commitDocWithReconcile({ ...doc, edges: cleanedEdges }, true, true, true);
      }

      if (preDragDocRef.current && dragDidMutateRef.current) {
        lastTextEditMetaRef.current = null;
        pushSnapshotToPast(preDragDocRef.current);
      }
      preDragDocRef.current = null;
      dragDidMutateRef.current = false;
    }

    if (dragNodeRef.current) {
      if (preDragDocRef.current && dragDidMutateRef.current) {
        lastTextEditMetaRef.current = null;
        pushSnapshotToPast(preDragDocRef.current);
      }
      preDragDocRef.current = null;
      dragDidMutateRef.current = false;
    }
    dragNodeRef.current = null;
    panDragRef.current = null;
  };

  const connectDraftLineToPort = (nodeId: string, port: SldPortSide) => {
    if (!draftLine) return;
    if (draftLine.fromNodeId === nodeId && draftLine.fromPort === port) {
      return;
    }

    const newEdge: SldEdge = {
      id: `edge-man-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      fromNodeId: draftLine.fromNodeId,
      fromPort: draftLine.fromPort,
      freeStart: draftLine.freeStart,
      toNodeId: nodeId,
      toPort: port,
      waypoints: draftLine.waypoints.length > 0 ? draftLine.waypoints : undefined,
      lineStyle: activeLineStyle,
      cableLabel:
        activeLineStyle === 'emergency'
          ? 'Emg. Feeder'
          : activeLineStyle === 'raw'
          ? 'Raw Feeder'
          : 'Main Cable',
      isManual: true,
    };

    const fromN = draftLine.fromNodeId ? nodeMap.get(draftLine.fromNodeId) : undefined;
    const toN = nodeMap.get(nodeId);
    let baseEdges = doc.edges;
    if (fromN && toN && isDbParentChildPair(fromN.category, toN.category)) {
      // Transfer child DB cleanly from its previous parent DB to the newly wired parent DB
      baseEdges = doc.edges.filter((ed) => {
        if (ed.toNodeId !== nodeId || !ed.fromNodeId) return true;
        const prevParent = nodeMap.get(ed.fromNodeId);
        return !(prevParent && isDbParentChildPair(prevParent.category, toN.category));
      });
    }

    commitDocWithReconcile({ ...doc, edges: [...baseEdges, newEdge] }, true, true);
    setSelectedEdgeId(newEdge.id);
    setSelectedNodeId(null);
    setDraftLine(null);
    setDrawPortSnapTarget(null);
    onNotify?.('Connected feeder line and updated layout.');
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1 || tool === 'pan') {
      panDragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      };
      return;
    }

    const pt = clientToSvgPoint(e.clientX, e.clientY);

    if (tool === 'insert-main-switch' || tool === 'insert-changeover') {
      const kind =
        tool === 'insert-main-switch' ? 'main-switch' : 'changeover-switch';
      const newNode = createManualSwitchNode(kind, pt.x, pt.y, doc.nodes);
      commitDocChange({
        ...doc,
        nodes: [...doc.nodes, newNode],
        canvasWidth: Math.max(doc.canvasWidth, newNode.x + newNode.width + 100),
        canvasHeight: Math.max(doc.canvasHeight, newNode.y + newNode.height + 160),
      });
      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
      setSelectedGroupId(null);
      setTool('select');
      onNotify?.(`Inserted ${newNode.title} (${newNode.code}). Drag to position or edit rating.`);
      return;
    }

    if (tool === 'insert-busbar') {
      const newNode = createManualBusbarNode(pt.x, pt.y, doc.nodes);
      commitDocChange({
        ...doc,
        nodes: [...doc.nodes, newNode],
        canvasWidth: Math.max(doc.canvasWidth, newNode.x + newNode.width + 100),
        canvasHeight: Math.max(doc.canvasHeight, newNode.y + newNode.height + 160),
      });
      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
      setSelectedGroupId(null);
      setTool('select');
      onNotify?.(
        `Inserted ${newNode.title} (${newNode.code}). Use Properties to add outgoing main switch nodes.`
      );
      return;
    }

    if (tool === 'draw-line') {
      if (nodeSnapEnabled) {
        const rawPt = clientToRawSvgPoint(e.clientX, e.clientY);
        const snapTarget = findNearestNodePort(
          rawPt,
          doc.nodes,
          34,
          draftLine
            ? { nodeId: draftLine.fromNodeId, port: draftLine.fromPort }
            : undefined
        );
        if (snapTarget) {
          if (!draftLine) {
            setDraftLine({
              fromNodeId: snapTarget.nodeId,
              fromPort: snapTarget.port,
              waypoints: [],
            });
            setDrawPortSnapTarget(null);
          } else {
            connectDraftLineToPort(snapTarget.nodeId, snapTarget.port);
          }
          return;
        }
      }
      if (!draftLine) {
        setDraftLine({ freeStart: pt, waypoints: [] });
      } else {
        setDraftLine((prev) =>
          prev ? { ...prev, waypoints: [...prev.waypoints, pt] } : null
        );
      }
      return;
    }

    // Select mode background click -> clear selection or allow pan drag
    setSelectedNodeId(null);
    setMultiSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedGroupId(null);
    panDragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
    };
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tool === 'draw-line' && draftLine) {
      if (nodeSnapEnabled && drawPortSnapTarget) {
        connectDraftLineToPort(drawPortSnapTarget.nodeId, drawPortSnapTarget.port);
        return;
      }
      const pt = clientToSvgPoint(e.clientX, e.clientY);
      const newEdge: SldEdge = {
        id: `edge-man-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        fromNodeId: draftLine.fromNodeId,
        fromPort: draftLine.fromPort,
        freeStart: draftLine.freeStart,
        freeEnd: pt,
        waypoints: draftLine.waypoints.length > 0 ? draftLine.waypoints : undefined,
        lineStyle: activeLineStyle,
        cableLabel:
          activeLineStyle === 'emergency'
            ? 'Emg. Feeder'
            : activeLineStyle === 'raw'
            ? 'Raw Feeder'
            : 'Main Cable',
        isManual: true,
      };
      commitDocWithReconcile({ ...doc, edges: [...doc.edges, newEdge] }, true, true);
      setSelectedEdgeId(newEdge.id);
      setSelectedNodeId(null);
      setDraftLine(null);
      setDrawPortSnapTarget(null);
      onNotify?.('Feeder line created.');
    }
  };

  const handlePortClick = (
    e: React.MouseEvent,
    nodeId: string,
    port: SldPortSide
  ) => {
    e.stopPropagation();
    if (tool !== 'draw-line') {
      setTool('draw-line');
      setDraftLine({ fromNodeId: nodeId, fromPort: port, waypoints: [] });
      return;
    }

    if (!draftLine) {
      setDraftLine({ fromNodeId: nodeId, fromPort: port, waypoints: [] });
      return;
    }

    connectDraftLineToPort(nodeId, port);
  };

  const handleDeleteNode = (nodeId: string) => {
    commitDocWithReconcile(
      {
        ...doc,
        nodes: doc.nodes.filter((n) => n.id !== nodeId),
        edges: doc.edges.filter((e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId),
        groups: groupsList
          .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((id) => id !== nodeId) }))
          .filter((g) => g.nodeIds.length > 0),
      },
      true,
      true
    );
    setSelectedNodeId(null);
    setMultiSelectedNodeIds((prev) => prev.filter((id) => id !== nodeId));
    onNotify?.('Removed block and updated SLD layout.');
  };

  const handleDeleteEdge = (edgeId: string) => {
    commitDocWithReconcile(
      {
        ...doc,
        edges: doc.edges.filter((e) => e.id !== edgeId),
      },
      true,
      true
    );
    if (selectedEdgeId === edgeId) {
      setSelectedEdgeId(null);
    }
    if (hoveredEdgeId === edgeId) {
      setHoveredEdgeId(null);
    }
    onNotify?.('Removed feeder line and updated SLD layout.');
  };

  const updateEdgeById = (edgeId: string, patch: Partial<SldEdge>, coalesceKey?: string) => {
    commitDocChange(
      {
        ...doc,
        edges: doc.edges.map((ed) => (ed.id === edgeId ? { ...ed, ...patch } : ed)),
      },
      coalesceKey ? { coalesceKey } : undefined
    );
  };

  const updateSelectedNode = (patch: Partial<SldNode>, coalesceKey?: string) => {
    if (!selectedNode) return;
    commitDocChange(
      {
        ...doc,
        nodes: doc.nodes.map((n) => (n.id === selectedNode.id ? { ...n, ...patch } : n)),
      },
      coalesceKey ? { coalesceKey } : undefined
    );
  };

  const updateSelectedEdge = (patch: Partial<SldEdge>, coalesceKey?: string) => {
    if (!selectedEdge) return;
    updateEdgeById(selectedEdge.id, patch, coalesceKey);
  };

  const updateGroupById = (groupId: string, patch: Partial<SldGroup>, coalesceKey?: string) => {
    commitDocChange(
      {
        ...doc,
        groups: groupsList.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
      },
      coalesceKey ? { coalesceKey } : undefined
    );
  };

  const handleCreateGroup = () => {
    const seedIds =
      multiSelectedNodeIds.length > 0
        ? multiSelectedNodeIds
        : selectedNode
        ? [selectedNode.id]
        : doc.nodes.slice(0, Math.min(2, doc.nodes.length)).map((n) => n.id);
    if (seedIds.length === 0) return;

    const nextNum = groupsList.length + 1;
    const newGroup: SldGroup = {
      id: `grp-man-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: `PANEL GROUP ${nextNum}`,
      nodeIds: seedIds,
      color: '#38bdf8',
      isManual: true,
    };
    commitDocChange({
      ...doc,
      groups: [...groupsList, newGroup],
    });
    setSelectedGroupId(newGroup.id);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setMultiSelectedNodeIds([]);
    setShowInspector(true);
    onNotify?.('Created label group. Edit its title and select member blocks in Properties.');
  };

  const handleDeleteGroup = (groupId: string) => {
    commitDocChange({
      ...doc,
      groups: groupsList.filter((g) => g.id !== groupId),
    });
    if (selectedGroupId === groupId) setSelectedGroupId(null);
    onNotify?.('Removed grouping label box.');
  };

  const handleAddOutgoingNode = (node: SldNode, rawLabel?: string) => {
    const existing = node.outgoingNodes || [];
    const idx = existing.length + 1;
    const label =
      (rawLabel || '').trim() ||
      (node.kind === 'busbar-chamber' ? `OG-MS${idx}` : `O${idx}`);
    const newItem: SldOutgoingNode = {
      id: `og-${Date.now().toString(36)}-${idx}`,
      label,
    };
    const nextList = [...existing, newItem];
    const minW = node.kind === 'busbar-chamber' ? 300 : 200;
    const nextW = Math.max(minW, node.width, snapToGrid(nextList.length * 56));
    commitDocChange({
      ...doc,
      nodes: doc.nodes.map((n) =>
        n.id === node.id
          ? {
              ...n,
              outgoingNodes: nextList,
              width: nextW,
              waysLabel:
                node.kind === 'busbar-chamber'
                  ? `${nextList.length} Outgoing Switch Nodes`
                  : n.waysLabel,
            }
          : n
      ),
    });
    setNewOutgoingLabel('');
    onNotify?.(`Added outgoing node "${label}" to ${node.code}.`);
  };

  const handleRemoveOutgoingNode = (node: SldNode, ogId: string) => {
    const existing = node.outgoingNodes || [];
    if (existing.length <= 1 && node.kind === 'db') {
      onNotify?.('Keep at least 1 outgoing connection node on each DB.');
      return;
    }
    const targetPort: SldPortSide = `out-${ogId}`;
    const nextNodes = doc.nodes.map((n) =>
      n.id === node.id
        ? {
            ...n,
            outgoingNodes: existing.filter((o) => o.id !== ogId),
          }
        : n
    );
    const nextEdges = doc.edges.filter(
      (ed) =>
        !(
          (ed.fromNodeId === node.id && ed.fromPort === targetPort) ||
          (ed.toNodeId === node.id && ed.toPort === targetPort)
        )
    );
    const removedAnyEdge = nextEdges.length !== doc.edges.length;
    commitDocWithReconcile(
      {
        ...doc,
        nodes: nextNodes,
        edges: nextEdges,
      },
      true,
      removedAnyEdge
    );
    onNotify?.('Removed outgoing connection node.');
  };

  const handleSpawnOutgoingSwitch = (busbarNode: SldNode, og: SldOutgoingNode) => {
    const portPt = getNodePortPoint(busbarNode, `out-${og.id}`);
    const newSw = createManualSwitchNode(
      'main-switch',
      portPt.x,
      portPt.y + 120,
      doc.nodes
    );
    newSw.code = og.label || newSw.code;
    newSw.title = `Outgoing Main Switch (${newSw.code})`;
    newSw.scope = 'Outgoing Main Switch';
    newSw.incomingType = `From ${busbarNode.code} (${og.label})`;

    const newEdge: SldEdge = {
      id: `edge-man-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      fromNodeId: busbarNode.id,
      fromPort: `out-${og.id}`,
      toNodeId: newSw.id,
      toPort: 'top',
      lineStyle: 'main',
      cableLabel: og.label,
      isManual: true,
    };

    // Automatically add spawned outgoing switch to any group containing this Busbar Chamber (e.g. L.T. PANEL)
    const nextGroups = groupsList.map((g) =>
      g.nodeIds.includes(busbarNode.id)
        ? { ...g, nodeIds: [...g.nodeIds, newSw.id] }
        : g
    );

    commitDocWithReconcile(
      {
        ...doc,
        nodes: [...doc.nodes, newSw],
        edges: [...doc.edges, newEdge],
        groups: nextGroups,
      },
      true,
      true
    );
    setSelectedNodeId(newSw.id);
    onNotify?.(`Added Outgoing Main Switch (${newSw.code}) wired from ${busbarNode.code}.`);
  };

  const handleExportPdf = async () => {
    try {
      const fileName = await exportSldToPdf(doc, cadPlotMode);
      onNotify?.(`Exported AutoCAD-style SLD vector PDF (${fileName}).`);
    } catch (err) {
      console.error('Failed to export SLD PDF:', err);
      onNotify?.('Could not export PDF. Please try again.');
    }
  };

  const finishDraftLineFreehand = () => {
    if (!draftLine) return;
    if (nodeSnapEnabled && drawPortSnapTarget) {
      connectDraftLineToPort(drawPortSnapTarget.nodeId, drawPortSnapTarget.port);
      return;
    }
    const endPt =
      draftLine.waypoints.length > 0
        ? draftLine.waypoints[draftLine.waypoints.length - 1]
        : cursorSvgPt;
    if (!endPt) {
      setDraftLine(null);
      return;
    }
    const newEdge: SldEdge = {
      id: `edge-man-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      fromNodeId: draftLine.fromNodeId,
      fromPort: draftLine.fromPort,
      freeStart: draftLine.freeStart,
      freeEnd: endPt,
      waypoints:
        draftLine.waypoints.length > 1 ? draftLine.waypoints.slice(0, -1) : undefined,
      lineStyle: activeLineStyle,
      cableLabel:
        activeLineStyle === 'emergency'
          ? 'Emg. Feeder'
          : activeLineStyle === 'raw'
          ? 'Raw Feeder'
          : 'Main Cable',
      isManual: true,
    };
    commitDocWithReconcile({ ...doc, edges: [...doc.edges, newEdge] }, true, true);
    setSelectedEdgeId(newEdge.id);
    setSelectedNodeId(null);
    setDraftLine(null);
    setDrawPortSnapTarget(null);
    onNotify?.('Feeder line added.');
  };

  // Live orthogonal rubber-band preview for Draw Line tool
  const draftPreviewPoints = useMemo(() => {
    if (!draftLine || !cursorSvgPt) return '';
    const startPt =
      draftLine.fromNodeId && draftLine.fromPort && nodeMap.get(draftLine.fromNodeId)
        ? getNodePortPoint(nodeMap.get(draftLine.fromNodeId)!, draftLine.fromPort)
        : draftLine.freeStart;
    if (!startPt) return '';
    const raw = [startPt, ...draftLine.waypoints, cursorSvgPt];
    const ortho: SldPoint[] = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const prev = ortho[ortho.length - 1];
      const next = raw[i];
      if (prev.x !== next.x && prev.y !== next.y) {
        ortho.push({ x: next.x, y: prev.y });
      }
      ortho.push(next);
    }
    return ortho.map((p) => `${p.x},${p.y}`).join(' ');
  }, [draftLine, cursorSvgPt, nodeMap]);

  const dbNodesCount = useMemo(
    () => doc.nodes.filter((n) => n.kind === 'db').length,
    [doc.nodes]
  );

  const switchNodesCount = useMemo(
    () =>
      doc.nodes.filter(
        (n) => n.kind === 'main-switch' || n.kind === 'changeover-switch'
      ).length,
    [doc.nodes]
  );

  const renderCadSymbol = (node: SldNode, stroke: string) => {
    const cx = node.width - 28;
    const cy = 56;
    if (node.kind === 'source') {
      return (
        <g>
          <circle cx={cx} cy={cy} r={14} fill="none" stroke={stroke} strokeWidth={1.6} />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fill={stroke}
            fontSize={node.category === 'DG Backup' ? 10 : 16}
            fontFamily="JetBrains Mono, monospace"
            fontWeight="700"
          >
            {node.category === 'DG Backup' ? 'DG' : '~'}
          </text>
        </g>
      );
    }

    if (node.kind === 'main-switch') {
      return (
        <g>
          <line x1={cx} y1={cy - 18} x2={cx} y2={cy - 9} stroke={stroke} strokeWidth={1.6} />
          <circle cx={cx} cy={cy - 9} r={2.5} fill="none" stroke={stroke} strokeWidth={1.5} />
          <line x1={cx} y1={cy + 9} x2={cx - 9} y2={cy - 7} stroke={stroke} strokeWidth={2} />
          <circle cx={cx} cy={cy + 9} r={2.5} fill="none" stroke={stroke} strokeWidth={1.5} />
          <line x1={cx} y1={cy + 9} x2={cx} y2={cy + 18} stroke={stroke} strokeWidth={1.6} />
        </g>
      );
    }

    if (node.kind === 'changeover-switch') {
      return (
        <g>
          <line x1={cx - 8} y1={cy - 18} x2={cx - 8} y2={cy - 9} stroke={stroke} strokeWidth={1.4} />
          <line x1={cx + 8} y1={cy - 18} x2={cx + 8} y2={cy - 9} stroke={stroke} strokeWidth={1.4} />
          <circle cx={cx - 8} cy={cy - 9} r={2.3} fill="none" stroke={stroke} strokeWidth={1.4} />
          <circle cx={cx + 8} cy={cy - 9} r={2.3} fill="none" stroke={stroke} strokeWidth={1.4} />
          <circle cx={cx} cy={cy + 10} r={2.6} fill="none" stroke={stroke} strokeWidth={1.5} />
          <line x1={cx} y1={cy + 10} x2={cx - 7} y2={cy - 7} stroke={stroke} strokeWidth={2} />
          <line
            x1={cx}
            y1={cy + 10}
            x2={cx + 7}
            y2={cy - 7}
            stroke={stroke}
            strokeWidth={1.4}
            strokeDasharray="3 2"
          />
          <line x1={cx} y1={cy + 10} x2={cx} y2={cy + 19} stroke={stroke} strokeWidth={1.5} />
        </g>
      );
    }

    if (node.kind === 'busbar-chamber') {
      return (
        <g>
          <line x1={cx - 18} y1={cy - 4} x2={cx + 18} y2={cy - 4} stroke={stroke} strokeWidth={2.8} />
          <line x1={cx - 18} y1={cy + 3} x2={cx + 18} y2={cy + 3} stroke={stroke} strokeWidth={2.8} />
          <line x1={cx} y1={cy - 16} x2={cx} y2={cy - 4} stroke={stroke} strokeWidth={1.5} />
          <line x1={cx - 11} y1={cy + 3} x2={cx - 11} y2={cy + 14} stroke={stroke} strokeWidth={1.4} />
          <line x1={cx + 11} y1={cy + 3} x2={cx + 11} y2={cy + 14} stroke={stroke} strokeWidth={1.4} />
        </g>
      );
    }

    // DB internal busbar & outgoing feeder tick symbol
    const dbCy = node.kind === 'db' ? 54 : cy;
    return (
      <g>
        <line x1={cx} y1={dbCy - 14} x2={cx} y2={dbCy - 3} stroke={stroke} strokeWidth={1.4} />
        <line x1={cx - 15} y1={dbCy - 3} x2={cx + 15} y2={dbCy - 3} stroke={stroke} strokeWidth={2.6} />
        <line x1={cx - 10} y1={dbCy - 3} x2={cx - 10} y2={dbCy + 11} stroke={stroke} strokeWidth={1.3} />
        <line x1={cx} y1={dbCy - 3} x2={cx} y2={dbCy + 11} stroke={stroke} strokeWidth={1.3} />
        <line x1={cx + 10} y1={dbCy - 3} x2={cx + 10} y2={dbCy + 11} stroke={stroke} strokeWidth={1.3} />
      </g>
    );
  };

  const containerClass = isExpanded
    ? 'fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-[#090d14] p-3 gap-2.5'
    : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none flex flex-col';

  return (
    <div className={containerClass}>
      {/* CAD Drafting Toolbar */}
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: CAD Tool Modes + Manual Insert Blocks */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => {
                setTool('select');
                setDraftLine(null);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                tool === 'select'
                  ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
              title="Select, edit, and drag DB/Switch blocks"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select / Move</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTool('pan');
                setDraftLine(null);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                tool === 'pan'
                  ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
              title="Pan canvas"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Pan</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setDraftLine(null);
              setTool((t) =>
                t === 'insert-main-switch' ? 'select' : 'insert-main-switch'
              );
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tool === 'insert-main-switch'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Click on canvas to insert a Main Switch block"
          >
            <PlusSquare className="w-3.5 h-3.5" />
            <span>+ Main Switch</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDraftLine(null);
              setTool((t) =>
                t === 'insert-changeover' ? 'select' : 'insert-changeover'
              );
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tool === 'insert-changeover'
                ? 'bg-purple-600 text-white border-purple-500'
                : 'bg-white dark:bg-slate-900 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/40 hover:bg-purple-50 dark:hover:bg-purple-950/30'
            }`}
            title="Click on canvas to insert a Changeover Switch block"
          >
            <ToggleLeft className="w-3.5 h-3.5" />
            <span>+ Changeover</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDraftLine(null);
              setTool((t) =>
                t === 'insert-busbar' ? 'select' : 'insert-busbar'
              );
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tool === 'insert-busbar'
                ? 'bg-sky-600 text-white border-sky-500'
                : 'bg-white dark:bg-slate-900 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 hover:bg-sky-50 dark:hover:bg-sky-950/30'
            }`}
            title="Click on canvas to insert a Busbar Chamber with manual outgoing switch nodes"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>+ Busbar Chamber</span>
          </button>

          <button
            type="button"
            onClick={handleCreateGroup}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              multiSelectedNodeIds.length > 0
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
            title="Create a labeled CAD group box (Shift+Click blocks to select multiple first)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {multiSelectedNodeIds.length > 0
                ? `Group (${multiSelectedNodeIds.length})`
                : '+ Group Label'}
            </span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setDraftLine(null);
                setTool((t) => (t === 'draw-line' ? 'select' : 'draw-line'));
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tool === 'draw-line'
                  ? 'bg-cyan-600 text-white border-cyan-500'
                  : 'bg-white dark:bg-slate-900 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 hover:bg-cyan-50 dark:hover:bg-cyan-950/30'
              }`}
              title="Click block ports or canvas points to draw orthogonal CAD feeder lines"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Draw Line</span>
            </button>

            <select
              value={activeLineStyle}
              onChange={(e) => setActiveLineStyle(e.target.value as SldLineStyle)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none"
              title="Line feeder type"
            >
              <option value="main">Main Bus</option>
              <option value="raw">Raw Feeder</option>
              <option value="emergency">Emergency Feeder</option>
              <option value="custom">Custom Line</option>
            </select>

            {draftLine && (
              <>
                <button
                  type="button"
                  onClick={finishDraftLineFreehand}
                  className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold whitespace-nowrap shrink-0"
                >
                  Finish
                </button>
                <button
                  type="button"
                  onClick={() => setDraftLine(null)}
                  className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          {/* Line Cut Tool + Split/Remove Mode */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setDraftLine(null);
                setHoveredEdgeId(null);
                setTool((t) => (t === 'cut-line' ? 'select' : 'cut-line'));
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tool === 'cut-line'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-950/30'
              }`}
              title="Click an existing feeder line to split or remove it"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Cut Line</span>
            </button>

            {tool === 'cut-line' && (
              <div className="flex items-center bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setCutMode('split')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap shrink-0 ${
                    cutMode === 'split'
                      ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title="Split clicked line into two independent segments"
                >
                  Split
                </button>
                <button
                  type="button"
                  onClick={() => setCutMode('remove')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap shrink-0 ${
                    cutMode === 'remove'
                      ? 'bg-rose-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title="Delete clicked line in one click"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: CAD Mode, Grid & Node Snap, Zoom, Auto-Layout, Regenerate, PDF Export */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSnapEnabled((s) => !s)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] whitespace-nowrap shrink-0 ${
              snapEnabled
                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 font-medium'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
            }`}
            title="Toggle 20px CAD grid snap"
          >
            <Grid className="w-3 h-3" />
            <span>Snap</span>
          </button>

          <button
            type="button"
            onClick={() => setNodeSnapEnabled((s) => !s)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] whitespace-nowrap shrink-0 ${
              nodeSnapEnabled
                ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/30 font-medium'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
            }`}
            title="Toggle automatic node-to-node port snapping when drawing or reconnecting feeder lines"
          >
            <Magnet className="w-3 h-3" />
            <span>Node Snap</span>
          </button>

          <button
            type="button"
            onClick={() => setCadPlotMode((m) => (m === 'dark' ? 'light' : 'dark'))}
            className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[11px] font-medium whitespace-nowrap shrink-0"
            title="Switch between AutoCAD Black Model Space and White Paper Plot"
          >
            {cadPlotMode === 'dark' ? 'CAD Dark' : 'CAD White'}
          </button>

          <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={() => zoomAtViewportCenter(1 / 1.12)}
              className="p-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Zoom Out (or scroll wheel down)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono tabular-nums text-[11px] text-slate-800 dark:text-slate-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => zoomAtViewportCenter(1.12)}
              className="p-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Zoom In (or scroll wheel up)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={fitView}
              className="px-1.5 py-1 border-l border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              title="Fit diagram to viewport"
            >
              Fit
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowInspector((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] whitespace-nowrap shrink-0 ${
              showInspector
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-950 dark:text-white border-slate-400 dark:border-slate-600'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
            }`}
            title="Toggle CAD Properties & Legend panel"
          >
            <Sliders className="w-3 h-3" />
            <span>Properties</span>
          </button>

          <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900">
            <button
              type="button"
              disabled={past.length === 0}
              onClick={handleUndo}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
              title="Undo last SLD edit, drag, connection, or auto-layout (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              disabled={future.length === 0}
              onClick={handleRedo}
              className="flex items-center gap-1 px-2 py-1 border-l border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
              title="Redo SLD change (Ctrl+Y or Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>Redo</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleAutoLayout}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 text-sky-900 dark:text-sky-200 text-[11px] font-semibold whitespace-nowrap shrink-0"
            title="Auto-arrange all DB blocks and panels into strict floor rows by connection hierarchy"
          >
            <LayoutGrid className="w-3 h-3" />
            <span>Auto-Layout</span>
          </button>

          <label
            className="hidden xl:inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 px-1 cursor-pointer select-none"
            title="Keep manually inserted switches & feeder lines when regenerating from MCBDB"
          >
            <input
              type="checkbox"
              checked={preserveManualOnRegen}
              onChange={(e) => setPreserveManualOnRegen(e.target.checked)}
              className="accent-emerald-600"
            />
            <span>Keep manual</span>
          </label>

          <button
            type="button"
            onClick={() => {
              pushSnapshotToPast(docRef.current);
              expectingRegenRef.current = true;
              onRegenerate(preserveManualOnRegen);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-medium whitespace-nowrap shrink-0"
            title="Regenerate DB hierarchy from current MCBDB schedule"
          >
            <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Re-Generate</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold border border-emerald-500 whitespace-nowrap shrink-0"
            title="Export AutoCAD-style vector Single Line Diagram PDF (A3 Landscape)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 text-[11px] font-semibold whitespace-nowrap shrink-0"
            title={isExpanded ? 'Exit Expand View' : 'Expand SLD to Full Screen'}
          >
            {isExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Expand</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expand View</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tool Status Helper Line */}
      {tool !== 'select' && (
        <div
          className={`px-3 py-1.5 border-b text-[11px] flex items-center justify-between gap-2 ${
            tool === 'cut-line'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
              : 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900/60 text-cyan-900 dark:text-cyan-200'
          }`}
        >
          <span>
            {tool === 'insert-main-switch' &&
              'Placement mode active: Click anywhere on the CAD grid to insert a Main Switch block (Esc to cancel).'}
            {tool === 'insert-changeover' &&
              'Placement mode active: Click anywhere on the CAD grid to insert a Changeover Switch block (Esc to cancel).'}
            {tool === 'insert-busbar' &&
              'Placement mode active: Click anywhere on the CAD grid to insert a Busbar Chamber block (Esc to cancel).'}
            {tool === 'draw-line' &&
              (draftLine
                ? nodeSnapEnabled
                  ? 'Node Snap ON: Hover near any block port to highlight & snap-connect, click grid for orthogonal bends, or double-click / Enter to finish.'
                  : 'Click another block port to connect, click grid points for orthogonal bends, or double-click / press Enter to finish.'
                : nodeSnapEnabled
                ? 'Line drawing active (Node Snap ON): Hover near any block port to snap-start an orthogonal feeder line, or click grid.'
                : 'Line drawing active: Click any block port or grid point to start an orthogonal feeder line.')}
            {tool === 'cut-line' &&
              (cutMode === 'split'
                ? 'Cut Line (Split): Click any feeder line to split it at that point into two independent open-ended lines.'
                : 'Cut Line (Remove): Click any feeder line to delete it immediately.')}
            {tool === 'pan' && 'Pan mode active: Drag anywhere on the canvas to pan.'}
          </span>
          <button
            type="button"
            onClick={() => {
              setTool('select');
              setDraftLine(null);
              setHoveredEdgeId(null);
            }}
            className="text-[11px] font-semibold underline shrink-0"
          >
            Return to Select
          </button>
        </div>
      )}

      {/* Main CAD Viewport + Optional Properties Panel */}
      <div
        className={`flex-1 flex min-h-0 ${
          isExpanded ? 'border border-slate-300 dark:border-slate-800 rounded-lg overflow-hidden' : 'h-[68vh] min-h-[560px]'
        }`}
      >
        {/* Interactive AutoCAD SVG Canvas */}
        <div
          ref={svgViewportRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseDown={handleCanvasMouseDown}
          onDoubleClick={handleCanvasDoubleClick}
          className={`relative flex-1 overflow-hidden select-none ${
            tool === 'pan'
              ? 'cursor-grab active:cursor-grabbing'
              : tool === 'insert-main-switch' ||
                tool === 'insert-changeover' ||
                tool === 'insert-busbar' ||
                tool === 'draw-line' ||
                tool === 'cut-line'
              ? 'cursor-crosshair'
              : 'cursor-default'
          }`}
          style={{
            backgroundColor: cadPlotMode === 'dark' ? '#0b0f14' : '#ffffff',
          }}
        >
          <svg className="w-full h-full block">
            <defs>
              <pattern
                id="sld-cad-grid-minor"
                width={GRID_SIZE * zoom}
                height={GRID_SIZE * zoom}
                patternUnits="userSpaceOnUse"
                x={pan.x % (GRID_SIZE * zoom)}
                y={pan.y % (GRID_SIZE * zoom)}
              >
                <path
                  d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`}
                  fill="none"
                  stroke={cadPlotMode === 'dark' ? '#16202c' : '#eef2f6'}
                  strokeWidth="1"
                />
              </pattern>
              <pattern
                id="sld-cad-grid-major"
                width={GRID_SIZE * 5 * zoom}
                height={GRID_SIZE * 5 * zoom}
                patternUnits="userSpaceOnUse"
                x={pan.x % (GRID_SIZE * 5 * zoom)}
                y={pan.y % (GRID_SIZE * 5 * zoom)}
              >
                <rect
                  width={GRID_SIZE * 5 * zoom}
                  height={GRID_SIZE * 5 * zoom}
                  fill="url(#sld-cad-grid-minor)"
                />
                <path
                  d={`M ${GRID_SIZE * 5 * zoom} 0 L 0 0 0 ${GRID_SIZE * 5 * zoom}`}
                  fill="none"
                  stroke={cadPlotMode === 'dark' ? '#1f2d3d' : '#dbe3ec'}
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            {/* CAD Drafting Grid Background */}
            <rect width="100%" height="100%" fill="url(#sld-cad-grid-major)" />

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Outer AutoCAD Drawing Border Sheet */}
              <rect
                x={12}
                y={12}
                width={doc.canvasWidth - 24}
                height={doc.canvasHeight - 24}
                fill="none"
                stroke={cadPlotMode === 'dark' ? '#475569' : '#0f172a'}
                strokeWidth={2}
              />
              <rect
                x={18}
                y={18}
                width={doc.canvasWidth - 36}
                height={doc.canvasHeight - 36}
                fill="none"
                stroke={cadPlotMode === 'dark' ? '#334155' : '#475569'}
                strokeWidth={0.8}
              />

              {/* CAD Grouping Enclosures (e.g. L.T. PANEL) */}
              {groupsList.map((grp) => {
                const bounds = computeGroupBounds(grp, nodeMap);
                if (!bounds) return null;
                const grpColor =
                  grp.color || (cadPlotMode === 'dark' ? '#38bdf8' : '#0369a1');
                const isGrpSelected = grp.id === selectedGroupId;
                const tabWidth = Math.max(92, grp.label.length * 8.2 + 22);
                return (
                  <g key={grp.id}>
                    <rect
                      x={bounds.x}
                      y={bounds.y}
                      width={bounds.width}
                      height={bounds.height}
                      fill={grpColor}
                      fillOpacity={isGrpSelected ? 0.08 : 0.03}
                      stroke={isGrpSelected ? '#ec4899' : grpColor}
                      strokeWidth={isGrpSelected ? 2.2 : 1.6}
                      strokeDasharray="8 4"
                      rx={4}
                      pointerEvents="stroke"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGroupId(grp.id);
                        setSelectedNodeId(null);
                        setSelectedEdgeId(null);
                      }}
                      className="cursor-pointer"
                    />
                    <g
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGroupId(grp.id);
                        setSelectedNodeId(null);
                        setSelectedEdgeId(null);
                      }}
                      className="cursor-pointer"
                    >
                      <rect
                        x={bounds.x}
                        y={bounds.y}
                        width={tabWidth}
                        height={20}
                        fill={isGrpSelected ? '#ec4899' : grpColor}
                        rx={2}
                      />
                      <text
                        x={bounds.x + 9}
                        y={bounds.y + 13.5}
                        fill={cadPlotMode === 'dark' ? '#0b0f14' : '#ffffff'}
                        fontSize={10}
                        fontFamily="Plus Jakarta Sans, sans-serif"
                        fontWeight={800}
                      >
                        {grp.label.toUpperCase()}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Orthogonal Electrical Feeder Lines */}
              {doc.edges.map((edge) => {
                const trunkRatio = trunkRatios.get(edge.id) ?? 0.5;
                const pts = computeOrthogonalPath(edge, nodeMap, trunkRatio);
                if (pts.length < 2) return null;
                const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
                const stroke = getLineStroke(edge.lineStyle);
                const isSelected = edge.id === selectedEdgeId;
                const isCutHovered = tool === 'cut-line' && hoveredEdgeId === edge.id;

                const midSegIdx = Math.floor(pts.length / 2);
                const pA = pts[Math.max(0, midSegIdx - 1)];
                const pB = pts[midSegIdx];
                const labelX = (pA.x + pB.x) / 2;
                const labelY = (pA.y + pB.y) / 2 - 6;

                const cutMarkerProj =
                  isCutHovered && cutMode === 'split' && rawCursorSvgPt
                    ? projectPointOntoPolyline(rawCursorSvgPt, pts)
                    : null;

                return (
                  <g
                    key={edge.id}
                    onMouseEnter={() => {
                      if (tool === 'cut-line') setHoveredEdgeId(edge.id);
                    }}
                    onMouseLeave={() => {
                      if (hoveredEdgeId === edge.id) setHoveredEdgeId(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tool === 'cut-line') {
                        if (cutMode === 'remove') {
                          handleDeleteEdge(edge.id);
                          return;
                        }
                        const rawClick = clientToRawSvgPoint(e.clientX, e.clientY);
                        const splitResult = splitEdgeAtPoint(
                          edge,
                          rawClick,
                          nodeMap,
                          trunkRatio,
                          snapEnabled
                        );
                        if (splitResult) {
                          const [edgeA, edgeB] = splitResult;
                          commitDocWithReconcile(
                            {
                              ...doc,
                              edges: doc.edges.flatMap((ed) =>
                                ed.id === edge.id ? [edgeA, edgeB] : [ed]
                              ),
                            },
                            true,
                            true
                          );
                          setSelectedEdgeId(edgeA.id);
                          setSelectedNodeId(null);
                          setHoveredEdgeId(null);
                          onNotify?.(
                            'Split feeder line into two segments and refreshed layout.'
                          );
                        }
                        return;
                      }

                      if (tool === 'select') {
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }
                    }}
                    onDoubleClick={(e) => {
                      if (tool !== 'select') return;
                      e.stopPropagation();
                      const rawClick = clientToRawSvgPoint(e.clientX, e.clientY);
                      const proj = projectPointOntoPolyline(rawClick, pts);
                      if (!proj) return;
                      const nextWp = insertBendOnSegment(pts, proj.segmentIndex, snapEnabled);
                      updateEdgeById(edge.id, {
                        waypoints: nextWp.length > 0 ? nextWp : undefined,
                        isManual: true,
                      });
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                      onNotify?.('Inserted orthogonal bend on feeder line.');
                    }}
                    className={tool === 'cut-line' ? 'cursor-crosshair' : 'cursor-pointer'}
                  >
                    {/* Wide invisible hit target */}
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                    />
                    {/* Cut-Line hover highlight */}
                    {isCutHovered && (
                      <polyline
                        points={pointsStr}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth={6}
                        strokeOpacity={0.55}
                      />
                    )}
                    {/* Selection halo */}
                    {isSelected && !isCutHovered && (
                      <polyline
                        points={pointsStr}
                        fill="none"
                        stroke="#ec4899"
                        strokeWidth={5}
                        strokeOpacity={0.55}
                      />
                    )}
                    {/* Visible CAD orthogonal line */}
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke={isCutHovered ? '#f43f5e' : stroke}
                      strokeWidth={edge.lineStyle === 'main' ? 2.4 : 1.7}
                      strokeDasharray={
                        edge.lineStyle === 'emergency'
                          ? '8 4'
                          : edge.lineStyle === 'custom'
                          ? '4 4'
                          : undefined
                      }
                    />
                    {/* Connection dots */}
                    <circle cx={pts[0].x} cy={pts[0].y} r={3.2} fill={stroke} />
                    <circle
                      cx={pts[pts.length - 1].x}
                      cy={pts[pts.length - 1].y}
                      r={3.2}
                      fill={stroke}
                    />
                    {edge.cableLabel && (
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        fill={stroke}
                        fontSize={9.5}
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight={600}
                      >
                        {edge.cableLabel}
                      </text>
                    )}

                    {/* Cut Point Preview Marker when splitting */}
                    {cutMarkerProj && (
                      <g pointerEvents="none">
                        <circle
                          cx={cutMarkerProj.point.x}
                          cy={cutMarkerProj.point.y}
                          r={6}
                          fill="#f43f5e"
                          fillOpacity={0.25}
                          stroke="#f43f5e"
                          strokeWidth={1.8}
                        />
                        <line
                          x1={cutMarkerProj.point.x - 5}
                          y1={cutMarkerProj.point.y - 5}
                          x2={cutMarkerProj.point.x + 5}
                          y2={cutMarkerProj.point.y + 5}
                          stroke="#f43f5e"
                          strokeWidth={1.8}
                        />
                        <line
                          x1={cutMarkerProj.point.x + 5}
                          y1={cutMarkerProj.point.y - 5}
                          x2={cutMarkerProj.point.x - 5}
                          y2={cutMarkerProj.point.y + 5}
                          stroke="#f43f5e"
                          strokeWidth={1.8}
                        />
                      </g>
                    )}

                    {/* Manual Rerouting Handles for Selected Edge */}
                    {tool === 'select' && isSelected && (
                      <g>
                        {/* Segment Midpoint Slide Handles */}
                        {pts.slice(0, -1).map((a, segIdx) => {
                          const b = pts[segIdx + 1];
                          const segLen = Math.hypot(b.x - a.x, b.y - a.y);
                          if (segLen < 12) return null;
                          const isHoriz = Math.abs(a.y - b.y) <= Math.abs(a.x - b.x);
                          const mx = (a.x + b.x) / 2;
                          const my = (a.y + b.y) / 2;
                          return (
                            <rect
                              key={`seg-handle-${segIdx}`}
                              x={mx - 4.5}
                              y={my - 4.5}
                              width={9}
                              height={9}
                              rx={1.5}
                              fill={cadPlotMode === 'dark' ? '#0f1722' : '#ffffff'}
                              stroke="#ec4899"
                              strokeWidth={1.8}
                              style={{ cursor: isHoriz ? 'ns-resize' : 'ew-resize' }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                preDragDocRef.current = docRef.current;
                                dragDidMutateRef.current = false;
                                rerouteDragRef.current = {
                                  type: 'segment',
                                  edgeId: edge.id,
                                  segIndex: segIdx,
                                  basePts: pts,
                                };
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <title>
                                {isHoriz
                                  ? 'Drag up/down to reroute segment (double-click line to add bend)'
                                  : 'Drag left/right to reroute segment (double-click line to add bend)'}
                              </title>
                            </rect>
                          );
                        })}

                        {/* Start Endpoint Reconnect Handle */}
                        <circle
                          cx={pts[0].x}
                          cy={pts[0].y}
                          r={6}
                          fill="#22d3ee"
                          stroke={cadPlotMode === 'dark' ? '#0b0f14' : '#0f172a'}
                          strokeWidth={1.8}
                          style={{ cursor: 'grab' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            preDragDocRef.current = docRef.current;
                            dragDidMutateRef.current = false;
                            setIsDraggingEndpoint(true);
                            rerouteDragRef.current = {
                              type: 'endpoint-start',
                              edgeId: edge.id,
                            };
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <title>Drag start endpoint to reconnect to any block port</title>
                        </circle>

                        {/* End Endpoint Reconnect Handle */}
                        <circle
                          cx={pts[pts.length - 1].x}
                          cy={pts[pts.length - 1].y}
                          r={6}
                          fill="#22d3ee"
                          stroke={cadPlotMode === 'dark' ? '#0b0f14' : '#0f172a'}
                          strokeWidth={1.8}
                          style={{ cursor: 'grab' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            preDragDocRef.current = docRef.current;
                            dragDidMutateRef.current = false;
                            setIsDraggingEndpoint(true);
                            rerouteDragRef.current = {
                              type: 'endpoint-end',
                              edgeId: edge.id,
                            };
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <title>Drag end endpoint to reconnect to any block port</title>
                        </circle>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Rubber-band Line Preview */}
              {tool === 'draw-line' && draftLine && draftPreviewPoints && (
                <polyline
                  points={draftPreviewPoints}
                  fill="none"
                  stroke={getLineStroke(activeLineStyle)}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                />
              )}

              {/* DB, Busbar Chamber, Main Switch, Changeover Switch & Source Blocks */}
              {doc.nodes.map((node) => {
                const colors = layerColors[node.category];
                const isSelected =
                  node.id === selectedNodeId || multiSelectedNodeIds.includes(node.id);
                const allPorts = getAllNodePorts(node);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onMouseDown={(e) => {
                      if (tool === 'select') {
                        e.stopPropagation();
                        if (e.shiftKey) {
                          setMultiSelectedNodeIds((prev) =>
                            prev.includes(node.id)
                              ? prev.filter((id) => id !== node.id)
                              : [...prev, node.id]
                          );
                          setSelectedNodeId(node.id);
                          setSelectedEdgeId(null);
                          setSelectedGroupId(null);
                          return;
                        }
                        setMultiSelectedNodeIds([]);
                        setSelectedNodeId(node.id);
                        setSelectedEdgeId(null);
                        setSelectedGroupId(null);
                        preDragDocRef.current = docRef.current;
                        dragDidMutateRef.current = false;
                        dragNodeRef.current = {
                          nodeId: node.id,
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          origX: node.x,
                          origY: node.y,
                        };
                      }
                    }}
                    className={tool === 'select' ? 'cursor-move group' : 'group'}
                  >
                    {/* Selection Highlight Outline */}
                    {isSelected && (
                      <rect
                        x={-4}
                        y={-4}
                        width={node.width + 8}
                        height={node.height + 8}
                        fill="none"
                        stroke="#ec4899"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        rx={3}
                      />
                    )}

                    {/* Main CAD Box */}
                    <rect
                      x={0}
                      y={0}
                      width={node.width}
                      height={node.height}
                      fill={cadPlotMode === 'dark' ? '#0f1722' : '#ffffff'}
                      stroke={colors.stroke}
                      strokeWidth={
                        node.kind === 'main-switch' ||
                        node.kind === 'changeover-switch' ||
                        node.kind === 'busbar-chamber'
                          ? 2.2
                          : 1.6
                      }
                      rx={2}
                    />

                    {/* Category Header Strip */}
                    <rect
                      x={0}
                      y={0}
                      width={node.width}
                      height={22}
                      fill={colors.headerBg}
                    />

                    <text
                      x={7}
                      y={14.5}
                      fill={colors.headerText}
                      fontSize={9.5}
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      fontWeight={800}
                    >
                      {node.category.toUpperCase()}
                    </text>

                    {node.kind === 'db' ? (
                      /* DB Boxes display Category (header), Floor Level, DB Size, and Spare Number */
                      <>
                        <text
                          x={9}
                          y={40}
                          fill={cadPlotMode === 'dark' ? '#f8fafc' : '#0f172a'}
                          fontSize={11}
                          fontFamily="Plus Jakarta Sans, sans-serif"
                          fontWeight={700}
                        >
                          {(node.floorName || node.scope).slice(0, 22)}
                        </text>
                        <text
                          x={9}
                          y={56}
                          fill={cadPlotMode === 'dark' ? '#cbd5e1' : '#334155'}
                          fontSize={9.5}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {node.sizeCode.slice(0, 22)}
                        </text>
                        <text
                          x={9}
                          y={74}
                          fill={colors.accentText}
                          fontSize={11}
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight={800}
                        >
                          {`SPARE: ${node.spareCount ?? 0}`}
                        </text>
                      </>
                    ) : (
                      <>
                        <text
                          x={node.width - 7}
                          y={14.5}
                          textAnchor="end"
                          fill={colors.headerText}
                          fontSize={9.5}
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight={700}
                        >
                          {node.code}
                        </text>

                        {/* Body Labels for Switches, Busbar Chamber & Sources */}
                        <text
                          x={8}
                          y={39}
                          fill={cadPlotMode === 'dark' ? '#f8fafc' : '#0f172a'}
                          fontSize={11}
                          fontFamily="Plus Jakarta Sans, sans-serif"
                          fontWeight={700}
                        >
                          {(node.scope || node.title).slice(0, 26)}
                        </text>

                        <text
                          x={8}
                          y={56}
                          fill={cadPlotMode === 'dark' ? '#cbd5e1' : '#334155'}
                          fontSize={9.5}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {`${node.sizeCode}`.slice(0, 26)}
                        </text>

                        <text
                          x={8}
                          y={node.height - 22}
                          fill={colors.accentText}
                          fontSize={9.5}
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight={700}
                        >
                          {node.ratingText.slice(0, 28)}
                        </text>
                      </>
                    )}

                    {/* Internal IEC Single-Line Symbol */}
                    {renderCadSymbol(node, colors.stroke)}

                    {/* Connection Ports & Separate Outgoing Terminal Nodes */}
                    {allPorts.map(({ port, label }) => {
                      const rel = getNodePortPoint({ ...node, x: 0, y: 0 }, port);
                      const isOutgoingPort = port.startsWith('out-');
                      const isActiveOrigin =
                        draftLine?.fromNodeId === node.id && draftLine?.fromPort === port;
                      const activeSnapTarget = drawPortSnapTarget || endpointSnapTarget;
                      const isSnapTarget =
                        activeSnapTarget?.nodeId === node.id &&
                        activeSnapTarget?.port === port;

                      return (
                        <g key={port}>
                          {isOutgoingPort && label && (
                            <text
                              x={rel.x}
                              y={rel.y - 8}
                              textAnchor="middle"
                              fill={cadPlotMode === 'dark' ? '#94a3b8' : '#475569'}
                              fontSize={8}
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight={700}
                              pointerEvents="none"
                            >
                              {label}
                            </text>
                          )}
                          {isSnapTarget && (
                            <g pointerEvents="none">
                              <circle
                                cx={rel.x}
                                cy={rel.y}
                                r={12}
                                fill="#22d3ee"
                                fillOpacity={0.14}
                                stroke="#22d3ee"
                                strokeWidth={1.6}
                                strokeDasharray="3 2"
                              />
                              <rect
                                x={rel.x - 24}
                                y={rel.y - 25}
                                width={48}
                                height={14}
                                rx={3}
                                fill={cadPlotMode === 'dark' ? '#083344' : '#0e7490'}
                                stroke="#22d3ee"
                                strokeWidth={1}
                              />
                              <text
                                x={rel.x}
                                y={rel.y - 15.5}
                                textAnchor="middle"
                                fill="#ecfeff"
                                fontSize={7.5}
                                fontFamily="JetBrains Mono, monospace"
                                fontWeight={700}
                              >
                                {activeSnapTarget.label.slice(0, 7)}
                              </text>
                            </g>
                          )}
                          <circle
                            cx={rel.x}
                            cy={rel.y}
                            r={
                              isSnapTarget
                                ? 7.5
                                : isOutgoingPort
                                ? 5
                                : tool === 'draw-line' || isDraggingEndpoint
                                ? 5.5
                                : 4
                            }
                            fill={
                              isActiveOrigin || isSnapTarget
                                ? '#22d3ee'
                                : cadPlotMode === 'dark'
                                ? '#0b0f14'
                                : '#ffffff'
                            }
                            stroke={isSnapTarget ? '#ffffff' : colors.stroke}
                            strokeWidth={isSnapTarget ? 2.2 : 1.7}
                            onClick={(e) => handlePortClick(e, node.id, port)}
                            className={`cursor-crosshair transition-opacity ${
                              isOutgoingPort ||
                              isSnapTarget ||
                              tool === 'draw-line' ||
                              isDraggingEndpoint
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100'
                            }`}
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Ghost Block Preview during Manual Block Insertion */}
              {(tool === 'insert-main-switch' ||
                tool === 'insert-changeover' ||
                tool === 'insert-busbar') &&
                cursorSvgPt && (
                  <g
                    transform={`translate(${snapToGrid(
                      cursorSvgPt.x - (tool === 'insert-busbar' ? 150 : 110)
                    )}, ${snapToGrid(cursorSvgPt.y - 56)})`}
                    opacity={0.7}
                    pointerEvents="none"
                  >
                    <rect
                      x={0}
                      y={0}
                      width={tool === 'insert-busbar' ? 300 : 220}
                      height={tool === 'insert-busbar' ? 104 : 112}
                      fill={cadPlotMode === 'dark' ? '#16202e' : '#f1f5f9'}
                      stroke={
                        tool === 'insert-main-switch'
                          ? layerColors['Main Switch'].stroke
                          : tool === 'insert-busbar'
                          ? layerColors['Busbar Chamber'].stroke
                          : layerColors['Changeover Switch'].stroke
                      }
                      strokeWidth={2}
                      strokeDasharray="6 3"
                    />
                    <text
                      x={tool === 'insert-busbar' ? 150 : 110}
                      y={58}
                      textAnchor="middle"
                      fill={
                        tool === 'insert-main-switch'
                          ? layerColors['Main Switch'].accentText
                          : tool === 'insert-busbar'
                          ? layerColors['Busbar Chamber'].accentText
                          : layerColors['Changeover Switch'].accentText
                      }
                      fontSize={11}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                    >
                      {tool === 'insert-main-switch'
                        ? 'CLICK TO PLACE MAIN SWITCH'
                        : tool === 'insert-busbar'
                        ? 'CLICK TO PLACE BUSBAR CHAMBER'
                        : 'CLICK TO PLACE CHANGEOVER'}
                    </text>
                  </g>
                )}

              {/* AutoCAD Engineering Title Block (Bottom Right) */}
              <g
                transform={`translate(${doc.canvasWidth - 460}, ${doc.canvasHeight - 102})`}
              >
                <rect
                  x={0}
                  y={0}
                  width={436}
                  height={78}
                  fill={cadPlotMode === 'dark' ? '#101620' : '#f8fafc'}
                  stroke={cadPlotMode === 'dark' ? '#64748b' : '#0f172a'}
                  strokeWidth={1.4}
                />
                <line
                  x1={0}
                  y1={26}
                  x2={436}
                  y2={26}
                  stroke={cadPlotMode === 'dark' ? '#475569' : '#334155'}
                  strokeWidth={1}
                />
                <line
                  x1={0}
                  y1={52}
                  x2={436}
                  y2={52}
                  stroke={cadPlotMode === 'dark' ? '#475569' : '#334155'}
                  strokeWidth={1}
                />
                <line
                  x1={230}
                  y1={26}
                  x2={230}
                  y2={78}
                  stroke={cadPlotMode === 'dark' ? '#475569' : '#334155'}
                  strokeWidth={1}
                />
                <text
                  x={10}
                  y={17}
                  fill={cadPlotMode === 'dark' ? '#f8fafc' : '#0f172a'}
                  fontSize={11}
                  fontFamily="Plus Jakarta Sans, sans-serif"
                  fontWeight={800}
                >
                  CPWD DSR (E&amp;M) 2025 · ELECTRICAL SINGLE LINE DIAGRAM (SLD)
                </text>
                <text
                  x={10}
                  y={43}
                  fill={cadPlotMode === 'dark' ? '#cbd5e1' : '#334155'}
                  fontSize={9.5}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {`DISTRIBUTION BOARDS: ${dbNodesCount}  |  SWITCHES: ${switchNodesCount}`}
                </text>
                <text
                  x={240}
                  y={43}
                  fill={cadPlotMode === 'dark' ? '#cbd5e1' : '#334155'}
                  fontSize={9.5}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {`SPARE FACTOR: ${doc.sparePercent}%`}
                </text>
                <text
                  x={10}
                  y={69}
                  fill={cadPlotMode === 'dark' ? '#94a3b8' : '#475569'}
                  fontSize={9.5}
                  fontFamily="JetBrains Mono, monospace"
                >
                  DWG NO: E-SLD-001 (NO SWITCH BOARDS)
                </text>
                <text
                  x={240}
                  y={69}
                  fill={cadPlotMode === 'dark' ? '#94a3b8' : '#475569'}
                  fontSize={9.5}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {`SCALE: NTS  |  ${new Date(doc.generatedAt).toLocaleDateString('en-IN')}`}
                </text>
              </g>
            </g>
          </svg>

          {/* Bottom-Left Compact CAD Layer Legend Overlay */}
          <div
            className={`absolute bottom-3 left-3 px-3 py-2 rounded-lg border text-[10px] font-mono flex flex-wrap items-center gap-x-3 gap-y-1 max-w-xl ${
              cadPlotMode === 'dark'
                ? 'bg-[#0f1722]/90 border-slate-700 text-slate-200'
                : 'bg-white/95 border-slate-300 text-slate-800 shadow-xs'
            }`}
          >
            {(
              [
                'Main Switch',
                'Busbar Chamber',
                'Changeover Switch',
                'Emergency VTPNDB',
                'Raw VTPNDB',
                'Emergency PDB',
                'Raw PDB',
                'LDB',
              ] as SldNodeCategory[]
            ).map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className="w-2.5 h-2.5 inline-block rounded-xs"
                  style={{ backgroundColor: layerColors[cat].headerBg }}
                />
                <span>{cat}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Right CAD Properties Inspector */}
        {showInspector && (
          <aside className="w-76 shrink-0 border-l border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 overflow-y-auto text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="font-bold text-slate-900 dark:text-white">
                CAD Element Properties
              </span>
              <button
                type="button"
                onClick={() => setShowInspector(false)}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedGroup ? (
              <div className="space-y-3">
                <div className="font-mono text-[11px] font-bold text-sky-700 dark:text-sky-400">
                  PANEL / LABEL GROUP
                </div>

                <label className="block space-y-1">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Group Label (e.g. L.T. PANEL)
                  </span>
                    <input
                    type="text"
                    value={selectedGroup.label}
                    onChange={(e) =>
                      updateGroupById(
                        selectedGroup.id,
                        { label: e.target.value },
                        `grp-label-${selectedGroup.id}`
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-950 dark:text-white focus:border-sky-500 focus:outline-none"
                  />
                </label>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Group Boundary Color
                  </span>
                  <div className="flex items-center gap-1.5">
                    {['#38bdf8', '#34d399', '#fbbf24', '#c084fc', '#94a3b8'].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => updateGroupById(selectedGroup.id, { color: col })}
                        className={`w-6 h-6 rounded border-2 ${
                          (selectedGroup.color || '#38bdf8') === col
                            ? 'border-slate-950 dark:border-white scale-105'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: col }}
                        title={`Set group color ${col}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Grouped Blocks ({selectedGroup.nodeIds.length})
                  </span>
                  <div className="max-h-56 overflow-y-auto space-y-1 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {doc.nodes.map((n) => {
                      const checked = selectedGroup.nodeIds.includes(n.id);
                      return (
                        <label
                          key={n.id}
                          className="flex items-center gap-2 text-[11px] text-slate-800 dark:text-slate-200 cursor-pointer py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const nextIds = e.target.checked
                                ? [...selectedGroup.nodeIds, n.id]
                                : selectedGroup.nodeIds.filter((id) => id !== n.id);
                              updateGroupById(selectedGroup.id, { nodeIds: nextIds });
                            }}
                            className="accent-sky-600"
                          />
                          <span className="truncate">
                            {n.category} · {n.code}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteGroup(selectedGroup.id)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Group Label</span>
                </button>
              </div>
            ) : selectedNode ? (
              <div className="space-y-3">
                <div className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {selectedNode.category.toUpperCase()}
                  {selectedNode.kind !== 'db' ? ` · ${selectedNode.code}` : ''}
                </div>

                {selectedNode.kind === 'db' ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        DB Category
                      </span>
                      <input
                        type="text"
                        value={selectedNode.category}
                        onChange={(e) =>
                          updateSelectedNode(
                            { category: e.target.value as SldNodeCategory },
                            `node-cat-${selectedNode.id}`
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        Floor Level
                      </span>
                      <input
                        type="text"
                        value={selectedNode.floorName || selectedNode.scope}
                        onChange={(e) =>
                          updateSelectedNode(
                            {
                              floorName: e.target.value,
                              scope: e.target.value,
                            },
                            `node-floor-${selectedNode.id}`
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        DB Size
                      </span>
                      <select
                        value={selectedNode.sizeCode}
                        onChange={(e) => {
                          const nextSize = e.target.value;
                          const opt = getCatalogOptionForNode(selectedNode.category, nextSize);
                          const cap = opt?.ways ?? selectedNode.capacityWays ?? 0;
                          const used = selectedNode.usedWays ?? 0;
                          const nextDoc: SldDocument = {
                            ...doc,
                            nodes: doc.nodes.map((n) =>
                              n.id === selectedNode.id
                                ? {
                                    ...n,
                                    sizeCode: nextSize,
                                    capacityWays: cap,
                                    baseCapacityWays: cap,
                                    incomingType: opt?.incoming || n.incomingType,
                                    ratingText: defaultBreakerRating(selectedNode.category, nextSize),
                                    spareCount: Math.max(0, cap - used),
                                  }
                                : n
                            ),
                          };
                          commitDocWithReconcile(nextDoc, true);
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                      >
                        {getCatalogForCategory(selectedNode.category).map((opt) => (
                          <option key={opt.sizeCode} value={opt.sizeCode}>
                            {opt.sizeCode} ({opt.ways} ways)
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        Spare Number (Upgrades DB if 0)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={selectedNode.spareCount ?? 0}
                        onChange={(e) => {
                          if (e.target.value === '') return;
                          const targetSpare = Math.max(0, parseInt(e.target.value, 10) || 0);
                          const opt = getCatalogOptionForNode(
                            selectedNode.category,
                            selectedNode.sizeCode
                          );
                          const cap = selectedNode.capacityWays ?? opt?.ways ?? 0;
                          const targetUsed = Math.max(0, cap - targetSpare);

                          let childCount = 0;
                          for (const ed of doc.edges) {
                            if (ed.fromNodeId === selectedNode.id && ed.toNodeId) {
                              const tgt = nodeMap.get(ed.toNodeId);
                              if (tgt?.kind === 'db' && isDbParentChildPair(selectedNode.category, tgt.category)) {
                                childCount++;
                              }
                            }
                          }
                          const nextDirectUsed = Math.max(0, targetUsed - childCount);
                          const nextDoc: SldDocument = {
                            ...doc,
                            nodes: doc.nodes.map((n) =>
                              n.id === selectedNode.id
                                ? {
                                    ...n,
                                    directUsedWays: nextDirectUsed,
                                    usedWays: nextDirectUsed + childCount,
                                    spareCount: targetSpare,
                                  }
                                : n
                            ),
                          };
                          commitDocWithReconcile(nextDoc, true);
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </label>

                    {/* Parent DB Reassignment Selector (LDB -> PDB, or PDB -> VTPNDB) */}
                    {(() => {
                      const candidateParents = doc.nodes.filter(
                        (cand) =>
                          cand.kind === 'db' &&
                          cand.id !== selectedNode.id &&
                          isDbParentChildPair(cand.category, selectedNode.category)
                      );
                      if (candidateParents.length === 0) return null;
                      const currentParentEdge = doc.edges.find((ed) => {
                        if (ed.toNodeId !== selectedNode.id || !ed.fromNodeId) return false;
                        const p = nodeMap.get(ed.fromNodeId);
                        return Boolean(
                          p && isDbParentChildPair(p.category, selectedNode.category)
                        );
                      });
                      const currentParentId = currentParentEdge?.fromNodeId || '';
                      return (
                        <label className="block space-y-1">
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">
                            {selectedNode.category === 'LDB'
                              ? 'Fed From PDB (Move LDB)'
                              : 'Fed From VTPNDB (Move PDB)'}
                          </span>
                          <select
                            value={currentParentId}
                            onChange={(e) => {
                              const nextParentId = e.target.value;
                              if (!nextParentId) return;
                              const { doc: updated, upgradedMessages } = reassignDbParentInSld(
                                doc,
                                selectedNode.id,
                                nextParentId
                              );
                              commitDocChange(updated);
                              const targetNode = nodeMap.get(nextParentId);
                              const msg = `Moved ${selectedNode.code} (${selectedNode.floorName || selectedNode.scope}) to ${targetNode?.code} (${targetNode?.floorName || targetNode?.scope}).`;
                              onNotify?.(
                                upgradedMessages.length > 0
                                  ? `${msg} ${upgradedMessages.join(' ')}`
                                  : msg
                              );
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-950 dark:text-white focus:border-sky-500 focus:outline-none"
                          >
                            {!currentParentId && (
                              <option value="">-- Direct / Unassigned --</option>
                            )}
                            {candidateParents.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.floorName || p.scope} · {p.category} ({p.code}, Spare: {p.spareCount ?? 0})
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        Tag Code
                      </span>
                      <input
                        type="text"
                        value={selectedNode.code}
                        onChange={(e) =>
                          updateSelectedNode({ code: e.target.value }, `node-code-${selectedNode.id}`)
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        Block Label / Function
                      </span>
                      <input
                        type="text"
                        value={selectedNode.scope}
                        onChange={(e) =>
                          updateSelectedNode({ scope: e.target.value }, `node-scope-${selectedNode.id}`)
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        Size / Panel Configuration
                      </span>
                      <input
                        type="text"
                        value={selectedNode.sizeCode}
                        onChange={(e) =>
                          updateSelectedNode({ sizeCode: e.target.value }, `node-size-${selectedNode.id}`)
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        Rating / Busbar Specification
                      </span>
                      <input
                        type="text"
                        value={selectedNode.ratingText}
                        onChange={(e) =>
                          updateSelectedNode(
                            { ratingText: e.target.value },
                            `node-rating-${selectedNode.id}`
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </label>
                  </>
                )}

                {/* Manual Outgoing Connection Nodes Editor (Busbar Chamber & DBs) */}
                {(selectedNode.kind === 'busbar-chamber' ||
                  selectedNode.kind === 'db') && (
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="font-semibold text-[11px] text-slate-800 dark:text-slate-200">
                      {selectedNode.kind === 'busbar-chamber'
                        ? 'Outgoing Main Switch Nodes'
                        : 'Outgoing Connection Nodes'}
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newOutgoingLabel}
                        onChange={(e) => setNewOutgoingLabel(e.target.value)}
                        placeholder={
                          selectedNode.kind === 'busbar-chamber'
                            ? 'e.g. OG-MS3'
                            : 'e.g. O3'
                        }
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono text-[11px] text-slate-950 dark:text-white focus:border-sky-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleAddOutgoingNode(selectedNode, newOutgoingLabel)
                        }
                        className="flex items-center gap-1 px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Node</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {(selectedNode.outgoingNodes || []).map((og) => (
                        <div
                          key={og.id}
                          className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-1"
                        >
                          <input
                            type="text"
                            value={og.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateSelectedNode(
                                {
                                  outgoingNodes: (selectedNode.outgoingNodes || []).map(
                                    (item) =>
                                      item.id === og.id ? { ...item, label: val } : item
                                  ),
                                },
                                `node-og-${selectedNode.id}-${og.id}`
                              );
                            }}
                            className="flex-1 min-w-0 bg-transparent font-mono text-[11px] text-slate-900 dark:text-white focus:outline-none"
                          />
                          {selectedNode.kind === 'busbar-chamber' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleSpawnOutgoingSwitch(selectedNode, og)
                              }
                              className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold whitespace-nowrap shrink-0"
                              title="Insert and wire an Outgoing Main Switch below this node"
                            >
                              + Switch
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveOutgoingNode(selectedNode, og.id)
                            }
                            className="p-0.5 text-rose-500 hover:text-rose-400 shrink-0"
                            title="Remove outgoing node"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Group Membership Assignment */}
                {groupsList.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Group Labeling Membership
                    </div>
                    {groupsList.map((g) => {
                      const inGroup = g.nodeIds.includes(selectedNode.id);
                      return (
                        <label
                          key={g.id}
                          className="flex items-center gap-2 text-[11px] text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={inGroup}
                            onChange={(e) => {
                              const nextIds = e.target.checked
                                ? [...g.nodeIds, selectedNode.id]
                                : g.nodeIds.filter((id) => id !== selectedNode.id);
                              updateGroupById(g.id, { nodeIds: nextIds });
                            }}
                            className="accent-sky-600"
                          />
                          <span>{g.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Block</span>
                </button>
              </div>
            ) : selectedEdge ? (
              <div className="space-y-3">
                <div className="font-mono text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                  FEEDER LINE · {selectedEdge.lineStyle.toUpperCase()}
                </div>

                <label className="block space-y-1">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Feeder Category / Style
                  </span>
                  <select
                    value={selectedEdge.lineStyle}
                    onChange={(e) =>
                      updateSelectedEdge({ lineStyle: e.target.value as SldLineStyle })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="main">Main Bus (Solid Heavy)</option>
                    <option value="raw">Raw Power Feeder (Emerald)</option>
                    <option value="emergency">Emergency Feeder (Dashed Amber)</option>
                    <option value="custom">Custom Feeder (Dotted Blue)</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cable / Conduit Callout
                  </span>
                  <input
                    type="text"
                    value={selectedEdge.cableLabel}
                    onChange={(e) =>
                      updateSelectedEdge(
                        { cableLabel: e.target.value },
                        `edge-cable-${selectedEdge.id}`
                      )
                    }
                    placeholder="e.g. 4C x 25 sq.mm Cu Ar."
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-950 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </label>

                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Manual Line Rerouting
                  </div>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                    Drag pink square handles on segments to shift bends, or drag cyan endpoint circles onto any block port.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const edgeIdx = doc.edges.findIndex((e) => e.id === selectedEdge.id);
                        const trunkRatio = 0.44 + (((edgeIdx >= 0 ? edgeIdx : 0) % 4) - 1.5) * 0.05;
                        const pts = computeOrthogonalPath(selectedEdge, nodeMap, trunkRatio);
                        if (pts.length < 2) return;
                        let bestSeg = 0;
                        let bestLen = -1;
                        for (let i = 0; i < pts.length - 1; i++) {
                          const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
                          if (len > bestLen) {
                            bestLen = len;
                            bestSeg = i;
                          }
                        }
                        const nextWp = insertBendOnSegment(pts, bestSeg, snapEnabled);
                        updateSelectedEdge({
                          waypoints: nextWp.length > 0 ? nextWp : undefined,
                          isManual: true,
                        });
                        onNotify?.('Added orthogonal bend to selected feeder line.');
                      }}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:hover:bg-cyan-950/70 text-cyan-800 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-700 text-[11px] font-semibold whitespace-nowrap"
                    >
                      <CornerDownRight className="w-3 h-3" />
                      <span>Add Bend</span>
                    </button>

                    <button
                      type="button"
                      disabled={!selectedEdge.waypoints || selectedEdge.waypoints.length === 0}
                      onClick={() => {
                        updateSelectedEdge({ waypoints: undefined });
                        onNotify?.('Restored automatic orthogonal route.');
                      }}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[11px] font-medium whitespace-nowrap"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Route</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteEdge(selectedEdge.id)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Feeder Line</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                <p>
                  Click any DB box, Busbar Chamber, switch block, group label, or feeder line to edit its properties and outgoing nodes.
                </p>

                {groupsList.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Panel / Label Groups
                      </span>
                      <button
                        type="button"
                        onClick={handleCreateGroup}
                        className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        + Add
                      </button>
                    </div>
                    {groupsList.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGroupId(g.id);
                          setSelectedNodeId(null);
                          setSelectedEdgeId(null);
                        }}
                        className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {g.label}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {g.nodeIds.length} blocks
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Quick CAD Drafting Tips
                  </div>
                  <div>• <strong>Auto-Layout</strong> automatically organizes blocks into strict floor rows after every connection change.</div>
                  <div>• Enable <strong>Node Snap</strong> when drawing lines to highlight and snap-connect directly to any nearby block port.</div>
                  <div>• Select <strong>Busbar Chamber</strong> or any DB box to add/edit its separate outgoing connection nodes.</div>
                  <div>• Shift+Click multiple blocks then click <strong>Group</strong> (or click any group header like <strong>L.T. PANEL</strong>) to manage labels.</div>
                  <div>• Scroll mouse wheel anywhere on the canvas to zoom smoothly at the cursor.</div>
                  <div>• Select a feeder line to drag segment bends, double-click to add a bend, or drag cyan endpoints onto any outgoing node.</div>
                  <div>• Use <strong>Cut Line</strong> (Split / Remove) to break or delete existing feeder lines directly.</div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
