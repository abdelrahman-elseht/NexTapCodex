import { FlatCompat } from "@eslint/eslintrc";
import boundaries from "eslint-plugin-boundaries";
import path from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

const config = [
  { ignores: [".next/**", ".next-*/**", ".e2e/**", ".stryker-tmp/**", "artifacts/**", "coverage/**", "node_modules/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: { boundaries },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        { type: "component", pattern: "src/components/**" },
        { type: "domain", pattern: "src/lib/**" },
        { type: "test", pattern: "tests/**" },
      ],
      "boundaries/files": [
        { pattern: "src/lib/auth/**", category: "privileged" },
        { pattern: "src/lib/config/**", category: "privileged" },
        { pattern: "src/lib/supabase/server.ts", category: "privileged" },
        { pattern: "src/lib/supabase/proxy.ts", category: "privileged" },
        { pattern: "src/lib/media/store.ts", category: "privileged" },
      ],
    },
    rules: {
      "boundaries/dependencies": ["error", {
        default: "allow",
        policies: [
          {
            from: { element: { type: "domain" } },
            disallow: { to: { element: { types: ["app", "component"] } } },
            message: "Domain modules do not depend on routes or presentation components.",
          },
          {
            from: { element: { type: "component" } },
            disallow: { to: { element: { type: "app" } } },
            message: "Components do not import route modules.",
          },
          {
            from: { element: { type: "component" } },
            disallow: { to: { file: { categories: "privileged" } } },
            message: "Components do not import owner, server-client, environment or media-storage modules.",
          },
        ],
      }],
    },
  },
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
