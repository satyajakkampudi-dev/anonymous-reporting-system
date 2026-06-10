// adminReportDoc.onSave — stamp the stored priority sort key on every admin persist
// (MP-FIX-QUEUE-SERVER-PAGINATION).
//
// Context A (framework event on the SHARED reportDoc, re-exported as adminReportDoc).
// adminReportDoc has its own onSubmit slot owned by manual-log.js; onSave is a SEPARATE
// slot and was previously unused admin-side (rule 30 — the admin app runs no reporter
// validation gate). This handler does NOT validate and never touches the error stack;
// it ONLY derives priorityRank from the live severity/urgency/status so that an admin
// transition (escalate → ESCALATED, override-severity → CRITICAL, resolve/close, etc.)
// re-floats or sinks the report in the queue's server-side sort { priorityRank: 1,
// createdOn: -1 }. The framework has no aggregation, so the computed isPriority float
// MUST be a stored, sortable column.
//
// Universal chokepoint: every admin report save (saveDocWithSubCollections → save(), and
// manual-log's self.save()) calls adminReportDoc.save(), so onSave fires for all of them
// — the rank can never drift from the SHARED isPriority predicate (lib/dashboard-stats).
// Mirror of the user app's reportDoc.onSave priorityRank stamp (report-validation.js).

import { adminReportDoc } from "../docs/admin-report-doc";
import { D } from "@frontmltd/frontmjs/core/State";
import {
  reportIdField,
  severityField,
  urgencyField,
  statusField,
  priorityRankField,
} from "../sections/manual-log";
import { priorityRankFor } from "../../../lib/dashboard-stats";

adminReportDoc.onSave = async (self) => {
  self.f[priorityRankField.id].value = priorityRankFor({
    severity: self.f[severityField.id].value,
    urgency: self.f[urgencyField.id].value,
    status: self.f[statusField.id].value,
  });
  // TRACE (MP-FIX-QUEUE-SERVER-PAGINATION): confirm priorityRank is re-stamped on every
  // ADMIN transition (escalate/override-severity/resolve/etc.) so the report re-floats.
  D.log({
    message: "ADMIN onSave: priorityRank stamped",
    data: {
      reportId: self.f[reportIdField.id].value,
      severity: self.f[severityField.id].value,
      urgency: self.f[urgencyField.id].value,
      status: self.f[statusField.id].value,
      priorityRank: self.f[priorityRankField.id].value,
    },
  });
};
