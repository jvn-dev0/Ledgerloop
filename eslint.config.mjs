import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".next-ledgerloop/**", ".next-build-check/**", ".test-build/**", ".agents/**", "out/**", "build/**", "next-env.d.ts"]),
]);
