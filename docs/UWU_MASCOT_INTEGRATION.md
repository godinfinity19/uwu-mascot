# UwU mascot: integration guide for developers and AI coding agents

This file is the single reference for anyone (human or model) wiring the UwU mascot into the UwU MATE website. Read it fully before touching mascot code.

## 1. What exists

| Asset | Path | Use |
|---|---|---|
| Web component | `web/uwu-status.js` | `<uwu-status>` custom element; the only thing the site needs to load |
| Loop files | `web/loops/<state>.{webm,-256.webm,webp,png}` | 22 pre-rendered, seamless, transparent loops (60 fps) |
| Demo page | `web/demo.html` | Working examples: checkout, project run, account, integrations, AI chat, 404 |
| Drawing source | `src/uwu.js`, `src/uwu_loops.js` | p5.brush rig and loop definitions. **Do not run on the site**; only used to re-render the loops |
| Spec | `docs/UWU_RIG_SPEC.md` (§10) | Rig, identity rules, loop maths, per-loop beat map |
| Promo videos | `docs/renders/ads/*.mp4`, `docs/renders/film/*.mp4` | Plain mp4 for landing page / social |

## 2. Install

Copy into the site's static folder, keeping the structure:

```
public/uwu/uwu-status.js
public/uwu/loops/<all files from web/loops>
```

The script looks for `loops/` next to itself. If you host the loops elsewhere, pass `src="/cdn/path/loops/"` on the element.

## 3. API

```html
<script src="/uwu/uwu-status.js"></script>
<uwu-status state="welcome" size="160"></uwu-status>
```

| Attribute / property | Type | Default | Notes |
|---|---|---|---|
| `state` | string (see §4) | `welcome` | Set as attribute or `el.state = "..."`. Unknown values fall back to `welcome`. |
| `size` | number (px) or CSS length | `160` | Square box. Mascot is designed to read at 80–320 px. |
| `src` | URL of the loops folder | `./loops/` next to the script | Trailing slash optional. |
| `label` | string | Arabic title of the state | Overrides `aria-label`. |

Global JS: `window.UwuStatus.STATES` is a map from state id to Arabic title.

Behaviour you get for free (do not reimplement):
- Changing `state` crossfades to the new loop (160 ms).
- Chrome/Edge/Firefox get VP9 WebM with alpha. The 256 px file is picked when the displayed size × devicePixelRatio ≤ 270.
- Safari / iOS get the animated WebP.
- `prefers-reduced-motion` gets the still PNG.
- Players pause when off-screen (IntersectionObserver).
- `role="img"` and an aria-label are set automatically.

Overrides (rarely needed): `window.UWU_STATUS_FORMAT = "webp"` forces images everywhere. `window.UWU_STATUS_SOURCES = { state: { webm, webm256, webp, png } }` replaces file URLs (e.g. for a CDN with hashed names).

## 4. States: what each one means and when to use it

| state | Product meaning | Trigger it when | What the user sees |
|---|---|---|---|
| `welcome` | Hello / idle | Landing, onboarding, empty states, after logout | Waves, heart icon pulses |
| `working` | Processing | Any request in flight > ~400 ms, saving, running a job | Focused, typing; gear ticks with a spinner |
| `success` | Done | Generic action completed | Jumps, check icon pops |
| `payment_done` | Payment confirmed | Checkout returns paid | Tosses a coin and cheers |
| `subscription` | Premium | Plan upgraded / premium area | Proud puff, crown glints |
| `offers` | Promotion | Discount banners, pricing page deals | Bounces, % tag swings, confetti |
| `login` | Authenticated | Sign-in success, unlock, 2FA ok | Lock rattles then opens |
| `email` | Mail | "Check your inbox", verification sent, new message | Envelope wiggles with a badge |
| `connect_accounts` | Linked | OAuth / integration connected | Two links click together |
| `results` | Insights ready | Reports, analytics, run output ready | Bar chart grows |
| `project_success` | Milestone | Project finished, big goal reached | Big jump, trophy, confetti |
| `problem` | Generic error / warning | Any failure without a more specific state | Startles, then worries; warning icon |
| `error404` | Not found | 404 page, empty search | Looks left and right; "?" marks |
| `factory_problem` | Production / pipeline failure | Factory, line or batch job down | Factory icon smokes, gear falls |
| `n8n_problem` | n8n connection failed | Integration error source = n8n | n8n pill with red ✕ |
| `zapier_problem` | Zapier connection failed | Integration error source = Zapier | Zapier pill swings, snapped |
| `albato_problem` | Albato connection failed | Integration error source = Albato | Albato pill glitches |
| `ai_idle` | Assistant ready | Chat widget open, nothing typed | Floats, sparkle icon |
| `ai_listening` | User input | User typing or speaking | Tuft perks up, sound waves |
| `ai_thinking` | Waiting for model | Request sent, no tokens yet | Looks up, "…" bubbles |
| `ai_speaking` | Answer streaming | First token received until stream ends | Talks; speech bubble types |
| `ai_error` | Assistant failed | Model / network error in chat | Glitches, sad; red ✕ |

