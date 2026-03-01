"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config_1 = require("eslint/config");
var base_1 = require("@dw/eslint-config/base");
exports.default = (0, config_1.defineConfig)(
  {
    ignores: [],
  },
  base_1.baseConfig,
);
