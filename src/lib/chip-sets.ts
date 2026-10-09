/**
 * Camera-screen chip sets, transcribed from SIDA_Requirements_Matrix_v2:
 *   - "Actions Master"  → action IDs and the exact UI chip text
 *   - "Chip Sets"       → which actions render per (claim type, section) and whether each is R or C
 *   - "Triggers"        → which conditional groups a room's triggers switch on
 *
 * Keep this file identical in sida/src/lib and sida-server/src/lib.
 */
import type { ClaimType, Room, Section, SlopeCode } from "./types";

export type Requirement = "R" | "C";

export type ChipGroup =
  | "universal"
  | "exterior"
  | "roof"
  | "interior"
  | "ceilingWall"
  | "cabinetry"
  | "flooring"
  | "equipment"
  | "otherStructures"
  | "contents";

export interface Chip {
  /** Action ID from the matrix, e.g. "EXT.001". */
  id: string;
  /** Exact chip text from Actions Master. Stored on the photo as `chip`. */
  label: string;
  group: ChipGroup;
  required: boolean;
}

/** Actions Master — photo-type actions only (selections, documents and limitations aren't camera chips). */
export const ACTION_LABELS: Record<string, string> = {
  "UNIV.001": "Address Verification",
  "UNIV.002": "Risk Front Photo",
  "UNIV.006": "Underwriting Alert Photo",

  "EXT.001": "Front Elevation Overview",
  "EXT.002": "Right Elevation Overview",
  "EXT.003": "Rear Elevation Overview",
  "EXT.004": "Left Elevation Overview",
  "EXT.005": "Front-Right Corner",
  "EXT.006": "Rear-Right Corner",
  "EXT.007": "Rear-Left Corner",
  "EXT.008": "Front-Left Corner",
  "EXT.009": "Damage Overview — Elevation",
  "EXT.010": "Damage Close-Up — Elevation",
  "EXT.011": "No Damage Observed — Elevation",
  "EXT.012": "Siding / Cladding Damage",
  "EXT.013": "Window / Screen / Wrap Damage",
  "EXT.014": "Gutter Width Measurement",
  "EXT.015": "Downspout Width Measurement",
  "EXT.016": "Gutter / Downspout Damage",
  "EXT.017": "AC Condenser Unit",
  "EXT.018": "Foundation Crack — Length",
  "EXT.019": "Foundation Crack — Width",

  "ROOF.001": "Ladder Setup",
  "ROOF.003": "Front Slope (F) Overview",
  "ROOF.004": "Right Slope (R) Overview",
  "ROOF.005": "Back Slope (B) Overview",
  "ROOF.006": "Left Slope (L) Overview",
  "ROOF.007": "Number of Layers Photo",
  "ROOF.008": "Pitch Gauge Photo",
  "ROOF.009": "Shingle Gauge Photo",
  "ROOF.010": "Drip Edge Photo",
  "ROOF.011": "Underlayment / Felt / IWS",
  "ROOF.012": "Starter Course / Starter Row",
  "ROOF.013": "Valley Metal / Valley Material",
  "ROOF.014": "Ridge Cap Detail",
  "ROOF.015": "Hip Cap Detail",
  "ROOF.016": "Test Square — Slope Wide Shot",
  "ROOF.017": "Test Square — Singular Impact Close-Up",
  "ROOF.018": "Slope Damage Count (Chalk-Marked)",
  "ROOF.019": "Collateral Indicators — Soft Metals",
  "ROOF.020": "Vent / Vent Cap / Chimney Cap",
  "ROOF.021": "Chimney Flashing",
  "ROOF.022": "Skylight / Penetration",
  "ROOF.023": "Roof — No Damage Observed",
  "ROOF.024": "Attic / Decking from Below",
  "ROOF.025": "Soffit Depth Measurement",

  "INT.001": "Entry — Main Doorway",
  "INT.002": "Path of Loss — Hallway / Transition",
  "INT.003": "Room Overview — 4 Corners",
  "INT.004": "Ceiling Overview",
  "INT.005": "Floor Overview",
  "INT.006": "Damage Overview — Mid-Range",
  "INT.007": "Damage Close-Up",
  "INT.008": "Source Relationship Photo",
  "INT.009": "Room — No Damage Observed",
  "INT.011": "Moisture Reading — Dry Benchmark",
  "INT.012": "Moisture Reading — Affected Area",
  "INT.016": "Visible Staining / Damage Indicator",
  "INT.017": "Removed Materials / Exposed Assembly",
  "INT.018": "Mitigation Equipment Present",
  "INT.019": "Smoke Pattern / Soot Pattern",
  "INT.020": "Charring / Heat Damage",
  "INT.021": "Fire Origin Area",
  "INT.022": "Wall Texture Documentation",
  "INT.023": "Electrical Outlets / Switches Count",
  "INT.024": "Like Kind and Quality (LKQ) Reference",

  "COND.CW.001": "Ceiling / Wall Water Damage Overview",
  "COND.CW.002": "Source Area Above / Behind",
  "COND.CW.003": "Damaged Area Measurement",

  "COND.CAB.001": "Cabinet Overview",
  "COND.CAB.002": "Cabinet Front Elevation",
  "COND.CAB.003": "Cabinet End Panel — Left",
  "COND.CAB.004": "Cabinet End Panel — Right",
  "COND.CAB.005": "Cabinet Toe Kick",
  "COND.CAB.006": "Cabinet Interior (Doors / Drawers Open)",
  "COND.CAB.007": "Cabinet Run Length",
  "COND.CAB.008": "Countertop / Backsplash",

  "COND.FLR.001": "Flooring Damage Close-Up",
  "COND.FLR.002": "Flooring Transition Point",
  "COND.FLR.003": "Continuous Flooring (Adjacent Rooms)",
  "COND.FLR.004": "Affected Flooring Area Measurement",
  "COND.FLR.005": "Wood Floor — Clipboard / Straightedge",
  "COND.FLR.007": "Subfloor / Sleeper System",

  "COND.EQ.001": "Equipment Overview",
  "COND.EQ.002": "Serial Tag / Data Plate",
  "COND.EQ.003": "Source Connection (Supply / Drain Line)",
  "COND.EQ.004": "Equipment Damage",
  "COND.EQ.005": "Shutoff Valves",

  "OTHER.001": "Other Structure Overview",
  "OTHER.002": "Other Structure Elevation",
  "OTHER.003": "Other Structure Roof",
  "OTHER.004": "Other Structure Damage",

  "CONT.001": "Contents / Personal Property Overview",
  "CONT.002": "Individual Item Photo",
  "CONT.003": "Contents — Brand / Model / Serial",
  "CONT.004": "Discarded Contents",
};

