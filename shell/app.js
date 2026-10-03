/*
 * Sandbox · dashboard shell (Team 15)
 *
 * Routes (hash based, so index.html works from file:// and a static host alike):
 *   #/                landing page
 *   #/overview        the Index (Section 5.2's Overview tab): every module's getMetrics()
 *   #/m/<key>         one module, rendered through Sandbox.lifecycle
 *   #/integration     integration log: contract checks, adapters, hashes, isolation shots
 * Any other hash (for example an in-page anchor inside a module) is not a route
 * and is ignored.
 */
(function () {
  "use strict";

  var K = (window.Sandbox = window.Sandbox || {});
  var reg = K.registry;
  var life = K.lifecycle;
  var doc = document;
  var root = doc.documentElement;

  var $ = function (sel, el) { return (el || doc).querySelector(sel); };

  var els = {
    app: $("#k-app"),
    view: $("#k-view"),
    main: $("#k-main"),
    nav: $("#k-nav"),
    side: $("#k-side"),
    scrim: $("#k-scrim"),
    menu: $("#k-menu"),
    crumb: $("#k-crumb"),
    preview: $("#k-preview"),
    previewImg: $("#k-preview-img"),
    palette: $("#k-palette"),
    palInput: $("#k-pal-input"),
    palList: $("#k-pal-list"),
    live: $("#k-live"),
    kbdHint: $("#k-kbd-hint")
  };

  var reduceMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  if (els.kbdHint) els.kbdHint.textContent = isMac ? "⌘K" : "Ctrl K";

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  // ------------------------------------------------------------ helpers

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function icon(name, cls) {
    return '<svg class="k-icon' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function formatValue(v) {
    if (typeof v === "number") {
      if (!isFinite(v)) return String(v);
      if (Number.isInteger(v)) return String(v);
      return String(Math.round(v * 100) / 100);
    }
    if (v === undefined || v === null) return "–";
    return String(v);
  }

  // Keyboard-initiated navigation gets no animation.
  var lastInput = { kind: "none", at: 0 };
  doc.addEventListener("pointerdown", function () { lastInput = { kind: "pointer", at: Date.now() }; }, true);
  doc.addEventListener("keydown", function () { lastInput = { kind: "keyboard", at: Date.now() }; }, true);
  function pointerDriven() {
    return lastInput.kind === "pointer" && Date.now() - lastInput.at < 1500 && !reduceMotion.matches;
  }

  function announce(text) {
    if (!els.live) return;
    els.live.textContent = "";
    setTimeout(function () { els.live.textContent = text; }, 40);
  }

  function setTitle(text) {
    doc.title = text ? text + " · sandbox" : "sandbox · Operating systems, simulated";
  }

  function loadScriptOnce(src) {
    K._loaded = K._loaded || {};
    if (K._loaded[src]) return K._loaded[src];
    K._loaded[src] = new Promise(function (resolve) {
      var s = doc.createElement("script");
      s.src = src;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      doc.body.appendChild(s);
    });
    return K._loaded[src];
  }

  // ------------------------------------------------------------- router

  function parse(hash) {
    if (!hash || hash === "#" || hash === "#/") return { view: "landing" };
    if (hash.indexOf("#/") !== 0) return null;
    var path = hash.slice(2);
    if (path === "overview") return { view: "overview" };
    if (path === "integration") return { view: "integration" };
    var m = /^m\/([a-z0-9_]+)$/.exec(path);
    if (m && reg.byKey[m[1]]) return { view: "module", key: m[1] };
    return { view: "landing" };
  }

  var current = { view: null, key: null };
  var landingScroll = 0;
  var pendingEnter = null;

  K.enterFrom = function (x, y) {
    pendingEnter = { x: x, y: y };
  };

  function inApp() {
    return root.classList.contains("k-in-app");
  }

  function onRoute() {
    var r = parse(location.hash);
    if (!r) return;
    closeSheet(true);
    closePalette(false);
    if (r.view === "landing") return showLanding();
    showApp(r);
  }

  function emitView(view) {
    try { doc.dispatchEvent(new CustomEvent("sandbox:view", { detail: { view: view } })); } catch (e) { /* old browser */ }
  }

  function showLanding() {
    stopPolling();
    hubStop();
    life.unmount();
    var wasApp = inApp() || current.view === null;
    current = { view: "landing", key: null };
    root.classList.remove("k-in-app", "k-entering");
    setTitle("");
    emitView("landing");
    if (wasApp) window.scrollTo(0, landingScroll);
  }

  function showApp(r) {
    var fromLanding = !inApp();
    if (fromLanding && current.view === "landing") landingScroll = window.scrollY;
    pendingEnter = null;

    renderView(r, { animate: !fromLanding && pointerDriven() });

    if (fromLanding) {
      root.classList.add("k-in-app");
      root.classList.remove("k-entering");
      window.scrollTo(0, 0);
      emitView("app");
      focusHeading();
      if (window.gsap && !reduceMotion.matches) intro(false);
    }
    current = { view: r.view, key: r.key || null };
  }

  function focusHeading() {
    var heading = $(".k-title, .k-page-title", els.view);
    if (heading) heading.focus({ preventScroll: true });
    else if (els.main) els.main.focus({ preventScroll: true });
  }

  // --------------------------------------------------------------- views

  var viewToken = 0;

  function renderView(r, opts) {
    var token = ++viewToken;
    stopPolling();
    hubStop();
    highlightNav(r);
    setCrumb(r);

    var booted = life.boot();
    var sync = K._booted === true;

    if (!sync) {
      life.unmount();
      els.view.innerHTML = skeleton(r.view);
      booted.then(function (status) {
        K._booted = true;
        K.status = status;
        if (token === viewToken) paint(r, { animate: false, focus: false });
      });
      return;
    }
    paint(r, opts);
  }

  function paint(r, opts) {
    opts = opts || {};
    if (r.view === "module" && life.active() === r.key) return;

    if (r.view === "overview") drawOverview();
    else if (r.view === "integration") drawIntegration();
    else if (r.view === "module") drawModule(r.key);

    if (opts.animate) intro(true);
    if (inApp() || root.classList.contains("k-entering")) window.scrollTo(0, 0);
    if (opts.focus !== false) {
      var heading = $(".k-title, .k-page-title", els.view);
      if (heading && inApp()) heading.focus({ preventScroll: true });
    }
  }

  // View entrance: the title rises line by line, the rest settles in after it.
  // Only for pointer-driven switches; keyboard and history navigation are instant.
  function intro(quick) {
    var g = window.gsap;
    if (!g || reduceMotion.matches) return;
    var title = $(".k-title, .k-page-title", els.view);
    var rest = els.view.querySelectorAll(".k-meta, .k-subtitle, .k-mhead-side, .k-page-lede, .k-tally, .k-stage-wrap, .k-group, .k-log, .k-section, .k-hub-eyebrow, .k-hub-lede, .k-hub-actions, .k-hub-stats, .k-filters");
    var frame = $(".k-hub", els.view);
    if (frame) g.from(frame, { clipPath: "inset(4% 3% 4% 3% round 36px)", duration: quick ? 0.8 : 1.1, ease: "expo.out", clearProps: "clipPath" });
    // Laying out the new view first lets a module's own web fonts start loading,
    // so the check below sees them; SplitText only runs with every font settled.
    void els.view.offsetHeight;
    var fontsLoaded = !doc.fonts || doc.fonts.status === "loaded";
    if (title && !fontsLoaded) rest = [title].concat(Array.prototype.slice.call(rest));
    if (title && fontsLoaded && window.SplitText) {
      var split = window.SplitText.create(title, { type: "lines", mask: "lines", linesClass: "k-line" });
      g.from(split.lines, {
        yPercent: 105,
        duration: quick ? 0.7 : 1,
        ease: "expo.out",
        stagger: 0.07,
        onComplete: function () { split.revert(); }
      });
    }
    if (rest.length) g.from(rest, { y: 18, opacity: 0, duration: quick ? 0.6 : 0.9, ease: "expo.out", stagger: 0.05, delay: 0.08, clearProps: "transform,opacity" });
  }

  function skeleton(view) {
    if (view === "module") {
      return '<div class="k-mhead"><div><div class="k-skel" style="width:180px;height:14px;margin-bottom:14px"></div><div class="k-skel" style="width:min(420px,70vw);height:40px"></div></div></div>' +
        '<div class="k-skel" style="min-height:480px"></div>';
    }
    var rows = "";
    for (var i = 0; i < 6; i++) rows += '<div class="k-skel" style="min-height:84px;margin-top:10px"></div>';
    return '<div class="k-skel" style="min-height:clamp(400px,52vh,560px);border-radius:24px;margin-bottom:28px"></div>' + rows;
  }

  // Nav + appbar

  function buildNav() {
    var html = '<ul class="k-nav-list k-nav-top"><li class="k-nav-li"><a class="k-nav-item k-nav-solo" href="#/overview" data-route="overview">' + icon("squares-four") + "<span>Index</span></a></li></ul>";
    reg.categories.forEach(function (cat) {
      var items = reg.navOrder.map(function (k) { return reg.byKey[k]; }).filter(function (m) { return m.category === cat.id; });
      if (!items.length) return;
      html += '<div class="k-nav-group"><p class="k-nav-head" id="k-g-' + cat.id + '">' + icon(cat.icon) + "<span>" + esc(cat.name) + "</span>" +
        '<span class="k-nav-count" aria-hidden="true">' + pad2(items.length) + "</span></p>" +
        '<ul class="k-nav-list" aria-labelledby="k-g-' + cat.id + '">';
      items.forEach(function (m) {
        html += '<li class="k-nav-li"><a class="k-nav-item" href="#/m/' + m.key + '" data-key="' + m.key + '">' +
          '<span class="k-nav-n" aria-hidden="true">' + pad2(m.team) + "</span>" +
          '<span class="k-nav-series">' + esc(m.series) + "</span>" +
          '<span class="k-nav-algo">' + esc(m.algorithm) + "</span></a></li>";
      });
      html += "</ul></div>";
    });
    els.nav.innerHTML = html;
  }

  function highlightNav(r) {
    var items = doc.querySelectorAll(".os-team15 .k-nav-item");
    for (var i = 0; i < items.length; i++) {
      var a = items[i];
      var on = (r.view === "module" && a.getAttribute("data-key") === r.key) ||
        (r.view !== "module" && a.getAttribute("data-route") === r.view);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    var active = els.nav.querySelector('[aria-current="page"]');
    if (active && active.scrollIntoView && inApp()) {
      var box = active.getBoundingClientRect();
      var navBox = els.nav.getBoundingClientRect();
      if (box.top < navBox.top || box.bottom > navBox.bottom) active.scrollIntoView({ block: "nearest" });
    }
  }

  function setCrumb(r) {
    if (!els.crumb) return;
    var sep = '<span class="k-crumb-sep" aria-hidden="true">/</span>';
    var html = "<span>Dashboard</span>" + sep;
    if (r.view === "integration") html += '<span class="k-crumb-strong">Integration log</span>';
    else if (r.view === "module") {
      var m = reg.byKey[r.key];
      html += "<span>" + esc(reg.category(m.category).name) + "</span>" + sep + '<span class="k-crumb-strong">' + esc(m.algorithm) + "</span>";
    } else html += '<span class="k-crumb-strong">Index</span>';
    els.crumb.innerHTML = html;
  }

  // Module view

  var polling = 0;

  function stopPolling() {
    if (polling) clearInterval(polling);
    polling = 0;
  }

  function neighbours(key) {
    var order = reg.navOrder;
    var i = order.indexOf(key);
    return {
      prev: reg.byKey[order[(i - 1 + order.length) % order.length]],
      next: reg.byKey[order[(i + 1) % order.length]]
    };
  }

  function integrationNote(meta) {
    if (meta.integration === "adapter") return meta.adapterNote;
    if (meta.integration === "alias") return meta.adapterNote;
    return "Loaded exactly as submitted: `module.js` and `" + meta.css.join("`, `") + "` from `" + meta.folder + "/`.";
  }

  function drawModule(key) {
    var meta = reg.byKey[key];
    var cat = reg.category(meta.category);
    var nb = neighbours(key);
    setTitle(meta.algorithm);

    // Section 5.2 order: the outgoing module is reset while its DOM is still in
    // the page (Team 14 looks its buttons up by ID), and only then is the view cleared.
    life.unmount();

    els.view.innerHTML =
      '<div class="k-mhead">' +
        "<div>" +
          '<p class="k-meta"><span>' + meta.teamLabel + "</span><span>" + esc(cat.name) + "</span></p>" +
          '<h1 class="k-title' + (meta.algorithm.length > 28 ? " is-long" : "") + '" tabindex="-1">' + esc(meta.algorithm) + "</h1>" +
          '<p class="k-subtitle">' + esc(meta.series) + "</p>" +
        "</div>" +
        '<div class="k-mhead-side">' +
          // Filled with the Section 4 label and unit up front, so the chip keeps its size when live values arrive.
          '<div class="k-metric" id="k-metric" role="group" aria-label="Live metric from getMetrics()">' +
            '<span class="k-metric-label">' + esc(meta.metric.label) + '</span><span class="k-metric-value">\u2013</span><span class="k-metric-unit">' + esc(meta.metric.unit) + "</span>" +
          "</div>" +
          '<div class="k-tools">' +
            '<button class="k-pill k-tool" type="button" data-act="reset" aria-label="Reset this module to its sample data">' + icon("arrow-counter-clockwise") + '<span class="k-tool-label" aria-hidden="true">Reset</span></button>' +
            '<a class="k-pill k-tool" href="' + esc(meta.demo) + '" target="_blank" rel="noopener" aria-label="Open ' + esc(meta.teamLabel) + '\u2019s standalone demo in a new tab">' + icon("arrow-square-out") + '<span class="k-tool-label" aria-hidden="true">Standalone</span></a>' +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="k-stage-wrap">' +
        '<span class="k-plus k-plus-tl" aria-hidden="true"></span><span class="k-plus k-plus-tr" aria-hidden="true"></span>' +
        '<span class="k-plus k-plus-bl" aria-hidden="true"></span><span class="k-plus k-plus-br" aria-hidden="true"></span>' +
        '<div class="k-stage" id="k-stage"></div>' +
      "</div>";

    // The note and the next-module link go in after the module has rendered, so
    // they never sit under an empty stage and then jump down the page.
    var after =
      '<div class="k-stage-note"><p class="k-stage-note-p">' + prose(integrationNote(meta)) + '</p><a class="k-inline-link" href="#/integration">Integration details</a></div>' +
      '<a class="k-next" href="#/m/' + nb.next.key + '"><span class="k-next-l">Next module</span><span class="k-next-t">' + esc(nb.next.algorithm) + icon("arrow-right") + "</span></a>" +
      '<a class="k-textlink k-prev" href="#/m/' + nb.prev.key + '">Previous: ' + esc(nb.prev.algorithm) + "</a>" +
      '<nav class="k-mbar" aria-label="Module navigation">' +
        '<a class="k-mbar-btn" href="#/m/' + nb.prev.key + '" aria-label="Previous module: ' + esc(nb.prev.algorithm) + '">' + icon("caret-left") + "</a>" +
        '<button class="k-mbar-mid" type="button" data-menu aria-label="All modules"><span class="k-mbar-pos">' + pad2(reg.navOrder.indexOf(key) + 1) + " / " + reg.navOrder.length + '</span><span class="k-mbar-t">' + esc(meta.short) + "</span></button>" +
        '<a class="k-mbar-btn" href="#/m/' + nb.next.key + '" aria-label="Next module: ' + esc(nb.next.algorithm) + '">' + icon("caret-right") + "</a>" +
      "</nav>";

    var wrap = $(".k-stage-wrap", els.view);
    var stage = $("#k-stage", els.view);
    life.mount(key, stage).then(function (mountEl) {
      if (!mountEl) return;
      if (wrap.isConnected) wrap.insertAdjacentHTML("afterend", after);
      updateMetric(key);
      checkWide();
      setTimeout(checkWide, 400);
      setTimeout(checkWide, 1500);
      announce(meta.algorithm + ", " + meta.series + ", loaded");
      stopPolling();
      polling = setInterval(function () {
        if (!doc.hidden && life.active() === key) updateMetric(key);
      }, 1000);
    });
  }

  function updateMetric(key) {
    var box = $("#k-metric", els.view);
    if (!box) return;
    var meta = reg.byKey[key];
    var r = life.readMetrics(key);
    var label = r.ok && typeof r.value.primaryMetricLabel === "string" ? r.value.primaryMetricLabel : meta.metric.label;
    var value = r.ok ? formatValue(r.value.primaryMetricValue) : "–";
    var unit = r.ok && typeof r.value.unit === "string" ? r.value.unit : "";
    var l = box.children[0], v = box.children[1], u = box.children[2];
    if (l.textContent !== label) l.textContent = label;
    if (u.textContent !== unit) u.textContent = unit;
    if (v.textContent === value || v._counting) return;
    // The first numeric value counts up; later changes are shown as they happen.
    var num = r.ok && typeof r.value.primaryMetricValue === "number" && isFinite(r.value.primaryMetricValue) ? r.value.primaryMetricValue : null;
    if (window.gsap && num !== null && v.textContent === "–" && num !== 0 && !reduceMotion.matches) {
      var o = { n: 0 };
      v._counting = true;
      window.gsap.to(o, {
        n: num,
        duration: 0.9,
        ease: "expo.out",
        onUpdate: function () { v.textContent = formatValue(Number.isInteger(num) ? Math.round(o.n) : Math.round(o.n * 100) / 100); },
        onComplete: function () { v._counting = false; v.textContent = value; }
      });
    } else {
      v.textContent = value;
    }
  }

  function checkWide() {
    var stage = $("#k-stage", els.view);
    var mountEl = stage && stage.firstElementChild;
    if (!mountEl) return;
    stage.classList.toggle("is-wide", mountEl.scrollWidth > stage.clientWidth + 2);
  }

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(checkWide, 150);
  });

  els.view.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest('[data-act="reset"]');
    if (btn && els.view.contains(btn)) {
      var key = life.active();
      var stage = $("#k-stage", els.view);
      if (key && stage) {
        life.mount(key, stage).then(function () {
          updateMetric(key);
          checkWide();
          announce(reg.byKey[key].algorithm + " reset to its sample data");
        });
      }
      return;
    }

    // In-module anchors such as href="#results" scroll within the page instead of
    // replacing the dashboard route.
    var a = e.target.closest && e.target.closest("a[href^='#']");
    var stageEl = $("#k-stage", els.view);
    if (!a || !stageEl || !stageEl.contains(a)) return;
    var href = a.getAttribute("href");
    if (href.indexOf("#/") === 0) return;
    e.preventDefault();
    var id = href.slice(1);
    var target = null;
    try { target = id ? stageEl.querySelector("#" + CSS.escape(decodeURIComponent(id))) : null; } catch (err) { target = null; }
    var top = target ? target.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 1080 ? 140 : 84) : stageEl.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion.matches ? "auto" : "smooth" });
  }, true);

  // Index (Section 5.2's Overview tab)

  var CAT_SHORT = { cpu: "CPU scheduling", deadlock: "Deadlock", sync: "Synchronization", disk: "Disk", memory: "Memory" };
  var filter = "all";

  function indexRow(meta) {
    var r = life.readMetrics(meta.key);
    var last = life.lastSession[meta.key];
    var chip;
    if (!r.ok) chip = '<span class="k-chip k-chip-warn">No metric</span>';
    else if (r.issues.length) chip = '<span class="k-chip k-chip-warn">' + (r.issues.length === 1 ? "1 note" : r.issues.length + " notes") + "</span>";
    else chip = '<span class="k-chip k-chip-ok">Matches spec</span>';
    if (meta.integration !== "direct") chip += '<span class="k-chip k-chip-plain">' + (meta.integration === "alias" ? "Alias" : "Adapter") + "</span>";

    var cls = "k-row-v";
    var value = "–", unit = "", label = meta.metric.label;
    if (r.ok) {
      value = formatValue(r.value.primaryMetricValue);
      unit = typeof r.value.unit === "string" ? r.value.unit : "";
      label = typeof r.value.primaryMetricLabel === "string" ? r.value.primaryMetricLabel : label;
      if (r.value.primaryMetricValue === "Safe") cls += " is-safe";
      if (r.value.primaryMetricValue === "Unsafe") cls += " is-unsafe";
    } else {
      cls += " is-missing";
    }
    var notes = r.ok && r.issues.length ? ' title="' + esc(r.issues.join("; ")) + '"' : "";

    return '<li class="k-row-li"><a class="k-row" href="#/m/' + meta.key + '" data-key="' + meta.key + '"' + notes + ">" +
      '<span class="k-row-thumb" aria-hidden="true"><img src="landing/shots/' + meta.key + '.webp" alt="" loading="lazy" decoding="async" width="880" height="550"></span>' +
      '<span class="k-row-n">' + pad2(meta.team) + "</span>" +
      '<span class="k-row-main"><span class="k-row-t">' + esc(meta.algorithm) + '</span><span class="k-row-s">' + esc(meta.series) + "</span></span>" +
      '<span class="k-row-metric"><span class="k-row-u">' + esc(label) + "</span>" +
        '<span class="k-row-val"><span class="' + cls + '">' + esc(value) + "</span>" + (unit ? '<span class="k-row-unit">' + esc(unit) + "</span>" : "") + "</span>" +
        (last ? '<span class="k-row-last">Before last reset ' + esc(formatValue(last.value)) + "</span>" : "") +
      "</span>" +
      '<span class="k-row-status">' + chip + "</span>" +
      icon("arrow-up-right", "k-row-go") +
      "</a></li>";
  }

  function stat(n, label) {
    return '<li class="k-hub-stat"><span class="k-hub-n">' + n + '</span><span class="k-hub-l">' + label + "</span></li>";
  }

  function filterButton(id, label, n) {
    return '<button class="k-filter" type="button" data-filter="' + id + '" aria-pressed="' + (filter === id) + '">' + esc(label) + '<span class="k-filter-n">' + pad2(n) + "</span></button>";
  }

  function drawOverview() {
    life.unmount();
    setTitle("Index");
    var total = reg.modules.length;
    var registered = 0, responding = 0, clean = 0;
    reg.modules.forEach(function (m) {
      if (life.inspect(m.key).registered) registered++;
      var r = life.readMetrics(m.key);
      if (r.ok) responding++;
      if (r.ok && !r.issues.length) clean++;
    });
    var first = reg.byKey[reg.navOrder[0]];
    var poster = "landing/posters/chapter-6" + (window.innerWidth < 860 ? "-m" : "") + ".webp";

    var filters = filterButton("all", "All", total);
    reg.categories.forEach(function (cat) {
      filters += filterButton(cat.id, CAT_SHORT[cat.id] || cat.name, reg.modules.filter(function (m) { return m.category === cat.id; }).length);
    });

    var html =
      '<section class="k-hub" aria-labelledby="k-hub-title">' +
        '<img class="k-hub-poster" src="' + poster + '" alt="" decoding="async">' +
        '<div class="k-hub-copy">' +
          '<p class="k-hub-eyebrow">Index</p>' +
          '<h1 class="k-page-title" id="k-hub-title" tabindex="-1">Fourteen simulations. Pick one.</h1>' +
          '<p class="k-hub-lede">Every module runs live in your browser. Leave one and it resets; the value it last showed stays on this page.</p>' +
          '<div class="k-hub-actions">' +
            '<a class="k-pill k-pill-white k-pill-lg" href="#/m/' + first.key + '"><span>Start with ' + esc(first.short) + "</span>" + icon("arrow-right") + "</a>" +
            '<button class="k-pill k-pill-glass k-pill-lg" type="button" data-palette><span>Search</span><span class="k-kbd k-kbd-dark">' + (isMac ? "⌘K" : "Ctrl K") + "</span></button>" +
          "</div>" +
        "</div>" +
        '<ul class="k-hub-stats" aria-label="Summary">' +
          stat(registered + "/" + total, "modules live") +
          stat(responding + "/" + total, "report a metric") +
          stat(clean + "/" + total, "match the spec") +
        "</ul>" +
      "</section>" +
      '<div class="k-filters" role="group" aria-label="Show one topic">' + filters + "</div>";

    reg.categories.forEach(function (cat) {
      var items = reg.navOrder.map(function (k) { return reg.byKey[k]; }).filter(function (m) { return m.category === cat.id; });
      html += '<section class="k-group" data-cat="' + cat.id + '"' + (filter !== "all" && filter !== cat.id ? " hidden" : "") + ' aria-labelledby="k-o-' + cat.id + '">' +
        '<h2 class="k-group-head" id="k-o-' + cat.id + '">' + icon(cat.icon) + "<span>" + esc(cat.name) + '</span><span class="k-group-n">' + pad2(items.length) + "</span></h2>" +
        '<ol class="k-rows">' + items.map(indexRow).join("") + "</ol></section>";
    });
    els.view.innerHTML = html;
    hubScene($(".k-hub", els.view));

    stopPolling();
    polling = setInterval(function () {
      if (doc.hidden || current.view !== "overview") return;
      els.view.querySelectorAll(".k-row").forEach(function (row) {
        var r = life.readMetrics(row.getAttribute("data-key"));
        var v = row.querySelector(".k-row-v");
        if (v && r.ok) {
          var t = formatValue(r.value.primaryMetricValue);
          if (v.textContent !== t) v.textContent = t;
        }
      });
    }, 2000);
  }

  // Topic filter: the bar sticks under the header; choosing a topic keeps the
  // list starting right under it.
  els.view.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-filter]");
    if (!b || !els.view.contains(b)) return;
    filter = b.getAttribute("data-filter");
    els.view.querySelectorAll("[data-filter]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    var shown = [];
    els.view.querySelectorAll(".k-group[data-cat]").forEach(function (g) {
      g.hidden = filter !== "all" && g.getAttribute("data-cat") !== filter;
      if (!g.hidden) shown.push(g);
    });
    var hubEl = $(".k-hub", els.view);
    var topBar = $("#k-top");
    if (hubEl) {
      var y = window.scrollY + hubEl.getBoundingClientRect().bottom - (topBar ? topBar.offsetHeight : 0);
      if (window.scrollY > y) window.scrollTo(0, y);
    }
    if (window.gsap && pointerDriven() && shown.length) window.gsap.from(shown, { opacity: 0, y: 14, duration: 0.5, ease: "expo.out", stagger: 0.05, clearProps: "transform,opacity" });
  });

  // The Index frame runs the landing's closing scene: the die with fourteen
  // module cores. It turns with the page, follows the pointer, can be dragged,
  // and lights a module's core while that module's row is hovered.
  var hub = { canvas: null, engine: null, failed: false, io: null, frame: null, drag: null, tap: null };

  function hubLayout() {
    var c = hub.canvas;
    var w = (c && c.clientWidth) || 1, h = (c && c.clientHeight) || 1;
    var halfW = Math.tan(0.33) * 3.4 * (w / h);
    var key = window.innerWidth < 860
      ? { x: 0, y: 0.48, s: Math.min(0.6, halfW * 0.6) }
      : { x: halfW * 0.5, y: 0.26, s: Math.min(0.86, halfW * 0.32) };
    return { keys: [key, key, key, key, key, key, key], centerX: key.x, transit: 0 };
  }

  function hubScene(frame) {
    hub.frame = frame;
    if (!frame || hub.failed || reduceMotion.matches || !("WebGL2RenderingContext" in window)) return;
    if (!hub.canvas) {
      hub.canvas = doc.createElement("canvas");
      hub.canvas.className = "k-hub-gl";
      hub.canvas.setAttribute("aria-hidden", "true");
    }
    frame.insertBefore(hub.canvas, frame.firstChild);
    (K.GL ? Promise.resolve(true) : loadScriptOnce("landing/gl/engine.js")).then(function (ok) {
      if (!ok || !K.GL || hub.frame !== frame || !frame.isConnected) return;
      var live = function () {
        if (!hub.frame) return;
        hub.canvas.classList.add("is-live");
        hub.frame.classList.add("has-gl");
      };
      if (!hub.engine) {
        hub.engine = K.GL.create(hub.canvas, {
          chapter: 6,
          spin: 0.6,
          onReady: live,
          onFail: function () {
            hub.failed = true;
            if (hub.frame) hub.frame.classList.remove("has-gl");
            hubStop();
            hub.engine = null;
          }
        });
        if (!hub.engine) { hub.failed = true; return; }
      } else if (hub.engine.ready) {
        live();
      }
      hub.engine.setLayouts(hubLayout());
      hub.engine.jump(6, 0.6 + window.scrollY / Math.max(1, window.innerHeight));
      hub.engine.resize();
      hub.engine.start();
      if ("IntersectionObserver" in window) {
        hub.io = new IntersectionObserver(function (entries) {
          if (!hub.engine || current.view !== "overview") return;
          if (entries[0].isIntersecting) hub.engine.start();
          else hub.engine.stop();
        });
        hub.io.observe(frame);
      }
    });
  }

  function hubStop() {
    if (hub.io) { hub.io.disconnect(); hub.io = null; }
    if (hub.engine) { hub.engine.stop(); hub.engine.blur(); }
    hub.frame = null;
    hub.drag = null;
  }

  function hubNdc(e) {
    var r = hub.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1,
      y: -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1),
      inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    };
  }

  els.view.addEventListener("pointerdown", function (e) {
    var frame = e.target.closest && e.target.closest(".k-hub");
    if (!frame || !hub.engine || e.button !== 0 || e.target.closest("a, button, h1, p")) return;
    if (e.pointerType !== "mouse") {
      hub.tap = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
      return;
    }
    e.preventDefault();
    hub.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, vx: 0, vy: 0, t: e.timeStamp };
    try { frame.setPointerCapture(e.pointerId); } catch (err) { /* capture unavailable */ }
    hub.engine.dragStart();
    frame.classList.add("is-dragging");
  });

  els.view.addEventListener("pointermove", function (e) {
    if (!hub.engine || !hub.frame || e.pointerType === "touch") return;
    var n = hubNdc(e);
    hub.engine.setPointer(n.x, n.y, n.inside);
    var d = hub.drag;
    if (!d || e.pointerId !== d.id) return;
    var dx = e.clientX - d.x, dy = e.clientY - d.y, dt = Math.max(1, e.timeStamp - d.t);
    d.vx = d.vx * 0.6 + (dx / dt) * 1000 * 0.4;
    d.vy = d.vy * 0.6 + (dy / dt) * 1000 * 0.4;
    d.x = e.clientX;
    d.y = e.clientY;
    d.t = e.timeStamp;
    d.moved += Math.abs(dx) + Math.abs(dy);
    hub.engine.dragMove(dx, dy);
  }, { passive: true });

  function hubRelease(e) {
    if (!hub.engine) return;
    if (hub.tap && e.pointerId === hub.tap.id) {
      if (e.type === "pointerup" && e.timeStamp - hub.tap.t < 350 && Math.abs(e.clientX - hub.tap.x) + Math.abs(e.clientY - hub.tap.y) < 12) {
        var t = hubNdc(e);
        hub.engine.ripple(t.x, t.y);
      }
      hub.tap = null;
    }
    var d = hub.drag;
    if (!d || e.pointerId !== d.id) return;
    var fresh = e.timeStamp - d.t < 90;
    hub.engine.dragEnd(fresh ? d.vx : 0, fresh ? d.vy : 0);
    if (d.moved < 6 && e.type === "pointerup") {
      var n = hubNdc(e);
      hub.engine.ripple(n.x, n.y);
    }
    hub.drag = null;
    if (hub.frame) hub.frame.classList.remove("is-dragging");
  }

  els.view.addEventListener("pointerup", hubRelease);
  els.view.addEventListener("pointercancel", hubRelease);
  els.view.addEventListener("pointerleave", function () { if (hub.engine && !hub.drag) hub.engine.setPointer(0, 0, false); });

  // A row under the pointer lights its module's core on the die.
  els.view.addEventListener("pointerover", function (e) {
    var row = hub.engine && e.target.closest && e.target.closest(".k-row");
    if (row) hub.engine.focus(6, reg.navOrder.indexOf(row.getAttribute("data-key")));
  });
  els.view.addEventListener("pointerout", function (e) {
    if (!hub.engine) return;
    var from = e.target.closest && e.target.closest(".k-row");
    var to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".k-row");
    if (from && !to) hub.engine.blur();
  });

  window.addEventListener("scroll", function () {
    if (hub.engine && hub.frame && current.view === "overview") hub.engine.setSpin(0.6 + window.scrollY / Math.max(1, window.innerHeight));
  }, { passive: true });

  window.addEventListener("resize", function () {
    if (!hub.engine || !hub.frame) return;
    hub.engine.resize();
    hub.engine.setLayouts(hubLayout());
  }, { passive: true });

  // Index hover preview: the module's screenshot follows the pointer.
  (function preview() {
    var g = window.gsap;
    if (!g || !els.preview || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var xTo = g.quickTo(els.preview, "x", { duration: 0.55, ease: "expo.out" });
    var yTo = g.quickTo(els.preview, "y", { duration: 0.55, ease: "expo.out" });
    var shown = false;
    var place = function (e) {
      xTo(Math.min(e.clientX + 28, window.innerWidth - 340));
      yTo(Math.max(12, e.clientY - 110));
    };
    var hide = function () {
      if (!shown) return;
      shown = false;
      g.to(els.preview, { opacity: 0, scale: 0.92, duration: 0.25, ease: "power2.out" });
    };
    els.view.addEventListener("pointerover", function (e) {
      var row = e.target.closest && e.target.closest(".k-row");
      if (!row || reduceMotion.matches) return;
      var src = "landing/shots/" + row.getAttribute("data-key") + ".webp";
      if (els.previewImg.getAttribute("src") !== src) els.previewImg.setAttribute("src", src);
      if (!shown) {
        shown = true;
        g.set(els.preview, { x: Math.min(e.clientX + 28, window.innerWidth - 340), y: Math.max(12, e.clientY - 110) });
        g.to(els.preview, { opacity: 1, scale: 1, duration: 0.35, ease: "expo.out" });
      }
    });
    els.view.addEventListener("pointermove", function (e) { if (shown) place(e); }, { passive: true });
    els.view.addEventListener("pointerout", function (e) {
      var from = e.target.closest && e.target.closest(".k-row");
      var to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".k-row");
      if (from && !to) hide();
    });
    window.addEventListener("hashchange", hide);
    doc.addEventListener("click", hide, true);
  })();

  // Integration log

  var LIVE = '<span class="k-live">live</span> ';

  // Audit text is plain prose; `backticks` mark code, as in the Markdown log.
  function prose(text) {
    return esc(text).replace(/`([^`]+)`/g, '<code class="k-code">$1</code>');
  }

  function checkRow(level, text) {
    var ico = level === "ok" ? "check-circle" : level === "warn" ? "warning-circle" : "info";
    return '<li class="k-check is-' + level + '">' + icon(ico) + "<span>" + text + "</span></li>";
  }

  function drawIntegration() {
    life.unmount();
    setTitle("Integration log");
    els.view.innerHTML = skeleton("integration");
    var token = viewToken;
    Promise.all([loadScriptOnce("integration/audit.js"), loadScriptOnce("integration/manifest.js")]).then(function () {
      if (token !== viewToken) return;
      paintIntegration();
    });
  }

  function paintIntegration() {
    var audit = window.SandboxAudit || { teams: {}, notCopied: [] };
    var manifest = window.SandboxManifest || { modules: [], notCopied: [] };
    var files = 0;
    manifest.modules.forEach(function (m) { files += m.files.length; });
    var direct = reg.modules.filter(function (m) { return m.integration === "direct"; }).length;

    var html =
      '<div class="k-page-head"><div><h1 class="k-page-title" tabindex="-1">Integration log</h1>' +
      '<p class="k-page-lede">What each submission needed to run inside one shell, per Section 5.3. Rows tagged <span class="k-live">live</span> are re-checked in this browser right now. The rest come from Team 15’s audit of the submitted files and from opening every team’s own demo.html before integration.</p></div>' +
      '<ul class="k-tally k-tally-4" aria-label="Summary">' +
        '<li class="k-tally-li"><span class="k-tally-n">14/14</span><span class="k-tally-l">team folders received</span></li>' +
        '<li class="k-tally-li"><span class="k-tally-n">' + direct + '</span><span class="k-tally-l">loaded exactly as submitted</span></li>' +
        '<li class="k-tally-li"><span class="k-tally-n">' + (reg.modules.length - direct) + '</span><span class="k-tally-l">needed an adapter or alias</span></li>' +
        '<li class="k-tally-li"><span class="k-tally-n">' + files + '</span><span class="k-tally-l">files byte-identical</span></li>' +
      '</ul></div><div class="k-log">';

    reg.modules.slice().sort(function (a, b) { return a.team - b.team; }).forEach(function (meta) {
      var st = life.inspect(meta.key);
      var r = life.readMetrics(meta.key);
      var a = audit.teams[meta.key] || { findings: [] };
      var mf = manifest.modules.filter(function (m) { return m.key === meta.key; })[0];

      var warnCount = a.findings.filter(function (f) { return f.level === "warn"; }).length + (r.ok ? r.issues.length : 1);
      var chip = meta.integration === "adapter" ? '<span class="k-chip k-chip-plain">Adapter</span>'
        : meta.integration === "alias" ? '<span class="k-chip k-chip-plain">Alias</span>'
        : warnCount ? '<span class="k-chip k-chip-warn">' + warnCount + (warnCount === 1 ? " note" : " notes") + "</span>"
        : '<span class="k-chip k-chip-ok">' + icon("check-circle") + "Clean</span>";

      var live = "";
      live += checkRow(st.registered ? "ok" : "warn", LIVE + "Registered as <code class=\"k-code\">" + esc(meta.key) + "</code>" +
        (meta.registeredAs ? " through an alias of <code class=\"k-code\">" + esc(meta.registeredAs) + "</code>" : ""));
      var fns = ["render", "reset", "getMetrics"].filter(function (f) { return st.functions[f]; });
      live += checkRow(fns.length === 3 ? "ok" : "warn", LIVE + "" + (fns.length === 3 ? "render(), reset() and getMetrics() present" : "Missing: " + ["render", "reset", "getMetrics"].filter(function (f) { return !st.functions[f]; }).join(", ")) +
        (st.extra && st.extra.length ? ", plus extra member " + st.extra.map(function (x) { return "<code class=\"k-code\">" + esc(x) + "</code>"; }).join(", ") : ""));
      live += checkRow(st.title && st.title.trim() ? "ok" : "warn", LIVE + "Title " + (st.title === null ? "missing" : st.title.trim() ? "“" + esc(st.title) + "”" : "is an empty string"));
      if (r.ok) {
        live += checkRow(r.issues.length ? "warn" : "ok", LIVE + "getMetrics() returned " + esc(formatValue(r.value.primaryMetricValue)) + (r.value.unit ? " " + esc(r.value.unit) : "") +
          (r.issues.length ? ". " + esc(r.issues.join("; ")) : ", shape and labels match Section 4"));
      } else {
        live += checkRow("warn", LIVE + "" + esc(r.error));
      }
      var diag = (K.diagnostics || []).filter(function (d) { return d.key === meta.key; });
      if (diag.length) live += checkRow("warn", LIVE + "" + diag.length + " runtime problem" + (diag.length === 1 ? "" : "s") + " this session: " + esc(diag[diag.length - 1].phase + ": " + diag[diag.length - 1].message));

      var found = a.findings.map(function (f) { return checkRow(f.level, prose(f.text)); }).join("");

      var shots = "";
      if (a.isolation) {
        shots = '<h3 class="k-log-h">Isolation run of the team’s own demo.html</h3>' +
          '<p class="k-log-p">' + prose(a.isolation.summary) + "</p>" +
          '<ul class="k-shots">' + ["1-initial", "2-mid", "3-final"].map(function (n, i) {
            var src = "integration/isolation/" + meta.key + "/" + n + ".jpg";
            return '<li class="k-shot"><a class="k-shot-a" href="' + src + '" target="_blank" rel="noopener"><img class="k-shot-img" src="' + src + '" alt="' + esc(meta.algorithm) + ", " + ["initial", "mid-run", "final"][i] + ' state" loading="lazy" decoding="async" width="1280" height="800"></a><span class="k-shot-cap">' + ["Initial", "Mid-run", "Final"][i] + "</span></li>";
          }).join("") + "</ul>";
      }

      var hashes = "";
      if (mf) {
        hashes = '<h3 class="k-log-h">Files, SHA-256 (verify with node tools/verify.mjs)</h3><ul class="k-hashes">' +
          mf.files.map(function (f) { return '<li class="k-hash"><span>' + esc(f.name) + '</span><span class="k-hash-v">' + esc(f.sha256.slice(0, 16)) + "…</span></li>"; }).join("") + "</ul>";
      }

      html += '<details class="k-log-row">' +
        '<summary class="k-log-sum"><span class="k-log-team">' + meta.teamLabel + '</span><span class="k-log-name">' + esc(meta.algorithm) + '<span class="k-log-series">' + esc(meta.series) + "</span></span>" +
        '<span class="k-log-path">' + esc(meta.submittedAs) + " → " + esc(meta.folder) + "</span>" + chip + icon("caret-down", "k-log-caret") + "</summary>" +
        '<div class="k-log-body"><div><h3 class="k-log-h">Contract</h3><ul class="k-checks">' + live + found + "</ul>" +
        (meta.adapterNote ? '<h3 class="k-log-h">What Team 15 did</h3><p class="k-log-p">' + prose(meta.adapterNote) + "</p>" : "") +
        "</div><div>" + shots + hashes + "</div></div></details>";
    });

    html += "</div>";

    var extra = (manifest.notCopied || []);
    if (extra.length) {
      html += '<section class="k-group" style="margin-top:34px"><h2 class="k-group-head">Received but not copied into modules/</h2><ul class="k-checks">' +
        extra.map(function (n) { return checkRow("info", "<code class=\"k-code\">" + esc(n.path) + "</code> " + esc(n.reason)); }).join("") + "</ul></section>";
    }
    if (audit.method) {
      html += '<section class="k-group"><h2 class="k-group-head">How this was checked</h2><ul class="k-checks">' +
        audit.method.map(function (t) { return checkRow("info", prose(t)); }).join("") + "</ul></section>";
    }
    els.view.innerHTML = html;
    var heading = $(".k-page-title", els.view);
    if (heading && inApp() && lastInput.kind === "keyboard") heading.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ palette

  var palItems = [];
  var palIndex = 0;
  var palReturn = null;

  function destinations() {
    var list = [
      { href: "#/overview", n: "", t: "Overview", s: "Every module’s metric", c: "", ico: "squares-four" },
      { href: "#/integration", n: "", t: "Integration log", s: "Contract checks and adapters", c: "", ico: "list-checks" }
    ];
    reg.navOrder.forEach(function (k) {
      var m = reg.byKey[k];
      list.push({ href: "#/m/" + k, n: pad2(m.team), t: m.algorithm, s: m.series, c: reg.category(m.category).name, key: k,
        hay: (m.title + " " + m.short + " " + k + " team " + m.team + " " + reg.category(m.category).name).toLowerCase() });
    });
    list.push({ href: "#/", n: "", t: "Landing page", s: "Back to the start", c: "", ico: "arrow-left" });
    list.forEach(function (d) { if (!d.hay) d.hay = (d.t + " " + d.s).toLowerCase(); });
    return list;
  }

  function renderPalette() {
    var q = els.palInput.value.trim().toLowerCase();
    var words = q.split(/\s+/).filter(Boolean);
    palItems = destinations().filter(function (d) {
      return words.every(function (w) { return d.hay.indexOf(w) !== -1; });
    });
    if (palIndex >= palItems.length) palIndex = Math.max(0, palItems.length - 1);
    if (!palItems.length) {
      els.palList.innerHTML = '<li class="k-pal-empty" role="presentation">No module matches “' + esc(els.palInput.value) + "”</li>";
      els.palInput.removeAttribute("aria-activedescendant");
      return;
    }
    els.palList.innerHTML = palItems.map(function (d, i) {
      return '<li class="k-pal-opt" role="option" id="k-pal-' + i + '" data-i="' + i + '" aria-selected="' + (i === palIndex) + '">' +
        '<span class="k-pal-n">' + (d.n || icon(d.ico)) + "</span>" +
        '<span><span class="k-pal-t">' + esc(d.t) + '</span><span class="k-pal-s">' + esc(d.s) + "</span></span>" +
        '<span class="k-pal-c">' + esc(d.c) + "</span></li>";
    }).join("");
    els.palInput.setAttribute("aria-activedescendant", "k-pal-" + palIndex);
  }

  function movePalette(delta) {
    if (!palItems.length) return;
    palIndex = (palIndex + delta + palItems.length) % palItems.length;
    var opts = els.palList.querySelectorAll(".k-pal-opt");
    for (var i = 0; i < opts.length; i++) opts[i].setAttribute("aria-selected", String(i === palIndex));
    els.palInput.setAttribute("aria-activedescendant", "k-pal-" + palIndex);
    if (opts[palIndex] && opts[palIndex].scrollIntoView) opts[palIndex].scrollIntoView({ block: "nearest" });
  }

  function openPalette() {
    if (!els.palette.hidden) return;
    palReturn = doc.activeElement;
    els.palette.hidden = false;
    els.palInput.value = "";
    palIndex = 0;
    renderPalette();
    els.palInput.focus();
  }

  function closePalette(restore) {
    if (els.palette.hidden) return;
    els.palette.hidden = true;
    if (restore !== false && palReturn && palReturn.focus) palReturn.focus({ preventScroll: true });
    palReturn = null;
  }

  function choosePalette(i) {
    var d = palItems[i];
    if (!d) return;
    closePalette(false);
    if (location.hash === d.href) onRoute();
    else location.hash = d.href;
  }

  els.palInput.addEventListener("input", function () { palIndex = 0; renderPalette(); });
  els.palInput.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); movePalette(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); movePalette(-1); }
    else if (e.key === "Enter") { e.preventDefault(); choosePalette(palIndex); }
    else if (e.key === "Escape") { e.preventDefault(); closePalette(); }
    else if (e.key === "Tab") { e.preventDefault(); }
  });
  els.palList.addEventListener("click", function (e) {
    var opt = e.target.closest && e.target.closest(".k-pal-opt");
    if (opt) choosePalette(Number(opt.getAttribute("data-i")));
  });
  els.palette.addEventListener("mousedown", function (e) {
    if (e.target === els.palette) { e.preventDefault(); closePalette(); }
  });

  // --------------------------------------------------------- mobile sheet

  function openSheet() {
    els.side.classList.add("is-open");
    els.scrim.hidden = false;
    void els.scrim.offsetWidth;
    els.scrim.classList.add("is-open");
    els.menu.setAttribute("aria-expanded", "true");
    els.menu.firstElementChild.textContent = "Close";
    if ("inert" in els.main) els.main.inert = true;
    var first = els.side.querySelector('[aria-current="page"]') || els.side.querySelector(".k-nav-item");
    if (first) first.focus({ preventScroll: true });
  }

  function closeSheet(silent) {
    if (!els.side.classList.contains("is-open")) return;
    els.side.classList.remove("is-open");
    els.scrim.classList.remove("is-open");
    els.menu.setAttribute("aria-expanded", "false");
    els.menu.firstElementChild.textContent = "Menu";
    if ("inert" in els.main) els.main.inert = false;
    setTimeout(function () { if (!els.side.classList.contains("is-open")) els.scrim.hidden = true; }, 260);
    if (!silent) els.menu.focus({ preventScroll: true });
  }

  els.menu.addEventListener("click", function () {
    if (els.side.classList.contains("is-open")) closeSheet();
    else openSheet();
  });
  els.scrim.addEventListener("click", function () { closeSheet(); });

  // ----------------------------------------------------------- keyboard

  function typing(target) {
    if (!target) return false;
    var tag = (target.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  }

  doc.addEventListener("keydown", function (e) {
    var mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && !e.altKey && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      if (els.palette.hidden) openPalette();
      else closePalette();
      return;
    }
    if (e.key === "Escape") {
      if (!els.palette.hidden) { closePalette(); return; }
      if (els.side.classList.contains("is-open")) { closeSheet(); return; }
    }
    if (!inApp() || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.key === "[" || e.key === "]") && current.view === "module") {
      var nb = neighbours(current.key);
      location.hash = "#/m/" + (e.key === "[" ? nb.prev.key : nb.next.key);
    }
  });

  doc.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-palette]");
    if (t) { e.preventDefault(); openPalette(); }
    if (e.target.closest && e.target.closest("[data-menu]") && inApp()) { e.preventDefault(); openSheet(); }
  });

  // Skip link: move focus without touching the route hash.
  doc.addEventListener("click", function (e) {
    var skip = e.target.closest && e.target.closest("[data-skip]");
    if (!skip) return;
    e.preventDefault();
    var target = inApp() ? els.main : doc.getElementById("k-start");
    if (target) target.focus();
  });

  // Keep the metric honest when the tab comes back.
  doc.addEventListener("visibilitychange", function () {
    if (!doc.hidden && current.view === "module" && current.key) updateMetric(current.key);
  });

  // --------------------------------------------------------------- start

  buildNav();
  window.addEventListener("hashchange", onRoute);
  onRoute();

  function warm() {
    life.boot().then(function (status) { K._booted = true; K.status = status; });
  }

  K.app = { route: onRoute, openPalette: openPalette, warm: warm };
})();
