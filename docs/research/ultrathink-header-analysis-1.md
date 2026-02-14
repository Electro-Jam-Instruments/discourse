# Header Row Focus Jumping Analysis

## Executive Summary

This analysis examines the `post-stream-navigation.js` modifier for issues specific to header row handling in the post stream grid. The header row is unique because:
1. It uses `rowId="header"` (string) instead of a numeric post number
2. It lacks `dataset.postNumber` attribute (posts have this)
3. It uses the `topic-header-row` CSS class

**Key Finding:** Multiple edge cases exist where string "header" interacts poorly with numeric post number logic, potentially causing focus jumping issues.

---

## 1. findRowByPostNumber() Analysis (Lines 254-259)

### Code
```javascript
findRowByPostNumber(rows, postNumber) {
  if (postNumber === "header") {
    return rows.find(r => r.classList.contains('topic-header-row')) || null;
  }
  return rows.find(r => r.dataset.postNumber === postNumber) || null;
}
```

### Assessment: MOSTLY CORRECT

**What it does right:**
- Correctly handles `postNumber === "header"` as a special case
- Uses `classList.contains('topic-header-row')` to find header
- Falls back to `null` if header not found

### POTENTIAL ISSUE 1: Header Not First in Array

**Scenario:** If for some reason the header row is NOT the first element in the rows array (e.g., DOM ordering issues, or header cloaking then uncloaking), the function still works because it uses `find()` which searches the entire array.

**Verdict:** This function is **correct** - it finds by class, not by array position.

### POTENTIAL ISSUE 2: Missing Header Row

**Scenario:** If the header row is cloaked (unusual but possible), `find()` returns `undefined`, which becomes `null`.

**Verdict:** **Correct behavior** - returning `null` signals "not found".

---

## 2. findProxyRow() Analysis (Lines 269-310)

### Code (relevant section)
```javascript
findProxyRow(rows, targetPostNumber, direction) {
  if (targetPostNumber === "header") {
    // Header cloaked is unusual, return first row
    return rows[0] || null;
  }

  const target = parseInt(targetPostNumber, 10);
  if (isNaN(target)) {
    return rows[0] || null;
  }
  // ... numeric post number logic follows
}
```

### Assessment: POTENTIAL ISSUES FOUND

### BUG 1: Header Cloaked Returns Wrong Row

**Scenario:** If `targetPostNumber === "header"` and the header IS cloaked:
- Returns `rows[0]`
- BUT `rows[0]` might be post 1, NOT the header
- This could cause unexpected focus jump

**Impact:** Low (header cloaking is rare) but the logic is conceptually wrong.

**Recommended Fix:**
```javascript
if (targetPostNumber === "header") {
  // Try to find header first
  const header = rows.find(r => r.classList.contains('topic-header-row'));
  if (header) return header;
  // If header cloaked, return first row (post 1) as proxy
  return rows[0] || null;
}
```

### BUG 2: Direction-Based Search Ignores Header Row

**The numeric search loops (lines 283-310) skip header rows:**
```javascript
for (const row of rows) {
  const pn = parseInt(row.dataset.postNumber, 10);
  if (isNaN(pn)) continue; // <-- SKIPS HEADER ROW!
  // ...
}
```

**Scenario:** Navigating UP from post 1 with direction=-1:
- Target is post 0 or some value before post 1
- Loop skips header row because `parseInt(undefined, 10)` returns `NaN`
- Never considers header row as valid proxy

**Impact:** When navigating backward and no numeric post found, falls through to:
```javascript
if (!best && rows.length > 0) {
  best = direction > 0 ? rows[rows.length - 1] : rows[0];
}
```
This DOES return `rows[0]` which might be header, but only by accident.

**Recommended Fix:** Add explicit header handling in directional search.

---

## 3. getActiveRowIndex() Analysis (Lines 346-436)

### Header Special Case (Lines 356-360)
```javascript
if (this.activeRowId === "header") {
  // Header should always be visible, but fallback to 0
  console.log(`[A11Y-NAV] getActiveRowIndex: header cloaked? returning 0`);
  return 0;
}
```

### Assessment: ASSUMPTION ISSUES

### BUG 3: Assumes Header is Always Index 0

**Scenario:** If `activeRowId === "header"` but the header row IS present in the array at a different index (highly unusual but theoretically possible with DOM mutations):
- Returns `0` blindly
- Could focus wrong row

**Impact:** Very low - header is almost always first. But the code should use `findRowIndexByIdWithArray()` first.

