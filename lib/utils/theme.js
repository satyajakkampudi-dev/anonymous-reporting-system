// Shared theme tokens - single source of truth for the visual identity used by
// BOTH the web and mobile renderers, so the look stays consistent while layouts
// differ per platform (see ../../REQUIREMENTS.md §9.1).
// Colours, spacing, typography, and per-status/severity tones live here only -
// never hardcoded inside individual screen renderers.

import { STATUS, STATUS_META, TONE } from "../ticket-status";
import { SEVERITY } from "../constants";

// Brand + surface colours. A calm, trustworthy palette - this is a safety tool
// for a frightened reporter, not a marketing surface.
export const COLORS = {
  // brand
  PRIMARY: "#1f4e79", // deep maritime blue
  PRIMARY_DARK: "#163a5a",
  PRIMARY_CONTRAST: "#ffffff",
  // surfaces
  BG: "#f5f7fa",
  SURFACE: "#ffffff",
  SURFACE_ALT: "#eef2f7",
  BORDER: "#d7dee8",
  // text
  TEXT: "#1a2733",
  TEXT_MUTED: "#5b6b7b",
  TEXT_FAINT: "#8a99a8",
  // semantic
  INFO: "#2563eb",
  PROGRESS: "#7c3aed",
  SUCCESS: "#15803d",
  WARNING: "#b45309",
  DANGER: "#b91c1c",
  CRITICAL: "#7f1d1d",
  NEUTRAL: "#6b7280",
};

// Spacing scale (px).
export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 24,
  XXL: 32,
};

// Typography.
export const TYPOGRAPHY = {
  FONT_FAMILY:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  SIZE_XS: 11,
  SIZE_SM: 13,
  SIZE_MD: 15,
  SIZE_LG: 18,
  SIZE_XL: 24,
  SIZE_XXL: 30,
  WEIGHT_REGULAR: 400,
  WEIGHT_MEDIUM: 600,
  WEIGHT_BOLD: 700,
  RADIUS: 8,
};

// Tone → { bg, fg, border } pill colours. Keyed by the TONE tokens that
// STATUS_META carries, so both apps render status pills identically.
export const TONES = {
  [TONE.NEUTRAL]: { bg: "#eef0f3", fg: "#374151", border: "#d1d5db" },
  [TONE.INFO]: { bg: "#e6effd", fg: "#1d4ed8", border: "#bfd6fb" },
  [TONE.PROGRESS]: { bg: "#f1e9fd", fg: "#6d28d9", border: "#ddc9fb" },
  [TONE.SUCCESS]: { bg: "#e6f4ea", fg: "#15803d", border: "#c2e3cd" },
  [TONE.WARNING]: { bg: "#fdf2e3", fg: "#b45309", border: "#f6dcae" },
  [TONE.DANGER]: { bg: "#fdeaea", fg: "#b91c1c", border: "#f5c4c4" },
};

// Convenience: resolved pill colours per report status (via STATUS_META.tone).
export const STATUS_TONES = Object.values(STATUS).reduce((acc, status) => {
  const tone = STATUS_META[status]?.tone || TONE.NEUTRAL;
  acc[status] = TONES[tone] || TONES[TONE.NEUTRAL];
  return acc;
}, {});

// Severity → tone colour. CRITICAL gets its own deep tone token.
export const SEVERITY_TONES = {
  [SEVERITY.LOW]: { bg: "#eef0f3", fg: "#374151", border: "#d1d5db" },
  [SEVERITY.MEDIUM]: { bg: "#e6effd", fg: "#1d4ed8", border: "#bfd6fb" },
  [SEVERITY.HIGH]: { bg: "#fdf2e3", fg: "#b45309", border: "#f6dcae" },
  [SEVERITY.CRITICAL]: { bg: "#fbe4e4", fg: "#7f1d1d", border: "#f0b6b6" },
};

// Single accessor used by renderers: tone colours for a TONE token.
export const toneColors = (tone) => TONES[tone] || TONES[TONE.NEUTRAL];

// Single accessor: tone colours for a severity value.
export const severityColors = (severity) =>
  SEVERITY_TONES[severity] || SEVERITY_TONES[SEVERITY.LOW];
