# @dw/validators

Shared Zod validation schemas for the DW Portfolio Platform.

## Overview

This package provides centralized validation schemas used across the platform for API inputs, form validation, and type safety.

## Features

- **Zod v4** for runtime validation
- **Type inference** from schemas
- **Reusable schemas** across web and mobile
- **Consistent validation** logic

## Exports

```typescript
// Export all validation schemas
export * from "./src/index";
```

## Usage

### In tRPC Procedures

```typescript
import { createPostSchema } from "@dw/validators";

export const postRouter = {
  create: protectedProcedure
    .input(createPostSchema)
    .mutation(({ input, ctx }) => {
      // input is fully typed and validated
      return ctx.db.insert(posts).values(input);
    }),
};
```

### In Forms (Next.js)

```typescript
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { createPostSchema } from "@dw/validators";

const form = useForm({
  defaultValues: { title: "", content: "" },
  validators: {
    onChange: createPostSchema,
  },
});
```

### In Forms (Expo)

```typescript
import { createPostSchema } from "@dw/validators";

// Validate manually
const result = createPostSchema.safeParse(formData);

if (!result.success) {
  // Handle validation errors
  console.error(result.error.flatten());
}
```

## Adding Schemas

Create new validation schemas in `src/`:

```typescript
// src/comment.ts
import { z } from "zod/v4";

export const createCommentSchema = z.object({
  content: z.string().min(1).max(500),
  postId: z.string().uuid(),
});

export const updateCommentSchema = createCommentSchema.partial();
```

Export from `src/index.ts`:

```typescript
export * from "./comment";
```

## Development

```bash
# Build TypeScript
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```

## Dependencies

- `zod` - Schema validation library

## Best Practices

1. **Colocate with database schema** - Generate from Drizzle when possible
2. **Use refinements** for complex validation
3. **Provide error messages** for better UX
4. **Share schemas** - Don't duplicate validation logic

## Related Packages

- [`@dw/api`](../api/README.md) - Uses validators for input validation
- [`@dw/db`](../db/README.md) - Generates validators from schema
