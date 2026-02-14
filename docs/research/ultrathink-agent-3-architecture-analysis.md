# Post Stream Navigation Architecture Analysis

## Executive Summary

This document analyzes the fundamental architecture of the `post-stream-navigation.js` modifier and evaluates whether it is salvageable or requires replacement with a different approach. After reviewing the codebase, bug history, and alternative patterns, my assessment is:

**The current architecture has fundamental design flaws that make it inherently fragile. However, a complete rewrite is not necessary. The architecture can be stabilized with targeted changes to Option D (explicit post ID state management) combined with removing tabindex updates from `modify()`.**

---

## Current Architecture Overview

### Core Design

The post-stream-navigation modifier implements the WAI-ARIA grid pattern with these key characteristics:

1. **Roving Tabindex**: One row has `tabindex="0"`, all others have `tabindex="-1"`
2. **State Tracking**: Uses `activeRowId` (post number as string) to track current position
3. **DOM Queries**: Uses `this.rows` getter to query visible (non-cloaked) posts
4. **Ember Lifecycle**: Uses Ember modifier's `modify()` method which runs on every re-render

### The Fundamental Problem

```
                    EMBER RE-RENDER CYCLE
                            |
                            v
    +-------------------> modify() runs
    |                       |
    |                       v
    |               updateTabindices()
    |                       |
    |                       v
    |               getActiveRowIndex()
    |                       |
    |                       v
    |               queries this.rows  <--- CLOAKING MAY HAVE CHANGED THIS
    |                       |
    |                       v
    |               sets tabindex="0" on wrong row
    |                       |
    |                       v
CLOAKING           focus may jump unexpectedly
CHANGES  <-----------------+
```

The core issue is that `modify()` runs on EVERY Ember re-render, including:
- Cloaking boundary changes (`cloakAbove`/`cloakBelow` tracked properties)
- Posts being added/removed from the stream
- Any tracked property changes in the component

Each time `modify()` runs, it calls `updateTabindices()` which queries the DOM for current rows. If cloaking has changed the visible rows between navigation and re-render, tabindex gets set on the wrong row.

### Why Guards Are Insufficient

The current code has two guards:
1. `_isNavigating` flag with `queueMicrotask()` clearing
2. Skip if active row is cloaked

These guards reduce the frequency of the bug but do not eliminate it because:

1. **Microtask timing is fragile**: Cloaking can trigger at any point during smooth scroll
2. **The fundamental loop**: `modify()` -> `updateTabindices()` -> DOM query -> potential mismatch
3. **State corruption compounds**: Once state is corrupted, subsequent navigation amplifies the error

---

## Option Analysis

### Option A: Remove modify() Completely

**Concept**: Only set up event listeners once. Never update tabindices in `modify()`. Update tabindices ONLY during explicit navigation.

**Implementation Approach**:
```javascript
modify(element, positional, named) {
  // ONLY set up event listeners once
  if (this.element !== element) {
    this.cleanup();
    this.element = element;
    this.setupEventListeners();
    this.setInternalTabindices();  // One-time setup
    this.updateTabindices();       // One-time setup
    this.scheduleInitialFocus(named.lastReadPostNumber);
  }
  this.options = { ...this.options, ...named };
  // NO tabindex updates on re-render
}
```

**Would it solve race conditions?** PARTIALLY

The race condition in `modify()` would be eliminated, but a new problem emerges: when rows change (cloaking), the tabindex="0" row might be removed from DOM. The browser moves focus to `<body>`, but no code updates tabindices on the remaining rows. The user could Tab into the grid and land on no row (all have tabindex="-1").

**Tradeoffs**:
| Pro | Con |
|-----|-----|
| Eliminates modify() race condition | Tabindex can become stale |
| Simpler mental model | Need separate mechanism for tabindex recovery |
| Less code execution | May fail on edge cases (all posts cloaked) |

**Screen Reader Compatibility**: GOOD - roving tabindex is well-supported

**Refactoring Needed**: LOW - mostly deletion of code

**Recommendation**: This is a partial solution. Works well when combined with focusout recovery.

---

### Option B: CSS-Based Focus Instead of Tabindex

**Concept**: Use `:focus-visible` CSS to show focus indicator. Do not manage tabindex at all. Let browser handle focus naturally.

**Implementation Approach**:
```javascript
// No tabindex management at all
// All rows always focusable (tabindex="0" or natural focusability)
// CSS handles visual focus indication
```

