/**
 * Bridge: Editor Pro + AI Engine + VideoFlowApp
 */
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  function app() {
    return window.VideoFlowApp;
  }
  function ed() {
    return window.VideoFlowEditor;
  }
  function ai() {
    return window.VideoFlowAI;
  }

  function toast(m) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = m;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2500);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function refreshEditorSelect() {
    const A = app();
    if (!A) return;
    const videos = A.getVideos();
    const sel = $("#editorSelect");
    if (!sel) return;
    const cur = A.getSelected()?.id;
    sel.innerHTML = videos
      .map(
        (v) =>
          `<option value="${v.id}" ${v.id === cur ? "selected" : ""}>${esc(v.title)}${
            A.getBlobUrl(v.id) ? " · ▶" : ""
          }</option>`
      )
      .join("");
  }

  function loadCurrentIntoEditor() {
    const A = app();
    const E = ed();
    if (!A || !E) return;
    const v = A.getSelected();
    if (!v) return;
    window.__VF_VIDEO_IDS__ = A.getVideos().map((x) => x.id);
    const blob = A.getBlobUrl(v.id); // includes demoUrl
    E.loadVideo(v, blob);
    if ($("#aiDescActive")) $("#aiDescActive").textContent = v.description || "";
    const meta = $("#edMeta");
    if (meta) {
      const play = blob
        ? `<span style="color:var(--ok)">▶ Vídeo pronto para play</span>`
        : `<span style="color:var(--warn)">⚠ Sem arquivo — use Importar ou aguarde demo</span>`;
      meta.innerHTML = `<strong>${esc(v.title)}</strong><br>${esc(v.file || "")}<br>${play}`;
    }
    // demo music buttons
    const musicBox = $("#edDemoMusic");
    if (musicBox && !musicBox._ready) {
      musicBox._ready = true;
      const list = A.getDemoMusic?.() || [];
      musicBox.innerHTML = list
        .map(
          (m, i) =>
            `<button type="button" class="btn ghost sm demo-music" data-i="${i}">♪ ${esc(m.name)}</button>`
        )
        .join(" ");
      musicBox.querySelectorAll(".demo-music").forEach((btn) => {
        btn.addEventListener("click", () => {
          const m = list[Number(btn.dataset.i)];
          if (!m) return;
          E.patch(v.id, { musicUrl: m.url, musicName: m.name, musicVolume: 0.32 });
          const audio = document.querySelector("#edMusic");
          if (audio) {
            audio.src = m.url;
            audio.loop = true;
            audio.volume = 0.32;
          }
          if ($("#edMusicName")) $("#edMusicName").textContent = m.name;
          toast("Trilha: " + m.name);
        });
      });
    }
  }

  function showCaps(list) {
    const box = $("#aiCapCards");
    if (!box) return;
    box.innerHTML = list
      .map(
        (c, i) => `
      <div class="cap-card" data-i="${i}">
        <span class="score">${c.score}/99 · ${esc(c.style)}</span>
        <pre>${esc(c.text)}</pre>
      </div>`
      )
      .join("");
    box._caps = list;
    $$("#aiCapCards .cap-card").forEach((card) => {
      card.addEventListener("click", () => {
        const cap = box._caps[Number(card.dataset.i)];
        if (!cap) return;
        $("#aiDescActive").textContent = cap.text;
        toast(`Legenda ${cap.style} (score ${cap.score}) selecionada`);
      });
    });
  }

  function applyDescription(text) {
    const A = app();
    const v = A?.getSelected();
    if (!v) return;
    A.updateVideo(v.id, { description: text });
    toast("Legenda aplicada ao vídeo");
    edBot(`Legenda salva em <strong>${esc(v.title)}</strong>.`);
  }

  function edBot(html) {
    const box = $("#edChatMsgs");
    if (!box) return;
    const d = document.createElement("div");
    d.className = "msg bot";
    d.innerHTML = `<span class="who">IA Edição</span>${html}`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }
  function edUser(t) {
    const box = $("#edChatMsgs");
    if (!box) return;
    const d = document.createElement("div");
    d.className = "msg user";
    d.innerHTML = `<span class="who">Você</span>${esc(t)}`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  function handleEdChat(input) {
    const A = app();
    const E = ed();
    const AI = ai();
    if (!A || !E || !AI) return;
    const v = A.getSelected();
    const edit = E.getEdit(v.id);
    const t = input.toLowerCase();

    // music by name: "musica Midnight Drive" / "coloca a musica Neon"
    const musicMatch =
      input.match(/m[uú]sica\s+["']?(.+?)["']?\s*$/i) ||
      input.match(/(?:toca|usa|coloca|escolhe)\s+(?:a\s+)?m[uú]sica\s+["']?(.+?)["']?\s*$/i) ||
      input.match(/trilha\s+["']?(.+?)["']?\s*$/i);
    if (musicMatch) {
      const name = musicMatch[1].trim();
      const track = E.setMusicByName(v.id, name);
      if (track) {
        edUser(input);
        edBot(`Trilha aplicada: <strong>${esc(track.name)}</strong> — ${esc(track.artist)} (${track.bpm} BPM).`);
        if ($("#edMusicName")) $("#edMusicName").textContent = track.name + " — " + track.artist;
        renderMusicList(name);
        toast(track.name);
        return;
      }
      edUser(input);
      edBot(`Nao achei musica com o nome <code>${esc(name)}</code>. Tente: Midnight Drive, Neon District, Garage Flex, Supercar Anthem.`);
      return;
    }

    // auto modes via chat
    if (/auto\s*(luxury|viral|cinematic|night|reels|mute)/i.test(t) || /edita\s*auto|auto\s*edit/i.test(t)) {
      let mode = "luxury";
      if (/viral|reels/.test(t)) mode = /reels/.test(t) ? "reels_pack" : "viral";
      if (/cinematic|cinema|filme/.test(t)) mode = "cinematic";
      if (/night|noite/.test(t)) mode = "night";
      if (/mute|silen/.test(t) && !/auto/.test(t)) mode = "silence_music";
      if (/luxury|luxo/.test(t)) mode = "luxury";
      edUser(input);
      runAutoMode(mode);
      return;
    }

    const replies = AI.chatRespond(input, { video: v, edit });

    if (/silen.*todos|mute all|todos.*mudo/.test(t)) {
      const ids = A.getVideos().map((x) => x.id);
      E.setGlobalMuteAll(true, ids);
      toast("Todos silenciados");
    }

    replies.forEach((r) => {
      edBot(r.html);
      if (r.apply) {
        if (r.apply.description) {
          $("#aiDescActive").textContent = r.apply.description;
          A.updateVideo(v.id, { description: r.apply.description });
        }
        const patch = { ...r.apply };
        delete patch.description;
        delete patch.hashtags;
        if (Object.keys(patch).length) {
          E.patch(v.id, patch);
          if (patch.preset) E.applyPreset(v.id, patch.preset);
          loadCurrentIntoEditor();
        }
      }
    });
  }

  function renderMusicList(query) {
    const M = window.VideoFlowMusic;
    const E = ed();
    const A = app();
    const box = $("#edMusicList");
    if (!box || !M) return;
    const list = M.search(query || "");
    const cur = A?.getSelected() ? E.getEdit(A.getSelected().id) : {};
    box.innerHTML = list
      .map((t) => {
        const seg =
          t.start != null
            ? ` · melhor parte ${fmtSec(t.start)}–${fmtSec(t.end || t.start + 60)}`
            : "";
        return `
      <div class="music-item ${cur.musicId === t.id ? "on" : ""}" data-id="${t.id}">
        <div>
          <strong>${esc(t.name)}</strong>
          <small>${esc(t.artist)} · ${esc(t.mood)}${seg}</small>
        </div>
        <button class="btn ghost sm" type="button" data-play="${t.id}">Usar</button>
      </div>`;
      })
      .join("") || `<div style="color:var(--muted);font-size:.82rem;padding:8px">Nenhuma musica com esse nome</div>`;

    box.querySelectorAll(".music-item").forEach((row) => {
      const apply = () => {
        const v = A.getSelected();
        if (!v) return toast("Selecione um video");
        const track = M.byId(row.dataset.id);
        if (!track) return;
        E.applyTrack(E.getEdit(v.id), track);
        E.syncMusicElement(E.getEdit(v.id));
        E.applyToPlayer();
        if ($("#edMusicName")) {
          $("#edMusicName").textContent =
            track.name +
            (track.start != null ? ` (${fmtSec(track.start)}–${fmtSec(track.end)})` : "");
        }
        toast("Trilha: " + track.name);
        renderMusicList($("#edMusicSearch")?.value || "");
        A.save?.();
      };
      row.addEventListener("click", () => apply());
    });
  }

  function fmtSec(s) {
    s = Math.max(0, Number(s) || 0);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ":" + String(sec).padStart(2, "0");
  }

  function runAutoMode(mode) {
    const E = ed();
    const A = app();
    const v = A.getSelected();
    if (!v) return toast("Selecione um video");
    E.runAuto(v.id, mode, v);
    const e = E.getEdit(v.id);
    if ($("#edMusicName")) $("#edMusicName").textContent = e.musicName || "Nenhuma trilha";
    if ($("#edKenBurns")) $("#edKenBurns").checked = !!e.kenBurns;
    if ($("#edBeatPulse")) $("#edBeatPulse").checked = !!e.beatPulse;
    if ($("#edMute")) $("#edMute").checked = !!e.muted;
    if ($("#edText")) $("#edText").value = e.textOverlay || "";
    if ($("#edPreset")) $("#edPreset").value = e.preset || "raw";
    loadCurrentIntoEditor();
    toast("Auto-edit: " + (E.AUTO_MODES[mode]?.label || mode));
    edBot(
      `Apliquei <strong>${esc(E.AUTO_MODES[mode]?.label || mode)}</strong>.` +
        (e.musicName ? ` Musica: <code>${esc(e.musicName)}</code>.` : "") +
        ` ${esc(E.AUTO_MODES[mode]?.desc || "")}`
    );
    A.save?.();
  }

  function wire() {
    const E = ed();
    const A = app();
    if (!E || !A) {
      setTimeout(wire, 80);
      return;
    }

    E.bindControls(
      () => A.getSelected(),
      (id) => A.getBlobUrl(id),
      () => A.save?.()
    );

    // Auto-edit bar
    document.querySelectorAll("[data-auto]").forEach((btn) => {
      btn.addEventListener("click", () => runAutoMode(btn.dataset.auto));
    });
    $("#edAutoAll")?.addEventListener("click", () => {
      const mode = prompt(
        "Modo auto para TODOS (luxury, viral, cinematic, night, reels_pack, silence_music, clean_export):",
        "reels_pack"
      );
      if (!mode || !E.AUTO_MODES[mode]) return toast("Modo invalido");
      const ids = A.getVideos().map((v) => v.id);
      E.runAutoAll(ids, mode, (id) => A.getVideos().find((v) => v.id === id));
      toast("Auto-edit em " + ids.length + " videos");
      loadCurrentIntoEditor();
      edBot(`Auto <strong>${esc(mode)}</strong> aplicado em <strong>${ids.length}</strong> videos.`);
      A.save?.();
    });

    // Music search by name
    const doSearch = () => renderMusicList($("#edMusicSearch")?.value || "");
    $("#edMusicSearchBtn")?.addEventListener("click", doSearch);
    $("#edMusicSearch")?.addEventListener("input", doSearch);
    $("#edMusicSearch")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = $("#edMusicSearch").value.trim();
        const v = A.getSelected();
        if (!v) return;
        const t = E.setMusicByName(v.id, q);
        if (t) {
          toast("Musica: " + t.name);
          if ($("#edMusicName")) $("#edMusicName").textContent = t.name + " — " + t.artist;
          renderMusicList(q);
        } else toast("Nao achei musica com esse nome");
      }
    });
    renderMusicList("");

    $("#edKenBurns")?.addEventListener("change", (e) => {
      const v = A.getSelected();
      if (!v) return;
      E.patch(v.id, { kenBurns: e.target.checked, zoom: e.target.checked ? 1.1 : 1 });
    });
    $("#edBeatPulse")?.addEventListener("change", (e) => {
      const v = A.getSelected();
      if (!v) return;
      E.patch(v.id, { beatPulse: e.target.checked });
    });

    // volume labels
    $("#edVolVideo")?.addEventListener("input", (e) => {
      const sp = e.target.parentElement?.querySelector("span:last-child");
      // update sibling val if present
      const val = $("#edVolVideoVal");
      if (val) val.textContent = Math.round(Number(e.target.value) * 100) + "%";
    });

    $("#editorSelect")?.addEventListener("change", (e) => {
      A.setSelected(Number(e.target.value));
      loadCurrentIntoEditor();
    });

    // when opening editor tab
    $$('[data-view="editor"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        setTimeout(() => {
          refreshEditorSelect();
          loadCurrentIntoEditor();
        }, 30);
      });
    });

    // AI captions
    $("#aiBestCap")?.addEventListener("click", () => {
      const v = A.getSelected();
      const best = ai().bestDescription(v);
      showCaps([best]);
      $("#aiDescActive").textContent = best.text;
      toast(`Melhor legenda · score ${best.score}`);
    });
    $("#aiViral")?.addEventListener("click", () => {
      const c = ai().generateDescription(A.getSelected(), "viral");
      showCaps([c]);
      $("#aiDescActive").textContent = c.text;
    });
    $("#aiLuxury")?.addEventListener("click", () => {
      const c = ai().generateDescription(A.getSelected(), "luxury");
      showCaps([c]);
      $("#aiDescActive").textContent = c.text;
    });
    $("#aiStory")?.addEventListener("click", () => {
      const c = ai().generateDescription(A.getSelected(), "story");
      showCaps([c]);
      $("#aiDescActive").textContent = c.text;
    });
    $("#aiAllCaps")?.addEventListener("click", () => {
      const batch = ai().generateBatch(A.getSelected(), 4);
      batch.sort((a, b) => b.score - a.score);
      showCaps(batch);
      $("#aiDescActive").textContent = batch[0].text;
      toast("4 legendas geradas — clique para escolher");
    });
    $("#aiApplyDesc")?.addEventListener("click", () => {
      applyDescription($("#aiDescActive").textContent || "");
    });

    // chat
    $("#edChatSend")?.addEventListener("click", () => {
      const t = $("#edChatInput").value.trim();
      if (!t) return;
      edUser(t);
      $("#edChatInput").value = "";
      setTimeout(() => handleEdChat(t), 180);
    });
    $("#edChatInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $("#edChatSend").click();
      }
    });
    $$(".ed-sug").forEach((s) =>
      s.addEventListener("click", () => {
        $("#edChatInput").value = s.textContent;
        $("#edChatSend").click();
      })
    );

    $("#btnEdImportHint")?.addEventListener("click", () => {
      A.setView("import");
      toast("Importe os MP4 para assistir no editor");
    });

    // enhance genViral with AI when available
    if (ai() && A.genViral) {
      const original = null;
    }

    // auto-generate better descriptions on demand for all
    const regen = $("#btnRegenAll");
    if (regen) {
      regen.addEventListener("click", () => {
        A.getVideos().forEach((v) => {
          const best = ai().bestDescription(v);
          v.description = best.text;
        });
        A.save();
        A.renderAll();
        toast("Legendas IA (melhor score) em todos");
      });
    }

    // first hello in editor chat
    edBot(
      `Editor Pro <strong>Max</strong> pronto.<br>
      • <strong>Auto-Edit</strong>: Luxury, Viral, Cinematic, Night, Reels<br>
      • Musica por nome: <code>musica Midnight Drive</code><br>
      • Busca na lista + upload MP3<br>
      • Timeline V/M · Ken Burns · Beat pulse · Full HD/4K/8K<br>
      • <code>auto viral</code> ou <code>auto luxury</code> no chat`
    );

    // re-refresh select when entering app
    $("#btnEnter")?.addEventListener("click", () => {
      setTimeout(() => {
        refreshEditorSelect();
      }, 200);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
