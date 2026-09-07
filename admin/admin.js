/* Content editor for the Personal Paparazzi site.
   ------------------------------------------------------------------------
   The site is plain files on GitHub, with no server behind it, so this page
   edits the content files in the repository directly through the GitHub API.
   Publishing commits the files; a GitHub Action then rebuilds the pages and
   the site updates on its own about a minute later.

   The access key lives in this browser and goes nowhere but GitHub.          */

(function () {
  "use strict";

  var REPO = "maralinares-commits/pp-website-preview";
  var BRANCH = "main";
  var FILES = {
    blog: "content/blog.json",
    questions: "content/questions.json",
    tips: "content/tips.json",
    clientfaq: "content/faq-client.json"
  };
  var KEY = "pp-cms-token";

  var token = null;
  var data = {};      // what is on screen
  var sha = {};       // the version we loaded, so we do not clobber somebody else
  var dirty = false;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function markDirty() {
    dirty = true;
    $("#savebar").hidden = false;
    $("#save-msg").textContent = "";
  }

  /* ------------------------------------------------------------- github --- */

  function api(path, options) {
    options = options || {};
    return fetch("https://api.github.com/" + path, {
      method: options.method || "GET",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; })
        .then(function (d) { throw new Error(d.message || ("GitHub said " + r.status)); });
      return r.json();
    });
  }

  function decode(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
  }
  function encode(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function loadFile(kind) {
    return api("repos/" + REPO + "/contents/" + FILES[kind] + "?ref=" + BRANCH)
      .then(function (res) {
        sha[kind] = res.sha;
        data[kind] = JSON.parse(decode(res.content));
      });
  }

  function saveFile(kind) {
    var text = JSON.stringify(data[kind], null, 2) + "\n";
    return api("repos/" + REPO + "/contents/" + FILES[kind], {
      method: "PUT",
      body: {
        message: "Content update from the editor: " + kind,
        content: encode(text),
        sha: sha[kind],
        branch: BRANCH
      }
    }).then(function (res) { sha[kind] = res.content.sha; });
  }

  /* ------------------------------------------------------------ sign in --- */

  function signIn(value) {
    var msg = $("#signin-msg");
    msg.className = "admin-msg";
    msg.textContent = "Checking...";
    token = value;
    api("repos/" + REPO).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) {
        throw new Error("That key can read the site but not change it. Check the Contents permission.");
      }
      try { localStorage.setItem(KEY, token); } catch (e) { /* private window */ }
      return start();
    }).catch(function (err) {
      token = null;
      msg.className = "admin-msg bad";
      msg.textContent = err.message;
    });
  }

  function signOut() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    location.reload();
  }

  function start() {
    return Promise.all(Object.keys(FILES).map(loadFile)).then(function () {
      $("#signin").hidden = true;
      $("#editor").hidden = false;
      $("#signout").hidden = false;
      $("#who").textContent = "Editing " + REPO.split("/")[1];
      renderAll();
    });
  }

  /* ------------------------------------------------------------- fields --- */

  function field(label, value, onChange, opts) {
    opts = opts || {};
    var wrap = el("label", "admin-field");
    wrap.appendChild(el("span", null, label));
    var input = opts.rows ? el("textarea") : el("input");
    if (opts.rows) input.rows = opts.rows;
    input.value = value == null ? "" : value;
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.addEventListener("input", function () { onChange(input.value); markDirty(); });
    wrap.appendChild(input);
    return wrap;
  }

  function itemShell(title, onDelete, onUp, onDown) {
    var box = el("div", "admin-item");
    var head = el("div", "admin-item__head");
    head.appendChild(el("h3", null, title));
    var tools = el("div", "admin-item__tools");
    [["Move up", onUp], ["Move down", onDown], ["Delete", onDelete]].forEach(function (pair) {
      var b = el("button", "admin-mini", pair[0]);
      b.type = "button";
      b.addEventListener("click", function () {
        if (pair[0] === "Delete" && !confirm("Delete this? It cannot be undone once you publish.")) return;
        pair[1]();
        markDirty();
        renderAll();
      });
      tools.appendChild(b);
    });
    head.appendChild(tools);
    box.appendChild(head);
    return box;
  }

  function move(list, i, delta) {
    var j = i + delta;
    if (j < 0 || j >= list.length) return;
    var t = list[i]; list[i] = list[j]; list[j] = t;
  }

  function slugify(text) {
    return String(text).toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "").replace(/[\s-]+/g, "-").slice(0, 60) || "post";
  }

  /* ------------------------------------------------------------ renderers -- */

  function renderBlog() {
    $("#blog-heading").value = data.blog.heading || "";
    $("#blog-intro").value = data.blog.intro || "";

    // the two audiences, renameable without touching code
    var cats = data.blog.categories || [];
    var catHost = $("#blog-cats");
    catHost.innerHTML = "";
    if (cats.length) {
      var catBox = el("div", "admin-item");
      catBox.appendChild(el("h3", null, "The two categories"));
      cats.forEach(function (c) {
        catBox.appendChild(field("Name shown on the site", c.name,
          function (v) { c.name = v; }));
      });
      catHost.appendChild(catBox);
    }

    var host = $("#blog-list");
    host.innerHTML = "";
    var posts = data.blog.posts;
    posts.forEach(function (post, i) {
      var box = itemShell(post.title || "Untitled post",
        function () { posts.splice(i, 1); },
        function () { move(posts, i, -1); },
        function () { move(posts, i, 1); });
      box.appendChild(field("Title", post.title, function (v) {
        post.title = v;
        if (!post.slugLocked) post.slug = slugify(v);
      }));
      box.appendChild(field("Date", post.date, function (v) { post.date = v; },
        { placeholder: "2026-09-01" }));

      // who the post is for
      var pick = el("label", "admin-field");
      pick.appendChild(el("span", null, "Who it is for"));
      var sel = el("select");
      (data.blog.categories || []).forEach(function (c) {
        var o = el("option", null, c.name);
        o.value = c.id;
        if ((post.category || "client") === c.id) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () {
        post.category = sel.value;
        markDirty();
      });
      pick.appendChild(sel);
      box.appendChild(pick);
      box.appendChild(field("Web address", post.slug, function (v) {
        post.slug = slugify(v); post.slugLocked = true;
      }));
      box.appendChild(field("Summary, shown on the cards", post.summary,
        function (v) { post.summary = v; }, { rows: 2 }));
      box.appendChild(field("The post. Blank line between paragraphs, ## for a heading.",
        post.body, function (v) { post.body = v; }, { rows: 12 }));

      // The short version, at the top of the post. One line each.
      box.appendChild(field("The short version. One point a line.",
        (post.tldr || []).join("\n"),
        function (v) {
          post.tldr = v.split("\n").map(function (t) { return t.trim(); })
            .filter(Boolean);
        }, { rows: 4 }));

      // Frequently asked questions, which Google reads as well as people.
      post.faq = post.faq || [];
      var faqHead = el("p", "admin-subhead", "Frequently asked questions");
      box.appendChild(faqHead);
      post.faq.forEach(function (item, qi) {
        var row = el("div", "admin-sub");
        row.appendChild(field("Question", item.question,
          function (v) { item.question = v; }));
        row.appendChild(field("Answer", item.answer,
          function (v) { item.answer = v; }, { rows: 3 }));
        var del = el("button", "admin-mini", "Delete this question");
        del.type = "button";
        del.addEventListener("click", function () {
          if (!confirm("Delete this question?")) return;
          post.faq.splice(qi, 1);
          markDirty();
          renderAll();
        });
        row.appendChild(del);
        box.appendChild(row);
      });
      var addQ = el("button", "admin-mini", "Add a question");
      addQ.type = "button";
      addQ.addEventListener("click", function () {
        post.faq.push({ question: "", answer: "" });
        markDirty();
        renderAll();
      });
      box.appendChild(addQ);

      host.appendChild(box);
    });
    if (!posts.length) host.appendChild(el("p", "admin-empty", "No posts yet."));
  }

  function renderQuestions() {
    var host = $("#questions-list");
    host.innerHTML = "";
    var items = data.questions.items;
    items.forEach(function (item, i) {
      var box = itemShell(item.question || "New question",
        function () { items.splice(i, 1); },
        function () { move(items, i, -1); },
        function () { move(items, i, 1); });
      box.appendChild(field("Question", item.question, function (v) { item.question = v; }));
      box.appendChild(field("Answer", item.answer, function (v) { item.answer = v; }, { rows: 4 }));
      host.appendChild(box);
    });
    if (!items.length) host.appendChild(el("p", "admin-empty", "No questions yet."));
  }

  function renderTips() {
    var host = $("#tips-list");
    host.innerHTML = "";
    $("#tips-video").value = data.tips.videoUrl || "";
    if ($("#tips-video-title")) $("#tips-video-title").value = data.tips.videoTitle || "";
    if ($("#tips-channel")) $("#tips-channel").value = data.tips.channelUrl || "";
    var groups = data.tips.groups;
    groups.forEach(function (group, i) {
      var box = itemShell(group.title || "New group",
        function () { groups.splice(i, 1); },
        function () { move(groups, i, -1); },
        function () { move(groups, i, 1); });
      box.appendChild(field("Group title", group.title, function (v) {
        group.title = v;
        group.id = slugify(v);
      }));
      box.appendChild(field("The tips, one per line", (group.items || []).join("\n"),
        function (v) {
          group.items = v.split("\n").map(function (s) { return s.trim(); })
            .filter(Boolean);
        }, { rows: 6 }));
      host.appendChild(box);
    });
    if (!groups.length) host.appendChild(el("p", "admin-empty", "No groups yet."));
  }

  function renderClientFaq() {
    var host = $("#clientfaq-list");
    if (!host || !data.clientfaq) return;
    host.innerHTML = "";
    var groups = data.clientfaq.groups;
    groups.forEach(function (group, gi) {
      var box = itemShell(group.title || "New group",
        function () { groups.splice(gi, 1); },
        function () { move(groups, gi, -1); },
        function () { move(groups, gi, 1); });
      box.appendChild(field("Group title", group.title, function (v) {
        group.title = v;
        group.id = slugify(v);
      }));
      (group.items || []).forEach(function (item, ii) {
        var row = el("div", "admin-sub");
        row.appendChild(field("Question", item.question, function (v) { item.question = v; }));
        row.appendChild(field("Answer", item.answer, function (v) { item.answer = v; }, { rows: 3 }));
        var del = el("button", "admin-mini", "Delete this question");
        del.type = "button";
        del.addEventListener("click", function () {
          if (!confirm("Delete this question?")) return;
          group.items.splice(ii, 1);
          markDirty();
          renderAll();
        });
        row.appendChild(del);
        box.appendChild(row);
      });
      var add = el("button", "admin-mini", "Add a question to this group");
      add.type = "button";
      add.addEventListener("click", function () {
        group.items = group.items || [];
        group.items.push({ question: "", answer: "" });
        markDirty();
        renderAll();
      });
      box.appendChild(add);
      host.appendChild(box);
    });
    if (!groups.length) host.appendChild(el("p", "admin-empty", "No groups yet."));
  }

  function renderAll() {
    renderBlog();
    renderQuestions();
    renderTips();
    renderClientFaq();
  }

  /* --------------------------------------------------------------- wiring -- */

  function wire() {
    $("#signin-go").addEventListener("click", function () {
      var v = $("#token").value.trim();
      if (!v) { $("#signin-msg").className = "admin-msg bad"; $("#signin-msg").textContent = "Paste your key first."; return; }
      signIn(v);
    });
    $("#token").addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("#signin-go").click();
    });
    $("#signout").addEventListener("click", signOut);

    $$(".admin-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        $$(".admin-tab").forEach(function (t) { t.setAttribute("aria-selected", String(t === tab)); });
        $$(".admin-panel").forEach(function (p) {
          p.hidden = p.getAttribute("data-panel") !== tab.getAttribute("data-tab");
        });
      });
    });

    $$("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () {
        var kind = b.getAttribute("data-add");
        if (kind === "blog") {
          data.blog.posts.unshift({
            slug: "new-post", title: "New post",
            date: new Date().toISOString().slice(0, 10),
            author: "Personal Paparazzi", summary: "", body: "",
            tldr: [], faq: []
          });
        } else if (kind === "questions") {
          data.questions.items.push({ question: "", answer: "" });
        } else if (kind === "clientfaq") {
          data.clientfaq.groups.push({ id: "new-group", title: "New group", items: [] });
        } else {
          data.tips.groups.push({ id: "new-group", title: "New group", items: [] });
        }
        markDirty();
        renderAll();
      });
    });

    [["#blog-heading", "heading"], ["#blog-intro", "intro"]].forEach(function (pair) {
      var input = $(pair[0]);
      if (!input) return;
      input.addEventListener("input", function () {
        data.blog[pair[1]] = input.value;
        markDirty();
      });
    });

    [["#tips-video", "videoUrl"], ["#tips-video-title", "videoTitle"],
     ["#tips-channel", "channelUrl"]].forEach(function (pair) {
      var input = $(pair[0]);
      if (!input) return;
      input.addEventListener("input", function () {
        data.tips[pair[1]] = input.value.trim();
        markDirty();
      });
    });

    $("#discard").addEventListener("click", function () {
      if (!confirm("Throw away your changes and reload what is published?")) return;
      location.reload();
    });

    $("#save").addEventListener("click", publish);

    window.addEventListener("beforeunload", function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  function publish() {
    var msg = $("#save-msg");
    var btn = $("#save");
    btn.disabled = true;
    msg.className = "admin-msg";
    msg.textContent = "Publishing...";

    // strip the helper flag the editor uses, so it never reaches the site
    data.blog.posts.forEach(function (p) { delete p.slugLocked; });

    Object.keys(FILES).reduce(function (chain, kind) {
      return chain.then(function () { return saveFile(kind); });
    }, Promise.resolve()).then(function () {
      dirty = false;
      btn.disabled = false;
      msg.className = "admin-msg good";
      msg.textContent = "Published. The site updates in about a minute.";
    }).catch(function (err) {
      btn.disabled = false;
      msg.className = "admin-msg bad";
      msg.textContent = /sha/i.test(err.message)
        ? "Somebody else changed the content while you were editing. Reload and redo your changes."
        : err.message;
    });
  }

  wire();

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private window */ }
  if (saved) {
    token = saved;
    start().catch(function () { token = null; });
  }
})();
