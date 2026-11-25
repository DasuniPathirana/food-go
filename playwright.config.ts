import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "phone-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build:web && npm run start --workspace @food-go/web -- --hostname 127.0.0.1 --port 3100",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      APP_ORIGIN: baseURL,
      NEXT_TELEMETRY_DISABLED: "1",
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      FOOD_GO_CATALOGUE_MODE: "supabase",
      FOOD_GO_AUTH_ENABLED: "false",
      FOOD_GO_AUTH_PRODUCTION_READY: "false",
      FOOD_GO_COMMUNITY_ENABLED: "false",
      FOOD_GO_EXPLORATION_ENABLED: "false",
      FOOD_GO_ENCOUNTERS_ENABLED: "false",
      FOOD_GO_PARTNER_ENABLED: "false",
      FOOD_GO_PHONE_AUTH_ENABLED: "false",
      FOOD_GO_SMS_ENABLED: "false",
    },
  },
});

