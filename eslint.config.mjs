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
      electrojam: electroJamPlugin,
    },
    rules: {
      "ember/template-no-capital-arguments": "off",
      "ember/template-require-button-type": "off",
      // Custom ElectroJam rules
      // Set to "warn" initially so existing code doesn't break builds
      // Change to "error" once codebase is clean
      "electrojam/no-timing-hacks": [
        "warn",
        {
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
        },
      ],
    },
    // custom overrides go here
  },
  {
    // WAI-ARIA grid and tree implementations for keyboard navigation.
    //
    // These three rules cannot reason about the patterns in these files:
    //
    // - template-no-redundant-role: role="grid" on <table> is NOT redundant.
    //   A table's implicit role is "table"; "grid" is a different, interactive
    //   role, and dropping it collapses the grid keyboard navigation.
    // - template-require-context-role: gridcell/treeitem sit in child
    //   components while role="row"/role="tree" live in the parent, and
    //   topic-list/item sets role={{this.role}} dynamically, so the required
    //   ancestor can never be resolved statically.
    // - template-no-nested-interactive: grid cells and toolbars are *required*
    //   to contain links and buttons under the APG grid and toolbar patterns.
    //
    // See docs/accessibility/00-index.md for the patterns these implement.
    files: [
      "frontend/discourse/app/components/categories-only.gjs",
      "frontend/discourse/app/components/parent-category-row.gjs",
      "frontend/discourse/app/components/post.gjs",
      "frontend/discourse/app/components/post-stream/header-row.gjs",
      "frontend/discourse/app/components/post/small-action.gjs",
      "frontend/discourse/app/components/sidebar/section.gjs",
      "frontend/discourse/app/components/sidebar/section-link.gjs",
      "frontend/discourse/app/components/topic-list/header.gjs",
      "frontend/discourse/app/components/topic-list/item/*.gjs",
      "frontend/discourse/app/components/topic-list/latest-topic-list-item.gjs",
      "frontend/discourse/app/components/topic-list/list.gjs",
    ],
    rules: {
      "ember/template-no-redundant-role": "off",
      "ember/template-require-context-role": "off",
      "ember/template-no-nested-interactive": "off",
    },
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
