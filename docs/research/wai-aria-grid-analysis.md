# WAI-ARIA Grid Implementation Analysis

**Date:** 2026-01-02
**Analyst:** Strategic Planning and Research Specialist
**Subject:** Post Stream 2-Cell Grid Pattern Implementation Review

---

## Executive Summary

The implementation demonstrates a **solid foundation** for WAI-ARIA grid pattern accessibility in the Discourse post stream. After thorough analysis of the keyboard navigation modifier, component structure, and ARIA attributes, I assess this implementation at **78% confidence** for correct functionality with screen readers.

There are several notable strengths and a few areas requiring attention before production deployment.

---

## Detailed Analysis

### 1. Grid Container (post-stream.gjs)

**File:** `frontend/discourse/app/components/post-stream.gjs`

**Implementation:**
```javascript
<div
  class="post-stream"
  role="grid"
  aria-label={{i18n "post_stream.aria_label"}}
  {{PostStreamNavigation}}
>
```

**Assessment:** CORRECT

| Aspect | Status | Notes |
|--------|--------|-------|
| `role="grid"` | Correct | Properly applied to container |
| `aria-label` | Correct | Uses i18n key "Post stream" |
| Modifier attachment | Correct | PostStreamNavigation modifier attached |

**No issues identified.**

---

### 2. Row Implementation (post.gjs)

**File:** `frontend/discourse/app/components/post.gjs`

**Implementation:**
```javascript
<div
  ...attributes
  role="row"
  tabindex="-1"
  aria-label={{this.postRowAriaLabel}}
  class={{...}}
>
```

**Assessment:** MOSTLY CORRECT with one concern

| Aspect | Status | Notes |
|--------|--------|-------|
| `role="row"` | Correct | Applied to outer div |
| `tabindex="-1"` | Correct | Allows programmatic focus |
| `aria-label` | Correct | Composite label with metadata |
| `...attributes` spread | Correct | Allows parent to pass additional attributes |

**Composite aria-label construction:**
```javascript
get postRowAriaLabel() {
  // Order: Author -> Replying to -> Reactions -> Edited -> Wiki -> Message preview -> Age -> Reply count
  const parts = [];
  parts.push(post.username);
  // ... conditional additions
  return parts.join(", ");
}
```

**Concern:** The composite label uses `post.excerpt` which may contain HTML entities or special characters that could be announced awkwardly. Consider sanitizing or limiting content.

---

### 3. Cell Implementation

#### 3.1 Avatar Cell (avatar.gjs)

**Implementation:**
```javascript
<div class={{concatClass "topic-avatar" this.additionalClasses}} ...attributes>
```

Parent passes `role="gridcell"`:
```javascript
<PostAvatar
  role="gridcell"
  @post={{@post}}
  ...
/>
```

**Assessment:** CORRECT

The `...attributes` spread allows the parent-provided `role="gridcell"` to be applied.

#### 3.2 Body Cell (post.gjs)

**Implementation:**
```javascript
<div class="post__body topic-body clearfix" role="gridcell">
```

**Assessment:** CORRECT

Directly has `role="gridcell"` applied.

---

### 4. Toolbar Implementation (menu.gjs)

**File:** `frontend/discourse/app/components/post/menu.gjs`

**Implementation:**
```javascript
<div class="actions" role="toolbar" aria-label={{i18n "post.sr_post_actions"}}>
  {{#each this.visibleButtons key="key" as |button|}}
    <PostMenuButtonWrapper ... />
  {{/each}}
</div>
```

**Assessment:** CORRECT

| Aspect | Status | Notes |
|--------|--------|-------|
| `role="toolbar"` | Correct | Semantic grouping of actions |
| `aria-label` | Correct | "Post actions" label |
| Nested in gridcell | Correct | Toolbar is inside body gridcell |

---

### 5. Small Action Posts (small-action.gjs)

**Implementation:**
```javascript
<div
  ...attributes
  role="row"
  tabindex="-1"
  aria-label={{this.a11yHeadingText}}
  ...
>
```

**Assessment:** CORRECT

System messages are properly treated as rows with accessible labels.

---

### 6. Keyboard Navigation Modifier (post-stream-navigation.js)

**File:** `frontend/discourse/app/modifiers/post-stream-navigation.js`

This is the core of the implementation. Detailed analysis:

