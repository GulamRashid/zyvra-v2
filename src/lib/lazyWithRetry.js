import { lazy } from 'react';

/**
 * Lazy loads a component with retry capability for production SPAs and PWAs.
 * When Vite deploys a new build, chunk hashes change. Cached clients requesting
 * older chunks get 404 / 'Failed to fetch dynamically imported module'.
 * This wrapper intercepts chunk errors and reloads the window once per session to
 * smoothly refresh the asset manifest without showing a blank white page.
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const RETRY_KEY = 'zyvra_chunk_retry_pending';
    try {
      const module = await componentImport();
      // If load succeeds, clear any pending retry flag
      try {
        sessionStorage.removeItem(RETRY_KEY);
      } catch {}
      return module;
    } catch (error) {
      const message = typeof error?.message === 'string' ? error.message : String(error || '');
      const isChunkError =
        error?.name === 'ChunkLoadError' ||
        /chunk|dynamically imported module|failed to fetch dynamically imported module/i.test(message);

      let alreadyRetried = false;
      try {
        alreadyRetried = sessionStorage.getItem(RETRY_KEY) === 'true';
      } catch {}

      if (isChunkError && !alreadyRetried) {
        try {
          sessionStorage.setItem(RETRY_KEY, 'true');
        } catch {}
        // Force reload from server to fetch current index.html with new asset hashes
        window.location.reload();
        return { default: () => null };
      }

      // If already retried or not a chunk error, bubble up to AppErrorBoundary
      throw error;
    }
  });
}

export default lazyWithRetry;
