import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 1050 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      APP_ORIGIN: "http://localhost:3100",
      DEMO_MODE: "auto",
      COMMAND_CENTER_DATA_DIR: `/tmp/action-systems-e2e-${process.pid}`,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      OPENAI_API_KEY: "",
      ACTION_SYSTEMS_OPENAI_API_KEY: "",
    },
  },
});
