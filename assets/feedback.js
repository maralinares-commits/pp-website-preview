/* Comment widget for the website draft.
   ------------------------------------------------------------------------
   Al presses "Add a comment", clicks the part of the page he means, types,
   and sends. The comment is filed as a GitHub issue by the small service
   behind /api/feedback, which holds the token; nothing secret is in here.

   Deliberate choices:
   - Picking a section is optional. "About this page" is always available,
     because making someone aim before they can speak loses comments.
   - Any text selected before opening is carried along as a quote.
   - When the service is not switched on, the box says so. The earlier version
     of this on the brandbook failed silently, which is worse than absent.   */

(function () {
  "use strict";

  var ENDPOINT = "/api/feedback";
  var state = { open: false, picking: false, section: null, quote: "", user: "", configured: null };

  /* ------------------------------------------------------------ helpers -- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* A short label, so an issue title reads "Home, How it works: ..." rather
     than repeating the whole headline of the page. */
  function pageName() {
    if (document.body.getAttribute("data-page")) {
      return document.body.getAttribute("data-page");
    }
    var h1 = document.querySelector("h1");
    return (h1 ? h1.textContent : document.title).replace(/\s+/g, " ").trim();
  }

  /* Sections a comment can be attached to: the ones with a heading. */
  function sections() {
    return Array.prototype.slice
      .call(document.querySelectorAll("main section, main .promo, main .howto, footer.site-footer"))
      .filter(function (s) {
        return s.getBoundingClientRect().height > 40;
      });
  }

  function labelFor(node) {
    var h = node.querySelector("h1, h2, h3");
    if (h) return h.textContent.replace(/\s+/g, " ").trim();
    if (node.tagName === "FOOTER") return "The footer";
    return "";
  }

  /* --------------------------------------------------------------- chrome - */

  var launcher = el("button", "fb-launch");
  launcher.type = "button";
  launcher.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.1a8.4 8.4 0 0 1 3.7-11.3 8.6 8.6 0 0 1 4-1h.5a8.4 8.4 0 0 1 7.9 7.9z"/>' +
    "</svg><span>Add a comment</span>";

  var panel = null;
  var hint = null;
  var outline = null;

  function stop() {
    state.picking = false;
    document.body.classList.remove("fb-picking");
    if (hint) { hint.remove(); hint = null; }
    if (outline) { outline.remove(); outline = null; }
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onPick, true);
  }

  function close() {
    stop();
    if (panel) { panel.remove(); panel = null; }
    state.open = false;
    launcher.hidden = false;
    launcher.focus();
  }

  /* ------------------------------------------------------------- picking -- */

  function nearestSection(target) {
    var all = sections();
    for (var n = target; n && n !== document.body; n = n.parentNode) {
      if (all.indexOf(n) !== -1) return n;
    }
    return null;
  }

  function onMove(e) {
    if (!state.picking) return;
    var node = nearestSection(e.target);
    if (!node) { if (outline) outline.style.display = "none"; return; }
    var r = node.getBoundingClientRect();
    if (!outline) {
      outline = el("div", "fb-outline");
      document.body.appendChild(outline);
    }
    outline.style.display = "block";
    outline.style.top = (r.top + window.scrollY - 4) + "px";
    outline.style.left = (r.left + window.scrollX - 4) + "px";
    outline.style.width = (r.width + 8) + "px";
    outline.style.height = (r.height + 8) + "px";
  }

  function onPick(e) {
    if (!state.picking) return;
    if (panel && panel.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    var node = nearestSection(e.target);
    if (node) {
      state.section = { id: node.id || "", label: labelFor(node) };
    }
    stop();
    render();
  }

  function startPicking() {
    state.picking = true;
    document.body.classList.add("fb-picking");
    hint = el("div", "fb-hint", "Click the part of the page you want to comment on. Escape to stop.");
    document.body.appendChild(hint);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onPick, true);
  }

  /* --------------------------------------------------------------- panel -- */

  function render(message, kind) {
    var previous = panel ? panel.querySelector("textarea") : null;
    var draft = previous ? previous.value : "";
    var nameEl = panel ? panel.querySelector(".fb-name input") : null;
    var name = nameEl ? nameEl.value : "";

    if (panel) panel.remove();
    panel = el("div", "fb-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Add a comment");

    var head = el("div", "fb-head");
    head.appendChild(el("h2", null, "Add a comment"));
    var x = el("button", "fb-x");
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.textContent = "×";
    x.addEventListener("click", close);
    head.appendChild(x);
    panel.appendChild(head);

    var where = el("p", "fb-where");
    where.appendChild(el("span", "fb-where__label", "About: "));
    where.appendChild(el("b", null, state.section && state.section.label
      ? state.section.label
      : "this page, " + pageName()));
    panel.appendChild(where);

    var pick = el("button", "fb-pick", state.section ? "Point at something else" : "Point at a section");
    pick.type = "button";
    pick.addEventListener("click", function () { startPicking(); });
    panel.appendChild(pick);

    if (state.quote) {
      var q = el("blockquote", "fb-quote", "“" + state.quote + "”");
      panel.appendChild(q);
    }

    if (!state.user) {
      var nameWrap = el("label", "fb-name");
      nameWrap.appendChild(el("span", null, "Your name"));
      var nameInput = el("input");
      nameInput.type = "text";
      nameInput.value = name;
      nameInput.placeholder = "So we know who to ask";
      nameWrap.appendChild(nameInput);
      panel.appendChild(nameWrap);
    }

    var label = el("label", "fb-field");
    label.appendChild(el("span", null, "What would you change?"));
    var ta = el("textarea");
    ta.rows = 5;
    ta.value = draft;
    ta.placeholder = "Say it however you like. Plain notes are fine.";
    label.appendChild(ta);
    panel.appendChild(label);

    var row = el("div", "fb-row");
    var msg = el("span", "fb-msg" + (kind ? " " + kind : ""), message || "");
    var send = el("button", "fb-send", "Send");
    send.type = "button";
    row.appendChild(msg);
    row.appendChild(send);
    panel.appendChild(row);

    if (state.configured === false) {
      var warn = el("p", "fb-warn",
        "Comments are not switched on for this preview, so Send will not work yet. " +
        "Please send your notes to whoever shared this link with you.");
      panel.appendChild(warn);
    }

    send.addEventListener("click", function () { submit(ta, send, msg, panel); });
    document.body.appendChild(panel);
    ta.focus();
  }

  function submit(ta, send, msg, host) {
    var comment = ta.value.trim();
    if (!comment) {
      msg.className = "fb-msg bad";
      msg.textContent = "Add a comment first.";
      ta.focus();
      return;
    }
    var nameEl = host.querySelector(".fb-name input");
    send.disabled = true;
    msg.className = "fb-msg";
    msg.textContent = "Sending...";

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: comment,
        name: nameEl ? nameEl.value.trim() : "",
        page: pageName(),
        section: state.section ? state.section.label : "",
        sectionId: state.section ? state.section.id : "",
        quote: state.quote,
        url: location.href
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.data.ok) {
          send.disabled = false;
          msg.className = "fb-msg bad";
          msg.textContent = res.data && res.data.error ? res.data.error : "Could not send that.";
          return;
        }
        done(res.data);
      })
      .catch(function () {
        send.disabled = false;
        msg.className = "fb-msg bad";
        msg.textContent = "Could not reach the comment service.";
      });
  }

  function done(data) {
    panel.innerHTML = "";
    panel.appendChild(el("h2", null, "Thank you, that is filed."));
    panel.appendChild(el("p", "fb-done",
      data.number ? "It went through as comment #" + data.number + "." : "It went through."));
    var row = el("div", "fb-row");
    var ok = el("button", "fb-send", "Close");
    ok.type = "button";
    ok.addEventListener("click", close);
    row.appendChild(el("span", "fb-msg", ""));
    row.appendChild(ok);
    panel.appendChild(row);
    ok.focus();
  }

  /* ----------------------------------------------------------------- open - */

  function open() {
    if (state.open) return;
    state.open = true;
    launcher.hidden = true;

    var sel = window.getSelection ? String(window.getSelection()) : "";
    state.quote = sel.replace(/\s+/g, " ").trim().slice(0, 600);
    state.section = null;

    // Anchor the comment to whichever section the selection sits in.
    if (state.quote && window.getSelection().rangeCount) {
      var node = window.getSelection().getRangeAt(0).startContainer;
      var host = nearestSection(node.nodeType === 1 ? node : node.parentNode);
      if (host) state.section = { id: host.id || "", label: labelFor(host) };
    }
    render();
  }

  launcher.addEventListener("click", open);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (state.picking) { stop(); render(); return; }
    if (state.open) close();
  });

  /* Ask the service who we are and whether it can file anything, so the panel
     can be honest before someone types a paragraph into it. */
  function boot() {
    document.body.appendChild(launcher);
    fetch(ENDPOINT + "/status", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        state.configured = !!(d && d.configured);
        state.user = (d && d.user) || "";
      })
      .catch(function () { state.configured = false; });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
