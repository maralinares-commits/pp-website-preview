/* Cookie notice.
 *
 * This site sets no cookies and runs no analytics: there is nothing here that
 * follows anybody around. So this is a notice, not a consent gate, and it says
 * what is actually true rather than asking permission for tracking that does
 * not exist.
 *
 * The one thing that can set storage is the YouTube video on the tutorials
 * page, and only if somebody presses play. It is embedded from
 * youtube-nocookie.com, which holds off until then.
 *
 * If analytics are ever added, this stops being honest. The place to gate them
 * is marked below, and the notice will need a real Reject button beside Got it.
 */
(function () {
  "use strict";

  var KEY = "pp-cookie-notice";

  // Remembering that somebody dismissed this is the only thing we store, and
  // we store it so the site does not nag. A private window forgets it, which
  // is fine: the notice simply appears again.
  var seen = null;
  try { seen = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
  if (seen === "dismissed") return;

  function build() {
    var bar = document.createElement("div");
    bar.className = "cookie-note";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Cookie notice");

    var text = document.createElement("p");
    text.className = "cookie-note__text";
    text.innerHTML = 'This site uses no cookies and no analytics: nothing here ' +
      'follows you anywhere. The one video we embed only loads if you press ' +
      'play. <a href="' + (location.pathname.indexOf("/blog/") === 0 ? "../" : "") +
      'privacy-policy.html">Our privacy policy</a>.';

    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn--primary cookie-note__ok";
    button.textContent = "Got it";
    button.addEventListener("click", function () {
      try { localStorage.setItem(KEY, "dismissed"); } catch (e) { /* ignore */ }
      bar.remove();
    });

    bar.appendChild(text);
    bar.appendChild(button);
    document.body.appendChild(bar);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
