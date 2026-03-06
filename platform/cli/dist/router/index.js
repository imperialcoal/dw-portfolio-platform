import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
async function listDomains(routerDir) {
    return (await readdir(routerDir, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
}
async function listCommands(routerDir, domain) {
    const dir = path.join(routerDir, domain);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".js"));
    const commands = [];
    for (const file of files) {
        const cmdName = file.replace(".js", "");
        const modUnknown = await import(pathToFileURL(path.join(dir, file)).href);
        const mod = modUnknown;
        commands.push({
            name: cmdName,
            description: mod.description,
        });
    }
    return commands;
}
export async function route(args) {
    const routerDir = import.meta.dirname;
    const [domain, command] = args;
    const domains = await listDomains(routerDir);
    // ---- invalid domain
    if (!domain || !domains.includes(domain)) {
        console.error(`Unknown domain: ${domain ?? "(none)"}`);
        console.log("\nAvailable domains:");
        domains.forEach((d) => console.log(" ", d));
        process.exit(1);
    }
    const commands = await listCommands(routerDir, domain);
    // ---- domain help
    if (!command || command === "help") {
        console.log(`Commands for ${domain}:`);
        commands.forEach((c) => console.log(`  ${c.name}${c.description ? " — " + c.description : ""}`));
        return;
    }
    // ---- invalid command
    if (!commands.find((c) => c.name === command)) {
        console.error(`Unknown command: ${domain} ${command}`);
        console.log("\nAvailable commands:");
        commands.forEach((c) => console.log(`  ${c.name}${c.description ? " — " + c.description : ""}`));
        process.exit(1);
    }
    const commandPath = path.resolve(routerDir, domain, `${command}.js`);
    const modUnknown = await import(pathToFileURL(commandPath).href);
    const mod = modUnknown;
    return mod.default();
}
