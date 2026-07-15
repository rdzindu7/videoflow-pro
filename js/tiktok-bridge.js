/**
 * Wire TikTok Content Posting API into LUXECUT UI
 * Auto-setup: redirect + privacidade. Client Key/Secret so no localStorage (voce cola do portal).
 * Nunca hardcode secret. Client Key antiga pode ser invalida se regenerada no portal.
 */
(function () {
  const $ = (s) => document.querySelector(s);

  const DEFAULTS = {
    // sugestao legada — se OAuth falhar com client_key, cole a key ATUAL do portal
    clientKey: "aw6c4eqjlnexy4vw",
    privacyLevel: "PUBLIC_TO_EVERYONE",
    appName: "LUXECUT",
  };

  function log(msg) {
    const el = $("#ttApiLog");
    if (!el) return;
    const line = `[${new Date().toLocaleTimeString("pt-BR")}] ${msg}`;
    el.textContent = line + "\n" + el.textContent.slice(0, 2500);
    console.info("[TikTok]", msg);
  }

  function toast(m) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = m;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3200);
  }

  function showClientKeyError(show, detail) {
    const ban = $("#ttKeyErrorBanner");
    if (ban) ban.style.display = show ? "block" : "none";
    if (show) {
      log("ERRO client_key: " + (detail || "TikTok rejeitou a Client Key"));
      try {
        window.VideoFlowApp?.setView?.("contas");
      } catch (_) {}
      const el = $("#ttClientKey");
      if (el) {
        el.focus();
        el.select?.();
        el.style.outline = "2px solid #ff6b6b";
        setTimeout(() => (el.style.outline = ""), 6000);
      }
    }
  }

  function normalizeKey(k) {
    return String(k || "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\s+/g, "");
  }

  function validateClientKey(key) {
    const k = normalizeKey(key);
    if (!k) return { ok: false, msg: "Cole a Client Key do portal TikTok (Credentials)." };
    if (k.length < 10) return { ok: false, msg: "Client Key muito curta — copie de novo do portal." };
    if (/\s/.test(k)) return { ok: false, msg: "Client Key nao pode ter espacos." };
    if (/^act\.|secret|bearer/i.test(k)) {
      return { ok: false, msg: "Isso parece Access Token/Secret. Client Key e o campo Client Key no portal." };
    }
    return { ok: true, key: k };
  }

  function fillForm() {
    const TT = window.TikTokAPI;
    if (!TT) return;
    const c = TT.loadCfg();
    // nao forcar key morta: so preenche se usuario/localStorage ja tiver
    const key = c.clientKey || "";
    if ($("#ttClientKey")) $("#ttClientKey").value = key;
    if ($("#ttClientSecret")) $("#ttClientSecret").value = c.clientSecret || "";
    if ($("#ttAccessToken")) $("#ttAccessToken").value = c.accessToken || "";
    if ($("#ttProxyUrl")) $("#ttProxyUrl").value = c.proxyUrl || "";
    if ($("#ttPrivacy")) $("#ttPrivacy").value = c.privacyLevel || DEFAULTS.privacyLevel;
    const redirect = TT.redirectUriDefault();
    if ($("#ttRedirect")) $("#ttRedirect").value = redirect;
    if ($("#ttRedirectHint")) $("#ttRedirectHint").textContent = redirect;
    const label = $("#ttAccountLabel");
    if (label) {
      label.textContent = c.accessToken
        ? `Conectado${c.openId ? " · open_id " + c.openId : ""}${c.creatorUsername ? " · @" + c.creatorUsername : ""}`
        : key
          ? "Key salva · falta Secret + OAuth ou Access Token"
          : "Desconectado — cole Client Key do portal";
    }

    const params = new URLSearchParams(location.search);
    const err = params.get("error") || params.get("error_type");
    const errDesc = params.get("error_description") || params.get("error_message") || "";
    if (err || /client_key/i.test(errDesc)) {
      showClientKeyError(true, err + " " + errDesc);
      history.replaceState(null, "", location.pathname + location.hash);
      toast("TikTok rejeitou client_key — cole a key nova do portal");
      return;
    }
    // flag interna se usuario voltou da tela de erro
    if (sessionStorage.getItem("luxecut_tt_key_err") === "1") {
      showClientKeyError(true, "Ultimo OAuth falhou com client_key");
      sessionStorage.removeItem("luxecut_tt_key_err");
    }
    const code = params.get("code");
    const state = params.get("state");
    if (code && (state === "vf" || !state || state === "luxecut")) {
      handleOAuthCode(code);
      history.replaceState(null, "", location.pathname + location.hash);
    }
  }

  /** Preenche tudo que da pra automatizar sem expor secret no codigo */
  function autoSetupAll() {
    const TT = window.TikTokAPI;
    if (!TT) return toast("API TikTok nao carregou");

    const redirect = TT.redirectUriDefault();
    const existing = TT.loadCfg();

    // Client Key: campo → localStorage → prompt (nao confiar cegamente em key antiga)
    let key = normalizeKey($("#ttClientKey")?.value || existing.clientKey || "");
    if (!key) {
      key = normalizeKey(
        prompt(
          "Cole a CLIENT KEY do portal TikTok (Credentials).\n\n" +
            "Se o login deu erro client_key, abra o portal e copie a chave ATUAL.\n" +
            "developers.tiktok.com/apps → seu app → Credentials",
          existing.clientKey || DEFAULTS.clientKey || ""
        ) || ""
      );
    }
    const vKey = validateClientKey(key);
    if (!vKey.ok) {
      showClientKeyError(true, vKey.msg);
      return toast(vKey.msg);
    }
    key = vKey.key;

    let secret = existing.clientSecret || ($("#ttClientSecret")?.value || "").trim();
    if (!secret) {
      secret = (prompt(
        "Cole o Client Secret do TikTok (fica so no seu navegador, nao no GitHub):\n\nPortal → App → Credentials → Client secret",
        ""
      ) || "").trim();
    }

    const token = existing.accessToken || ($("#ttAccessToken")?.value || "").trim();

    TT.saveCfg({
      clientKey: key,
      clientSecret: secret || existing.clientSecret || "",
      accessToken: token,
      privacyLevel: DEFAULTS.privacyLevel,
      proxyUrl: ($("#ttProxyUrl")?.value || existing.proxyUrl || "").trim(),
      redirectUri: redirect,
      appName: DEFAULTS.appName,
      autoConfigured: true,
    });

    if ($("#ttClientKey")) $("#ttClientKey").value = key;
    if ($("#ttClientSecret") && secret) $("#ttClientSecret").value = secret;
    if ($("#ttPrivacy")) $("#ttPrivacy").value = DEFAULTS.privacyLevel;
    if ($("#ttRedirect")) $("#ttRedirect").value = redirect;
    showClientKeyError(false);

    log("AUTO-SETUP LUXECUT");
    log("Client Key: " + key.slice(0, 6) + "…" + key.slice(-4) + " (len " + key.length + ")");
    log("Redirect URI: " + redirect);
    log("Privacy: " + DEFAULTS.privacyLevel);
    log(
      secret
        ? "Client Secret: salvo localmente (ok)"
        : "Client Secret: AINDA FALTA — cole no campo e Salvar"
    );
    log("Portal TikTok (obrigatorio antes do OAuth):");
    log("1) Credentials → Client Key = a mesma que voce colou");
    log("2) Login Kit → Redirect URI EXATA: " + redirect);
    log("3) Products: Login Kit + Content Posting API");
    log("4) Scopes: user.info.basic, video.upload, video.publish");
    log("5) Sandbox: adicione sua conta TikTok como Target user");

    const A = window.VideoFlowApp;
    if (A) {
      const st = A.getState();
      st.accounts.tiktok = {
        connected: !!(secret || token),
        user: token ? "@conectando" : "@pendente",
        at: new Date().toISOString(),
        realApi: !!token,
        clientKey: key,
      };
      A.save();
      A.renderAll?.();
    }

    fillForm();
    toast(secret || token ? "TikTok configurado — use OAuth ou Token" : "Key salva — cole o Secret");

    if (secret && !token) {
      const go = confirm(
        "Keys salvas.\n\nANTES do OAuth confira no portal:\n" +
          "• Client Key igual a que colou\n" +
          "• Redirect URI:\n" +
          redirect +
          "\n\nAbrir login OAuth do TikTok agora?"
      );
      if (go) startOAuth();
    } else if (token) {
      creatorInfo().catch(() => {});
    }
  }

  async function handleOAuthCode(code) {
    const TT = window.TikTokAPI;
    const clientKey = $("#ttClientKey")?.value || TT.loadCfg().clientKey;
    const clientSecret = $("#ttClientSecret")?.value || TT.loadCfg().clientSecret;
    if (!clientKey || !clientSecret) {
      log("OAuth code recebido, mas falta Client Key/Secret salvos.");
      toast("Salve Client Key + Secret e tente OAuth de novo");
      return;
    }
    try {
      log("Trocando code por access_token...");
      TT.saveCfg({ clientKey, clientSecret });
      await TT.exchangeCode({
        clientKey,
        clientSecret,
        code,
        redirectUri: TT.redirectUriDefault(),
      });
      log("Token OK");
      toast("TikTok OAuth conectado");
      fillForm();
      // mark app account connected
      const A = window.VideoFlowApp;
      if (A) {
        const st = A.getState();
        st.accounts.tiktok = {
          connected: true,
          user: "@" + (TT.loadCfg().creatorUsername || "tiktok"),
          at: new Date().toISOString(),
          realApi: true,
        };
        A.save();
        A.renderAll?.();
      }
    } catch (e) {
      log("OAuth erro: " + e.message);
      toast(e.message);
    }
  }

  function saveKeys() {
    const TT = window.TikTokAPI;
    const rawKey = normalizeKey($("#ttClientKey")?.value || "");
    const v = rawKey ? validateClientKey(rawKey) : { ok: true, key: "" };
    if (rawKey && !v.ok) {
      showClientKeyError(true, v.msg);
      toast(v.msg);
      return;
    }
    if (v.key && $("#ttClientKey")) $("#ttClientKey").value = v.key;
    TT.saveCfg({
      clientKey: v.key || "",
      clientSecret: ($("#ttClientSecret")?.value || "").trim(),
      accessToken: ($("#ttAccessToken")?.value || "").trim(),
      proxyUrl: ($("#ttProxyUrl")?.value || "").trim(),
      privacyLevel: $("#ttPrivacy")?.value || "PUBLIC_TO_EVERYONE",
      redirectUri: TT.redirectUriDefault(),
    });
    if (v.key) showClientKeyError(false);
    log("Keys salvas no navegador (localStorage)." + (v.key ? " key len=" + v.key.length : ""));
    toast("Keys TikTok salvas");
    fillForm();
  }

  function needTokenHelp(err) {
    const msg = String(err?.message || err || "");
    log("ERRO: " + msg);
    toast(msg);
    // abre Contas e destaca token
    try {
      window.VideoFlowApp?.setView?.("contas");
      setTimeout(() => {
        const el = $("#ttAccessToken");
        if (el) {
          el.focus();
          el.style.outline = "2px solid #c9a227";
          setTimeout(() => (el.style.outline = ""), 4000);
        }
      }, 200);
    } catch (_) {}
  }

  async function creatorInfo() {
    const TT = window.TikTokAPI;
    try {
      saveKeys();
      if (!TT.loadCfg().accessToken) {
        needTokenHelp({
          message:
            "Falta Access Token. 1) Salve Client Key+Secret  2) OAuth Login TikTok  OU cole o token Bearer em Access Token",
        });
        return;
      }
      log("POST /v2/post/publish/creator_info/query/ ...");
      const res = await TT.queryCreatorInfo();
      const d = res.data || {};
      log(
        "OK @" +
          (d.creator_username || "?") +
          " · privacy: " +
          JSON.stringify(d.privacy_level_options || []) +
          " · max " +
          (d.max_video_post_duration_sec || "?") +
          "s"
      );
      TT.saveCfg({
        creatorUsername: d.creator_username,
        creatorNickname: d.creator_nickname,
        privacyOptions: d.privacy_level_options,
      });
      if ($("#ttPrivacy") && d.privacy_level_options?.length) {
        // keep selected if valid
      }
      fillForm();
      const A = window.VideoFlowApp;
      if (A && d.creator_username) {
        const st = A.getState();
        st.accounts.tiktok = {
          connected: true,
          user: "@" + d.creator_username,
          at: new Date().toISOString(),
          realApi: true,
        };
        A.save();
        A.renderAll?.();
      }
      toast("creator_info OK");
    } catch (e) {
      needTokenHelp(e);
    }
  }

  async function publishSelected() {
    const TT = window.TikTokAPI;
    const A = window.VideoFlowApp;
    if (!A) return toast("App nao carregou");
    saveKeys();
    if (!TT.loadCfg().accessToken) {
      needTokenHelp({
        message:
          "Falta Access Token para publicar. Contas → OAuth Login TikTok (ou cole o Bearer token).",
      });
      return;
    }
    const v = A.getSelected();
    if (!v) return toast("Selecione um video");
    const title = (v.description || v.title || "VideoFlow").slice(0, 2200);
    const privacy = $("#ttPrivacy")?.value || "PUBLIC_TO_EVERYONE";
    const blobUrl = A.getBlobUrl(v.id);

    try {
      // Prefer local File from import map — blob URL fetch
      let file = null;
      if (blobUrl && blobUrl.startsWith("blob:")) {
        log("Baixando blob local do vídeo importado...");
        const r = await fetch(blobUrl);
        const blob = await r.blob();
        file = new File([blob], v.file || "video.mp4", { type: blob.type || "video/mp4" });
      } else if (blobUrl && /^https?:/i.test(blobUrl)) {
        // demo URL — try PULL only if verified domain; else fetch as file (CORS may block)
        log("Tentando baixar URL do vídeo para FILE_UPLOAD...");
        try {
          const r = await fetch(blobUrl);
          const blob = await r.blob();
          file = new File([blob], v.file || "video.mp4", { type: "video/mp4" });
        } catch {
          log("Fetch da URL falhou (CORS). Tentando PULL_FROM_URL (precisa domínio verificado no TikTok)...");
          const result = await TT.publishVideoFromUrl(blobUrl, {
            title,
            privacyLevel: privacy,
            disableComment: false,
          }, { onLog: log, onStatus: (s) => log("status: " + JSON.stringify(s?.data || s)) });
          log("Publicado publish_id=" + result.publishId);
          A.updateVideo(v.id, { postedTiktok: true, status: "publicado" });
          toast("Publicado no TikTok (URL)");
          return;
        }
      }

      if (!file) {
        // last chance: user picks file
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "video/mp4,video/*";
        input.onchange = async () => {
          const f = input.files?.[0];
          if (!f) return;
          await doUpload(f, title, privacy, v);
        };
        input.click();
        toast("Escolha o arquivo MP4 para upload TikTok");
        return;
      }

      await doUpload(file, title, privacy, v);
    } catch (e) {
      needTokenHelp(e);
    }
  }

  async function doUpload(file, title, privacy, v) {
    const TT = window.TikTokAPI;
    const A = window.VideoFlowApp;
    log(`FILE_UPLOAD size=${file.size} name=${file.name}`);
    const result = await TT.publishVideoFromFile(
      file,
      { title, privacyLevel: privacy, disableComment: false, coverTimestampMs: 1000 },
      {
        onLog: log,
        onProgress: (p) => log(`upload ${(p * 100).toFixed(0)}%`),
        onStatus: (s) => log("status: " + JSON.stringify(s?.data || s)),
      }
    );
    log("SUCESSO publish_id=" + result.publishId);
    A.updateVideo(v.id, { postedTiktok: true, status: "publicado" });
    const st = A.getState();
    st.accounts.tiktok = {
      ...(st.accounts.tiktok || {}),
      connected: true,
      realApi: true,
      lastPublishId: result.publishId,
    };
    A.save();
    A.renderAll?.();
    toast("Publicado no TikTok!");
  }

  function startOAuth() {
    const TT = window.TikTokAPI;
    const redirect = TT.redirectUriDefault();
    const raw =
      normalizeKey($("#ttClientKey")?.value) ||
      normalizeKey(TT.loadCfg().clientKey) ||
      "";
    const v = validateClientKey(raw);
    if (!v.ok) {
      showClientKeyError(true, v.msg);
      toast(v.msg);
      return;
    }
    if ($("#ttClientKey")) $("#ttClientKey").value = v.key;
    saveKeys();

    // marca: se o usuario voltar sem code, provavelmente erro de client_key no TikTok
    sessionStorage.setItem("luxecut_tt_oauth_pending", v.key);
    sessionStorage.setItem("luxecut_tt_oauth_at", String(Date.now()));

    const ok = confirm(
      "Vai abrir o login TikTok.\n\n" +
        "Client Key: " +
        v.key.slice(0, 6) +
        "…" +
        v.key.slice(-4) +
        "\nRedirect:\n" +
        redirect +
        "\n\nSe aparecer erro client_key:\n" +
        "1) Portal → Credentials → copie a Client Key NOVA\n" +
        "2) Cole aqui e Salvar\n" +
        "3) Confirme Redirect URI no Login Kit\n\nContinuar?"
    );
    if (!ok) return;

    const url = TT.buildAuthorizeUrl({
      clientKey: v.key,
      redirectUri: redirect,
      state: "luxecut",
      scopes: ["user.info.basic", "video.publish", "video.upload"],
    });
    log("OAuth client_key=" + v.key.slice(0, 6) + "… redirect=" + redirect);
    log("URL: " + url);
    location.href = url;
  }

  function wire() {
    if (!window.TikTokAPI) {
      setTimeout(wire, 100);
      return;
    }
    // so privacy padrao — NAO injeta client_key morta automaticamente
    const cfg = window.TikTokAPI.loadCfg();
    if (!cfg.privacyLevel) {
      window.TikTokAPI.saveCfg({
        privacyLevel: DEFAULTS.privacyLevel,
        appName: DEFAULTS.appName,
      });
    }
    // se voltou da tela de erro TikTok (sem code), mostra banner
    const pending = sessionStorage.getItem("luxecut_tt_oauth_pending");
    const pendingAt = Number(sessionStorage.getItem("luxecut_tt_oauth_at") || 0);
    const params = new URLSearchParams(location.search);
    if (pending && !params.get("code") && Date.now() - pendingAt < 10 * 60 * 1000) {
      // usuario pode ter voltado com botao voltar apos erro client_key
      sessionStorage.setItem("luxecut_tt_key_err", "1");
      sessionStorage.removeItem("luxecut_tt_oauth_pending");
      sessionStorage.removeItem("luxecut_tt_oauth_at");
    } else if (params.get("code")) {
      sessionStorage.removeItem("luxecut_tt_oauth_pending");
      sessionStorage.removeItem("luxecut_tt_oauth_at");
      sessionStorage.removeItem("luxecut_tt_key_err");
    }

    fillForm();

    $("#ttSaveKeys")?.addEventListener("click", saveKeys);
    $("#ttOAuth")?.addEventListener("click", startOAuth);
    $("#ttCreatorInfo")?.addEventListener("click", creatorInfo);
    $("#ttPublishSelected")?.addEventListener("click", publishSelected);
    $("#ttAutoSetup")?.addEventListener("click", autoSetupAll);
    $("#ttCopyRedirect")?.addEventListener("click", () => {
      const v = $("#ttRedirect")?.value || window.TikTokAPI.redirectUriDefault();
      navigator.clipboard?.writeText(v).then(
        () => toast("Redirect URI copiada"),
        () => prompt("Copie a Redirect URI:", v)
      );
    });
    $("#ttTestStatus")?.addEventListener("click", async () => {
      try {
        saveKeys();
        const id = prompt("publish_id", window.TikTokAPI.loadCfg().lastPublishId || "");
        if (!id) return;
        const st = await window.TikTokAPI.fetchPublishStatus(id);
        log("status fetch: " + JSON.stringify(st, null, 2));
        toast("Status ok — veja log");
      } catch (e) {
        log("ERRO: " + e.message);
        toast(e.message);
      }
    });

    document.querySelectorAll('[data-view="contas"]').forEach((btn) => {
      btn.addEventListener("click", () => setTimeout(fillForm, 50));
    });

    // se veio com ?tt_setup=1 abre contas e roda auto
    const params = new URLSearchParams(location.search);
    if (params.get("tt_setup") === "1") {
      setTimeout(() => {
        window.VideoFlowApp?.enterApp?.();
        setTimeout(() => {
          window.VideoFlowApp?.setView?.("contas");
          autoSetupAll();
        }, 400);
      }, 300);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
