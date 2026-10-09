import { chipSet } from "./chip-sets";
import type { CaptionCode, ClaimType, Section } from "./types";

export const CLAIM_TYPE_META: {
  id: ClaimType;
  label: string;
  pill: "water" | "wind" | "fire" | "neutral";
  helper: string;
  roof: boolean;
  water: boolean;
}[] = [
  {
    id: "water_plumbing",
    label: "Water — Plumbing",
    pill: "water",
    helper:
      "IICRC S500 Category and Class selectors appear on each affected room, plus moisture readings. Category 1 is sanitary, Category 2 significantly contaminated, Category 3 grossly contaminated.",
    roof: false,
    water: true,
  },
  {
    id: "water_roof",
    label: "Water — Roof Leak",
    pill: "water",
    helper:
      "IICRC S500 selectors appear on affected rooms. Roof slopes use F / R / B / L. Document the water entry point.",
    roof: true,
    water: true,
  },
  {
    id: "wind_hail",
    label: "Wind / Hail",
    pill: "wind",
    helper:
      "Slope captures (F/R/B/L), a 10×10 test square, and collateral indicators are required. Close-up captions: BLEMISHES / WIND / NWR / CONTRACTOR / UNKNOWN. Do not use H for perceived hail.",
    roof: true,
    water: false,
  },
  {
    id: "fire",
    label: "Fire / Smoke",
    pill: "fire",
    helper:
      "Document origin, smoke gradient, and electrical / HVAC components. Unaffected items still need a No damage observed photo.",
    roof: false,
    water: false,
  },
  {
    id: "vandalism",
    label: "Vandalism",
    pill: "neutral",
    helper: "Capture the police report number and a damage close-up per affected item. Note LKQ where replacement must match.",
    roof: false,
    water: false,
  },
  {
    id: "tree",
    label: "Tree Impact",
    pill: "neutral",
    helper: "Document impact point, species, and root location. Name additional structures in the room label, for example Garage — Front Elevation.",
    roof: true,
    water: false,
  },
];

export const PHASE_2_TYPES = [
  "Sewer Backup",
  "Flood / Surface Water",
  "Freeze",
  "Foundation",
  "HVAC / Appliance",
  "Off-Premises",
];

export const CAPTIONS: { id: CaptionCode; label: string; full: string; note: string }[] = [
  {
    id: "BLEMISHES",
    label: "BLEMISHES",
    full: "BLEMISHES",
    note: "Carrier-approved close-up language. Do not use H to reference perceived hail. Adjusters do not make coverage determinations in the field.",
  },
  {
    id: "WIND",
    label: "WIND",
    full: "WIND",
    note: "Wind marks use a W suffix on the slope count, for example F=6W.",
  },
  {
    id: "NWR",
    label: "NWR",
    full: "NON-WEATHER RELATED",
    note: "Looks like hail or wind but is not weather-related.",
  },
  {
    id: "CONTRACTOR",
    label: "CONTRACTOR",
    full: "CONTRACTOR CONSIDERATION",
    note: "Workmanship or installation item for the contractor, not a field coverage call.",
  },
  {
    id: "UNKNOWN",
    label: "UNKNOWN",
    full: "UNKNOWN or OTHER",
    note: "Cause not determined on site.",
  },
];

export const LOSS_ROLES = ["Origin", "Path", "Affected", "Unaffected", "Unknown"] as const;

export const TRIGGERS = [
  "Cabinets Affected",
  "Flooring Affected",
  "Equipment Involved",
  "Ceiling/Wall Water",
  "Contents Affected",
  "Prior Damage",
  "HVAC Affected",
  "Plumbing Damage",
  "Electrical Damage",
  "Pest/Mold Concern",
];

export const WIND_DAMAGE = [
  "Creased three-tab",
  "Missing three-tab (clean straight break)",
  "Missing/torn dimensional",
  "Lifted dimensional",
  "Sealant failure",
  "Improper nailing",
  "Vertical racking",
  "Human-caused",
];

export const EDGEWORK = ["Drip edge", "Gutter apron", "Valley metal", "Starter course", "Underlayment"];

export const SLOPE_NAMES: Record<string, string> = {
  F: "Front",
  R: "Right",
  B: "Back",
  L: "Left",
};

export const TEST_SQUARE = "10 ft × 10 ft (100 sq ft). Brackets visible in the wide shot. Circle one mark per shingle. Mark wind with W.";

export const DOCUMENT_EMAIL = "insurancescheduling@gmail.com";

export function claimMeta(id: ClaimType) {
  return CLAIM_TYPE_META.find((item) => item.id === id) ?? CLAIM_TYPE_META[0];
}

