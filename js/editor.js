/**
 * VideoFlow Pro Editor — player, mute, music, filters, resolution, timeline
 */
window.VideoFlowEditor = (function () {
  const defaultEdit = () => ({
    muted: false,
    videoVolume: 1,
    musicVolume: 0.32,
    musicName: "",
    musicUrl: "",
    musicId: "",
    musicOffset: 0,
    speed: 1,
    brightness: 1,
    contrast: 1,
    saturate: 1,
    blur: 0,
    hue: 0,
    vignette: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    filter: "none",
    preset: "raw",
    autoMode: "none",
    resolution: "fhd",
    trimStart: 0,
    trimEnd: null,
    loop: true,
    textOverlay: "",
    textSize: 28,
    textY: 78,
    textColor: "#ffffff",
    textStroke: true,
    kenBurns: false,
    flashIntro: false,
    reverseFeel: false,
    beatPulse: false,
  });

  let edits = {}; // videoId -> edit state
  let globalMuteAll = false;
  let musicFileUrl = null;
  let currentId = null;
  let raf = null;

  const $ = (s, r = document) => r.querySelector(s);

  function getEdit(id) {
    if (!edits[id]) edits[id] = defaultEdit();
    return edits[id];
  }

  function setGlobalMuteAll(on, videoIds = []) {
    globalMuteAll = !!on;
    videoIds.forEach((id) => {
      const e = getEdit(id);
      e.muted = globalMuteAll;
      if (globalMuteAll) e.videoVolume = 0;
    });
    applyToPlayer();
    return globalMuteAll;
  }

  function buildFilter(e) {
    const parts = [];
    if (e.filter && e.filter !== "none" && e.preset && e.preset !== "raw" && e.preset !== "custom") {
      parts.push(e.filter);
    } else {
      parts.push(`brightness(${e.brightness ?? 1})`);
      parts.push(`contrast(${e.contrast ?? 1})`);
      parts.push(`saturate(${e.saturate ?? 1})`);
    }
    if (e.blur > 0) parts.push(`blur(${e.blur}px)`);
    if (e.hue) parts.push(`hue-rotate(${e.hue}deg)`);
    return parts.join(" ");
  }

  function applyTransform(e) {
    const { video: v, wrap } = els();
    const z = e.zoom || 1;
    const x = e.panX || 0;
    const y = e.panY || 0;
    const t = `scale(${z}) translate(${x}%, ${y}%)`;
    if (v) {
      v.style.transform = t;
      v.style.transformOrigin = "center center";
    }
    if (wrap) wrap.classList.toggle("kenburns", !!e.kenBurns);
    if (wrap) wrap.classList.toggle("vignette-on", (e.vignette || 0) > 0.2);
    if (wrap) wrap.style.setProperty("--vig", String(e.vignette || 0));
  }

  /** Auto-edit modes — editor pro automatico */
  const AUTO_MODES = {
    luxury: {
      label: "Auto Luxury",
      desc: "Mute original + cinematic + musica luxury + texto",
      apply(e, video) {
        Object.assign(e, {
          autoMode: "luxury",
          muted: true,
          videoVolume: 0,
          musicVolume: 0.38,
          preset: "cinematic",
          filter: "contrast(1.14) saturate(1.1) brightness(1.04)",
          brightness: 1.04,
          contrast: 1.14,
          saturate: 1.1,
          speed: 0.92,
          kenBurns: true,
          zoom: 1.08,
          vignette: 0.45,
          textOverlay: "LUXURY",
          textSize: 34,
          textY: 78,
          flashIntro: true,
        });
        pickMusic(e, video, "Estilo Bilionario");
      },
    },
    viral: {
      label: "Auto Viral",
      desc: "Punchy + energia + musica high BPM",
      apply(e, video) {
        Object.assign(e, {
          autoMode: "viral",
          muted: true,
          videoVolume: 0,
          musicVolume: 0.42,
          preset: "punchy",
          filter: "contrast(1.2) saturate(1.25) brightness(1.06)",
          brightness: 1.06,
          contrast: 1.2,
          saturate: 1.25,
          speed: 1.08,
          kenBurns: true,
          zoom: 1.12,
          beatPulse: true,
          textOverlay: (video.title || "VIRAL").split(" ").slice(0, 3).join(" ").toUpperCase(),
          textSize: 30,
          textY: 72,
        });
        pickMusic(e, video, "PROOF");
      },
    },
    cinematic: {
      label: "Auto Cinematic",
      desc: "Slow-mo + cor de filme + trilha epica",
      apply(e, video) {
        Object.assign(e, {
          autoMode: "cinematic",
          muted: true,
          videoVolume: 0,
          musicVolume: 0.35,
          preset: "slowmo",
          filter: "contrast(1.12) saturate(1.05) brightness(1.02)",
          speed: 0.75,
          kenBurns: true,
          zoom: 1.15,
          vignette: 0.55,
          textOverlay: "",
          hue: -6,
        });
        pickMusic(e, video, "Billionaire Lifestyle");
      },
    },
    night: {
      label: "Auto Night Drive",
      desc: "Look noite + neon + musica dark",
      apply(e, video) {
        Object.assign(e, {
          autoMode: "night",
          muted: true,
          videoVolume: 0.15,
          musicVolume: 0.4,
          preset: "night",
          filter: "contrast(1.22) brightness(0.92) saturate(0.95)",
          brightness: 0.92,
          contrast: 1.22,
          saturate: 0.95,
          speed: 1,
          vignette: 0.6,
          textOverlay: "NIGHT DRIVE",
          textSize: 32,
        });
        pickMusic(e, video, "Skyfall");
      },
    },
    silence_music: {
      label: "Auto Mute + Musica",
      desc: "Silencia video e escolhe trilha automatica",
      apply(e, video) {
        Object.assign(e, {
          autoMode: "silence_music",
          muted: true,
          videoVolume: 0,
          musicVolume: 0.4,
        });
        const sug = window.VideoFlowMusic?.suggestForEdit(e, video);
        if (sug) applyTrack(e, sug);
      },
    },
    clean_export: {
      label: "Auto Clean FHD",
      desc: "Reset limpo + Full HD 9:16",
      apply(e) {
        Object.assign(e, defaultEdit(), {
          autoMode: "clean_export",
          resolution: "fhd",
          loop: true,
        });
      },
    },
    reels_pack: {
      label: "Auto Reels Pack",
      desc: "Otimizado TikTok/Reels: mute, punch, anthem, texto curto",
      apply(e, video) {
        Object.assign(e, {
          autoMode: "reels_pack",
          muted: true,
          videoVolume: 0,
          musicVolume: 0.45,
          preset: "punchy",
          filter: "contrast(1.18) saturate(1.2) brightness(1.05)",
          speed: 1.05,
          resolution: "fhd",
          kenBurns: true,
          zoom: 1.1,
          textOverlay: "WATCH THIS",
          textSize: 36,
          textY: 70,
          flashIntro: true,
        });
        pickMusic(e, video, "PROOF — Drop");
      },
    },
  };

  function pickMusic(e, video, preferredName) {
    const M = window.VideoFlowMusic;
    if (!M) return;
    const t = (preferredName && M.byName(preferredName)) || M.suggestForEdit(e, video);
    if (t) applyTrack(e, t);
  }

  function applyTrack(e, track) {
    e.musicId = track.id;
    e.musicName = track.name + " — " + track.artist;
    e.musicUrl = track.url || "";
    e.musicSource = track.source || "file";
    e.youtubeId = track.youtubeId || "";
    e.musicStart = track.start || 0;
    e.musicEnd = track.end || 0;
  }

  function runAuto(id, modeKey, video) {
    const e = getEdit(id);
    const mode = AUTO_MODES[modeKey];
    if (!mode) throw new Error("Modo auto desconhecido: " + modeKey);
    mode.apply(e, video || { id });
    if (id === currentId) {
      applyToPlayer();
      syncMusicElement(e);
      applyTransform(e);
      if (e.flashIntro) triggerFlash();
    }
    return e;
  }

  function runAutoAll(ids, modeKey, getVideo) {
    ids.forEach((id) => runAuto(id, modeKey, getVideo?.(id)));
  }

  function setMusicByName(id, name) {
    const M = window.VideoFlowMusic;
    const t = M?.byName(name) || M?.search(name)[0];
    if (!t) return null;
    const e = getEdit(id);
    applyTrack(e, t);
    if (id === currentId) {
      syncMusicElement(e);
      applyToPlayer();
    }
    return t;
  }

  function syncMusicElement(e) {
    const { music, video: v } = els();
    const ytBox = document.querySelector("#edYtMusic");
    // YouTube tracks: use embed (best segment), pause HTML audio
    if (e.musicSource === "youtube" && e.youtubeId) {
      if (music) {
        music.pause();
        music.removeAttribute("src");
      }
      if (ytBox) {
        const start = e.musicStart || 0;
        const end = e.musicEnd || "";
        let src =
          "https://www.youtube.com/embed/" +
          e.youtubeId +
          "?enablejsapi=1&rel=0&start=" +
          start;
        if (end) src += "&end=" + end;
        // autoplay only if video is playing
        if (v && !v.paused) src += "&autoplay=1";
        if (ytBox.dataset.src !== src) {
          ytBox.src = src;
          ytBox.dataset.src = src;
        }
        ytBox.style.display = "block";
      }
      return;
    }
    if (ytBox) {
      ytBox.style.display = "none";
      ytBox.removeAttribute("src");
      ytBox.dataset.src = "";
    }
    if (!music) return;
    if (e.musicUrl && !/^https?:\/\/(www\.)?youtube\.com/i.test(e.musicUrl)) {
      if (music.getAttribute("src") !== e.musicUrl) {
        music.src = e.musicUrl;
      }
      music.loop = true;
      music.volume = e.musicVolume ?? 0.32;
      music.currentTime = Math.max(0, e.musicOffset || 0);
      if (v && !v.paused) music.play().catch(() => {});
    } else {
      music.pause();
      music.removeAttribute("src");
    }
  }

  function triggerFlash() {
    const { wrap } = els();
    if (!wrap) return;
    wrap.classList.remove("flash");
    void wrap.offsetWidth;
    wrap.classList.add("flash");
    setTimeout(() => wrap.classList.remove("flash"), 500);
  }

  function els() {
    return {
      video: $("#edPlayer"),
      music: $("#edMusic"),
      cover: $("#edCover"),
      wrap: $("#edStage"),
      seek: $("#edSeek"),
      time: $("#edTime"),
      overlay: $("#edTextOverlay"),
    };
  }

  function loadVideo(video, blobUrl) {
    currentId = video.id;
    const e = getEdit(video.id);
    const { video: v, music, cover, overlay } = els();
    if (!v) return;

    const coverPath = (window.VideoFlowApp && window.VideoFlowApp.asset)
      ? window.VideoFlowApp.asset(video.cover || "covers/car-01-mansao.jpg")
      : (video.cover || "covers/car-01-mansao.jpg");
    if (blobUrl) {
      v.style.display = "block";
      v.controls = true;
      if (cover) cover.style.display = "none";
      if (v.getAttribute("src") !== blobUrl) {
        v.src = blobUrl;
        v.load();
      }
    } else {
      v.pause();
      v.removeAttribute("src");
      v.load?.();
      v.style.display = "none";
      if (cover) {
        cover.style.display = "block";
        cover.src = coverPath;
      }
    }

    v.loop = e.loop;
    v.playbackRate = e.speed || 1;
    v.muted = e.muted || globalMuteAll;
    v.volume = e.muted || globalMuteAll ? 0 : Math.min(1, e.videoVolume || 1);
    v.style.filter = buildFilter(e);
    applyTransform(e);
    syncMusicElement(e);

    if (overlay) {
      overlay.textContent = e.textOverlay || "";
      overlay.style.fontSize = (e.textSize || 28) + "px";
      overlay.style.top = (e.textY || 78) + "%";
      overlay.style.color = e.textColor || "#fff";
      overlay.style.display = e.textOverlay ? "flex" : "none";
      overlay.classList.toggle("stroke", e.textStroke !== false);
    }

    syncUI(video, e);
    updateResLabel(e);
    renderTimeline(e, v);
  }

  function syncUI(video, e) {
    const set = (id, val, isCheck) => {
      const el = $(id);
      if (!el) return;
      if (isCheck) el.checked = !!val;
      else el.value = val;
    };
    set("#edMute", e.muted || globalMuteAll, true);
    set("#edLoop", e.loop, true);
    set("#edVolVideo", e.videoVolume);
    set("#edVolMusic", e.musicVolume);
    set("#edSpeed", e.speed);
    set("#edBright", e.brightness);
    set("#edContrast", e.contrast);
    set("#edSaturate", e.saturate);
    set("#edPreset", e.preset || "raw");
    set("#edRes", e.resolution || "fhd");
    set("#edText", e.textOverlay || "");
    set("#edTextSize", e.textSize || 28);
    set("#edTrimStart", e.trimStart || 0);
    const meta = $("#edMeta");
    if (meta && video) {
      meta.innerHTML = `
        <strong>${escapeHtml(video.title)}</strong><br>
        <span>${escapeHtml(video.file || "sem arquivo local")}</span><br>
        <span>Capa: ${escapeHtml(video.coverTitle || "—")} · ${escapeHtml(video.coverPlace || "")}</span>
      `;
    }
    const musicLbl = $("#edMusicName");
    if (musicLbl) musicLbl.textContent = e.musicName || "Nenhuma trilha";
  }

  function updateResLabel(e) {
    const R = window.VideoFlowAI?.RESOLUTIONS || {};
    const r = R[e.resolution] || R.fhd;
    const el = $("#edResInfo");
    if (el && r) {
      el.textContent = `${r.label} · ${r.w}×${r.h} · 9:16 · ~${r.bitrate}`;
    }
  }

  function applyToPlayer() {
    if (currentId == null) return;
    const e = getEdit(currentId);
    const { video: v, music, overlay } = els();
    if (!v) return;
    let rate = e.speed || 1;
    if (e.beatPulse && !v.paused) {
      // micro pulse for energy feel
      rate = rate * (1 + 0.03 * Math.sin(performance.now() / 180));
    }
    v.playbackRate = rate;
    v.loop = !!e.loop;
    v.muted = e.muted || globalMuteAll;
    v.volume = e.muted || globalMuteAll ? 0 : Math.min(1, Number(e.videoVolume) || 0);
    v.style.filter = buildFilter(e);
    applyTransform(e);
    if (music && e.musicUrl) {
      music.volume = Number(e.musicVolume) || 0;
    }
    if (overlay) {
      overlay.textContent = e.textOverlay || "";
      overlay.style.fontSize = (e.textSize || 28) + "px";
      overlay.style.top = (e.textY || 78) + "%";
      overlay.style.color = e.textColor || "#fff";
      overlay.style.display = e.textOverlay ? "flex" : "none";
      overlay.classList.toggle("stroke", e.textStroke !== false);
    }
    updateResLabel(e);
    renderTimeline(e, v);
  }

  function renderTimeline(e, v) {
    const bar = $("#edTimelineBar");
    const playhead = $("#edPlayhead");
    const trimA = $("#edTrimA");
    const trimB = $("#edTrimB");
    if (!bar || !v || !v.duration || !isFinite(v.duration)) return;
    const pct = (v.currentTime / v.duration) * 100;
    if (playhead) playhead.style.left = pct + "%";
    const ts = ((e.trimStart || 0) / v.duration) * 100;
    const te = e.trimEnd != null ? (e.trimEnd / v.duration) * 100 : 100;
    if (trimA) trimA.style.width = Math.max(0, ts) + "%";
    if (trimB) {
      trimB.style.left = te + "%";
      trimB.style.width = Math.max(0, 100 - te) + "%";
    }
    const musicLane = $("#edMusicLane");
    if (musicLane) {
      musicLane.textContent = e.musicName ? "♪ " + e.musicName : "♪ sem trilha";
      musicLane.classList.toggle("on", !!e.musicUrl);
    }
  }

  function play() {
    const { video: v, music } = els();
    const e = currentId != null ? getEdit(currentId) : null;
    v?.play().catch(() => {});
    if (music && e?.musicUrl) {
      music.currentTime = v?.currentTime || 0;
      music.play().catch(() => {});
    }
    startTicker();
  }

  function pause() {
    const { video: v, music } = els();
    v?.pause();
    music?.pause();
    stopTicker();
  }

  function stop() {
    const { video: v, music } = els();
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    if (music) {
      music.pause();
      music.currentTime = 0;
    }
    stopTicker();
    updateTimeUI();
  }

  function startTicker() {
    stopTicker();
    const tick = () => {
      updateTimeUI();
      const { video: v, music } = els();
      const e = currentId != null ? getEdit(currentId) : null;
      if (v && e) {
        if (e.trimEnd != null && v.currentTime >= e.trimEnd) {
          if (e.loop) v.currentTime = e.trimStart || 0;
          else pause();
        }
        if (music && e.musicUrl && !music.paused && Math.abs(music.currentTime - v.currentTime) > 0.35) {
          music.currentTime = v.currentTime;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function stopTicker() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function updateTimeUI() {
    const { video: v, seek, time } = els();
    if (!v || !v.duration || !isFinite(v.duration)) {
      if (time) time.textContent = "0:00 / 0:00";
      return;
    }
    if (seek && document.activeElement !== seek) {
      seek.max = v.duration;
      seek.value = v.currentTime;
    }
    if (time) time.textContent = `${fmtTime(v.currentTime)} / ${fmtTime(v.duration)}`;
  }

  function fmtTime(s) {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function patch(id, partial) {
    Object.assign(getEdit(id), partial);
    if (id === currentId) applyToPlayer();
  }

  function applyPreset(id, key) {
    const p = window.VideoFlowAI?.EDIT_PRESETS?.[key];
    if (!p) return;
    patch(id, {
      preset: key,
      filter: p.filter,
      speed: p.speed,
      brightness: p.brightness,
      contrast: p.contrast,
      saturate: p.saturate,
    });
  }

  function setMusic(id, file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    patch(id, { musicUrl: url, musicName: file.name });
    const { music, video: v } = els();
    if (music) {
      music.src = url;
      music.loop = true;
      music.volume = getEdit(id).musicVolume;
      if (v && !v.paused) music.play().catch(() => {});
    }
  }

  function clearMusic(id) {
    patch(id, { musicUrl: "", musicName: "" });
    const { music } = els();
    if (music) {
      music.pause();
      music.removeAttribute("src");
    }
  }

  function exportProject(video) {
    const e = getEdit(video.id);
    const R = window.VideoFlowAI?.RESOLUTIONS?.[e.resolution] || { w: 1080, h: 1920, label: "FHD" };
    return {
      version: 1,
      title: video.title,
      file: video.file,
      format: "9:16",
      resolution: R,
      edit: { ...e, musicUrl: e.musicName ? `[local:${e.musicName}]` : "" },
      description: video.description,
      createdAt: new Date().toISOString(),
      notes:
        "Projeto VideoFlow Pro. Render final com FFmpeg/HandBrake: scale/crop para " +
        `${R.w}x${R.h}, áudio vídeo ${e.muted ? "mudo" : "on"}, trilha ${e.musicName || "nenhuma"}.`,
    };
  }

  function downloadProject(video) {
    const data = exportProject(video);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `videoflow-edit-${video.id}.json`;
    a.click();
  }

  function bindControls(getVideo, getBlobUrl, onChange) {
    const idOf = () => getVideo()?.id;

    $("#edPlay")?.addEventListener("click", play);
    $("#edPause")?.addEventListener("click", pause);
    $("#edStop")?.addEventListener("click", stop);

    $("#edSeek")?.addEventListener("input", (ev) => {
      const { video: v, music } = els();
      if (!v) return;
      v.currentTime = Number(ev.target.value);
      if (music && getEdit(idOf()).musicUrl) music.currentTime = v.currentTime;
      updateTimeUI();
    });

    $("#edMute")?.addEventListener("change", (ev) => {
      patch(idOf(), { muted: ev.target.checked, videoVolume: ev.target.checked ? 0 : 1 });
      onChange?.();
    });
    $("#edLoop")?.addEventListener("change", (ev) => {
      patch(idOf(), { loop: ev.target.checked });
    });
    $("#edVolVideo")?.addEventListener("input", (ev) => {
      const vol = Number(ev.target.value);
      patch(idOf(), { videoVolume: vol, muted: vol === 0 });
      const m = $("#edMute");
      if (m) m.checked = vol === 0;
      onChange?.();
    });
    $("#edVolMusic")?.addEventListener("input", (ev) => {
      patch(idOf(), { musicVolume: Number(ev.target.value) });
      onChange?.();
    });
    $("#edSpeed")?.addEventListener("input", (ev) => {
      patch(idOf(), { speed: Number(ev.target.value) });
      $("#edSpeedVal") && ($("#edSpeedVal").textContent = Number(ev.target.value).toFixed(2) + "x");
      onChange?.();
    });
    ["#edBright", "#edContrast", "#edSaturate"].forEach((sel) => {
      $(sel)?.addEventListener("input", () => {
        patch(idOf(), {
          brightness: Number($("#edBright").value),
          contrast: Number($("#edContrast").value),
          saturate: Number($("#edSaturate").value),
          preset: "custom",
          filter: "none",
        });
        onChange?.();
      });
    });
    $("#edPreset")?.addEventListener("change", (ev) => {
      applyPreset(idOf(), ev.target.value);
      syncUI(getVideo(), getEdit(idOf()));
      onChange?.();
    });
    $("#edRes")?.addEventListener("change", (ev) => {
      patch(idOf(), { resolution: ev.target.value });
      onChange?.();
    });
    $("#edText")?.addEventListener("input", (ev) => {
      patch(idOf(), { textOverlay: ev.target.value });
      onChange?.();
    });
    $("#edTextSize")?.addEventListener("input", (ev) => {
      patch(idOf(), { textSize: Number(ev.target.value) });
    });
    $("#edMusicFile")?.addEventListener("change", (ev) => {
      const f = ev.target.files?.[0];
      if (f) {
        setMusic(idOf(), f);
        onChange?.();
      }
    });
    $("#edMusicClear")?.addEventListener("click", () => {
      clearMusic(idOf());
      onChange?.();
    });
    function allIds() {
      const raw = window.__VF_VIDEO_IDS__;
      const ids = typeof raw === "function" ? raw() : raw;
      return Array.isArray(ids) && ids.length ? ids : [idOf()];
    }
    $("#edMuteAll")?.addEventListener("click", () => {
      const ids = allIds();
      setGlobalMuteAll(true, ids);
      toastMsg("Todos os vídeos silenciados");
      syncUI(getVideo(), getEdit(idOf()));
      onChange?.();
    });
    $("#edUnmuteAll")?.addEventListener("click", () => {
      const ids = allIds();
      setGlobalMuteAll(false, ids);
      ids.forEach((id) => patch(id, { muted: false, videoVolume: 1 }));
      toastMsg("Som restaurado em todos");
      syncUI(getVideo(), getEdit(idOf()));
      onChange?.();
    });
    $("#edExportJson")?.addEventListener("click", () => {
      const v = getVideo();
      if (v) downloadProject(v);
    });
    $("#edFullscreen")?.addEventListener("click", () => {
      const { video: v, wrap } = els();
      const el = v?.style.display !== "none" ? v : wrap;
      el?.requestFullscreen?.();
    });

    // keyboard
    window.addEventListener("keydown", (ev) => {
      if (!$("#view-editor")?.classList.contains("active")) return;
      if (ev.target.matches("input,textarea,select,[contenteditable]")) return;
      if (ev.code === "Space") {
        ev.preventDefault();
        const v = els().video;
        if (v?.paused) play();
        else pause();
      }
    });
  }

  function toastMsg(m) {
    const el = document.querySelector("#toast");
    if (!el) return;
    el.textContent = m;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2200);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function serialize() {
    return { edits, globalMuteAll };
  }

  function hydrate(data) {
    if (data?.edits) edits = data.edits;
    if (typeof data?.globalMuteAll === "boolean") globalMuteAll = data.globalMuteAll;
  }

  return {
    getEdit,
    loadVideo,
    play,
    pause,
    stop,
    patch,
    applyPreset,
    setMusic,
    clearMusic,
    setMusicByName,
    setGlobalMuteAll,
    bindControls,
    exportProject,
    downloadProject,
    serialize,
    hydrate,
    applyToPlayer,
    runAuto,
    runAutoAll,
    AUTO_MODES,
    applyTrack,
    syncMusicElement,
    triggerFlash,
  };
})();
