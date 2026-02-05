# Platform CLI

Command-line tools for platform operations and automation.

## Overview

This package provides CLI tools for common platform operations, database management, and deployment helpers.

**Status**: Placeholder - CLI tools will be added as needed.

## Package

**Name**: `@dw/cli`

**Dependencies**:
- `@dw/api` - API operations
- `@dw/db` - Database operations
- `@dw/redis` - Redis operations
- `commander` - CLI framework
- `uuid` - UUID generation

## Planned Features

### Database Operations

```bash
# Backup database
dw-cli db:backup

# Restore database
dw-cli db:restore backup.sql

# Reset database (dev only)
dw-cli db:reset
```

### User Management

```bash
# Create admin user
dw-cli user:create-admin

# List users
dw-cli user:list

# Ban user
dw-cli user:ban <user-id>
```

### Deployment

```bash
# Pre-deployment checks
dw-cli deploy:check

# Run migrations
dw-cli deploy:migrate

# Rollback
dw-cli deploy:rollback
```

### Cache Management

```bash
# Clear all caches
dw-cli cache:clear

# Clear specific cache
dw-cli cache:clear posts

# View cache stats
dw-cli cache:stats
```

## Development

Currently, the CLI is a placeholder. To add CLI commands:

1. **Install CLI framework**:

```bash
cd platform/cli
pnpm add commander inquirer
```

2. **Create command structure**:

```typescript
// src/index.ts
import { Command } from "commander";

const program = new Command();

program
  .name("dw-cli")
  .description("DW Portfolio Platform CLI")
  .version("1.0.0");

program
  .command("db:backup")
  .description("Backup database")
  .action(async () => {
    // Implementation
  });

program.parse();
```

3. **Build and link**:

```bash
pnpm build
pnpm link --global
```

4. **Use CLI**:

```bash
dw-cli db:backup
```

## Future Enhancements

- [ ] Database backup/restore
- [ ] User management commands
- [ ] Cache management
- [ ] Deployment helpers
- [ ] Health check reporting
- [ ] Log aggregation and viewing

## Related Documentation

- [Dev Tools](../dev-tools/README.md) - Scripts and seeding
- [Platform Overview](../README.md) - Platform architecture
