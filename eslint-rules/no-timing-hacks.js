/**
 * ESLint rule: no-timing-hacks
 *
 * Detects timing-based solutions that are often band-aids for race conditions.
 * These patterns mask the real problem instead of fixing it.
 *
 * BAD patterns detected:
 * - setTimeout with hardcoded delays for "fixing" async issues
 * - Variables ending in _MS, _DELAY, _TIMEOUT used as guards
 * - Comments mentioning "wait", "delay", "timing" near setTimeout
 *
 * GOOD alternatives:
 * - State flags (e.g., _userHasInteracted)
 * - Event-based coordination
 * - Proper async/await patterns
 * - Checking actual state rather than waiting arbitrary time
 */

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow timing-based solutions that mask race conditions",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      noSetTimeoutDelay:
        "Avoid setTimeout with hardcoded delays to fix race conditions. Use state flags or event-based coordination instead.",
      noTimingVariable:
        "Variable name suggests timing-based fix ({{name}}). Consider using state flags instead of time-based guards.",
      noPerformanceNowGuard:
        "Using performance.now() for timing guards often masks race conditions. Consider state-based guards instead.",
      suspiciousTimingComment:
        "Comment suggests timing-based workaround. Consider if there's a state-based solution.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedContexts: {
            type: "array",
            items: { type: "string" },
            description: "Function names where timing is legitimately needed (e.g., debounce, throttle)",
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedContexts = options.allowedContexts || [
      "debounce",
      "throttle",
      "delay",
      "sleep",
      "waitFor",
      "poll",
      "retry",
      "animate",
      "transition",
    ];

    // Track if we're inside an allowed context
    let allowedContextStack = [];

    function isInAllowedContext() {
      return allowedContextStack.length > 0;
    }

    function isAllowedFunctionName(name) {
      if (!name) return false;
      const lowerName = name.toLowerCase();
      return allowedContexts.some((ctx) => lowerName.includes(ctx.toLowerCase()));
    }

    return {
      // Track function context
      FunctionDeclaration(node) {
        if (node.id && isAllowedFunctionName(node.id.name)) {
          allowedContextStack.push(node);
        }
      },
      "FunctionDeclaration:exit"(node) {
        if (allowedContextStack[allowedContextStack.length - 1] === node) {
          allowedContextStack.pop();
        }
      },

      // Track method definitions
      MethodDefinition(node) {
        if (node.key && isAllowedFunctionName(node.key.name)) {
          allowedContextStack.push(node);
        }
      },
      "MethodDefinition:exit"(node) {
        if (allowedContextStack[allowedContextStack.length - 1] === node) {
          allowedContextStack.pop();
        }
      },

      // Detect setTimeout with numeric literals
      CallExpression(node) {
        if (isInAllowedContext()) return;

        // Check for setTimeout(fn, <number>)
        if (
          node.callee.name === "setTimeout" &&
          node.arguments.length >= 2
        ) {
          const delayArg = node.arguments[1];

          // Direct numeric literal
          if (delayArg.type === "Literal" && typeof delayArg.value === "number") {
            // Allow 0 delays (used for deferring to next tick)
            if (delayArg.value > 0) {
              context.report({
                node,
                messageId: "noSetTimeoutDelay",
              });
            }
          }

          // Variable reference that might be a timing constant
          if (delayArg.type === "Identifier") {
            const name = delayArg.name;
            if (/_MS$|_DELAY$|_TIMEOUT$|GUARD_MS|DELAY_MS/i.test(name)) {
              context.report({
                node,
                messageId: "noSetTimeoutDelay",
              });
            }
          }
        }
      },

      // Detect timing-related variable declarations
      VariableDeclarator(node) {
        if (isInAllowedContext()) return;

        if (node.id && node.id.type === "Identifier") {
          const name = node.id.name;
          // Flag variables that look like timing guards
          if (/NAVIGATION_GUARD_MS|FOCUS_DELAY|TIMING_BUFFER|_MS$/i.test(name)) {
            // Check if it's assigned a number
            if (node.init && node.init.type === "Literal" && typeof node.init.value === "number") {
              context.report({
                node,
                messageId: "noTimingVariable",
                data: { name },
              });
            }
          }
        }
      },

      // Detect class property definitions with timing names
      PropertyDefinition(node) {
        if (isInAllowedContext()) return;

        if (node.key && node.key.type === "Identifier") {
          const name = node.key.name;
          if (/NAVIGATION_GUARD_MS|FOCUS_DELAY|TIMING_BUFFER|_MS$/i.test(name)) {
            if (node.value && node.value.type === "Literal" && typeof node.value.value === "number") {
              context.report({
                node,
                messageId: "noTimingVariable",
                data: { name },
              });
            }
          }
        }
      },

      // Detect performance.now() comparisons used as guards
      BinaryExpression(node) {
        if (isInAllowedContext()) return;

        // Look for patterns like: msSince < 300 or performance.now() - timestamp < GUARD_MS
        if (["<", ">", "<=", ">="].includes(node.operator)) {
          const hasPerformanceNow = (n) => {
            if (!n) return false;
            if (
              n.type === "CallExpression" &&
              n.callee.type === "MemberExpression" &&
              n.callee.object.name === "performance" &&
              n.callee.property.name === "now"
            ) {
              return true;
            }
            if (n.type === "BinaryExpression") {
              return hasPerformanceNow(n.left) || hasPerformanceNow(n.right);
            }
            return false;
          };

          // Check if one side involves performance.now() and the other is a number/timing variable
          if (hasPerformanceNow(node.left) || hasPerformanceNow(node.right)) {
            const otherSide = hasPerformanceNow(node.left) ? node.right : node.left;
            if (
              otherSide.type === "Literal" ||
              (otherSide.type === "Identifier" && /_MS$/i.test(otherSide.name))
            ) {
              context.report({
                node,
                messageId: "noPerformanceNowGuard",
              });
            }
          }
        }
      },
    };
  },
};
