export interface DSRVariantItem {
  code: string;
  name: string;
  unit: string;
  rate: string;
  isDeleted?: boolean;
  isModified?: boolean;
}

export interface DSRMasterItem {
  id: string;
  c: string; // Item code (e.g. "1.1")
  g: string; // Category/Group (e.g. "Internal Electrical Work")
  h: string; // Chapter heading (e.g. "1. Wiring")
  t: string; // Item Type (e.g. "Wiring – Light/Fan/Call-bell Points")
  d: string; // Master specification description
  u: string | null; // Standalone unit
  r: string | null; // Standalone rate
  variants: DSRVariantItem[]; // Sub-item variants
  tg: string[]; // Search and category tags
  p: number; // Page number
  s?: string; // Search synonyms / keywords
  gr?: string; // Group sub-heading
  f?: string; // Footnote / civil DSR warning
  isModified?: boolean;
  isCustomAdded?: boolean;
  isDeleted?: boolean;
  modifiedAt?: string;
}

export interface BOQItem {
  id: string;
  itemCode: string; // e.g. "1.1.1" or "1.2"
  parentCode: string; // Main DSR item code (e.g. "1.1")
  parentDescription: string; // Main DSR item specification description
  subItemName?: string; // Sized/rated variant name (e.g. "Group A" or "63 A 10kA")
  description: string; // Formatted description (First Item then Sub-item)
  fullSpecification: string;
  category: string;
  chapter?: string;
  itemType: string;
  unit: string;
  rate: number;
  quantity: number;
  lineTotal: number;
  isSubItem: boolean;
  notes?: string;
}

export interface ReviewState {
  isConfirmed: boolean;
  confirmedAt?: string;
  lastSavedAt?: string;
  totalOriginal: number;
  totalActive: number;
  totalModified: number;
  totalAdded: number;
  totalDeleted: number;
  totalVariants: number;
}

export type ViewMode =
  | 'floor-plan'
  | 'inventory'
  | 'building-load'
  | 'mcb-db'
  | 'dsr-mapping'
  | 'review'
  | 'catalog'
  | 'estimate'
  | 'pdf-viewer';

export type FloorPlanShapeType = 'rect' | 'polygon' | 'circle';

export interface FloorPlanPoint {
  x: number; // Image pixel X coordinate
  y: number; // Image pixel Y coordinate
}

export interface FloorPlanExtractedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorPlanSheet {
  id: string;
  name: string;
  defaultFloor: string;
  imageDataUrl: string;
  width: number;
  height: number;
  pixelsPerMeter: number;
  isCalibrated: boolean;
  canvasRotationDeg: number;
  sourceType: 'image' | 'pdf';
  pageNumber?: number;
  extractedTexts?: FloorPlanExtractedTextItem[];
}

export interface FloorPlanRoom {
  id: string;
  sheetId: string;
  floor: string;
  roomName: string;
  printedDimText?: string;
  shapeType: FloorPlanShapeType;
  color: string;
  rotationDeg: number; // Room overlay rotation around its center in degrees
  // For 'rect': center (cx, cy), widthPx, heightPx
  cx: number;
  cy: number;
  widthPx?: number;
  heightPx?: number;
  // For 'circle': center (cx, cy), radiusPx
  radiusPx?: number;
  // For 'polygon': unrotated points in image pixel coordinates
  points?: FloorPlanPoint[];
}

export type VentilationRoomType = 'general' | 'toilet' | 'kitchen_lab';
export type CoolingExposureType = 'normal' | 'sunny' | 'high-load' | 'server-ot';
export type PowerSourceType = 'raw' | 'emergency';
export type RawEmergencyColumnKey =
  | 'socket2x5a'
  | 'socket20a'
  | 'computerBoard'
  | 'socket3x20a'
  | 'noOfAc';

export interface InventoryRow {
  id: string;
  floor?: string;
  room: string;
  luxCategoryId?: string;
  targetLux?: string;
  acRequired?: 'yes' | 'no';
  ventType?: VentilationRoomType;
  ceilingHeightFt?: string;
  occupants?: string;
  exposureType?: CoolingExposureType;
  powerSources?: Partial<Record<RawEmergencyColumnKey, PowerSourceType>>;
  sqmt: string;
  sqft: string;
  tube20w: string;
  tube40w: string;
  surfaceLight36w: string;
  recessLight20w: string;
  recessLight36w: string;
  ceilingFan1200: string;
  ceilingFan1400: string;
  wallFan400: string;
  exhaustFan225: string;
  exhaustFan300: string;
  bulbPoint20w: string;
  socket5aOnBoard: string;
  socket2x5a: string;
  socket20a: string;
  computerBoard: string;
  socket3x20a: string;
  noOfAc: string;
  tonnage: string;
}

export interface InventoryColumn {
  id: string;
  badgeId: string;
  key:
    | 'slNo'
    | keyof Omit<
        InventoryRow,
        | 'id'
        | 'luxCategoryId'
        | 'targetLux'
        | 'acRequired'
        | 'ventType'
        | 'ceilingHeightFt'
        | 'occupants'
        | 'exposureType'
        | 'powerSources'
      >;
  label: string;
  type: 'serial' | 'text' | 'number';
  minWidth: string;
}

export interface FilterOptions {
  searchQuery: string;
  selectedCategory: string;
  selectedItemType: string;
  selectedTags: string[];
  sort: 'rel' | 'lo' | 'hi';
  reviewStatus: 'all' | 'modified' | 'added' | 'deleted' | 'active' | 'has-variants' | 'single-item';
}
