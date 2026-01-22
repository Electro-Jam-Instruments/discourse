# Bug #21: Repeated Login Error Not Announced by Screen Reader

**GitHub Issue:** https://github.com/Electro-Jam-Instruments/discourse/issues/21
**Status:** Open
**Labels:** accessibility, bug

## Description
When a user enters an incorrect password on the login form, the error message "Incorrect username, email or password" is announced by screen readers the first time. However, if the user tries again with another incorrect password, the error is NOT announced because the text content hasn't changed.

## Steps to Reproduce
1. Navigate to the login page
2. Enter a valid username but incorrect password
3. Press "Log In" button
4. Screen reader announces "Incorrect username, email or password" (PASS)
5. Enter another incorrect password
6. Press "Log In" button again
7. Screen reader does NOT announce the error (FAIL)

## Expected Behavior
The error message should be announced every time a login attempt fails, even if the message text is the same.

## Root Cause
The live region (`aria-live="assertive"`) only announces changes to its content. When the same error message is displayed again, the DOM text doesn't change, so the screen reader doesn't announce it.

## Proposed Solution
Toggle the live region off and back to assertive to force re-announcement:

```javascript
// When showing error:
errorElement.setAttribute('aria-live', 'off');
// Force reflow
void errorElement.offsetWidth;
errorElement.setAttribute('aria-live', 'assertive');
```

Or alternatively, briefly clear and re-set the error text:
```javascript
errorElement.textContent = '';
requestAnimationFrame(() => {
  errorElement.textContent = errorMessage;
});
```

## Scope
This issue may affect all alert banners that can show the same error message repeatedly, not just the login form.

## Environment
- Discourse fork with accessibility branch
- Test site: community.electro-jam.com

## Screenshot
Login error banner showing "Incorrect username, email or password" message.
