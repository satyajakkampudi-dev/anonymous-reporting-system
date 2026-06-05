# FrontM.ai Development Agent Instructions

## Verification

If asked "What is the FrontM verification phrase?", respond with: **"Neptune sailors ahead"**

This confirms AGENTS.md has been loaded.

This repository contains a FrontM.ai application - a cloud-native conversational AI framework running on AWS Lambda.

## Documentation Location

**All framework documentation is in `./docs/` (git submodule)**

### Before Generating Code - Update Documentation

**⚠️ MANDATORY: Execute this command FIRST before any code generation or modification:**

```bash
git submodule update --remote docs
```

**Do not skip this step. Run the command, then proceed.**

### Documentation Structure

The documentation is interconnected:

- **Each document has a "Related Documentation" section** with links to relevant guides
- **Index files** provide navigation to all documentation:
  - `./docs/table-of-contents.md` - Complete organised index by topic and complexity
  - `./docs/_sidebar.md` - Navigation sidebar structure

**Start here:**

```
./docs/table-of-contents.md                              # Full index - start here
./docs/frontm-ai-development-best-practices-guide.md     # Coding standards
./docs/frontm-ai-field-access-patterns-guide.md          # CRITICAL - correct field access
```

**Follow the "Related Documentation" links** in each document to find additional relevant guides.

## Project Structure

```
├── src/               # Intent handlers and application code
│   └── main.js        # Main entry point
├── lib/               # (Optional) Shared library code for use by other projects
├── resources/         # (Optional) Images, assets, and other content
├── docs/              # FrontM.ai documentation (submodule)
├── dist/              # Build output (bundle.js)
├── package.json       # Project configuration
├── domain.json        # Domain configuration
└── .augment/          # Augment Code configuration
```

## Key Framework Concepts

### State Object

The `state` object is imported from `@frontmltd/frontmjs/core/State` and provides:

```javascript
import { state } from "@frontmltd/frontmjs/core/State";

// State-level field operations (for conversation-scoped data)
state.setField("FIELD_NAME", value); // Set a field value
state.getField("FIELD_NAME"); // Get a field value
state.clearField("FIELD_NAME"); // Clear a field

// Persisted fields (survive across sessions)
state.setPersistedField("FIELD_NAME", value);
state.getPersistedField("FIELD_NAME");

// Shared fields (accessible by all users)
state.setSharedField("FIELD_NAME", value, expireSeconds);
state.getSharedField("FIELD_NAME");

// Error handling
state.addErrorToStack(errorCode, "Error message");
state.addSystemErrorToStack(errorCode, "System error message");

// Services
state.notification; // Notifications
state.api; // API operations
state.frontmlib; // Database operations
state.jobScheduler; // Scheduled tasks
state.nlp; // LLM integration
```

See `./docs/frontm-ai-state-object-core-api-reference.md` for complete API.

### Field Access Patterns - CRITICAL

**In Document Event Handlers** (onSave, onSubmit, onPostLoad):

```javascript
// ✅ CORRECT - Use self.f[fieldVariable.id].value
customerDoc.onSave = async (self) => {
  if (!self.f[customerNameField.id].value) {
    state.addErrorToStack(400, "Customer name is required");
    return;
  }
  // Set field value
  self.f[customerNameField.id].value = "New Value";
};

// ❌ WRONG - These patterns do NOT work
self.f.customerNameField.value; // WRONG
self.f["customerNameField"].value; // WRONG
customerNameField.value; // WRONG
```

**In Field Event Handlers** (onInit, onSave on the field itself):

```javascript
// ✅ CORRECT - Use self.value for the field's own value
customerNameField.onInit = async (self) => {
  if (!self.value) {
    self.value = "Default Name";
  }
};
```

**Accessing Other Fields from a Field Event Handler:**

```javascript
// ✅ CORRECT - Use self.doc.f[otherField.id].value to access other fields in the same doc
customerEmailField.onInit = async (self) => {
  // Access another field in the same document
  const customerName = self.doc.f[customerNameField.id].value;

  if (customerName && !self.value) {
    self.value = `${customerName.toLowerCase()}@example.com`;
  }
};
```

