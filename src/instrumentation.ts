/**
 * Runs once when the server starts. Every server that starts cleans the uploads folders by itself every day at 02:00 India time (see uploads-cleanup.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await (await import("./instrumentation-node")).startUploadsCleanup();
}
