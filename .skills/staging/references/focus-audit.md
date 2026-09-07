# Focus audit

Finds every focusable control whose keyboard focus ring is missing or
suppressed, without needing to focus any of them.

## Why this exists

Three deploys went out fixing focus rings one screenshot at a time, because
each fix was scoped to the controls that happened to be reported. The audit
turns that into one measured pass.

It also removes two traps that produced wrong answers repeatedly:

- **Programmatic `.focus()` does not trigger `:focus-visible`.** Focusing an
  element from script and reading its computed style reports
  `outline-style: none` even when the rule is fine. Driving real Tab keypresses
  is unreliable too - focus lands on browser chrome or `<body>`.
- **`outline-style: auto` is the browser's own ring**, not ours. Chrome ignores
  `outline-color` when it is set, so a rule that only changes the colour
  appears to do nothing. A screenshot cannot tell a 2px ring from the 0.67px
  default.

This script sidesteps both by reading the CSSOM: it works out which rule
*would* win for each control, rather than focusing it and measuring.

## Run it

Paste into the browser console on the page under test.

```js
function focusAudit() {
  const SEL = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  const els = [...document.querySelectorAll(SEL)].filter(e => e.offsetParent !== null);
  const spec = s => {
    const id = (s.match(/#[\w-]+/g) || []).length;
    const cls = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)(?!focus-visible\b)[\w-]+(\([^)]*\))?/g) || []).length
              + (s.match(/:focus-visible/g) || []).length;
    const el = (s.replace(/[#.\[][^\s>+~,]*/g, '').match(/\b[a-z][\w-]*/gi) || []).length;
    return id * 10000 + cls * 100 + el;
  };
  const rules = [];
  for (const ss of document.styleSheets) {
    let rs; try { rs = ss.cssRules; } catch (e) { continue; }
    for (const r of rs) {
      if (!r.selectorText || !r.style) continue;
      const o = r.style.outline || r.style.outlineStyle;
      if (!o) continue;
      for (const part of r.selectorText.split(',')) rules.push({ sel: part.trim(), o, spec: spec(part) });
    }
  }
  const out = { total: els.length, ok: 0, suppressed: [], browserDefault: [] };
  for (const el of els) {
    let win = null;
    for (const r of rules) {
      let m = false;
      try { m = el.matches(r.sel.replace(/:focus-visible|:focus\b|:active/g, '')); } catch (e) {}
      if (m && (!win || r.spec >= win.spec)) win = r;
    }
    const label = {
      tag: el.tagName,
      cls: (el.className || '').toString().split(' ').slice(0, 2).join(' ').slice(0, 32),
      text: (el.textContent || '').trim().slice(0, 20)
    };
    if (!win) out.browserDefault.push(label);
    else if (/none|0(px)?$/.test(win.o.trim())) out.suppressed.push({ ...label, by: win.sel.slice(0, 60) });
    else out.ok++;
  }
  return out;
}
focusAudit();
```

## Reading the result

- `ok` - a real ring applies.
- `suppressed` - a rule sets `outline: none`. The `by` field names the selector
  responsible, which is what to fix.
- `browserDefault` - no rule matches at all, so the control falls back to the
  browser ring.

Anything other than `total === ok` is a finding.

## What it found on prod, 2026-09-07

38 focusable controls, **3 with a working ring**. The rest were suppressed by
core rules, all of the same shape - swap the ring for a background tint:

- `@mixin btn()` in `buttons.scss` had `outline: none` on `:focus-visible`.
  That mixin backs every button variant, so it removed the focus indicator from
  every button in the app, New Topic included.
- `.btn-flat` had the same.
- `.select-kit.single-select .select-kit-header:not(.btn):focus` in the
  Foundation theme, replaced with `background-color: var(--primary-100)`.
- `.topic-list .main-link .title:focus-visible`.
- The search input.

A background tint is not a focus indicator: on a filled button it barely
changes, and it fails WCAG 2.4.11. These are upstream defects, not regressions
in the accessibility work.

## Fix pattern

Remove the `outline: none` and keep the background treatment. The global
`:focus-visible` baseline in
`common/components/keyboard-navigation-focus.scss` then supplies the ring.

Where a rule has to stay - it genuinely wants no ring for mouse or expanded
states - add a sibling `:focus-visible` rule restoring the ring for keyboard
focus only, as done in the Foundation theme's `select-kit.scss`.

## Run this before claiming a focus fix works

Re-run the audit after any focus change. `total === ok` is the pass condition.
A screenshot is not evidence, and neither is measuring one control.
