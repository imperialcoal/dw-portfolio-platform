# @dw/ui

UI component library using shadcn/ui and Radix UI for web applications.

## Overview

This package provides a collection of reusable React components built with shadcn/ui and Radix UI primitives. These components are **web-only** and not compatible with React Native.

## Features

- **shadcn/ui components** - Modern, accessible UI components
- **Radix UI primitives** - Unstyled, accessible component primitives
- **Tailwind CSS v4** - Utility-first styling
- **TypeScript** - Full type safety
- **Dark mode** support via CSS variables
- **Accessibility** - ARIA-compliant components

## Available Components

- **Button**: Primary actions with variants
- **Input**: Text input fields
- **Label**: Form labels
- **Field**: Form field wrapper with error handling
- **Separator**: Visual dividers
- **Dropdown Menu**: Dropdown menus and context menus
- **Toast**: Toast notifications via Sonner
- **Theme**: Theme provider for dark mode

## Installation

This package is automatically available in Next.js via workspace dependency.

## Usage

### Importing Components

```typescript
import { Button } from "@dw/ui/button";
import { Input } from "@dw/ui/input";
import { Label } from "@dw/ui/label";
```

### Button

```tsx
import { Button } from "@dw/ui/button";

<Button>Click me</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button size="lg">Large Button</Button>
```

### Input & Label

```tsx
import { Input } from "@dw/ui/input";
import { Label } from "@dw/ui/label";

<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@example.com" />
</div>;
```

### Field (Form Field)

```tsx
import { Field } from "@dw/ui/field";
import { Input } from "@dw/ui/input";

<Field
  label="Username"
  error={errors.username}
  description="Choose a unique username"
>
  <Input {...register("username")} />
</Field>;
```

### Toast Notifications

```tsx
import { toast } from "sonner";

toast.success("Post created!");
toast.error("Something went wrong");
toast.promise(fetchData(), {
  loading: "Loading...",
  success: "Data loaded!",
  error: "Failed to load data",
});
```

### Theme Provider

```tsx
import { ThemeProvider } from "@dw/ui/theme";

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>;
```

## Adding New Components

Use the shadcn CLI to add components:

```bash
# From monorepo root
pnpm ui-add

# Select components to add
```

This runs shadcn CLI in the `@dw/ui` package and automatically formats the output.

## Styling

Components use Tailwind CSS with CSS variables for theming:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  /* ... more variables */
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  /* ... more variables */
}
```

Components reference these variables:

```tsx
<div className="bg-background text-foreground">Content</div>
```

## Component Variants

Components use `class-variance-authority` for variants:

```typescript
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border-input bg-background border",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

## Development

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Add new component
pnpm ui-add
```

## Dependencies

- `radix-ui` - Accessible component primitives
- `@radix-ui/react-icons` - Icon library
- `sonner` - Toast notifications
- `class-variance-authority` - Variant management
- `tailwind-merge` - Tailwind class merging
- `react` - Peer dependency
- `zod` - Peer dependency

## Best Practices

1. **Use semantic HTML** - Leverage Radix primitives for accessibility
2. **Compose components** - Build complex UIs from simple primitives
3. **Use variants** - Don't create duplicate components for styling
4. **Follow naming conventions** - Use shadcn naming (lowercase, hyphenated)
5. **Document new components** - Add usage examples
6. **Test accessibility** - Use keyboard navigation and screen readers

## Related Packages

- [Next.js App](../../apps/nextjs/README.md) - Primary consumer of UI components
- [`@dw/tailwind-config`](../../platform/standards/tailwind/README.md) - Shared Tailwind configuration
