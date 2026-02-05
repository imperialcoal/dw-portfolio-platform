# DW Portfolio Platform

A production-grade T3 Turbo monorepo featuring a Next.js 16 web application and Expo mobile app, built with end-to-end type safety and modern tooling.

## Overview

The **DW Portfolio Platform** is a full-stack TypeScript monorepo that demonstrates best practices in modern web and mobile development. Built on the T3 Turbo stack, it provides:

- **Full-stack type safety** from database to UI using tRPC and Drizzle ORM
- **Dual authentication** with Clerk (OAuth) and Better Auth (email/password)
- **Monorepo architecture** powered by Turborepo and pnpm workspaces
- **Internal Developer Platform** for streamlined development and deployment
- **Production-ready infrastructure** with Docker, PostgreSQL, Redis, and CI/CD

## Tech Stack

### Core Technologies

- **Monorepo**: Turborepo 2.5.8 with pnpm 10.28.2+ workspaces
- **Language**: TypeScript 5.9.3 (strict mode)
- **Node**: ^22.21.0
- **Package Management**: pnpm with catalog system for unified dependency versions

### Frontend

- **Web**: Next.js 16.1.6 with React 19.1.4
- **Mobile**: Expo SDK 54 with React Native 0.81
- **Styling**: Tailwind CSS v4.1.18
- **UI Components**: shadcn/ui with Radix UI primitives
- **State Management**: TanStack Query (React Query) via tRPC

### Backend & API

- **API Layer**: tRPC v11.9.0 for end-to-end type-safe APIs
- **Database**: PostgreSQL 16 with Drizzle ORM 0.44.7
- **Caching**: Upstash Redis with rate limiting
- **Authentication**: Clerk + Better Auth

### Development Infrastructure

- **Containerization**: Docker Compose (PostgreSQL, Redis, Upstash emulator)
- **CI/CD**: GitHub Actions (lint, format, typecheck)
- **Code Quality**: ESLint 9, Prettier 3.6.2
- **Infrastructure**: Terraform (placeholder for IaC)

## Project Structure

```
.
├── apps/                        # Consumer applications
│   ├── expo/                    # Mobile app (Expo SDK 54)
│   └── nextjs/                  # Web app (Next.js 16)
├── packages/                    # Shared packages
│   ├── api/                     # tRPC routers and procedures
│   ├── auth/                    # Authentication (Clerk + Better Auth)
│   ├── db/                      # Database layer (Drizzle ORM)
│   ├── health/                  # Health check utilities
│   ├── redis/                   # Redis caching and rate limiting
│   ├── ui/                      # UI component library (shadcn/ui)
│   └── validators/              # Shared Zod schemas
├── platform/                    # Internal Developer Platform (IDP)
│   ├── cli/                     # CLI tools
│   ├── dev-tools/               # Docker, scripts, seeding
│   ├── infra/                   # Infrastructure as Code
│   ├── pipelines/               # CI/CD configuration
│   └── standards/               # Shared configs (ESLint, Prettier, TS, Tailwind)
├── .github/workflows/           # GitHub Actions
├── turbo.json                   # Turborepo configuration
├── pnpm-workspace.yaml          # pnpm workspaces + catalog
└── package.json                 # Root scripts and dependencies
```

## Quick Start

### Prerequisites

Ensure you have the following installed:

- **Node.js**: ^22.21.0 (check with `node --version`)
- **pnpm**: ^10.28.2 (install with `npm install -g pnpm`)
- **Docker**: For local infrastructure (PostgreSQL, Redis)

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd dw-portfolio-platform

# Install dependencies
pnpm install
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your configuration
# Required: DATABASE_URL, CLERK keys, UPSTASH Redis credentials
```

### 3. Start Local Infrastructure

```bash
# Start PostgreSQL, Redis, and Upstash emulator
pnpm infra:up

# Verify infrastructure is healthy
pnpm infra:logs
```

The following services will be available:
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`
- Upstash Redis HTTP: `localhost:8079`

### 4. Set Up Database

```bash
# Generate Better Auth schema
pnpm auth:generate

# Push database schema to PostgreSQL
pnpm db:push

# (Optional) Seed database with sample data
pnpm dev:seed

# (Optional) Open Drizzle Studio for database management
pnpm db:studio
```

### 5. Start Development

```bash
# Start all apps in watch mode (Next.js + Expo)
pnpm dev

# Or start Next.js only (with infrastructure check)
pnpm dev:next:check

# Or start Next.js without infrastructure check
pnpm dev:next
```

The Next.js app will be available at `http://localhost:3000`.

For Expo, follow the terminal prompts to open on iOS/Android.

## Development Workflow

### Common Commands

