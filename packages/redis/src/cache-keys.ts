/**
 * Centralized cache key definitions
 * This ensures consistency across the codebase
 */
export const cacheKeys = {
  // Posts
  postsAll: "posts:all" as const,
  postById: (id: string) => `post:${id}` as const,

  // Users
  userById: (id: string) => `user:${id}` as const,
  userByEmail: (email: string) => `user:email:${email}` as const,

  // Add more cache keys as needed
} as const;