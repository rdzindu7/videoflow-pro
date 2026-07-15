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
    speed: 1,
    brightness: 1,
    contrast: 1,
    saturate: 1,
    filter: "none",
    preset: "raw",
    resolution: "fhd",
    trimStart: 0,
    trimEnd: null,
    loop: true,
    textOverlay: "",
    textSize: 28,
    textY: 78,
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
    if (e.filter && e.filter !== "none" && e.preset && e.preset !== "raw") return e.filter;
    return `brightness(${e.brightness}) contrast(${e.contrast}) saturate(${e.saturate})`;
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

    if (blobUrl) {
      v.style.display = "block";
      if (cover) cover.style.display = "none";
      if (v.src !== blobUrl) {
        v.src = blobUrl;
        v.load();
      }
    } else {
      v.pause();
      v.removeAttribute("src");
      v.style.display = "none";
      if (cover) {
        cover.style.display = "block";
        cover.src = video.cover || "covers/car-01-mansao.jpg";
      }
    }

    v.loop = e.loop;
    v.playbackRate = e.speed || 1;
    v.muted = e.muted || globalMuteAll;
    v.volume = e.muted || globalMuteAll ? 0 : Math.min(1, e.videoVolume || 1);
    v.style.filter = buildFilter(e);

    if (music) {
      if (e.musicUrl) {
        if (music.src !== e.musicUrl) music.src = e.musicUrl;
        music.volume = e.musicVolume || 0.3;
        music.loop = true;
      } else if (musicFileUrl) {
        // global music optional
      } else {
        music.pause();
        music.removeAttribute("src");
      }
    }

    if (overlay) {
      overlay.textContent = e.textOverlay || "";
      overlay.style.fontSize = (e.textSize || 28) + "px";
      overlay.style.top = (e.textY || 78) + "%";
      overlay.style.display = e.textOverlay ? "flex" : "none";
    }

    syncUI(video, e);
    updateResLabel(e);
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
    v.playbackRate = e.speed || 1;
    v.loop = !!e.loop;
    v.muted = e.muted || globalMuteAll;
    v.volume = e.muted || globalMuteAll ? 0 : Math.min(1, Number(e.videoVolume) || 0);
    v.style.filter = buildFilter(e);
    if (music && e.musicUrl) {
      music.volume = Number(e.musicVolume) || 0;
    }
    if (overlay) {
      overlay.textContent = e.textOverlay || "";
      overlay.style.fontSize = (e.textSize || 28) + "px";
      overlay.style.top = (e.textY || 78) + "%";
      overlay.style.display = e.textOverlay ? "flex" : "none";
    }
    updateResLabel(e);
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
    setGlobalMuteAll,
    bindControls,
    exportProject,
    downloadProject,
    serialize,
    hydrate,
    applyToPlayer,
  };
})();
