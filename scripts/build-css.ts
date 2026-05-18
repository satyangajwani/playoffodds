// Regenerate src/web/styles.gen.ts from public/styles.css. Worker bundle has no fs access,
// so we transpile the CSS into a TS module that exports the text as a string constant.
// Re-run after editing public/styles.css.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..");
const cssPath = join(repoRoot, "public", "styles.css");
const outPath = join(repoRoot, "src", "web", "styles.gen.ts");

const css = readFileSync(cssPath, "utf8");
const out =
  "// Auto-generated from public/styles.css by scripts/build-css.ts.\n" +
  "// Do not edit by hand — re-run `npm run build:css` after editing the .css file.\n\n" +
  `export const styleSheetText = ${JSON.stringify(css)};\n`;
writeFileSync(outPath, out);
console.log(`[build:css] wrote ${outPath} (${css.length} chars)`);
