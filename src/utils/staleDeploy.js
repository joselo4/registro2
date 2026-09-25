// After a deploy, a tab opened earlier asks for code files that no longer
// exist. Reload once to pick up the new version; the cart lives in storage.
const RELOAD_KEY = 'friozo_stale_deploy_reload';
const STALE_CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export const isStaleDeployError = error => STALE_CHUNK.test(String(error?.message || error || ''));

export function reloadForNewDeploy(storage = globalThis.sessionStorage, location = globalThis.location, now = Date.now()) {
  try {
    const last = Number(storage?.getItem(RELOAD_KEY)) || 0;
    // One attempt per minute avoids a reload loop if the server is really down.
    if (now - last < 60000) return false;
    storage?.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  location?.reload();
  return true;
}
