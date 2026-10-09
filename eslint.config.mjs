import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

const config = [
  { ignores: [".next/**", ".e2e/**", "artifacts/**", "coverage/**", "node_modules/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Preserve the existing application's lint baseline while making the check runnable in CI.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "prefer-const": "off",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default config;
