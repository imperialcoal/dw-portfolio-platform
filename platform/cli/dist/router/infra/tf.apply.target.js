import { execa } from "execa";
import { prompt } from "../../utils/prompt.js";
import { PRESETS, RESOURCES as TARGETS } from "./tf.resources.js";
// Usage examples:
//   APP_ENV=production pnpm dw infra tf.apply.target
//   → interactive menu: select one or more resources to target
//
// Runs: terraform apply -target=<addr> [-target=<addr> ...] -var-file=environments/<env>.tfvars
// Only the selected resources (and their dependencies) are created/updated.
// All other managed resources are untouched.
export const description = "Apply Terraform changes for specific resources only (targeted apply)";
const command = async () => {
    const env = process.env.APP_ENV === "production" ? "production" : "preview";
    const dopplerConfig = env === "production" ? "prd" : "stg";
    console.log(`\nTerraform Targeted Apply — ${env}`);
    console.log("─".repeat(50));
    console.log("Only the selected resources will be created/updated.\n");
    // ── Show individual resources ──────────────────────────────────────────
    const keys = Object.keys(TARGETS);
    keys.forEach((key, i) => {
        console.log(`  ${String(i + 1).padStart(2)}. ${key}`);
    });
    // ── Show presets ────────────────────────────────────────────────────────
    const presetKeys = Object.keys(PRESETS);
    if (presetKeys.length > 0) {
        console.log("\n  Presets (enter name to select group):");
        presetKeys.forEach((p) => {
            const presetItems = PRESETS[p] ?? [];
            console.log(`       ${p}  →  ${presetItems.join(", ")}`);
        });
    }
    console.log("\nEnter numbers (comma-separated) or a preset name.");
    const answer = await prompt("Selection: ");
    if (!answer) {
        console.error("No selection made — aborting.");
        process.exit(1);
    }
    // ── Resolve selection to target addresses ───────────────────────────────
    let selectedKeys = [];
    if (PRESETS[answer]) {
        const preset = PRESETS[answer] ?? [];
        selectedKeys = preset;
        console.log(`\nUsing preset "${answer}":`);
        selectedKeys.forEach((k) => console.log(`  • ${k}`));
    }
    else {
        const indices = answer.split(",").map((s) => Number(s.trim()) - 1);
        for (const idx of indices) {
            const key = keys[idx];
            if (key === undefined) {
                console.error(`Invalid selection: ${idx + 1}`);
                process.exit(1);
            }
            selectedKeys.push(key);
        }
    }
    const targetFlags = selectedKeys.map((k) => `-target=${TARGETS[k]}`);
    // ── Confirm before applying ─────────────────────────────────────────────
    console.log(`\nWill apply ${selectedKeys.length} resource(s):`);
    selectedKeys.forEach((k) => console.log(`  • ${TARGETS[k]}`));
    console.log(`  Environment: ${env} (Doppler config: ${dopplerConfig})\n`);
    const confirm = await prompt("Proceed? (yes/no): ");
    if (confirm.toLowerCase() !== "yes") {
        console.log("Aborted.");
        process.exit(0);
    }
    // ── Run targeted apply ───────────────────────────────────────────────────
    await execa("doppler", [
        "run",
        `--config=${dopplerConfig}`,
        "--",
        "./scripts/terraform.sh",
        "apply",
        `-var-file=environments/${env}.tfvars`,
        ...targetFlags,
    ], {
        stdio: "inherit",
        cwd: "platform/infra/terraform",
    });
    console.log(`\n✓ Targeted apply complete.`);
    console.log("  Run tf.plan to verify full state is clean after importing remaining resources.");
};
export default command;
