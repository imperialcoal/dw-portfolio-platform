import { execa } from "execa";
export async function turbo(task, options = {}) {
    const args = ["turbo", "run", task];
    if (options.filter) {
        args.push(`--filter=${options.filter}`);
    }
    return execa("pnpm", args, {
        stdio: "inherit",
    });
}
