/**
 * Wire TikTok Content Posting API into LUXECUT UI
 * Auto-setup: preenche Client Key + redirect + privacidade.
 * Client Secret NUNCA vai no GitHub — so localStorage apos voce colar 1x.
 */
(function () {
  const $ = (s) => document.querySelector(s);

  // Client Key do app "Style"/LUXECUT (publico no fluxo OAuth)
  const DEFAULTS = {
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
    setTimeout(() => el.classList.remove("show"), 2800);
  }

  function fillForm() {
    const TT = window.TikTokAPI;
    if (!TT) return;
    const c = TT.loadCfg();
    // auto-preencher key se vazio
    const key = c.clientKey || DEFAULTS.clientKey;
    if ($("#ttClientKey")) $("#ttClientKey").value = key;
    if ($("#ttClientSecret")) $("#ttClientSecret").value = c.clientSecret || "";
    if ($("#ttAccessToken")) $("#ttAccessToken").value = c.accessToken || "";
    if ($("#ttProxyUrl")) $("#ttProxyUrl").value = c.proxyUrl || "";
    if ($("#ttPrivacy")) $("#ttPrivacy").value = c.privacyLevel || DEFAULTS.privacyLevel;
    if ($("#ttRedirect")) $("#ttRedirect").value = TT.redirectUriDefault();
    const label = $("#ttAccountLabel");
    if (label) {
      label.textContent = c.accessToken
        ? `Conectado${c.openId ? " · open_id " + c.openId : ""}${c.creatorUsername ? " · @" + c.creatorUsername : ""}`
        : key
          ? "Key pronta · falta Secret + OAuth ou Access Token"
          : "Desconectado";
    }
    // OAuth callback ?code=
    const params = new URLSearchParams(location.search);
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

    // Secret: so pede se ainda nao tiver no navegador
    let secret = existing.clientSecret || ($("#ttClientSecret")?.value || "").trim();
    if (!secret) {
      secret = (prompt(
        "Cole o Client Secret do TikTok (fica so no seu navegador, nao no GitHub):\n\nPortal → App → Credentials → Client secret",
        ""
      ) || "").trim();
    }

    const token = existing.accessToken || ($("#ttAccessToken")?.value || "").trim();

    TT.saveCfg({
      clientKey: DEFAULTS.clientKey,
      clientSecret: secret || existing.clientSecret || "",
      accessToken: token,
      privacyLevel: DEFAULTS.privacyLevel,
      proxyUrl: ($("#ttProxyUrl")?.value || existing.proxyUrl || "").trim(),
      redirectUri: redirect,
      appName: DEFAULTS.appName,
      autoConfigured: true,
    });

    if ($("#ttClientKey")) $("#ttClientKey").value = DEFAULTS.clientKey;
    if ($("#ttClientSecret") && secret) $("#ttClientSecret").value = secret;
    if ($("#ttPrivacy")) $("#ttPrivacy").value = DEFAULTS.privacyLevel;
    if ($("#ttRedirect")) $("#ttRedirect").value = redirect;

    log("AUTO-SETUP LUXECUT");
    log("Client Key: " + DEFAULTS.clientKey);
    log("Redirect URI: " + redirect);
    log("Privacy: " + DEFAULTS.privacyLevel);
    log(
      secret
        ? "Client Secret: salvo localmente (ok)"
        : "Client Secret: AINDA FALTA — cole no campo e Salvar"
    );
    log("No portal TikTok confira:");
    log("1) App name: LUXECUT");
    log("2) Redirect URI exatamente: " + redirect);
    log("3) Products: Login Kit + Content Posting API");
    log("4) Scopes: user.info.basic, video.upload, video.publish");
    log("5) Save + Submit for review (producao)");

    const A = window.VideoFlowApp;
    if (A) {
      const st = A.getState();
      st.accounts.tiktok = {
        connected: !!(secret || token),
        user: token ? "@conectando" : "@pendente",
        at: new Date().toISOString(),
        realApi: !!token,
        clientKey: DEFAULTS.clientKey,
      };
      A.save();
      A.renderAll?.();
    }

    fillForm();
    toast(secret || token ? "TikTok configurado — use OAuth ou Token" : "Key ok — cole o Secret");

    // se tem secret e nao tem token, oferece OAuth
    if (secret && !token) {
      const go = confirm(
        "Configuracao salva.\n\nAbrir login OAuth do TikTok agora para gerar Access Token?"
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
    TT.saveCfg({
      clientKey: $("#ttClientKey")?.value?.trim() || "",
      clientSecret: $("#ttClientSecret")?.value?.trim() || "",
      accessToken: $("#ttAccessToken")?.value?.trim() || "",
      proxyUrl: $("#ttProxyUrl")?.value?.trim() || "",
      privacyLevel: $("#ttPrivacy")?.value || "PUBLIC_TO_EVERYONE",
    });
    log("Keys salvas no navegador (localStorage).");
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
    saveKeys();
    const clientKey = $("#ttClientKey")?.value?.trim() || TT.loadCfg().clientKey;
    if (!clientKey) {
      toast("Cole o Client Key primeiro");
      return;
    }
    const url = TT.buildAuthorizeUrl({
      clientKey,
      redirectUri: TT.redirectUriDefault(),
      scopes: ["user.info.basic", "video.publish", "video.upload"],
    });
    log("Abrindo OAuth: " + url);
    location.href = url;
  }

  function wire() {
    if (!window.TikTokAPI) {
      setTimeout(wire, 100);
      return;
    }
    // auto: grava client key padrao se ainda nao tiver
    const cfg = window.TikTokAPI.loadCfg();
    if (!cfg.clientKey) {
      window.TikTokAPI.saveCfg({
        clientKey: DEFAULTS.clientKey,
        privacyLevel: DEFAULTS.privacyLevel,
        appName: DEFAULTS.appName,
      });
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
