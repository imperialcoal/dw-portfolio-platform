#!/usr/bin/env node
import { route } from "./router/index.js";
const args = process.argv.slice(2);
await route(args);
