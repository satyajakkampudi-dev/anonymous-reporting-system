// Report status enum + display metadata + allowed-transition map.
// Single source of truth for the state machine in ../REQUIREMENTS.md §6 and
// ../specs/SPEC.md. Both apps gate every status change against this map; status
// is never written free-form.
// NOTE: skeleton placeholders — filled in during the foundation (B1) build.

// All report statuses.
export const STATUS = {};

// Per-status metadata: { label, tone, allowedActionsByRole, terminal }.
export const STATUS_META = {};

// Allowed transitions: { [fromStatus]: [{ to, actor, action }] }.
export const STATUS_TRANSITIONS = {};

// Returns true if `to` is a permitted next status for `from` by `actor`.
export const canTransition = () => false;