```bash
# Development
pnpm dev                    # Start all apps in watch mode
pnpm dev:next               # Start Next.js app only
pnpm dev:check              # Start all apps with infrastructure check

# Database
pnpm db:generate            # Generate Drizzle migrations
pnpm db:push                # Push schema changes to database
pnpm db:studio              # Open Drizzle Studio
pnpm dev:seed               # Seed database with test data

# Code Quality
pnpm lint                   # Lint all packages
pnpm lint:fix               # Auto-fix linting issues
pnpm format                 # Check formatting
pnpm format:fix             # Auto-format code
pnpm typecheck              # Type-check all packages

# Infrastructure
pnpm infra:up               # Start Docker containers
pnpm infra:down             # Stop Docker containers
pnpm infra:restart          # Restart Docker containers
pnpm infra:logs             # View container logs

# Build
pnpm build                  # Build all packages and apps

# Cleanup
pnpm clean:workspaces       # Clean all workspace build artifacts
pnpm clean:artifacts        # Remove dist, .next, .turbo, .cache
pnpm clean:deps             # Remove all node_modules
pnpm clean:all              # Full cleanup (artifacts + deps + store)
```

### Package Management

This monorepo uses **pnpm catalog** for unified dependency versioning. All shared dependencies are defined in `pnpm-workspace.yaml` under the `catalog` section.

```bash
# Install workspace package
pnpm install <package-name> -w

# Install to specific workspace
pnpm install <package-name> --filter @dw/nextjs

# Add UI component (shadcn/ui)
pnpm ui-add

# Generate new package scaffold
pnpm turbo gen init
```

## Package Scope

All packages use the `@dw/*` scope:

- `@dw/api` - tRPC API layer
- `@dw/auth` - Authentication
- `@dw/db` - Database layer
- `@dw/redis` - Redis utilities
- `@dw/ui` - UI components
- `@dw/validators` - Shared Zod schemas
- `@dw/health` - Health checks
- `@dw/nextjs` - Next.js app
- `@dw/expo` - Expo app

## Architecture Highlights

### End-to-End Type Safety

```typescript
// Define schema in validators package
export const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
});

// Use in tRPC router (packages/api)
export const postRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createPostSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.insert(posts).values(input);
    }),
});

// Call from Next.js with full type safety
const { mutate } = api.post.create.useMutation();
mutate({ title: "Hello", content: "World" }); // Types inferred!
```

### Dual Authentication

- **Clerk**: OAuth providers (Google, GitHub, etc.) for social login
- **Better Auth**: Email/password, session management, and custom auth flows
- **Unified Context**: Both auth providers work together in tRPC context

### Turborepo Caching

Turborepo intelligently caches task outputs across the monorepo. Changes to one package only rebuild affected dependencies.

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".cache/tsbuildinfo.json", "dist/**"]
    }
  }
}
```

## Deployment

### Next.js (Vercel)

1. Connect your repository to Vercel
2. Set root directory to `apps/nextjs`
3. Add environment variables (Clerk, database, Redis)
4. Deploy

### Expo (EAS)

```bash
# Install EAS CLI
pnpm add -g eas-cli

# Login and configure
cd apps/expo
eas login
eas build:configure

# Build for production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --latest
```

### Infrastructure

The `platform/infra/terraform/` directory is prepared for infrastructure as code. Add your Terraform configurations for production deployment.

## Documentation

Each workspace has its own README with detailed documentation:

- [Apps Overview](./apps/README.md)
  - [Next.js App](./apps/nextjs/README.md)
  - [Expo App](./apps/expo/README.md)
- [Packages Overview](./packages/README.md)
  - [API](./packages/api/README.md)
  - [Auth](./packages/auth/README.md)
  - [Database](./packages/db/README.md)
  - [Redis](./packages/redis/README.md)
  - [UI](./packages/ui/README.md)
  - [Validators](./packages/validators/README.md)
  - [Health](./packages/health/README.md)
- [Platform Overview](./platform/README.md)
  - [Standards](./platform/standards/README.md)
  - [Dev Tools](./platform/dev-tools/README.md)
  - [CLI](./platform/cli/README.md)
  - [Pipelines](./platform/pipelines/README.md)
  - [Infrastructure](./platform/infra/README.md)

## Contributing

This is a monorepo project. When making changes:

1. Follow the established package structure
2. Maintain end-to-end type safety
3. Update relevant documentation
4. Run `pnpm lint:fix` and `pnpm format:fix` before committing
5. Ensure all tests pass with `pnpm typecheck`

## License

MIT

## Acknowledgments

This project is based on [create-t3-turbo](https://github.com/t3-oss/create-t3-turbo) by the T3 OSS community.
