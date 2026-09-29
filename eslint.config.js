import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Evita di passare variabili a hook (es. useServerPagination resetDeps)
      // prima della loro dichiarazione → causerebbe TS2448 e bug runtime.
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": ["error", {
        functions: false,
        classes: false,
        variables: true,
        enums: true,
        typedefs: false,
        ignoreTypeReferences: true,
      }],
    },
  },
);