export function chipLabel(actionId: string): string {
  return ACTION_LABELS[actionId] ?? actionId;
}

type Spec = [string, Requirement];

/** Expands "EXT.001-004" style ranges so the sheet rows below stay readable. */
function range(prefix: string, from: number, to: number, req: Requirement): Spec[] {
  const out: Spec[] = [];
  for (let n = from; n <= to; n += 1) out.push([`${prefix}.${String(n).padStart(3, "0")}`, req]);
  return out;
}

const ELEVATIONS_AND_CORNERS: Spec[] = range("EXT", 1, 8, "R");
const ELEVATION_DAMAGE: Spec[] = [
  ["EXT.009", "C"],
  ["EXT.010", "C"],
  ["EXT.011", "R"],
];
const SLOPES = (req: Requirement): Spec[] => range("ROOF", 3, 6, req);
const ROOF_DETAIL = (req: Requirement): Spec[] => range("ROOF", 7, 15, req);
const INTERIOR_CORE = (req: Requirement): Spec[] => range("INT", 1, 5, req);
const INTERIOR_DAMAGE: Spec[] = range("INT", 6, 8, "C");

// ── Chip Sets sheet, one block per claim type ───────────────────────────────

const UNIVERSAL: Spec[] = [
  ["UNIV.001", "R"],
  ["UNIV.002", "R"],
  ["UNIV.006", "C"],
];

const EXTERIOR: Record<ClaimType, Spec[]> = {
  water_plumbing: [...ELEVATIONS_AND_CORNERS, ...ELEVATION_DAMAGE, ["EXT.012", "C"], ["EXT.013", "C"]],
  water_roof: [
    ...ELEVATIONS_AND_CORNERS,
    ...ELEVATION_DAMAGE,
    ["EXT.012", "C"],
    ["EXT.013", "C"],
    ["EXT.014", "R"],
    ["EXT.015", "R"],
    ["EXT.016", "R"],
  ],
  wind_hail: [...ELEVATIONS_AND_CORNERS, ...ELEVATION_DAMAGE, ...range("EXT", 12, 17, "R")],
  fire: [...ELEVATIONS_AND_CORNERS, ...ELEVATION_DAMAGE, ["EXT.012", "C"], ["EXT.013", "C"], ["EXT.016", "C"]],
  vandalism: [
    ...ELEVATIONS_AND_CORNERS,
    ...ELEVATION_DAMAGE,
    ["EXT.012", "C"],
    ["EXT.013", "R"],
    ["EXT.016", "C"],
    ["EXT.017", "C"],
  ],
  tree: [...ELEVATIONS_AND_CORNERS, ...ELEVATION_DAMAGE, ["EXT.012", "R"], ...range("EXT", 13, 19, "C")],
};

