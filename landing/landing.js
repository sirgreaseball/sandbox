/*
 * Sandbox · landing choreography (Team 15)
 *
 * Smooth scrolling comes from Lenis; every scroll-linked animation is a GSAP
 * ScrollTrigger driven by it and scrubbed, so nothing plays on its own clock
 * once the page is loaded: scroll back and everything runs backwards.
 *
 * The scroll position also maps to a chapter value (0 hero ... 6 closing) with
 * a plateau around each chapter's copy and a long ramp between them. The WebGL
 * scene follows that value through its own spring: the object holds its shape
 * while the copy is on screen, then turns and re-forms into the next chapter's
 * object while the page is between chapters. Scroll also spins it.
 *
 * Sequence
 *   loader   counts real work: fonts, the scene's shader programs, first frames
 *   hero     the scene sits in a dark rounded frame under the header
 *   story    the frame opens to full bleed; five chapters scroll past the object
 *   work     the fourteen modules, pinned and scrolled sideways on desktop
 *   contract a statement that fills in word by word as you read it
 *
 * Modes for the scene: "gl" (landing/gl/engine.js) or "poster" (still frames of
 * the same scene) when WebGL2 is missing or software-rendered, when the visitor
 * prefers reduced motion, or with ?nogl. ?capture=<chapter> renders one still
 * for tools/capture-posters.mjs.
 */
