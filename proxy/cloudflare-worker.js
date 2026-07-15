/**
 * Cloudflare Worker — proxy CORS para TikTok Open API
 *
 * Deploy grátis: https://workers.cloudflare.com/
 * 1. Create Worker → colar este arquivo
 * 2. Deploy
 * 3. No VideoFlow Contas → Proxy URL = https://SEU-WORKER.workers.dev
 *
 * O browser chama: PROXY + /v2/...  e o worker repassa para open.tiktokapis.com
 */
export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }
    const url = new URL(request.url);
    // /tiktok/v2/... → https://open.tiktokapis.com/v2/...
    // /upload?url=encodedUploadUrl → PUT to TikTok upload URL
    if (url.pathname.startsWith("/upload")) {
      const target = url.searchParams.get("url");
      if (!target) return json({ error: "missing url" }, 400);
      const headers = new Headers();
      const ct = request.headers.get("Content-Type");
      const cr = request.headers.get("Content-Range");
      if (ct) headers.set("Content-Type", ct);
      if (cr) headers.set("Content-Range", cr);
      const res = await fetch(target, { method: "PUT", headers, body: request.body, duplex: "half" });
      const out = new Response(res.body, { status: res.status, headers: cors() });
      return out;
    }

    const path = url.pathname.replace(/^\/tiktok/, "") || "/";
    const target = "https://open.tiktokapis.com" + path + url.search;
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("origin");
    headers.delete("referer");
    const init = {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    };
    if (init.body) init.duplex = "half";
    const res = await fetch(target, init);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        ...Object.fromEntries(cors()),
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  },
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Content-Range",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}
