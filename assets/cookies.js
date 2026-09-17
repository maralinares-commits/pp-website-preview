/* Cookies, consent, and the tags that need it.
 *
 * Google Search Console needs no consent: it reads the site, not the reader.
 * Analytics and the pixels inside Tag Manager do, so nothing of theirs loads
 * until somebody says yes, and a yes can be given a category at a time.
 *
 * Two layers, which is what the law expects and what the reader deserves:
 * a short banner saying what the cookies are for, and a panel behind Choose
 * for anyone who wants to take analytics but not marketing.
 *
 * The banner is always shown, because Analytics and the pixels are coming and
 * the consent has to be on record before they arrive. What it gates is the
 * loading: with no container ID nothing can load, so an Accept today simply
 * records a yes that is honoured the moment the tag exists.
 *
 * ---------------------------------------------------------------------------
 * TO SWITCH ANALYTICS ON: put the Tag Manager container ID in GTM_ID below.
 * That is the only edit.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var GTM_ID = "";            // e.g. "GTM-XXXXXXX". Empty: nothing loads.

  var KEY = "pp-consent";
  var VERSION = 3;            // bump to ask everybody again
  var tagged = GTM_ID !== "";

  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="3" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  /* ------------------------------------------------------------ storage --- */

  function remembered() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || "null");
      return saved && saved.version === VERSION ? saved : null;
    } catch (e) {
      return null;                       // private window, or blocked
    }
  }

  function remember(analytics, marketing) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        version: VERSION, analytics: analytics, marketing: marketing
      }));
    } catch (e) { /* the banner will simply ask again */ }
  }

  /* ------------------------------------------------- consent, then tags --- */
  /* Consent Mode defaults are set inline in the head of every page, before any
     Google tag can run. This only ever moves them. */

  function grant(analytics, marketing) {
    if (typeof window.gtag !== "function") return;
    window.gtag("consent", "update", {
      analytics_storage: analytics ? "granted" : "denied",
      ad_storage: marketing ? "granted" : "denied",
      ad_user_data: marketing ? "granted" : "denied",
      ad_personalization: marketing ? "granted" : "denied"
    });
  }

  var loaded = false;
  function loadTagManager() {
    if (loaded || !tagged) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(GTM_ID);
    document.head.appendChild(s);
  }

  function apply(analytics, marketing) {
    grant(analytics, marketing);
    if (analytics || marketing) loadTagManager();
  }

  function settle(analytics, marketing) {
    remember(analytics, marketing);
    apply(analytics, marketing);
    close();
  }

  /* ----------------------------------------------------------- the bits --- */

  function up(href) {
    return (location.pathname.indexOf("/blog/") !== -1 ? "../" : "") + href;
  }

  var box = null;

  function close() {
    if (box) { box.remove(); box = null; }
  }

  function button(label, kind, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn " + kind;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function shell(label) {
    close();
    box = document.createElement("div");
    box.className = "cookie-note";
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", label);
    document.body.appendChild(box);
    return box;
  }

  /* -------------------------------------------------------- first layer --- */

  function showBanner() {
    var bar = shell("Cookies");

    var text = document.createElement("div");
    text.className = "cookie-note__text";

    text.innerHTML =
      '<p class="cookie-note__title">Do you agree to let us use cookies?</p>' +
      '<ul class="cookie-note__list">' +
        '<li>' + TICK + '<span>Help you get around the site and show <b>important ' +
          'information</b>, such as updates</span></li>' +
        '<li>' + TICK + '<span><b>Measure how our marketing is doing</b> and tell ' +
          'you about our products</span></li>' +
        '<li>' + TICK + '<span><b>Manage sign in</b> and spot technical errors</span></li>' +
      '</ul>' +
      '<p class="cookie-note__small">The ones the site needs to work are always on. ' +
        'You can change your mind from Cookies at the bottom of any page. ' +
        '<a href="' + up("privacy-policy.html") + '">Our privacy policy</a>.</p>';

    var actions = document.createElement("div");
    actions.className = "cookie-note__actions";

    actions.appendChild(button("Choose", "btn--ghost", showPanel));
    actions.appendChild(button("Reject", "btn--outline", function () { settle(false, false); }));
    actions.appendChild(button("Accept", "btn--primary", function () { settle(true, true); }));

    bar.appendChild(text);
    bar.appendChild(actions);
  }

  /* ------------------------------------------------------- second layer --- */

  function showPanel() {
    var saved = remembered();
    var panel = shell("Cookie preferences");

    var rows = [
      { id: "essential", name: "Essential",
        what: "Remembering this choice, and keeping the site working.",
        fixed: true },
      { id: "analytics", name: "Analytics",
        what: "How the site is used, so we can make it better.",
        on: saved ? !!saved.analytics : false },
      { id: "marketing", name: "Marketing",
        what: "How our campaigns are doing, and telling you about our products.",
        on: saved ? !!saved.marketing : false }
    ];

    // The same two-part shape as the bar: everything to read on the left,
    // the answer on the right.
    var left = document.createElement("div");
    left.className = "cookie-note__text";
    left.innerHTML =
      '<p class="cookie-note__title">Your cookie preferences</p>' +
      '<p class="cookie-note__small">We do not sell your data and we share it with ' +
      'nobody outside the tools listed here. <a href="' + up("privacy-policy.html") +
      '">Our privacy policy</a>.</p>';

    var list = document.createElement("div");
    list.className = "cookie-rows";
    var inputs = {};

    rows.forEach(function (row) {
      var line = document.createElement("div");
      line.className = "cookie-row";

      var label = document.createElement("div");
      label.innerHTML = '<b>' + row.name + '</b><span>' + row.what + '</span>';
      line.appendChild(label);

      if (row.fixed) {
        var fixed = document.createElement("span");
        fixed.className = "cookie-row__fixed";
        fixed.textContent = "Always on";
        line.appendChild(fixed);
      } else {
        var wrap = document.createElement("label");
        wrap.className = "cookie-row__switch";
        var input = document.createElement("input");
        input.type = "checkbox";
        input.checked = row.on;
        var name = document.createElement("span");
        name.className = "visually-hidden";
        name.textContent = row.name;
        wrap.appendChild(input);
        wrap.appendChild(name);
        wrap.appendChild(document.createElement("i"));
        line.appendChild(wrap);
        inputs[row.id] = input;
      }
      list.appendChild(line);
    });

    left.appendChild(list);
    panel.appendChild(left);

    var actions = document.createElement("div");
    actions.className = "cookie-note__actions";
    actions.appendChild(button("Reject all", "btn--outline", function () { settle(false, false); }));
    actions.appendChild(button("Save my choices", "btn--primary", function () {
      settle(inputs.analytics.checked, inputs.marketing.checked);
    }));
    panel.appendChild(actions);
  }

  /* ------------------------------------------------------------- start --- */

  function start() {
    var saved = remembered();
    if (saved) {
      apply(!!saved.analytics, !!saved.marketing);
    } else {
      showBanner();
    }

    var reopen = document.querySelectorAll(".js-cookie-settings");
    Array.prototype.forEach.call(reopen, function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        showPanel();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
