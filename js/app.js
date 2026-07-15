/* VideoFlow Pro — full client app */
(function () {
  "use strict";

  // GitHub Pages base path fix (critical for /videoflow-pro/)
  (function fixBase() {
    try {
      const p = location.pathname || "/";
      let base = "/";
      if (p.includes("/videoflow-pro")) base = "/videoflow-pro/";
      else if (p.endsWith(".html")) base = p.replace(/[^/]+$/, "");
      else if (p.endsWith("/")) base = p;
      else base = p + "/";
      window.APP_BASE = base;
      const existing = document.querySelector("base");
      if (!existing) {
        const b = document.createElement("base");
        b.href = base;
        document.head.insertBefore(b, document.head.firstChild);
      } else {
        existing.href = base;
      }
      // force trailing slash for project pages root
      if (p.endsWith("/videoflow-pro")) {
        history.replaceState(null, "", p + "/" + location.search + location.hash);
      }
    } catch (_) {}
  })();

  function asset(path) {
    if (!path) return path;
    if (/^https?:\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) return path;
    const base = window.APP_BASE || "./";
    return base + String(path).replace(/^\//, "");
  }

  const LIB = window.LIBRARY || { videos: [], coverPool: [], postsPerDay: 3 };
  const STORAGE_KEY = "vf_pro_cloud_v3_shortcap";
  const fileBlobs = new Map(); // id -> objectURL

  // Legendas curtas: curiosidade + seguir, max 5 #, sem detalhes do video
  const VIRAL_HOOKS = [
    "Isso aqui e so o comeco 🔥",
    "Se gostou, fica 👀",
    "Voce ainda nao viu nada 🖤",
    "O feed vai mudar ✨",
    "Nao pisca 🏎️",
    "Isso e padrao 💎",
    "Sua nova fixacao 🥂",
    "Tem mais vindo 🔥",
  ];
  const VIRAL_TAGS = [
    "#fyp", "#foryou", "#viral", "#supercar", "#luxurycars",
  ];

  let videos = (LIB.videos || []).map((v) => ({
    ...v,
    type: "short",
    format: "9:16",
    markups: v.markups || [],
    boost: v.boost || 0,
    viewsTiktok: v.viewsTiktok || 0,
    viewsInstagram: v.viewsInstagram || 0,
    likesTiktok: v.likesTiktok || 0,
    likesInstagram: v.likesInstagram || 0,
    postedTiktok: !!v.postedTiktok,
    postedInstagram: !!v.postedInstagram,
    status: v.status || "pronto",
    hasLocalFile: !!v.hasLocalFile,
  }));

  let state = {
    view: "dashboard",
    selectedId: videos[0]?.id || 1,
    filter: "todos",
    query: "",
    tool: "select",
    drawing: null,
    queue: [],
    accounts: {
      tiktok: { connected: false, user: "" },
      instagram: { connected: false, user: "" },
    },
    modalPlatform: null,
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.videos?.length) {
        const map = Object.fromEntries(d.videos.map((v) => [v.id, v]));
        videos = videos.map((v) => {
          const s = map[v.id];
          if (!s) return v;
          return {
            ...v,
            ...s,
            cover: v.cover, // keep hosted covers
            coverTitle: v.coverTitle || s.coverTitle,
            coverPlace: v.coverPlace || s.coverPlace,
            hasLocalFile: false, // blobs not persisted
          };
        });
        // add user-created videos without files
        d.videos.forEach((s) => {
          if (!videos.find((v) => v.id === s.id)) {
            videos.push({ ...s, hasLocalFile: false, markups: s.markups || [] });
          }
        });
      }
      if (d.queue) state.queue = d.queue;
      if (d.accounts) state.accounts = d.accounts;
    } catch (_) {}
  }

  function save() {
    const light = videos.map(({ ...v }) => {
      const copy = { ...v };
      delete copy._blob;
      return copy;
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ videos: light, queue: state.queue, accounts: state.accounts })
    );
  }

  function toast(m) {
    const el = $("#toast");
    el.textContent = m;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function selected() {
    return videos.find((v) => v.id === state.selectedId) || videos[0];
  }

  function fmt(n) {
    n = Math.round(n || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  function coverSrc(v) {
    return asset(v.cover || "covers/car-01-mansao.jpg");
  }

  function mediaSrc(v) {
    if (fileBlobs.has(v.id)) return fileBlobs.get(v.id);
    if (v.demoUrl) return v.demoUrl;
    return coverSrc(v);
  }

  function hasPlayable(v) {
    return fileBlobs.has(v.id) || !!v.demoUrl;
  }

  function isOldLongCaption(text) {
    if (!text) return true;
    const hashes = (text.match(/#/g) || []).length;
    if (hashes > 5) return true;
    if (/Alta resolu|9:16|som limpo|Comenta GARAGEM|Clip \d|· |coverPlace|Pôr do sol|porto/i.test(text))
      return true;
    if (text.length > 160) return true;
    return false;
  }

  function genViral(v) {
    if (window.VideoFlowAI?.bestDescription) {
      try {
        const t = window.VideoFlowAI.bestDescription(v).text;
        if (t && !isOldLongCaption(t)) return t;
        if (window.VideoFlowAI.generateDescription) {
          return window.VideoFlowAI.generateDescription(v, "viral").text;
        }
      } catch (_) {}
    }
    const hook = VIRAL_HOOKS[v.id % VIRAL_HOOKS.length];
    const ctas = [
      "Segue pra nao perder",
      "Segue se e teu estilo",
      "Ativa o sininho",
      "Entra pro clube",
    ];
    const cta = ctas[v.id % ctas.length];
    const tags = pickTags(v);
    // curta: hook + CTA + max 5 #  — SEM detalhes do video
    return `${hook}\n${cta}\n\n${tags.join(" ")}`;
  }

  function pickTags(v) {
    const base = [...VIRAL_TAGS];
    const start = (v.id * 3) % base.length;
    const set = [];
    for (let i = 0; i < 5; i++) set.push(base[(start + i) % base.length]);
    return [...new Set(set)].slice(0, 5);
  }

  function forceShortCaptionsAll() {
    videos.forEach((v) => {
      v.description = genViral(v);
    });
    save();
  }

  function extractHash(text) {
    return text.match(/#[\w\u00C0-\u024F]+/g) || [];
  }

  /* covers */
  function reassignCovers() {
    const metas = LIB.coverPool || [];
    const files = metas.map((m) => m.file);
    let prev = -1;
    videos.forEach((v, i) => {
      let idx = i % files.length;
      if (idx === prev) idx = (idx + 1) % files.length;
      prev = idx;
      const file = files[idx];
      const meta = metas.find((m) => m.file === file) || {};
      v.cover = "covers/" + file;
      v.coverTitle = meta.title || file;
      v.coverPlace = meta.place || "luxury location";
      v.format = "9:16";
      v.type = "short";
    });
    toast("Capas 9:16 redistribuídas (sem repetir em sequência)");
    save();
    renderAll();
  }

  function reassignOneCover(v) {
    const pool = (LIB.coverPool || []).map((c) => c.file);
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if ("covers/" + pick === v.cover) pick = pool[(pool.indexOf(pick) + 1) % pool.length];
    const meta = (LIB.coverPool || []).find((c) => c.file === pick) || {};
    v.cover = "covers/" + pick;
    v.coverTitle = meta.title || pick;
    v.coverPlace = meta.place || "";
    save();
  }

  /* schedule 3/day */
  function daySlots(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return [11, 15.5, 20].map((h) => {
      const x = new Date(d);
      const hh = Math.floor(h);
      const mm = Math.round((h - hh) * 60);
      x.setHours(hh, mm, 0, 0);
      return x;
    });
  }

  function scheduleDays(numDays = 1) {
    let added = 0;
    const used = new Set(
      state.queue
        .filter((q) => q.status === "agendado")
        .map((q) => q.videoId + ":" + q.platform)
    );
    const alreadyQueued = new Set(
      state.queue.filter((q) => q.status === "agendado").map((q) => q.videoId)
    );

    for (let day = 0; day < numDays; day++) {
      const base = new Date();
      base.setDate(base.getDate() + day);
      const slots = daySlots(base);
      const pick = videos
        .filter(
          (v) =>
            !v.postedTiktok &&
            !v.postedInstagram &&
            !alreadyQueued.has(v.id)
        )
        .slice(0, 3);

      if (!pick.length) break;

      pick.forEach((v, i) => {
        alreadyQueued.add(v.id);
        if (!v.description || v.description.length < 20) v.description = genViral(v);
        const when = slots[i] || slots[0];
        ["tiktok", "instagram"].forEach((platform) => {
          const key = v.id + ":" + platform;
          if (used.has(key)) return;
          if (platform === "tiktok" && v.postedTiktok) return;
          if (platform === "instagram" && v.postedInstagram) return;
          state.queue.push({
            id: Date.now() + Math.random(),
            videoId: v.id,
            title: v.title,
            cover: v.cover,
            description: v.description,
            platform,
            when: when.toISOString(),
            status: "agendado",
            boost: v.boost || 0,
          });
          used.add(key);
          added++;
        });
        v.status = "agendado";
      });
    }
    state.queue.sort((a, b) => new Date(a.when) - new Date(b.when));
    save();
    toast(added ? `${added} itens na fila (3 vídeos/dia × TT+IG)` : "Sem vídeos livres para agendar");
    renderAll();
  }

  function processQueue() {
    const now = Date.now();
    let n = 0;
    state.queue.forEach((q) => {
      if (q.status !== "agendado") return;
      if (new Date(q.when).getTime() > now + 5000) return;
      const v = videos.find((x) => x.id === q.videoId);
      if (!v) return;
      if (q.platform === "tiktok" && v.postedTiktok) {
        q.status = "bloqueado";
        q.note = "já postado no TikTok";
        return;
      }
      if (q.platform === "instagram" && v.postedInstagram) {
        q.status = "bloqueado";
        q.note = "já postado no Instagram";
        return;
      }
      q.status = "publicado";
      if (q.platform === "tiktok") {
        v.postedTiktok = true;
        const base = 800 + Math.random() * 12000;
        v.viewsTiktok = Math.round(base * (1 + (v.boost || 0) * 0.85));
        v.likesTiktok = Math.round(v.viewsTiktok * (0.04 + Math.random() * 0.08));
      } else {
        v.postedInstagram = true;
        const base = 600 + Math.random() * 9000;
        v.viewsInstagram = Math.round(base * (1 + (v.boost || 0) * 0.75));
        v.likesInstagram = Math.round(v.viewsInstagram * (0.05 + Math.random() * 0.09));
      }
      if (v.postedTiktok && v.postedInstagram) v.status = "publicado";
      n++;
    });
    save();
    toast(n ? `${n} postagens processadas` : "Nada no horário ainda");
    renderAll();
  }

  function applyBoost(v, level = 1) {
    v.boost = Math.min(5, (v.boost || 0) + level);
    if (v.viewsTiktok) v.viewsTiktok = Math.round(v.viewsTiktok * (1.15 + level * 0.1));
    if (v.viewsInstagram) v.viewsInstagram = Math.round(v.viewsInstagram * (1.12 + level * 0.1));
    save();
  }

  function enqueueOne(platform) {
    const v = selected();
    if (!v) return;
    if (platform === "tiktok" && v.postedTiktok) return toast("Já postado no TikTok");
    if (platform === "instagram" && v.postedInstagram) return toast("Já postado no Instagram");
    if (state.queue.some((q) => q.videoId === v.id && q.platform === platform && q.status === "agendado")) {
      return toast("Já está na fila dessa rede");
    }
    if (!v.description) v.description = genViral(v);
    const when = new Date();
    when.setHours(when.getHours() + 1, 0, 0, 0);
    state.queue.push({
      id: Date.now() + Math.random(),
      videoId: v.id,
      title: v.title,
      cover: v.cover,
      description: v.description,
      platform,
      when: when.toISOString(),
      status: "agendado",
      boost: v.boost || 0,
    });
    v.status = "agendado";
    save();
    toast(`Na fila ${platform}`);
    renderAll();
  }

  /* import files */
  function importFiles(fileList) {
    const files = [...fileList].filter((f) => /\.(mp4|mov|webm|mkv)$/i.test(f.name));
    if (!files.length) return toast("Envie vídeos MP4/MOV/WEBM");
    let maxId = Math.max(0, ...videos.map((v) => v.id));
    const metas = LIB.coverPool || [];
    files.forEach((f, i) => {
      maxId++;
      const meta = metas[(maxId - 1) % metas.length] || {};
      const id = maxId;
      const url = URL.createObjectURL(f);
      fileBlobs.set(id, url);
      const v = {
        id,
        title: f.name.replace(/\.[^.]+$/, ""),
        file: f.name,
        size: f.size,
        type: "short",
        format: "9:16",
        status: "pronto",
        postedTiktok: false,
        postedInstagram: false,
        cover: "covers/" + (meta.file || "car-01-mansao.jpg"),
        coverTitle: meta.title || "Luxury car",
        coverPlace: meta.place || "cenário premium",
        description: "",
        hashtags: [],
        boost: 0,
        viewsTiktok: 0,
        viewsInstagram: 0,
        likesTiktok: 0,
        likesInstagram: 0,
        markups: [],
        hasLocalFile: true,
      };
      v.description = genViral(v);
      videos.unshift(v);
    });
    // match existing catalog by filename
    files.forEach((f) => {
      const base = f.name.toLowerCase().replace(/\s+/g, "-");
      const match = videos.find(
        (v) =>
          v.file &&
          (v.file.toLowerCase() === f.name.toLowerCase() ||
            v.file.toLowerCase().includes(base.replace(/\.[^.]+$/, "")))
      );
      if (match && !fileBlobs.has(match.id)) {
        fileBlobs.set(match.id, URL.createObjectURL(f));
        match.hasLocalFile = true;
      }
    });
    save();
    toast(`${files.length} vídeo(s) importado(s)`);
    renderAll();
    botSay(`Importei <strong>${files.length}</strong> vídeo(s). Capas 9:16 e legendas virais já aplicadas.`);
  }

  /* nav */
  function setView(view) {
    state.view = view;
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
    $$(".nav").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
    if (view === "estudio") loadStudio();
    if (view === "preview") renderPreview();
    if (view === "capas") renderCovers();
    if (view === "analytics") renderAnalytics();
    if (view === "agenda") renderQueue();
    if (view === "import") setupDropzone();
  }

  function enterApp() {
    try {
      const landing = $("#landing");
      const shell = $("#shell");
      if (landing) landing.classList.add("hidden");
      if (shell) {
        shell.classList.add("on");
        shell.style.display = "grid";
      }
      document.body.style.overflow = "hidden";
      renderAll();
      try { loadStudio(); } catch (e) { console.warn(e); }
      setView("dashboard");
      botSay(
        `Tudo operacional · <strong>${videos.length} vídeos</strong> com demo online · capas 9:16 · Editor Pro · IA · agenda 3/dia.`
      );
      toast("Painel aberto — use Importar ou assista os demos");
    } catch (err) {
      console.error(err);
      alert("Erro ao abrir painel: " + err.message);
    }
  }

  /* render */
  function renderAccounts() {
    const tt = state.accounts.tiktok;
    const ig = state.accounts.instagram;
    $("#dotTT").classList.toggle("on", tt.connected);
    $("#dotIG").classList.toggle("on", ig.connected);
    $("#lblTT").textContent = tt.connected ? tt.user : "TikTok off";
    $("#lblIG").textContent = ig.connected ? ig.user : "Instagram off";
  }

  function renderKPIs() {
    const ready = videos.filter((v) => !v.postedTiktok && !v.postedInstagram).length;
    const posted = videos.filter((v) => v.postedTiktok || v.postedInstagram).length;
    const today = new Date().toDateString();
    const todayQ = state.queue.filter(
      (q) => q.status === "agendado" && new Date(q.when).toDateString() === today
    ).length;
    const vtt = videos.reduce((s, v) => s + (v.viewsTiktok || 0), 0);
    const vig = videos.reduce((s, v) => s + (v.viewsInstagram || 0), 0);
    $("#kTotal").textContent = videos.length;
    $("#kReady").textContent = ready;
    $("#kPosted").textContent = posted;
    $("#kToday").textContent = Math.min(3, Math.ceil(todayQ / 2));
    $("#kViewsTT").textContent = fmt(vtt);
    $("#kViewsIG").textContent = fmt(vig);
    $("#cLib").textContent = videos.length;
    $("#cQ").textContent = state.queue.filter((q) => q.status === "agendado").length;
  }

  function filtered() {
    let list = videos.slice();
    if (state.query) {
      const q = state.query.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.file || "").toLowerCase().includes(q) ||
          (v.coverTitle || "").toLowerCase().includes(q)
      );
    }
    if (state.filter === "pronto") list = list.filter((v) => v.status === "pronto");
    if (state.filter === "agendado") list = list.filter((v) => v.status === "agendado");
    if (state.filter === "publicado")
      list = list.filter((v) => v.status === "publicado" || v.postedTiktok || v.postedInstagram);
    if (state.filter === "livre") list = list.filter((v) => !v.postedTiktok && !v.postedInstagram);
    return list;
  }

  function cardHTML(v, i) {
    const posted = v.postedTiktok || v.postedInstagram;
    return `
      <article class="card ${state.selectedId === v.id ? "selected" : ""} ${posted ? "posted" : ""}"
        data-id="${v.id}" style="animation-delay:${Math.min(i * 0.015, 0.35)}s">
        <div class="thumb">
          <img src="${coverSrc(v)}" alt="" loading="lazy" />
          <span class="badge fmt">9:16</span>
          <span class="badge st ${v.status}">${v.status}</span>
          ${v.boost ? `<span class="badge boost">boost x${v.boost}</span>` : ""}
          <div class="views-bar">
            <span>♪ ${fmt(v.viewsTiktok)}</span>
            <span>📷 ${fmt(v.viewsInstagram)}</span>
          </div>
        </div>
        <div class="meta">
          <h3>${esc(v.title)}</h3>
          <div class="row">
            <span>${esc(v.coverTitle || "capa")}</span>
            <span>${posted ? "postado" : "livre"}</span>
          </div>
        </div>
      </article>`;
  }

  function bindCards(root) {
    $$(".card", root).forEach((c) => {
      c.addEventListener("click", () => {
        state.selectedId = Number(c.dataset.id);
        renderAll();
        setView("estudio");
      });
    });
  }

  function renderGrid() {
    const list = filtered();
    $("#grid").innerHTML = list.length
      ? list.map(cardHTML).join("")
      : `<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:40px">Nenhum vídeo</div>`;
    bindCards($("#grid"));
  }

  function renderTodayQueue() {
    const today = new Date().toDateString();
    const items = state.queue.filter((q) => new Date(q.when).toDateString() === today);
    if (!items.length) {
      $("#todayQueue").innerHTML =
        `<div style="color:var(--muted);font-size:.86rem">Fila do dia vazia. Clique em <strong>Gerar dia (3 posts)</strong>.</div>`;
      return;
    }
    $("#todayQueue").innerHTML = items
      .map(
        (q) => `
      <div class="queue-item">
        <img src="${q.cover}" alt="" />
        <div>
          <h4>${esc(q.title)}</h4>
          <p>${q.platform === "tiktok" ? "♪ TikTok" : "📷 Instagram"} · ${q.status}</p>
        </div>
        <div class="when">${new Date(q.when).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>`
      )
      .join("");
  }

  function renderQueue() {
    if (!state.queue.length) {
      $("#fullQueue").innerHTML = `<div style="color:var(--muted)">Nada na fila.</div>`;
      return;
    }
    $("#fullQueue").innerHTML = state.queue
      .slice()
      .sort((a, b) => new Date(a.when) - new Date(b.when))
      .map(
        (q) => `
      <div class="queue-item">
        <img src="${q.cover}" alt="" />
        <div>
          <h4>${esc(q.title)}</h4>
          <p>${q.platform === "tiktok" ? "♪ TikTok" : "📷 Instagram"} · ${q.status}${
          q.boost ? " · boost x" + q.boost : ""
        }${q.note ? " · " + esc(q.note) : ""}</p>
        </div>
        <div class="when">${new Date(q.when).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}</div>
      </div>`
      )
      .join("");
  }

  function renderCovers() {
    const pool = LIB.coverPool || [];
    $("#coverGallery").innerHTML = pool
      .map(
        (c) => `
      <div class="cover-item">
        <img src="${asset("covers/" + c.file)}" alt="${esc(c.title)}" />
        <div class="ci"><strong>${esc(c.title)}</strong>${esc(c.place)} · 9:16</div>
      </div>`
      )
      .join("");
    $("#coverMap").innerHTML = videos
      .slice(0, 40)
      .map(
        (v) => `
      <div class="queue-item">
        <img src="${coverSrc(v)}" alt="" />
        <div>
          <h4>${esc(v.title)}</h4>
          <p>${esc(v.coverTitle)} — ${esc(v.coverPlace)}</p>
        </div>
        <div class="when">9:16</div>
      </div>`
      )
      .join("");
  }

  function renderPreview() {
    const sel = $("#previewSelect");
    sel.innerHTML = videos
      .map(
        (v) =>
          `<option value="${v.id}" ${v.id === state.selectedId ? "selected" : ""}>${esc(v.title)}</option>`
      )
      .join("");
    const v = selected();
    if (!v) return;
    const ttUser = state.accounts.tiktok.user || "@luxury.garage";
    const igUser = state.accounts.instagram.user || "@luxury.garage";
    const src = mediaSrc(v);
    const isVid = hasPlayable(v);
    const media = isVid
      ? `<video src="${src}" muted autoplay loop playsinline controls style="width:100%;height:100%;object-fit:cover"></video>`
      : `<img src="${coverSrc(v)}" alt="" />`;
    $("#phones").innerHTML = `
      <div class="phone">
        <div class="phone-notch"></div>
        <div class="phone-screen">
          ${media}
          <div class="tt-ui">
            <div class="tt-right">
              <div><div class="tt-ico">♡</div>${fmt(v.likesTiktok || 12800)}</div>
              <div><div class="tt-ico">💬</div>${fmt(Math.round((v.likesTiktok || 400) * 0.12))}</div>
              <div><div class="tt-ico">↗</div>${fmt(Math.round((v.viewsTiktok || 900) * 0.04))}</div>
              <div><div class="tt-ico">♪</div></div>
            </div>
            <div class="tt-bottom">
              <div class="user">${esc(ttUser)}</div>
              <div class="cap">${esc(v.description || "")}</div>
            </div>
          </div>
        </div>
        <div class="phone-label">♪ TikTok · ${fmt(v.viewsTiktok)} views</div>
      </div>
      <div class="phone ig">
        <div class="phone-notch"></div>
        <div class="phone-screen">
          ${isVid ? `<video src="${src}" muted autoplay loop playsinline controls style="width:100%;height:100%;object-fit:cover"></video>` : `<img src="${coverSrc(v)}" alt="" />`}
          <div class="tt-ui">
            <div class="tt-right">
              <div><div class="tt-ico">♡</div>${fmt(v.likesInstagram || 9200)}</div>
              <div><div class="tt-ico">💬</div>${fmt(Math.round((v.likesInstagram || 300) * 0.1))}</div>
              <div><div class="tt-ico">➤</div>${fmt(Math.round((v.viewsInstagram || 700) * 0.03))}</div>
            </div>
            <div class="tt-bottom">
              <div class="user">${esc(igUser)}</div>
              <div class="cap">${esc(v.description || "")}</div>
            </div>
          </div>
        </div>
        <div class="phone-label">📷 Instagram Reels · ${fmt(v.viewsInstagram)} views</div>
      </div>`;
    $("#previewDesc").textContent = v.description || "";
    $("#previewHash").innerHTML = extractHash(v.description || "")
      .map((h) => `<span class="hash">${esc(h)}</span>`)
      .join("");
  }

  function renderAnalytics() {
    const vtt = videos.reduce((s, v) => s + (v.viewsTiktok || 0), 0);
    const vig = videos.reduce((s, v) => s + (v.viewsInstagram || 0), 0);
    const ltt = videos.reduce((s, v) => s + (v.likesTiktok || 0), 0);
    const lig = videos.reduce((s, v) => s + (v.likesInstagram || 0), 0);
    const boosted = videos.filter((v) => v.boost > 0).length;
    const postedN = videos.filter((v) => v.postedTiktok || v.postedInstagram).length || 1;
    $("#aTT").textContent = fmt(vtt);
    $("#aIG").textContent = fmt(vig);
    $("#aTTL").textContent = fmt(ltt);
    $("#aIGL").textContent = fmt(lig);
    $("#aBoost").textContent = boosted;
    $("#aAvg").textContent = fmt((vtt + vig) / postedN);

    const top = videos
      .slice()
      .sort((a, b) => b.viewsTiktok + b.viewsInstagram - (a.viewsTiktok + a.viewsInstagram))
      .slice(0, 8);
    $("#topVideos").innerHTML = top
      .map(
        (v) => `
      <div class="queue-item">
        <img src="${coverSrc(v)}" alt="" />
        <div>
          <h4>${esc(v.title)}</h4>
          <p>♪ ${fmt(v.viewsTiktok)} · 📷 ${fmt(v.viewsInstagram)}${v.boost ? " · boost x" + v.boost : ""}</p>
        </div>
        <div class="when">${fmt(v.viewsTiktok + v.viewsInstagram)}</div>
      </div>`
      )
      .join("");

    const days = ["S", "T", "Q", "Q", "S", "S", "D"];
    $("#weekChart").innerHTML = days
      .map((d, i) => {
        const h1 = 20 + ((i * 17 + vtt) % 80);
        const h2 = 15 + ((i * 13 + vig) % 70);
        return `<div class="bar" style="height:${h1}%" title="TT"><span>${d}</span></div>
                <div class="bar ig" style="height:${h2}%"></div>`;
      })
      .join("");
  }

  function renderAll() {
    renderAccounts();
    renderKPIs();
    renderGrid();
    renderTodayQueue();
    if (state.view === "agenda") renderQueue();
    if (state.view === "preview") renderPreview();
    if (state.view === "analytics") renderAnalytics();
    if (state.view === "capas") renderCovers();
    save();
  }

  /* studio */
  function loadStudio() {
    const sel = $("#studioSelect");
    if (!sel) return;
    sel.innerHTML = videos
      .map(
        (v) =>
          `<option value="${v.id}" ${v.id === state.selectedId ? "selected" : ""}>${esc(v.title)}</option>`
      )
      .join("");
    paintStudio();
  }

  function paintStudio() {
    const v = selected();
    if (!v) return;
    const img = $("#frameImg");
    const vid = $("#frameVid");
    if (fileBlobs.has(v.id)) {
      img.style.display = "none";
      vid.style.display = "block";
      vid.src = fileBlobs.get(v.id);
      vid.muted = true;
      vid.loop = true;
      vid.play().catch(() => {});
    } else {
      vid.style.display = "none";
      vid.removeAttribute("src");
      img.style.display = "block";
      img.src = coverSrc(v);
    }
    const tEl = $("#stTitle") || $("#edTitle");
    const sEl = $("#stStatus") || $("#edStatus");
    const dEl = $("#stDesc") || $("#edDesc");
    if (tEl) tEl.value = v.title;
    if (sEl) sEl.value = v.status;
    if (dEl) dEl.textContent = v.description || "";
    if ($("#edHash")) $("#edHash").innerHTML = extractHash(v.description || "")
      .concat(pickTags(v))
      .filter((x, i, a) => a.indexOf(x) === i)
      .slice(0, 14)
      .map((h) => `<span class="hash">${esc(h)}</span>`)
      .join("");
    renderMarkups(v);
  }

  function renderMarkups(v) {
    $("#markups").innerHTML = (v.markups || [])
      .map((m) => {
        if (m.kind === "text") {
          return `<div class="markup text-layer" style="left:${m.x}%;top:${m.y}%;width:${m.w}%;height:${m.h}%">${esc(
            m.text
          )}</div>`;
        }
        return `<div class="markup" style="left:${m.x}%;top:${m.y}%;width:${m.w}%;height:${m.h}%"><span class="label">${esc(
          m.label || "área"
        )}</span></div>`;
      })
      .join("");
  }

  /* chat */
  function botSay(html) {
    const box = $("#chatMsgs");
    if (!box) return;
    const d = document.createElement("div");
    d.className = "msg bot";
    d.innerHTML = `<span class="who">Assistente pro</span>${html}`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }
  function userSay(t) {
    const box = $("#chatMsgs");
    const d = document.createElement("div");
    d.className = "msg user";
    d.innerHTML = `<span class="who">Você</span>${esc(t)}`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }
  function ai(input) {
    const v = selected();
    const t = input.toLowerCase();
    const out = [];
    if (/legenda|descri|viral|chamativ|hashtag|#/.test(t)) {
      v.description = genViral(v);
      paintStudio();
      save();
      out.push("Legenda <strong>viral</strong> + hashtags top aplicadas.");
    }
    if (/boost|views|viws/.test(t)) {
      applyBoost(v, 1);
      out.push(`Boost <code>x${v.boost}</code> aplicado.`);
    }
    if (/capa|cover|troca/.test(t)) {
      reassignOneCover(v);
      paintStudio();
      out.push(`Nova capa: <strong>${esc(v.coverTitle)}</strong>.`);
    }
    if (/agenda|3 post|três|3\/dia|amanhã|auto|semana|7/.test(t)) {
      scheduleDays(/7|semana/.test(t) ? 7 : 1);
      out.push("Agenda: <strong>3 vídeos/dia</strong> TT+IG, sem repostar.");
    }
    if (/detalh|info|mostra/.test(t)) {
      out.push(`
        <ul>
          <li>${esc(v.title)}</li>
          <li>9:16 · ${esc(v.coverTitle)}</li>
          <li>TT: ${v.postedTiktok ? "postado" : "livre"} · ${fmt(v.viewsTiktok)} views</li>
          <li>IG: ${v.postedInstagram ? "postado" : "livre"} · ${fmt(v.viewsInstagram)} views</li>
          <li>Boost x${v.boost || 0}</li>
        </ul>`);
    }
    if (/texto|luxury/.test(t)) {
      if (!v.markups) v.markups = [];
      const m = input.match(/["“](.+?)["”]/);
      const text = m ? m[1] : "LUXURY";
      v.markups.push({ kind: "text", x: 8, y: 72, w: 84, h: 14, text });
      renderMarkups(v);
      save();
      out.push(`Texto <code>${esc(text)}</code> na capa.`);
    }
    if (/fila|tiktok|instagram|postar/.test(t)) {
      if (/tiktok|tt|ambos|os dois/.test(t) || !/insta|ig/.test(t)) enqueueOne("tiktok");
      if (/insta|ig|reels|ambos|os dois/.test(t) || !/tiktok|tt/.test(t)) enqueueOne("instagram");
      out.push("Enfileirado (anti re-post ativo).");
    }
    if (!out.length) {
      out.push(
        `Comandos: legenda viral · boost · capa · agenda 3 posts · fila TT/IG · detalhes. Ex: <code>legenda viral + boost</code>`
      );
    }
    botSay(out.join("<br><br>"));
    renderAll();
  }

  function setupDropzone() {
    const dz = $("#dropzone");
    const input = $("#fileInput");
    if (!dz || dz._ready) return;
    dz._ready = true;
    dz.addEventListener("click", () => input.click());
    input.addEventListener("change", () => importFiles(input.files));
    ["dragenter", "dragover"].forEach((ev) =>
      dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.add("drag");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.remove("drag");
      })
    );
    dz.addEventListener("drop", (e) => importFiles(e.dataTransfer.files));
  }

  /* init bindings */
  function bindUI() {
    $("#btnEnter")?.addEventListener("click", enterApp);
    $$("[data-view]").forEach((el) =>
      el.addEventListener("click", () => setView(el.dataset.view))
    );
    $("#btnAutoDay")?.addEventListener("click", () => scheduleDays(1));
    $("#btnAutoDay2")?.addEventListener("click", () => scheduleDays(7));
    $("#btnProcess")?.addEventListener("click", processQueue);
    $("#btnRegenAll")?.addEventListener("click", () => {
      forceShortCaptionsAll();
      toast("Legendas curtas: max 5 #, foco em seguir");
      renderAll();
      try {
        loadStudio();
      } catch (_) {}
    });
    $("#btnReassignCovers")?.addEventListener("click", reassignCovers);
    $("#btnReassignCovers2")?.addEventListener("click", reassignCovers);
    $("#btnSimGrowth")?.addEventListener("click", () => {
      videos.forEach((v) => {
        if (v.postedTiktok) {
          v.viewsTiktok = Math.round(v.viewsTiktok * (1.05 + Math.random() * 0.2 + (v.boost || 0) * 0.05));
          v.likesTiktok = Math.round(v.viewsTiktok * (0.04 + Math.random() * 0.06));
        }
        if (v.postedInstagram) {
          v.viewsInstagram = Math.round(
            v.viewsInstagram * (1.04 + Math.random() * 0.18 + (v.boost || 0) * 0.04)
          );
          v.likesInstagram = Math.round(v.viewsInstagram * (0.05 + Math.random() * 0.07));
        }
      });
      save();
      renderAnalytics();
      renderKPIs();
      toast("Crescimento 24h simulado");
    });

    $("#search")?.addEventListener("input", (e) => {
      state.query = e.target.value.trim();
      renderGrid();
    });
    $$("[data-f]").forEach((c) =>
      c.addEventListener("click", () => {
        $$("[data-f]").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        state.filter = c.dataset.f;
        renderGrid();
      })
    );

    $("#studioSelect")?.addEventListener("change", (e) => {
      state.selectedId = Number(e.target.value);
      paintStudio();
    });
    $("#previewSelect")?.addEventListener("change", (e) => {
      state.selectedId = Number(e.target.value);
      renderPreview();
    });

    $$(".tool").forEach((t) => {
      t.addEventListener("click", () => {
        if (t.dataset.tool === "clear") {
          const v = selected();
          v.markups = [];
          renderMarkups(v);
          save();
          return;
        }
        state.tool = t.dataset.tool;
        $$(".tool").forEach((x) => x.classList.toggle("active", x.dataset.tool === state.tool));
      });
    });

    const frame = $("#frame");
    frame?.addEventListener("mousedown", (e) => {
      if (state.tool !== "mark" && state.tool !== "text") return;
      const rect = frame.getBoundingClientRect();
      state.drawing = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      };
    });
    window.addEventListener("mouseup", (e) => {
      if (!state.drawing || !frame) return;
      const rect = frame.getBoundingClientRect();
      const x2 = ((e.clientX - rect.left) / rect.width) * 100;
      const y2 = ((e.clientY - rect.top) / rect.height) * 100;
      const x = Math.min(state.drawing.x, x2);
      const y = Math.min(state.drawing.y, y2);
      const w = Math.max(8, Math.abs(x2 - state.drawing.x));
      const h = Math.max(6, Math.abs(y2 - state.drawing.y));
      const v = selected();
      if (!v.markups) v.markups = [];
      if (state.tool === "text") {
        const text = prompt("Texto na capa:", "LUXURY") || "LUXURY";
        v.markups.push({ kind: "text", x, y, w, h, text });
      } else {
        v.markups.push({ kind: "box", x, y, w, h, label: "Área " + (v.markups.length + 1) });
      }
      state.drawing = null;
      renderMarkups(v);
      save();
    });

    // Studio panel fields (ids: stTitle/stStatus/stDesc — not editor ed*)
    const stTitle = $("#stTitle") || $("#studioTitle");
    const stStatus = $("#stStatus") || $("#studioStatus");
    const stDesc = $("#stDesc") || $("#studioDesc");
    $("#btnSave")?.addEventListener("click", () => {
      const v = selected();
      if (!v) return;
      const titleEl = stTitle || $("#edTitle");
      const statusEl = stStatus || $("#edStatus");
      const descEl = stDesc || $("#edDesc");
      if (titleEl) v.title = (titleEl.value || titleEl.textContent || "").trim() || v.title;
      if (statusEl) v.status = statusEl.value || v.status;
      if (descEl) v.description = descEl.value != null ? descEl.value : descEl.textContent;
      toast("Salvo");
      renderAll();
      try { paintStudio(); } catch (_) {}
    });
    $("#btnViral")?.addEventListener("click", () => {
      const v = selected();
      v.description = genViral(v);
      if (stDesc) stDesc.textContent = v.description;
      if ($("#edDesc")) $("#edDesc").textContent = v.description;
      try { paintStudio(); } catch (_) {}
      save();
      toast("Legenda viral");
      botSay("Legenda chamativa aplicada.");
    });
    $("#btnBoost")?.addEventListener("click", () => {
      applyBoost(selected(), 1);
      toast("Boost aplicado");
      botSay(`Boost x${selected().boost}`);
      renderAll();
    });
    $("#btnQTT")?.addEventListener("click", () => enqueueOne("tiktok"));
    $("#btnQIG")?.addEventListener("click", () => enqueueOne("instagram"));

    $("#chatSend")?.addEventListener("click", () => {
      const t = ($("#chatInput")?.value || "").trim();
      if (!t) return;
      userSay(t);
      $("#chatInput").value = "";
      setTimeout(() => ai(t), 200);
    });
    $("#chatInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $("#chatSend")?.click();
      }
    });
    $$("#sugs .sug").forEach((s) =>
      s.addEventListener("click", () => {
        if ($("#chatInput")) $("#chatInput").value = s.textContent;
        $("#chatSend")?.click();
      })
    );

    function openModal(platform) {
      state.modalPlatform = platform;
      $("#modalTitle").textContent =
        platform === "tiktok" ? "♪ Autorizar TikTok" : "📷 Autorizar Instagram";
      $("#modalText").textContent =
        platform === "tiktok"
          ? "Permissões: publicar, perfil e insights de views."
          : "Permissões: Reels, legendas e insights.";
      $("#modalUser").value = state.accounts[platform].user || "@luxury.garage";
      $("#modal").classList.add("open");
    }
    $("#btnConnTT")?.addEventListener("click", () => openModal("tiktok"));
    $("#btnConnIG")?.addEventListener("click", () => openModal("instagram"));
    $("#modalCancel")?.addEventListener("click", () => $("#modal").classList.remove("open"));
    $("#modalAllow")?.addEventListener("click", () => {
      let u = $("#modalUser").value.trim() || "@conta";
      if (!u.startsWith("@")) u = "@" + u;
      state.accounts[state.modalPlatform] = {
        connected: true,
        user: u,
        at: new Date().toISOString(),
      };
      $("#modal").classList.remove("open");
      save();
      renderAccounts();
      toast(state.modalPlatform + " conectado");
    });
    $("#btnDiscTT")?.addEventListener("click", () => {
      state.accounts.tiktok = { connected: false, user: "" };
      save();
      renderAccounts();
    });
    $("#btnDiscIG")?.addEventListener("click", () => {
      state.accounts.instagram = { connected: false, user: "" };
      save();
      renderAccounts();
    });

    // global drag-drop import
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => {
      if (e.target.closest("#dropzone")) return;
      e.preventDefault();
      if (e.dataTransfer?.files?.length) importFiles(e.dataTransfer.files);
    });
  }

  // boot
  try {
    load();
    // re-apply demo urls from library after load merge
    const demoMap = Object.fromEntries((LIB.videos || []).map((v) => [v.id, v.demoUrl]));
    videos.forEach((v) => {
      v.format = "9:16";
      v.type = "short";
      if (demoMap[v.id]) v.demoUrl = demoMap[v.id];
      // sempre regenera se legenda antiga/longa
      if (!v.description || isOldLongCaption(v.description)) {
        v.description = genViral(v);
      }
    });
    // garantir persistencia das curtas
    save();
    if (!videos.length) {
      console.warn("No videos in library");
    }
    bindUI();
    // hero carousel
    const heroImg = $("#heroImg");
    if (heroImg && LIB.coverPool?.length) {
      let i = 0;
      setInterval(() => {
        i = (i + 1) % LIB.coverPool.length;
        heroImg.src = asset("covers/" + LIB.coverPool[i].file);
      }, 3200);
    }

    // public API for editor / AI bridge
    window.VideoFlowApp = {
      getVideos: () => videos,
      getSelected: () => selected(),
      setSelected: (id) => {
        state.selectedId = Number(id);
        renderAll();
      },
      getBlobUrl: (id) => {
        if (fileBlobs.has(id)) return fileBlobs.get(id);
        const v = videos.find((x) => x.id === id);
        return v?.demoUrl || null;
      },
      getFileBlobs: () => fileBlobs,
      save,
      renderAll,
      setView,
      genViral,
      asset,
      enterApp,
      updateVideo(id, partial) {
        const v = videos.find((x) => x.id === id);
        if (!v) return;
        Object.assign(v, partial);
        save();
        renderAll();
      },
      getState: () => state,
      getDemoMusic: () => LIB.demoMusic || [],
    };
    window.__VF_VIDEO_IDS__ = () => videos.map((v) => v.id);
    window.VideoFlowReady = true;
    document.dispatchEvent(new CustomEvent("vf-ready"));
    console.info("VideoFlow Pro ready", videos.length, "videos");
  } catch (err) {
    console.error("VideoFlow boot failed", err);
    const banner = document.createElement("div");
    banner.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:#111;color:#fff;padding:24px;font:16px/1.5 system-ui";
    banner.innerHTML =
      "<h2>Erro ao carregar VideoFlow</h2><pre style='white-space:pre-wrap'>" +
      String(err && err.stack ? err.stack : err) +
      "</pre><p>Recarregue com Ctrl+F5. Se persistir, abra o console (F12).</p>";
    document.body.appendChild(banner);
  }
})();
