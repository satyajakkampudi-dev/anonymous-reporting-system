# Frame Graph - anonymous-user

> LoG.ai Layer 2. Frames (= Intents) and transitions for the Reporter micro-app. Standard CRUD
> frames in the main flow; custom frames annotated; cross-app sends/receives shown as `MSG_*`.
> Source: [`../2.brd.md`](../2.brd.md) §4 + §7. British English; frontm.ai lowercase.

```mermaid
stateDiagram-v2
    [*] --> U_F0

    state "U-F0 · Home / landing (entry)\n[Standard] Context bootstrap + anonymity intro + actions" as U_F0
    state "U-F3 · Submission form\n[Standard] Form Doc" as U_F3
    state "U-F9 · Draft autosave\n[Custom] autoSave buffer (D14)" as U_F9
    state "U-F5 · Pre-submit anonymity guard\n[Custom] warning + 'what admin sees' (ER-A1)" as U_F5
    state "U-F7 · Contact-method validation\n[Custom] per-method (FR-U1)" as U_F7
    state "U-F6 · Evidence validation\n[Custom] <=5 files/25MB, type+size (D1/ER-C10)" as U_F6
    state "U-F4 · Submit (onSubmit)\n[Standard] save OPEN" as U_F4
    state "U-F8 · Submit transforms\n[Custom] id, route, sanitise, idempotency (D17/ER-B9)" as U_F8
    state "U-F1 · My Reports list\n[Standard] scoped reporterId===userId" as U_F1
    state "U-F2 · Report detail + timeline\n[Standard] ownership assert" as U_F2
    state "U-F13 · Amend (append-only)\n[Custom] audited note + evidence (D16)" as U_F13
    state "U-F12 · Withdraw\n[Custom] -> WITHDRAWN (D16)" as U_F12
    state "U-F10 · Accept\n[Custom] -> CLOSED_BY_USER" as U_F10
    state "U-F11 · Reject (reason)\n[Custom] -> REOPENED, cap 0->1 (D10)" as U_F11
    state "U-F14 · Reporter notifications\n[Custom] email + web push (FR-U8)" as U_F14
    state "U-F15 · Initiate anonymous call\n[Custom] masked voice meeting + RINGING (FR-C1)" as U_F15
    state "U-F16 · No-answer -> voicemail\n[Custom] MISSED -> auto-create report (FR-C5/D7)" as U_F16
    state "U-F17 · Call abandoned / drop\n[Custom] ABANDONED / timeout (ER-C12)" as U_F17

    %% --- submission flow ---
    U_F0 --> U_F3: tap Submit
    U_F3 --> U_F9: edits (autosave)
    U_F9 --> U_F3
    U_F3 --> U_F5: review before submit
    U_F3 --> U_F7: choose contact method
    U_F3 --> U_F6: attach evidence
    U_F5 --> U_F4: confirm submit
    U_F4 --> U_F8: transform + persist
    U_F8 --> U_F1: tracking ID shown

    %% cross-app: new report
    U_F8 --> A_send1: MSG_NEW_REPORT
    state "==> anonymous-admin (A-X1)" as A_send1

    %% --- tracking flow ---
    U_F0 --> U_F1: tap My Reports
    U_F1 --> U_F2: open a report
    U_F2 --> U_F13: amend (non-terminal)
    U_F2 --> U_F12: withdraw (OPEN/UNDER_REVIEW)
    U_F2 --> U_F10: accept (RESOLVED)
    U_F2 --> U_F11: reject (RESOLVED)
    U_F11 --> A_send2: MSG_REPORT_REOPENED
    state "==> anonymous-admin (A-X2)" as A_send2

    %% --- inbound events ---
    state "<== MSG_REPORT_RESOLVED / STATUS_CHANGED / CLOSED" as A_recv
    A_recv --> U_F14: onMatching
    U_F14 --> U_F2: refreshed status

    %% --- calling flow ---
    U_F0 --> U_F15: tap Call compliance
    U_F15 --> A_send3: MSG_INCOMING_CALL (+VoIP)
    state "==> anonymous-admin (A-X3)" as A_send3
    U_F15 --> U_F16: 30s no answer (D7)
    U_F15 --> U_F17: hang-up before answer
    U_F16 --> A_send1: voicemail -> MSG_NEW_REPORT

    U_F10 --> [*]
    U_F12 --> [*]
```

## Notes
- **Standard frames** (U-F0/F1/F2/F3/F4) are the inferred CRUD scaffolding; everything else carries
  PM-confirmed rules (BRD §7).
- **Ownership** is asserted in U-F1 (`query { reporterId: userId }`) and again in U-F2 before any
  render/mutate - lookup-by-ID never bypasses it.
- **Context bootstrap** in U-F0 is mandatory because U-F9 (draft autosave) relies on `autoSave: true`
  (CLAUDE.md). Without it, buffered field values never reach Redis.
- **Manual / CALL-source reports** (no `reporterId`) never enter the U-F10/F11/F12 reporter-transition
  paths and receive no reporter notifications.