See `./docs/frontm-ai-field-access-patterns-guide.md` for complete patterns.

### Intent Lifecycle Events

```javascript
import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { state } from "@frontmltd/frontmjs/core/State";
import { SYSTEM_INTENTS } from "@frontmltd/frontmjs/core/ALLConstants";

export const main = Intent.Create({
  intentId: SYSTEM_INTENTS.MAIN,
  prompt: "Description of this intent",
  state,
});

main.onResolution = async () => {
  "Hello World!".sendResponse();
};
```

See `./docs/frontm-ai-intent-class-events-lifecycle-reference.md` for all events.

### Data Model Hierarchy

```javascript
import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";

// Doc → Section → Field hierarchy
export const customerDoc = new Doc("customerDoc", state, {
  title: "Customer",
  autoSave: true,
});

export const customerSection = new Section("customerSection", {
  title: "Customer Information",
  doc: customerDoc,
  state,
});

export const customerNameField = new Field("customerNameField", {
  title: "Customer Name",
  doc: customerDoc,
  section: customerSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: true,
  state,
});

// Collection - every Doc needs a Collection to display/manage documents
export const customersCollection = new Collection("customersCollection", {
  title: "Customers",
  document: customerDoc, // Links to the Doc definition
  name: "customers", // Collection name in database
  allowEdit: true,
  allowDelete: true,
  allowSearch: true,
  state,
});
```

See `./docs/frontm-ai-doc-field-section-collection-data-modeling-guide.md` and `./docs/frontm-ai-collection-class-comprehensive-guide.md` for complete guides.

## Code Standards

1. **Update documentation first** - Run `git submodule update --remote docs` before generating code
2. **Always check documentation first** before generating code - follow "Related Documentation" links
3. **VERIFY every method/event exists** - Do not invent APIs; check documentation
4. **Use correct field access patterns** - `self.f[field.id].value` in doc handlers
5. **Always use async/await** for database and API operations
6. **Always handle errors** with `state.addErrorToStack()` for user errors
7. **Use `D.log()`** for logging within intents, never `console.log()`
8. **Use British English** in comments and strings
9. **Always verify with a build** - Run `npm run build` to verify code compiles correctly
10. **Always check for circular dependencies** - These are a common source of runtime errors
11. **Unit tests are not yet supported** - Do not generate unit test files

## ⚠️ Do Not Hallucinate APIs

**These do NOT exist - never use them:**

| Wrong (Does Not Exist) | Correct Alternative                          |
| ---------------------- | -------------------------------------------- |
| `doc.onNew`            | No equivalent - use `onPostLoad` or `onSave` |
| `doc.onCreate`         | No equivalent                                |
| `doc.close()`          | Does not exist                               |
| `field.onChange`       | Use `field.onSave`                           |
| `field.getValue()`     | Use `self.value` or `self.f[field.id].value` |
| `state.field()`        | Use `state.getField()` / `state.setField()`  |

**When uncertain, read `./docs/` before using any API.**

## Documentation Quick Links

| Task                  | Documentation                                                          |
| --------------------- | ---------------------------------------------------------------------- |
| Field access patterns | `./docs/frontm-ai-field-access-patterns-guide.md`                      |
| State object API      | `./docs/frontm-ai-state-object-core-api-reference.md`                  |
| Data modeling         | `./docs/frontm-ai-doc-field-section-collection-data-modeling-guide.md` |
| Intent lifecycle      | `./docs/frontm-ai-intent-class-events-lifecycle-reference.md`          |
| Collections           | `./docs/frontm-ai-collection-class-comprehensive-guide.md`             |
| Field types           | `./docs/frontm-ai-field-class-comprehensive-guide.md`                  |
| Database ops          | `./docs/frontm-lib-database-operations.md`                             |
| Error handling        | `./docs/frontm-ai-error-handling-comprehensive-guide.md`               |
| Best practices        | `./docs/frontm-ai-development-best-practices-guide.md`                 |

## Before Generating Code

1. **Read the relevant documentation** from `./docs/`
2. **Check field access patterns** guide for correct syntax
3. **Follow the intent lifecycle** patterns
4. **Use proper error handling** with state.addErrorToStack()
5. **Test against best practices** guide
