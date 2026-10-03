/*
 * Sandbox · landing scene (Team 15), hand-written WebGL2, no libraries.
 *
 * One draw call of GL_POINTS with no vertex buffers: every particle derives its
 * position from gl_VertexID. Seven formations, each a small 3D object drawn with
 * lines and surfaces of particles:
 *   0 a processor die: fourteen module cores around one kernel core, booting
 *   1 four schedulers wound into a helix of CPU bursts
 *   2 a trefoil knot: a circular wait that cannot be undone without a cut
 *   3 three gears turning in lockstep
 *   4 three disk platters with seek arms and pending requests
 *   5 a lattice of page frames in three slabs, loading and evicting
 *   6 the die again, every core lit and wired to the kernel
 * Every formation lays its particles out in the same order (u = index / count),
 * so a morph carries neighbouring particles together and the object re-forms in
 * one sweep instead of scattering. The page scroll sets the morph and the spin;
 * the pointer tilts the object, parts and lights the particles under it; a drag
 * spins it with momentum; a click sends a ripple through it; hovering a module
 * link lifts that module's part of the object.
 *
 * Each morph (formation k to k + 1) is its own small program. The one on screen
 * compiles first and the rest compile behind the loader. Post: half-res bloom,
 * faint chromatic aberration, vignette, grain, ACES tone mapping. Quality tiers
 * scale particle count, pixel ratio and bloom. Software renderers are refused so
 * the page falls back to posters.
 */
