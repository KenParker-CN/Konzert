import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 曲库封面与专辑图都来自 IndexedDB 的 Blob URL，
      // next/image 的优化器无法处理，统一使用原生 <img>。
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tauri 侧由 cargo/clippy 负责检查。
    "src-tauri/**",
  ]),
]);

export default eslintConfig;

