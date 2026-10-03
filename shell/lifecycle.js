/*
 * Sandbox · loader and module lifecycle (Team 15)
 *
 * Loading
 *   - Each module stylesheet is imported into its own cascade layer
 *     (@import url(...) layer(teamNN)) the first time that module opens, and is
 *     switched on only while it is on screen. Team 15's unlayered styles
 *     therefore always win, and one module's global selectors can never restyle
 *     another module.
 *   - Module scripts are plain classic scripts, inserted in team order. This
 *     works from file:// with no server, no fetch() and no build step.
 *   - Chart.js 4.4.2 loads only when a module that draws charts is opened: the
 *     bundled copy in vendor/ first (works offline), jsDelivr as a fallback.
 *
 * Lifecycle (Section 5.2)
 *   switch(A -> B):  snapshot A.getMetrics()   (shown as "last session" on Overview)
 *                    A.reset()                 (only if A was rendered)
 *                    remove A's container
 *                    create a new, empty, attached container
 *                    B.render(container)
 *
 * Every call into a module is wrapped in try/catch, and problems are recorded in
 * Sandbox.diagnostics for the Integration log. While the shell itself calls into a
 * module, console.log/info/debug are muted so debug logging left in a submission
 * does not repeat on every metric poll. Warnings and errors are never muted.
 */