/** Full chip list for a section per the requirements matrix. Prefer `chipsForRoom` on the camera screen. */
export function chipsFor(claimType: ClaimType, section: Section): string[] {
  return chipSet(claimType, section).map((chip) => chip.label);
}

export { chipsForRoom, type Chip } from "./chip-sets";

export const CABINET_SEQUENCE = [
  "Exterior overview of the full cabinet run",
  "Front elevation — doors closed",
  "End panels — left and right",
  "Toe kick — waterline is often visible here",
  "Interior of the affected cabinet",
  "LKQ label or material sample",
];

export const FLOORING_SEQUENCE = [
  "Continuous flooring overview through the doorway",
  "Transition at the room boundary",
  "Material ID for like kind and quality",
  "Underlayment, if it is lifted",
  "No damage observed on unaffected flooring",
];

export const IICRC_CONTENT: Record<string, { title: string; subtitle: string; sections: { h: string; items: string[] }[] }> = {
  cat1: {
    title: "Category 1 — Sanitary",
    subtitle: "Originates from a sanitary source and does not pose a substantial risk if contacted or ingested.",
    sections: [
      { h: "Common sources", items: ["Supply lines and faucets", "Toilet tank with no contaminants", "Rainwater", "Melted ice or snow"] },
      { h: "Watch for", items: ["Can deteriorate to Category 2 or 3 after a long dwell time", "Photograph the source and a dry benchmark"] },
    ],
  },
  cat2: {
    title: "Category 2 — Significantly contaminated",
    subtitle: "May cause discomfort or sickness if contacted or ingested.",
    sections: [
      { h: "Common sources", items: ["Dishwasher or washing machine discharge", "Toilet overflow with urine only", "Aquarium or waterbed"] },
    ],
  },
  cat3: {
    title: "Category 3 — Grossly contaminated",
    subtitle: "Contains pathogenic, toxigenic, or other harmful agents.",
    sections: [
      { h: "Common sources", items: ["Sewage", "Rising flood water", "Toilet overflow containing feces", "Water from beyond the toilet trap"] },
    ],
  },
  class1: {
    title: "Class 1 — Least evaporation load",
    subtitle: "Less than about 5% of the combined surface area is wet.",
    sections: [{ h: "Indicators", items: ["Low-permeance materials", "Minimal wicking up walls"] }],
  },
  class2: {
    title: "Class 2 — Fast evaporation rate",
    subtitle: "The room is wet and moisture has wicked up the walls.",
    sections: [{ h: "Indicators", items: ["Walls wet 12 inches or more", "Carpet and pad saturated"] }],
  },
  class3: {
    title: "Class 3 — Fastest evaporation rate",
    subtitle: "Ceilings, walls, insulation, and flooring are saturated. Often from overhead.",
    sections: [{ h: "Indicators", items: ["Overhead source", "Multiple wet assemblies"] }],
  },
  class4: {
    title: "Class 4 — Specialty drying",
    subtitle: "Low-permeance materials such as hardwood, plaster, brick, or stone.",
    sections: [{ h: "Indicators", items: ["Bound water in dense materials", "Standard drying is not enough"] }],
  },
};

export const WORKFLOW = [
  {
    n: 1,
    title: "Exterior perimeter",
    meta: "Address Verification, Risk Front Photo, four elevation overviews, four corners",
    desc: "Walk the risk clockwise. Burst first, then tag rooms in the tray. Unaffected items get a No damage observed caption.",
  },
  {
    n: 2,
    title: "Roof",
    meta: "Slopes F / R / B / L, test square, collateral indicators, edgework",
    desc: "Required for Wind/Hail and Water — Roof Leak. Test square is 10×10. Blemish counts read F=10. Wind reads F=6W.",
  },
  {
    n: 3,
    title: "Interior",
    meta: "Loss role per room: Origin, Path, Affected, Unaffected, or Unknown",
    desc: "Photograph the level, then run a room estimate so area comes from the point cloud. Name extra structures in the label, such as Garage — Front Elevation.",
  },
  {
    n: 4,
    title: "Deficiency check",
    meta: "Last gate before leaving the risk",
    desc: "Required items must be captured or logged as a limitation with a reason. Conditional items follow triggers. Optional items never raise a deficiency.",
  },
  {
    n: 5,
    title: "Export",
    meta: "Report plus a ZIP of IPTC-tagged photos and a manifest",
    desc: "Like kind and quality notes travel with the photo sheet. Carrier is stored on the claim and does not change the capture set in V1.",
  },
];
