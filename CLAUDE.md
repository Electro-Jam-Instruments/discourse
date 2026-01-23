# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discourse is a 100% open-source community/forum platform. It's a large, mature Rails + Ember.js application with a long history.

**Tech Stack:**
- Backend: Ruby on Rails (API, responds RESTfully in JSON)
- Frontend: Ember.js (in `frontend/discourse/`)
- Database: PostgreSQL 13+
- Cache: Redis 7+
- Ruby: 3.3+
- Node: 20+
- Package Manager: pnpm 9+

## Commands

### Development Server
```bash
pnpm dev  # Runs both Ember CLI and Rails server concurrently
```

### Ruby Tests (RSpec)
```bash
bin/rspec spec/path/file_spec.rb           # Run all tests in file
bin/rspec spec/path/file_spec.rb:123       # Run specific test at line number
```

### JavaScript Tests (QUnit)
```bash
bin/qunit --help                           # Detailed help
bin/qunit path/to/test-file.js             # Run all tests in file
bin/qunit path/to/tests/directory          # Run all tests in directory
```

### Linting
```bash
bin/lint path/to/file                      # Lint specific files
bin/lint --fix path/to/file                # Lint and auto-fix
bin/lint --fix --recent                    # Lint all recently changed files
```

**Always lint any changes you make.**

## Architecture

### Backend Structure (`app/`)
- `controllers/` - Rails controllers (API endpoints)
- `models/` - ActiveRecord models
- `serializers/` - JSON serializers for API responses
- `services/` - Service objects using `Service::Base` DSL (see `lib/service.rb`)
- `jobs/` - Sidekiq background jobs
- `mailers/` - Email templates and logic

### Frontend Structure (`frontend/discourse/`)
- `app/components/` - Ember components
- `app/controllers/` - Ember controllers
- `app/models/` - Ember data models
- `app/routes/` - Ember routes
- `app/services/` - Ember services
- `app/form-kit/` - FormKit form components
- `app/widgets/` - Legacy widget system (being phased out)

### Key Libraries (`lib/`)
- `guardian.rb` - Authorization system (`can_see?`, `can_edit?` patterns)
- `service.rb` - Service object DSL with steps: `params`, `model`, `policy`, `step`, `transaction`
- `site_setting_extension.rb` - Site settings functionality
- `plugin.rb` - Plugin API

### Plugins (`plugins/`)
Contains official plugins (chat, AI, calendar, etc.). Each plugin has its own assets, models, and config.

## Development Rules

### All Files
- Always lint changed files
- Make display strings translatable (use placeholders, not split strings)

### Toolset
- Use `pnpm` for JavaScript, `bundle` for Ruby
- Use helpers in `bin/` over `bundle exec` (e.g., `bin/rspec`, `bin/rake`)

### JavaScript/Ember
- No empty backing classes for template-only components
- Use FormKit for forms: `frontend/discourse/app/form-kit/`
- JSDoc required for classes/methods (multiline format, `@component` for components)

### Ruby
- Extract business logic into services (`app/services/` with `Service::Base`)
- Use `fab!()` over `let()` in specs
- System tests go in `spec/system/`, use page objects from `spec/system/page_objects/`

### Page Objects (System Specs)
- Inherit from `PageObjects::Pages::Base`
- NEVER store `find()` results (causes stale element references)
- Use `has_x?`/`has_no_x?` patterns for state checks
- Action methods find+interact atomically, return `self` for chaining

## Documentation Requirements

When making changes, update `/docs` to track:
1. **What was the desired experience** - The goal or problem being solved
2. **What we did to enable it** - The implementation approach

## GitHub Issues - CRITICAL

**ALWAYS use our fork for ALL issue operations:**
```
Electro-Jam-Instruments/discourse
```

**NEVER attempt to access upstream `discourse/discourse` issues** - they have issues disabled and it wastes time.

### Commands to use:
```bash
# List issues
gh issue list --repo Electro-Jam-Instruments/discourse --state open

# Create issue
gh issue create --repo Electro-Jam-Instruments/discourse --title "[A11Y] Title" --body "Description"

# View issue
gh issue view 28 --repo Electro-Jam-Instruments/discourse

# Close issue
gh issue close 28 --repo Electro-Jam-Instruments/discourse --comment "Fixed in commit xyz"

# Edit issue title
gh issue edit 28 --repo Electro-Jam-Instruments/discourse --title "[Needs Testing] A11Y: New title"
```