**Would it solve race conditions?** NO

This fundamentally misunderstands the purpose of roving tabindex. Without tabindex management:
1. Tab key would stop on EVERY row (terrible UX - could be 100+ tab stops)
2. Arrow key navigation would still need state tracking
3. Browser Tab order becomes unpredictable with cloaking

**Tradeoffs**:
| Pro | Con |
|-----|-----|
| Simplest possible code | Breaks single-tab-stop pattern |
| No state to corrupt | Unusable with 100+ posts |
| CSS-only focus styles | No keyboard efficiency |

**Screen Reader Compatibility**: POOR - violates WAI-ARIA grid pattern expectations

**Refactoring Needed**: N/A - This approach is not viable

**Recommendation**: REJECT. This breaks the fundamental accessibility pattern.

---

### Option C: Virtual Focus (aria-activedescendant)

**Concept**: Keep focus on container element. Use `aria-activedescendant` to indicate current row. No tabindex management needed.

**Implementation Approach**:
```javascript
// Container has tabindex="0" and receives all keyboard events
// aria-activedescendant points to the "virtually focused" row
// No actual DOM focus moves between rows

handleKeyDown(event) {
  if (event.key === 'ArrowDown') {
    const nextRowId = this.getNextRowId();
    this.element.setAttribute('aria-activedescendant', nextRowId);
    this.activeRowId = nextRowId;
    // No focus() call needed
  }
}
```

**Would it solve race conditions?** YES (mostly)

Because DOM focus never moves between rows, there is no race condition where:
- A focused element gets cloaked
- Browser moves focus to body
- `modify()` corrupts state

The container always has focus. Only `aria-activedescendant` attribute changes.

**Tradeoffs**:
| Pro | Con |
|-----|-----|
| No DOM focus movement | Requires all rows have stable IDs |
| No tabindex management | Browser won't auto-scroll to active row |
| Immune to cloaking race | VoiceOver has known issues with grid+activedescendant |
| Simpler focus recovery | Less intuitive for sighted keyboard users |

**Screen Reader Compatibility**: MIXED

