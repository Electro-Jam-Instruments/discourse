# Accessibility Review Agent

This document defines the protocol for the Accessibility Review Agent, a sub-agent specialized in verifying WAI-ARIA implementations and keyboard navigation patterns.

## Agent Purpose

Perform deep analysis of accessibility implementations to ensure:
1. Correct ARIA roles, states, and properties
2. Proper keyboard navigation patterns
3. Screen reader compatibility
4. Compliance with W3C APG patterns

## Invocation

Use the Task tool with `subagent_type: "strategic-planner"` and `model: "opus"` for maximum thinking depth.

```
Prompt Template:
---
You are an Accessibility Review Agent performing a deep audit of keyboard navigation and ARIA implementation.

## Review Scope
[List files to review]

## Verification Checklist

### 1. Single Tab Stop (Roving Tabindex)
- [ ] Grid/table has exactly ONE tab stop
- [ ] Only ONE element has tabindex="0" at any time
- [ ] All other focusable elements have tabindex="-1"
- [ ] tabindex updates when focus moves
- [ ] Tab key exits the grid to next page element
- [ ] Shift+Tab enters grid from next element

### 2. Row Navigation (Up/Down Arrows)
- [ ] ArrowDown moves to next row
- [ ] ArrowUp moves to previous row
- [ ] At first row, ArrowUp does not wrap (or wraps if specified)
- [ ] At last row, ArrowDown triggers load-more or stops
- [ ] Focus visually indicated on current row
- [ ] Current row announced to screen reader

### 3. Composite Row Accessible Name
- [ ] Each row has aria-label or aria-labelledby
- [ ] Label includes: topic title, category, tags, reply count, views, activity time
- [ ] Label includes status indicators (pinned, closed, archived)
- [ ] Label is properly internationalized
- [ ] Screen reader announces full context on row focus

### 4. Cell Navigation (Left/Right Arrows)
- [ ] ArrowRight moves to next cell in row
- [ ] ArrowLeft moves to previous cell in row
- [ ] At first cell, ArrowLeft does not leave row
- [ ] At last cell, ArrowRight does not leave row
- [ ] Each cell has role="gridcell"
- [ ] Cell content is accessible

### 5. Focusable Elements Within Cells
- [ ] Links within cells are keyboard accessible
- [ ] Tab moves through interactive elements in current cell
- [ ] Shift+Tab moves backwards through cell elements
- [ ] Focus does not trap within a cell

### 6. ARIA Roles Verification
- [ ] Container: role="grid"
- [ ] Header section: role="rowgroup"
- [ ] Body section: role="rowgroup"
- [ ] Each row: role="row"
- [ ] Header cells: role="columnheader"
- [ ] Data cells: role="gridcell"
- [ ] aria-rowcount reflects total rows (including virtualized)
- [ ] aria-rowindex on each row (1-based, sequential)
- [ ] aria-colcount if columns are dynamic
- [ ] aria-colindex on cells if needed

### 7. W3C APG Grid Pattern Compliance
Reference: https://www.w3.org/WAI/ARIA/apg/patterns/grid/

- [ ] Follows Data Grid pattern (not Layout Grid)
- [ ] Keyboard shortcuts match specification
- [ ] Focus management matches specification

## Analysis Protocol

1. Read all specified files completely
2. Trace keyboard event handlers
3. Verify ARIA attribute bindings
4. Check tabindex management
5. Identify any gaps or issues
6. Provide specific line references for issues
7. Rate confidence level (High/Medium/Low) for each check

## Output Format

### Summary
[Overall assessment: PASS / NEEDS WORK / FAIL]
[Confidence: High / Medium / Low]

### Detailed Findings

#### ✅ Passing Checks
- [Check]: [Evidence from code]

#### ⚠️ Issues Found
- [Check]: [Issue description]
  - File: [path:line]
  - Expected: [what should happen]
  - Actual: [what the code does]
  - Fix: [recommended change]

#### 🔍 Unable to Verify
- [Check]: [Reason - may need runtime testing]

### Recommended Actions
1. [Priority action]
2. [Next action]
...
---
```

## Files to Include in Review

For Grid Navigation Review, include:
- `frontend/discourse/app/modifiers/grid-navigation.js`
- `frontend/discourse/app/components/topic-list/list.gjs`
- `frontend/discourse/app/components/topic-list/item.gjs`
- `frontend/discourse/app/components/topic-list/header.gjs`
- `frontend/discourse/app/lib/keyboard-navigation-utils.js`
- All cell components in `frontend/discourse/app/components/topic-list/item/`

For Toolbar Navigation Review, include:
- `frontend/discourse/app/modifiers/toolbar-navigation.js`
- `frontend/discourse/app/components/navigation-bar.gjs`
- `frontend/discourse/app/components/navigation-item.gjs`
- `frontend/discourse/app/lib/keyboard-navigation-utils.js`

## Example Invocation

```javascript
// In Claude Code conversation:
Task({
  subagent_type: "strategic-planner",
  model: "opus",
  description: "Accessibility review of grid",
  prompt: `[Full prompt template above with files listed]`
})
```

## Success Criteria

The review PASSES when:
- All checkbox items verified with code evidence
- No blocking issues (⚠️) found
- Confidence is High on critical items (1-4)
- Any Medium confidence items have clear next steps

## Review Cadence

Run this review:
1. After initial implementation
2. After significant changes to navigation
3. Before merging to main branch
4. When accessibility issues are reported
