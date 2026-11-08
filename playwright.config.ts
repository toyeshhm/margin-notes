import { defineConfig, devices } from "@playwright/test";

// ponytail: declared here rather than adding @types/node for one variable.
declare const process: { env: Partial<Record<string, string>> };

const LOCAL = "http://localhost:4173";
// PLAYTEST_URL=<live link> runs the playtests against a deployment, where api/ works.
const target = process.env["PLAYTEST_URL"];

export default defineConfig({
  testDir: "tests",
  ...(target === undefined && {
    webServer: { command: "npm run preview", url: LOCAL, reuseExistingServer: false },
  }),
  use: { baseURL: target ?? LOCAL },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
});