According to [W3C research](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) and [accessibility expert analysis](https://zellwk.com/blog/element-focus-vs-aria-activedescendant/):

> "There is only one reliable method for managing focus: element.focus + roving tabindex. Don't use aria-activedescendant. It doesn't work on grid and combobox with VoiceOver."

[GitHub issue #2684 on aria-practices](https://github.com/w3c/aria-practices/issues/2684) discusses the tradeoffs in detail.

The critical problem: roving tabindex makes the browser scroll the focused element into view automatically. With `aria-activedescendant`, we must implement scrolling manually. This is why post-stream-navigation has `scrollRowIntoView()` - but if we use virtual focus, scroll timing becomes even MORE critical.

**Refactoring Needed**: HIGH - fundamentally different approach

**Recommendation**: REJECT for post stream. The VoiceOver incompatibility is a dealbreaker. This pattern works better for comboboxes where focus must stay in an input field.

---

### Option D: Explicit Post ID State Management

**Concept**: Navigate entirely by post ID/number rather than array index. Maintain focus state independent of DOM queries. Only query DOM for the actual focus operation.

**Implementation Approach**:
```javascript
// State is post-number based, not index-based
activeRowId = "5";  // Post number 5

focusNextRow() {
  // Get current post number
  const currentPostNumber = parseInt(this.activeRowId, 10);
  if (isNaN(currentPostNumber)) {
    this.activeRowId = this.getFirstVisiblePostNumber();
    return;
  }

  // Calculate next post number (could be currentPostNumber + 1, or find next in sequence)
  const nextPostNumber = currentPostNumber + 1;

  // Try to find and focus that row
  const nextRow = this.element.querySelector(`[data-post-number="${nextPostNumber}"]`);
  if (nextRow && !nextRow.closest('.post-stream--cloaked')) {
    this.focusRowByElement(nextRow);
  } else {
    // Post is cloaked or doesn't exist - find nearest visible post
    const nearestVisible = this.findNearestVisiblePost(nextPostNumber, 1 /* direction */);
    if (nearestVisible) {
      this.focusRowByElement(nearestVisible);
    }
  }
}

focusRowByElement(row) {
  // All state updates happen atomically
  this.activeRowId = row.dataset.postNumber;
  this.activeFocusableIndex = -1;

  // Update tabindices only on the rows we can see RIGHT NOW
  this.updateTabindicesForVisibleRows();

  row.focus();
  this.scrollRowIntoView(row);
}
```

**Key insight**: The current code already tracks `activeRowId` as post number. The problem is that `getActiveRowIndex()` converts this to an array index, which is where the race condition occurs. If we skip the index conversion entirely and navigate by post number, the race condition cannot occur.

**Would it solve race conditions?** YES

Post numbers are stable identifiers that never change regardless of cloaking. The sequence post 5 -> post 6 -> post 7 is always valid regardless of which posts are currently visible. The only question is whether the target post is currently rendered.

**Tradeoffs**:
| Pro | Con |
|-----|-----|
| Post numbers are stable | Gaps in post numbers (deleted posts) |
| No index<->ID conversion | Must handle "next post cloaked" scenario |
| Immune to cloaking race | Slightly more complex query logic |
| Already partially implemented | Need to update all navigation methods |

**Screen Reader Compatibility**: EXCELLENT - still uses roving tabindex

**Refactoring Needed**: MEDIUM - the infrastructure exists, need to rewire navigation

**Recommendation**: IMPLEMENT. This is the correct fix that addresses the root cause.

---

## Comparison Matrix

| Criterion | Option A | Option B | Option C | Option D |
|-----------|----------|----------|----------|----------|
| Solves race conditions | Partial | No | Yes | Yes |
| Screen reader compatible | Yes | No | Mixed | Yes |
| Follows WAI-ARIA grid | Yes | No | Yes | Yes |
| Browser auto-scroll | Yes | N/A | No | Yes |
| VoiceOver support | Yes | No | Problematic | Yes |
| Refactor effort | Low | N/A | High | Medium |
| Future-proof | Partial | No | Yes | Yes |

---

## Root Cause Summary

The focus jumping bug has three interconnected causes:

1. **`modify()` runs on every re-render** including cloaking changes
2. **Array indices are unstable** because cloaking changes the DOM
3. **Index<->ID conversion** in `getActiveRowIndex()` creates race windows

The current guards (navigation flag, cloaked-row skip) are band-aids that reduce symptom frequency but don't address root causes.

---

## Recommended Solution

**Primary Fix: Option D - Post ID Based Navigation**

Convert all navigation methods to work with post numbers directly:

```javascript
focusNextRow() {
  const rows = this.rows;  // Still capture for operations
  if (rows.length === 0) return;

  this._lastNavigationDirection = 1;

  // Find current row's position in visible rows
  const currentRow = this.findRowByPostNumber(rows, this.activeRowId);

  if (currentRow) {
    // Current row is visible - find next in sequence
    const currentIndex = rows.indexOf(currentRow);
    const nextIndex = currentIndex + 1;
    if (nextIndex < rows.length) {
      this.focusRowByElement(rows[nextIndex]);
    }
    // else: at end, don't wrap
  } else {
    // Current row is cloaked - find first visible row in navigation direction
    const targetPostNumber = parseInt(this.activeRowId, 10);
    const proxy = this.findProxyRow(rows, targetPostNumber, 1 /* down */);
    if (proxy) {
      this.focusRowByElement(proxy);
    }
  }
}

findRowByPostNumber(rows, postNumber) {
  if (postNumber === "header") {
    return rows.find(r => r.classList.contains('topic-header-row'));
  }
  return rows.find(r => r.dataset.postNumber === postNumber);
}

findProxyRow(rows, targetPostNumber, direction) {
  // Find best visible row when target is cloaked
  // direction: 1 = down, -1 = up
  let best = null;
  let bestDistance = Infinity;

  for (const row of rows) {
    const pn = parseInt(row.dataset.postNumber, 10);
    if (isNaN(pn)) continue;

    if (direction > 0 && pn >= targetPostNumber) {
      const dist = pn - targetPostNumber;
      if (dist < bestDistance) {
        bestDistance = dist;
        best = row;
      }
    } else if (direction < 0 && pn <= targetPostNumber) {
      const dist = targetPostNumber - pn;
      if (dist < bestDistance) {
        bestDistance = dist;
        best = row;
      }
    }
  }
  return best;
}
```

**Secondary Fix: Remove tabindex updates from modify()**

```javascript
modify(element, positional, named) {
  if (this.element !== element) {
    // First-time setup only
    this.cleanup();
    this.element = element;
    this.setupEventListeners();
    this.activeRowId = "header";
    this.activeFocusableIndex = -1;

    // Initial tabindex setup
    this.updateTabindices();
    this.setInternalTabindices();
  }

  this.options = { ...this.options, ...named };

  // Schedule initial focus if needed (one-time)
  if (!this.initialFocusComplete && this.focusHistory.keyboardMode) {
    this.scheduleInitialFocus(named.lastReadPostNumber);
  }

  // DO NOT call updateTabindices() on re-render
  // Tabindices are managed exclusively by focusRowByElement()
}
```

**Tertiary Fix: Robust focusout recovery**

```javascript
handleFocusOut(event) {
  if (!event.relatedTarget || !this.element.contains(event.relatedTarget)) {
    // Focus left grid
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        // Focus was lost - only recover if we have a valid activeRowId
        const rows = this.rows;
        const targetRow = this.findRowByPostNumber(rows, this.activeRowId);

        if (targetRow) {
          // Target row is visible - focus it
          this.focusRowByElement(targetRow);
        } else {
          // Target row cloaked - find nearest visible
          const proxy = this.findNearestVisibleRow(rows, this.activeRowId);
          if (proxy) {
            // Update activeRowId to proxy so next navigation is correct
            this.activeRowId = this.getRowId(proxy);
            this.focusRowByElement(proxy);
          }
        }
      }
    });
  }
}
```

---

## Is the Current Architecture Salvageable?

**Yes, with the targeted changes above.**

The architecture is not fundamentally broken - it correctly uses:
- WAI-ARIA grid pattern
- Roving tabindex (screen reader compatible)
- Post number tracking for stable IDs

The problems are implementation details:
1. `modify()` does too much on every re-render
2. Navigation methods mix index-based and ID-based logic
3. Guards are reactive instead of proactive

The fix is not "throw it away and start over" but rather:
1. Stop calling `updateTabindices()` in `modify()` (10 lines removed)
2. Convert navigation to pure post-number logic (50 lines rewritten)
3. Add robust focusout recovery (20 lines added)

Total refactoring effort: ~80 lines of changes, not a rewrite.

---

## Implementation Priority

1. **Immediate**: Remove `updateTabindices()` and `setInternalTabindices()` from `modify()` body (keep in setup block)
2. **Short-term**: Refactor `focusNextRow()` and `focusPreviousRow()` to work with post numbers directly
3. **Short-term**: Update `findProxyRow()` logic to use consistent algorithm
4. **Medium-term**: Add comprehensive test coverage for cloaking scenarios
5. **Long-term**: Consider removing debug logging once stable

---

## Conclusion

The post-stream-navigation modifier has a sound architectural foundation but suffers from implementation bugs caused by mixing index-based and ID-based navigation, and running state updates on every Ember re-render.

**The architecture is salvageable.** The fix requires:
1. Removing `modify()` side effects (tabindex updates)
2. Converting to pure post-number navigation
3. Adding focusout recovery

This is approximately 80 lines of targeted changes, not a rewrite. The alternative approaches (CSS focus, aria-activedescendant) either break accessibility patterns or have worse screen reader support.

---

## References

- [WAI-ARIA Authoring Practices - Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [aria-activedescendant vs Roving Tabindex Discussion](https://github.com/w3c/aria-practices/issues/2684)
- [Element.focus vs aria-activedescendant Analysis](https://zellwk.com/blog/element-focus-vs-aria-activedescendant/)
- [Keyboard Navigation Patterns for Complex Widgets](https://www.uxpin.com/studio/blog/keyboard-navigation-patterns-complex-widgets/)
- [NVDA vs JAWS Screen Reader Comparison 2025](https://accessibility-test.org/blog/development/screen-readers/nvda-vs-jaws-vs-voiceover-2025-screen-reader-comparison/)

---

## Appendix: Why Not a Complete Rewrite?

A complete rewrite would involve:
1. Redesigning the modifier from scratch
2. Potentially changing the ARIA pattern (e.g., to treegrid or listbox)
3. Rebuilding all keyboard navigation
4. Extensive screen reader testing

The risks are:
1. **Time**: 2-3 weeks vs 2-3 days for targeted fixes
2. **Regression**: High chance of introducing new bugs
3. **Scope creep**: Temptation to "improve" other things
4. **Testing**: Need to re-validate all screen reader behaviors

The current implementation has:
1. Correct ARIA semantics
2. Working screen reader support
3. Comprehensive keyboard navigation
4. Good documentation

It would be wasteful to discard this work. The bugs are isolated to state management, not the overall design.