(function () {
  "use strict";

  var VS_HEAD = [
    "#version 300 es",
    "precision highp float;",
    "precision highp int;",
    "uniform float uTime;",
    "uniform float uMix;",
    "uniform float uIntro;",
    "uniform float uDive;",
    "uniform float uPointSize;",
    "uniform float uDpr;",
    "uniform float uCount;",
    "uniform vec2 uResolution;",
    "uniform vec2 uPointer;",
    "uniform float uPointerForce;",
    "uniform vec4 uRipple;",
    "uniform vec2 uFocusPart;",
    "uniform float uHighlight;",
    "uniform mat4 uProj;",
    "uniform mat4 uView;",
    "uniform mat3 uModel;",
    "uniform vec3 uFocus;",
    "uniform float uScale;",
    "out vec3 vColor;",
    "out float vAlpha;",
    "const float PI = 3.14159265359;",
    "const float TAU = 6.28318530718;",
    "const float MAIN = 0.95;",
    "const vec3 C_WHITE = vec3(0.92, 0.95, 1.0);",
    "const vec3 C_ICE = vec3(0.78, 0.84, 1.0);",
    "const vec3 C_PALE = vec3(0.62, 0.70, 1.0);",
    "const vec3 C_BLUE = vec3(0.22, 0.36, 1.0);",
    "const vec3 C_NAVY = vec3(0.20, 0.27, 0.62);",
    "const vec3 C_ORANGE = vec3(1.0, 0.56, 0.18);",
    "const vec3 C_WARM = vec3(1.0, 0.80, 0.56);",
    "uint hash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }",
    "float rnd(uint id, uint salt) { return float(hash(id * 0x9E3779B9u + salt * 0x85EBCA6Bu)) / 4294967295.0; }",
    "mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }",
    "vec3 sphereDir(float u, float v) { float z = u * 2.0 - 1.0; float r = sqrt(max(0.0, 1.0 - z * z)); float a = v * TAU; return vec3(r * cos(a), r * sin(a), z); }",
    "vec3 jit(vec4 r, float amt) { return (r.xyz - 0.5) * amt; }",
    "float tri(float x) { return abs(fract(x) * 2.0 - 1.0); }",
    // A point at arc parameter w (0..1) along a rounded rectangle in the XZ plane.
    "vec2 rrect(float w, float hx, float hz, float rc) {",
    "  float sx = hx - rc, sz = hz - rc, q = 0.5 * PI * rc;",
    "  float d = w * (4.0 * (sx + sz) + TAU * rc);",
    "  if (d < 2.0 * sx) return vec2(d - sx, -hz);",
    "  d -= 2.0 * sx;",
    "  if (d < q) { float an = d / rc - 0.5 * PI; return vec2(sx + cos(an) * rc, -sz + sin(an) * rc); }",
    "  d -= q;",
    "  if (d < 2.0 * sz) return vec2(hx, d - sz);",
    "  d -= 2.0 * sz;",
    "  if (d < q) { float an = d / rc; return vec2(sx + cos(an) * rc, sz + sin(an) * rc); }",
    "  d -= q;",
    "  if (d < 2.0 * sx) return vec2(sx - d, hz);",
    "  d -= 2.0 * sx;",
    "  if (d < q) { float an = 0.5 * PI + d / rc; return vec2(-sx + cos(an) * rc, sz + sin(an) * rc); }",
    "  d -= q;",
    "  if (d < 2.0 * sz) return vec2(-hx, sz - d);",
    "  d -= 2.0 * sz;",
    "  float an = PI + min(d, q) / rc;",
    "  return vec2(-sx + cos(an) * rc, -sz + sin(an) * rc);",
    "}"
  ].join("\n");

  // Formation signature: v is the particle's place in the shared order (0..1),
  // r four random numbers, t time. Outputs position, colour, size, opacity, the
  // module part the particle belongs to (-1 for none) and the direction that
  // part lifts toward when its module link is hovered.
  var SIG = "(float v, vec4 r, float t, out vec3 p, out vec3 c, out float s, out float a, out float part, out vec3 lift)";

  // The die. The hero boots it core by core; the closing chapter shows it lit
  // and wired, every module connected to the kernel.
  function chipSource(name, wired) {
    var pins = wired ? 0.21 : 0.25;
    return [
      "void " + name + SIG + " {",
      "  part = -1.0;",
      "  lift = vec3(0.0, 0.12, 0.0);",
      "  if (v < 0.15) {",
      "    vec2 q = rrect(v / 0.15, 0.86, 0.86, 0.13);",
      "    p = vec3(q.x, r.x < 0.5 ? 0.04 : -0.04, q.y) + jit(r, 0.008);",
      "    c = C_ICE; s = 0.9; a = 0.62;",
      "  } else if (v < " + pins.toFixed(2) + ") {",
      "    float w = (v - 0.15) / " + (pins - 0.15).toFixed(2) + " * 44.0;",
      "    float pin = floor(w);",
      "    float side = floor(pin / 11.0);",
      "    float j = pin - side * 11.0;",
      "    vec2 q = vec2(mix(-0.64, 0.64, (j + 0.5) / 11.0) + (r.y - 0.5) * 0.022, 0.875 + fract(w) * 0.1);",
      "    float an = side * 0.5 * PI;",
      "    q = vec2(q.x * cos(an) - q.y * sin(an), q.x * sin(an) + q.y * cos(an));",
      "    p = vec3(q.x, -0.012 + (r.z - 0.5) * 0.008, q.y);",
      "    c = mix(C_NAVY, C_PALE, 0.55); s = 0.8; a = 0.5;",
      wired ? [
        "  } else if (v < 0.25) {",
        "    float w = (v - 0.21) / 0.04 * 14.0;",
        "    float k = floor(w);",
        "    float row = step(7.0, k);",
        "    float along = fract(w);",
        "    float x = -0.6 + (k - row * 7.0 + 0.5) * (1.2 / 7.0);",
        "    p = vec3(x + (r.x - 0.5) * 0.008, 0.06, mix(0.09, 0.17, along) * (row < 0.5 ? -1.0 : 1.0));",
        "    float pulse = exp(-pow((along - fract(t * 0.8 + k * 0.37)) * 7.0, 2.0));",
        "    c = mix(C_PALE, C_WARM, pulse); s = 0.8 + pulse * 0.4; a = 0.36 + pulse * 0.7;",
        "    part = k;"
      ].join("\n") : "",
      "  } else if (v < 0.31) {",
      "    vec2 q = rrect((v - 0.25) / 0.06, 0.69, 0.69, 0.05);",
      "    p = vec3(q.x, 0.05, q.y) + jit(r, 0.006);",
      "    c = C_PALE; s = 0.85; a = 0.56;",
      "  } else if (v < 0.43) {",
      "    bool edge = r.z < 0.42;",
      "    vec2 q = edge ? rrect((v - 0.31) / 0.12, 0.6, 0.085, 0.03) : vec2((r.x - 0.5) * 1.17, (r.y - 0.5) * 0.155);",
      "    p = vec3(q.x, 0.066, q.y);",
      "    float beat = 0.5 + 0.5 * sin(t * 1.4 - q.x * 3.0);",
      "    c = mix(C_ORANGE, C_WARM, edge ? 0.35 : 0.12 * beat);",
      "    s = edge ? 0.95 : 0.85; a = edge ? 1.0 : 0.3 + 0.18 * beat;",
      "    part = 14.0;",
      "  } else {",
      "    float w = (v - 0.43) / 0.57 * 14.0;",
      "    float k = floor(w);",
      "    float row = step(7.0, k);",
      "    vec2 ctr = vec2(-0.6 + (k - row * 7.0 + 0.5) * (1.2 / 7.0), row < 0.5 ? -0.375 : 0.375);",
      "    float hx = 0.6 / 7.0 - 0.016;",
      "    float hz = 0.2;",
      "    bool edge = r.z < 0.5;",
      "    vec2 q = edge ? rrect(fract(w), hx, hz, 0.022) : vec2((r.x - 0.5) * 1.84 * hx, (r.y - 0.5) * 1.9 * hz);",
      "    p = vec3(ctr.x + q.x, 0.062, ctr.y + q.y);",
      wired ? "    float on = 1.0;" : "    float on = smoothstep(0.4 + k * 0.03, 0.52 + k * 0.03, uIntro);",
      "    float hum = 0.5 + 0.5 * sin(t * (0.9 + mod(k, 3.0) * 0.35) + k * 1.7);",
      "    c = mix(C_NAVY, edge ? C_ICE : C_BLUE, on);",
      "    s = edge ? 0.9 : 0.8;",
      "    a = mix(0.1, edge ? " + (wired ? "0.95" : "0.85") + " : 0.3 + 0.2 * hum, on);",
      "    part = k;",
      "    lift = vec3(0.0, 0.16, 0.0);",
      "  }",
      "  float sweep = exp(-pow(p.x * 0.8 + p.z * 0.6 - (mod(t * 0.4, 5.0) - 2.5), 2.0) * 7.0);",
      "  c = mix(c, C_WHITE, sweep * 0.35);",
      "  a += sweep * 0.18;",
      "}"
    ].join("\n");
  }

  var FORMATIONS = [
    chipSource("f0", false),
    // 1: four schedulers as a helix of CPU bursts climbing a timeline
    [
      "void f1" + SIG + " {",
      "  if (v < 0.88) {",
      "    float w0 = v / 0.88 * 4.0;",
      "    float k = floor(w0);",
      "    float w = fract(w0);",
      "    float ws = (floor(w * 10.0) + fract(w * 10.0) * 0.82) / 10.0;",
      "    float ang = ws * TAU * 1.3 + k * 0.5 * PI;",
      "    vec3 radial = vec3(cos(ang), 0.0, sin(ang));",
      "    p = radial * (0.6 + (r.y - 0.5) * 0.018) + vec3(0.0, mix(-0.9, 0.9, ws) + (r.x - 0.5) * 0.05, 0.0);",
      "    float cursor = fract(t * 0.05 + k * 0.27);",
      "    float done = step(ws, cursor);",
      "    float now = 1.0 - smoothstep(0.0, 0.05, abs(ws - cursor));",
      "    vec3 base = k < 0.5 ? C_BLUE : (k < 1.5 ? C_PALE : (k < 2.5 ? C_ICE : mix(C_BLUE, C_PALE, 0.5)));",
      "    c = mix(base, C_WARM, now);",
      "    s = 0.85 + now * 0.35;",
      "    a = 0.24 + done * 0.3 + now * 0.6;",
      "    part = k;",
      "    lift = radial * 0.16;",
      "  } else {",
      "    float w = (v - 0.88) / 0.12;",
      "    if (r.z < 0.4) {",
      "      float an = r.x * TAU;",
      "      p = vec3(cos(an) * 0.06, mix(-0.9, 0.9, (floor(w * 10.0) + 0.5) / 10.0), sin(an) * 0.06);",
      "      a = 0.38;",
      "    } else {",
      "      p = vec3((r.x - 0.5) * 0.01, mix(-1.02, 1.02, w), (r.y - 0.5) * 0.01);",
      "      a = 0.5;",
      "    }",
      "    c = C_PALE; s = 0.8; part = -1.0; lift = vec3(0.0);",
      "  }",
      "}"
    ].join("\n"),
    // 2: a trefoil knot: a circular wait that cannot be undone without cutting
    // it. Hovering the Banker's link relaxes it into a plain loop (the lift).
    [
      "void f2" + SIG + " {",
      "  float th = v * TAU;",
      "  float c1 = cos(th), s1 = sin(th), c2 = cos(2.0 * th), s2 = sin(2.0 * th), c3 = cos(3.0 * th), s3 = sin(3.0 * th);",
      "  vec3 q = vec3(s1 + 2.0 * s2, c1 - 2.0 * c2, -s3) * 0.29;",
      "  vec3 tg = normalize(vec3(c1 + 4.0 * c2, -s1 + 4.0 * s2, -3.0 * c3));",
      "  vec3 n1 = normalize(cross(tg, vec3(0.0, 0.0, 1.0)));",
      "  vec3 n2 = cross(tg, n1);",
      "  float ta = r.y * TAU;",
      "  p = q + (n1 * cos(ta) + n2 * sin(ta)) * 0.042 * (0.82 + 0.18 * r.x);",
      "  float bead = pow(0.5 + 0.5 * cos(3.0 * th - t * 0.7), 36.0);",
      "  float shade = 0.5 + 0.5 * sin(3.0 * th + 1.2);",
      "  c = mix(mix(C_BLUE, C_ICE, shade * 0.7), C_ORANGE, bead);",
      "  s = 0.85 + bead * 0.45;",
      "  a = 0.3 + shade * 0.18 + bead * 0.6;",
      "  part = 0.0;",
      "  vec3 loop = vec3(sin(th), cos(th), 0.0) * 0.82 + (n1 * cos(ta) + n2 * sin(ta)) * 0.04;",
      "  lift = loop - p;",
      "}"
    ].join("\n"),
    // 3: three gears in mesh; the middle one (the shared lock) drives the others
    [
      "void gear(float k, float t, out vec2 ctr, out float R, out float n, out float phi) {",
      "  float w = t * 0.32;",
      "  if (k < 0.5) { ctr = vec2(-0.519, 0.211); R = 0.361; n = 17.0; phi = 5.7493 - w * 0.70588; }",
      "  else if (k < 1.5) { ctr = vec2(0.06, 0.0); R = 0.255; n = 12.0; phi = 0.17453 + w; }",
      "  else { ctr = vec2(0.579, -0.189); R = 0.2975; n = 14.0; phi = 2.5682 - w * 0.85714; }",
      "}",
      "void f3" + SIG + " {",
      "  float k = v < 0.395 ? 0.0 : (v < 0.674 ? 1.0 : 2.0);",
      "  float lo = k < 0.5 ? 0.0 : (k < 1.5 ? 0.395 : 0.674);",
      "  float hi = k < 0.5 ? 0.395 : (k < 1.5 ? 0.674 : 1.0);",
      "  float w = (v - lo) / (hi - lo);",
      "  vec2 ctr; float R; float n; float phi;",
      "  gear(k, t, ctr, R, n, phi);",
      "  vec2 q; float y; float br;",
      "  if (w < 0.6) {",
      "    float al = w / 0.6 * TAU;",
      "    float f = n * (al - phi) / TAU;",
      "    float g = abs(f - floor(f + 0.5));",
      "    float rad = R - 0.02 + 0.042 * (1.0 - smoothstep(0.17, 0.29, g));",
      "    q = vec2(cos(al), sin(al)) * rad;",
      "    y = r.x < 0.5 ? 0.03 : -0.03;",
      "    br = 0.72;",
      "  } else if (w < 0.74) {",
      "    float al = (w - 0.6) / 0.14 * TAU;",
      "    q = vec2(cos(al), sin(al)) * (R * 0.7);",
      "    y = (r.x - 0.5) * 0.05;",
      "    br = 0.42;",
      "  } else if (w < 0.92) {",
      "    float sw = (w - 0.74) / 0.18 * 5.0;",
      "    float al = phi + floor(sw) * TAU / 5.0;",
      "    q = vec2(cos(al), sin(al)) * mix(0.06, R * 0.7, fract(sw)) + vec2(-sin(al), cos(al)) * (r.y - 0.5) * 0.018;",
      "    y = (r.x - 0.5) * 0.03;",
      "    br = 0.48;",
      "  } else {",
      "    float al = r.y * TAU;",
      "    q = vec2(cos(al), sin(al)) * (0.045 + r.x * 0.015);",
      "    y = (r.z - 0.5) * 0.05;",
      "    br = 0.8;",
      "  }",
      "  p = vec3(ctr.x + q.x, y, ctr.y + q.y) * 1.2;",
      "  c = k < 0.5 ? C_PALE : (k < 1.5 ? C_ORANGE : C_BLUE);",
      "  s = 0.85; a = br * (k > 0.5 && k < 1.5 ? 0.85 : 1.0);",
      "  part = k;",
      "  lift = vec3(0.0, 0.2, 0.0);",
      "}"
    ].join("\n"),
    // 4: three platters on one spindle, an arm each, requests waiting on the tracks
    [
      "void f4" + SIG + " {",
      "  if (v < 0.84) {",
      "    float w0 = v / 0.84 * 3.0;",
      "    float k = floor(w0);",
      "    float w = fract(w0) * 9.0;",
      "    float tr = floor(w);",
      "    float R = 0.27 + tr * 0.072;",
      "    float local = fract(w) * TAU;",
      "    float ang = local + t * 0.42;",
      "    p = vec3(cos(ang) * R, (k - 1.0) * 0.36, sin(ang) * R) + jit(r, 0.008);",
      "    float head = 0.27 + tri(t * 0.055 + k * 0.31) * 0.58;",
      "    float near = 1.0 - smoothstep(0.0, 0.055, abs(R - head));",
      "    float h = rnd(uint(k * 9.0 + tr) + 101u, 7u);",
      "    float dA = abs(mod(local - h * TAU + PI, TAU) - PI);",
      "    float req = step(0.55, h) * (1.0 - smoothstep(0.05, 0.16, dA));",
      "    c = mix(mix(C_NAVY, C_ICE, 0.35 + near * 0.6), C_ORANGE, req);",
      "    s = 0.8 + near * 0.25 + req * 0.3;",
      "    a = 0.4 + near * 0.5 + req * 0.7;",
      "    part = k;",
      "    lift = vec3(0.0, 0.12, 0.0);",
      "  } else if (v < 0.97) {",
      "    float w0 = (v - 0.84) / 0.13 * 3.0;",
      "    float k = floor(w0);",
      "    float w = fract(w0);",
      "    float head = 0.27 + tri(t * 0.055 + k * 0.31) * 0.58;",
      // The arm pivots outside the platter; solve the angle that puts its tip on the head's track.
      "    vec2 pivot = vec2(cos(0.62), sin(0.62)) * 0.98;",
      "    float psi = 0.62 + acos(clamp((head * head - 1.508) / 1.4504, -1.0, 1.0));",
      "    vec2 tip = pivot + vec2(cos(psi), sin(psi)) * 0.74;",
      "    bool end = w > 0.88;",
      "    vec2 q = end ? tip + (r.xy - 0.5) * 0.05 : (w < 0.12 ? pivot + vec2(cos(r.y * TAU), sin(r.y * TAU)) * 0.05 * sqrt(r.x) : mix(pivot, tip, (w - 0.12) / 0.76) + (r.xy - 0.5) * 0.012);",
      "    p = vec3(q.x, (k - 1.0) * 0.36 + 0.035, q.y);",
      "    c = end ? C_WARM : C_ICE; s = end ? 1.0 : 0.85; a = end ? 0.9 : 0.5;",
      "    part = k;",
      "    lift = vec3(0.0, 0.12, 0.0);",
      "  } else {",
      "    p = vec3((r.x - 0.5) * 0.035, mix(-0.5, 0.5, (v - 0.97) / 0.03), (r.y - 0.5) * 0.035);",
      "    c = C_PALE; s = 0.85; a = 0.34; part = -1.0; lift = vec3(0.0);",
      "  }",
      "}"
    ].join("\n"),
    // 5: page frames, a 6 x 4 x 4 lattice in three slabs (one per module).
    // Resident frames glow, free ones stay dim, the newest load flashes orange.
    [
      "void f5" + SIG + " {",
      "  float cell = floor(v * 96.0);",
      "  float lw = fract(v * 96.0);",
      "  float slab = floor(cell / 32.0);",
      "  float rem = cell - slab * 32.0;",
      "  float iy = floor(rem / 8.0);",
      "  float rem2 = rem - iy * 8.0;",
      "  float iz = floor(rem2 / 2.0);",
      "  float ix = slab * 2.0 + rem2 - iz * 2.0;",
      "  vec3 ctr = (vec3(ix, iy, iz) - vec3(2.5, 1.5, 1.5)) * 0.28 + vec3((slab - 1.0) * 0.09, 0.0, 0.0);",
      "  float h = 0.095;",
      "  float e = floor(lw * 12.0);",
      "  float al = (fract(lw * 12.0) * 2.0 - 1.0) * h;",
      "  float ax = floor(e / 4.0);",
      "  float j = e - ax * 4.0;",
      "  vec2 sg = vec2(mod(j, 2.0) < 0.5 ? -h : h, j < 1.5 ? -h : h);",
      "  vec3 q = ax < 0.5 ? vec3(al, sg) : (ax < 1.5 ? vec3(sg.x, al, sg.y) : vec3(sg, al));",
      "  p = ctr + q + jit(r, 0.004);",
      "  float since = mod(mod(t * 1.8 + slab * 11.0, 32.0) - mod(rem * 5.0, 32.0), 32.0);",
      "  float resident = 1.0 - step(20.0, since);",
      "  float flash = 1.0 - smoothstep(0.0, 1.6, since);",
      "  c = mix(mix(C_NAVY, C_PALE, resident), C_ORANGE, flash);",
      "  s = 0.8 + flash * 0.3;",
      "  a = 0.1 + resident * 0.6 + flash * 0.6;",
      "  part = slab;",
      "  lift = vec3(0.0, 0.0, 0.3);",
      "}"
    ].join("\n"),
    chipSource("f6", true)
  ];

  // Shared vertex main. $A/$B name the two formations, $FROM/$TO their chapters.
  var MAIN_SRC = [
    // How much the hovered module lights this particle: positive for its part,
    // negative (dimmed) for the other parts of the same formation.
    "float focusOn(float chapter, float part) {",
    "  if (uHighlight <= 0.001 || part < -0.5 || abs(uFocusPart.x - chapter) > 0.5) return 0.0;",
    "  return (uFocusPart.y < -1.5 || abs(part - uFocusPart.y) < 0.5) ? uHighlight : -uHighlight;",
    "}",
    "void lightUp(float h, vec3 lift, inout vec3 p, inout vec3 c, inout float s, inout float a) {",
    "  if (h > 0.0) {",
    "    p += lift * h;",
    "    c = mix(c, uFocusPart.y < -1.5 ? C_WHITE : C_ORANGE, h * 0.8);",
    "    s *= 1.0 + 0.3 * h;",
    "    a *= 1.0 + 0.9 * h;",
    "  } else if (h < 0.0) {",
    "    a *= 1.0 + 0.55 * h;",
    "  }",
    "}",
    "void dust(vec4 r, float t, out vec3 p, out vec3 c, out float s, out float a) {",
    "  vec3 d = sphereDir(r.x, r.y) * (1.45 + r.z * 1.9);",
    "  d.y *= 0.6;",
    "  p = rotY(t * 0.02) * d;",
    "  c = C_PALE; s = 0.7; a = 0.035 + 0.075 * r.w;",
    "}",
    "void main() {",
    "  uint id = uint(gl_VertexID);",
    "  float u = (float(gl_VertexID) + 0.5) / uCount;",
    "  vec4 r = vec4(rnd(id, 1u), rnd(id, 2u), rnd(id, 3u), rnd(id, 4u));",
    "  float r5 = rnd(id, 5u);",
    "  float t = uTime;",
    "  vec3 p; vec3 c; float s; float a;",
    "  float order = r5;",
    "  if (u >= MAIN) {",
    "    dust(r, t, p, c, s, a);",
    "  } else {",
    "    float v = u / MAIN;",
    "    order = v;",
    "    float part; vec3 lift;",
    "    $A(v, r, t, p, c, s, a, part, lift);",
    "    lightUp(focusOn($FROM, part), lift, p, c, s, a);",
    "    if (uMix > 0.0005) {",
    "      vec3 p2; vec3 c2; float s2; float a2; float part2; vec3 lift2;",
    "      $B(v, r, t, p2, c2, s2, a2, part2, lift2);",
    "      lightUp(focusOn($TO, part2), lift2, p2, c2, s2, a2);",
    // The morph sweeps through the shared order. Each particle travels in a
    // straight line with a smootherstep ease, and dims and shrinks while in
    // flight, so the eye follows the two shapes rather than the travellers.
    "      float delay = v * 0.3 + r5 * 0.05;",
    "      float m = clamp((uMix - delay) / 0.65, 0.0, 1.0);",
    "      float e = m * m * m * (m * (m * 6.0 - 15.0) + 10.0);",
    "      float fly = sin(PI * e);",
    "      p = mix(p, p2, e) + vec3(0.0, fly * 0.04, 0.0);",
    "      c = mix(c, c2, e);",
    "      s = mix(s, s2, e) * (1.0 - fly * 0.25);",
    "      a = mix(a, a2, e) * (1.0 - fly * 0.35);",
    "    }",
    "  }",
    // Intro: the object assembles from an exploded view, in the shared order.
    "  float ii = clamp((uIntro - order * 0.25 - r5 * 0.08) / 0.45, 0.0, 1.0);",
    "  float ie = 1.0 - pow(1.0 - ii, 3.0);",
    "  p = mix(p * 2.1 + (r.xyz - 0.5) * 1.4, p, ie);",
    "  a *= ie;",
    "  float dive = clamp((uDive - r5 * 0.25) / 0.75, 0.0, 1.0);",
    "  dive *= dive;",
    "  p = mix(p, p * 0.04, dive);",
    "  a *= 1.0 + dive * 1.5;",
    "  vec3 world = uModel * p * uScale + uFocus;",
    "  vec4 clip = uProj * uView * vec4(world, 1.0);",
    "  vec2 ndc = clip.xy / clip.w;",
    "  float aspect = uResolution.x / uResolution.y;",
    // The pointer parts the particles under it and lights them a little.
    "  vec2 d = (ndc - uPointer) * vec2(aspect, 1.0);",
    "  float dist = length(d);",
    "  float near = exp(-dist * dist * 18.0) * uPointerForce;",
    "  ndc += d / max(dist, 0.0001) * near * 0.04 * vec2(1.0 / aspect, 1.0);",
    "  a *= 1.0 + near * 0.9;",
    // A click sends a ring outward from where it landed.
    "  if (uRipple.w > 0.001) {",
    "    vec2 rd = (ndc - uRipple.xy) * vec2(aspect, 1.0);",
    "    float rdist = length(rd);",
    "    float band = exp(-pow((rdist - uRipple.z * 1.3) * 9.0, 2.0)) * uRipple.w;",
    "    ndc += rd / max(rdist, 0.0001) * band * 0.04 * vec2(1.0 / aspect, 1.0);",
    "    a *= 1.0 + band * 1.6;",
    "    c = mix(c, C_WHITE, band * 0.5);",
    "  }",
    // Depth: particles farther from the camera fade, so rotation reads as 3D.
    "  a *= mix(0.4, 1.0, smoothstep(4.5, 2.6, clip.w));",
    "  gl_Position = vec4(ndc * clip.w, clip.z, clip.w);",
    "  gl_PointSize = clamp(uPointSize * s * uDpr * (3.4 / clip.w), 1.0, 12.0);",
    "  vColor = c;",
    "  vAlpha = a;",
    "}"
  ].join("\n");

  // Vertex shader for the morph from formation `from` to `from + 1`.
  function particleSource(from) {
    var main = MAIN_SRC
      .replace(/\$A/g, "f" + from)
      .replace(/\$B/g, "f" + (from + 1))
      .replace(/\$FROM/g, from.toFixed(1))
      .replace(/\$TO/g, (from + 1).toFixed(1));
    return [VS_HEAD, FORMATIONS[from], FORMATIONS[from + 1], main].join("\n");
  }

  var PAIRS = FORMATIONS.length - 1;

  // Camera elevation for each formation: flat objects are seen from above,
  // tall ones nearly level.
  var TILT = [0.82, 0.2, 0.42, 0.78, 0.55, 0.45, 0.86];

  var PARTICLE_FS = [
    "#version 300 es",
    "precision mediump float;",
    "in vec3 vColor;",
    "in float vAlpha;",
    "out vec4 outColor;",
    "void main() {",
    "  vec2 q = gl_PointCoord - 0.5;",
    "  float d2 = dot(q, q) * 4.0;",
    "  float falloff = exp(-d2 * 3.4) * (1.0 - smoothstep(0.7, 1.0, d2));",
    "  outColor = vec4(vColor * falloff * vAlpha, 1.0);",
    "}"
  ].join("\n");

  var QUAD_VS = [
    "#version 300 es",
    "out vec2 vUv;",
    "void main() {",
    "  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));",
    "  vUv = p;",
    "  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);",
    "}"
  ].join("\n");

  var BRIGHT_FS = [
    "#version 300 es",
    "precision mediump float;",
    "uniform sampler2D uTex;",
    "uniform vec2 uTexel;",
    "uniform float uThreshold;",
    "in vec2 vUv;",
    "out vec4 outColor;",
    "void main() {",
    "  vec3 c = texture(uTex, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture(uTex, vUv + uTexel * vec2(0.5, -0.5)).rgb",
    "         + texture(uTex, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture(uTex, vUv + uTexel * vec2(0.5, 0.5)).rgb;",
    "  c *= 0.25;",
    "  float l = max(c.r, max(c.g, c.b));",
    "  outColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.5, l), 1.0);",
    "}"
  ].join("\n");

  var BLUR_FS = [
    "#version 300 es",
    "precision mediump float;",
    "uniform sampler2D uTex;",
    "uniform vec2 uDir;",
    "in vec2 vUv;",
    "out vec4 outColor;",
    "void main() {",
    "  vec3 c = texture(uTex, vUv).rgb * 0.2270270270;",
    "  c += texture(uTex, vUv + uDir * 1.3846153846).rgb * 0.3162162162;",
    "  c += texture(uTex, vUv - uDir * 1.3846153846).rgb * 0.3162162162;",
    "  c += texture(uTex, vUv + uDir * 3.2307692308).rgb * 0.0702702703;",
    "  c += texture(uTex, vUv - uDir * 3.2307692308).rgb * 0.0702702703;",
    "  outColor = vec4(c, 1.0);",
    "}"
  ].join("\n");

  var COMPOSITE_FS = [
    "#version 300 es",
    "precision highp float;",
    "uniform sampler2D uScene;",
    "uniform sampler2D uBloomA;",
    "uniform sampler2D uBloomB;",
    "uniform float uBloomStrength;",
    "uniform float uExposure;",
    "uniform float uAberration;",
    "uniform float uGrain;",
    "uniform float uTime;",
    "uniform float uAspect;",
    "uniform vec2 uGlow;",
    "in vec2 vUv;",
    "out vec4 outColor;",
    "float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }",
    "vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }",
    "void main() {",
    "  vec2 dir = vUv - 0.5;",
    "  float r2 = dot(dir, dir);",
    "  vec2 off = dir * uAberration * (0.35 + r2);",
    "  vec3 col;",
    "  col.r = texture(uScene, vUv + off).r;",
    "  col.g = texture(uScene, vUv).g;",
    "  col.b = texture(uScene, vUv - off).b;",
    "  col += (texture(uBloomA, vUv).rgb * 0.9 + texture(uBloomB, vUv).rgb * 0.8) * uBloomStrength;",
    "  col = aces(col * uExposure);",
    "  vec2 g = (vUv - uGlow) * vec2(uAspect, 1.0);",
    "  vec3 bg = mix(vec3(0.020, 0.027, 0.047), vec3(0.042, 0.062, 0.106), exp(-dot(g, g) * 1.5));",
    "  vec2 v = dir * vec2(uAspect * 0.82, 1.0);",
    "  float vig = smoothstep(1.15, 0.2, length(v));",
    "  col = bg + col * mix(0.62, 1.0, vig);",
    "  col += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 173.0) - 0.5) * uGrain;",
    "  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);",
    "}"
  ].join("\n");

  var TIERS = {
    high: { count: 32000, dpr: 1.5, size: 1.75, bloom: 1.15 },
    mid: { count: 20000, dpr: 1.25, size: 1.9, bloom: 1.05 },
    low: { count: 10000, dpr: 1.0, size: 2.2, bloom: 0.95 }
  };
  var TIER_ORDER = ["high", "mid", "low"];

  function softwareRenderer(gl) {
    var name = String(gl.getParameter(gl.RENDERER) || "");
    if (/webkit webgl/i.test(name)) {
      var ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || name);
    }
    return /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i.test(name);
  }

  function initialTier() {
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var cores = navigator.hardwareConcurrency || 4;
    var memory = navigator.deviceMemory || 8;
    if (cores <= 2 || memory <= 2) return "low";
    if (coarse || window.innerWidth < 1100 || cores < 8 || memory < 8) return "mid";
    return "high";
  }

  var FOV = 0.66;
  var DIST = 3.4;

  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }

  var VIEW = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -DIST, 1]);

  // rotX(pitch) * rotY(yaw), column-major for uniformMatrix3fv.
  function modelMatrix(out, pitch, yaw) {
    var ca = Math.cos(pitch), sa = Math.sin(pitch), cb = Math.cos(yaw), sb = Math.sin(yaw);
    out[0] = cb; out[1] = sa * sb; out[2] = -ca * sb;
    out[3] = 0; out[4] = ca; out[5] = sa;
    out[6] = sb; out[7] = -sa * cb; out[8] = ca * cb;
    return out;
  }

  // Critically damped spring (semi-implicit), `response` in seconds.
  function springStep(state, target, dt, response) {
    var omega = (2 * Math.PI) / response;
    var f = 1 + 2 * dt * omega;
    var oo = omega * omega;
    var hoo = dt * oo;
    var hhoo = dt * hoo;
    var inv = 1 / (f + hhoo);
    var x = (f * state.x + dt * state.v + hhoo * target) * inv;
    var v = (state.v + hoo * (target - state.x)) * inv;
    state.x = x;
    state.v = v;
  }

  function smooth(f) { return f * f * (3 - 2 * f); }

  // A drag past the pitch limit keeps moving, but less and less.
  function rubber(x, limit) {
    var a = Math.abs(x);
    if (a <= limit) return x;
    var over = a - limit;
    return Math.sign(x) * (limit + (over * limit * 0.55) / (limit + 0.55 * over));
  }

  function create(canvas, options) {
    options = options || {};
    var gl = null;
    try {
      gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: !!options.preserve,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: true
      });
    } catch (e) {
      gl = null;
    }
    if (!gl) return null;
    if (softwareRenderer(gl) && !options.allowSoftware) return null;

    var hdr = !!gl.getExtension("EXT_color_buffer_float");
    var parallel = gl.getExtension("KHR_parallel_shader_compile");

    var tierName = options.tier || initialTier();
    var tier = TIERS[tierName];
    var programs = {};
    var targets = {};
    var ready = false;
    var failed = false;
    var running = false;
    var raf = 0;
    var start = performance.now();
    var last = start;
    var introStart = options.holdIntro ? 0 : -1;   // -1: starts when ready; 0: waits for playIntro()
    var width = 1, height = 1, dpr = 1;
    var vao = gl.createVertexArray();
    var model = new Float32Array(9);

    var chapter = { x: options.chapter || 0, v: 0 };
    var chapterTarget = chapter.x;
    var spin = { x: options.spin || 0, v: 0 };
    var spinTarget = spin.x;
    var pointer = { tx: 0, ty: 0, forceTarget: 0 };
    var ptrX = { x: 0, v: 0 }, ptrY = { x: 0, v: 0 }, pf = { x: 0, v: 0 };
    var tiltX = { x: 0, v: 0 }, tiltY = { x: 0, v: 0 };
    var drag = { active: false, yaw: 0, vel: 0, pitch: { x: 0, v: 0 } };
    var highlight = { x: 0, v: 0 };
    var highlightTarget = 0;
    var focusPart = [-9, -9];
    var ripple = { x: 0, y: 0, start: -1e9 };
    var layouts = {
      keys: [0, 1, 2, 3, 4, 5, 6].map(function () { return { x: 0.6, y: 0, s: 1 }; }),
      centerX: 0.6,
      transit: 0
    };
    var dive = 0, diving = false, diveStart = 0;
    var frozenTime = options.time;
    var frames = [];
    var drawnFrames = 0;
    var tierLocked = !!options.tier;

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }

    function program(vs, fs) {
      var p = gl.createProgram();
      var v = shader(gl.VERTEX_SHADER, vs);
      var f = shader(gl.FRAGMENT_SHADER, fs);
      gl.attachShader(p, v);
      gl.attachShader(p, f);
      gl.linkProgram(p);
      p._shaders = [v, f];
      return p;
    }

    function uniforms(p) {
      var map = {};
      var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) {
        var info = gl.getActiveUniform(p, i);
        map[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name);
      }
      return map;
    }

    // Particle programs: pairs[i] morphs formation i into i + 1. The pair for
    // the current chapter compiles first; the rest follow, nearest first.
    var pairs = [];
    var queue = [];
    var compiling = -1;
    var compileGen = 0;   // bumps when the context is lost, so stale polls stop

    function pairFor(c) {
      return Math.max(0, Math.min(PAIRS - 1, Math.floor(c)));
    }

    function isDone(p) {
      return !parallel || gl.getProgramParameter(p, parallel.COMPLETION_STATUS_KHR);
    }

    function linked(p, label) {
      if (gl.getProgramParameter(p, gl.LINK_STATUS)) {
        p.u = uniforms(p);
        return true;
      }
      var log = gl.getProgramInfoLog(p) || "";
      p._shaders.forEach(function (s) { log += "\n" + (gl.getShaderInfoLog(s) || ""); });
      fail("link " + label + ": " + log.trim());
      return false;
    }

    function startPair(i) {
      compiling = i;
      pairs[i] = { program: program(particleSource(i), PARTICLE_FS), ready: false };
    }

    function finishPair(i) {
      var entry = pairs[i];
      if (!linked(entry.program, "particles " + i)) return false;
      entry.ready = true;
      compiling = -1;
      return true;
    }

    function compileAll() {
      programs = {
        bright: program(QUAD_VS, BRIGHT_FS),
        blur: program(QUAD_VS, BLUR_FS),
        composite: program(QUAD_VS, COMPOSITE_FS)
      };
      pairs = [];
      queue = [];
      var first = pairFor(chapter.x);
      for (var d = 1; d < PAIRS; d++) {
        if (first + d < PAIRS) queue.push(first + d);
        if (first - d >= 0) queue.push(first - d);
      }
      startPair(first);
    }

    function pollCompile() {
      if (failed || ready) return;
      var names = Object.keys(programs);
      var pending = !isDone(pairs[compiling].program) || names.some(function (k) { return !isDone(programs[k]); });
      if (pending) {
        requestAnimationFrame(pollCompile);
        return;
      }
      for (var i = 0; i < names.length; i++) if (!linked(programs[names[i]], names[i])) return;
      if (!finishPair(compiling)) return;
      ready = true;
      if (introStart === -1) introStart = performance.now();
      if (options.onReady) options.onReady(api);
      schedulePair();
    }

    function schedulePair() {
      if (failed || !queue.length || compiling !== -1) return;
      var gen = compileGen;
      var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 60); };
      idle(function () {
        if (gen !== compileGen || failed || !queue.length || compiling !== -1 || gl.isContextLost()) return;
        startPair(queue.shift());
        var poll = function () {
          if (gen !== compileGen || failed || compiling === -1) return;
          if (!isDone(pairs[compiling].program)) {
            requestAnimationFrame(poll);
            return;
          }
          if (finishPair(compiling)) schedulePair();
        };
        poll();
      }, { timeout: 400 });
    }

    // Move a pair to the front of the compile queue.
    function prioritise(i) {
      var at = queue.indexOf(i);
      if (at > 0) {
        queue.splice(at, 1);
        queue.unshift(i);
      }
    }

    function fail(reason) {
      if (failed) return;
      failed = true;
      stop();
      canvas.setAttribute("data-gl", "failed");
      if (options.onFail) options.onFail(reason);
    }

    function makeTarget(w, h) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex: tex, fb: fb, w: w, h: h, ok: ok };
    }

    function dropTargets() {
      Object.keys(targets).forEach(function (k) {
        gl.deleteTexture(targets[k].tex);
        gl.deleteFramebuffer(targets[k].fb);
      });
      targets = {};
    }

    function resize() {
      var cssW = canvas.clientWidth || window.innerWidth;
      var cssH = canvas.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, options.dpr || tier.dpr);
      var w = Math.max(2, Math.round(cssW * dpr));
      var h = Math.max(2, Math.round(cssH * dpr));
      if (w === width && h === height && targets.scene) return;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      dropTargets();
      targets.scene = makeTarget(w, h);
      var hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
      var qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2);
      targets.a1 = makeTarget(hw, hh);
      targets.a2 = makeTarget(hw, hh);
      targets.b1 = makeTarget(qw, qh);
      targets.b2 = makeTarget(qw, qh);
      if (!targets.scene.ok || !targets.a1.ok || !targets.b1.ok) {
        if (hdr) {
          hdr = false;
          width = 0;
          resize();
        } else {
          fail("framebuffer incomplete");
        }
      }
    }

    function quad(p, target, setup) {
      gl.useProgram(p);
      if (target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
        gl.viewport(0, 0, target.w, target.h);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
      }
      setup(p.u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function bindTex(unit, tex, loc) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc, unit);
    }

    function blurPass(src, tmp, level) {
      var p = programs.blur;
      quad(p, tmp, function (u) {
        bindTex(0, src.tex, u.uTex);
        gl.uniform2f(u.uDir, level / src.w, 0);
      });
      quad(p, src, function (u) {
        bindTex(0, tmp.tex, u.uTex);
        gl.uniform2f(u.uDir, 0, level / tmp.h);
      });
    }

    // Where the object sits for a chapter value: between two chapter layouts,
    // drifting toward the centre mid-morph while no copy is on screen.
    function layoutAt(c) {
      var keys = layouts.keys;
      var k = Math.min(keys.length - 2, Math.max(0, Math.floor(c)));
      var f = Math.min(1, Math.max(0, c - k));
      var e = smooth(f);
      var A = keys[k], B = keys[k + 1];
      var x = A.x + (B.x - A.x) * e;
      var y = A.y + (B.y - A.y) * e;
      var s = A.s + (B.s - A.s) * e;
      var exc = Math.sin(Math.PI * f) * layouts.transit;
      x += (layouts.centerX - x) * exc;
      s *= 1 + 0.05 * exc;
      return { x: x, y: y, s: s };
    }

    function draw(now) {
      var t = frozenTime !== undefined ? frozenTime : (now - start) / 1000;
      var intro = options.skipIntro ? 1 : (introStart > 0 ? Math.min(1, (now - introStart) / 3200) : 0);

      // Pick the morph program for the current chapter. If it is still compiling,
      // hold the nearest ready formation until it arrives.
      var c = Math.max(0, Math.min(PAIRS, chapter.x));
      var want = pairFor(c);
      var use = want;
      var mixValue = c - want;
      if (!pairs[use] || !pairs[use].ready) {
        use = -1;
        for (var i = 0; i < PAIRS; i++) {
          if (pairs[i] && pairs[i].ready && (use < 0 || Math.abs(i - want) < Math.abs(use - want))) use = i;
        }
        if (use < 0) return false;
        mixValue = use < want ? 1 : 0;
        prioritise(want);
      }

      var k = Math.min(PAIRS - 1, Math.floor(c));
      var e = smooth(c - k);
      var pitch = TILT[k] + (TILT[k + 1] - TILT[k]) * e + drag.pitch.x - tiltY.x * 0.14;
      var yaw = spin.x + (k + e) * Math.PI * 0.5 + (frozenTime !== undefined ? 0 : t * 0.07) + drag.yaw + tiltX.x * 0.25;
      modelMatrix(model, pitch, yaw);
      var L = layoutAt(c);

      // Particles into the HDR scene target.
      var pp = pairs[use].program;
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.scene.fb);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(pp);
      gl.bindVertexArray(vao);
      var aspect = width / height;
      var u = pp.u;
      var age = (now - ripple.start) / 1000;
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uMix, mixValue);
      gl.uniform1f(u.uIntro, intro);
      gl.uniform1f(u.uDive, dive);
      gl.uniform1f(u.uPointSize, tier.size);
      gl.uniform1f(u.uDpr, dpr);
      gl.uniform1f(u.uCount, tier.count);
      gl.uniform2f(u.uResolution, width, height);
      gl.uniform2f(u.uPointer, ptrX.x, ptrY.x);
      gl.uniform1f(u.uPointerForce, pf.x);
      gl.uniform4f(u.uRipple, ripple.x, ripple.y, age, age < 2.4 ? Math.exp(-age * 1.5) : 0);
      gl.uniform2f(u.uFocusPart, focusPart[0], focusPart[1]);
      gl.uniform1f(u.uHighlight, highlight.x);
      gl.uniformMatrix4fv(u.uProj, false, perspective(FOV, aspect, 0.1, 30));
      gl.uniformMatrix4fv(u.uView, false, VIEW);
      gl.uniformMatrix3fv(u.uModel, false, model);
      gl.uniform3f(u.uFocus, L.x, L.y, 0);
      gl.uniform1f(u.uScale, L.s);
      gl.drawArrays(gl.POINTS, 0, tier.count);
      gl.disable(gl.BLEND);

      // Bloom: bright pass at half resolution, then two blur levels.
      quad(programs.bright, targets.a1, function (bu) {
        bindTex(0, targets.scene.tex, bu.uTex);
        gl.uniform2f(bu.uTexel, 1 / width, 1 / height);
        gl.uniform1f(bu.uThreshold, hdr ? 0.55 : 0.35);
      });
      blurPass(targets.a1, targets.a2, 1.0);
      quad(programs.bright, targets.b1, function (bu) {
        bindTex(0, targets.a1.tex, bu.uTex);
        gl.uniform2f(bu.uTexel, 1 / targets.a1.w, 1 / targets.a1.h);
        gl.uniform1f(bu.uThreshold, 0.0);
      });
      blurPass(targets.b1, targets.b2, 1.6);
      blurPass(targets.b1, targets.b2, 2.4);

      // Composite to the screen; the background glow sits behind the object.
      var f = 1 / Math.tan(FOV / 2);
      quad(programs.composite, null, function (cu) {
        bindTex(0, targets.scene.tex, cu.uScene);
        bindTex(1, targets.a1.tex, cu.uBloomA);
        bindTex(2, targets.b1.tex, cu.uBloomB);
        gl.uniform1f(cu.uBloomStrength, tier.bloom * (1 + dive * 1.2));
        gl.uniform1f(cu.uExposure, 1.3 + dive * 0.8);
        gl.uniform1f(cu.uAberration, options.still ? 0.0015 : 0.0025);
        gl.uniform1f(cu.uGrain, options.grain !== undefined ? options.grain : 0.03);
        gl.uniform1f(cu.uTime, t);
        gl.uniform1f(cu.uAspect, aspect);
        gl.uniform2f(cu.uGlow, 0.5 + 0.5 * (f / aspect) * L.x / DIST, 0.5 + 0.5 * f * L.y / DIST);
      });
      return true;
    }

    function step(now) {
      raf = 0;
      if (!running || failed) return;
      var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;

      springStep(chapter, chapterTarget, dt, 0.6);
      springStep(spin, spinTarget, dt, 0.45);
      springStep(ptrX, pointer.tx, dt, 0.22);
      springStep(ptrY, pointer.ty, dt, 0.22);
      springStep(pf, pointer.forceTarget, dt, 0.5);
      springStep(tiltX, pointer.tx, dt, 1.1);
      springStep(tiltY, pointer.ty, dt, 1.1);
      springStep(highlight, highlightTarget, dt, 0.4);
      if (!drag.active) {
        // Released: keep the flick's momentum and let friction take it.
        drag.yaw += drag.vel * dt;
        drag.vel *= Math.exp(-dt * 1.8);
        springStep(drag.pitch, 0, dt, 0.7);
      }
      if (diving) dive = Math.min(1, (now - diveStart) / 720);

      if (ready) {
        if (gl.isContextLost()) return;
        if (draw(now)) drawnFrames++;
        probe(dt);
      }
      raf = requestAnimationFrame(step);
    }

    // Frame-time probe: step down a tier if the median frame is slow.
    function probe(dt) {
      if (tierLocked || document.hidden) return;
      frames.push(dt);
      if (frames.length < 90) return;
      var sorted = frames.slice().sort(function (a, b) { return a - b; });
      var median = sorted[sorted.length >> 1];
      frames = [];
      var i = TIER_ORDER.indexOf(tierName);
      if (median > 0.021 && i < TIER_ORDER.length - 1) {
        tierName = TIER_ORDER[i + 1];
        tier = TIERS[tierName];
        width = 0;
        resize();
        canvas.setAttribute("data-tier", tierName);
      } else if (median < 0.0135) {
        tierLocked = true;
      }
    }

    function start_() {
      if (running || failed) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      stop();
      ready = false;
      compileGen++;
      compiling = -1;
      queue = [];
    });
    canvas.addEventListener("webglcontextrestored", function () {
      programs = {};
      targets = {};
      vao = gl.createVertexArray();
      width = 0;
      compileAll();
      resize();
      pollCompile();
      start_();
    });

    var api = {
      get tier() { return tierName; },
      get hdr() { return hdr; },
      get chapter() { return chapter.x; },
      setChapter: function (c) { chapterTarget = c; },
      setSpin: function (a) { spinTarget = a; },
      jump: function (c, a) {
        chapterTarget = chapter.x = c;
        chapter.v = 0;
        if (a !== undefined) { spinTarget = spin.x = a; spin.v = 0; }
      },
      jumpChapter: function (c) { api.jump(c); },
      setPointer: function (x, y, active) {
        pointer.tx = x;
        pointer.ty = y;
        pointer.forceTarget = active ? 1 : 0;
      },
      // keys: seven {x, y, s} (object centre in world units and scale), one per formation.
      setLayouts: function (next) {
        layouts = {
          keys: next.keys,
          centerX: next.centerX !== undefined ? next.centerX : next.keys[1].x,
          transit: next.transit || 0
        };
      },
      // Light one module's part of a formation (part -2 lights every part).
      focus: function (c, part) {
        focusPart = [c, part];
        highlightTarget = 1;
      },
      blur: function () { highlightTarget = 0; },
      ripple: function (x, y) {
        ripple = { x: x, y: y, start: performance.now() };
      },
      dragStart: function () {
        drag.active = true;
        drag.vel = 0;
        drag.pitch.v = 0;
      },
      // dx, dy in CSS pixels.
      dragMove: function (dx, dy) {
        drag.yaw += dx * 0.0065;
        drag.pitch.x = rubber(drag.pitch.x + dy * 0.004, 0.45);
      },
      // vx, vy in CSS pixels per second at release.
      dragEnd: function (vx, vy) {
        drag.active = false;
        drag.vel = Math.max(-9, Math.min(9, vx * 0.0065));
        drag.pitch.v = Math.max(-4, Math.min(4, vy * 0.004));
      },
      playIntro: function () {
        if (introStart <= 0) introStart = performance.now();
      },
      dive: function () {
        diving = true;
        diveStart = performance.now();
      },
      resetDive: function () {
        diving = false;
        dive = 0;
      },
      start: start_,
      stop: stop,
      resize: resize,
      renderOnce: function () {
        if (!ready) return false;
        resize();
        return draw(performance.now());
      },
      get ready() { return ready; },
      get failed() { return failed; },
      // Compile every remaining morph now (used behind the loader), so no
      // compile happens mid-scroll. Resolves when all are linked or on failure.
      warmAll: function () {
        return new Promise(function (resolve) {
          var tick = function () {
            if (failed) return resolve(false);
            if (ready && compiling === -1 && !queue.length) return resolve(true);
            if (ready && compiling === -1 && queue.length) {
              startPair(queue.shift());
            }
            if (compiling !== -1 && pairs[compiling] && isDone(pairs[compiling].program)) {
              if (!finishPair(compiling)) return resolve(false);
            }
            requestAnimationFrame(tick);
          };
          tick();
        });
      },
      pairsReady: function () {
        var n = 0;
        for (var i = 0; i < PAIRS; i++) if (pairs[i] && pairs[i].ready) n++;
        return n / PAIRS;
      },
      framesDrawn: function () { return drawnFrames; }
    };

    canvas.setAttribute("data-tier", tierName);
    compileAll();
    resize();
    if (!failed) pollCompile();
    return failed ? null : api;
  }

  window.Sandbox = window.Sandbox || {};
  window.Sandbox.GL = { create: create };
})();