**Note:** The preceding code at line 350-353 DOES try to find by ID first:
```javascript
const index = this.findRowIndexByIdWithArray(rowsArray, this.activeRowId);
if (index !== -1) {
  return index;
}
```
So this only triggers if header ISN'T found, which means it's either cloaked or missing. Returning `0` is reasonable fallback.

**Verdict:** Acceptable behavior.

### BUG 4: parseInt on "header" Returns NaN (Line 361)

```javascript
const targetPostNumber = parseInt(this.activeRowId, 10);
if (isNaN(targetPostNumber)) {
  console.log(`[A11Y-NAV] getActiveRowIndex: invalid activeRowId=${this.activeRowId}, returning 0`);
  return 0;
}
```

**Flow:**
1. `activeRowId === "header"`
2. Line 356 catches this FIRST (before parseInt)
3. Returns 0
4. Never reaches line 361

**Verdict:** **Correct** - the header special case at line 356 prevents reaching the parseInt code.

### BUG 5: Directional Fallback Ignores Header

**Lines 375-414 (UP and DOWN fallback search):**
```javascript
for (let i = 0; i < rowsArray.length; i++) {
  const rowId = this.getRowId(rowsArray[i]);
  if (rowId === "header") {
    continue; // <-- EXPLICITLY SKIPS HEADER
  }
  const postNumber = parseInt(rowId, 10);
  // ...
}
```

**Scenario:** Navigating UP from post 1 when post 1 is cloaked:
- `activeRowId = "1"` (post 1)
- Post 1 not found (cloaked)
- Direction is -1 (up)
- Searches for posts with `postNumber <= 1`
- **Explicitly skips header row!**
- If no other posts found, falls back to `bestIndex = 0`

**Impact:** The header is skipped in the search, but fallback to index 0 might still get header. This is inconsistent logic.

**Verdict:** **Potentially problematic** - header should be explicitly handled in UP navigation fallback.

---

## 4. focusNextRow() / focusPreviousRow() Analysis (Lines 687-743)

### focusNextRow() (Lines 687-714)

```javascript
focusNextRow() {
  const rows = this.rows;
  if (rows.length === 0) return;

  this._lastNavigationDirection = 1; // Down/forward

  const currentRow = this.findRowByPostNumber(rows, this.activeRowId);

  if (currentRow) {
    const currentIndex = rows.indexOf(currentRow);
    const nextIndex = currentIndex + 1;
    if (nextIndex < rows.length) {
      this.focusRowByElement(rows[nextIndex]);
    }
  } else {
    // Current row is cloaked
    const proxy = this.findProxyRow(rows, this.activeRowId, 1);
    if (proxy) {
      this.focusRowByElement(proxy);
    }
  }
}
```

### Assessment: CORRECT FOR HEADER

**Scenario:** Header row is focused, press Down:
1. `activeRowId = "header"`
2. `findRowByPostNumber(rows, "header")` finds header row
3. `rows.indexOf(currentRow)` returns 0 (header is first)
4. `nextIndex = 1` (post 1)
5. Focuses `rows[1]` = post 1

**Verdict:** **Correct behavior**

### focusPreviousRow() (Lines 716-743)

```javascript
focusPreviousRow() {
  const rows = this.rows;
  if (rows.length === 0) return;

  this._lastNavigationDirection = -1; // Up/backward

  const currentRow = this.findRowByPostNumber(rows, this.activeRowId);

  if (currentRow) {
    const currentIndex = rows.indexOf(currentRow);
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      this.focusRowByElement(rows[prevIndex]);
    }
  } else {
    // Current row is cloaked
    const proxy = this.findProxyRow(rows, this.activeRowId, -1);
    if (proxy) {
      this.focusRowByElement(proxy);
    }
  }
}
```

### Assessment: CORRECT FOR HEADER

