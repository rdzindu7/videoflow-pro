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
    const blob = A.getBlobUrl(v.id);
    E.loadVideo(v, blob);
    $("#aiDescActive") && ($("#aiDescActive").textContent = v.description || "");
    if (!blob) {
      $("#edMeta") &&
        ($("#edMeta").innerHTML +=
          `<br><span style="color:var(--warn)">⚠ Importe o MP4 em Importar para assistir e editar o vídeo real.</span>`);
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
    const replies = AI.chatRespond(input, { video: v, edit });

    // special global mute via chat
    const t = input.toLowerCase();
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

  function wire() {
    const E = ed();
    const A = app();
    if (!E || !A) {
      setTimeout(wire, 50);
      return;
    }

    E.bindControls(
      () => A.getSelected(),
      (id) => A.getBlobUrl(id),
      () => A.save?.()
    );

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
      `Editor Pro pronto.<br>
      • <strong>Play</strong> nos vídeos importados<br>
      • <strong>Silenciar todos</strong> + música<br>
      • Export <strong>Full HD / 4K / 8K</strong> 9:16<br>
      • IA gera as <strong>melhores descrições</strong> com score<br>
      Importe MP4s e peça: <code>gera a melhor legenda</code>`
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
