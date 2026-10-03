// Animated UwU scenes for product states (login, payment, errors, AI assistant ...).
// Needs src/uwu.js, src/uwu_anim.js and src/uwu_props.js.
// Each scene is a function of time t (seconds) returning
//   { cam, tint, pose, face, back(), front() }
// and SCENE_RUNNER.frame(id, t) draws one frame on a 1080x1080 WEBGL canvas.

const UWU_SCENES = (() => {
  const E = UWU.EXPRESSIONS;
  const S = 1.15; // mascot scale on the 1080 canvas
  const G = 330; // ground line (canvas y)
  const TAU = Math.PI * 2;
  const deg = (d) => (d * Math.PI) / 180;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeIn = (x) => x * x * x;
  const back = (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
  const elastic = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1);
  const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // ---------------------------------------------------------------------------
  // Pose helpers
  // ---------------------------------------------------------------------------

  // Combine pose fragments: rot / dx / dy add, sx / sy multiply.
  function add(...poses) {
    const out = {};
    for (const p of poses) {
      if (!p) continue;
      for (const [part, t] of Object.entries(p)) {
        const o = out[part] || (out[part] = {});
        for (const [f, v] of Object.entries(t)) {
          if (f === "sx" || f === "sy") o[f] = (o[f] ?? 1) * v;
          else o[f] = (o[f] ?? 0) + v;
        }
      }
    }
    return out;
  }

  const toExpr = (e) => (typeof e === "string" ? E[e] : { pose: e.pose || {}, face: e.face || {} });

  // Expression keys [[time, name | {pose, face}], ...]; each change blends over `blend` s.
  function track(keys, t, blend = 0.3) {
    let i = 0;
    while (i + 1 < keys.length && keys[i + 1][0] <= t) i++;
    const cur = toExpr(keys[i][1]);
    if (i === 0) return { pose: cur.pose, face: cur.face };
    const prev = toExpr(keys[i - 1][1]);
    const k = easeInOut(prog(t, keys[i][0], keys[i][0] + blend));
    return { pose: UWU_ANIM.blendPose(prev.pose, cur.pose, k), face: UWU_ANIM.blendFace(prev.face, cur.face, k) };
  }

  function life(t, amount = 1) {
    const b = Math.sin((t * TAU) / 2.4);
    return {
      body: { sy: 1 + 0.012 * b * amount, sx: 1 - 0.008 * b * amount },
      ruff: { sy: 1 + 0.02 * b * amount },
      tuft_L: { rot: 0.04 * Math.sin(t * 2.4 + 1) * amount },
      tail: { rot: 0.09 * Math.sin(t * 3.1) * amount },
      curl: { rot: 0.025 * Math.sin(t * 2.1) * amount },
    };
  }

  // Close the eyes briefly around each time in `times` (only for open eyes).
  function blink(face, t, times) {
    const f = UWU.fullFace(face);
    for (const bt of times) {
      const d = Math.abs(t - bt);
      if (d < 0.09 && f.eye.shape === "open") f.eye = { ...f.eye, open: Math.min(f.eye.open, 0.1 + d * 9) };
    }
    return f;
  }

  // A jump starting at t0: squat, launch, hang, land with squash.
  function jump(t, t0, h = 90, dur = 0.75) {
    const u = (t - t0) / dur;
    if (u < 0 || u > 1.25) return {};
    if (u < 0.18) { const k = Math.sin((u / 0.18) * Math.PI * 0.5); return { body: { sy: 1 - 0.12 * k, sx: 1 + 0.08 * k }, root: { dy: 0 }, curl: { rot: -0.1 * k } }; }
    if (u < 0.85) {
      const k = (u - 0.18) / 0.67, air = Math.sin(k * Math.PI);
      return { root: { dy: -h * air }, body: { sy: 1 + 0.08 * (1 - k), sx: 1 - 0.05 * (1 - k) }, curl: { rot: 0.18 * Math.cos(k * Math.PI) }, arm_R: { rot: deg(25) * air }, arm_L: { rot: -deg(25) * air }, tuft_L: { rot: -0.3 * air }, shadow: { sx: 1 - 0.35 * air, sy: 1 - 0.35 * air } };
    }
    const k = (u - 0.85) / 0.4, sq = Math.sin(clamp(k) * Math.PI) * (1 - clamp(k) * 0.5);
    return { body: { sy: 1 - 0.1 * sq, sx: 1 + 0.07 * sq }, curl: { rot: -0.12 * sq } };
  }

  function wave(t, side = "L", amp = 1) {
    const s = side === "L" ? -1 : 1;
    return { [`arm_${side}`]: { rot: s * deg(30 + 14 * Math.sin(t * 9)) * amp } };
  }

  function shake(t, amp = 4, freq = 38) {
    return { root: { dx: amp * Math.sin(t * freq) } };
  }

  // Canvas position of a hand tip, following root offset and arm rotation.
  function hand(side, pose, mx = 0) {
    const s = side === "R" ? -1 : 1, piv = [64 * s, -98], tip = [125 * s, -84];
    const r = (pose[`arm_${side}`] || {}).rot || 0, c = Math.cos(r), sn = Math.sin(r);
    const dx = tip[0] - piv[0], dy = tip[1] - piv[1];
    const u = piv[0] + dx * c - dy * sn + ((pose[`arm_${side}`] || {}).dx || 0), v = piv[1] + dx * sn + dy * c;
    const root = pose.root || {};
    return [mx + S * (u + (root.dx || 0)), G + S * (v + (root.dy || 0))];
  }
  const rig = (u, v, pose = {}, mx = 0) => [mx + S * (u + ((pose.root || {}).dx || 0)), G + S * (v + ((pose.root || {}).dy || 0))];

  function confetti(t, t0, n = 34, cx = 0, cy = -120, spread = 420) {
    const out = [];
    const u = t - t0;
    if (u < 0) return;
    const colors = [UWU.PALETTE.pink, PROPS.C.gold, PROPS.C.mint, UWU.PALETTE.lavender, PROPS.C.sky, UWU.PALETTE.blushDeep];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (hash(i) - 0.5) * 2.4, v = spread * (0.6 + hash(i + 9) * 0.6);
      const x = cx + Math.cos(a) * v * u, y = cy + Math.sin(a) * v * u + 520 * u * u;
      if (y > G + 40) continue;
      PROPS.at(x, y, u * (4 + hash(i + 3) * 8), 1, () => PROPS.confettiPiece(10 + hash(i + 5) * 8, 6 + hash(i + 7) * 5, colors[i % colors.length]));
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Scenes
  // ---------------------------------------------------------------------------

  const SCENES = {};
  const def = (id, title, duration, fn, opts = {}) => (SCENES[id] = { id, title, duration, fn, loop: !!opts.loop });

  def("subscription", "الاشتراك", 4.8, (t) => {
    const ex = track([[0, "neutral"], [1.35, "surprised"], [2.35, "happy"]], t);
    const fly = easeOut(prog(t, 0.5, 1.3));
    const catchArms = prog(t, 1.15, 1.45);
    const crownDrop = back(prog(t, 2.1, 2.6));
    const pose = add(ex.pose, life(t), jump(t, 3.0, 70), {
      arm_R: { rot: deg(22) * catchArms }, arm_L: { rot: -deg(22) * catchArms },
    });
    return {
      tint: UWU.PALETTE.lavender,
      cam: { z: 1 + 0.07 * easeInOut(prog(t, 2.0, 2.8)), y: 30 * easeInOut(prog(t, 2.0, 2.8)), r: 0 },
      pose, face: blink(ex.face, t, [0.7]),
      front() {
        const [hx, hy] = hand("R", pose), [lx, ly] = hand("L", pose);
        const cx = lerp(620, (hx + lx) / 2, fly), cy = lerp(-260, (hy + ly) / 2 - 20, fly) - Math.sin(fly * Math.PI) * 120;
        PROPS.at(cx, cy, lerp(1.2, -0.08, fly), 0.9, () => PROPS.card());
        if (t > 2.1) {
          const [hx2, hy2] = rig(-8, -500, pose);
          PROPS.at(hx2, lerp(-620, hy2, crownDrop), 0.12 * (1 - crownDrop), 0.95, () => PROPS.crown());
        }
        if (t > 2.5) for (let i = 0; i < 5; i++) {
          const a = i * 1.26 + t * 1.5, r = 260 + 20 * Math.sin(t * 3 + i);
          PROPS.at(Math.cos(a) * r, -150 + Math.sin(a) * r * 0.6, 0, 0.7 + 0.3 * Math.sin(t * 6 + i), () => PROPS.sparkle(18));
        }
      },
    };
  });

  def("offers", "العروض", 4.6, (t) => {
    const ex = track([[0, "neutral"], [0.9, "surprised"], [1.9, "happy"], [3.6, "uwu"]], t);
    const lid = elastic(prog(t, 1.3, 2.1));
    const pose = add(ex.pose, life(t), jump(t, 2.0, 50, 0.6), { root: { dx: -70 }, arm_L: { rot: -deg(20) * prog(t, 0.9, 1.2) } });
    return {
      tint: UWU.PALETTE.pink,
      cam: { z: 1.02 + 0.05 * Math.sin(t * 0.8), x: -10, y: 10, r: deg(1.2) * Math.sin(t * 0.7) },
      pose, face: blink(ex.face, t, [0.5]),
      front() {
        PROPS.at(250, G - 70, 0, 1.15, () => PROPS.gift(lid));
        const tags = [["%", -0.6, 0], ["-50%", 0.1, 0.12], ["%", 0.75, 0.22]];
        tags.forEach(([txt, dir, dl], i) => {
          const u = easeOut(prog(t, 1.5 + dl, 2.4 + dl));
          if (u <= 0) return;
          const x = 250 + dir * 220 * u, y = G - 150 - 330 * u + 30 * Math.sin(t * 3 + i);
          PROPS.at(x, y, Math.sin(t * 2 + i) * 0.2, 0.8 + 0.25 * u, () => PROPS.priceTag(txt, i === 1 ? PROPS.C.red : UWU.PALETTE.blushDeep));
        });
        if (t > 1.6) for (let i = 0; i < 4; i++) PROPS.at(250 + Math.cos(i * 1.6 + t * 2) * 170, G - 230 + Math.sin(i * 1.6 + t * 2) * 90, 0, 0.6 + 0.3 * Math.sin(t * 5 + i), () => PROPS.sparkle(16));
      },
    };
  });

  def("login", "تسجيل الدخول", 4.8, (t) => {
    const ex = track([[0, "neutral"], [2.2, "uwu"], [3.0, "happy"]], t);
    const reach = easeInOut(prog(t, 0.6, 1.6)), turn = prog(t, 1.7, 2.1), open = back(prog(t, 2.1, 2.5));
    const pose = add(ex.pose, life(t), { arm_L: { rot: -deg(30) * reach }, root: { dx: -60 } }, t > 3.0 ? wave(t, "R") : {});
    return {
      tint: PROPS.C.sky,
      cam: { z: 1 + 0.1 * easeInOut(prog(t, 1.2, 2.2)) - 0.06 * easeInOut(prog(t, 3, 3.8)), x: -40 * easeInOut(prog(t, 1.2, 2.2)), y: 0, r: 0 },
      pose, face: blink(ex.face, t, [0.4]),
      front() {
        const [hx, hy] = hand("L", pose);
        PROPS.at(300, G - 170, 0, 1.25, () => PROPS.padlock(open));
        const kx = lerp(hx + 10, 230, reach), ky = lerp(hy, G - 180, reach);
        if (t < 2.4) PROPS.at(kx, ky, turn * Math.PI * 0.5, 0.9, () => PROPS.key());
        if (t > 2.4) PROPS.at(300, G - 330, 0, elastic(prog(t, 2.4, 3.0)), () => PROPS.badge("check", prog(t, 2.6, 3.0)));
      },
    };
  });

  def("error404", "خطأ 404", 5.4, (t) => {
    const look = Math.sin(t * 1.3);
    const ex = track([[0, { pose: {}, face: { eye: { gaze: [0, 0] } } }], [3.2, "sad"], [4.4, "shy"]], t);
    const walk = Math.sin(t * 5.5);
    const searching = t < 3.0;
    const pose = add(ex.pose, life(t), {
      root: { dx: searching ? 60 * Math.sin(t * 0.9) : 0, dy: searching ? -6 * Math.abs(walk) : 0 },
      head: { rot: searching ? 0.06 * look : 0 }, arm_L: { rot: searching ? -deg(28) : 0 },
      foot_R: { dy: searching ? -6 * Math.max(0, walk) : 0 }, foot_L: { dy: searching ? -6 * Math.max(0, -walk) : 0 },
    }, t > 3.0 && t < 4.2 ? { arm_R: { rot: deg(30) * Math.sin(prog(t, 3, 4.2) * Math.PI) }, arm_L: { rot: -deg(30) * Math.sin(prog(t, 3, 4.2) * Math.PI) } } : {});
    const face = blink(ex.face, t, [2.4]);
    if (searching) face.eye = { ...face.eye, gaze: [6 * look, -2] };
    return {
      tint: UWU.PALETTE.shadow,
      cam: { z: 1.04, x: 0, y: 0, r: deg(-1.5) + deg(1) * Math.sin(t * 0.5) },
      pose, face,
      back() { PROPS.at(-300, G, deg(-4), 0.9, () => PROPS.sign404()); },
      front() {
        if (searching) { const [hx, hy] = hand("L", pose); PROPS.at(hx + 20, hy - 20, -0.4 + 0.15 * Math.sin(t * 3), 1.1, () => PROPS.magnifier()); }
        if (t > 3.1 && t < 4.6) PROPS.at(rig(80, -470, pose)[0], rig(80, -470, pose)[1], 0, 1, () => PROPS.label("?", 0, 0, 80, UWU.PALETTE.purple));
      },
    };
  });

  // --- AI assistant icon states (seamless loops, framed close on the face) ---
  const aiCam = { z: 1.3, x: 0, y: 150, r: 0 };
  const float = (t, period) => ({ root: { dy: -10 + 10 * Math.sin((t / period) * TAU) }, shadow: { sx: 1 - 0.08 * Math.sin((t / period) * TAU), sy: 1 - 0.08 * Math.sin((t / period) * TAU) } });

  def("ai_idle", "الذكاء الاصطناعي — انتظار", 3.2, (t) => {
    const pose = add(life(t * 1.25, 0.8), float(t, 3.2));
    return {
      tint: UWU.PALETTE.lavender, cam: aiCam, pose, face: blink({}, t, [1.6]),
      front() {
        for (let i = 0; i < 3; i++) {
          const a = (t / 3.2) * TAU + i * (TAU / 3);
          PROPS.at(Math.cos(a) * 330, -220 + Math.sin(a) * 90, 0, 0.55 + 0.25 * Math.sin(a), () => PROPS.sparkle(16, i === 1 ? UWU.PALETTE.pink : PROPS.C.gold));
        }
      },
    };
  }, { loop: true });

  def("ai_listening", "الذكاء الاصطناعي — يستمع", 3.2, (t) => {
    const nod = Math.sin((t / 1.6) * TAU);
    const pose = add(life(t * 1.25, 0.8), float(t, 3.2), { head: { rot: deg(-6) + deg(2) * nod }, tuft_L: { rot: -0.35 + 0.05 * nod }, face: { dx: -4 } });
    return {
      tint: PROPS.C.sky, cam: aiCam, pose,
      face: blink({ eye: { open: 1.05, gaze: [4, -1] }, brow: { dy: -3 }, mouth: { shape: "smile", width: 0.8 } }, t, [2.2]),
      front() { PROPS.at(250, -250, 0, 1, () => PROPS.waves(t)); PROPS.at(-250, -250, Math.PI, 1, () => PROPS.waves(t + 0.3)); },
    };
  }, { loop: true });

  def("ai_thinking", "الذكاء الاصطناعي — يفكر", 3.2, (t) => {
    const sway = Math.sin((t / 3.2) * TAU);
    const pose = add(life(t * 1.25, 0.8), float(t, 3.2), { head: { rot: deg(5) * sway }, curl: { rot: 0.12 * Math.sin((t / 1.6) * TAU) }, arm_L: { rot: -deg(28) } });
    return {
      tint: UWU.PALETTE.lavender, cam: aiCam, pose,
      face: { eye: { gaze: [3 * sway, -5], open: 0.9 }, brow: { dy: -3, tilt: -4 }, mouth: { shape: "wavy", width: 0.6 } },
      front() {
        PROPS.at(250, -300, 0, 0.75, () => { PROPS.bubble(190, 120, [-110, 90], true); PROPS.at(0, 0, 0, 1, () => PROPS.dots(t)); });
      },
    };
  }, { loop: true });

  def("ai_speaking", "الذكاء الاصطناعي — يجيب", 3.2, (t) => {
    const talk = 0.5 + 0.5 * Math.sin(t * 14) * Math.sin(t * 3.3);
    const pose = add(life(t * 1.25, 0.8), float(t, 3.2), { head: { rot: deg(3) * Math.sin((t / 1.6) * TAU) }, arm_R: { rot: deg(18) + deg(8) * Math.sin(t * 4) } });
    return {
      tint: PROPS.C.mint, cam: aiCam, pose,
      face: blink({ eye: { shape: "open" }, mouth: { shape: talk > 0.35 ? "openSmile" : "smile", open: 0.2 + 0.5 * talk }, blush: 1.2 }, t, [2.6]),
      front() {
        PROPS.at(260, -290, 0, 0.75, () => {
          PROPS.bubble(210, 130, [-120, 95]);
          const k = UWU.kit, n = Math.floor(((t / 3.2) % 1) * 9);
          for (let i = 0; i < 3; i++) {
            const w = [130, 150, 90][i], shown = clamp((n - i * 3) / 3);
            if (shown > 0) k.ink([[-70, -32 + i * 30], [-70 + w * shown, -32 + i * 30]], 4, { second: false, color: UWU.PALETTE.lavender, taper: [false, false] });
          }
        });
      },
    };
  }, { loop: true });

  def("ai_error", "الذكاء الاصطناعي — خطأ", 3.2, (t) => {
    const glitch = (Math.floor(t * 12) % 7 === 0) ? 8 : 0;
    const pose = add(E.sad.pose, life(t * 1.25, 0.6), float(t, 3.2), { root: { dx: glitch }, curl: { rot: -0.2 } });
    return {
      tint: PROPS.C.red, cam: { ...aiCam, x: glitch * 0.6 }, pose, face: E.sad.face,
      front() { PROPS.at(250, -300, deg(8) * Math.sin(t * 2), 0.8, () => PROPS.badge("cross", 1)); PROPS.at(rig(-150, -330, pose)[0], rig(-150, -330, pose)[1] + 20 * ((t * 0.8) % 1), 0, 1, () => PROPS.sweat(10)); },
    };
  }, { loop: true });

  def("email", "البريد الإلكتروني", 4.8, (t) => {
    const ex = track([[0, "neutral"], [1.2, "surprised"], [2.2, "happy"], [3.6, "uwu"]], t);
    const fly = prog(t, 0.2, 1.3), hold = prog(t, 1.2, 1.5);
    const pose = add(ex.pose, life(t), { arm_R: { rot: deg(24) * hold }, arm_L: { rot: -deg(24) * hold } }, jump(t, 3.1, 40, 0.6));
    return {
      tint: UWU.PALETTE.pink,
      cam: { z: 1 + 0.08 * easeInOut(prog(t, 1.2, 2.4)), x: 0, y: 40 * easeInOut(prog(t, 1.2, 2.4)), r: 0 },
      pose, face: blink(ex.face, t, [0.6]),
      front() {
        const [hx, hy] = hand("R", pose), [lx, ly] = hand("L", pose);
        const ex2 = (hx + lx) / 2, ey = (hy + ly) / 2 + 40;
        const x = lerp(-640, ex2, easeOut(fly)), y = lerp(-420, ey, easeOut(fly)) - Math.sin(fly * Math.PI) * 160;
        const flap = Math.sin(t * 22) * (1 - fly);
        PROPS.at(x, y, lerp(-0.6, 0, easeOut(fly)) + 0.1 * flap, 0.8, () => PROPS.envelope(easeInOut(prog(t, 1.8, 2.3)), easeOut(prog(t, 2.2, 2.9))));
        if (t > 2.6) for (let i = 0; i < 3; i++) {
          const u = ((t - 2.6) * 0.6 + i * 0.33) % 1;
          PROPS.at(ex2 + Math.sin(i * 2 + u * 6) * 60 + (i - 1) * 110, ey - 260 - u * 260, 0, 1 - u * 0.6, () => PROPS.heart(18));
        }
      },
    };
  });

  def("payment_done", "تم الدفع", 4.6, (t) => {
    const ex = track([[0, "neutral"], [1.25, "surprised"], [1.9, "happy"]], t);
    const swipe = easeInOut(prog(t, 0.3, 1.1));
    const pose = add(ex.pose, life(t), jump(t, 2.0, 80), jump(t, 3.0, 50, 0.6));
    return {
      tint: PROPS.C.mint,
      cam: { z: 1 + 0.06 * elastic(prog(t, 1.25, 1.9)), x: 0, y: 10, r: deg(2) * Math.sin(prog(t, 1.25, 1.6) * Math.PI) },
      pose, face: blink(ex.face, t, [0.5]),
      back() {
        if (t < 1.4) PROPS.at(lerp(-520, 420, swipe), -260, deg(-12), 1.1, () => PROPS.card(PROPS.C.sky));
      },
      front() {
        if (t > 1.2) PROPS.at(260, -420 + 20 * Math.sin(t * 2), 0, elastic(prog(t, 1.2, 1.8)) * 1.1, () => PROPS.badge("check", prog(t, 1.4, 1.9)));
        for (let i = 0; i < 6; i++) {
          const u = prog(t, 1.5 + i * 0.07, 2.6 + i * 0.07);
          if (u <= 0 || u >= 1) continue;
          const a = -Math.PI / 2 + (i - 2.5) * 0.45;
          PROPS.at(Math.cos(a) * 420 * u, -250 + Math.sin(a) * 260 * u + 420 * u * u, u * 8, 1, () => PROPS.coin(22));
        }
        confetti(t, 1.6, 30, 0, -380, 520);
      },
    };
  });

  def("problem", "يوجد مشكلة", 4.4, (t) => {
    const ex = track([[0, "neutral"], [1.0, "surprised"], [2.0, "sad"], [3.4, "shy"]], t);
    const drop = prog(t, 0.65, 1.05), impact = t > 1.05 && t < 1.4 ? Math.sin((t - 1.05) * 60) * 10 * (1 - (t - 1.05) / 0.35) : 0;
    const pose = add(ex.pose, life(t), t > 1.0 && t < 1.6 ? shake(t, 5) : {}, { root: { dx: -40 } });
    return {
      tint: PROPS.C.gold,
      cam: { z: 1.02 + 0.06 * easeInOut(prog(t, 1.4, 3.0)), x: impact, y: impact * 0.5, r: deg(0.6) * impact / 10 },
      pose, face: blink(ex.face, t, [0.4, 3.0]),
      front() {
        const y = drop < 1 ? lerp(-760, -210, easeIn(drop)) : -210 - 40 * Math.abs(Math.sin((t - 1.05) * 7)) * Math.exp(-(t - 1.05) * 4);
        PROPS.at(270, y, deg(6) * Math.sin(t * 2), 1.4, () => PROPS.warning());
        if (t > 2.0) { const u = ((t - 2) * 0.9) % 1; const [sx, sy] = rig(-140, -320, pose); PROPS.at(sx, sy + 40 * u, 0, 1, () => PROPS.sweat(11)); }
      },
    };
  });

  def("connect_accounts", "قم بربط الحسابات", 5.2, (t) => {
    const ex = track([[0, "neutral"], [2.4, "surprised"], [2.9, "happy"]], t);
    const pull = easeInOut(prog(t, 0.8, 2.3));
    const pose = add(ex.pose, life(t), {
      arm_R: { rot: deg(12) + deg(22) * pull, dx: 8 * pull }, arm_L: { rot: -deg(12) - deg(22) * pull, dx: -8 * pull },
    }, jump(t, 3.2, 60, 0.65));
    return {
      tint: PROPS.C.sky,
      cam: { z: 1 + 0.06 * easeInOut(prog(t, 2.0, 2.6)), x: 0, y: 30, r: 0 },
      pose, face: blink(ex.face, t, [0.5]),
      back() {
        PROPS.at(-380, -230, 0, 1, () => PROPS.account(UWU.PALETTE.lavender));
        PROPS.at(380, -230, 0, 1, () => PROPS.account(UWU.PALETTE.pink));
      },
      front() {
        const [rx, ry] = hand("R", pose), [lx, ly] = hand("L", pose);
        const meet = [0, 60 + 20 * (1 - pull)];
        const endR = [lerp(rx, meet[0] - 30, pull), lerp(ry, meet[1], pull)], endL = [lerp(lx, meet[0] + 30, pull), lerp(ly, meet[1], pull)];
        PROPS.cable(UWU.kit.smooth([[-330, -230], [-260, -80], endR], false, 6), UWU.PALETTE.purple);
        PROPS.cable(UWU.kit.smooth([[330, -230], [260, -80], endL], false, 6), UWU.PALETTE.purple);
        PROPS.at(endR[0], endR[1], 0, 0.8, () => PROPS.plug(UWU.PALETTE.lavender));
        PROPS.at(endL[0], endL[1], Math.PI, 0.8, () => PROPS.socket(UWU.PALETTE.pink));
        if (t > 2.3 && t < 2.9) PROPS.at(meet[0], meet[1], t * 3, 1 + (t - 2.3), () => PROPS.spark(40));
        if (t > 2.6) PROPS.at(0, -420, 0, elastic(prog(t, 2.6, 3.2)) * 0.9, () => PROPS.badge("check", prog(t, 2.8, 3.2)));
      },
    };
  });

  def("factory_problem", "مشكلة في المصنع", 5.6, (t) => {
    const jam = prog(t, 1.4, 1.6);
    const ex = track([[0, "neutral"], [1.6, "surprised"], [2.6, "sad"]], t);
    const pose = add(ex.pose, life(t), { root: { dx: 210 }, arm_L: { rot: -deg(20) } }, t > 1.6 && t < 2.2 ? shake(t, 4) : {}, t > 3.2 ? { arm_L: { rot: -deg(14) * Math.sin(t * 7) } } : {});
    return {
      tint: PROPS.C.smoke,
      cam: { z: 0.98 + 0.08 * easeInOut(prog(t, 1.6, 4.0)), x: -40 * easeInOut(prog(t, 1.6, 4.0)), y: 20, r: jam > 0 && t < 2 ? deg(0.8) * Math.sin(t * 50) : 0 },
      pose, face: blink(ex.face, t, [0.8]),
      back() {
        PROPS.at(-210, G - 10, 0, 0.95, () => PROPS.factory(jam));
        const spin = t < 1.5 ? t * 2.2 : 1.5 * 2.2 + 0.05 * Math.sin(t * 40) * (t < 2.2 ? 1 : 0.2);
        PROPS.at(-330, G - 330, spin, 0.75, () => PROPS.gear(46, 8));
        PROPS.at(-250, G - 300, -spin * 1.3 + 0.3, 0.6, () => PROPS.gear(40, 7, UWU.PALETTE.lavender));
        for (let i = 0; i < 5; i++) {
          const u = ((t * 0.45 + i / 5) % 1);
          PROPS.at(-40 + 30 * Math.sin(u * 5 + i) + u * 40, G - 380 - u * 260, 0, 0.5 + u * 0.7, () => PROPS.puff(30, t > 1.6 ? "#6c5b67" : "#d9cdd4", 200 * (1 - u)));
        }
      },
      front() {
        const [hx, hy] = hand("L", pose, 0);
        PROPS.at(hx, hy, deg(-30) + (t > 3.2 ? 0.3 * Math.sin(t * 7) : 0), 0.9, () => PROPS.wrench());
        if (t > 1.6) PROPS.at(-230, G - 560 + 10 * Math.sin(t * 3), 0, elastic(prog(t, 1.6, 2.1)) * 0.8, () => PROPS.warning(60));
      },
    };
  });

  // integration problems: same story, different service and a different break each time
  function integration(id, title, name, color, style) {
    def(id, title, 4.8, (t) => {
      const brk = 1.4;
      const ex = track(style === "snap"
        ? [[0, "neutral"], [brk, "surprised"], [2.3, "sad"]]
        : style === "pop" ? [[0, "neutral"], [brk, "surprised"], [2.2, "shy"]]
        : [[0, "neutral"], [brk + 0.2, "sad"], [3.2, "surprised"]], t);
      const tug = style === "snap" ? -deg(16) * Math.sin(prog(t, 0.9, brk) * Math.PI) : 0;
      const retry = t > 2.6 ? Math.max(0, Math.sin((t - 2.6) * 3.2)) : 0;
      const pose = add(ex.pose, life(t), { root: { dx: -150 }, arm_L: { rot: -deg(26) + tug - deg(18) * retry } }, t > brk && t < brk + 0.5 ? shake(t, 4) : {});
      return {
        tint: color,
        cam: { z: 1 + 0.05 * easeInOut(prog(t, brk - 0.2, brk + 1)), x: -30 * easeInOut(prog(t, brk - 0.2, brk + 1)), y: 10, r: t > brk && t < brk + 0.3 ? deg(1) * Math.sin(t * 60) : 0 },
        pose, face: blink(ex.face, t, [0.6]),
        back() {
          const shakeTag = style === "glitch" && t > brk ? 6 * Math.sin(t * 40) * Math.exp(-(t - brk) * 2) : 0;
          PROPS.at(300 + shakeTag, -330, deg(-3), 1.1, () => PROPS.tag(name, color, name.length > 4 ? 190 : 150));
          PROPS.at(300, -200, -Math.PI / 2, 1, () => PROPS.socket(UWU.PALETTE.lavender));
        },
        front() {
          const [hx, hy] = hand("L", pose);
          const sock = [300, -170];
          const off = t < brk ? 0 : easeOut(prog(t, brk, brk + 0.5));
          let plugAt;
          if (style === "pop") plugAt = [lerp(sock[0], sock[0] - 120, off), lerp(sock[1], sock[1] + 60, off) - Math.sin(off * Math.PI) * 120];
          else if (style === "snap") plugAt = [lerp(sock[0], sock[0] - 40, off), lerp(sock[1], sock[1] + 140, off)];
          else plugAt = [sock[0] - 30 * off + 4 * Math.sin(t * 50) * (t > brk ? Math.exp(-(t - brk)) : 0), sock[1] + 20 * off];
          if (style === "snap" && t > brk) {
            PROPS.cable(UWU.kit.smooth([[hx, hy], [hx + 80, hy + 40], [lerp(hx, plugAt[0], 0.5), lerp(hy, plugAt[1], 0.5) + 60 * off]], false, 5));
            PROPS.cable(UWU.kit.smooth([[plugAt[0] - 60, plugAt[1] + 50], [plugAt[0] - 30, plugAt[1] + 30], plugAt], false, 5));
          } else {
            PROPS.cable(UWU.kit.smooth([[hx, hy], [lerp(hx, plugAt[0], 0.5), Math.max(hy, plugAt[1]) + 90], plugAt], false, 6));
          }
          PROPS.at(plugAt[0], plugAt[1], -Math.PI / 2 + (style === "pop" ? off * 2.4 : 0), 0.9, () => PROPS.plug(UWU.PALETTE.pink));
          if (t > brk - 0.05 && t < brk + 0.45) PROPS.at(sock[0] - 10, sock[1] + 10, t * 4, 0.8 + (t - brk) * 2, () => PROPS.spark(42, style === "glitch" ? PROPS.C.sky : PROPS.C.gold));
          if (t > brk + 0.3) PROPS.at(130, -420, 0, elastic(prog(t, brk + 0.3, brk + 0.8)) * 0.9, () => PROPS.badge("cross", prog(t, brk + 0.5, brk + 0.9)));
          if (t > 2.4 && style !== "pop") { const u = ((t - 2.4) * 0.9) % 1; const [sx, sy] = rig(-140, -320, pose); PROPS.at(sx, sy + 40 * u, 0, 1, () => PROPS.sweat(10)); }
        },
      };
    });
  }
  integration("n8n_problem", "مشكلة في ربط N8N", "n8n", "#e66a8a", "pop");
  integration("zapier_problem", "مشكلة في ربط Zapier", "Zapier", "#f08a4b", "snap");
  integration("albato_problem", "مشكلة في ربط Albato", "Albato", "#7d73d9", "glitch");

  def("project_success", "نجاح المشروع", 5.6, (t) => {
    const ex = track([[0, "neutral"], [0.9, "surprised"], [1.8, "happy"], [4.2, "uwu"]], t);
    const launch = prog(t, 0.6, 2.4);
    const pose = add(ex.pose, life(t), { head: { rot: -deg(6) * Math.sin(launch * Math.PI) }, face: { dy: -4 * Math.sin(launch * Math.PI) } }, jump(t, 2.2, 90), jump(t, 3.1, 70, 0.7), t > 3.9 ? wave(t, "R") : {});
    return {
      tint: PROPS.C.gold,
      cam: { z: 1 + 0.05 * Math.sin(launch * Math.PI), x: 0, y: 120 * Math.sin(launch * Math.PI) * 0.6, r: 0 },
      pose, face: blink(ex.face, t, [0.3]),
      back() {
        const y = G - 120 - 1500 * easeIn(launch);
        if (y > -900) PROPS.at(-330, y, deg(8), 1, () => PROPS.rocket(launch > 0 ? 1 : 0.2));
        if (launch > 0 && launch < 1) for (let i = 0; i < 4; i++) PROPS.at(-330 + (hash(i) - 0.5) * 60, y + 120 + i * 50, 0, 0.6 + i * 0.2, () => PROPS.puff(26, "#e9dfe6", 180 - i * 40));
      },
      front() {
        if (t > 1.7) PROPS.at(330, G - 10, 0, elastic(prog(t, 1.7, 2.3)) * 1.3, () => PROPS.trophy());
        confetti(t, 1.8, 40, 0, -420, 560);
        if (t > 2.4) for (let i = 0; i < 3; i++) PROPS.at(330 + Math.cos(t * 2 + i * 2) * 110, G - 230 + Math.sin(t * 2 + i * 2) * 50, 0, 0.6 + 0.3 * Math.sin(t * 6 + i), () => PROPS.sparkle(16));
      },
    };
  });

  def("results", "النتائج", 5.2, (t) => {
    const grow = easeOut(prog(t, 0.6, 2.4)), arrow = easeInOut(prog(t, 1.8, 2.8));
    const ex = track([[0, "neutral"], [2.6, "surprised"], [3.3, "happy"]], t);
    const point = easeInOut(prog(t, 2.4, 2.8));
    const pose = add(ex.pose, life(t), { root: { dx: -220 }, arm_L: { rot: -deg(35) * point }, head: { rot: deg(5) * point } }, jump(t, 3.5, 50, 0.6));
    return {
      tint: PROPS.C.mint,
      cam: { z: 1 + 0.06 * easeInOut(prog(t, 2.2, 3.2)), x: 30 * easeInOut(prog(t, 2.2, 3.2)), y: 20, r: 0 },
      pose, face: blink(ex.face, t, [0.7]),
      back() {
        PROPS.at(200, G - 20, 0, 0.95, () => { PROPS.chart(grow); PROPS.arrowUp(arrow); });
      },
      front() {
        if (t > 2.8) for (let i = 0; i < 3; i++) PROPS.at(200 + 110 * 1.52 + Math.cos(t * 3 + i * 2) * 50, G - 20 - 190 * 1.52 + Math.sin(t * 3 + i * 2) * 40, 0, 0.6 + 0.3 * Math.sin(t * 6 + i), () => PROPS.sparkle(16));
      },
    };
  });

  return { SCENES, S, G, add, track, life, blink, jump, wave, shake, hand, rig, prog, easeInOut, easeOut, back, elastic, confetti };
})();

// Draws one frame of a scene.
const SCENE_RUNNER = {
  frame(id, t, { quality = "fast", seed } = {}) {
    const sc = UWU_SCENES.SCENES[id];
    const st = sc.fn(t);
    const cam = { x: 0, y: 0, z: 1, r: 0, ...(st.cam || {}) };
    background("#f9f1e6");
    UWU.kit.ready();
    UWU.kit.setQuality(quality);
    push();
    try {
      // soft coloured glow behind the character
      UWU.kit.setSeed(7);
      for (let i = 0; i < 9; i++) { const r = 520 - i * 38; UWU.kit.wash(UWU.kit.ellipse(0, -60, r, r * 0.92, 56), st.tint || UWU.PALETTE.lavender, 13); }
      translate(cam.x, cam.y);
      scale(cam.z);
      rotate(cam.r);
      UWU.kit.setSeed(11 + (Math.floor(t * 6) % 3));
      PROPS.setSize(1.6);
      if (st.back) st.back();
      UWU.draw(0, UWU_SCENES.G, UWU_SCENES.S, { pose: st.pose, face: st.face, seed: seed ?? 19 + (Math.floor(t * 6) % 3), quality });
      UWU.kit.setSeed(13 + (Math.floor(t * 6) % 3));
      if (st.front) st.front();
    } finally {
      PROPS.setSize(1);
      pop();
    }
  },
};
