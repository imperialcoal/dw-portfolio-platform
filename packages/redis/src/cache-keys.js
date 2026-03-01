"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKeys = void 0;
/**
 * Centralized cache key definitions
 * This ensures consistency across the codebase
 */
exports.cacheKeys = {
  // Posts
  postsAll: "posts:all",
  postById: function (id) {
    return "post:".concat(id);
  },
  // Users
  userById: function (id) {
    return "user:".concat(id);
  },
  userByEmail: function (email) {
    return "user:email:".concat(email);
  },
  // Add more cache keys as needed
};
