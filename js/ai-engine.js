/**
 * VideoFlow AI Engine — descrições virais + assistente de edição
 * Motor local avançado (sem API key) com templates, scoring e estilos.
 */
window.VideoFlowAI = (function () {
  const HOOKS = {
    viral: [
      "Isso aqui é outro nível 🔥🏎️",
      "Para o scroll. Agora. 👀",
      "POV: o carro e o cenário dos sonhos 🖤",
      "Se você sentiu o chill… comenta 🔥",
      "Salva antes do algoritmo esconder 💎",
      "Não é flex. É padrão. 🥂",
      "Som do motor > qualquer trend 🎵",
      "Lugares caros. Carros mais caros. 🏎️",
    ],
    luxury: [
      "Silêncio. Presença. Poder. ✨",
      "Onde o luxo estaciona 🖤",
      "Detalhe por detalhe — zero pressa.",
      "Estética de colecionador. 🥂",
      "Night drive. Private view. 🌙",
    ],
    story: [
      "Tudo começou com esse frame…",
      "A história por trás da máquina 📖",
      "Do sonho à estrada — sem filtro.",
      "Um dia na vida com esse carro.",
    ],
    cta: [
      "Comenta GARAGEM pra parte 2 💬",
      "Qual você levaria? Responde 👇",
      "Segue pra mais carros em lugares absurdos",
      "Ativa o som 🔊 e assiste até o final",
      "Salva + compartilha com quem ama carros",
    ],
  };

  const TAG_POOLS = {
    core: ["#fyp", "#foryou", "#foryoupage", "#viral", "#trending", "#reels", "#instareels"],
    cars: ["#supercar", "#luxurycars", "#carsoftiktok", "#exoticcars", "#hypercar", "#dreamcar", "#carporn", "#automotive"],
    luxury: ["#richlife", "#luxurylifestyle", "#wealth", "#millionairelifestyle", "#aesthetic"],
    br: ["#brasil", "#carsbr", "#luxobrasil", "#tiktokbrasil"],
    niche: ["#night drive", "#garagegoals", "#cargram", "#supercarsdaily", "#luxurycar"],
  };

  const EDIT_PRESETS = {
    cinematic: {
      name: "Cinematic Luxury",
      brightness: 1.05,
      contrast: 1.12,
      saturate: 1.08,
      speed: 1,
      filter: "contrast(1.12) saturate(1.08) brightness(1.05)",
      note: "Contraste e cor elevados para look de comercial de luxo",
    },
    night: {
      name: "Night Drive",
      brightness: 0.95,
      contrast: 1.2,
      saturate: 0.95,
      speed: 1,
      filter: "contrast(1.2) brightness(0.95) saturate(0.95)",
      note: "Mais contraste, noites densas",
    },
    soft: {
      name: "Soft Aesthetic",
      brightness: 1.08,
      contrast: 0.98,
      saturate: 1.15,
      speed: 1,
      filter: "brightness(1.08) saturate(1.15) contrast(0.98)",
      note: "Cores vivas e luz suave",
    },
    raw: {
      name: "Raw / Natural",
      brightness: 1,
      contrast: 1,
      saturate: 1,
      speed: 1,
      filter: "none",
      note: "Sem filtros — original limpo",
    },
    slowmo: {
      name: "Slow Motion Flex",
      brightness: 1.02,
      contrast: 1.1,
      saturate: 1.05,
      speed: 0.75,
      filter: "contrast(1.1) saturate(1.05)",
      note: "75% velocidade — detalhes do carro",
    },
    punchy: {
      name: "Punchy Viral",
      brightness: 1.06,
      contrast: 1.18,
      saturate: 1.2,
      speed: 1.05,
      filter: "contrast(1.18) saturate(1.2) brightness(1.06)",
      note: "Alto impacto para feed",
    },
  };

  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function pick(arr, seed, offset = 0) {
    if (!arr.length) return "";
    return arr[(seed + offset) % arr.length];
  }

  function scoreCaption(text) {
    let s = 50;
    if (text.length >= 80 && text.length <= 400) s += 15;
    if (/[🔥💎✨🖤🏎️👀]/.test(text)) s += 10;
    if (/#\w+/.test(text)) s += 10;
    if ((text.match(/#/g) || []).length >= 5 && (text.match(/#/g) || []).length <= 12) s += 10;
    if (/comenta|salva|segue|ativa/i.test(text)) s += 10;
    if (text.split("\n").length >= 3) s += 5;
    return Math.min(99, s);
  }

  function buildHashtags(video, style) {
    const seed = hashSeed(video.id + (video.title || "") + style);
    const tags = new Set();
    const pools = [
      ...TAG_POOLS.core,
      ...TAG_POOLS.cars,
      ...TAG_POOLS.luxury,
      ...(style === "viral" ? TAG_POOLS.br : []),
      ...TAG_POOLS.niche,
    ];
    // custom from title words
    String(video.title || "")
      .toLowerCase()
      .split(/[^a-z0-9à-ú]+/i)
      .filter((w) => w.length > 3)
      .slice(0, 3)
      .forEach((w) => tags.add("#" + w.replace(/\s/g, "")));

    for (let i = 0; i < 14 && tags.size < 12; i++) {
      tags.add(pick(pools, seed, i * 3));
    }
    return [...tags].slice(0, 11);
  }

  function generateDescription(video, style = "viral") {
    const seed = hashSeed((video.id || 0) + (video.title || "") + style + (video.coverPlace || ""));
    const place = video.coverPlace || "cenário de ultra luxo";
    const title = video.title || "Luxury car clip";
    const hookPool = HOOKS[style] || HOOKS.viral;
    const hook = pick(hookPool, seed, 1);
    const cta = pick(HOOKS.cta, seed, 2);
    const tags = buildHashtags(video, style);

    let body = "";
    if (style === "luxury") {
      body = `${title}.\n${place}.\nPresença impecável. Zero pressa. Só presença.`;
    } else if (style === "story") {
      body = `${title}\n\nNesse frame: ${place}.\nCada detalhe conta a história da máquina.`;
    } else if (style === "cta") {
      body = `${title} · ${place}\n\nAssiste até o final e me diz: você ficaria com esse?`;
    } else {
      body = `${title} · ${place}\n\nAlta resolução · 9:16 · som limpo.`;
    }

    const text = `${hook}\n\n${body}\n\n${cta}\n\n${tags.join(" ")}`;
    return {
      text,
      style,
      hashtags: tags,
      score: scoreCaption(text),
      hook,
      cta,
      tips: [
        "Poste nos horários 11:00, 15:30 ou 20:00",
        "Primeiros 1s precisam do carro em destaque",
        "CTA no final aumenta comentários",
        style === "viral" ? "Use áudio trending se possível" : "Mantenha estética clean de luxo",
      ],
    };
  }

  function generateBatch(video, n = 4) {
    const styles = ["viral", "luxury", "story", "cta"];
    return styles.slice(0, n).map((s) => generateDescription(video, s));
  }

  function bestDescription(video) {
    const batch = generateBatch(video, 4);
    batch.sort((a, b) => b.score - a.score);
    return batch[0];
  }

  function suggestEdits(video, editState = {}) {
    const suggestions = [];
    if (!editState.muted && editState.music) {
      suggestions.push({
        type: "audio",
        priority: "high",
        action: "mix",
        text: "Misture música a 25–35% e deixe o motor em 60–70% para não saturar.",
      });
    }
    if (editState.muted && !editState.music) {
      suggestions.push({
        type: "audio",
        priority: "high",
        action: "add_music",
        text: "Vídeo silenciado sem trilha — adicione música luxury/cinematic.",
      });
    }
    if ((editState.speed || 1) === 1) {
      suggestions.push({
        type: "motion",
        priority: "med",
        action: "slowmo",
        text: "Aplique slow-mo 0.75x nos closes do carro para engajamento.",
      });
    }
    if (!editState.preset || editState.preset === "raw") {
      suggestions.push({
        type: "look",
        priority: "med",
        action: "cinematic",
        text: "Preset Cinematic Luxury eleva percepção de qualidade premium.",
      });
    }
    if (editState.resolution !== "4k" && editState.resolution !== "8k") {
      suggestions.push({
        type: "export",
        priority: "low",
        action: "export_fhd",
        text: "Exporte em Full HD 1080x1920 (9:16) para TikTok/Reels com ótimo peso/qualidade.",
      });
    }
    if (!(video.description || "").includes("#")) {
      suggestions.push({
        type: "caption",
        priority: "high",
        action: "caption",
        text: "Gere legenda viral com 8–11 hashtags de alta performance.",
      });
    }
    suggestions.push({
      type: "post",
      priority: "med",
      action: "schedule",
      text: "Agende 3 posts/dia e nunca reposte o mesmo ID.",
    });
    return suggestions;
  }

  function chatRespond(input, ctx) {
    const t = String(input || "").toLowerCase();
    const video = ctx.video || {};
    const edit = ctx.edit || {};
    const replies = [];

    if (/descri|legenda|caption|hashtag|viral|melhor/.test(t)) {
      let style = "viral";
      if (/luxo|luxury|premium/.test(t)) style = "luxury";
      if (/hist[oó]ria|story/.test(t)) style = "story";
      if (/cta|comenta|venda/.test(t)) style = "cta";
      if (/melhor|best|top/.test(t)) {
        const best = bestDescription(video);
        replies.push({
          html: `Melhor legenda (score <strong>${best.score}/99</strong> · estilo <code>${best.style}</code>):<br><pre class="ai-pre">${escapeHtml(
            best.text
          )}</pre>`,
          apply: { description: best.text, hashtags: best.hashtags },
        });
      } else {
        const cap = generateDescription(video, style);
        replies.push({
          html: `Legenda <code>${style}</code> · score <strong>${cap.score}</strong>:<br><pre class="ai-pre">${escapeHtml(
            cap.text
          )}</pre>`,
          apply: { description: cap.text, hashtags: cap.hashtags },
        });
      }
    }

    if (/silen|mute|mudo|sem som/.test(t)) {
      replies.push({
        html: "Silenciando o vídeo. Você pode adicionar trilha depois.",
        apply: { muted: true },
      });
    }
    if (/m[uú]sica|trilha|audio|áudio|sound/.test(t)) {
      replies.push({
        html: "Modo música: importe uma trilha no painel <strong>Áudio</strong>. Volume sugerido 30%.",
        apply: { musicVolume: 0.3, videoVolume: edit.muted ? 0 : 0.65 },
      });
    }
    if (/8k|4k|full.?hd|1080|resolu|export/.test(t)) {
      let res = "fhd";
      if (/8k/.test(t)) res = "8k";
      else if (/4k|2160/.test(t)) res = "4k";
      else if (/1440|qhd|2k/.test(t)) res = "qhd";
      const map = {
        fhd: "Full HD 1080×1920",
        qhd: "QHD 1440×2560",
        "4k": "4K 2160×3840",
        "8k": "8K 4320×7680",
      };
      replies.push({
        html: `Resolução de exportação definida: <strong>${map[res]}</strong> (9:16 vertical).`,
        apply: { resolution: res },
      });
    }
    if (/cinematic|preset|filtro|cor|look|slow|punch|night|soft/.test(t)) {
      let key = "cinematic";
      if (/night/.test(t)) key = "night";
      if (/soft/.test(t)) key = "soft";
      if (/raw|natural/.test(t)) key = "raw";
      if (/slow/.test(t)) key = "slowmo";
      if (/punch|viral/.test(t)) key = "punchy";
      const p = EDIT_PRESETS[key];
      replies.push({
        html: `Preset de edição <strong>${p.name}</strong>: ${p.note}`,
        apply: { preset: key, filter: p.filter, speed: p.speed, brightness: p.brightness, contrast: p.contrast, saturate: p.saturate },
      });
    }
    if (/sugest|melhorar|editar|ajuda|o que fazer/.test(t)) {
      const s = suggestEdits(video, edit);
      replies.push({
        html:
          "<strong>Plano de edição IA</strong><ul>" +
          s.map((x) => `<li><code>${x.priority}</code> ${escapeHtml(x.text)}</li>`).join("") +
          "</ul>",
      });
    }
    if (/detalh|info|status/.test(t)) {
      replies.push({
        html: `<ul>
          <li><strong>Título:</strong> ${escapeHtml(video.title)}</li>
          <li><strong>Capa:</strong> ${escapeHtml(video.coverTitle || "—")}</li>
          <li><strong>Mute:</strong> ${edit.muted ? "sim" : "não"}</li>
          <li><strong>Música:</strong> ${edit.musicName || "nenhuma"}</li>
          <li><strong>Resolução:</strong> ${edit.resolution || "fhd"}</li>
          <li><strong>Preset:</strong> ${edit.preset || "raw"}</li>
          <li><strong>Velocidade:</strong> ${edit.speed || 1}x</li>
        </ul>`,
      });
    }

    if (!replies.length) {
      replies.push({
        html: `Sou a <strong>IA de edição + copy</strong>. Peça por exemplo:<ul>
          <li><code>gera a melhor legenda</code></li>
          <li><code>silencia e adiciona música</code></li>
          <li><code>exporta em 4K</code></li>
          <li><code>preset cinematic</code></li>
          <li><code>sugestões de edição</code></li>
        </ul>`,
      });
    }
    return replies;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  const RESOLUTIONS = {
    fhd: { id: "fhd", label: "Full HD", w: 1080, h: 1920, bitrate: "8 Mbps" },
    qhd: { id: "qhd", label: "QHD 1440p", w: 1440, h: 2560, bitrate: "16 Mbps" },
    "4k": { id: "4k", label: "4K UHD", w: 2160, h: 3840, bitrate: "35 Mbps" },
    "8k": { id: "8k", label: "8K", w: 4320, h: 7680, bitrate: "80 Mbps" },
  };

  return {
    generateDescription,
    generateBatch,
    bestDescription,
    suggestEdits,
    chatRespond,
    EDIT_PRESETS,
    RESOLUTIONS,
    scoreCaption,
  };
})();
