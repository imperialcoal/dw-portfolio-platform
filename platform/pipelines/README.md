# Platform Pipelines

CI/CD pipeline configuration for automated testing and deployment.

## Overview

This directory contains CI/CD configuration for GitHub Actions workflows. Currently, a basic CI pipeline is in place for code quality checks.

**Location**: `.github/workflows/`

## Current Pipelines

### CI Pipeline

**File**: `.github/workflows/ci.yml`

**Triggers**:
- Pull requests to `main`
- Pushes to `main`

**Jobs**:

1. **Setup**
   - Checkout code
   - Setup Node.js 22
   - Setup pnpm with caching
   - Install dependencies

2. **Lint**
   - Run ESLint across all packages
   - Cache ESLint results

3. **Format**
   - Check Prettier formatting
   - Cache Prettier results

4. **Type Check**
   - Run TypeScript compiler
   - Check for type errors

**Configuration**:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install
      - run: pnpm lint

  format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install
      - run: pnpm format

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install
      - run: pnpm typecheck
```

## Planned Pipelines

### Test Pipeline

```yaml
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_PASSWORD: postgres
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
    - uses: actions/setup-node@v4
    - run: pnpm install
    - run: pnpm test
```

### Build Pipeline

```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
    - uses: actions/setup-node@v4
    - run: pnpm install
    - run: pnpm build
    - uses: actions/upload-artifact@v4
      with:
        name: build-artifacts
        path: |
          apps/*/dist
          packages/*/dist
```

### Deployment Pipeline

```yaml
deploy:
  needs: [lint, format, typecheck, test, build]
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Turborepo Remote Caching

To enable Turborepo remote caching in CI:

1. **Get Vercel token**:

```bash
npx turbo login
npx turbo link
```

2. **Add secrets** to GitHub:
   - `TURBO_TOKEN`
   - `TURBO_TEAM`

3. **Update workflow**:

```yaml
- run: pnpm build
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

## Dependabot

**File**: `.github/dependabot.yml`

Automated dependency updates for:
- npm packages
- GitHub Actions

**Configuration**:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 10

  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
```

## Renovate

**File**: `.github/renovate.json`

Alternative to Dependabot with more features:

```json
{
  "extends": ["config:base"],
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true
    }
  ]
}
```

## Best Practices

### 1. Fail Fast

Run quick checks (lint, format) before slow checks (tests, build).

### 2. Parallel Jobs

Run independent jobs in parallel:

```yaml
jobs:
  lint:
    # ...
  format:
    # ...
  typecheck:
    # ...
```

### 3. Cache Dependencies

Always cache node_modules and pnpm store:

```yaml
- uses: actions/setup-node@v4
  with:
    cache: pnpm
```

### 4. Matrix Builds

Test on multiple Node versions:

```yaml
strategy:
  matrix:
    node-version: [20, 22]
```

### 5. Conditional Jobs

Only deploy from main branch:

```yaml
if: github.ref == 'refs/heads/main'
```

## Future Enhancements

- [ ] E2E testing with Playwright
- [ ] Component testing with Vitest
- [ ] Bundle size tracking
- [ ] Performance budgets
- [ ] Security scanning
- [ ] Preview deployments for PRs
- [ ] Automated changelogs
- [ ] Slack/Discord notifications

## Troubleshooting

### CI Failing

```bash
# Run CI checks locally
pnpm lint
pnpm format
pnpm typecheck

# Fix issues
pnpm lint:fix
pnpm format:fix
```

### Slow CI

- Enable Turborepo remote caching
- Use matrix builds sparingly
- Cache dependencies aggressively
- Run only affected packages with `--filter`

## Related Documentation

- [Platform Standards](../standards/README.md) - Linting and formatting configs
- [Development Workflow](../../README.md#development-workflow) - Local workflow
