import fs from "node:fs/promises";
import os from "node:os";

const environment = {
  time: new Date().toISOString(),
  commit: process.env.GITHUB_SHA,
  runner: process.env.RUNNER_NAME,
  image: process.env.ImageOS,
  imageVersion: process.env.ImageVersion,
  platform: process.platform,
  architecture: process.arch,
  os: os.release(),
  node: process.version,
};
const json = JSON.stringify(environment, null, 2);
await fs.mkdir(".test-runs/ci", { recursive: true });
await fs.writeFile(".test-runs/ci/environment.json", json + "\n");
console.log(json);
if (process.env.GITHUB_STEP_SUMMARY)
  await fs.appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `### Build environment\n\n\`\`\`json\n${json}\n\`\`\`\n`,
  );