(function () {
  "use strict";

  var K = (window.Sandbox = window.Sandbox || {});
  var reg = K.registry;

  function modules() {
    return (window.OSDashboard && window.OSDashboard.modules) || {};
  }

  // ------------------------------------------------------------ diagnostics

  var diagnostics = [];

  function note(key, phase, error) {
    var message = error && error.message ? error.message : String(error);
    diagnostics.push({ key: key, phase: phase, message: message, time: Date.now() });
    try {
      document.dispatchEvent(new CustomEvent("sandbox:diagnostic", { detail: { key: key, phase: phase, message: message } }));
    } catch (e) { /* CustomEvent unsupported: nothing to notify */ }
  }

  function noop() {}

  function quietly(fn) {
    var c = window.console;
    if (!c) return fn();
    var log = c.log, info = c.info, debug = c.debug;
    c.log = c.info = c.debug = noop;
    try {
      return fn();
    } finally {
      c.log = log;
      c.info = info;
      c.debug = debug;
    }
  }

  // ---------------------------------------------------------------- loading

  function loadScript(src, timeoutMs) {
    return new Promise(function (resolve) {
      var s = document.createElement("script");
      var done = false;
      var timer = 0;
      function finish(ok) {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        resolve(ok);
      }
      s.src = src;
      s.async = false;
      s.onload = function () { finish(true); };
      s.onerror = function () { finish(false); };
      if (timeoutMs) timer = setTimeout(function () { finish(false); }, timeoutMs);
      document.body.appendChild(s);
    });
  }

  var styles = {};

  function layerName(key) {
    return key.slice(0, 6);
  }

  function loadStyles(meta) {
    var list = [];
    meta.css.forEach(function (file) {
      var el = document.createElement("style");
      el.media = "not all";
      el.setAttribute("data-k-module", meta.key);
      el.textContent = '@import url("' + meta.folder + "/" + file + '") layer(' + layerName(meta.key) + ");";
      list.push(new Promise(function (resolve) {
        el.onload = function () { resolve(true); };
        el.onerror = function () { note(meta.key, "stylesheet", new Error("Could not load " + meta.folder + "/" + file)); resolve(false); };
        setTimeout(function () { resolve(false); }, 4000);
      }));
      document.head.appendChild(el);
      (styles[meta.key] = styles[meta.key] || []).push(el);
    });
    return Promise.all(list);
  }

  function setStyles(key, on) {
    (styles[key] || []).forEach(function (el) {
      el.media = on ? "all" : "not all";
    });
  }

  var bootPromise = null;

  var stylePromises = {};

  // A module's stylesheet is fetched the first time that module is opened, so an
  // external @import inside one team's CSS never runs for visitors who don't open it.
  function ensureStyles(key) {
    if (!stylePromises[key]) stylePromises[key] = loadStyles(reg.byKey[key]);
    return stylePromises[key];
  }

  // Loads every module script once and resolves when all of them have run.
  function boot() {
    if (bootPromise) return bootPromise;
    bootPromise = new Promise(function (resolve) {
      var metas = reg.modules.slice().sort(function (a, b) { return a.team - b.team; });

      // Team 1's extracted script ends with render(document.getElementById("module-root")).
      // Give that call a hidden, throwaway target so it succeeds, then discard it.
      var sink = document.createElement("div");
      sink.id = "module-root";
      sink.hidden = true;
      sink.setAttribute("aria-hidden", "true");
      document.body.appendChild(sink);

      var onError = function (event) {
        var file = event && event.filename ? event.filename : "";
        var owner = metas.filter(function (m) {
          return m.scripts.some(function (s) { return file && file.indexOf(s) !== -1; });
        })[0];
        if (owner) note(owner.key, "load", event.error || event.message);
      };
      window.addEventListener("error", onError);

      var scripts = [];
      metas.forEach(function (meta) {
        meta.scripts.forEach(function (src) {
          scripts.push(loadScript(src).then(function (ok) {
            if (!ok) note(meta.key, "load", new Error("Could not load " + src));
          }));
        });
      });

      Promise.all(scripts)
        .then(function () {
          sink.textContent = "";
          sink.remove();
          var t4 = K.compat && K.compat.team04;
          return t4 ? t4.prepare() : null;
        })
        .then(function () {
          window.removeEventListener("error", onError);
          resolve(status());
        });
    });
    return bootPromise;
  }

  var chartPromise = null;

  // The bundled copy is the same Chart.js 4.4.2 build that jsDelivr serves. It is
  // tried first so the dashboard works offline and never logs a failed request;
  // the CDN is the fallback if vendor/ is missing.
  function ensureChart() {
    if (window.Chart) return Promise.resolve(true);
    if (chartPromise) return chartPromise;
    chartPromise = loadScript(reg.chartJs.local).then(function (ok) {
      if (ok && window.Chart) return true;
      return loadScript(reg.chartJs.cdn, 8000).then(function () { return !!window.Chart; });
    });
    return chartPromise;
  }

  // -------------------------------------------------------------- contract

  function inspect(key) {
    var meta = reg.byKey[key];
    var m = modules()[key];
    var r = { key: key, registered: !!m, functions: {}, title: null, issues: [] };
    if (!m) {
      r.issues.push("Not registered under \"" + key + "\"");
      return r;
    }
    ["render", "reset", "getMetrics"].forEach(function (fn) {
      r.functions[fn] = typeof m[fn] === "function";
      if (!r.functions[fn]) r.issues.push(fn + "() is missing");
    });
    r.title = typeof m.title === "string" ? m.title : null;
    if (r.title === null) r.issues.push("No title");
    else if (!r.title.trim()) r.issues.push("Empty title");
    var extra = Object.keys(m).filter(function (k) { return ["title", "render", "reset", "getMetrics"].indexOf(k) === -1; });
    if (extra.length) r.extra = extra;
    if (meta && meta.registeredAs) r.registeredAs = meta.registeredAs;
    return r;
  }

  function readMetrics(key) {
    var meta = reg.byKey[key];
    var m = modules()[key];
    if (!m) return { ok: false, error: "Module not registered" };
    if (typeof m.getMetrics !== "function") return { ok: false, error: "getMetrics() is missing" };
    var v;
    try {
      v = quietly(function () { return m.getMetrics(); });
    } catch (e) {
      note(key, "getMetrics", e);
      return { ok: false, error: "getMetrics() threw: " + (e && e.message ? e.message : e) };
    }
    if (!v || typeof v !== "object") return { ok: false, error: "getMetrics() returned " + (v === null ? "null" : typeof v) };

    var issues = [];
    var expected = ["primaryMetricLabel", "primaryMetricValue", "unit"];
    expected.forEach(function (k) { if (!(k in v)) issues.push("Missing " + k); });
    Object.keys(v).forEach(function (k) { if (expected.indexOf(k) === -1) issues.push("Extra key " + k); });
    if (typeof v.primaryMetricLabel !== "string") issues.push("Label is not a string");
    if (typeof v.unit !== "string") issues.push("Unit is not a string");

    var spec = meta && meta.metric;
    if (spec && spec.type === "state") {
      if (spec.values.indexOf(v.primaryMetricValue) === -1) issues.push("Value is not " + spec.values.join(" or "));
    } else if (typeof v.primaryMetricValue !== "number" || !isFinite(v.primaryMetricValue)) {
      issues.push("Value is not a finite number");
    }
    if (spec && typeof v.primaryMetricLabel === "string" && v.primaryMetricLabel !== spec.label) {
      issues.push("Label “" + v.primaryMetricLabel + "”, spec “" + spec.label + "”");
    }
    if (spec && typeof v.unit === "string" && v.unit !== spec.unit) {
      issues.push("Unit “" + v.unit + "”, spec “" + (spec.unit || "(none)") + "”");
    }
    return { ok: true, value: v, issues: issues };
  }

  function status() {
    var out = {};
    reg.modules.forEach(function (meta) {
      out[meta.key] = inspect(meta.key);
    });
    return out;
  }

  // ------------------------------------------------------------- lifecycle

  var active = null;
  var lastSession = {};
  var rendered = {};
  var generation = 0;   // bumps on every switch, so a slow mount can't land after a newer one

  function snapshot(key) {
    var r = readMetrics(key);
    if (r.ok) lastSession[key] = { value: r.value.primaryMetricValue, unit: r.value.unit, label: r.value.primaryMetricLabel, at: Date.now() };
  }

  function unmount() {
    generation++;
    if (!active) return;
    var a = active;
    active = null;
    var m = modules()[a.key];
    snapshot(a.key);
    if (a.rendered && m && typeof m.reset === "function") {
      try {
        quietly(function () { m.reset(); });
      } catch (e) {
        note(a.key, "reset", e);
      }
    }
    if (a.mount && a.mount.parentNode) a.mount.parentNode.removeChild(a.mount);
    setStyles(a.key, false);
  }

  function failPanel(el, key, error) {
    var meta = reg.byKey[key];
    el.innerHTML =
      '<div class="k-fail" role="alert">' +
      '<p class="k-fail-t">This module could not render.</p>' +
      '<p class="k-fail-p">The error came from the module’s own code, so it is recorded in the integration log instead of being patched.</p>' +
      '<p class="k-fail-code"></p>' +
      '<p class="k-fail-p"><a class="k-inline-link" target="_blank" rel="noopener" href="' + meta.demo + '">Open the team’s standalone demo</a></p>' +
      "</div>";
    el.querySelector(".k-fail-code").textContent = error && error.message ? error.message : String(error);
  }

  // Renders `key` into a new container inside `stage`. Resolves with the container.
  function mount(key, stage) {
    var meta = reg.byKey[key];
    unmount();
    var mine = generation;
    var ready = Promise.all([ensureStyles(key), meta && meta.needsChart ? ensureChart() : true]);
    return ready.then(function () {
      if (mine !== generation) return null;
      var el = document.createElement("div");
      el.setAttribute("data-k-mount", key);
      el.style.width = "100%";
      el.style.minHeight = "480px";
      stage.appendChild(el);
      setStyles(key, true);
      active = { key: key, mount: el, rendered: false };
      var m = modules()[key];
      if (!m || typeof m.render !== "function") {
        failPanel(el, key, new Error("No render() registered under \"" + key + "\""));
        return el;
      }
      try {
        quietly(function () { m.render(el); });
        active.rendered = true;
        rendered[key] = true;
      } catch (e) {
        note(key, "render", e);
        el.innerHTML = "";
        failPanel(el, key, e);
      }
      return el;
    });
  }

  K.diagnostics = diagnostics;
  K.lifecycle = {
    boot: boot,
    ensureChart: ensureChart,
    mount: mount,
    unmount: unmount,
    readMetrics: readMetrics,
    inspect: inspect,
    status: status,
    lastSession: lastSession,
    wasRendered: function (key) { return !!rendered[key]; },
    active: function () { return active ? active.key : null; },
    quietly: quietly,
    note: note
  };
})();