Each loop is 3–5 s and repeats seamlessly, so a state can stay on screen indefinitely.

## 5. Rules for agents writing code against the mascot

1. **One mascot per view** in normal UI. Grids are fine only on showcase pages.
2. **Always end in a resting state.** Event states (`success`, `payment_done`, `problem`, …) should go back to a calm state (`welcome`, `ai_idle`, the page default) after 3–5 s unless the screen is a result page.
3. **Don't flicker.** Do not switch to `working` for requests shorter than ~400 ms; debounce state changes to ≥ 300 ms.
4. **Pick the most specific state.** Integration error from n8n → `n8n_problem`, not `problem`.
5. **The mascot never replaces text.** Every state must be accompanied by a visible message (errors especially), because the mascot is decorative (`role="img"`).
6. **Size:** 80–120 px inline (lists, chat avatar), 160–200 px in cards/modals, up to 320 px for hero / 404. Never stretch non-square.
7. **Backgrounds:** loops are transparent and work on light and dark themes. Do not add borders or a background colour to the element.
8. **Don't edit the loop files or re-encode them.** To change art or timing, edit `src/uwu_loops.js` and re-render (see §8).
9. **Identity is fixed:** cream body, big pink-purple spiral curl + crown tuft + side tuft, purple eyes, orange 4-point star on the right cheek, fluffy ruff, tail. Never recolour, flip or crop the mascot.

## 6. Recipes

Vanilla:
```js
const uwu = document.querySelector("uwu-status");
const rest = "welcome";
let timer;
function show(state, ms = 4000) {
  clearTimeout(timer);
  uwu.state = state;
  if (ms) timer = setTimeout(() => (uwu.state = rest), ms);
}

async function pay() {
  const slow = setTimeout(() => (uwu.state = "working"), 400);
  try { await api.checkout(); show("payment_done"); }
  catch { show("problem", 6000); }
  finally { clearTimeout(slow); }
}
```

Integration errors:
```js
const BY_SOURCE = { n8n: "n8n_problem", zapier: "zapier_problem", albato: "albato_problem", factory: "factory_problem" };
show(BY_SOURCE[err.source] ?? "problem", 0); // stays until the user fixes it
```

AI chat:
```js
input.addEventListener("input", () => uwu.state = "ai_listening");
async function send(msg) {
  uwu.state = "ai_thinking";
  try {
    for await (const chunk of streamAnswer(msg)) { uwu.state = "ai_speaking"; render(chunk); }
    uwu.state = "ai_idle";
  } catch { uwu.state = "ai_error"; }
}
```

React / Next.js:
```jsx
"use client";
import { useEffect } from "react";
export default function Uwu({ state, size = 160 }) {
  useEffect(() => { if (!customElements.get("uwu-status")) { const s = document.createElement("script"); s.src = "/uwu/uwu-status.js"; document.head.append(s); } }, []);
  return <uwu-status state={state} size={String(size)} />;
}
```
TypeScript: declare the element once:
```ts
declare global { namespace JSX { interface IntrinsicElements { "uwu-status": { state?: string; size?: string | number; src?: string; label?: string } } } }
```

## 7. Performance

- Each player decodes one video. Keep ≤ ~6 visible at once on mobile.
- Preload the next likely state on hover/intent: `new Image().src = "/uwu/loops/payment_done.webp"` (Safari) or a hidden `<link rel="preload" as="video">`.
- Total size of all loops is ~38 MB; a single page normally loads one or two states (~0.3–0.7 MB each).

## 8. Re-rendering the loops (maintainers only)

1. Edit timing or art in `src/uwu_loops.js` (each state is a `def(...)`; spec §10 explains beats and maths).
2. Preview live: `preview/uwu-loops.html?loop=<state>`.
3. Export frames on black and white with `preview/uwu-loops.html?loop=<state>&still` (`renderFrame(n, "black"|"white")`), build alpha with the difference matte (`α = 1 − mean(W − B)/255`, `C = B/α`), then encode WebM VP9 alpha (512 and 256), animated WebP (320), poster PNG.
4. Check that the last frame joins the first and that nothing comes within ~20 px of the edge.

Note: `src/uwu_loops.js` currently runs every loop at half speed (`SLOW = 2`). The files in `web/loops/` still need re-exporting at that speed.
