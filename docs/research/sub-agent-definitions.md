# Sub-Agent Definitions for Discourse Accessibility Work

This document tracks the sub-agent configurations used for validating accessibility implementations in the Discourse codebase.

---

## Discourse Accessibility Validation Agent

**Purpose:** Deep analysis and validation of accessibility implementation plans for Discourse.

**Agent Type Used:** `strategic-planner`

**Invocation Pattern:**
```
Task tool with:
- subagent_type: "strategic-planner"
- prompt: Include "ULTRATHINK" directive for deep analysis
```

**Capabilities:**
- Full codebase exploration (Glob, Grep, Read tools)
- Web research for WAI-ARIA specifications
- Multi-option analysis with pros/cons
- Risk assessment and confidence scoring
- Implementation feasibility evaluation

**Example Prompt Structure:**
```
ULTRATHINK - Take your time to deeply analyze this implementation plan.

## Context
[Description of the accessibility feature being implemented]

## The Plan
[Detailed plan from documentation]

## Your Task
1. Explore the actual Discourse codebase to understand:
   - [Specific components to examine]
   - [Existing patterns to reference]

2. Identify potential issues with the plan:
   - [Specific concerns to investigate]

3. Evaluate feasibility of each implementation phase

4. Provide confidence assessment:
   - Rate 0-100% confidence
   - List specific concerns
   - Suggest modifications to increase confidence to 90%+
```

**Output Expectations:**
- Confidence percentage with breakdown
- Option analysis (multiple approaches)
- Risk assessment
- Recommended approach
- Files to modify list
- Detailed feasibility assessment document

---

## Usage History

### 2026-01-02: Post Stream Grid Pattern Validation

**Task:** Validate 3-cell grid pattern for post stream accessibility

**Result:**
- 3-cell approach: 65% confidence (HIGH risk - DOM restructuring)
- 2-cell approach: 85-90% confidence (LOW risk - matches current DOM)

**Decision:** Proceed with 2-cell, plan 3-cell for future

**Output Document:** `docs/research/post-stream-grid-feasibility-assessment.md`

**Agent ID:** `a735641` (can be resumed for follow-up analysis)

---

## Future Agent Definitions to Consider

### Discourse Component Expert Agent
**Purpose:** Deep knowledge of Discourse component patterns, Ember/Glimmer conventions, and plugin architecture.

**Potential Specialization:**
- `.gjs` component syntax
- Ember modifiers
- Plugin outlet system
- DAG-based extensibility patterns

### Screen Reader Testing Agent
**Purpose:** Validate accessibility implementations against screen reader behavior.

**Potential Specialization:**
- NVDA, JAWS, VoiceOver quirks
- ARIA role announcements
- Focus management patterns
- Live region behavior

---

## Notes

- The `strategic-planner` agent is general-purpose but effective for accessibility validation
- Future work may benefit from a custom Discourse-specific agent definition
- ULTRATHINK directive encourages thorough analysis over quick answers
- Always request confidence scores to gauge implementation risk
