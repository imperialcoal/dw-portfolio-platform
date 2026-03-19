# @dw/ui

Shared React component library for the monorepo. Built on shadcn/ui primitives with Tailwind CSS 4. Components are designed to work in both the Next.js web app and (via NativeWind) the Expo mobile app.

## Purpose

Provides a consistent design system across apps without duplicating component code. All components are unstyled primitives wrapped with Tailwind utility classes.

## Components

| Component       | Export Path            | Description                                   |
| --------------- | ---------------------- | --------------------------------------------- |
| `Button`        | `@dw/ui/button`        | Primary action button                         |
| `DropdownMenu`  | `@dw/ui/dropdown-menu` | Accessible dropdown with trigger and items    |
| `Field`         | `@dw/ui/field`         | Form field wrapper with label and error state |
| `Input`         | `@dw/ui/input`         | Text input with consistent styling            |
| `Label`         | `@dw/ui`               | Accessible form label                         |
| `Separator`     | `@dw/ui`               | Horizontal/vertical divider                   |
| `Toast`         | `@dw/ui`               | Toast notification system                     |
| `ThemeProvider` | `@dw/ui`               | Dark/light theme context provider             |

## Key Exports

```typescript
// Named paths for tree-shaking

// Direct import
import { Label, Separator, Toast } from "@dw/ui";
import { Button } from "@dw/ui/button";
import { DropdownMenu } from "@dw/ui/dropdown-menu";
import { Field } from "@dw/ui/field";
import { Input } from "@dw/ui/input";
```

## Configuration

- `components.json` — shadcn/ui configuration for `pnpm ui-add` (adding new components)
- Tailwind config is in `platform/standards/tailwind/`
- Styles use CSS variables for theming

## Dependencies

No monorepo dependencies (leaf package). Peer dependencies: React 19, Tailwind CSS 4.

Consumed by: `@dw/nextjs`, `@dw/expo`

## Local Development

To add a new shadcn/ui component:

```bash
pnpm ui-add
# Interactive prompt to select components
# Output goes to packages/ui/src/
```
