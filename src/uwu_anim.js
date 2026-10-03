// UwU expression reel: blends between the six expressions over time.
// Needs src/uwu.js. UWU_ANIM.state(t) gives { pose, face, seed } for time t in seconds.

const UWU_ANIM = (() => {
  const FPS = 24;
  // [expression, hold seconds]; each change takes BLEND seconds.
  const SEQUENCE = [["neutral", 1.6], ["happy", 1.6], ["neutral", 0.9], ["uwu", 1.6], ["surprised", 1.4], ["sad", 1.8], ["shy", 1.8], ["neutral", 1.2]];
  const BLEND = 0.45;
  const CURL_LAG = 0.12; // the curl follows the head a few frames late

  const segments = [];
  let t0 = 0;
  for (const [name, hold] of SEQUENCE) {
    segments.push({ name, start: t0, hold });
    t0 += hold + BLEND;
  }
  const DURATION = t0 - BLEND;

  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOutBack = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
  const lerp = (a, b, k) => a + (b - a) * k;

  // Expression pair and blend amount at time t.
  function at(t) {
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i], next = segments[i + 1];
      if (!next || t < s.start + s.hold) return [s.name, s.name, 0];
      if (t < next.start) return [s.name, next.name, (t - s.start - s.hold) / BLEND];
    }
    return ["neutral", "neutral", 0];
  }

  function blendPose(a, b, k) {
    const out = {};
    for (const part of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const pa = a[part] || {}, pb = b[part] || {}, t = {};
      for (const f of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
        const id = f === "sx" || f === "sy" ? 1 : 0;
        t[f] = lerp(pa[f] ?? id, pb[f] ?? id, k);
      }
      out[part] = t;
    }
    return out;
  }

  function blendFace(fa, fb, k) {
    const A = UWU.fullFace(fa), B = UWU.fullFace(fb);
    const eye = {};
    // shape changes go through a squint: the first half closes the old shape, the second opens the new one
    if (A.eye.shape !== B.eye.shape) {
      const first = k < 0.5, src = first ? A.eye : B.eye, h = first ? k * 2 : (1 - k) * 2;
      Object.assign(eye, src, { open: lerp(src.open, 0.12, h) });
    } else {
      Object.assign(eye, A.eye, {
        open: lerp(A.eye.open, B.eye.open, k), iris: lerp(A.eye.iris, B.eye.iris, k),
        gaze: [lerp(A.eye.gaze[0], B.eye.gaze[0], k), lerp(A.eye.gaze[1], B.eye.gaze[1], k)],
        shine: k < 0.5 ? A.eye.shine : B.eye.shine,
      });
    }
    const m = k < 0.5 ? A.mouth : B.mouth;
    const squeeze = A.mouth.shape !== B.mouth.shape ? 1 - 0.5 * Math.sin(Math.PI * k) : 1;
    return {
      eye,
      brow: { dy: lerp(A.brow.dy, B.brow.dy, k), tilt: lerp(A.brow.tilt, B.brow.tilt, k) },
      mouth: { shape: m.shape, width: lerp(A.mouth.width, B.mouth.width, k) * squeeze, open: lerp(A.mouth.open, B.mouth.open, k) },
      blush: lerp(A.blush, B.blush, k),
      star: lerp(A.star, B.star, k),
    };
  }

  function state(t) {
    const [na, nb, raw] = at(t);
    const E = UWU.EXPRESSIONS, k = easeInOut(Math.min(1, Math.max(0, raw)));
    const pose = blendPose(E[na].pose, E[nb].pose, k);
    const face = blendFace(E[na].face, E[nb].face, k);

    // curl follow-through: it lags the rest and overshoots a little before settling
    const [ca, cb, craw] = at(Math.max(0, t - CURL_LAG));
    const ck = easeOutBack(Math.min(1, Math.max(0, craw)));
    const curlRot = lerp((E[ca].pose.curl || {}).rot || 0, (E[cb].pose.curl || {}).rot || 0, ck);
    pose.curl = { ...(pose.curl || {}), rot: curlRot + 0.03 * Math.sin(t * 2.1) };

    // idle life: breathing, a little sway of the side tuft and tail
    const breath = Math.sin(t * 2 * Math.PI / 2.6);
    pose.body = { ...(pose.body || {}), sy: (pose.body?.sy ?? 1) * (1 + 0.012 * breath), sx: (pose.body?.sx ?? 1) * (1 - 0.008 * breath) };
    pose.ruff = { sy: 1 + 0.02 * breath };
    pose.tuft_L = { ...(pose.tuft_L || {}), rot: (pose.tuft_L?.rot || 0) + 0.035 * Math.sin(t * 2.4 + 1) };
    pose.tail = { ...(pose.tail || {}), rot: (pose.tail?.rot || 0) + 0.08 * Math.sin(t * 3.1) };

    // blinks on the open-eyed holds
    for (const bt of [1.0, 4.6, 9.9, 12.4]) {
      const d = Math.abs(t - bt);
      if (d < 0.09 && face.eye.shape === "open") face.eye = { ...face.eye, open: Math.min(face.eye.open, 0.1 + d * 9) };
    }

    // hand-drawn "boil": the line texture changes 6 times a second
    const seed = 19 + (Math.floor(t * 6) % 3);
    return { pose, face, seed };
  }

  return { FPS, DURATION, SEQUENCE, state, blendPose, blendFace, easeInOut, easeOutBack };
})();