(function () {
  "use strict";

  var K = (window.Sandbox = window.Sandbox || {});
  var doc = document;
  var root = doc.documentElement;
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var SplitText = window.SplitText;
  var LenisCtor = window.Lenis;

  var canvas = doc.getElementById("k-gl");
  var frame = doc.getElementById("k-frame");
  var posterBox = doc.getElementById("k-posters");
  var top = doc.getElementById("k-top");
  var rail = doc.getElementById("k-rail");
  var loader = doc.getElementById("k-loader");
  var loaderN = doc.getElementById("k-loader-n");
  var curtain = doc.getElementById("k-curtain");
  var story = doc.getElementById("k-story");
  var sections = Array.prototype.slice.call(doc.querySelectorAll(".k-landing [data-chapter]"));

  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var fine = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : { matches: false };
  var params = new URLSearchParams(location.search);
  var capture = params.has("capture") ? Math.max(0, Math.min(6, Number(params.get("capture")) || 0)) : null;
  var motion = !!(gsap && ScrollTrigger) && !reduce.matches && capture === null;
  var CHAPTERS = 7;
  var SPIN = 0.42 * Math.PI;   // object turn per viewport height scrolled

  var mode = null;
  var engine = null;
  var lenis = null;
  var layout = [];
  var anchors = [];
  var vh = window.innerHeight;
  var chapter = 0;
  var visible = !root.classList.contains("k-in-app");
  var posters = [];
  var activePoster = -1;

  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (gsap && SplitText) gsap.registerPlugin(SplitText);

  // ----------------------------------------------------------- measuring

  var storyEnd = Infinity;
  var solid = false;
  var railItems = rail ? Array.prototype.slice.call(rail.querySelectorAll("li")) : [];
  var railCentres = [];

  function measure() {
    vh = window.innerHeight;
    var y = window.scrollY;
    if (story) storyEnd = story.getBoundingClientRect().bottom + y;
    layout = sections.map(function (s) {
      var r = s.getBoundingClientRect();
      return { top: r.top + y, height: r.height };
    });
    // The scroll position at which each chapter's copy sits mid-screen. The
    // closing chapter anchors a little before its top, as the frame closes.
    anchors = layout.map(function (l, i) {
      if (i === 0) return 0;
      if (i === layout.length - 1) return l.top - vh * 0.1;
      return l.top + (l.height - vh) / 2;
    });
    railCentres = railItems.map(function (li) { return li.offsetTop + li.offsetHeight / 2; });
  }

  // Chapter value for a scroll position: whole numbers on a plateau around each
  // anchor, a linear ramp across the middle 62% between two anchors.
  function chapterAt(y) {
    if (!anchors.length || y <= anchors[0]) return 0;
    for (var k = 0; k < anchors.length - 1; k++) {
      if (y < anchors[k + 1]) {
        var f = (y - anchors[k]) / Math.max(1, anchors[k + 1] - anchors[k]);
        return k + Math.min(1, Math.max(0, (f - 0.19) / 0.62));
      }
    }
    return anchors.length - 1;
  }

  // Where the object sits for each formation, in world units at its depth.
  // Desktop: right of the copy column, drifting toward the centre mid-morph.
  function sceneLayouts() {
    var w = window.innerWidth;
    var h = Math.max(1, window.innerHeight);
    var halfW = Math.tan(0.33) * 3.4 * (w / h);
    var X = function (ndc) { return ndc * halfW; };
    if (w < 860) {
      var s = Math.min(0.66, (w / h) * 1.12);
      var mid = { x: 0, y: 0.42, s: s };
      return { keys: [{ x: 0, y: 0.36, s: s * 0.9 }, mid, mid, mid, mid, mid, { x: 0, y: 0.4, s: s * 0.92 }], centerX: 0, transit: 0 };
    }
    var copyRight = Math.min(640, w * 0.56);
    var railLeft = w - 220;
    var gap = Math.max(200, railLeft - copyRight);
    var cx = ((copyRight + gap / 2) / w) * 2 - 1;
    var sc = Math.max(0.68, Math.min(1, ((gap / w) * halfW * 1.15) / 0.95));
    var chap = { x: X(cx), y: 0.02, s: sc };
    return {
      keys: [
        { x: X(w < 1200 ? 0.22 : 0.3), y: 0.34, s: Math.min(0.84, sc) },
        chap, chap, chap, chap, chap,
        { x: X(0.3), y: 0.22, s: Math.min(0.95, sc) }
      ],
      centerX: X(0.1),
      transit: 0.75
    };
  }

  // ------------------------------------------------------------- update

  var railOn = false;
  var railIndex = -1;

  function updateRail() {
    if (!rail) return;
    var on = chapter > 0.55 && chapter < 5.5;
    if (on !== railOn) {
      railOn = on;
      rail.classList.toggle("is-on", on);
    }
    for (var i = 0; i < railItems.length; i++) {
      railItems[i].style.setProperty("--k-on", Math.max(0, 1 - Math.abs(chapter - (i + 1))).toFixed(3));
    }
    // The marker slides between the items with the scroll instead of jumping.
    var pos = Math.min(railItems.length - 1, Math.max(0, chapter - 1));
    var lo = Math.floor(pos);
    var hi = Math.min(railItems.length - 1, lo + 1);
    if (railCentres.length) {
      var y = railCentres[lo] + (railCentres[hi] - railCentres[lo]) * (pos - lo);
      rail.style.setProperty("--k-rail-y", y.toFixed(1) + "px");
    }
    var idx = Math.round(pos);
    if (idx !== railIndex) {
      railIndex = idx;
      railItems.forEach(function (li, j) {
        li.classList.toggle("is-active", j === idx);
        var a = li.querySelector("a");
        if (a) {
          if (j === idx) a.setAttribute("aria-current", "step");
          else a.removeAttribute("aria-current");
        }
      });
    }
  }

  function update() {
    if (!visible) return;
    var y = window.scrollY;
    var isSolid = y > storyEnd - (top ? top.offsetHeight : 76);
    if (isSolid !== solid && top) {
      solid = isSolid;
      top.classList.toggle("is-solid", isSolid);
    }
    chapter = chapterAt(y);
    if (engine) {
      engine.setChapter(chapter);
      engine.setSpin((Math.min(y, storyEnd) / Math.max(1, vh)) * SPIN);
    }
    if (mode === "poster") showPoster(Math.round(chapter));
    updateRail();
  }

  // ------------------------------------------------------------ posters

  function posterSrc(i) {
    return "landing/posters/chapter-" + i + (window.innerWidth < 860 ? "-m" : "") + ".webp";
  }

  function ensurePoster(i) {
    if (i < 0 || i >= CHAPTERS || posters[i]) return posters[i];
    var img = new Image();
    img.className = "k-poster";
    img.alt = "";
    img.decoding = "async";
    img.src = posterSrc(i);
    posterBox.appendChild(img);
    posters[i] = img;
    return img;
  }

  function showPoster(i) {
    if (i === activePoster) return;
    activePoster = i;
    ensurePoster(i);
    ensurePoster(i + 1);
    for (var k = 0; k < posters.length; k++) {
      if (posters[k]) posters[k].classList.toggle("is-active", k === i);
    }
  }

  function usePosters(reason) {
    if (mode === "poster") return Promise.resolve();
    if (engine) { engine.stop(); engine = null; }
    mode = "poster";
    root.setAttribute("data-scene", "poster");
    if (reason) root.setAttribute("data-scene-reason", reason);
    canvas.classList.remove("is-live");
    activePoster = -1;
    showPoster(Math.round(chapter));
    posterBox.classList.add("is-live");
    var first = posters[Math.round(chapter)];
    return new Promise(function (resolve) {
      if (!first || first.complete) return resolve();
      first.onload = first.onerror = function () { resolve(); };
      setTimeout(resolve, 2500);
    });
  }

  // ----------------------------------------------------------------- gl

  function loadEngine() {
    if (K.GL) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var s = doc.createElement("script");
      s.src = "landing/gl/engine.js";
      s.onload = function () { resolve(!!K.GL); };
      s.onerror = function () { resolve(false); };
      doc.body.appendChild(s);
    });
  }

  // Resolves once the scene is on screen (or has fallen back to posters).
  function useGL(progress) {
    return loadEngine().then(function (ok) {
      progress(0.45);
      if (!ok) return usePosters("engine");
      return new Promise(function (resolve) {
        var created = K.GL.create(canvas, {
          chapter: capture !== null ? capture : chapter,
          spin: capture !== null ? 0.55 : (window.scrollY / Math.max(1, vh)) * SPIN,
          tier: capture !== null ? "high" : undefined,
          dpr: capture !== null ? Number(params.get("dpr")) || 1 : undefined,
          time: capture !== null ? 14 : undefined,
          grain: capture !== null ? 0 : undefined,
          skipIntro: capture !== null,
          holdIntro: capture === null && root.classList.contains("k-loading"),
          still: capture !== null,
          preserve: capture !== null,
          allowSoftware: capture !== null && params.has("software"),
          onReady: function (api) {
            progress(0.7);
            root.setAttribute("data-scene", "gl");
            if (capture !== null) {
              api.warmAll().then(function () {
                api.jump(capture);
                setTimeout(function () {
                  api.renderOnce();
                  canvas.classList.add("is-live");
                  window.__sandboxCaptureReady = true;
                }, 80);
              });
              return resolve();
            }
            api.warmAll().then(function () {
              progress(0.95);
              var wait = function () {
                if (api.framesDrawn() > 8 || api.failed) {
                  canvas.classList.add("is-live");
                  resolve();
                } else {
                  requestAnimationFrame(wait);
                }
              };
              wait();
            });
          },
          onFail: function (reason) { usePosters(reason).then(resolve); }
        });
        if (!created) return usePosters("webgl2-unavailable").then(resolve);
        engine = created;
        mode = "gl";
        engine.setLayouts(sceneLayouts());
        engine.jump(capture !== null ? capture : chapter);
        if (capture === null && visible) engine.start();
      });
    });
  }

  function chooseMode(progress) {
    if (capture !== null) {
      root.classList.add("k-capture");
      return useGL(progress);
    }
    if (params.has("nogl")) return usePosters("nogl");
    if (reduce.matches) return usePosters("reduced-motion");
    if (!("WebGL2RenderingContext" in window)) return usePosters("webgl2-unavailable");
    return useGL(progress);
  }

  // -------------------------------------------------------------- lenis

  function startLenis() {
    if (lenis || !motion || !LenisCtor) return;
    lenis = new LenisCtor({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true, syncTouch: false, autoRaf: false });
    lenis.on("scroll", function () {
      ScrollTrigger.update();
      update();
    });
  }

  function stopLenis() {
    if (!lenis) return;
    lenis.destroy();
    lenis = null;
  }

  if (motion) {
    gsap.ticker.add(function (time) { if (lenis) lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // Chapters scroll to where their copy sits mid-screen and their object is whole.
  function scrollTargetFor(el) {
    var i = sections.indexOf(el);
    if (i > 0 && i < sections.length - 1 && anchors[i] !== undefined) return anchors[i];
    return el.getBoundingClientRect().top + window.scrollY;
  }

  function scrollToEl(el, keyboard) {
    var y = scrollTargetFor(el);
    if (lenis && !keyboard) lenis.scrollTo(y, { duration: 1.8, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    else window.scrollTo(0, y);
  }

  // -------------------------------------------------------------- reveals

  function fontsReady() {
    var link = doc.querySelector('link[href="assets/fonts.css"]');
    var cssLoaded = new Promise(function (resolve) {
      if (!link || link.media === "all") return resolve();
      link.addEventListener("load", function () { resolve(); }, { once: true });
      setTimeout(resolve, 2500);
    });
    return cssLoaded.then(function () {
      if (!doc.fonts || !doc.fonts.load) return null;
      // Ask for the faces explicitly so SplitText measures lines in the real font.
      return Promise.all([doc.fonts.load('520 40px "Sandbox Sans"'), doc.fonts.load('500 12px "Sandbox Mono"')])
        .catch(function () { return null; })
        .then(function () { return doc.fonts.ready; });
    });
  }

  function splitLines(el) {
    return SplitText.create(el, { type: "lines", mask: "lines", linesClass: "k-line", aria: "none" });
  }

  // Splits are made just before a block scrolls into view (so the page load
  // stays light) and reverted once the reveal ends, leaving the original markup.
  function whenNear(el, fn) {
    if (!("IntersectionObserver" in window)) return fn();
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      fn();
    }, { rootMargin: "0px 0px 35% 0px" });
    io.observe(el);
  }

  var heroParts = null;

  // Each chapter's copy arrives and leaves with the scroll: the heading word by
  // word, then the paragraph and the module links; on the way out the block
  // lifts and fades. Desktop copy scrolls past normally; on phones it rests at
  // the bottom of the screen under the object (sticky), so the ranges differ.
  function setupChapters() {
    var mm = gsap.matchMedia();
    mm.add({ wide: "(min-width: 860px)", narrow: "(max-width: 859.98px)" }, function (ctx) {
      var wide = ctx.conditions.wide;
      var splits = [];
      gsap.utils.toArray(".k-chapter:not(.k-chapter-core)").forEach(function (section) {
        var inner = section.querySelector(".k-chapter-inner");
        var h2 = inner.querySelector(".k-h2");
        var words = SplitText.create(h2, { type: "words", wordsClass: "k-word", aria: "none" });
        splits.push(words);
        var trigger = wide ? inner : section;
        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: trigger,
            start: wide ? "top 96%" : "top 62%",
            end: wide ? "top 38%" : "top 4%",
            scrub: true
          }
        });
        tl.from(inner.querySelector(".k-chapter-n"), { opacity: 0, y: 18, duration: 0.3, ease: "power2.out" }, 0)
          .from(words.words, { opacity: 0, yPercent: 55, duration: 0.5, ease: "power3.out", stagger: 0.07 }, 0.05)
          .from(inner.querySelector(".k-p"), { opacity: 0, y: 28, duration: 0.5, ease: "power3.out" }, 0.3)
          .from(inner.querySelectorAll(".k-mods-item"), { opacity: 0, y: 22, duration: 0.4, ease: "power3.out", stagger: 0.06 }, 0.42);
        gsap.to(inner, {
          opacity: 0,
          y: wide ? -56 : -40,
          ease: "power1.in",
          scrollTrigger: {
            trigger: trigger,
            start: wide ? "bottom 72%" : "bottom bottom",
            end: wide ? "bottom 22%" : "bottom 52%",
            scrub: true
          }
        });
      });
      return function () { splits.forEach(function (sp) { sp.revert(); }); };
    });
  }

  function setupReveals() {
    if (!motion || !SplitText) return;

    // Hero: prepared behind the loader and played as it lifts. Without the
    // loader (a return visit) the hero is already on screen and stays put.
    if (root.classList.contains("k-loading")) {
      var word = doc.getElementById("k-hero-title");
      var lede = doc.querySelector(".k-hero-lede");
      var heroSplit = SplitText.create(word, { type: "chars", charsClass: "k-char" });
      var ledeSplit = splitLines(lede);
      gsap.set(heroSplit.chars, { yPercent: 105, opacity: 0 });
      gsap.set(ledeSplit.lines, { yPercent: 110 });
      gsap.set(".k-hero .k-actions > *", { y: 16, opacity: 0 });
      heroParts = { chars: heroSplit.chars, lines: ledeSplit.lines, splits: [heroSplit, ledeSplit] };
    }

    setupChapters();

    // Section headings below the story rise line by line as they arrive.
    doc.querySelectorAll(".k-work [data-split='lines']").forEach(function (el) {
      var section = el.closest("section") || el;
      whenNear(section, function () {
        var split = splitLines(el);
        gsap.from(split.lines, {
          yPercent: 110,
          duration: 1.15,
          ease: "expo.out",
          stagger: 0.08,
          onComplete: function () { split.revert(); },
          scrollTrigger: { trigger: section, start: "top 72%", once: true }
        });
      });
    });

    // The CTA title rises letter by letter. The link itself carries the label.
    var ctaLink = doc.querySelector(".k-cta-link");
    if (ctaLink) {
      whenNear(ctaLink, function () {
        var ctaSplit = SplitText.create(ctaLink.querySelector("[data-split='chars']"), { type: "chars", charsClass: "k-char", aria: "none" });
        gsap.from(ctaSplit.chars, {
          yPercent: 100,
          opacity: 0,
          duration: 1,
          ease: "expo.out",
          stagger: 0.02,
          onComplete: function () { ctaSplit.revert(); },
          scrollTrigger: { trigger: ".k-cta", start: "top 75%", once: true }
        });
      });
    }

    // The statement fills in word by word with the scroll.
    var statement = doc.querySelector("[data-scrub-words]");
    if (statement) {
      whenNear(statement, function () {
        var words = SplitText.create(statement, { type: "words", wordsClass: "k-word", aria: "none" }).words;
        gsap.to(words, {
          color: "#0B0C10",
          stagger: 0.12,
          ease: "none",
          scrollTrigger: { trigger: statement, start: "top 78%", end: "bottom 42%", scrub: true }
        });
      });
    }
  }

  function playHero() {
    if (engine) engine.playIntro();
    if (!heroParts || !motion) return;
    var tl = gsap.timeline({ delay: 0.05 });
    tl.fromTo(frame, { "--k-ir": "40px", scale: 0.965 }, { "--k-ir": "24px", scale: 1, duration: 1.5, ease: "expo.out" }, 0)
      .to(heroParts.chars, { yPercent: 0, opacity: 1, duration: 1.3, ease: "expo.out", stagger: 0.045 }, 0.15)
      .to(heroParts.lines, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.08 }, 0.45)
      .to(".k-hero .k-actions > *", { y: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.07, clearProps: "transform,opacity" }, 0.6)
      .add(function () { heroParts.splits.forEach(function (sp) { sp.revert(); }); });
  }

  // ------------------------------------------------------------- frame

  function gutterPx() {
    return Math.round(Math.min(32, Math.max(16, window.innerWidth * 0.022)));
  }

  function heroInset() {
    var g = gutterPx();
    return { "--k-it": (top.offsetHeight + 4) + "px", "--k-ix": g + "px", "--k-ib": g + "px", "--k-ir": "24px" };
  }

  var FULL = { "--k-it": "0px", "--k-ix": "0px", "--k-ib": "0px", "--k-ir": "0px" };

  function setupFrame() {
    if (!motion) return;
    var closing = false;

    // Open to full bleed while the hero scrolls away.
    var open = gsap.fromTo(frame, heroInset(), Object.assign({}, FULL, {
      ease: "none",
      immediateRender: true,
      scrollTrigger: {
        trigger: ".k-hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
        onUpdate: function (self) { top.classList.toggle("is-dark", self.progress > 0.45 && !closing); }
      }
    }));

    // Close back into a card as the story ends, then scroll away with it.
    gsap.fromTo(frame, FULL, Object.assign({}, heroInset(), {
      ease: "none",
      immediateRender: false,
      scrollTrigger: {
        trigger: ".k-chapter-core",
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: function (self) {
          closing = self.progress > 0.5;
          top.classList.toggle("is-dark", !closing && self.progress > 0);
        },
        onLeaveBack: function () {
          closing = false;
          top.classList.add("is-dark");
        }
      }
    }));

    // The hero copy lifts away as the frame opens; the closing line fades as it shuts.
    gsap.to(".k-hero-inner", {
      opacity: 0,
      y: -80,
      ease: "none",
      scrollTrigger: { trigger: ".k-hero", start: "top top", end: "60% top", scrub: true }
    });
    gsap.from(".k-chapter-core .k-chapter-inner", {
      opacity: 0,
      y: 40,
      ease: "power2.out",
      scrollTrigger: { trigger: ".k-chapter-core", start: "top 75%", end: "top 10%", scrub: true }
    });
    gsap.to(".k-chapter-core .k-chapter-inner", {
      opacity: 0,
      y: -60,
      ease: "none",
      scrollTrigger: { trigger: ".k-chapter-core", start: "35% top", end: "bottom bottom", scrub: true }
    });

    // Re-measure the insets when the viewport changes.
    ScrollTrigger.addEventListener("refreshInit", function () {
      gsap.set(frame, open.progress() === 0 ? heroInset() : {});
    });

    // Pause the scene whenever the story is off screen.
    ScrollTrigger.create({
      trigger: "#k-story",
      start: "top bottom",
      end: "bottom top",
      onToggle: function (self) {
        if (!engine) return;
        if (self.isActive && visible) engine.start();
        else engine.stop();
      }
    });
  }

  // --------------------------------------------------------------- work

  function buildWork() {
    var track = doc.getElementById("k-work-track");
    var reg = K.registry;
    if (!track || !reg) return;
    var html = "";
    reg.navOrder.forEach(function (key) {
      var m = reg.byKey[key];
      var cat = reg.category(m.category);
      html += '<li class="k-tile"><a class="k-tile-a" href="#/m/' + key + '">' +
        '<span class="k-tile-media"><span class="k-tile-par"><img class="k-tile-img" src="landing/shots/' + key + '.webp" alt="' + m.algorithm.replace(/"/g, "&quot;") + ', running in the dashboard" loading="lazy" decoding="async" width="880" height="550"></span></span>' +
        '<span class="k-tile-meta"><span class="k-tile-n">' + (m.team < 10 ? "0" : "") + m.team + '</span><span class="k-tile-t">' + m.algorithm.replace(/&/g, "&amp;").replace(/</g, "&lt;") + '</span><span class="k-tile-c">' + cat.name + "</span></span>" +
        "</a></li>";
    });
    track.innerHTML = html;
  }

  function setupWork() {
    if (!motion) return;
    var pin = doc.getElementById("k-work-pin");
    var track = doc.getElementById("k-work-track");
    if (!pin || !track) return;
    var mm = gsap.matchMedia();
    mm.add("(min-width: 860px)", function () {
      var distance = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, {
        x: function () { return -distance(); },
        ease: "none",
        scrollTrigger: {
          trigger: pin,
          start: "center center",
          end: function () { return "+=" + distance(); },
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true
        }
      });
      // Each screenshot drifts against the scroll inside its frame.
      gsap.utils.toArray(".k-tile-par").forEach(function (par) {
        gsap.fromTo(par, { xPercent: -6 }, {
          xPercent: 6,
          ease: "none",
          scrollTrigger: { trigger: par.parentNode, containerAnimation: tween, start: "left right", end: "right left", scrub: true }
        });
      });
    });
  }

  // ------------------------------------------------------------ loader

  function runLoader(work) {
    var hasLoader = root.classList.contains("k-loading") && loader;
    var shown = { v: 0 };
    var target = 0.08;
    var done = false;
    var dots = loader ? loader.querySelectorAll(".k-loader-dot") : [];
    var render = function () {
      if (loaderN) loaderN.textContent = String(Math.round(shown.v * 100));
      var lit = Math.round(shown.v * dots.length);
      for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("is-on", i < lit);
    };
    var progress = function (p) { target = Math.max(target, p); };

    var ticker = null;
    if (hasLoader && gsap) {
      ticker = function () {
        var goal = done ? 1 : Math.min(0.97, target);
        shown.v += (goal - shown.v) * (done ? 0.22 : 0.08);
        if (done && shown.v > 0.995) shown.v = 1;
        render();
      };
      gsap.ticker.add(ticker);
    }

    var started = performance.now();
    var cap = new Promise(function (resolve) { setTimeout(resolve, 4500); });
    return Promise.race([work(progress), cap]).then(function () {
      done = true;
      try { sessionStorage.setItem("sandbox:loaded", "1"); } catch (e) { /* storage blocked */ }
      if (!hasLoader || !gsap) {
        root.classList.remove("k-loading");
        return;
      }
      var minShow = Math.max(0, 900 - (performance.now() - started));
      return new Promise(function (resolve) { setTimeout(resolve, minShow + 320); }).then(function () {
        gsap.ticker.remove(ticker);
        shown.v = 1;
        render();
        return new Promise(function (resolve) {
          gsap.to(loader, {
            clipPath: "inset(0% 0% 100% 0%)",
            duration: 1.05,
            ease: "expo.inOut",
            onComplete: function () {
              root.classList.remove("k-loading");
              loader.style.clipPath = "";
              resolve();
            }
          });
        });
      });
    });
  }

  // ------------------------------------------------- landing -> dashboard

  function coverAndGo(href) {
    curtain.classList.add("is-on");
    stopLenis();
    if (K.lifecycle) K.lifecycle.boot();
    gsap.fromTo(curtain, { clipPath: "inset(100% 0% 0% 0%)" }, {
      clipPath: "inset(0% 0% 0% 0%)",
      duration: 0.75,
      ease: "expo.inOut",
      onComplete: function () {
        location.hash = href;
        var booted = K.lifecycle ? K.lifecycle.boot() : Promise.resolve();
        Promise.race([booted, new Promise(function (r) { setTimeout(r, 3000); })]).then(function () {
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              gsap.to(curtain, {
                clipPath: "inset(0% 0% 100% 0%)",
                duration: 0.9,
                ease: "expo.inOut",
                onComplete: function () {
                  curtain.classList.remove("is-on");
                  curtain.style.clipPath = "";
                }
              });
            });
          });
        });
      }
    });
  }

  // -------------------------------------------------------------- links

  doc.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest || !visible) return;

    var enter = t.closest("[data-enter], .k-landing a[href^='#/']");
    if (enter && motion && e.detail > 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      var href = enter.getAttribute("href");
      if (href && href.indexOf("#/") === 0 && href !== "#/") {
        e.preventDefault();
        coverAndGo(href);
        return;
      }
    }

    var jump = t.closest("[data-scroll]");
    if (jump) {
      var id = (jump.getAttribute("href") || "").slice(1);
      var target = id && doc.getElementById(id);
      if (target) {
        e.preventDefault();
        scrollToEl(target, e.detail === 0 || !motion);
        var h = target.querySelector(".k-h2");
        if (h && e.detail === 0) {
          h.setAttribute("tabindex", "-1");
          h.focus({ preventScroll: true });
        }
      }
      return;
    }

    var mark = t.closest(".k-top .k-mark");
    if (mark && (location.hash === "" || location.hash === "#" || location.hash === "#/")) {
      e.preventDefault();
      if (lenis && e.detail > 0) lenis.scrollTo(0, { duration: 1.6 });
      else window.scrollTo(0, 0);
    }
  });

  // A small "Open" bubble follows the pointer over the module gallery.
  function setupBubble() {
    if (!motion || !fine.matches) return;
    var bubble = doc.createElement("div");
    bubble.className = "k-bubble";
    bubble.setAttribute("aria-hidden", "true");
    bubble.textContent = "Open";
    doc.getElementById("sandbox").appendChild(bubble);
    gsap.set(bubble, { xPercent: -50, yPercent: -50, scale: 0, opacity: 0 });
    var xTo = gsap.quickTo(bubble, "x", { duration: 0.45, ease: "expo.out" });
    var yTo = gsap.quickTo(bubble, "y", { duration: 0.45, ease: "expo.out" });
    var on = false;
    var track = doc.getElementById("k-work-track");
    if (!track) return;
    track.addEventListener("pointermove", function (e) {
      xTo(e.clientX);
      yTo(e.clientY);
      var media = e.target.closest && e.target.closest(".k-tile-media");
      if (!!media !== on) {
        on = !!media;
        gsap.to(bubble, { scale: on ? 1 : 0, opacity: on ? 1 : 0, duration: 0.35, ease: "expo.out" });
      }
    });
    track.addEventListener("pointerleave", function () {
      on = false;
      gsap.to(bubble, { scale: 0, opacity: 0, duration: 0.3, ease: "power2.out" });
    });
  }

  // ----------------------------------------------------------- magnets

  // Primary pills lean toward the pointer a little, the way physical buttons
  // on Lusion-style pages do. Fine pointers only; nothing moves for touch.
  function setupMagnets() {
    if (!motion || !fine.matches) return;
    doc.querySelectorAll(".k-landing .k-pill-lg, .k-top .k-pill-dark").forEach(function (el) {
      var xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.45)" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.45)" });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
      });
      el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }

  // ------------------------------------------------------- the object

  // Copy, links and controls keep their normal pointer behaviour; everywhere
  // else inside the frame belongs to the object.
  var SOLID = "a, button, input, h1, h2, p, li, .k-rail";

  function onEmpty(target) {
    return !(target && target.closest && target.closest(SOLID));
  }

  function inFrame(x, y) {
    var r = frame.getBoundingClientRect();
    var it = parseFloat(frame.style.getPropertyValue("--k-it")) || 0;
    var ix = parseFloat(frame.style.getPropertyValue("--k-ix")) || 0;
    var ib = parseFloat(frame.style.getPropertyValue("--k-ib")) || 0;
    return x > r.left + ix && x < r.right - ix && y > r.top + it && y < r.bottom - ib;
  }

  function ndcX(x) { return (x / window.innerWidth) * 2 - 1; }
  function ndcY(y) { return -((y / window.innerHeight) * 2 - 1); }

  // Drag to turn the object (mouse), with the flick's momentum on release;
  // click or tap to send a ripple through it. Touch scrolling stays native.
  function setupObject() {
    if (!story || !motion) return;
    var tip = null;
    var tipOn = false;
    var tipX = null, tipY = null;
    var dragging = null;
    var tap = null;

    if (fine.matches) {
      tip = doc.createElement("div");
      tip.className = "k-drag-tip";
      tip.setAttribute("aria-hidden", "true");
      tip.textContent = "Drag to turn";
      doc.getElementById("sandbox").appendChild(tip);
      gsap.set(tip, { scale: 0.7, opacity: 0 });
      tipX = gsap.quickTo(tip, "x", { duration: 0.5, ease: "expo.out" });
      tipY = gsap.quickTo(tip, "y", { duration: 0.5, ease: "expo.out" });
    }

    function showTip(on) {
      if (on !== tipOn) story.classList.toggle("is-grab", on);
      if (!tip || on === tipOn) { tipOn = on; return; }
      tipOn = on;
      gsap.to(tip, { scale: on ? 1 : 0.7, opacity: on ? 1 : 0, duration: on ? 0.4 : 0.22, ease: on ? "expo.out" : "power2.out" });
    }

    story.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      if (dragging && e.pointerId === dragging.id) {
        var dx = e.clientX - dragging.x;
        var dy = e.clientY - dragging.y;
        dragging.x = e.clientX;
        dragging.y = e.clientY;
        dragging.moved += Math.abs(dx) + Math.abs(dy);
        dragging.hist.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
        if (dragging.hist.length > 6) dragging.hist.shift();
        if (engine) engine.dragMove(dx, dy);
      }
      if (tip) {
        tipX(e.clientX + 16);
        tipY(e.clientY + 18);
      }
      showTip(!dragging && mode === "gl" && onEmpty(e.target) && inFrame(e.clientX, e.clientY));
    });

    story.addEventListener("pointerleave", function () { if (!dragging) showTip(false); });

    story.addEventListener("pointerdown", function (e) {
      if (mode !== "gl" || !engine || e.button !== 0 || !onEmpty(e.target) || !inFrame(e.clientX, e.clientY)) return;
      if (e.pointerType === "mouse") {
        e.preventDefault();
        dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, hist: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
        try { story.setPointerCapture(e.pointerId); } catch (err) { /* capture unavailable */ }
        engine.dragStart();
        root.classList.add("k-dragging");
        showTip(false);
      } else {
        tap = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
      }
    });

    function release(e) {
      if (tap && e.pointerId === tap.id) {
        if (e.type === "pointerup" && e.timeStamp - tap.t < 350 && Math.abs(e.clientX - tap.x) + Math.abs(e.clientY - tap.y) < 12 && engine) {
          engine.ripple(ndcX(e.clientX), ndcY(e.clientY));
        }
        tap = null;
      }
      if (!dragging || e.pointerId !== dragging.id) return;
      var h = dragging.hist;
      var a = h[0], b = h[h.length - 1];
      var span = Math.max(1, b.t - a.t) / 1000;
      // A pointer that stopped before letting go carries no fling.
      var fresh = e.timeStamp - b.t < 90;
      if (engine) {
        engine.dragEnd(fresh ? (b.x - a.x) / span : 0, fresh ? (b.y - a.y) / span : 0);
        if (dragging.moved < 6 && e.type === "pointerup") engine.ripple(ndcX(e.clientX), ndcY(e.clientY));
      }
      dragging = null;
      root.classList.remove("k-dragging");
    }

    story.addEventListener("pointerup", release);
    story.addEventListener("pointercancel", release);
  }

  // Hovering or focusing a module link lifts that module's part of the object
  // (a scheduler's strand, a gear, a platter, a slab of frames).
  function setupFocus() {
    sections.forEach(function (section) {
      var ch = Number(section.getAttribute("data-chapter"));
      var links = Array.prototype.slice.call(section.querySelectorAll(".k-mods-link, .k-hero [data-enter]"));
      links.forEach(function (link, i) {
        var part = ch === 0 || links.length === 1 ? -2 : (ch === 4 ? links.length - 1 - i : i);
        var on = function () { if (engine) engine.focus(ch, part); };
        var off = function () { if (engine) engine.blur(); };
        link.addEventListener("pointerenter", on);
        link.addEventListener("pointerleave", off);
        link.addEventListener("focus", on);
        link.addEventListener("blur", off);
      });
    });
  }

  window.addEventListener("pointermove", function (e) {
    if (!engine || e.pointerType === "touch") return;
    engine.setPointer(ndcX(e.clientX), ndcY(e.clientY), true);
  }, { passive: true });

  doc.documentElement.addEventListener("pointerleave", function () {
    if (engine) engine.setPointer(0, 0, false);
  }, { passive: true });

  // ------------------------------------------------------ view changes

  doc.addEventListener("sandbox:view", function (e) {
    var view = e.detail && e.detail.view;
    visible = view === "landing";
    if (visible) {
      top.classList.remove("is-dark");
      if (engine) engine.resetDive();
      if (ScrollTrigger) ScrollTrigger.getAll().forEach(function (st) { st.enable(false); });
      startLenis();
      requestAnimationFrame(function () {
        if (ScrollTrigger) ScrollTrigger.refresh();
        measure();
        update();
        if (engine) {
          engine.setLayouts(sceneLayouts());
          engine.jump(chapter, (Math.min(window.scrollY, storyEnd) / Math.max(1, vh)) * SPIN);
          engine.start();
        }
      });
      if (!booted) boot();
    } else {
      stopLenis();
      top.classList.remove("is-dark", "is-solid");
      solid = false;
      if (ScrollTrigger) ScrollTrigger.getAll().forEach(function (st) { st.disable(false); });
      if (engine) engine.stop();
    }
  });

  K.landing = {
    dive: function () { if (engine) engine.dive(); },
    get mode() { return mode; },
    get engine() { return engine; },
    get lenis() { return lenis; }
  };

  // --------------------------------------------------------------- boot

  var booted = false;

  function boot() {
    if (booted || !visible) return;
    booted = true;
    buildWork();
    measure();
    update();
    setupFocus();

    var afterFonts = fontsReady();
    var work = function (progress) {
      progress(0.12);
      return Promise.all([
        afterFonts.then(function () { progress(0.3); }),
        chooseMode(progress)
      ]);
    };

    if (capture !== null) {
      chooseMode(function () {});
      return;
    }

    if (motion) {
      afterFonts.then(function () {
        setupReveals();
        setupFrame();
        setupWork();
        setupMagnets();
        setupBubble();
        setupObject();
        startLenis();
        ScrollTrigger.refresh();
        measure();
        update();
      });
    } else {
      root.classList.remove("k-loading");
    }

    runLoader(work).then(function () {
      measure();
      update();
      playHero();
    });
  }

  window.addEventListener("resize", function () {
    measure();
    if (engine) {
      engine.setLayouts(sceneLayouts());
      engine.resize();
    }
    update();
  }, { passive: true });

  window.addEventListener("scroll", function () { if (!lenis) update(); }, { passive: true });

  if (reduce.addEventListener) {
    reduce.addEventListener("change", function () {
      if (reduce.matches && mode === "gl") usePosters("reduced-motion");
    });
  }

  if (visible) boot();
  else root.classList.remove("k-loading");
})();
