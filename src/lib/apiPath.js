// One place that knows how a request path maps onto the Express routers.
//
// Three callers depend on this being identical, or the deployed API and the
// local production preview drift apart:
//   - api/index.js          (the Vercel serverless entry)
//   - scripts/serve-dist.mjs (the dist/ preview the e2e suite uses)
//   - tests/deployment-config.test.js (proves /health advertises what Vercel routes)
//
// Mounts in src/app.js: "/api/v1" (canonical) and "/" (legacy).
export const normalizeApiPath = (url = "/") => {
  const queryAt = url.indexOf("?");
  const pathname = queryAt === -1 ? url : url.slice(0, queryAt);
  const search = queryAt === -1 ? "" : url.slice(queryAt);

  let normalized = pathname;
  if (pathname === "/api" || pathname === "/") {
    // The light prefix at its root maps to the legacy mount.
    normalized = "/";
  } else if (pathname === "/v1" || pathname.startsWith("/v1/")) {
    // A Vercel rewrite may have dropped the outer /api; put it back so the
    // canonical /api/v1 mount matches.
    normalized = "/api" + pathname;
  } else if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) {
    // Canonical base: the router strips /api/v1 itself.
    normalized = pathname;
  } else if (pathname.startsWith("/api/")) {
    // The SPA calls /api/auth/…; the legacy mount serves /auth/….
    normalized = pathname.slice(4) || "/";
  }
  return normalized + search;
};
