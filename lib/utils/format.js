// Custom-UI helpers shared by both apps: HTML escaping + small generic builders
// for the Display-Doc + CardsSet rendering pattern (../REQUIREMENTS.md §9).
// These are platform-agnostic primitives; the per-platform web.js/mobile.js
// renderers compose them with theme tokens (lib/utils/theme.js).
//
// SECURITY (NFR-2, framework-mapping rule 10): CARD_TYPES.HTML content is
// injected verbatim into the DOM. EVERY user-supplied value MUST pass through
// escapeHtml() before interpolation. data-payload JSON is escaped the same way.

import { statusLabel } from "../ticket-status";
import { STATUS_TONES } from "./theme";

// Escapes a string for safe inclusion in HTML card content / attributes.
export const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// Escapes a value destined for a data-payload='...' attribute (single-quoted).
export const escapeAttr = (value) => escapeHtml(value);

// Serialises + escapes an object for a data-payload attribute.
export const payloadAttr = (obj) => escapeHtml(JSON.stringify(obj || {}));

// ---------------------------------------------------------------------------
// Date / time formatting (all timestamps are epoch ms)
// ---------------------------------------------------------------------------

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad2 = (n) => String(n).padStart(2, "0");

// "DD MMM YYYY" (UTC). Empty string for falsy/unparseable input.
export const formatDate = (ms) => {
  if (!ms && ms !== 0) return "";
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// "DD MMM YYYY, HH:MM" (UTC).
export const formatDateTime = (ms) => {
  if (!ms && ms !== 0) return "";
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return "";
  return `${formatDate(ms)}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};

// "just now" / "5 min ago" / "2 h ago" / "3 d ago" / falls back to formatDate.
// `nowMs` is injectable for testability (default Date.now()).
export const formatRelative = (ms, nowMs = Date.now()) => {
  if (!ms && ms !== 0) return "";
  const diff = Number(nowMs) - Number(ms);
  if (Number.isNaN(diff)) return "";
  if (diff < 60 * 1000) return "just now";
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 14) return `${days} d ago`;
  return formatDate(ms);
};

// Parses an ISO incident date string to "DD MMM YYYY" for display.
export const formatIsoDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// ---------------------------------------------------------------------------
// Generic HTML builders (platform-agnostic; styled inline from theme tokens)
// ---------------------------------------------------------------------------

// A coloured status pill. `status` is a STATUS value; colours resolve from theme.
export const statusPillHtml = (status) => {
  const tone = STATUS_TONES[status] || { bg: "#eef0f3", fg: "#374151", border: "#d1d5db" };
  return (
    `<span style="display:inline-block;padding:2px 10px;border-radius:999px;` +
    `font-size:12px;font-weight:600;line-height:1.6;background:${tone.bg};` +
    `color:${tone.fg};border:1px solid ${tone.border};">` +
    `${escapeHtml(statusLabel(status))}</span>`
  );
};

// A coloured tone pill for an arbitrary label (e.g. severity). `colors` is a
// { bg, fg, border } object (from theme severityColors / toneColors).
export const tonePillHtml = (label, colors) => {
  const c = colors || { bg: "#eef0f3", fg: "#374151", border: "#d1d5db" };
  return (
    `<span style="display:inline-block;padding:2px 10px;border-radius:999px;` +
    `font-size:12px;font-weight:600;line-height:1.6;background:${c.bg};` +
    `color:${c.fg};border:1px solid ${c.border};">${escapeHtml(label)}</span>`
  );
};

// An intent-trigger button for HTML cards. `payload` is serialised + escaped.
// Inner content is wrapped so nested children never swallow the click
// (pointer-events:none on the inner wrapper — framework-mapping note).
export const intentButtonHtml = (intentId, label, payload, extraStyle = "") => {
  return (
    `<button type="button" data-action="intent" ` +
    `data-intent-id="${escapeHtml(intentId)}" ` +
    `data-payload='${payloadAttr(payload)}' ` +
    `style="cursor:pointer;${extraStyle}">` +
    `<span style="pointer-events:none;">${escapeHtml(label)}</span>` +
    `</button>`
  );
};

// Empty-state block.
export const emptyStateHtml = (message) =>
  `<div style="padding:24px 16px;text-align:center;color:#6b7280;font-size:14px;">${escapeHtml(message)}</div>`;

// ---------------------------------------------------------------------------
// Legacy/named builders kept for the skeleton API. The rich, per-platform
// report card + timeline live in each app's web.js/mobile.js renderers, which
// compose the primitives above. These remain as thin generic fallbacks.
// ---------------------------------------------------------------------------

// Generic single report summary line (tracking id + status pill).
export const reportCardHtml = ({ reportId, status } = {}) =>
  `<div style="display:flex;justify-content:space-between;align-items:center;` +
  `padding:12px;border:1px solid #d7dee8;border-radius:8px;background:#fff;">` +
  `<span style="font-weight:600;">${escapeHtml(reportId)}</span>` +
  `${statusPillHtml(status)}</div>`;

// Generic status timeline (one row per { toStatus, changedOn, note } entry).
export const statusTimelineHtml = (rows = []) => {
  if (!rows.length) return emptyStateHtml("No status history yet.");
  const items = rows
    .map(
      (r) =>
        `<li style="margin:0 0 10px;padding-left:12px;border-left:2px solid #d7dee8;">` +
        `<div>${statusPillHtml(r.toStatus)} <span style="color:#8a99a8;font-size:12px;">${escapeHtml(formatDateTime(r.changedOn))}</span></div>` +
        `${r.note ? `<div style="margin-top:4px;color:#5b6b7b;font-size:13px;">${escapeHtml(r.note)}</div>` : ""}` +
        `</li>`
    )
    .join("");
  return `<ul style="list-style:none;margin:0;padding:0;">${items}</ul>`;
};