### Issue Title Conventions:
- `[A11Y]` - Accessibility issue prefix
- `[Needs Testing]` - Work done, needs verification
- `[Research]` - Investigation needed before implementation

### Local Tracking:
- Detailed bug tracking: `docs/bugs/accessibility-issues.md`
- Upstream contribution plan: `docs/upstream-contribution-plan.md`

## Accessibility Work

For accessibility implementation details, see @docs/accessibility/00-index.md

This includes:
- Keyboard navigation patterns (toolbar, grid)
- WAI-ARIA roles and labels
- Focus management and testing approach

## Site Settings

- Configured in `config/site_settings.yml` (or `config/settings.yml` for plugins)
- Ruby access: `SiteSetting.setting_name`
- JS access: `this.siteSettings.setting_name` (with `@service siteSettings`)

## Services Pattern

Services use a DSL with these step types:
- `params` - Validate input parameters
- `model` - Fetch/build model (fails if falsy)
- `policy` - Run guardian/permission checks
- `step` - Arbitrary code (call `fail!` to mark failure)
- `transaction` - Wrap steps in DB transaction

## Database & Performance

- Use `includes()`/`preload()` to avoid N+1 queries
- Use `find_each()`/`in_batches()` for large datasets
- Use `update_all`/`delete_all` for bulk operations
- Use `exists?` over `present?` for existence checks
- Migrations: include rollback logic, use `algorithm: :concurrently` for large tables

## HTTP Response Codes

- **204 No Content**: DELETE operations, updates without return data
- **200 OK**: When returning data (`render json: success_json`)
- **201 Created**: When creating resources

## Security

- XSS: Use `{{}}` (escaped), never `{{{ }}}` or `innerHTML`
- Authorization: Use Guardian classes (`lib/guardian/`)
- Always validate on both client and server
- Use strong parameters and length limits

## Code Review Anti-Patterns - MUST REJECT

These patterns indicate a flawed approach. When you see them in code (yours or during review), STOP and find the root cause instead.

### 1. Timing-Based Solutions (CRITICAL)

**NEVER use timing delays to "fix" race conditions or async issues.**

BAD patterns - REJECT these:
```javascript
// BAD: Arbitrary delays to "wait for things to settle"
setTimeout(() => doSomething(), 100);
setTimeout(() => fix(), 300);

// BAD: Timing guards with hardcoded milliseconds
const NAVIGATION_GUARD_MS = 150;
if (msSinceLastAction < NAVIGATION_GUARD_MS) return;

// BAD: performance.now() comparisons as guards
if (performance.now() - this._lastTimestamp < 200) return;
```

WHY these are bad:
- They mask the real problem instead of fixing it
- They're inherently unreliable (different devices, loads, etc.)
- They lead to debugging nightmares (11 fix attempts for focus jumping bug)
- They often need to be increased, creating a maintenance burden

GOOD alternatives:
```javascript
// GOOD: State flags that track actual state
this._userHasInteracted = true;
if (this._userHasInteracted) return;

// GOOD: Check actual conditions, not time elapsed
if (document.activeElement !== document.body) return;

// GOOD: Event-based coordination
element.addEventListener('transitionend', () => doNext());

// GOOD: Boolean guards set before actions
this._isNavigating = true;
// ... do navigation ...
queueMicrotask(() => { this._isNavigating = false; });
```

### 2. Root Cause Analysis Required

When debugging issues:
1. **Ask "WHY is this happening?"** - not "HOW do I delay it?"
2. **Use call stacks** - `new Error().stack` reveals the actual source
3. **Check multiple sources** - The bug might be in a different file/modifier
4. **Look for competing code** - Multiple components may fight for the same resource

### 3. ESLint Enforcement

The project has a custom ESLint rule `electrojam/no-timing-hacks` that warns on:
- `setTimeout` with hardcoded delays (except 0 for deferring)
- Variables ending in `_MS`, `_DELAY`, `_TIMEOUT`
- `performance.now()` comparisons used as guards

Run `bin/lint` to check for these patterns.

### 4. Allowed Timing Contexts

Timing IS appropriate for:
- `debounce`/`throttle` utilities (intentional rate limiting)
- Animation/transition timing (visual effects)
- Polling intervals (intentional periodic checks)
- Test timeouts (waiting for async operations)

### 5. Focus Management Patterns

For focus-related code specifically:
- Use state flags (`_userHasInteracted`, `_isNavigating`)
- Check `document.activeElement` before stealing focus
- Multiple modifiers must coordinate - check if focus is in another region
- Never assume timing will make race conditions go away
