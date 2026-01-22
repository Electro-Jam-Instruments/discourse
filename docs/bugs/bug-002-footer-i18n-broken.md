# Bug 002: Footer Shows Raw i18n Key

**Status:** Open
**Priority:** High
**Category:** i18n / Localization

## Problem

The footer displays the raw i18n key `[en.topics.bottom.latest]` instead of the translated text.

## Expected Behavior

Footer should display the proper translated string (e.g., "There are no more latest topics").

## Steps to Reproduce

1. Navigate to the topic list
2. Scroll to bottom of page
3. Observe footer text shows `[en.topics.bottom.latest]`

## Possible Causes

1. Missing i18n key in `config/locales/client.en.yml`
2. Key path mismatch between template and locale file
3. i18n helper not processing the key correctly
4. Custom theme/component overriding footer template incorrectly

## Files to Check

- `config/locales/client.en.yml` - verify key exists
- Footer component/template
- Any custom theme overrides

## Fix

Ensure the i18n key `topics.bottom.latest` exists and is properly referenced in the footer template.
