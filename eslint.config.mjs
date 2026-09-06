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
      "ember/template-no-capital-arguments": "off",
      "ember/template-require-button-type": "off",
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
      "**/node_modules/",
      "spec/",
      "frontend/discourse/dist/",
      "**/*.d.ts",
      "frontend/discourse-types/external-types",
      "frontend/discourse-types/dts-generator.{js,ts}",
      "tmp/",
      "eslint-rules/", // Don't lint the linting rules themselves
    ],
  },
  {
    files: ["themes/**/*.{js,gjs,ts,gts}"],
    languageOptions: {
      globals: {
        settings: "readonly",
        themePrefix: "readonly",
      },
    },
  },
  {
    languageOptions: {
      parserOptions: {
        babelOptions: {
          configFile: false,
        },
      },
    },
  },
];
