#!/usr/bin/env node
import { Command } from "commander";
import { registerCommands } from "./commands/index.js";
const program = new Command();
program.name("dw");
registerCommands(program);
program.parse();
