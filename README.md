# FrontM.ai Application Template

A template repository for building cloud-native conversational AI applications using the [FrontM.ai](https://frontm.ai) framework. This template ships with a pre-wired [Claude Code](https://claude.ai/code) configuration so framework rules, skills, and examples are loaded automatically.

## 🚀 What is FrontM.ai?

FrontM.ai is a cloud-native conversational AI framework. It enables developers to build sophisticated AI-powered applications with:

- **Intent-based architecture** for natural conversation flows
- **Built-in LLM integration** (OpenAI, Claude, custom models)
- **Rich data modeling** with Docs, Fields, Sections, and Collections
- **Real-time state management** and context awareness
- **AWS Lambda deployment** for serverless scalability
- **Multi-platform support** (Web, Mobile, Voice)

## 📋 Prerequisites

Before using this template, ensure you have:

- **Node.js 20+** installed
- **npm** or **yarn** package manager
- **Git** for version control
- **FrontM developer account** (for deployment)
- **[Claude Code](https://claude.ai/code)** installed (required to use the bundled `.claude` configuration)
- Basic knowledge of JavaScript/ES6+

## 🎯 Creating a New Application from This Template

### Option 1: Using GitHub Template (Recommended)

1. **Click "Use this template"** at the top of this repository
2. **Choose a repository name** for your new application
3. **Select visibility** (Public or Private)
4. **Click "Create repository from template"**
5. **Clone your new repository with submodules:**
   ```bash
   git clone --recurse-submodules https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   cd YOUR-REPO-NAME
   ```
   If you forgot `--recurse-submodules`, run:
   ```bash
   git submodule update --init --recursive
   ```

### Option 2: Manual Clone

```bash
# Clone this template with submodules
git clone --recurse-submodules https://github.com/YOUR-ORG/frontm_ai_template_repo.git my-new-app
cd my-new-app

# Remove the original git history
rm -rf .git

# Initialize a new repository
git init
git add .
git commit -m "Initial commit from FrontM.ai template"

# Re-add the submodules (lost when .git was removed)
git submodule add https://github.com/frontmltd/frontm.js-docs.git docs
git submodule add https://github.com/frontmltd/frontm-ai-claude-config .claude
git add .gitmodules docs .claude
git commit -m "Add docs and Claude Code submodules"

# Add your remote repository
git remote add origin https://github.com/YOUR-USERNAME/YOUR-NEW-REPO.git
git push -u origin main
```

## 🛠️ Installation

After cloning your new repository:

```bash
# Install dependencies
npm install

# Initialise and update all git submodules (docs + .claude)
git submodule update --init --recursive

# Pull latest versions of documentation and Claude Code config
git submodule update --remote
```

### Keeping Submodules Updated

The template uses git submodules for both documentation and Claude Code configuration. Keep them updated regularly:

```bash
# Update all submodules at once
git submodule update --remote

# Or update individually
git submodule update --remote docs      # FrontM.ai documentation
git submodule update --remote .claude   # Claude Code skills, rules, examples

# After updating, commit the changes
git add docs .claude
git commit -m "Update docs and Claude Code configuration"
```

**💡 Best Practice:** Run `git submodule update --remote` before starting new development work so Claude Code loads the latest rules and the docs reflect the latest framework APIs.

## 🤖 Starting a New App with Claude Code

Once dependencies and submodules are in place, you are ready to build with Claude Code.

### 1. Open the repo in Claude Code

```bash
cd YOUR-REPO-NAME
claude
```

Claude Code automatically loads:

- `.claude/CLAUDE.md` — framework rules (auto-loaded on every prompt)
- `.claude/skills/` — `/frontm-*` slash commands for common tasks
- `.claude/settings.json` — pre-approved safe commands (build, submodule update, read/grep)
- `AGENTS.md` — agent instructions for FrontM.ai development

### 2. Verify the configuration is loaded

In Claude Code, ask:

> What is the FrontM verification phrase?

Expected response: **"Neptune sailors ahead"**

If you get a different answer, the `.claude` submodule is missing — re-run `git submodule update --init --recursive`.

### 3. Specify the app with LoG.ai (start here)

**Do not jump straight into code.** The `.claude` config bundles **LoG.ai**, a four-layer specification methodology that turns a business problem into engineering-ready specs *before* any code is generated. Skipping this step is the single biggest source of rework — fields get invented, cross-app contracts are forgotten, and tasks lose their dependencies.

The pipeline writes structured artefacts into `specs/` that every later step (and every `/frontm-*` code generator) reads from:

| Layer | Slash command       | Output                                                                                  | When to use                                                |
| ----- | ------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1     | `/log-ai-story`     | `specs/1.story-card.md` — actors, triggers, handoffs, app boundaries                    | Start of any new feature or app                            |
| 2     | `/log-ai-process`   | `specs/2.brd.md`, `specs/2.frame-graphs/` — frames per app, cross-app contracts         | After Layer 1 is approved by the PM                        |
| 3     | `/log-ai-detail`    | `specs/3.field-spec.md`, wireframes, `specs/3.input-schema.yaml` — section/field detail | After Layer 2 is approved                                  |
| —     | `/log-ai-tasks`     | `specs/4.task-dependency-graph.md` — append-only engineering tasks with dependencies    | Once Layer 3 is approved — produces the build backlog      |
| —     | `/log-ai-reverse`   | Same artefacts, recovered from an existing codebase                                     | When onboarding an existing app that has no specs          |

Each layer **gates** the next: `/log-ai-process` refuses to run without `specs/1.story-card.md`, and so on. The flow is deliberately PM-led — the AI suggests where rules are needed; the PM decides what they are.

> 📁 The `specs/` directory and `specs/4.task-dependency-graph.md` are the source of truth for the build. `specs/4` is **append-only** — never edit an existing task; new fixes go through `/frontm-fix-task`.

### 4. Implement the specs with the FrontM skills

Once `specs/4.task-dependency-graph.md` exists, work the tasks top-down. Use the bundled framework slash commands to bootstrap real code from the specs:

| Command                  | Purpose                                                              | Example                                                                       |
| ------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/frontm-new-intent`     | Create a new intent with the correct lifecycle                       | `/frontm-new-intent reportSubmission "handles medical report submissions"`    |
| `/frontm-add-collection` | Add a Collection with filters, pagination, search                    | `/frontm-add-collection vessels`                                              |
| `/frontm-docs`           | Look up framework documentation by topic                             | `/frontm-docs lookup fields cascading filters`                                |
| `/frontm-debug`          | Debug a runtime issue using framework patterns                       | `/frontm-debug collection is empty even though MongoDB has documents`         |
| `/frontm-review`         | Review code for framework best practices                             | `/frontm-review src/frames/caseHandler.js`                                    |
| `/frontm-api-verify`     | Verify every API call against `./docs/` before codegen               | `/frontm-api-verify`                                                          |
| `/frontm-fix-task`       | Append a fix task to `specs/4.task-dependency-graph.md` (never edit) | `/frontm-fix-task`                                                            |

### 5. Build and iterate

```bash
npm run build:dev    # fast incremental build
npm run watch        # rebuild on save
```

The `.claude` config pre-approves these commands, so Claude Code can run them without a permission prompt.

### Personal Claude Code settings

Drop personal overrides in `.claude/settings.local.json` (git-ignored):

```json
{
  "permissions": {
    "allow": ["Bash(npm run deploy:*)"]
  }
}
```

## 📁 Project Structure

```
your-app/
├── src/                      # Source files
│   ├── main.js              # Main intent entry point (✅ Hello World example)
│   ├── intents/             # Additional intent handlers
│   ├── components/          # Reusable components
│   └── constants.js         # Application constants
│
├── specs/                    # LoG.ai specification artefacts (generated by /log-ai-*)
│   ├── 1.story-card.md      # Layer 1 — actors, triggers, handoffs, app boundaries
│   ├── 2.brd.md             # Layer 2 — frames per app, cross-app contracts
│   ├── 2.frame-graphs/      # Layer 2 — Mermaid frame graph per micro-app
│   ├── 3.field-spec.md      # Layer 3 — sections, fields, types, lookups
│   ├── 3.input-schema.yaml  # Layer 3 — YAML input for the code-gen pipeline
│   └── 4.task-dependency-graph.md  # Engineering tasks (append-only; updated via /frontm-fix-task)
│
├── docs/                     # FrontM.ai documentation (git submodule)
│   ├── table-of-contents.md # Complete documentation index
│   └── *.md                 # Framework guides and references
│
├── .claude/                  # Claude Code configuration (git submodule)
│   ├── CLAUDE.md            # Framework rules (auto-loaded on every prompt)
│   ├── settings.json        # Pre-approved permissions
│   ├── skills/              # /log-ai-* (spec pipeline) + /frontm-* (codegen) slash commands
│   └── examples/            # Working code patterns from real micro-apps
│
├── dist/                     # Build output (generated by webpack)
│   └── main.js              # Compiled bundle
│
├── deployment.config.json   # Deployment configuration
├── package.json             # Project dependencies
├── webpack.config.js        # Build configuration
├── eslint.config.cjs        # Code quality rules
└── AGENTS.md                # AI agent instructions for FrontM.ai development
```

## 🏗️ Building Your Application

```bash
# Development build (faster, includes source maps)
npm run build:dev

# Production build (with linting and formatting)
npm run build:prod

# Quick production build (skip pre-checks)
npm run build:fast

# Watch mode (auto-rebuild on changes)
npm run watch
```

## 🧪 Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without changes
npm run format:check
```

## 📚 Documentation

**All framework documentation is located in the `./docs/` directory (git submodule).**

### ⚠️ IMPORTANT: Always Update Documentation Before Coding

```bash
# Update documentation to latest version
git submodule update --remote docs

# Or update all submodules (docs + .claude)
git submodule update --remote
```

### Quick Start Guides

- **[Table of Contents](./docs/table-of-contents.md)** — Complete organised index
- **[Development Best Practices](./docs/frontm-ai-development-best-practices-guide.md)** — Coding standards and patterns
- **[Framework Architecture](./docs/frontm-ai-framework-architecture-overview.md)** — Core concepts
- **[Intent Lifecycle](./docs/frontm-ai-intent-class-events-lifecycle-reference.md)** — Intent events and handlers
- **[State Object API](./docs/frontm-ai-state-object-core-api-reference.md)** — State management
- **[Field Access Patterns](./docs/frontm-ai-field-access-patterns-guide.md)** — CRITICAL for correct field usage

### Documentation Structure

The documentation is interconnected with "Related Documentation" sections in each guide. Start with the table of contents and follow the links to find relevant information.

### Key Framework Concepts

#### State Object

The `state` object is your central hub for managing application state:

```javascript
import { state } from "@frontmltd/frontmjs/core/State";

// State-level fields (conversation-scoped)
state.setField("FIELD_NAME", value);
state.getField("FIELD_NAME");

// Persisted fields (survive across sessions)
state.setPersistedField("USER_PREFERENCE", value);
state.getPersistedField("USER_PREFERENCE");

// Error handling
state.addErrorToStack(400, "Validation error message");
state.addSystemErrorToStack(500, "System error message");
```

#### Intent Lifecycle

Intents follow a predictable lifecycle:

1. **onMatching** — Determine if this intent should handle the message
2. **onValidation** — Validate prerequisites and permissions
3. **onResolution** — Execute main business logic
4. **onError** — Handle any errors that occur

#### Field Access Patterns (CRITICAL)

**In Document Event Handlers:**

```javascript
customerDoc.onSave = async (self) => {
  // ✅ CORRECT - Use self.f[fieldVariable.id].value
  if (!self.f[customerNameField.id].value) {
    state.addErrorToStack(400, "Customer name is required");
    return;
  }
};
```

**In Field Event Handlers:**

```javascript
customerNameField.onInit = async (self) => {
  // ✅ CORRECT - Use self.value for the field's own value
  if (!self.value) {
    self.value = "Default Name";
  }

  // ✅ CORRECT - Use self.doc.f[otherField.id].value for other fields
  const email = self.doc.f[customerEmailField.id].value;
};
```

### Creating Your First Feature

Here's a complete example of creating a customer management feature:

```javascript
// src/intents/customerIntent.js
import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { D, state } from "@frontmltd/frontmjs/core/State";

// Create document
export const customerDoc = new Doc("customerDoc", state, {
  title: "Customer",
  autoSave: true,
});

// Create section
export const customerSection = new Section("customerSection", {
  title: "Customer Information",
  doc: customerDoc,
  state,
});

// Create fields
export const customerNameField = new Field("customerNameField", {
  title: "Customer Name",
  doc: customerDoc,
  section: customerSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: true,
  state,
});

export const customerEmailField = new Field("customerEmailField", {
  title: "Email",
  doc: customerDoc,
  section: customerSection,
  type: FormFieldTypes.EMAIL_FIELD,
  mandatory: true,
  state,
});

// Create collection
export const customersCollection = new Collection("customersCollection", {
  title: "Customers",
  document: customerDoc,
  name: "customers",
  allowEdit: true,
  allowDelete: true,
  allowSearch: true,
  state,
});

// Create intent
export const manageCustomersIntent = Intent.Create({
  intentId: "manageCustomers",
  prompt: "Manage customer records",
  state,
});

manageCustomersIntent.onResolution = async () => {
  customersCollection.sendResponse();
};
```

> 💡 Instead of typing this by hand, run `/frontm-new-intent manageCustomers "manage customer records"` and `/frontm-add-collection customers` — Claude Code generates the same code with the correct patterns.

## ⚙️ Configuration

### deployment.config.json

Configure your application deployment settings:

```json
{
  "userDomain": "your-domain",
  "frameworkVersion": "v5",
  "conversational": true,
  "authorisedAccess": true,
  "botName": "Your App Name",
  "description": "Your app description",
  "userRoles": ["user", "admin"],
  "category": ["Business"],
  "developer": "Your Name/Company",
  "botClients": {
    "web": true,
    "mobile": true
  }
}
```

### package.json

The template uses FrontM.ai 5.0 (latest beta):

```json
{
  "dependencies": {
    "@frontmltd/frontmjs": "github:frontmltd/frontm.js#5.0.b8"
  }
}
```

## 🚫 Common Pitfalls to Avoid

1. **Always update documentation first:** `git submodule update --remote docs`
2. **Use British English** in all code comments and strings
3. **Use `D.log()` for logging**, never `console.log()`
4. **Always use async/await** for database and API operations
5. **Handle errors properly** with `state.addErrorToStack()`
6. **Verify APIs exist** in documentation before using them — run `/frontm-api-verify`
7. **Build before committing** to catch errors early
8. **Follow field access patterns** exactly as documented

## 🔧 Troubleshooting

### Build Errors

```bash
# Clear webpack cache
rm -rf node_modules/.cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try a clean build
npm run build:dev
```

### Documentation Not Found

```bash
# Initialise all submodules
git submodule update --init --recursive

# Update to latest versions
git submodule update --remote
```

### Claude Code Configuration Not Loading

If the `/frontm-*` commands are missing or the verification phrase doesn't return "Neptune sailors ahead":

```bash
# Ensure the .claude submodule is initialised
git submodule update --init --recursive

# Update to the latest Claude Code configuration
git submodule update --remote .claude

# Verify the directory exists with content
ls -la .claude/

# Restart Claude Code to reload the configuration
```

### Circular Dependencies

Check your imports — circular dependencies are a common source of runtime errors. Ensure your module structure follows a clear hierarchy.

## 📦 Deployment

Deployment is handled through the FrontM.ai platform. After building your application:

1. Build your application: `npm run build:prod`
2. The `dist/main.js` bundle is created
3. Deploy using FrontM.ai CLI or platform tools
4. Configure `deployment.config.json` with your settings

## 🤝 Contributing

When contributing to this template:

1. Follow the coding standards in `./docs/frontm-ai-development-best-practices-guide.md`
2. Run linting and formatting before committing
3. Update documentation if adding new features
4. Test your changes with a production build

## 📄 License

This template is provided as-is for use with the FrontM.ai framework.

## 🆘 Support and Resources

- **Documentation:** `./docs/table-of-contents.md`
- **FrontM.ai Website:** [https://frontm.ai](https://frontm.ai)
- **Claude Code Config:** [frontmltd/frontm-ai-claude-config](https://github.com/frontmltd/frontm-ai-claude-config)
- **Framework Version:** 5.0.b8
- **Node.js Target:** 20+

## 🎯 Next Steps

1. ✅ Create your repository from this template
2. ✅ Clone with submodules: `git clone --recurse-submodules ...`
3. ✅ Install dependencies: `npm install`
4. ✅ Pull latest submodules: `git submodule update --remote`
5. ✅ Open Claude Code: `claude` (from the repo root)
6. ✅ Verify the config loaded ("Neptune sailors ahead")
7. ✅ **Run the LoG.ai spec pipeline first** — `/log-ai-story` → `/log-ai-process` → `/log-ai-detail` → `/log-ai-tasks` (or `/log-ai-reverse` on an existing codebase)
8. ✅ Implement tasks from `specs/4.task-dependency-graph.md` using `/frontm-new-intent`, `/frontm-add-collection`, etc.
9. ✅ Verify APIs before each task with `/frontm-api-verify`; capture follow-ups with `/frontm-fix-task`
10. ✅ Build and test: `npm run build:dev`
11. ✅ Customise `deployment.config.json` and deploy

### 📋 Quick Reference: Submodule Commands

```bash
# First-time setup
git submodule update --init --recursive

# Regular updates (run before starting new work)
git submodule update --remote            # Update all submodules
git submodule update --remote docs       # Update docs only
git submodule update --remote .claude    # Update Claude Code config only

# After updating submodules, commit the changes
git add docs .claude
git commit -m "Update submodules"
git push
```

---

**Happy Building with FrontM.ai + Claude Code! 🚀**
