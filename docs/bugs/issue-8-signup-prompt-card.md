# Issue #8: Signup Prompt Card Accessibility

**GitHub:** https://github.com/Electro-Jam-Instruments/discourse/issues/8
**Status:** Ready to implement

## Problem

Signup prompt card doesn't announce all content when focused by screen readers.

## Component

**`frontend/discourse/app/components/signup-cta.gjs`**

## Current Structure (line 34-60)

```html
<div class="signup-cta alert alert-info">
  <h3>{{i18n "signup_cta.intro"}}</h3>
  <p>{{i18n "signup_cta.value_prop"}}</p>
  <div class="buttons">
    <DButton ... />  <!-- Sign Up -->
    <DButton ... />  <!-- Maybe later -->
    <DButton ... />  <!-- No thanks -->
  </div>
</div>
```

## Fix

```html
<div
  class="signup-cta alert alert-info"
  role="region"
  aria-labelledby="signup-cta-heading"
  tabindex="0"
>
  <h3 id="signup-cta-heading">{{i18n "signup_cta.intro"}}</h3>
  <p>{{i18n "signup_cta.value_prop"}}</p>
  <div class="buttons" role="toolbar" aria-label={{i18n "signup_cta.actions"}}>
    <DButton ... tabindex="-1" />
    <DButton ... tabindex="-1" />
    <DButton ... tabindex="-1" />
  </div>
</div>
```

## Changes

1. Add `role="region"` to outer div
2. Add `aria-labelledby="signup-cta-heading"` linking to h3
3. Add `tabindex="0"` to make region focusable
4. Optionally: Add toolbar pattern for buttons

## i18n (if using toolbar)

```yaml
signup_cta:
  actions: "Signup options"
```
