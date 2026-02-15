import DiscourseRecommended from "@discourse/lint-configs/eslint";
import { createRequire } from "module";

// Load custom rules
const require = createRequire(import.meta.url);
const customRules = require("./eslint-rules/index.js");

// Create plugin object for custom rules
const electroJamPlugin = {
  rules: customRules.rules,
};

export default [
  ...DiscourseRecommended,
  {
    plugins: {
      "electrojam": electroJamPlugin,
    },
    rules: {
      // Custom ElectroJam rules
      // Set to "warn" initially so existing code doesn't break builds
      // Change to "error" once codebase is clean
      "electrojam/no-timing-hacks": ["warn", {
        // Contexts where timing is legitimately needed
        allowedContexts: [
          "debounce",
          "throttle",
          "delay",
          "sleep",
          "waitFor",
          "poll",
          "retry",
          "animate",
          "transition",
          "scrollIntoView", // Legitimate for scroll animations
        ],
      }],
    },
    // custom overrides go here
  },
  {
    ignores: [
      "plugins/**/lib/javascripts/locale",
      "plugins/discourse-math/public",
      "public/",
      "vendor/",
      "frontend/discourse/tests/fixtures",
      "**/node_modules/",
      "spec/",
      "frontend/discourse/dist/",
      "tmp/",
      "eslint-rules/", // Don't lint the linting rules themselves
    ],
  },
  {
    files: ["themes/**/*.{js,gjs}"],
    languageOptions: {
      globals: {
        settings: "readonly",
        themePrefix: "readonly",
      },
    },
  },
];