const ROOF: Record<ClaimType, Spec[]> = {
  water_plumbing: [],
  water_roof: [
    ["ROOF.001", "R"],
    ...SLOPES("R"),
    ...ROOF_DETAIL("R"),
    ["ROOF.019", "C"],
    ...range("ROOF", 20, 25, "R"),
  ],
  wind_hail: [
    ["ROOF.001", "R"],
    ...SLOPES("R"),
    ...ROOF_DETAIL("R"),
    ...range("ROOF", 16, 20, "R"),
    ["ROOF.021", "C"],
    ["ROOF.022", "R"],
    ["ROOF.023", "R"],
    ["ROOF.024", "C"],
    ["ROOF.025", "R"],
  ],
  fire: [["ROOF.001", "C"], ...SLOPES("C"), ...range("ROOF", 20, 24, "C")],
  vandalism: [["ROOF.001", "C"], ...SLOPES("C"), ["ROOF.019", "C"]],
  tree: [["ROOF.001", "R"], ...SLOPES("R"), ...ROOF_DETAIL("C"), ...range("ROOF", 19, 25, "C")],
};

const WATER_INTERIOR: Spec[] = [
  ...INTERIOR_CORE("R"),
  ...INTERIOR_DAMAGE,
  ["INT.009", "R"],
  ["INT.011", "R"],
  ["INT.012", "R"],
  ["INT.016", "C"],
  ["INT.017", "C"],
  ["INT.018", "C"],
  ["INT.022", "C"],
  ["INT.024", "C"],
];

const INTERIOR: Record<ClaimType, Spec[]> = {
  water_plumbing: WATER_INTERIOR,
  water_roof: WATER_INTERIOR,
  wind_hail: [...INTERIOR_CORE("C"), ...INTERIOR_DAMAGE, ["INT.009", "C"], ["INT.016", "C"], ["INT.024", "C"]],
  fire: [
    ...INTERIOR_CORE("R"),
    ...INTERIOR_DAMAGE,
    ["INT.009", "R"],
    ["INT.016", "C"],
    ["INT.017", "C"],
    ["INT.019", "R"],
    ["INT.020", "R"],
    ["INT.021", "R"],
    ["INT.022", "C"],
    ["INT.023", "C"],
    ["INT.024", "C"],
  ],
  vandalism: [...INTERIOR_CORE("C"), ...INTERIOR_DAMAGE, ["INT.009", "R"], ["INT.016", "C"], ["INT.024", "C"]],
  tree: [
    ...INTERIOR_CORE("C"),
    ...INTERIOR_DAMAGE,
    ["INT.009", "C"],
    ["INT.011", "C"],
    ["INT.012", "C"],
    ["INT.016", "C"],
    ["INT.024", "C"],
  ],
};

/** COND.CW — listed inline under Interior for water-related types and Tree Impact; switched on by the Ceiling/Wall Water trigger. */
const CEILING_WALL: Partial<Record<ClaimType, Spec[]>> = {
  water_plumbing: range("COND.CW", 1, 3, "C"),
  water_roof: range("COND.CW", 1, 3, "C"),
  tree: range("COND.CW", 1, 3, "C"),
};

const CABINETRY: Spec[] = range("COND.CAB", 1, 8, "C");
const FLOORING: Spec[] = [...range("COND.FLR", 1, 5, "C"), ["COND.FLR.007", "C"]];
const EQUIPMENT: Spec[] = range("COND.EQ", 1, 5, "C");
const CONTENTS: Spec[] = range("CONT", 1, 4, "C");
const OTHER_STRUCTURES: Record<ClaimType, Spec[]> = {
  water_plumbing: [["OTHER.001", "C"], ["OTHER.002", "C"], ["OTHER.004", "C"]],
  water_roof: range("OTHER", 1, 4, "C"),
  wind_hail: range("OTHER", 1, 4, "C"),
  fire: range("OTHER", 1, 4, "C"),
  vandalism: [["OTHER.001", "C"], ["OTHER.002", "C"], ["OTHER.004", "C"]],
  tree: range("OTHER", 1, 4, "C"),
};

function build(specs: Spec[], group: ChipGroup): Chip[] {
  return specs.map(([id, req]) => ({ id, label: chipLabel(id), group, required: req === "R" }));
}

