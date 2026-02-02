export const cacheKeys = {
  postsAll: "posts:all:v1",
  postById: (id: string) => `posts:by-id:${id}:v1`,
};
