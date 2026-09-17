/* Cookies, consent, and the tags that need it.
 *
 * Google Search Console needs no consent: it reads the site, it does not touch
 * the reader. Google Analytics and any pixel inside Tag Manager do, so nothing
 * of theirs is allowed to load until somebody says yes.
 *
 * ---------------------------------------------------------------------------
 * TO SWITCH ANALYTICS ON: put the Tag Manager container ID below. That is the
 * only edit. The banner turns itself from a notice into a consent request, the
 * tag waits for a yes, and a No is remembered and obeyed.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var GTM_ID = "";            // e.g. "GTM-XXXXXXX". Empty: nothing loads.

  var KEY = "pp-consent";
  var VERSION = 1;            // bump to ask everybody again

  var tagged = GTM_ID !== "";

  /* ------------------------------------------------------------ storage --- */

  function remembered() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      return saved.version === VERSION ? saved.choice : null;
    } catch (e) {
      return null;                       // private window, or blocked
    }
  }

  function remember(choice) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: VERSION, choice: choice }));
    } catch (e) { /* the banner will simply ask again */ }
  }

  /* ------------------------------------------------- consent, then tags --- */
  /* Consent Mode defaults are set inline in the head of every page, before any
     Google tag can run. This only ever moves them, and only upwards. */

  function grant(yes) {
    if (typeof window.gtag !== "function") return;
    var state = yes ? "granted" : "denied";
    window.gtag("consent", "update", {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state
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

  function apply(choice) {
    grant(choice === "accepted");
    if (choice === "accepted") loadTagManager();
  }

  /* --------------------------------------------------------- the banner --- */

  function up(href) {
    return (location.pathname.indexOf("/blog/") !== -1 ? "../" : "") + href;
  }

  var bar = null;

  function close() {
    if (bar) { bar.remove(); bar = null; }
  }

  function show() {
    close();

    bar = document.createElement("div");
    bar.className = "cookie-note";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Cookies");

    var text = document.createElement("p");
    text.className = "cookie-note__text";
    text.innerHTML = tagged
      ? 'We would like to use cookies to see how the site is used and to measure ' +
        'our advertising. Nothing of the sort loads unless you say yes, and you ' +
        'can change your mind at any time. <a href="' + up("privacy-policy.html") +
        '">Our privacy policy</a>.'
      : 'This site uses no cookies and no analytics: nothing here follows you ' +
        'anywhere. The one video we embed only loads if you press play. ' +
        '<a href="' + up("privacy-policy.html") + '">Our privacy policy</a>.';

    var actions = document.createElement("div");
    actions.className = "cookie-note__actions";

    function button(label, kind, choice) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn " + kind;
      b.textContent = label;
      b.addEventListener("click", function () {
        remember(choice);
        apply(choice);
        close();
      });
      return b;
    }

    if (tagged) {
      actions.appendChild(button("Reject", "btn--outline", "rejected"));
      actions.appendChild(button("Accept", "btn--primary", "accepted"));
    } else {
      actions.appendChild(button("Got it", "btn--primary", "acknowledged"));
    }

    bar.appendChild(text);
    bar.appendChild(actions);
    document.body.appendChild(bar);
  }

  /* ------------------------------------------------------------- start --- */

  function start() {
    var choice = remembered();

    if (choice) {
      apply(choice);
    } else {
      show();
    }

    // "Cookies" in the footer, so a No is never final.
    var reopen = document.querySelectorAll(".js-cookie-settings");
    Array.prototype.forEach.call(reopen, function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        show();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
