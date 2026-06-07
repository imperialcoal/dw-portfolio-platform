// DEPRECATED — vitest.env.ts cannot work as a setupFile because static imports
// are hoisted before process.env assignments in ES modules.
// Each package now provides its own vitest.*.setup.ts for env bootstrapping.
// This file is kept to avoid breaking any external references during transition.
// vitest.runtime.ts (the DB safety guard) is still the canonical shared setup.
