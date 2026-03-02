/**
 * Global setup for smoke tests.
 * Waits for all local dev services to be ready before tests run.
 */
async function globalSetup() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
  const maxWait = 30_000;
  const interval = 1_000;
  const start = Date.now();

  console.log('Waiting for dev environment...');

  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`${baseUrl}/api/me`);
      if (res.ok) {
        console.log(`Dev environment ready (${Date.now() - start}ms)`);
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`Dev environment not ready after ${maxWait}ms. Ensure Azurite, Functions, and Vite are running.`);
}

export default globalSetup;
