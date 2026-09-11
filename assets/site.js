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

    var elCity = document.getElementById("calc-city");
    var elPlace = document.getElementById("calc-place");
    var placeField = document.getElementById("calc-place-field");
    var placeNote = document.getElementById("calc-place-note");

    // Anywhere we have not launched in yet. A plain, unremarkable few hours,
    // so the panel still answers the question without inventing footfall.
    var ELSEWHERE = { name: "wherever you are", busy: [3, 4], note: "", visitors: "",
                      footfall: "" };
    var elHours = document.getElementById("calc-hours-in");
    var elSessions = document.getElementById("calc-sessions");
    var sessionsNote = document.getElementById("calc-sessions-note");
    var sessionsSet = false;   // true once the reader types their own number
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
      // A short shift to start from, and the reader changes it. Clearing the
      // box shows a dash rather than a made-up total.
      var hours = Math.max(0, Math.round(num(elHours, 2)));
      var tip = num(elTip, 0);

      var here = !elCity || elCity.value !== "other";
      var place = here
        ? (BY_ID[elPlace && elPlace.value] || PLACES.places[0])
        : ELSEWHERE;
      if (!place) return;

      // How busy a place is is a fact we can show. How many sessions that
      // turns into is the reader's own guess, so we seed it and step aside.
      var busy = place.busy || [3, 4];
      if (!sessionsSet && elSessions) elSessions.value = String(busy[0]);
      var perHour = Math.max(1, Math.round(num(elSessions, busy[0]) || busy[0]));

      if (placeField) placeField.hidden = !here;
      if (placeNote) {
        placeNote.textContent = here && place.note
          ? place.note + " Footfall: " + place.visitors + "."
          : "";
      }
      if (sessionsNote) {
        sessionsNote.textContent = "Plan on " + busy[0] + " to " + busy[1]
          + " an hour. If you think you can do 5 or 6, nobody is going to stop you. "
          + "Nothing about how many people walk past guarantees how many ask for a "
          + "session, so this number is yours to set.";
      }

      var perMemory = PER_SESSION + tip;
      var sessions = perHour * hours;

      basis.textContent = "At " + price(perMemory) + " a session"
        + (tip > 0 ? ", tip included" : "");

      outMemories.textContent = hours ? sessions.toLocaleString("en-US") : "\u2014";

      outEarnedLabel.textContent = hours
        ? "What " + hours + (hours === 1 ? " hour" : " hours") + " adds up to"
        : "What your hours add up to";
      outEarned.textContent = hours ? money(sessions * perMemory) : "\u2014";

      outRate.textContent = money(perHour * perMemory);
      if (rateLabel) {
        rateLabel.textContent = "An hour, at " + perHour
          + (perHour === 1 ? " session" : " sessions");
      }

      note.textContent = "Estimate only. "
        + (hours ? "" : "Enter your hours to see a total. ")
        + "These figures use the " + perHour
        + " sessions an hour you entered, at " + price(perMemory) + " a session"
        + (here ? ", at " + place.name : "") + ". Visitor numbers describe how busy a "
        + "place is; they are not a forecast of how many sessions you will be asked "
        + "for. Nothing here is an offer, a guarantee, or a commitment to pay any "
        + "amount. Actual earnings depend on how many requests you accept and how "
        + "busy it is when you are there."
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
    settle(elHours, 2);
    if (elSessions) {
      elSessions.addEventListener("input", function () { sessionsSet = true; });
      settle(elSessions, 4);
    }
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
      friends:    "your friends",
      family:     "your family",
      partner:    "the two of you",
      colleagues: "your colleagues",
      solo:       "you"
    };

    // Some occasions come with an obvious answer to "with". Picking one fills
    // that box in, and then leaves it alone: the reader can still change it.
    var SUGGESTS = {
      proposals:  "partner",
      honeymoons: "partner",
      influencer: "colleagues"
    };

    // A proposal is not the same kind of photograph as a bachelorette party,
    // and the answer should not read as though it were.
    var SPECIAL = {
      proposals: {
        here: "There are Personal Paparazzi out in Nashville. Send the request a "
            + "few minutes before you ask, and one of them is already standing "
            + "nearby, looking like anybody else with a phone. Your partner "
            + "sees a stranger photographing the view, and the secret stays "
            + "yours. You get the second they said yes, from the outside, "
            + "where you could never have seen it yourself, and you keep it "
            + "for the rest of your life. Nine photos and one short video, "
            + "for $19.99.",
        away: "We are starting in Nashville, so we are not in your city yet. Have "
            + "the app when we get there: somebody standing nearby who looks like "
            + "anybody else with a phone, the surprise still a surprise, and the "
            + "second they said yes kept for the rest of your life."
      }
    };

    var city = document.getElementById("pick-city");
    var who = document.getElementById("pick-who");
    var line = document.getElementById("picker-line");
    var chosen = document.getElementById("pick-scene-text");
    var board = picker.querySelector(".occasions");
    var chips = board ? Array.prototype.slice.call(board.querySelectorAll(".occasion")) : [];

    // The board is the control. A dropdown hid eight of the nine occasions
    // behind a click, which is the opposite of what this section is for.
    var scene = { value: chips.length ? chips[0].getAttribute("data-scene") : "landmarks" };

    var lastScene = scene.value;

    function pick(chip) {
      scene.value = chip.getAttribute("data-scene");
      chips.forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === chip));
      });
      if (chosen) chosen.textContent = chip.getAttribute("data-phrase");
      answer();
    }

    board && board.addEventListener("click", function (e) {
      var chip = e.target.closest(".occasion");
      if (chip) pick(chip);
    });

    // The sentence, for any combination. Pulled out of answer() so the same
    // code can measure every possible answer without touching what is on
    // screen.
    function textFor(sceneValue, cityValue, whoValue) {
      var special = SPECIAL[sceneValue];
      if (special) return cityValue === "elsewhere" ? special.away : special.here;

      var where = WHERE[sceneValue] || "when you get there";
      var people = WHO[whoValue] || "you";

      if (cityValue === "elsewhere") {
        return "We are starting in Nashville, so we are not in your city yet. "
             + "Have the app when we get there, and the photos of this are "
             + people + ", " + where + ", rather than a selfie.";
      }
      return "There are Personal Paparazzi out in Nashville. Open the app "
           + where + ", send a request, and one of them comes and takes the "
           + "photos. Nine photos and one short video, with " + people
           + " in them, for $19.99.";
    }

    /* Answers run from three lines to seven, and the section is tall enough to
       set the crop of the photograph behind it. Left alone, tapping an occasion
       resized the band and the picture appeared to jump. So reserve the height
       of the longest answer once, and nothing moves again. Measured rather than
       guessed, because it changes with the width and with whatever the editor
       writes next. */
    var ghost = null;

    function reserve() {
      if (!line) return;
      if (!ghost) {
        ghost = document.createElement("p");
        ghost.className = line.className;
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
        line.parentNode.appendChild(ghost);
      }
      line.style.minHeight = "";
      var width = line.getBoundingClientRect().width;
      if (!width) return;
      ghost.style.width = width + "px";

      var all = [];
      for (var s = 0; s < chips.length; s++) {
        var sv = chips[s].getAttribute("data-scene");
        for (var c = 0; c < city.options.length; c++) {
          for (var w = 0; w < who.options.length; w++) {
            all.push(textFor(sv, city.options[c].value, who.options[w].value));
          }
        }
      }
      // The longest strings are the tall ones; measuring a handful of those is
      // enough and saves ninety layout passes.
      all.sort(function (a, b) { return b.length - a.length; });
      var tallest = 0;
      for (var i = 0; i < Math.min(6, all.length); i++) {
        ghost.textContent = all[i];
        tallest = Math.max(tallest, ghost.getBoundingClientRect().height);
      }
      line.style.minHeight = Math.ceil(tallest) + "px";

      // The sentence above it wraps differently too, because "landmarks and
      // sightseeing" is not the length of "a proposal". Run every occasion
      // through, in both cities, and hold the tallest the card ever gets.
      // It is all one synchronous pass, so nothing is painted in between.
      var card = picker.parentNode;
      card.style.minHeight = "";
      var wasPressed = null;
      chips.forEach(function (c) {
        if (c.getAttribute("aria-pressed") === "true") wasPressed = c;
      });
      var wasCity = city.value, wasWho = who.value;
      var tallestCard = 0;
      for (var ci = 0; ci < city.options.length; ci++) {
        city.value = city.options[ci].value;
        chips.forEach(function (chip) {
          pick(chip);
          tallestCard = Math.max(tallestCard, card.getBoundingClientRect().height);
        });
      }
      city.value = wasCity;
      if (wasPressed) pick(wasPressed);
      who.value = wasWho;
      answer();
      card.style.minHeight = Math.ceil(tallestCard) + "px";
    }

    function answer() {
      // Only when the occasion itself changes, so it never overrides somebody
      // who has just picked who they are with.
      if (scene.value !== lastScene) {
        lastScene = scene.value;
        if (SUGGESTS[scene.value]) who.value = SUGGESTS[scene.value];
      }
      line.textContent = textFor(scene.value, city.value, who.value);
    }

    picker.addEventListener("change", answer);
    picker.addEventListener("submit", function (e) { e.preventDefault(); });

    answer();
    reserve();

    var resizing;
    window.addEventListener("resize", function () {
      clearTimeout(resizing);
      resizing = setTimeout(reserve, 150);
    });
  }

  /* ------------------------------------------------------ tutorials filter --- */
  /* Same shape as the blog filter. Every group is in the page either way, so
     this narrows rather than hides anything a search engine needs.          */

  var tipFilter = document.querySelector(".tip-filter");

  if (tipFilter) {
    var groups = Array.prototype.slice.call(document.querySelectorAll(".tips .card"));
    tipFilter.addEventListener("click", function (e) {
      var btn = e.target.closest(".tip-filter__btn");
      if (!btn) return;
      var want = btn.getAttribute("data-tips");
      Array.prototype.forEach.call(
        tipFilter.querySelectorAll(".tip-filter__btn"), function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
      groups.forEach(function (g) {
        g.hidden = !(want === "all" || g.id === want);
      });
    });
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
      Array.prototype.forEach.call(
        filter.querySelectorAll(".blog-filter__btn"), function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
      posts.forEach(function (p) {
        p.hidden = !(want === "all" || p.getAttribute("data-category") === want);
      });
    });
  }
})();
