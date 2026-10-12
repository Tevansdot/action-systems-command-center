import chromium from "@sparticuz/chromium";
import { spawnSync } from "node:child_process";
// The npm-distributed browser is covered by package-lock integrity checks.
// No separate CDN download is needed in restricted cloud environments.
const executable =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (await chromium.executablePath());
const result = spawnSync(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_CHROMIUM_EXECUTABLE: executable },
  },
);
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
