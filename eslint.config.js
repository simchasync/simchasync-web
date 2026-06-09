import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist", "dev-dist", "supabase/functions/**"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readonly",
      },
    },
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
      },
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/components/ui/**", "src/contexts/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["src/components/BookingRequests.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
];
