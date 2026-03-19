# @dw/cli

The `pnpm dw` command-line interface for monorepo operations. Provides a domain-routed CLI system where commands are discovered by filesystem convention — no manual command registration required.

## Purpose

Centralizes developer tooling into a single, memorable interface (`pnpm dw <domain> <command>`) rather than requiring developers to remember long Turbo filter flags or package-specific scripts.

## Architecture

```
src/
├── index.ts           # Entry point: calls route(process.argv.slice(2))
├── router/
│   ├── index.ts       # Dynamic discovery: lists domains/commands from filesystem
│   ├── db/            # Database commands
│   │   ├── generate.ts
│   │   ├── migrate.ts / migrate.local.ts
│   │   ├── push.ts / push.local.ts
│   │   ├── seed.ts
│   │   ├── studio.ts / studio.local.ts
│   │   └── test-setup.ts
│   └── infra/         # Infrastructure commands
│       ├── up.ts / down.ts / restart.ts / logs.ts
│       └── tf.*.ts    # Terraform commands (init, plan, apply, import, state-rm)
├── types/
│   ├── command.ts     # CLICommand, CLICommandModule types
│   └── turbo.ts       # Turbo command builder types
└── utils/
    ├── run.ts          # execa wrapper for subprocess execution
    ├── turbo-command.ts # Builds turbo filter flags
    └── workspace.ts    # Workspace package discovery utilities
```

### Router Discovery

The CLI uses a filesystem-based router: `route(args)` lists subdirectories of `src/router/` as domains, then lists `.js` files within the matched domain directory as commands. Each command file exports a `default` function (the command handler) and an optional `description` string.

Adding a new command requires only creating a new `.ts` file in the appropriate domain directory — the router discovers it automatically.

## Usage

```bash
# Database commands
pnpm dw db generate        # Generate Drizzle migration files
pnpm dw db migrate         # Apply migrations (remote DB)
pnpm dw db migrate.local   # Apply migrations (local Docker DB)
pnpm dw db push.local      # Push schema without migration file
pnpm dw db seed            # Seed the database
pnpm dw db studio          # Open Drizzle Studio (remote)
pnpm dw db studio.local    # Open Drizzle Studio (local Docker)
pnpm dw db test-setup      # Set up test database

# Infrastructure commands
pnpm dw infra up           # Start Docker infrastructure
pnpm dw infra down         # Stop Docker infrastructure
pnpm dw infra restart      # Restart Docker infrastructure
pnpm dw infra logs         # Stream Docker logs
pnpm dw infra tf.init      # Terraform init
pnpm dw infra tf.plan      # Terraform plan
pnpm dw infra tf.apply     # Terraform apply
pnpm dw infra tf.import    # Terraform import (all resources)
pnpm dw infra tf.state-rm  # Remove resource from Terraform state

# Help
pnpm dw db help     # List all db commands
pnpm dw infra help  # List all infra commands
```

## Dependencies

No monorepo dependencies. Uses `execa` for subprocess execution and `uuid` for run IDs.

Consumed by: root `package.json` (`postinstall` links it as a dev dependency)

## Developer Notes

> **Developer Note**
> The CLI is built as ESM (`"type": "module"`) and runs from `dist/` after `tsc` compilation. The bin entry `"dw": "./dist/index.js"` is linked via `@dw/cli: workspace:*` in the root `package.json`. The router uses `import.meta.dirname` (Node 22 ESM) for the current directory, and `pathToFileURL()` for dynamic imports — both required for ESM module loading from absolute paths.
