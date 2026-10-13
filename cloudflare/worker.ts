interface Env {
  API_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url);

    // Only API requests are proxied to the existing Express backend.
    // All frontend assets and SPA navigation are served by Cloudflare's
    // static-assets layer, so the Render deployment remains untouched.
    if (incoming.pathname === "/api" || incoming.pathname.startsWith("/api/")) {
      const origin = env.API_ORIGIN.replace(/\/$/, "");
      const upstreamUrl = new URL(
        incoming.pathname + incoming.search,
        origin,
      );

      const upstreamRequest = new Request(upstreamUrl.toString(), request);
      return fetch(upstreamRequest);
    }

    return new Response("Not found", { status: 404 });
  },
};
