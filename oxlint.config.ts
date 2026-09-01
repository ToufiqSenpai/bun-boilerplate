import { defineConfig } from "oxlint"

export default defineConfig({
  plugins: ["typescript", "react", "jsx-a11y", "vitest", "node"],
  categories: {},
  options: { typeAware: true },
  env: { builtin: true },
  ignorePatterns: [
    "dist/",
    "node_modules/",
    "coverage/",
    ".commandcode/",
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".continue/**",
    ".cursor/**",
    ".gemini/**",
    ".opencode/**",
    ".pi/**",
    ".roo/**",
    ".windsurf/**",
    "tools/oxlint/anti-slop/**"
  ],
  jsPlugins: [{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }],
  rules: {
    // anti-slop
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": "error",
    "anti-slop/no-shape-in-symbol-names": "off",
    "anti-slop/no-unknown-parameters": "off",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",

    // eslint - correctness
    "no-unused-expressions": "error",
    "no-unused-vars": [
      "warn",
      {
        args: "after-used",
        argsIgnorePattern: "^_",
        caughtErrors: "none",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
        vars: "all",
        varsIgnorePattern: "^_"
      }
    ],

    // eslint - pedantic
    eqeqeq: "error",
    "no-array-constructor": "error",

    // eslint - style
    "default-param-last": "error",
    "object-shorthand": ["error", "always"],

    // eslint - restriction
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["node:*"],
            message: 'Use bare specifier without "node:" prefix (e.g. "fs" instead of "node:fs").'
          }
        ]
      }
    ],

    // node - restriction
    "node/no-path-concat": "error",

    // typescript - correctness
    "typescript/await-thenable": "error",
    "typescript/no-array-delete": "error",
    "typescript/no-base-to-string": "error",
    "typescript/no-duplicate-enum-values": "error",
    "typescript/no-duplicate-type-constituents": "error",
    "typescript/no-extra-non-null-assertion": "error",
    "typescript/no-floating-promises": "warn",
    "typescript/no-for-in-array": "error",
    "typescript/no-implied-eval": "error",
    "typescript/no-meaningless-void-operator": "error",
    "typescript/no-misused-new": "error",
    "typescript/no-misused-spread": "error",
    "typescript/no-non-null-asserted-optional-chain": "error",
    "typescript/no-redundant-type-constituents": "error",
    "typescript/no-this-alias": "error",
    "typescript/no-unnecessary-parameter-property-assignment": "error",
    "typescript/no-unsafe-declaration-merging": "error",
    "typescript/no-unsafe-unary-minus": "error",
    "typescript/no-useless-default-assignment": "error",
    "typescript/no-useless-empty-export": "error",
    "typescript/no-wrapper-object-types": "error",
    "typescript/prefer-as-const": "error",
    "typescript/prefer-namespace-keyword": "error",
    "typescript/require-array-sort-compare": "error",
    "typescript/restrict-template-expressions": "error",
    "typescript/triple-slash-reference": "error",
    "typescript/unbound-method": "error",

    // typescript - style
    "typescript/adjacent-overload-signatures": "error",
    "typescript/array-type": "error",
    "typescript/ban-tslint-comment": "error",
    "typescript/class-literal-property-style": "error",
    "typescript/consistent-generic-constructors": ["error", "constructor"],
    "typescript/consistent-indexed-object-style": ["error", "record"],
    "typescript/consistent-type-assertions": [
      "error",
      {
        assertionStyle: "as",
        objectLiteralTypeAssertions: "allow"
      }
    ],
    "typescript/consistent-type-definitions": ["error", "interface"],
    "typescript/consistent-type-exports": "error",
    "typescript/no-inferrable-types": "error",
    "typescript/no-unnecessary-qualifier": "error",
    "typescript/prefer-for-of": "error",
    "typescript/prefer-function-type": "error",

    // typescript - pedantic
    "typescript/ban-ts-comment": "error",
    "typescript/no-confusing-void-expression": "error",
    "typescript/no-mixed-enums": "error",
    "typescript/no-unsafe-function-type": "error",

    // typescript - suspicious
    "typescript/no-confusing-non-null-assertion": "error",
    "typescript/no-unnecessary-template-expression": "error",
    "typescript/no-unnecessary-type-assertion": "error",
    "typescript/no-unnecessary-type-constraint": "error",
    "typescript/no-unnecessary-type-conversion": "error",
    "typescript/no-unsafe-enum-comparison": "error",

    // typescript - restriction
    "typescript/explicit-member-accessibility": "error",
    "typescript/no-empty-object-type": "error",
    "typescript/no-explicit-any": "warn",
    "typescript/no-import-type-side-effects": "error",
    "typescript/no-require-imports": "error",

    // typescript - nursery
    "typescript/no-unnecessary-condition": [
      "error",
      {
        allowConstantLoopConditions: true
      }
    ]
  },
  overrides: [
    {
      files: ["packages/web/src/**"],
      rules: {
        // react - suspicious
        "react/capitalized-calls": "error",
        "react/exhaustive-effect-dependencies": "error",
        "react/hooks": "error",
        "react/iframe-missing-sandbox": "error",
        "react/jsx-no-comment-textnodes": "error",
        "react/jsx-no-script-url": "error",
        "react/memo-dependencies": "error",
        "react/no-namespace": "error",
        "react/no-unstable-nested-components": "error",
        "react/react-in-jsx-scope": "off",
        "react/style-prop-object": "error",

        // jsx-a11y - correctness
        "jsx-a11y/alt-text": "error",
        "jsx-a11y/anchor-has-content": "error",
        "jsx-a11y/anchor-is-valid": "error",
        "jsx-a11y/aria-activedescendant-has-tabindex": "error",
        "jsx-a11y/aria-props": "error",
        "jsx-a11y/aria-proptypes": "error",
        "jsx-a11y/aria-role": "error",
        "jsx-a11y/aria-unsupported-elements": "error",
        "jsx-a11y/autocomplete-valid": "error",
        "jsx-a11y/click-events-have-key-events": "error",
        "jsx-a11y/control-has-associated-label": "error",
        "jsx-a11y/heading-has-content": "error",
        "jsx-a11y/html-has-lang": "error",
        "jsx-a11y/iframe-has-title": "error",
        "jsx-a11y/img-redundant-alt": "error",
        "jsx-a11y/interactive-supports-focus": "error",
        "jsx-a11y/label-has-associated-control": "error",
        "jsx-a11y/lang": "error",
        "jsx-a11y/media-has-caption": "error",
        "jsx-a11y/mouse-events-have-key-events": "error",
        "jsx-a11y/no-access-key": "error",
        "jsx-a11y/no-aria-hidden-on-focusable": "error",
        "jsx-a11y/no-autofocus": "error",
        "jsx-a11y/no-distracting-elements": "error",
        "jsx-a11y/no-interactive-element-to-noninteractive-role": "error",
        "jsx-a11y/no-noninteractive-element-interactions": "error",
        "jsx-a11y/no-noninteractive-element-to-interactive-role": "error",
        "jsx-a11y/no-noninteractive-tabindex": "error",
        "jsx-a11y/no-redundant-roles": "error",
        "jsx-a11y/no-static-element-interactions": "error",
        "jsx-a11y/prefer-tag-over-role": "error",
        "jsx-a11y/role-has-required-aria-props": "error",
        "jsx-a11y/role-supports-aria-props": "error",
        "jsx-a11y/scope": "error",
        "jsx-a11y/tabindex-no-positive": "error",

        // jsx-a11y - restriction
        "jsx-a11y/anchor-ambiguous-text": "error"
      }
    },
    {
      // Vendored shadcn/Base UI components: keep upstream patterns intact.
      files: ["packages/web/src/components/ui/**"],
      rules: {
        // setState updater discrimination and string|object prop APIs in upstream code.
        "anti-slop/no-runtime-typeof": "off",
        // Generic Label/FieldGroup primitives wire htmlFor/role via props spread.
        "jsx-a11y/label-has-associated-control": "off",
        "jsx-a11y/prefer-tag-over-role": "off",
        // InputGroupAddon upstream wires onClick on role="group" as a mouse-only focus convenience; keyboard users reach the control via Tab.
        "jsx-a11y/click-events-have-key-events": "off",
        "jsx-a11y/no-noninteractive-element-interactions": "off"
      }
    },
    {
      files: ["packages/web/src/routes/**"],
      rules: {
        "react/only-export-components": "off"
      }
    },
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.e2e.ts"],
      rules: {
        "typescript/unbound-method": "off",

        // vitest - correctness
        "vitest/expect-expect": "error",
        "vitest/hoisted-apis-on-top": "error",
        "vitest/no-conditional-expect": "off",
        "vitest/no-conditional-tests": "error",
        "vitest/no-disabled-tests": "error",
        "vitest/no-focused-tests": "error",
        "vitest/no-standalone-expect": "error",
        "vitest/prefer-snapshot-hint": "error",
        "vitest/require-awaited-expect-poll": "error",
        "vitest/require-local-test-context-for-concurrent-snapshots": "error",
        "vitest/require-mock-type-parameters": "error",
        "vitest/require-to-throw-message": "error",
        "vitest/valid-describe-callback": "error",
        "vitest/valid-expect": "error",
        "vitest/valid-expect-in-promise": "error",
        "vitest/valid-title": "error",
        "vitest/warn-todo": "error",

        // vitest - style
        "vitest/no-importing-vitest-globals": "error"
      }
    }
  ]
})
