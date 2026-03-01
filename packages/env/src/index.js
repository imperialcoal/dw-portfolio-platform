"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnv = loadEnv;
var path = require("path");
var dotenv = require("dotenv");
/**
 * Load env once for the entire process.
 * Runtime env variables ALWAYS win.
 */
function loadEnv() {
  dotenv.config({
    path: path.join(process.cwd(), ".env.local"),
    override: false,
  });
}
