# UniquePlatform Cloudflare free-hosting pilot

This pilot keeps the existing Render Express API as the backend and serves a separate Vite frontend through Cloudflare static assets. It does not change the Render service or move Firebase data.

## Build and deploy

1. Connect the repository to Cloudflare Workers Builds using the branch `cloudflare-free-hosting-pilot`.
2. Set the build command to:

   `npm ci && npx vite build --outDir dist/cloudflare && npx wrangler deploy`

3. Set the root directory to the repository root.
4. Use the free plan. Do not add paid resources or enable paid billing.
5. Deploy only the pilot branch, not `main`.

The Worker forwards only `/api` and `/api/*` requests to the existing Render origin. Other requests are handled by Cloudflare's static asset layer and SPA fallback.

## Important limitations

- The API still runs on Render. This pilot reduces dependence on Render for frontend hosting and frontend builds, but does not yet eliminate Render runtime or backend-deployment needs.
- Keep Firebase configuration and secrets in their existing secure configuration. Never put service-account credentials or payment secrets in frontend variables.
- Validate sign-in, messaging, file uploads, maps, support, and Paystack test-mode checkout on the pilot URL before considering any production switch.
- The pilot is not approved for live payment settlement.
- If the Render backend is asleep or unavailable, API requests can still be delayed or fail.
