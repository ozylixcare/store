// Apply before static asset lookup on every host, including the admin host.
export function isPrivateAsset(pathname) {
  let path;
  try { path = decodeURIComponent(pathname).replace(/\\/g, '/'); } catch { return true; }
  if (/(?:^|\/)\.(?!well-known(?:\/|$))/.test(path)) return true;
  if (/^\/(?:worker|functions|tools|docs|security|node_modules)(?:\/|$)/i.test(path)) return true;
  if (/\.(?:map|sql|md|ya?ml|toml|log|bak|py)$/i.test(path)) return true;
  return /(?:^|\/)(?:wrangler\.jsonc|assets\.manifest\.json|package(?:-lock)?\.json|pnpm-lock\.yaml|_headers|_redirects|gitignore|CNAME)$/i.test(path);
}
