/**
 * LUXECUT music library — only user-selected YouTube tracks
 * Preview via YouTube (best segments). Nao hospedamos audio (copyright).
 *
 * Fontes:
 * https://www.youtube.com/watch?v=UynCG_el504
 * https://www.youtube.com/watch?v=ZPGJrC48o_w
 * https://www.youtube.com/watch?v=6gkGz-nd5zU
 * https://www.youtube.com/watch?v=IPnjudQdOaU
 * https://www.youtube.com/watch?v=prrF8rT5QBs
 * https://www.youtube.com/watch?v=7v0Njj4MR9E
 */
window.VideoFlowMusic = (function () {
  // start/end = melhores partes (segundos) para preview no editor
  const TRACKS = [
    // 1) Estilo de vida bilionario (motivacao)
    {
      id: "yt_estilo_hook",
      name: "Estilo Bilionario — Hook",
      artist: "Atracao Positiva",
      mood: "motivacao luxury cold open",
      bpm: 100,
      source: "youtube",
      youtubeId: "UynCG_el504",
      start: 15,
      end: 75,
      tags: ["luxury", "motivation", "billionaire", "lifestyle"],
      url: "https://www.youtube.com/watch?v=UynCG_el504&t=15s",
    },
    {
      id: "yt_estilo_drop",
      name: "Estilo Bilionario — Peak",
      artist: "Atracao Positiva",
      mood: "motivacao peak energy",
      bpm: 105,
      source: "youtube",
      youtubeId: "UynCG_el504",
      start: 90,
      end: 165,
      tags: ["luxury", "motivation", "peak"],
      url: "https://www.youtube.com/watch?v=UynCG_el504&t=90s",
    },
    // 2) Tristan Tate | Skyfall
    {
      id: "yt_skyfall_intro",
      name: "Skyfall (Tristan Tate) — Intro",
      artist: "WealthWave",
      mood: "dark luxury intro",
      bpm: 95,
      source: "youtube",
      youtubeId: "ZPGJrC48o_w",
      start: 8,
      end: 55,
      tags: ["skyfall", "tate", "dark", "luxury"],
      url: "https://www.youtube.com/watch?v=ZPGJrC48o_w&t=8s",
    },
    {
      id: "yt_skyfall_drop",
      name: "Skyfall (Tristan Tate) — Drop",
      artist: "WealthWave",
      mood: "anthem drop",
      bpm: 100,
      source: "youtube",
      youtubeId: "ZPGJrC48o_w",
      start: 70,
      end: 140,
      tags: ["skyfall", "drop", "viral", "luxury"],
      url: "https://www.youtube.com/watch?v=ZPGJrC48o_w&t=70s",
    },
    // 3) Billionaire Luxury Lifestyle 2025
    {
      id: "yt_bll_hook",
      name: "Billionaire Lifestyle 2025 — Hook",
      artist: "Richie Rich",
      mood: "visualization luxury",
      bpm: 98,
      source: "youtube",
      youtubeId: "6gkGz-nd5zU",
      start: 20,
      end: 80,
      tags: ["billionaire", "lifestyle", "2025", "motivation"],
      url: "https://www.youtube.com/watch?v=6gkGz-nd5zU&t=20s",
    },
    {
      id: "yt_bll_mid",
      name: "Billionaire Lifestyle 2025 — Mid",
      artist: "Richie Rich",
      mood: "steady flex",
      bpm: 100,
      source: "youtube",
      youtubeId: "6gkGz-nd5zU",
      start: 120,
      end: 200,
      tags: ["billionaire", "flex", "luxury"],
      url: "https://www.youtube.com/watch?v=6gkGz-nd5zU&t=120s",
    },
    // 4) songs to make you feel like a millionaire
    {
      id: "yt_milli_a",
      name: "Feel Like a Millionaire — Part A",
      artist: "Dj Phaulo List",
      mood: "rich playlist energy",
      bpm: 110,
      source: "youtube",
      youtubeId: "IPnjudQdOaU",
      start: 30,
      end: 100,
      tags: ["millionaire", "playlist", "rich", "viral"],
      url: "https://www.youtube.com/watch?v=IPnjudQdOaU&t=30s",
    },
    {
      id: "yt_milli_b",
      name: "Feel Like a Millionaire — Part B",
      artist: "Dj Phaulo List",
      mood: "rich playlist peak",
      bpm: 112,
      source: "youtube",
      youtubeId: "IPnjudQdOaU",
      start: 180,
      end: 260,
      tags: ["millionaire", "playlist", "peak"],
      url: "https://www.youtube.com/watch?v=IPnjudQdOaU&t=180s",
    },
    // 5) Billionaire Vibes Only playlist
    {
      id: "yt_vibes_a",
      name: "Billionaire Vibes Only — Part A",
      artist: "butterfly black",
      mood: "vibes luxury soft",
      bpm: 102,
      source: "youtube",
      youtubeId: "prrF8rT5QBs",
      start: 25,
      end: 95,
      tags: ["vibes", "billionaire", "playlist", "aesthetic"],
      url: "https://www.youtube.com/watch?v=prrF8rT5QBs&t=25s",
    },
    {
      id: "yt_vibes_b",
      name: "Billionaire Vibes Only — Part B",
      artist: "butterfly black",
      mood: "vibes deep",
      bpm: 104,
      source: "youtube",
      youtubeId: "prrF8rT5QBs",
      start: 200,
      end: 280,
      tags: ["vibes", "deep", "luxury"],
      url: "https://www.youtube.com/watch?v=prrF8rT5QBs&t=200s",
    },
    // 6) PROOF (Drake / Travis style mix)
    {
      id: "yt_proof_hook",
      name: "PROOF — Hook",
      artist: "SHADOWS FAM",
      mood: "trap dark flex",
      bpm: 130,
      source: "youtube",
      youtubeId: "7v0Njj4MR9E",
      start: 40,
      end: 110,
      tags: ["proof", "trap", "drake", "travis", "viral"],
      url: "https://www.youtube.com/watch?v=7v0Njj4MR9E&t=40s",
    },
    {
      id: "yt_proof_drop",
      name: "PROOF — Drop",
      artist: "SHADOWS FAM",
      mood: "trap drop energy",
      bpm: 135,
      source: "youtube",
      youtubeId: "7v0Njj4MR9E",
      start: 180,
      end: 260,
      tags: ["proof", "drop", "energy", "viral"],
      url: "https://www.youtube.com/watch?v=7v0Njj4MR9E&t=180s",
    },
  ];

  function all() {
    return TRACKS.slice();
  }

  function search(query) {
    const q = String(query || "")
      .toLowerCase()
      .trim();
    if (!q) return all();
    return TRACKS.filter((t) => {
      const hay = [t.name, t.artist, t.mood, t.youtubeId, ...(t.tags || [])].join(" ").toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }

  function byId(id) {
    return TRACKS.find((t) => t.id === id) || null;
  }

  function byName(name) {
    const q = String(name || "").toLowerCase();
    return (
      TRACKS.find((t) => t.name.toLowerCase() === q) ||
      TRACKS.find((t) => t.name.toLowerCase().includes(q)) ||
      TRACKS.find((t) => (t.tags || []).some((tag) => tag.includes(q))) ||
      null
    );
  }

  function suggestForEdit(edit = {}, video = {}) {
    const preset = (edit.preset || edit.autoMode || "").toLowerCase();
    const title = (video.title || "").toLowerCase();
    if (/night|noite|dark|black/.test(title + preset)) return byId("yt_skyfall_drop") || TRACKS[2];
    if (/viral|punch|flex|reels/.test(preset) || /flex|garage/.test(title)) return byId("yt_proof_drop") || TRACKS[10];
    if (/slow|cinematic|soft/.test(preset)) return byId("yt_vibes_a") || TRACKS[8];
    if (/luxury|luxo|bilion/.test(preset + title)) return byId("yt_estilo_hook") || TRACKS[0];
    return byId("yt_bll_hook") || TRACKS[4];
  }

  function embedUrl(track) {
    if (!track?.youtubeId) return "";
    const start = track.start || 0;
    const end = track.end || "";
    let u =
      "https://www.youtube.com/embed/" +
      track.youtubeId +
      "?autoplay=1&controls=1&rel=0&start=" +
      start;
    if (end) u += "&end=" + end;
    return u;
  }

  return { all, search, byId, byName, suggestForEdit, embedUrl, TRACKS };
})();
