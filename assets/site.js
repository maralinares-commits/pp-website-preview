/* Personal Paparazzi - small, dependency-free behaviour.
   1. Mobile menu (real drawer, keyboard accessible)
   2. Sticky download bar on phones, once the hero has scrolled away
   3. Highlights the section you are reading in the main nav             */

(function () {
  "use strict";

  /* ---------------------------------------------------------- menu ---- */
  var toggle = document.querySelector(".nav-toggle");
  var drawer = document.getElementById("mobile-nav");

  function setMenu(open) {
    if (!toggle || !drawer) return;
    drawer.setAttribute("data-open", open ? "true" : "false");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (toggle && drawer) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });

    // Close after choosing a destination, and on Escape.
    drawer.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 992) setMenu(false);
    });
  }

  /* ------------------------------------------------ sticky CTA bar ---- */
  var bar = document.querySelector(".cta-bar");
  var hero = document.querySelector(".hero");

  if (bar && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        var past = !entries[0].isIntersecting;
        bar.setAttribute("data-visible", past ? "true" : "false");
        bar.setAttribute("aria-hidden", past ? "false" : "true");
      },
      { rootMargin: "-120px 0px 0px 0px" }
    ).observe(hero);
  }

  /* ------------------------------------------- current section link ---- */
  var links = Array.prototype.slice.call(
    document.querySelectorAll('.nav__list a[href^="#"]')
  );
  var sections = links
    .map(function (a) {
      return document.querySelector(a.getAttribute("href"));
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var seen = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) {
            var match = a.getAttribute("href") === "#" + entry.target.id;
            if (match) a.setAttribute("aria-current", "true");
            else a.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach(function (s) {
      seen.observe(s);
    });
  }

  /* ---------------------------------------------- earnings calculator ---- */
  /* Section 10: show the arithmetic, not the conclusion. The reader sets the
     hours; the page never works backwards from a target to tell someone how
     long they must work to earn a given amount.                             */

  var calc = document.getElementById("calc");

  if (calc) {
    var PER_SESSION = 10;                                 // 50% of $19.99

    // Where you work, and how busy it is, comes from content/places.json so the
    // team can add places or a second city without touching this file.
    var PLACES = { city: "", places: [] };
    var raw = document.getElementById("places-data");
    if (raw) {
      try { PLACES = JSON.parse(raw.textContent); } catch (e) { /* leave empty */ }
    }
    var BY_ID = {};
    PLACES.places.forEach(function (p) { BY_ID[p.id] = p; });

    var elPlace = document.getElementById("calc-place");
    var placeNote = document.getElementById("calc-place-note");
    var elHours = document.getElementById("calc-hours-in");
    var elTip = document.getElementById("calc-tip");
    var basis = document.getElementById("calc-basis");
    var outMemories = document.getElementById("calc-memories");
    var outEarned = document.getElementById("calc-earned");
    var outEarnedLabel = document.getElementById("calc-earned-label");
    var outRate = document.getElementById("calc-rate");
    var rateLabel = outRate ? outRate.parentNode.querySelector("dt") : null;
    var note = calc.parentNode.querySelector(".calc__note");

    function price(n) {
      return "$" + n.toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      });
    }

    // House style: cents on prices, dropped on round earnings figures.
    function money(n) {
      var r = Math.round(n * 100) / 100;
      return "$" + (r % 1 === 0
        ? r.toLocaleString("en-US")
        : r.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }

    function num(el, fallback) {
      var v = parseFloat(el.value);
      if (isNaN(v) || v < 0) return fallback;
      var max = parseFloat(el.max);
      return isNaN(max) ? v : Math.min(v, max);
    }

    function update() {
      var hours = Math.max(1, Math.round(num(elHours, 4) || 4));
      var tip = num(elTip, 0);
      var place = BY_ID[elPlace && elPlace.value] || PLACES.places[0];
      if (!place) return;
      var band = place.band;

      if (placeNote) {
        placeNote.textContent = place.note + " Footfall: " + place.visitors + ".";
      }

      var perMemory = PER_SESSION + tip;
      var memLo = band[0] * hours;
      var memHi = band[1] * hours;

      basis.textContent = "At " + price(perMemory) + " a session"
        + (tip > 0 ? ", tip included" : "");

      outMemories.textContent = memLo.toLocaleString("en-US") + " to "
        + memHi.toLocaleString("en-US");

      outEarnedLabel.textContent = "What " + hours + (hours === 1 ? " hour" : " hours")
        + " adds up to";
      outEarned.textContent = money(memLo * perMemory) + " to " + money(memHi * perMemory);

      outRate.textContent = money(band[0] * perMemory) + " to " + money(band[1] * perMemory);
      if (rateLabel) rateLabel.textContent = "An hour, at " + place.name;

      note.textContent = "Estimate only. These figures illustrate " + band[0] + " to "
        + band[1] + " sessions an hour at " + place.name + ", at " + price(perMemory)
        + " a session. The sessions an hour are estimated from how busy the place is, "
        + "not measured. They are not an offer, a guarantee, or a commitment to pay any "
        + "amount. Actual earnings depend on how many requests you accept and how busy "
        + "it is when you are there."
        + (tip > 0
            ? " Tips are paid to you in full and are included in the figures above."
            : " Tips are paid to you in full and are excluded unless you enter one.");
    }

    // If a box is left empty the panel falls back to a sensible number, so put
    // that number back in the box rather than leaving the two disagreeing.
    function settle(el, fallback) {
      el.addEventListener("blur", function () {
        if (el.value.trim() === "" || isNaN(parseFloat(el.value))) {
          el.value = String(fallback);
          update();
        }
      });
    }
    settle(elHours, 4);
    settle(elTip, 0);

    calc.addEventListener("input", update);
    calc.addEventListener("change", update);
    calc.addEventListener("submit", function (e) { e.preventDefault(); });
    update();
  }

  /* ------------------------------------------------------- trip picker ---- */
  /* "I'm travelling to Nashville to enjoy a graduation with family."
     Whatever they pick, the answer says the same thing in their own terms:
     somebody will be there, and they will be in the photographs.
     The nine cards below set the occasion too, so browsing and choosing are
     the same control.                                                       */

  var picker = document.getElementById("picker");

  if (picker) {
    var WHERE = {
      landmarks:   "at the landmark",
      honeymoons:  "wherever the two of you end up",
      parties:     "wherever the night takes you",
      family:      "wherever you all end up",
      concerts:    "at the tailgate or outside the venue",
      proposals:   "at the spot you picked",
      graduations: "on campus",
      birthdays:   "at the table",
      influencer:  "at the spot you came for"
    };
    var WHO = {
      friends: "your friends",
      family:  "your family",
      partner: "the two of you",
      work:    "the team",
      solo:    "you"
    };

    var city = document.getElementById("pick-city");
    var scene = document.getElementById("pick-scene");
    var who = document.getElementById("pick-who");
    var line = document.getElementById("picker-line");

    function answer() {
      var where = WHERE[scene.value] || "when you get there";
      var people = WHO[who.value] || "you";
      var text;

      if (city.value === "elsewhere") {
        text = "We are starting in Nashville, so we are not in your city yet. "
             + "Have the app when we get there, and the photos of this are "
             + people + ", " + where + ", rather than a selfie.";
      } else {
        text = "There are Personal Paparazzi out in Nashville. Open the app "
             + where + ", send a request, and one of them comes and takes the "
             + "photos. Nine photos and one short video, with " + people
             + " in them, for $19.99.";
      }
      line.textContent = text;
    }

    picker.addEventListener("change", answer);
    picker.addEventListener("submit", function (e) { e.preventDefault(); });

    answer();
  }

  /* -------------------------------------------------------- blog filter --- */
  /* Two audiences, one list. The buttons narrow it rather than reloading,
     and every post is in the page either way, so the filter is a convenience
     rather than the only route to the content.                              */

  var filter = document.querySelector(".blog-filter");

  if (filter) {
    var posts = Array.prototype.slice.call(document.querySelectorAll(".posts .post"));
    filter.addEventListener("click", function (e) {
      var btn = e.target.closest(".blog-filter__btn");
      if (!btn) return;
      var want = btn.getAttribute("data-filter");
      Array.prototype.forEach.call(filter.children, function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      posts.forEach(function (p) {
        p.hidden = !(want === "all" || p.getAttribute("data-category") === want);
      });
    });
  }
})();
