/**
 * LUXECUT Auto-Combine AI
 * Agrupa clips que combinam, escolhe musica, aplica auto-edit e legenda curta.
 */
window.LuxeAuto = (function () {
  const PACK_STYLES = {
    luxury: {
      label: "Luxury Sequence",
      musicHints: ["Estilo Bilionario — Hook", "Billionaire Lifestyle 2025 — Hook", "Skyfall (Tristan Tate) — Intro", "Billionaire Vibes Only — Part A"],
      autoMode: "luxury",
      maxClips: 4,
      mood: "premium slow flex",
    },
    viral: {
      label: "Viral Pack",
      musicHints: ["PROOF — Drop", "Feel Like a Millionaire — Part A", "Skyfall (Tristan Tate) — Drop", "PROOF — Hook"],
      autoMode: "viral",
      maxClips: 5,
      mood: "high energy",
    },
    night: {
      label: "Night Run",
      musicHints: ["Skyfall (Tristan Tate) — Drop", "PROOF — Hook", "Estilo Bilionario — Peak", "Billionaire Vibes Only — Part B"],
      autoMode: "night",
      maxClips: 4,
      mood: "night city",
    },
    cinematic: {
      label: "Cinematic Cut",
      musicHints: ["Billionaire Lifestyle 2025 — Mid", "Skyfall (Tristan Tate) — Intro", "Estilo Bilionario — Peak", "Billionaire Vibes Only — Part A"],
      autoMode: "cinematic",
      maxClips: 4,
      mood: "film trailer",
    },
    reels: {
      label: "Reels Ready",
      musicHints: ["PROOF — Drop", "Feel Like a Millionaire — Part B", "Skyfall (Tristan Tate) — Drop"],
      autoMode: "reels_pack",
      maxClips: 3,
      mood: "short punchy",
    },
  };

  function scorePair(a, b) {
    let s = 0;
    const ta = (a.title || a.file || "").toLowerCase();
    const tb = (b.title || b.file || "").toLowerCase();
    // same prefix patterns (clip, v01, etc)
    const pa = ta.replace(/\d+/g, "#").slice(0, 8);
    const pb = tb.replace(/\d+/g, "#").slice(0, 8);
    if (pa && pa === pb) s += 40;
    // shared tags
    const tagsA = new Set((a.tags || []).map(String));
    (b.tags || []).forEach((t) => {
      if (tagsA.has(String(t))) s += 15;
    });
    // similar size/duration category
    const sa = a.size || 0;
    const sb = b.size || 0;
    if (sa && sb) {
      const ratio = Math.min(sa, sb) / Math.max(sa, sb);
      if (ratio > 0.5) s += 10;
    }
    // both have playable media
    if ((a.hasLocalFile || a.demoUrl || a._blob) && (b.hasLocalFile || b.demoUrl || b._blob)) s += 5;
    // same cover style id nearby
    if (a.cover && b.cover && a.cover === b.cover) s += 8;
    // name number sequence (clip 1 + clip 2)
    const na = parseInt((ta.match(/(\d+)/) || [])[1] || "0", 10);
    const nb = parseInt((tb.match(/(\d+)/) || [])[1] || "0", 10);
    if (na && nb && Math.abs(na - nb) <= 2) s += 25;
    if (na && nb && Math.abs(na - nb) <= 5) s += 10;
    return s;
  }

  function clusterVideos(videos, styleKey = "reels") {
    const style = PACK_STYLES[styleKey] || PACK_STYLES.reels;
    const list = videos.slice().filter((v) => v && v.id != null);
    if (!list.length) return [];

    const used = new Set();
    const packs = [];
    // greedy clustering by best pair scores
    const sorted = list.slice().sort((a, b) => (b.size || 0) - (a.size || 0));

    for (const seed of sorted) {
      if (used.has(seed.id)) continue;
      const group = [seed];
      used.add(seed.id);
      const candidates = list
        .filter((v) => !used.has(v.id))
        .map((v) => ({ v, s: scorePair(seed, v) }))
        .sort((a, b) => b.s - a.s);

      for (const c of candidates) {
        if (group.length >= style.maxClips) break;
        // also score vs group average
        const avg =
          group.reduce((sum, g) => sum + scorePair(g, c.v), 0) / group.length;
        if (avg >= 18 || c.s >= 25) {
          group.push(c.v);
          used.add(c.v.id);
        }
      }
      // only create pack if 2+ clips OR single if user has few
      if (group.length >= 2 || list.length <= 2) {
        packs.push(group);
      } else if (group.length === 1 && packs.length === 0) {
        packs.push(group);
      }
    }
    return packs;
  }

  function pickMusic(styleKey, packIndex) {
    const style = PACK_STYLES[styleKey] || PACK_STYLES.reels;
    const M = window.VideoFlowMusic;
    if (!M) return null;
    const hint = style.musicHints[packIndex % style.musicHints.length];
    return M.byName(hint) || M.search(hint.split(" ")[0])[0] || M.all()[0];
  }

  function pickCover(pack, packIndex, coverPool) {
    const pool = coverPool || [];
    if (!pool.length) return pack[0]?.cover || "";
    const file = pool[packIndex % pool.length].file;
    return "covers/" + file;
  }

  function shortCaption(packIndex, styleKey) {
    if (window.VideoFlowAI?.generateDescription) {
      return window.VideoFlowAI.generateDescription(
        { id: packIndex + 1000, title: styleKey },
        styleKey === "luxury" ? "luxury" : "viral"
      ).text;
    }
    const hooks = [
      "Isso aqui e so o comeco",
      "Se gostou, fica",
      "Voce ainda nao viu nada",
      "O feed vai mudar",
    ];
    const ctas = ["Segue pra nao perder", "Segue se e teu estilo", "Entra pro clube"];
    const tags = ["#fyp", "#foryou", "#viral", "#supercar", "#luxurycars"];
    return `${hooks[packIndex % hooks.length]}\n${ctas[packIndex % ctas.length]}\n\n${tags.join(" ")}`;
  }

  /**
   * Build full auto projects from video list
   */
  function buildProjects(videos, opts = {}) {
    const styleKey = opts.style || "reels";
    const style = PACK_STYLES[styleKey] || PACK_STYLES.reels;
    const coverPool = opts.coverPool || window.LIBRARY?.coverPool || [];
    const packs = clusterVideos(videos, styleKey);
    const projects = packs.map((group, i) => {
      const music = pickMusic(styleKey, i);
      const cover = pickCover(group, i, coverPool);
      const meta = coverPool[i % Math.max(1, coverPool.length)] || {};
      return {
        id: "proj_" + Date.now() + "_" + i + "_" + Math.random().toString(36).slice(2, 6),
        name: `${style.label} #${i + 1}`,
        style: styleKey,
        mood: style.mood,
        clipIds: group.map((g) => g.id),
        clipTitles: group.map((g) => g.title || g.file || "clip"),
        clipCount: group.length,
        cover,
        coverTitle: meta.title || "Luxury cover",
        musicId: music?.id || "",
        musicName: music ? `${music.name} — ${music.artist}` : "",
        musicUrl: music?.url || "",
        autoMode: style.autoMode,
        description: shortCaption(i, styleKey),
        resolution: "fhd",
        createdAt: new Date().toISOString(),
        status: "pronto",
        score: Math.min(99, 60 + group.length * 8 + (music ? 10 : 0)),
        notes: [
          `${group.length} clip(s) agrupados por similaridade de nome/sequencia`,
          `Musica: ${music?.name || "nenhuma"} (${music?.bpm || "?"} BPM)`,
          `Modo auto-edit: ${style.autoMode}`,
          `Capa 9:16 separada do video`,
          `Legenda curta max 5 hashtags · CTA seguir`,
        ],
      };
    });
    return projects;
  }

  /**
   * Manual pack from selected ids
   */
  function buildManualProject(videos, selectedIds, styleKey = "reels") {
    const style = PACK_STYLES[styleKey] || PACK_STYLES.reels;
    const group = selectedIds
      .map((id) => videos.find((v) => v.id === id))
      .filter(Boolean);
    if (!group.length) return null;
    const music = pickMusic(styleKey, 0);
    const coverPool = window.LIBRARY?.coverPool || [];
    const cover = pickCover(group, 0, coverPool);
    const meta = coverPool[0] || {};
    return {
      id: "proj_manual_" + Date.now(),
      name: `${style.label} Manual`,
      style: styleKey,
      mood: style.mood,
      clipIds: group.map((g) => g.id),
      clipTitles: group.map((g) => g.title || g.file),
      clipCount: group.length,
      cover,
      coverTitle: meta.title || "Cover",
      musicId: music?.id || "",
      musicName: music ? `${music.name} — ${music.artist}` : "",
      musicUrl: music?.url || "",
      autoMode: style.autoMode,
      description: shortCaption(0, styleKey),
      resolution: "fhd",
      createdAt: new Date().toISOString(),
      status: "pronto",
      score: 90,
      notes: ["Pack manual criado por voce", `Musica: ${music?.name || "-"}`, `Auto: ${style.autoMode}`],
    };
  }

  return {
    PACK_STYLES,
    scorePair,
    clusterVideos,
    buildProjects,
    buildManualProject,
    pickMusic,
    shortCaption,
  };
})();
