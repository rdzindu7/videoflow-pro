/**
 * Biblioteca de musicas free (CDN) pesquisaveis por nome/estilo
 * URLs publicas SoundHelix — use para preview/mix no browser
 */
window.VideoFlowMusic = (function () {
  const TRACKS = [
    { id: "sh1", name: "Midnight Drive", artist: "Helix Cinema", mood: "cinematic luxury night", bpm: 92, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", tags: ["luxury", "night", "car", "cinematic"] },
    { id: "sh2", name: "Gold Coast Pulse", artist: "Helix Beat", mood: "upbeat drive", bpm: 118, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", tags: ["viral", "energy", "drive"] },
    { id: "sh3", name: "Penthouse Ambient", artist: "Helix Soft", mood: "soft luxury", bpm: 78, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", tags: ["luxury", "soft", "aesthetic"] },
    { id: "sh4", name: "Turbo Night", artist: "Helix Race", mood: "fast night", bpm: 132, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", tags: ["speed", "night", "viral"] },
    { id: "sh5", name: "Villa Sunset", artist: "Helix Gold", mood: "warm golden hour", bpm: 96, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", tags: ["sunset", "luxury", "warm"] },
    { id: "sh6", name: "Garage Flex", artist: "Helix Bass", mood: "trap flex energy", bpm: 140, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", tags: ["flex", "bass", "viral"] },
    { id: "sh7", name: "Ocean Highway", artist: "Helix Wave", mood: "coastal cruise", bpm: 104, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3", tags: ["coast", "chill", "drive"] },
    { id: "sh8", name: "Black Chrome", artist: "Helix Dark", mood: "dark luxury", bpm: 110, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", tags: ["dark", "luxury", "chrome"] },
    { id: "sh9", name: "Airstrip Takeoff", artist: "Helix Jet", mood: "epic power", bpm: 120, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3", tags: ["epic", "power", "jet"] },
    { id: "sh10", name: "Soft Leather", artist: "Helix Lounge", mood: "lounge premium", bpm: 84, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3", tags: ["lounge", "soft", "premium"] },
    { id: "sh11", name: "City Rain", artist: "Helix Noir", mood: "rainy city", bpm: 100, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3", tags: ["city", "rain", "night"] },
    { id: "sh12", name: "Supercar Anthem", artist: "Helix Arena", mood: "anthem energy", bpm: 128, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3", tags: ["anthem", "supercar", "viral"] },
    { id: "sh13", name: "Quiet Wealth", artist: "Helix Minimal", mood: "minimal luxury", bpm: 88, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3", tags: ["minimal", "luxury", "quiet"] },
    { id: "sh14", name: "Redline Rush", artist: "Helix RPM", mood: "high rpm rush", bpm: 145, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3", tags: ["rush", "fast", "rpm"] },
    { id: "sh15", name: "Desert Mirage", artist: "Helix Sand", mood: "desert heat", bpm: 98, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3", tags: ["desert", "heat", "cinematic"] },
    { id: "sh16", name: "Neon District", artist: "Helix Neon", mood: "neon cyber night", bpm: 124, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3", tags: ["neon", "night", "city"] },
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
      const hay = [t.name, t.artist, t.mood, ...(t.tags || [])].join(" ").toLowerCase();
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
      null
    );
  }

  function suggestForEdit(edit = {}, video = {}) {
    const preset = edit.preset || "raw";
    const title = (video.title || "").toLowerCase();
    if (/night|noite|dark|black/.test(title + preset)) return byId("sh1") || TRACKS[0];
    if (/viral|punch|flex/.test(preset) || /flex|garage/.test(title)) return byId("sh6");
    if (/slow|cinematic|soft/.test(preset)) return byId("sh3");
    if (/speed|turbo|race/.test(title)) return byId("sh4");
    return byId("sh12") || TRACKS[0];
  }

  return { all, search, byId, byName, suggestForEdit, TRACKS };
})();
