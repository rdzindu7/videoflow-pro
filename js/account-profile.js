/**
 * LUXECUT — conta nova + personalizacao por nicho
 */
window.LuxeProfile = (function () {
  const PROFILE_KEY = "luxecut_profile_v1";
  const VISIT_KEY = "luxecut_first_seen_v1";

  const NICHES = {
    luxury_cars: {
      id: "luxury_cars",
      label: "Carros de luxo",
      emoji: "CAR",
      keywords: [
        "car", "carro", "supercar", "hypercar", "lambo", "ferrari", "porsche", "bmw", "mercedes",
        "garage", "motor", "drive", "racer", "turbo", "gt", "coupe", "suv", "mansion", "yacht",
      ],
      captionStyle: "luxury",
      autoMixStyle: "luxury",
      musicHints: ["Estilo Bilionario", "Skyfall", "Billionaire Lifestyle", "PROOF"],
      coverPreference: ["car-01", "car-02", "car-08", "car-12", "luxecut-brand"],
      tone: "presenca, padrao, luxo silencioso",
      hooks: [
        "Isso e so o comeco",
        "Padrao diferente",
        "Voce ainda nao viu nada",
        "Fica se e teu estilo",
      ],
      ctas: ["Segue pra nao perder", "Segue se e teu estilo", "Entra pro clube"],
      tags: ["#fyp", "#foryou", "#supercar", "#luxurycars", "#viral"],
    },
    billionaire: {
      id: "billionaire",
      label: "Estilo bilionario / motivacao",
      emoji: "$$",
      keywords: [
        "billion", "bilion", "rich", "wealth", "money", "million", "success", "mindset",
        "motivation", "hustle", "ceo", "luxo", "luxury", "lifestyle", "manifest",
      ],
      captionStyle: "viral",
      autoMixStyle: "viral",
      musicHints: ["Estilo Bilionario", "Billionaire Vibes", "Feel Like a Millionaire", "Skyfall"],
      coverPreference: ["luxecut-brand", "car-03", "car-09", "car-04"],
      tone: "ambicao, status, energia de elite",
      hooks: [
        "O feed vai mudar",
        "Nivel diferente",
        "Se gostou, fica",
        "Sua nova fixacao",
      ],
      ctas: ["Segue pra subir de nivel", "Ativa o sininho", "Segue se e teu mindset"],
      tags: ["#fyp", "#viral", "#luxury", "#motivation", "#richlife"],
    },
    aesthetic: {
      id: "aesthetic",
      label: "Aesthetic / lifestyle",
      emoji: "AE",
      keywords: [
        "aesthetic", "vibe", "soft", "minimal", "cafe", "travel", "day", "night", "mood",
        "girly", "clean", "visual",
      ],
      captionStyle: "luxury",
      autoMixStyle: "cinematic",
      musicHints: ["Billionaire Vibes", "Skyfall Intro", "Estilo Bilionario"],
      coverPreference: ["car-05", "car-09", "car-02", "luxecut-brand"],
      tone: "visual clean, clima, vibes",
      hooks: ["Sua nova vibe", "Fica no clima", "Isso e so o tom"],
      ctas: ["Segue pro feed limpo", "Segue se curtiu a vibe"],
      tags: ["#fyp", "#aesthetic", "#foryou", "#reels", "#viral"],
    },
    reels_geral: {
      id: "reels_geral",
      label: "Reels geral / crescimento",
      emoji: "GO",
      keywords: ["clip", "video", "reel", "short", "edit", "cut", "vlog"],
      captionStyle: "viral",
      autoMixStyle: "reels",
      musicHints: ["PROOF", "Skyfall Drop", "Feel Like a Millionaire"],
      coverPreference: ["luxecut-brand", "car-06", "car-10"],
      tone: "crescimento rapido, curiosidade",
      hooks: ["Nao pisca", "Isso aqui e so o comeco", "Tem mais vindo"],
      ctas: ["Segue pra nao perder", "Entra pro clube"],
      tags: ["#fyp", "#foryou", "#viral", "#reels", "#foryoupage"],
    },
  };

  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveProfile(p) {
    const next = {
      ...loadProfile(),
      ...p,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    return next;
  }

  function isNewAccount() {
    const profile = loadProfile();
    const first = localStorage.getItem(VISIT_KEY);
    if (!first) {
      localStorage.setItem(VISIT_KEY, new Date().toISOString());
      return true;
    }
    // novo se nunca completou onboarding
    if (!profile || !profile.onboardingDone) return true;
    // novo se biblioteca sempre vazia e sem packs e conta < 24h
    const created = new Date(profile.createdAt || first).getTime();
    const young = Date.now() - created < 24 * 60 * 60 * 1000;
    if (young && !profile.niche) return true;
    return false;
  }

  function markOnboardingDone(extra = {}) {
    const prev = loadProfile() || {};
    return saveProfile({
      createdAt: prev.createdAt || new Date().toISOString(),
      onboardingDone: true,
      isNew: false,
      ...extra,
    });
  }

  /** Detecta nicho pelos titulos/arquivos dos videos */
  function detectNicheFromVideos(videos = []) {
    const scores = {};
    Object.keys(NICHES).forEach((k) => (scores[k] = 0));

    if (!videos.length) {
      return { nicheId: "luxury_cars", confidence: 0.35, reason: "padrao LUXECUT (sem videos ainda)" };
    }

    const blob = videos
      .map((v) => [v.title, v.file, v.coverTitle, v.coverPlace, ...(v.tags || [])].join(" "))
      .join(" ")
      .toLowerCase();

    Object.values(NICHES).forEach((n) => {
      n.keywords.forEach((kw) => {
        if (blob.includes(kw.toLowerCase())) scores[n.id] += 2;
      });
      // bonus filename patterns
      if (/clip|v0|car|drive|lux/i.test(blob) && n.id === "luxury_cars") scores[n.id] += 3;
      if (/billion|rich|money|mind/i.test(blob) && n.id === "billionaire") scores[n.id] += 3;
    });

    let best = "luxury_cars";
    let bestScore = -1;
    Object.entries(scores).forEach(([id, s]) => {
      if (s > bestScore) {
        bestScore = s;
        best = id;
      }
    });

    const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
    const confidence = Math.min(0.95, 0.4 + bestScore / Math.max(8, total));

    return {
      nicheId: best,
      confidence,
      scores,
      reason:
        bestScore <= 0
          ? "poucos sinais nos arquivos — usando Carros de luxo"
          : `detectado por palavras nos seus videos (score ${bestScore})`,
    };
  }

  function getNiche(id) {
    return NICHES[id] || NICHES.luxury_cars;
  }

  function applyNiche(nicheId, opts = {}) {
    const niche = getNiche(nicheId);
    const det = opts.detection || null;
    const profile = saveProfile({
      createdAt: loadProfile()?.createdAt || new Date().toISOString(),
      onboardingDone: true,
      isNew: false,
      niche: niche.id,
      nicheLabel: niche.label,
      confidence: det?.confidence ?? 1,
      reason: det?.reason || "escolhido por voce",
      captionStyle: niche.captionStyle,
      autoMixStyle: niche.autoMixStyle,
      musicHints: niche.musicHints,
      tone: niche.tone,
      hooks: niche.hooks,
      ctas: niche.ctas,
      tags: niche.tags,
      personalizedAt: new Date().toISOString(),
    });

    // personaliza gerador de legendas se existir
    if (window.VideoFlowAI) {
      window.VideoFlowAI._nicheProfile = profile;
    }
    return { profile, niche };
  }

  /** Legenda curta personalizada pelo nicho — max 5 # */
  function nicheCaption(video, profile) {
    const p = profile || loadProfile();
    const niche = getNiche(p?.niche || "luxury_cars");
    const seed = Math.abs(
      String(video?.id || 0)
        .split("")
        .reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
    );
    const hook = niche.hooks[seed % niche.hooks.length];
    const cta = niche.ctas[seed % niche.ctas.length];
    const tags = (niche.tags || []).slice(0, 5);
    return `${hook}\n${cta}\n\n${tags.join(" ")}`;
  }

  function personalizeLibrary(videos, profile) {
    const p = profile || loadProfile();
    if (!p?.niche) return { videos, changed: 0 };
    let changed = 0;
    const niche = getNiche(p.niche);
    videos.forEach((v, i) => {
      // legenda curta no tom do nicho
      const next = nicheCaption(v, p);
      if (v.description !== next) {
        v.description = next;
        changed++;
      }
      // capa preferida se ainda sem capa
      if (!v.cover && window.LIBRARY?.coverPool?.length) {
        const pref = niche.coverPreference || [];
        const pool = window.LIBRARY.coverPool;
        let pick = pool[i % pool.length];
        for (const part of pref) {
          const found = pool.find((c) => String(c.file).includes(part));
          if (found) {
            pick = found;
            break;
          }
        }
        if (pick) {
          v.cover = "covers/" + pick.file;
          v.coverTitle = pick.title || pick.file;
          v.coverPlace = pick.place || niche.label;
          changed++;
        }
      }
    });
    return { videos, changed };
  }

  function summary(profile) {
    const p = profile || loadProfile();
    if (!p?.niche) return "Conta ainda sem nicho definido.";
    const n = getNiche(p.niche);
    return {
      text: `Nicho: ${n.label} · mix: ${n.autoMixStyle} · tom: ${n.tone}`,
      niche: n,
      profile: p,
    };
  }

  return {
    NICHES,
    PROFILE_KEY,
    loadProfile,
    saveProfile,
    isNewAccount,
    markOnboardingDone,
    detectNicheFromVideos,
    getNiche,
    applyNiche,
    nicheCaption,
    personalizeLibrary,
    summary,
  };
})();