**Scenario A:** At header row, press Up:
1. `activeRowId = "header"`
2. `findRowByPostNumber` finds header
3. `currentIndex = 0`
4. `prevIndex = -1`
5. `prevIndex >= 0` is FALSE
6. Does nothing (correct - can't go above header)

**Scenario B:** At post 1, press Up:
1. `activeRowId = "1"`
2. `findRowByPostNumber` finds post 1
3. `currentIndex = 1`
4. `prevIndex = 0`
5. Focuses `rows[0]` = header

**Verdict:** **Correct behavior**

### POTENTIAL ISSUE: Cloaked Post Navigation to Header

**Scenario:** At post 1, post 1 gets cloaked, press Up:
1. `activeRowId = "1"`
2. `findRowByPostNumber` returns `null` (post 1 cloaked)
3. Calls `findProxyRow(rows, "1", -1)`
4. In `findProxyRow`, searches for posts with `pn <= 1`
5. **Header row is skipped** (as noted in Bug 2)
6. If no posts <= 1 found, returns `rows[0]`
7. `rows[0]` might be header (if visible) or post 2+ (if header also cloaked)

**Impact:** Inconsistent behavior - sometimes gets header, sometimes doesn't.

---

## 5. Summary of Issues

### Critical Issues (May Cause Focus Jumping)

| Issue | Location | Description | Severity |
|-------|----------|-------------|----------|
| BUG 2 | findProxyRow lines 283-310 | Direction search ignores header row | Medium |
| BUG 5 | getActiveRowIndex lines 375-414 | Directional fallback explicitly skips header | Medium |

### Minor Issues (Edge Cases)

| Issue | Location | Description | Severity |
|-------|----------|-------------|----------|
| BUG 1 | findProxyRow line 271-272 | Header cloaked returns rows[0] blindly | Low |
| BUG 3 | getActiveRowIndex line 359 | Assumes header always at index 0 | Very Low |

### Confirmed Correct

| Function | Assessment |
|----------|------------|
| findRowByPostNumber() | Correct - uses class lookup |
| focusNextRow() | Correct - properly navigates from header |
| focusPreviousRow() | Correct - properly navigates to header |
| getActiveRowIndex() header check | Correct - catches header before parseInt |

---

## 6. Recommended Fixes

### Fix for BUG 2 & BUG 5: Header-Aware Directional Search

Modify `findProxyRow` to explicitly consider header when navigating backward:

```javascript
findProxyRow(rows, targetPostNumber, direction) {
  // Special case: looking for header
  if (targetPostNumber === "header") {
    const header = rows.find(r => r.classList.contains('topic-header-row'));
    return header || rows[0] || null;
  }

  const target = parseInt(targetPostNumber, 10);
  if (isNaN(target)) {
    return rows[0] || null;
  }

  let best = null;
  let bestDistance = Infinity;

  for (const row of rows) {
    // NEW: Consider header row when navigating UP
    if (row.classList.contains('topic-header-row')) {
      if (direction < 0) {
        // Going UP - header is always before any post
        // Use it as fallback if nothing better found
        if (!best) best = row;
      }
      continue;
    }

    const pn = parseInt(row.dataset.postNumber, 10);
    if (isNaN(pn)) continue;

    if (direction > 0 && pn >= target) {
      const dist = pn - target;
      if (dist < bestDistance) {
        bestDistance = dist;
        best = row;
      }
    } else if (direction < 0 && pn <= target) {
      const dist = target - pn;
      if (dist < bestDistance) {
        bestDistance = dist;
        best = row;
      }
    }
  }

  if (!best && rows.length > 0) {
    best = direction > 0 ? rows[rows.length - 1] : rows[0];
  }

  return best;
}
```

### Fix for getActiveRowIndex directional fallback:

Similar change - when direction is -1 (UP), consider header as valid target:

```javascript
// In UP direction fallback
if (direction < 0) {
  // First, check if header row is in the array
  const headerIndex = rowsArray.findIndex(r =>
    r.classList.contains('topic-header-row')
  );
  if (headerIndex !== -1 && targetPostNumber <= 1) {
    // Target is post 1 or lower, header is valid fallback
    return headerIndex;
  }

  // ... rest of existing logic
}
```

---

## 7. Test Scenarios to Verify

1. **From header, press Down** - Should focus post 1
2. **From post 1, press Up** - Should focus header
3. **From post 1, press Up when post 1 cloaked** - Should focus header or nearest visible
4. **From header, press Up** - Should do nothing (at boundary)
5. **Press Home from any post** - Should focus header (first row)
6. **Header cloaked (unusual), press Down from post 2** - Verify no crash

---

## 8. Conclusion

The header row handling is **mostly correct** for normal navigation flows. The main issues occur in **edge cases involving cloaking** where the directional proxy/fallback logic explicitly or implicitly skips header rows. These could cause unexpected focus jumps if:

1. User navigates UP while near the top of a topic
2. Cloaking events fire during navigation
3. The system tries to find a proxy row but ignores header

The fixes above add explicit header awareness to the directional search logic.
