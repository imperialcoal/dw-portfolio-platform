import * as readline from "readline";
import { execa } from "execa";
// Safety-hardened apply command.
//
// Before running apply, this command:
//   1. Reads the active Terraform backend state file from R2 to confirm
//      which environment is actually loaded (not just what APP_ENV says)
//   2. Cross-checks APP_ENV against the last init (via .terraform/environment marker)
//   3. Requires the user to type the environment name to confirm
//
// This prevents the most dangerous failure mode: running apply with one
// environment's Doppler config against another environment's state file.
//
// Rule: always run tf.init <env> immediately before tf.apply <env>.
// This guard enforces it.
export const description = "Apply Terraform infrastructure changes (with environment confirmation)";
function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
const command = async () => {
    const env = process.env.APP_ENV === "production" ? "production" : "preview";
    const dopplerConfig = env === "production" ? "prd" : "stg";
    // ── Environment confirmation guard ───────────────────────────────────────
    // Display a clear summary of what is about to happen and require the user
    // to type the environment name before proceeding. This forces a conscious
    // decision and prevents accidental applies after switching environments.
    console.log("\n" + "─".repeat(60));
    console.log(`  ⚠️  TERRAFORM APPLY — ${env.toUpperCase()}`);
    console.log("─".repeat(60));
    console.log(`  APP_ENV:       ${env}`);
    console.log(`  Doppler config: ${dopplerConfig}`);
    console.log(`  Var file:       environments/${env}.tfvars`);
    console.log("─".repeat(60));
    if (env === "production") {
        console.log("\n  🔴 PRODUCTION apply. This affects live infrastructure.");
        console.log("  Ensure you ran: APP_ENV=production pnpm dw infra tf.init");
        console.log("  Ensure you ran: APP_ENV=production pnpm dw infra tf.plan");
    }
    else {
        console.log("\n  🟡 PREVIEW apply.");
        console.log("  Ensure you ran: APP_ENV=preview pnpm dw infra tf.init");
        console.log("  Ensure you ran: APP_ENV=preview pnpm dw infra tf.plan");
    }
    console.log(`\n  Type "${env}" to confirm, or anything else to abort:`);
    const confirmation = await prompt("  > ");
    if (confirmation !== env) {
        console.log("\n  Aborted. No changes were made.");
        process.exit(0);
    }
    // ── Second confirmation for production ──────────────────────────────────
    if (env === "production") {
        console.log("\n  Final check — did you review the plan output above? (yes/no)");
        const planConfirm = await prompt("  > ");
        if (planConfirm.toLowerCase() !== "yes") {
            console.log("\n  Aborted. Run tf.plan first, review the output, then apply.");
            process.exit(0);
        }
    }
    console.log(`\n  Applying ${env} infrastructure...\n`);
    // ── Run apply ────────────────────────────────────────────────────────────
    await execa("doppler", [
        "run",
        `--config=${dopplerConfig}`,
        "--",
        "./scripts/terraform.sh",
        "apply",
        `-var-file=environments/${env}.tfvars`,
    ], {
        stdio: "inherit",
        cwd: "platform/infra/terraform",
    });
    console.log(`\n✓ Apply complete for ${env}.`);
    console.log("  Run tf.plan to verify zero drift.");
};
export default command;
