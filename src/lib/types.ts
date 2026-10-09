export const CLAIM_TYPES = [
  "water_plumbing",
  "water_roof",
  "wind_hail",
  "fire",
  "vandalism",
  "tree",
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];
export type SyncStatus = "synced" | "pending" | "local";
export type LossRole = "Origin" | "Path" | "Affected" | "Unaffected" | "Unknown";
export type Section = "exterior" | "roof" | "interior";
export type CaptionCode = "BLEMISHES" | "WIND" | "NWR" | "CONTRACTOR" | "UNKNOWN";
export type SlopeCode = "F" | "R" | "B" | "L";
export type InspectionPass = "initial" | "supplement";
export type PhotoKind = "standard" | "thermal" | "video";

export interface Claim {
  id: string;
  claimNumber: string;
  insuredName: string;
  dateOfLoss: string;
  riskAddress: string;
  carrier: string;
  claimType: ClaimType;
  syncStatus: SyncStatus;
  triggers: string[];
  policeReport?: string;
  inspectionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  claimId: string;
  name: string;
  section: Section;
  lossRole?: LossRole;
  /** Set when the room's photo list is finished and the adjuster answers the damage prompt. */
  damageObserved?: boolean;
  triggers: string[];
  iicrcCategory?: 1 | 2 | 3;
  iicrcClass?: 1 | 2 | 3 | 4;
  scopeNote?: string;
  slopeCode?: SlopeCode;
  hitCount?: number;
  windCount?: number;
  pitch?: string;
  measurements?: Measurements;
}

export interface Measurements {
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  areaSqFt: number;
  source: "scan" | "manual" | "lidar";
}

export type ScanSource = "generated" | "upload" | "lidar";

/** A single LiDAR-measured surface or damage area inside a room, in feet. */
export interface ScanRegion {
  label: string;
  widthFt: number;
  heightFt: number;
  areaSqFt: number;
  /** Camera-to-surface distance when measured. */
  depthFt: number;
}

export interface Photo {
  id: string;
  claimId: string;
  roomId: string | null;
  chip: string;
  captionCode?: CaptionCode;
  caption: string;
  damageCategory?: string;
  lkq?: string;
  kind: PhotoKind;
  hasImage: boolean;
  imageUrl?: string;
  cloudinaryPublicId?: string;
  voiceNote?: { duration: string; transcript: string; audioData?: string };
  iptcHeadline: string;
  iptcWritten: boolean;
  gps?: { lat: number; lng: number };
  capturedAt: string;
  syncStatus: SyncStatus;
  inspection: InspectionPass;
  deletedAt: string | null;
}

export interface MoistureReading {
  id: string;
  roomId: string;
  claimId: string;
  location: string;
  value: number;
  unit: string;
  instrument: string;
  createdAt: string;
}

export interface DocumentRequest {
  id: string;
  claimId: string;
  label: string;
  requested: boolean;
  email: string;
}

export interface Limitation {
  id: string;
  claimId: string;
  key: string;
  label?: string;
  reason: string;
  createdAt: string;
}

export interface RoomScan {
  id: string;
  roomId: string;
  claimId: string;
  points: number[][];
  pointCount: number;
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  areaSqFt: number;
  floorOk: boolean;
  ceilingOk: boolean;
  wallsOk: boolean;
  source: ScanSource;
  regions?: ScanRegion[];
  unitNote?: string;
  createdAt: string;
}

export interface ScanSummary {
  id: string;
  roomId: string;
  claimId: string;
  pointCount: number;
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  areaSqFt: number;
  source: ScanSource;
  regions?: ScanRegion[];
}

export interface Settings {
  id: string;
  name: string;
  license: string;
  defaultCarrier: string;
  iptc: boolean;
  wifiSync: boolean;
  cellSync: boolean;
  voiceNotesInExport: boolean;
  storageUsedGb: number;
  softDeleted: number;
}

export interface Issue {
  key: string;
  text: string;
  href: string;
  group: "hard" | "photos" | "water" | "documents" | "roof";
}

export interface DeficiencyReport {
  issues: Issue[];
  passing: string[];
}

export interface Bundle {
  claim: Claim;
  rooms: Room[];
  photos: Photo[];
  readings: MoistureReading[];
  documents: DocumentRequest[];
  limitations: Limitation[];
  scans: ScanSummary[];
  deficiencies: DeficiencyReport;
}
