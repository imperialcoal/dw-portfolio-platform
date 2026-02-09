export function setupProcessHandlers() {
  process.on("unhandledRejection", (err) => {
    console.error("Unhandled rejection:", err);
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
  });
}
