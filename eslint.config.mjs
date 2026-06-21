import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // The React Compiler strictness rules (eslint-plugin-react-hooks v6) flag
    // several patterns we use deliberately and correctly: reading the clock in
    // async Server Component renders (react-hooks/purity), the next-themes
    // mount guard, the useActionState "toast on result" effect, and syncing a
    // dialog form to its props on open (react-hooks/set-state-in-effect). These
    // are intentional, so we keep them as warnings rather than contort the code.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