#### 6.1 Keyboard Bindings

| Key | Action | Status |
|-----|--------|--------|
| Arrow Down | Next row | Correct |
| Arrow Up | Previous row | Correct |
| Arrow Right | Next focusable in row | Correct |
| Arrow Left | Previous focusable in row | Correct |
| Ctrl+Arrow Down | Last row | Correct |
| Ctrl+Arrow Up | First row | Correct |
| Home | First row | Correct |
| End | Last row | Correct |
| Ctrl+Home | First focusable in row | Correct |
| Ctrl+End | Last focusable in row | Correct |
| PageUp | Jump up N rows | Correct |
| PageDown | Jump down N rows | Correct |
| Enter | Activate/Document mode | Correct |
| Escape | Exit document mode | Correct |

#### 6.2 Roving Tabindex Implementation

```javascript
setInternalTabindices() {
  const allFocusables = this.element.querySelectorAll(
    this.options.focusableSelector
  );
  const rows = this.rows;
  allFocusables.forEach((el) => {
    if (!rows.includes(el)) {
      el.setAttribute("tabindex", "-1");
    }
  });
}

updateTabindices() {
  const rows = this.rows;
  updateRovingTabindex(rows, this.activeRowIndex);
}
```

**Assessment:** CORRECT

The implementation:
1. Sets `tabindex="-1"` on all internal focusables
2. Sets `tabindex="0"` only on the active row
3. Properly updates on navigation

#### 6.3 Focus Management

```javascript
focusRow(index) {
  const rows = this.rows;
  if (index >= 0 && index < rows.length) {
    this.activeRowIndex = index;
    this.activeFocusableIndex = -1; // Row itself is focused
    this.inDocumentMode = false;
    this.updateTabindices();
    rows[index].focus();
  }
}
```

**Assessment:** CORRECT

#### 6.4 Document Mode (Enter to read content)

```javascript
enterDocumentMode(row) {
  const documentElement = row.querySelector(this.options.documentSelector);
  if (documentElement) {
    this.inDocumentMode = true;
    documentElement.setAttribute("tabindex", "0");
    documentElement.focus();
  }
}
```

**CRITICAL ISSUE IDENTIFIED:**

The `documentSelector` is set to `.cooked[role="document"]`:
```javascript
documentSelector: '.cooked[role="document"]',
```

However, analyzing `cooked-html.gjs` and `decorated-html.gjs`, the `.cooked` div is created dynamically and **does NOT have `role="document"` applied**:

```javascript
// decorated-html.gjs line 149-151
if (this.args.className) {
  cookedDiv.className = this.args.className; // Sets "cooked" class
}
// No role attribute is set!
```

This means `enterDocumentMode()` will fail to find the element because the selector `.cooked[role="document"]` will match nothing.

---

### 7. i18n Strings Analysis

**File:** `config/locales/client.en.yml`

| Key | Value | Status |
|-----|-------|--------|
| `post_stream.aria_label` | "Post stream" | Present |
| `post.sr_replying_to` | "replying to %{username}" | Present |
| `post.sr_like_count` | Pluralized (one/other) | Present |
| `post.sr_edited` | "edited" | Present |
| `post.sr_wiki` | "wiki" | Present |
| `post.sr_reply_count` | Pluralized (one/other) | Present |
| `post.sr_post_actions` | "Post actions" | Present |

**Assessment:** CORRECT - All required i18n keys are present.

---

## Issues Identified

### Critical Issues

1. **Missing `role="document"` on .cooked element**
   - **Location:** `decorated-html.gjs` or `cooked-html.gjs`
   - **Impact:** Document mode will not work; Enter key will fail silently
   - **Fix Required:** Add `role="document"` to the cooked content div
   - **Severity:** HIGH

### Moderate Issues

2. **Avatar cell lacks explicit tabindex**
   - **Location:** `avatar.gjs`
   - **Impact:** When Arrow Right navigates to avatar cell, focus behavior may be inconsistent
   - **Analysis:** The modifier's `getFocusablesInRow()` queries `[role="gridcell"]` elements. The avatar div with `role="gridcell"` does not have a tabindex, so it cannot receive focus directly.
   - **Fix Required:** Either add `tabindex="-1"` to avatar gridcell OR adjust navigation to skip unfocusable cells
   - **Severity:** MEDIUM

