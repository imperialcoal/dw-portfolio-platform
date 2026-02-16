# Platform

Internal Developer Platform (IDP) for the DW Portfolio Platform monorepo.

## Overview

The `platform/` directory contains all the tooling, standards, and infrastructure code that powers the development experience and production deployments. This is the "platform" layer that supports the applications and packages.

**Philosophy**: Treat the platform as a product. Prioritize developer experience, reduce cognitive load, and provide self-service capabilities.

## Structure

```
platform/
├── cli/                      # CLI tools for platform operations
├── dev-tools/                # Docker, scripts, seeding
│   ├── docker/               # Docker Compose configuration
│   └── scripts/              # Shell scripts and TypeScript utilities
├── infra/                    # Infrastructure as Code (Terraform)
│   └── terraform/            # Terraform configuration (placeholder)
├── pipelines/                # CI/CD pipeline configuration
│   └── (GitHub Actions)      # Defined in .github/workflows/
└── standards/                # Shared configurations
    ├── eslint/               # ESLint configuration
    ├── github/               # GitHub templates and configs
    ├── prettier/             # Prettier configuration
    ├── tailwind/             # Tailwind CSS configuration
    └── typescript/           # TypeScript configuration
```

## Components

### [Standards](./standards/README.md)

Shared configuration packages for consistent code quality and styling across the monorepo.

- **ESLint**: Code linting with Next.js, React, and TypeScript rules
- **Prettier**: Code formatting with import sorting
- **TypeScript**: Shared tsconfig with strict mode
- **Tailwind**: Shared Tailwind theme and configuration
- **GitHub**: Issue templates, PR templates, and workflows

### [Dev Tools](./dev-tools/README.md)

Local development infrastructure and utilities.

- **Docker Compose**: PostgreSQL 16, Redis 7, Upstash emulator
- **Shell Scripts**: Infrastructure health checks, wait scripts
- **TypeScript Scripts**: Database seeding, data generation
- **Package**: `@dw/dev-tools` for seeding operations

### [CLI](./cli/README.md)

Command-line tools for platform operations and automation.

- **Package**: `@dw/cli`
- **Purpose**: Platform operations, database management, deployment helpers
- **Status**: Placeholder for future CLI tools

### [Pipelines](./pipelines/README.md)

CI/CD configuration for automated testing and deployment.

- **GitHub Actions**: Lint, format, typecheck on pull requests
- **Location**: `.github/workflows/ci.yml`
- **Status**: Basic CI pipeline in place

### [Infrastructure](./infra/README.md)

Infrastructure as Code for production deployments.

- **Terraform**: Infrastructure definitions (placeholder)
- **Purpose**: Provision cloud resources, networking, databases
- **Status**: Prepared structure for future IaC

## Platform Principles

### 1. Self-Service

Developers should be able to:

- Start local infrastructure: `pnpm infra:up`
- Seed database: `pnpm dev:seed`
- Run tests: `pnpm test`
- Deploy apps: Automated via CI/CD

No manual configuration or tribal knowledge required.

### 2. Consistency

All packages and apps use:

- Shared ESLint, Prettier, TypeScript configs
- Unified dependency versions via pnpm catalog
- Common patterns for tRPC, Drizzle, auth

### 3. Fast Feedback

- **Turborepo caching**: Skip unnecessary rebuilds
- **Watch mode**: Hot reload on code changes
- **CI pipeline**: Fast linting, formatting, type checking
- **Local infrastructure**: No cloud dependencies for development

### 4. Type Safety

End-to-end type safety from database to UI:

- Drizzle ORM generates types from schema
- tRPC infers types from routers
- Zod validates at runtime
- TypeScript enforces at compile time

### 5. Automation

- **Pre-commit hooks**: Lint and format before commit (future)
- **CI/CD**: Automated testing and deployment
- **Schema generation**: `pnpm auth:generate`, `pnpm db:generate`
- **Dependency updates**: Renovate/Dependabot (configured)

## Development Workflow

### Starting Development

```bash
# 1. Start infrastructure
pnpm infra:up

# 2. Set up database
pnpm auth:generate
pnpm db:push
pnpm dev:seed

# 3. Start development
pnpm dev
```

### Making Changes

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes
# ... code changes ...

# 3. Lint and format
pnpm lint:fix
pnpm format:fix

# 4. Type check
pnpm typecheck

# 5. Commit and push
git add .
git commit -m "feat: add my feature"
git push
```

### Adding New Packages

```bash
# Generate new package
pnpm turbo gen init

# Follow prompts
```

### Adding New Infrastructure

```bash
# Add service to Docker Compose
vim platform/dev-tools/docker/docker-compose.yml

# Restart infrastructure
pnpm infra:restart
```

## Platform Scripts

Available at monorepo root:

```bash
# Infrastructure
pnpm infra:up              # Start Docker containers
pnpm infra:down            # Stop Docker containers
pnpm infra:restart         # Restart Docker containers
pnpm infra:logs            # View container logs

# Database
pnpm db:generate           # Generate Drizzle migrations
pnpm db:push               # Push schema to database
pnpm db:studio             # Open Drizzle Studio
pnpm dev:seed              # Seed database with test data

# Code Quality
pnpm lint                  # Lint all packages
pnpm lint:fix              # Auto-fix linting issues
pnpm format                # Check formatting
pnpm format:fix            # Auto-format code
pnpm typecheck             # Type-check all packages
pnpm lint:ws               # Lint workspace dependencies

# Development
pnpm dev                   # Start all apps in watch mode
pnpm dev:next              # Start Next.js app only
pnpm dev:check             # Start with infrastructure check

# Cleanup
pnpm clean:artifacts       # Remove build artifacts
pnpm clean:deps            # Remove node_modules
pnpm clean:all             # Full cleanup
```

## Platform Packages

Platform packages are scoped to `@dw/` and include both `standards/` and `dev-tools/`:

- `@dw/eslint-config` - ESLint configuration
- `@dw/prettier-config` - Prettier configuration
- `@dw/tsconfig` - TypeScript configuration
- `@dw/tailwind-config` - Tailwind configuration
- `@dw/dev-tools` - Dev tools and seeding scripts
- `@dw/cli` - CLI tools (future)

## Documentation

- [Standards](./standards/README.md) - Shared configurations
- [Dev Tools](./dev-tools/README.md) - Docker and scripts
- [CLI](./cli/README.md) - Command-line tools
- [Pipelines](./pipelines/README.md) - CI/CD configuration
- [Infrastructure](./infra/README.md) - Infrastructure as Code

## Future Enhancements

### Short Term

- [ ] Pre-commit hooks with Husky
- [ ] E2E testing with Playwright
- [ ] Component testing with Vitest
- [ ] Preview deployments for PRs

### Medium Term

- [ ] CLI tools for common operations
- [ ] Terraform modules for production infra
- [ ] Monitoring and alerting setup
- [ ] Performance budgets

### Long Term

- [ ] Multi-region deployment
- [ ] Feature flags
- [ ] A/B testing framework
- [ ] Developer portal/docs site

## Contributing

When modifying platform code:

1. **Maintain backward compatibility** - Don't break existing workflows
2. **Document changes** - Update relevant READMEs
3. **Test locally** - Verify changes work across all apps
4. **Update CI** if pipeline changes are needed
5. **Communicate** - Platform changes affect everyone

## Related Documentation

- [Root README](../README.md) - Project overview
- [Apps](../apps/README.md) - Consumer applications
- [Packages](../packages/README.md) - Shared packages