/** Everything the sheet lists for a section, before any room-level narrowing. */
export function chipSet(claimType: ClaimType, section: Section): Chip[] {
  if (section === "exterior") return [...build(UNIVERSAL, "universal"), ...build(EXTERIOR[claimType], "exterior")];
  if (section === "roof") return build(ROOF[claimType], "roof");
  return [...build(INTERIOR[claimType], "interior"), ...build(CEILING_WALL[claimType] ?? [], "ceilingWall")];
}

// ── Room-level narrowing ────────────────────────────────────────────────────

type Elevation = "F" | "R" | "B" | "L";

const ELEVATION_OVERVIEW: Record<string, Elevation> = {
  "EXT.001": "F",
  "EXT.002": "R",
  "EXT.003": "B",
  "EXT.004": "L",
};

const CORNER_SIDES: Record<string, Elevation[]> = {
  "EXT.005": ["F", "R"],
  "EXT.006": ["B", "R"],
  "EXT.007": ["B", "L"],
  "EXT.008": ["F", "L"],
};

/** "Front Elevation" → F, "Garage — Rear Elevation" → B, "Exterior" → null. */
export function elevationOf(name: string): Elevation | null {
  const part = name.split("—").pop() ?? name;
  if (/\bfront\b/i.test(part)) return "F";
  if (/\bright\b/i.test(part)) return "R";
  if (/\b(rear|back)\b/i.test(part)) return "B";
  if (/\bleft\b/i.test(part)) return "L";
  return null;
}

/** Rooms named "Garage — Front Elevation" are other structures per the matrix naming convention. */
export function isOtherStructure(name: string): boolean {
  return name.includes("—");
}

export function slopeOf(room: Pick<Room, "name" | "slopeCode">): SlopeCode | null {
  if (room.slopeCode) return room.slopeCode;
  return elevationOf(room.name);
}

/**
 * The chips to render on the camera screen for one room.
 *
 * - Exterior: only this elevation's overview and its two corners; universals (Address Verification,
 *   Risk Front Photo) ride with the front elevation. Structure-prefixed rooms get the Other Structures group.
 * - Roof: only this slope's overview, plus every non-slope roof chip.
 * - Interior: the claim type's interior list plus cabinetry, flooring, equipment, or contents when this room's triggers include them.
 */
export function chipsForRoom(claimType: ClaimType, room: Pick<Room, "name" | "section" | "slopeCode" | "triggers">, _claimTriggers: string[] = []): Chip[] {
  const base = chipSet(claimType, room.section);
  // Only this room's triggers add conditional groups. A claim-level trigger means the claim needs
  // that documentation somewhere; spreading it onto every room made every room show the same chips.
  const triggers = new Set(room.triggers ?? []);

  if (room.section === "exterior") {
    const elevation = elevationOf(room.name);
    const structure = isOtherStructure(room.name);
    const narrowed = base.filter((chip) => {
      if (chip.group === "universal") return !structure && (elevation === "F" || elevation === null);
      const overview = ELEVATION_OVERVIEW[chip.id];
      if (overview) return elevation === null || overview === elevation;
      const corner = CORNER_SIDES[chip.id];
      if (corner) return elevation === null || corner.includes(elevation);
      return true;
    });
    return structure ? [...build(OTHER_STRUCTURES[claimType], "otherStructures"), ...narrowed] : narrowed;
  }

  if (room.section === "roof") {
    const slope = slopeOf(room);
    return base.filter((chip) => {
      const overview = ELEVATION_OVERVIEW_ROOF[chip.id];
      return !overview || slope === null || overview === slope;
    });
  }

  const chips = base.filter((chip) => chip.group !== "ceilingWall" || triggers.has("Ceiling/Wall Water"));
  if (triggers.has("Cabinets Affected")) chips.push(...build(CABINETRY, "cabinetry"));
  if (triggers.has("Flooring Affected")) chips.push(...build(FLOORING, "flooring"));
  if (triggers.has("Equipment Involved")) chips.push(...build(EQUIPMENT, "equipment"));
  if (triggers.has("Contents Affected")) chips.push(...build(CONTENTS, "contents"));
  return chips;
}

const ELEVATION_OVERVIEW_ROOF: Record<string, SlopeCode> = {
  "ROOF.003": "F",
  "ROOF.004": "R",
  "ROOF.005": "B",
  "ROOF.006": "L",
};

/** Label of the slope overview chip for a slope code, e.g. "Front Slope (F) Overview". */
export function slopeOverviewChip(code: SlopeCode): string {
  const id = Object.entries(ELEVATION_OVERVIEW_ROOF).find(([, slope]) => slope === code)?.[0];
  return id ? chipLabel(id) : `Slope ${code}`;
}
