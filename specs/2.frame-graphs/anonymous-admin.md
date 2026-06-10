# Frame Graph - anonymous-admin

> LoG.ai Layer 2. Frames (= Intents) and transitions for the Admin micro-app (Primary + Secondary,
> role-gated in one app). Standard CRUD frames in the main flow; custom + system frames annotated;
> cross-app sends/receives shown as `MSG_*`. Every read flows through the `adminProjection`
> chokepoint (identity-stripped). Source: [`../2.brd.md`](../2.brd.md) §5 + §7.

```mermaid
stateDiagram-v2
    [*] --> A_F0

    state "A-F0 · App start (entry)\n[Standard] -> Dashboard" as A_F0
    state "A-F1 · Access gate\n[Custom] licence/role + admin-users (FR-A1)" as A_F1
    state "A-F2 · Dashboard aggregation\n[Custom] HTML stat cards, small-cell suppress (D4/ER-A6)" as A_F2
    state "A-F3 · Queue load/refresh\n[Standard] loadReportsForAdmin (adminProjection, ER-A3)" as A_F3
    state "A-F4 · Role-filter + recusal\n[Custom] Primary/Secondary; hide own-accused (D9/ER-A4)" as A_F4
    state "A-F5 · Priority surfacing & filter\n[Custom] CRITICAL/Immediate/ESCALATED highlight + quick-filter" as A_F5
    state "A-F6 · Report detail / manage\n[Standard] loadReportForAdmin" as A_F6
    state "A-F7 · Evidence signed URLs\n[Custom] before sendResponse (FR-A4)" as A_F7
    state "A-F12 · Severity override\n[Custom] (D6)" as A_F12
    state "A-F8 · Take review\n[Custom] -> UNDER_REVIEW, OCC (ER-B5)" as A_F8
    state "A-F9 · Resolve\n[Custom] -> RESOLVED + schedule auto-close (FR-A5/A8)" as A_F9
    state "A-F10 · Escalate\n[Custom] -> ESCALATED, assignedTo=SECONDARY" as A_F10
    state "A-F11 · Close-rejected\n[Custom] REOPENED -> CLOSED_REJECTED (ER-B6)" as A_F11
    state "A-F13 · Manual log\n[Custom] source=MANUAL, reporterId empty (FR-A6)" as A_F13
    state "A-F14 · Case export\n[Custom] CSV/PDF, projection only (D15)" as A_F14
    state "A-F15 · Admin notifications\n[Custom] new/reopened/escalated (FR-A10)" as A_F15
    state "A-F16 · Auto-escalate job\n[System] idempotent (D2/ER-B8)" as A_F16
    state "A-F17 · Auto-close job\n[System] +30d, idempotent (D2/ER-B8)" as A_F17
    state "A-F18 · SLA backstop digest\n[System] OPEN/ESCALATED 24h -> email all (D11)" as A_F18
    state "A-F19 · Alerts / digest screen\n[Custom] in-app fallback (ER-D15)" as A_F19
    state "A-F20 · Availability toggle\n[Custom] available/busy/unavailable (FR-C2)" as A_F20
    state "A-F21 · Answer / atomic claim\n[Custom] -> ACTIVE, ring-stop others (D12)" as A_F21
    state "A-F22 · Call hang-up / drop\n[Custom] -> ENDED, no recording (ER-A5/C12)" as A_F22

    %% --- entry + browse ---
    A_F0 --> A_F1: gate
    A_F1 --> A_F2: pass -> dashboard
    A_F1 --> [*]: refused (non-admin)
    A_F2 --> A_F3: open queue
    A_F3 --> A_F4: apply role/recusal
    A_F4 --> A_F5: apply priority surfacing
    A_F5 --> A_F6: open a report
    A_F6 --> A_F7: render evidence

    %% --- triage transitions ---
    A_F6 --> A_F12: adjust severity
    A_F6 --> A_F8: take review
    A_F8 --> A_F9: resolve
    A_F8 --> A_F10: escalate
    A_F6 --> A_F11: close-rejected (REOPENED)
    A_F9 --> A_F17: schedule auto-close
    A_F6 --> A_F14: export

    %% cross-app sends to user
    A_F9 --> U_resolved: MSG_REPORT_RESOLVED
    A_F8 --> U_status: MSG_REPORT_STATUS_CHANGED
    A_F10 --> U_status
    A_F17 --> U_closed: MSG_REPORT_CLOSED
    state "==> anonymous-user (U-X4)" as U_resolved
    state "==> anonymous-user (U-X5)" as U_status
    state "==> anonymous-user (U-X6)" as U_closed

    %% --- inbound from user ---
    state "<== MSG_NEW_REPORT (A-X1)" as recv_new
    state "<== MSG_REPORT_REOPENED (A-X2)" as recv_reopen
    recv_new --> A_F15: notify assigned
    recv_new --> A_F16: schedule auto-escalate
    recv_reopen --> A_F15
    A_F16 --> A_F10: still unactioned -> escalate

    %% --- SLA + alerts ---
    A_F18 --> A_F19: breaching items surfaced
    A_F2 --> A_F19: open Alerts

    %% --- manual log ---
    A_F2 --> A_F13: log manual report

    %% --- calling ---
    A_F2 --> A_F20: set availability
    state "<== MSG_INCOMING_CALL (A-X3)" as recv_call
    recv_call --> A_F21: ring available admins
    A_F21 --> A_ringstop: MSG_CALL_STOP_RING (A-X7)
    state "==> other admins (A-X7)" as A_ringstop
    A_F21 --> A_F22: hang-up / drop
```

## Notes
- **Single read chokepoint.** A-F2 (dashboard), A-F3 (queue), A-F6 (detail), the jobs, and export
  ALL read via `loadReportsForAdmin()` / `loadReportForAdmin()` - `adminProjection` is always
  applied (ER-A3). No admin frame queries `reports` directly; no admin surface binds `reporterId`.
- **Role + recusal + priority are layered filters** over the same projected queue (A-F4 → A-F5), not
  separate data loads. Priority surfacing (A-F5, added at PM request) highlights CRITICAL severity /
  Immediate-risk urgency / ESCALATED status and offers a quick-filter; severity reflects the A-F12
  override.
- **System frames** (A-F16/F17/F18) run in **Context B** via `state.jobScheduler` - they load the
  report by `reportId` before reading, and are guarded by current `status` + a job-id/`version`
  conditional so duplicate/stale fires are safe no-ops (ER-B8).
- **Optimistic concurrency** (ER-B5) wraps every transition (A-F8/F9/F10/F11): re-read + validate
  against current `status`+`version`; stale writes rejected and surfaced.
- **Calling is unrecorded and identity-free** (ER-A5); answer is an atomic claim (D12).
