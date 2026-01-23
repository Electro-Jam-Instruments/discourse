/**
 * Custom ESLint rules for ElectroJam Discourse
 *
 * These rules enforce coding standards learned from debugging sessions,
 * particularly around accessibility and race condition handling.
 */

const noTimingHacks = require("./no-timing-hacks");

module.exports = {
  rules: {
    "no-timing-hacks": noTimingHacks,
  },
};