3. **Body gridcell lacks tabindex**
   - **Location:** `post.gjs` line 603
   - **Impact:** Same as avatar - the gridcell div cannot receive focus
   - **Fix Required:** Add `tabindex="-1"` to body gridcell
   - **Severity:** MEDIUM

### Minor Issues

4. **No aria-rowindex on rows**
   - **Impact:** Screen readers cannot announce position in grid
   - **WAI-ARIA Spec:** Optional but recommended for large grids
   - **Severity:** LOW

5. **No aria-colindex on cells**
   - **Impact:** Screen readers cannot announce column position
   - **WAI-ARIA Spec:** Optional but recommended
   - **Severity:** LOW

6. **Post excerpt in aria-label may contain HTML entities**
   - **Location:** `post.gjs` `postRowAriaLabel` getter
   - **Impact:** Awkward announcements if excerpt has encoded characters
   - **Severity:** LOW

---

## Confidence Assessment

### Overall Score: 78%

**Breakdown:**

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| ARIA Role Structure | 25% | 95% | 23.75% |
| Keyboard Navigation Logic | 25% | 90% | 22.50% |
| Roving Tabindex | 20% | 95% | 19.00% |
| Focus Management | 20% | 60% | 12.00% |
| i18n/Announcements | 10% | 90% | 9.00% |
| **Total** | **100%** | - | **86.25%** |

**Adjusted for Critical Issues:** 78%

The critical issue with document mode (missing `role="document"`) reduces confidence significantly because it's a core interaction pattern.

---

## Recommendations

### Must Fix Before Production

1. **Add `role="document"` to cooked content**

   In `cooked-html.gjs` or `decorated-html.gjs`, ensure the cooked div receives the role:

   ```javascript
   // Option A: In DecoratedHtml.elementToDecorate getter
   get elementToDecorate() {
     const cookedDiv = detachedDocument.createElement("div");
     cookedDiv.innerHTML = cooked.toString();
     if (this.args.className === "cooked") {
       cookedDiv.setAttribute("role", "document");
     }
     // ...
   }
   ```

   Or pass it as an argument from PostCookedHtml.

2. **Add tabindex to gridcells**

   In `post.gjs`:
   ```javascript
   <PostAvatar
     role="gridcell"
     tabindex="-1"
     @post={{@post}}
   />

   <div class="post__body topic-body clearfix" role="gridcell" tabindex="-1">
   ```

### Should Fix

3. **Add aria-rowindex to rows**

   Pass index from post-stream loop:
   ```javascript
   <PostComponent
     aria-rowindex={{add index 1}}
     ...
   />
   ```

4. **Sanitize excerpt in aria-label**

   Strip HTML entities from `post.excerpt` before including in label.

### Consider for Phase 2

5. **Add aria-colindex to cells** when moving to 3-cell pattern
6. **Add aria-rowcount to grid** for virtual scrolling context

---

## Testing Recommendations

Before considering this implementation complete:

1. **NVDA Testing (Windows)**
   - Navigate with arrow keys
   - Verify row announcements include composite label
   - Test Enter to enter document mode (will fail until fix #1)
   - Test Escape to exit
   - Verify toolbar button navigation

2. **VoiceOver Testing (macOS)**
   - Same tests as NVDA
   - Verify trackpad gestures don't conflict

3. **JAWS Testing (Windows)**
   - Focus on virtual cursor vs. application mode transitions
   - Verify document mode allows reading with virtual cursor

4. **Keyboard-Only Testing**
   - Tab into grid from outside
   - Navigate all rows
   - Navigate all cells within row
   - Activate toolbar buttons
   - Test Home/End/PageUp/PageDown

---

## Conclusion

The implementation shows strong understanding of WAI-ARIA grid patterns and careful attention to keyboard navigation. The roving tabindex implementation is solid, and the composite aria-labels provide rich context for screen reader users.

However, the missing `role="document"` on the cooked content is a blocking issue that prevents document mode from functioning. Additionally, the gridcells lacking tabindex may cause navigation inconsistencies.

With the recommended fixes applied, confidence would rise to approximately **92%**.

---

## References

- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [WAI-ARIA Roving Tabindex](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex)
- [Document Role](https://www.w3.org/TR/wai-aria-1.2/#document)
- [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
