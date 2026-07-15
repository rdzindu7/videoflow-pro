/**
 * TikTok Content Posting API client
 * Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
 *
 * Endpoints used:
 * - POST /v2/post/publish/creator_info/query/
 * - POST /v2/post/publish/video/init/
 * - PUT  upload_url (FILE_UPLOAD chunks)
 * - POST /v2/post/publish/status/fetch/
 * - OAuth token exchange
 */
window.TikTokAPI = (function () {
  const API = "https://open.tiktokapis.com";
  const AUTH = "https://www.tiktok.com/v2/auth/authorize/";
  const STORAGE = "vf_tiktok_api_v1";

  function loadCfg() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) || "{}");
    } catch {
      return {};
    }
  }

  function saveCfg(partial) {
    const next = { ...loadCfg(), ...partial, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE, JSON.stringify(next));
    return next;
  }

  function cfg() {
    return loadCfg();
  }

  function bearer() {
    const t = loadCfg().accessToken;
    if (!t) {
      const err = new Error(
        "Falta Access Token. Abra Contas → cole o token OU clique em OAuth Login TikTok (Client Key+Secret salvos)."
      );
      err.code = "NO_TOKEN";
      throw err;
    }
    return t.startsWith("Bearer ") ? t : `Bearer ${t}`;
  }

  function apiBase() {
    const p = (loadCfg().proxyUrl || "").replace(/\/$/, "");
    if (p) return p.replace(/\/$/, "") + "/tiktok";
    return API;
  }

  function uploadViaProxy(uploadUrl) {
    const p = (loadCfg().proxyUrl || "").replace(/\/$/, "");
    if (!p) return uploadUrl;
    return p + "/upload?url=" + encodeURIComponent(uploadUrl);
  }

  async function request(path, { method = "POST", body, headers = {}, raw = false } = {}) {
    const base = apiBase();
    const url = path.startsWith("http") ? path : base + path;
    const h = {
      Authorization: bearer(),
      "Content-Type": "application/json; charset=UTF-8",
      ...headers,
    };
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: h,
        body: body != null ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      });
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (/Failed to fetch|NetworkError|CORS/i.test(msg)) {
        throw new Error(
          "CORS bloqueou a API TikTok no navegador. " +
            "1) Deploy proxy/cloudflare-worker.js no Cloudflare Workers (grátis). " +
            "2) Cole a URL do worker em Contas → Proxy URL. " +
            "Detalhe: " + msg
        );
      }
      throw err;
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const errMsg =
        json?.error?.message || json?.error?.code || json?.message || res.statusText || "HTTP " + res.status;
      throw new Error(`TikTok API ${res.status}: ${errMsg}`);
    }
    if (json?.error && json.error.code && json.error.code !== "ok") {
      throw new Error(`TikTok: ${json.error.code} — ${json.error.message || ""}`);
    }
    return raw ? { res, json } : json;
  }

  /** Creator info — privacy options, max duration, @ (read-only) */
  async function queryCreatorInfo() {
    return request("/v2/post/publish/creator_info/query/", { method: "POST", body: {} });
  }

  /**
   * Display API — le perfil real (read-only).
   * TikTok NAO expoe endpoint publico para ALTERAR @, nome, bio ou foto.
   * Scopes: user.info.basic (+ user.info.profile se aprovado)
   */
  async function getUserInfo(fields) {
    const f = (fields || [
      "open_id",
      "union_id",
      "avatar_url",
      "display_name",
      "username",
      "bio_description",
      "profile_deep_link",
      "is_verified",
    ]).join(",");
    const base = apiBase();
    const url = base + "/v2/user/info/?fields=" + encodeURIComponent(f);
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: bearer() },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || (json?.error && json.error.code && json.error.code !== "ok")) {
      throw new Error(
        json?.error?.message || json?.error?.code || "Falha ao ler user.info (perfil e so leitura)"
      );
    }
    return json;
  }

  /**
   * Init video publish (FILE_UPLOAD or PULL_FROM_URL)
   * @param {object} opts
   */
  async function initVideoPublish(opts) {
    const {
      title,
      privacyLevel = "PUBLIC_TO_EVERYONE",
      disableDuet = false,
      disableComment = false,
      disableStitch = false,
      coverTimestampMs = 1000,
      source = "FILE_UPLOAD",
      videoSize,
      chunkSize,
      totalChunkCount,
      videoUrl,
    } = opts;

    const post_info = {
      title: String(title || "").slice(0, 2200),
      privacy_level: privacyLevel,
      disable_duet: !!disableDuet,
      disable_comment: !!disableComment,
      disable_stitch: !!disableStitch,
      video_cover_timestamp_ms: coverTimestampMs || 1000,
    };

    let source_info;
    if (source === "PULL_FROM_URL") {
      if (!videoUrl) throw new Error("video_url obrigatória para PULL_FROM_URL");
      source_info = { source: "PULL_FROM_URL", video_url: videoUrl };
    } else {
      if (!videoSize || videoSize < 1) throw new Error("video_size obrigatório para FILE_UPLOAD");
      const chunk = chunkSize || Math.min(10_000_000, videoSize);
      const total = totalChunkCount || Math.max(1, Math.ceil(videoSize / chunk));
      source_info = {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: chunk,
        total_chunk_count: total,
      };
    }

    return request("/v2/post/publish/video/init/", {
      method: "POST",
      body: { post_info, source_info },
    });
  }

  /** PUT video bytes to upload_url (single chunk or full file) */
  async function uploadVideoFile(uploadUrl, fileOrBlob, { onProgress } = {}) {
    const target = uploadViaProxy(uploadUrl);
    const size = fileOrBlob.size;
    const chunkSize = 10_000_000;
    if (size <= chunkSize) {
      const res = await fetch(target, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": `bytes 0-${size - 1}/${size}`,
        },
        body: fileOrBlob,
      });
      if (!res.ok) throw new Error(`Upload falhou HTTP ${res.status}`);
      onProgress?.(1);
      return true;
    }
    // multi-chunk
    let offset = 0;
    let part = 0;
    const totalParts = Math.ceil(size / chunkSize);
    while (offset < size) {
      const end = Math.min(offset + chunkSize, size);
      const chunk = fileOrBlob.slice(offset, end);
      const res = await fetch(target, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": `bytes ${offset}-${end - 1}/${size}`,
        },
        body: chunk,
      });
      if (!res.ok) throw new Error(`Upload chunk ${part + 1}/${totalParts} falhou HTTP ${res.status}`);
      offset = end;
      part++;
      onProgress?.(part / totalParts);
    }
    return true;
  }

  async function fetchPublishStatus(publishId) {
    return request("/v2/post/publish/status/fetch/", {
      method: "POST",
      body: { publish_id: publishId },
    });
  }

  async function waitUntilPublished(publishId, { timeoutMs = 180000, intervalMs = 3000, onUpdate } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const st = await fetchPublishStatus(publishId);
      onUpdate?.(st);
      const status = st?.data?.status || st?.data?.publish_status || "";
      // TikTok statuses vary: PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, SEND_TO_USER_INBOX, PUBLISH_COMPLETE, FAILED
      if (/COMPLETE|PUBLISHED|SUCCESS/i.test(status)) return st;
      if (/FAIL|ERROR/i.test(status)) throw new Error("Publicação falhou: " + status);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Timeout aguardando status da publicação TikTok");
  }

  /**
   * Full FILE_UPLOAD flow from File/Blob
   */
  async function publishVideoFromFile(file, postInfo, hooks = {}) {
    const size = file.size;
    const chunkSize = 10_000_000;
    const totalChunkCount = Math.max(1, Math.ceil(size / chunkSize));
    hooks.onLog?.("Init publish (FILE_UPLOAD)...");
    const init = await initVideoPublish({
      title: postInfo.title,
      privacyLevel: postInfo.privacyLevel || "PUBLIC_TO_EVERYONE",
      disableComment: postInfo.disableComment,
      disableDuet: postInfo.disableDuet,
      disableStitch: postInfo.disableStitch,
      coverTimestampMs: postInfo.coverTimestampMs || 1000,
      source: "FILE_UPLOAD",
      videoSize: size,
      chunkSize,
      totalChunkCount,
    });
    const publishId = init?.data?.publish_id;
    const uploadUrl = init?.data?.upload_url;
    if (!publishId || !uploadUrl) throw new Error("Resposta init sem publish_id/upload_url");
    hooks.onLog?.("Upload do vídeo...");
    await uploadVideoFile(uploadUrl, file, { onProgress: hooks.onProgress });
    hooks.onLog?.("Processando no TikTok...");
    const finalSt = await waitUntilPublished(publishId, { onUpdate: hooks.onStatus });
    return { init, status: finalSt, publishId };
  }

  /**
   * PULL_FROM_URL — URL must be on TikTok-verified domain
   */
  async function publishVideoFromUrl(videoUrl, postInfo, hooks = {}) {
    hooks.onLog?.("Init publish (PULL_FROM_URL)...");
    const init = await initVideoPublish({
      title: postInfo.title,
      privacyLevel: postInfo.privacyLevel || "PUBLIC_TO_EVERYONE",
      disableComment: postInfo.disableComment,
      source: "PULL_FROM_URL",
      videoUrl,
    });
    const publishId = init?.data?.publish_id;
    if (!publishId) throw new Error("Resposta init sem publish_id");
    hooks.onLog?.("Aguardando processamento...");
    const finalSt = await waitUntilPublished(publishId, { onUpdate: hooks.onStatus });
    return { init, status: finalSt, publishId };
  }

  /** OAuth helpers */
  function buildAuthorizeUrl({ clientKey, redirectUri, state = "vf", scopes }) {
    const scope = (scopes || ["user.info.basic", "video.publish", "video.upload"]).join(",");
    const u = new URL(AUTH);
    u.searchParams.set("client_key", clientKey);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", scope);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    return u.toString();
  }

  /**
   * Exchange code → token (needs client_secret — often blocked by CORS from browser)
   */
  async function exchangeCode({ clientKey, clientSecret, code, redirectUri }) {
    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const res = await fetch(API + "/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error_description || json.error || json.message || "Token exchange failed");
    }
    // response shape: access_token, refresh_token, open_id, expires_in
    const accessToken = json.access_token || json.data?.access_token;
    const openId = json.open_id || json.data?.open_id;
    const refreshToken = json.refresh_token || json.data?.refresh_token;
    if (!accessToken) throw new Error("Sem access_token na resposta");
    saveCfg({ accessToken, openId, refreshToken, clientKey });
    return json;
  }

  function redirectUriDefault() {
    // GitHub Pages
    if (location.hostname.includes("github.io")) {
      return location.origin + (window.APP_BASE || "/videoflow-pro/").replace(/\/?$/, "/");
    }
    return location.origin + location.pathname.replace(/[^/]+$/, "");
  }

  return {
    API,
    loadCfg,
    saveCfg,
    cfg,
    queryCreatorInfo,
    getUserInfo,
    initVideoPublish,
    uploadVideoFile,
    fetchPublishStatus,
    waitUntilPublished,
    publishVideoFromFile,
    publishVideoFromUrl,
    buildAuthorizeUrl,
    exchangeCode,
    redirectUriDefault,
  };
})();
