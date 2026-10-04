# UwU status loops for the website

22 short loops at 60 fps on a transparent background. In each one, UwU acts out a product state, a small icon chip sits above the head, and a few light effects play around it. Each loop's last frame joins its first, so it can repeat with no visible cut.

```html
<script src="/uwu/uwu-status.js"></script>

<uwu-status state="working" size="160"></uwu-status>

<script>
  // switch state from code (160 ms crossfade)
  document.querySelector("uwu-status").state = "payment_done";
</script>
```

| File in `loops/` | Use |
|---|---|
| `<state>.webm` | VP9 with alpha, 512 px: Chrome, Edge, Firefox |
| `<state>-256.webm` | VP9 with alpha, 256 px: picked automatically for small players |
| `<state>.webp` | animated WebP with alpha, 320 px: Safari / iOS |
| `<state>.png` | still frame: `prefers-reduced-motion`, poster |

The `<uwu-status>` element:

- picks the right file for the browser and the displayed size;
- pauses players that are off-screen;
- sets `role="img"` and an Arabic `aria-label`.

Pass `src="/path/to/loops/"` when the loop files are not next to the script.

## States

| state | when | T |
|---|---|---|
| `welcome` | landing, onboarding, empty state | 2 s |
| `working` | processing, saving, running a job | 1.5 s |
| `success` | any action done | 1.5 s |
| `payment_done` | after checkout | 2 s |
| `subscription` | premium / plan upgraded | 2 s |
| `offers` | discounts, promo banners | 1.5 s |
| `login` | sign-in, unlocked | 2 s |
| `email` | check your inbox, new message | 1.5 s |
| `connect_accounts` | linking accounts, integrations connected | 2 s |
| `results` | reports, analytics ready | 2 s |
| `project_success` | project finished / milestone | 2 s |
| `problem` | generic error / warning | 1.5 s |
| `error404` | page not found | 2 s |
| `factory_problem` | production line / factory issue | 2 s |
| `n8n_problem` | n8n connection failed | 2 s |
| `zapier_problem` | Zapier connection failed | 2 s |
| `albato_problem` | Albato connection failed | 2 s |
| `ai_idle` | assistant ready | 2.5 s |
| `ai_listening` | user typing / speaking | 1.5 s |
| `ai_thinking` | waiting for the answer | 1.5 s |
| `ai_speaking` | streaming the answer | 1.5 s |
| `ai_error` | assistant failed | 1.5 s |

`demo.html` shows the loops inside mock pages: checkout, a project run, account, integrations, an AI chat and a 404 page.

The drawing code is in `src/uwu_loops.js`. Timing and beats are documented in `docs/UWU_RIG_SPEC.md` §10. You can preview a loop live at `preview/uwu-loops.html?loop=<state>`.
