import { execa } from "execa";

import type { CLICommand } from "../../types/command.js";
import { createPrompter } from "../../utils/prompt.js";
import {
  DOPPLER_SECRET_IDS,
  ENVIRONMENT_RESOURCES,
  KNOWN_RESOURCE_IDS,
  RESOURCE_ID_HINTS,
  RESOURCES,
} from "./tf.resources.js";

function isAlreadyManagedMessage(text: string): boolean {
  return text.includes("already managed") || text.includes("already exists");
}

// Thrown when Terraform reports the resource is already in state. Distinct
// from a real Error so callers can tell "this is fine, skip it" apart from
// "something is actually wrong" without re-parsing message text.
class AlreadyManagedError extends Error {}

async function importResource(
  dopplerConfig: string,
  env: string,
  address: string,
  id: string,
): Promise<void> {
  console.log(`\nImporting ${address}...`);
  const result = await execa(
    "doppler",
    [
      "run",
      `--config=${dopplerConfig}`,
      "--",
      "./scripts/terraform.sh",
      "import",
      `-var-file=environments/${env}.tfvars`,
      address,
      id,
    ],
    {
      cwd: "platform/infra/terraform",
      reject: false,
    },
  );
  const combined = `${result.stdout}\n${result.stderr}`;

  if (result.exitCode === 0) {
    if (result.stdout) process.stdout.write(`${result.stdout}\n`);
    return;
  }

  if (isAlreadyManagedMessage(combined)) {
    // Not a real failure — skip the noisy Terraform error box entirely,
    // the caller prints its own one-line summary instead.
    throw new AlreadyManagedError(combined);
  }

  // A genuine failure — show real Terraform output, it's needed to debug.
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  throw new Error(combined);
}

const command: CLICommand = async () => {
  const env = process.env.APP_ENV === "production" ? "production" : "preview";
  const dopplerConfig = env === "production" ? "prd" : "stg";
  const resources = ENVIRONMENT_RESOURCES[env];
  const { ask, close } = createPrompter();

  if (!resources) {
    console.error(`No resources defined for environment: ${env}`);
    process.exit(1);
  }

  console.log(`\nTerraform Import — ${env} environment`);
  console.log("─".repeat(50));
  console.log("Doppler secrets are imported automatically.");
  console.log("You will be prompted for each resource ID.");
  console.log("Press Enter to skip a resource already imported.\n");

  for (const key of resources) {
    const address = RESOURCES[key];
    const autoIdFn = DOPPLER_SECRET_IDS[key];

    // Doppler secrets have deterministic IDs — no prompt needed
    if (autoIdFn) {
      const id = autoIdFn(dopplerConfig);
      console.log(`\nAuto-importing ${key}...`);
      try {
        await importResource(dopplerConfig, env, address, id);
        console.log(`✓ ${key} imported`);
      } catch (error) {
        if (error instanceof AlreadyManagedError) {
          console.log(`  ✓ ${key} already in state — skipping`);
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(`  ✗ ${key} failed: ${message}`);
          const retry = await ask("Continue with remaining resources? (y/n): ");
          if (retry.toLowerCase() !== "y") {
            process.exit(1);
          }
        }
      }
      continue;
    }

    // Infrastructure resources require manual ID entry.
    // Print the format hint and pre-filled ID (if known) before prompting.
    const hint = RESOURCE_ID_HINTS[key];
    const rawKnownId = KNOWN_RESOURCE_IDS[key];
    const knownId =
      typeof rawKnownId === "function" ? rawKnownId(env) : rawKnownId;

    if (hint) {
      console.log(`\n  ℹ ${key}: ${hint}`);
    }
    if (knownId) {
      console.log(`  ✦ Known ID: ${knownId}`);
    }

    const promptText = knownId
      ? `ID for ${key} (Enter to use known ID, or paste to override): `
      : `ID for ${key} (Enter to skip): `;

    const input = await ask(promptText);
    const id = (input || knownId) ?? "";

    if (!id) {
      console.log(`Skipping ${key}`);
      continue;
    }

    try {
      await importResource(dopplerConfig, env, address, id);
      console.log(`✓ ${key} imported successfully`);
    } catch (error) {
      if (error instanceof AlreadyManagedError) {
        console.log(`  ✓ ${key} already in state — skipping`);
      } else {
        console.error(`✗ Failed to import ${key}. Check the ID and try again.`);
        const retry = await ask("Continue with remaining resources? (y/n): ");
        if (retry.toLowerCase() !== "y") {
          process.exit(1);
        }
      }
    }
  }
  close();
  console.log("\n✓ Import complete. Run tf.plan to verify zero drift.");
};

export default command;
