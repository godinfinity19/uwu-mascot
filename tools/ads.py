#!/usr/bin/env python3
"""UwU MATE promo ads, built from the rendered 60 fps status loops (RGBA 720 frames).

    python3 tools/ads.py <loops720Dir> <outDir> [adId,...|all] [landscape,vertical]

Each ad is 6 s at 60 fps: two or three scenes, each a status loop with an English
headline, then an end card with the stacked "UwU / MATE" logo, a tagline and a CTA.
Every ad has its own palette and transition style.
"""
import math, os, subprocess, sys
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FPS, DUR = 60, 6.0
N = int(FPS * DUR)
END = 4.1  # end card starts here (s)
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


# ---------------------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def out_cubic(x): x = clamp(x); return 1 - (1 - x) ** 3
def in_cubic(x): x = clamp(x); return x ** 3
def sine(x): x = clamp(x); return 0.5 - 0.5 * math.cos(math.pi * x)
def out_back(x, s=1.9): x = clamp(x) - 1; return 1 + (s + 1) * x ** 3 + s * x ** 2
def lerp(a, b, k): return a + (b - a) * k
def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


# ---------------------------------------------------------------------------- ads
# scenes: (loop, headline); the scenes share the time before the end card equally
ADS = [
    dict(id="01_meet", scenes=[("welcome", "Say hi to your\nnew mate."), ("ai_speaking", "It talks. It helps.\nIt's adorable.")],
         tag="Your cute AI teammate.", pal=("#fde4ec", "#f6c3d5", "#e2557f"), style="slide"),
    dict(id="02_automate", scenes=[("working", "Your workflows,\nrunning."), ("success", "Done. Every\nsingle time.")],
         tag="Automation with a smile.", pal=("#e3f0fb", "#bcd8f3", "#3f7fc4"), style="zoom"),
    dict(id="03_integrations", scenes=[("n8n_problem", "n8n broke?"), ("zapier_problem", "Zapier snapped?"), ("connect_accounts", "MATE reconnects\nit for you.")],
         tag="Every integration, handled.", pal=("#2b2140", "#3d2d5c", "#ff8fb3"), style="wipe", dark=True),
    dict(id="04_payments", scenes=[("payment_done", "Payment\nreceived!"), ("success", "Confirmed\ninstantly.")],
         tag="Get paid. Stay calm.", pal=("#fff3dc", "#fbd99a", "#d98a14"), style="drop"),
    dict(id="05_premium", scenes=[("subscription", "Go Premium."), ("project_success", "Unlock\neverything.")],
         tag="More power. Same cuteness.", pal=("#241a3a", "#4a2f78", "#c9a4ff"), style="iris", dark=True),
    dict(id="06_offers", scenes=[("offers", "Big deals.\nTiny price."), ("payment_done", "Grab it\ntoday.")],
         tag="Limited-time offer.", pal=("#ffe0ef", "#ffb3d4", "#d1347c"), style="zoom"),
    dict(id="07_results", scenes=[("results", "Results,\nnot reports."), ("project_success", "Watch your\nnumbers grow.")],
         tag="Insights at a glance.", pal=("#e2f6ec", "#b4e3c8", "#2f9a63"), style="slide"),
    dict(id="08_email", scenes=[("email", "You've got\nmail!"), ("success", "Sorted\nautomatically.")],
         tag="Inbox zero, made cute.", pal=("#fdebf3", "#e9c6f0", "#b54fa8"), style="drop"),
    dict(id="09_ai", scenes=[("ai_listening", "It listens."), ("ai_thinking", "It thinks."), ("ai_speaking", "It answers.")],
         tag="AI that feels like a friend.", pal=("#16213a", "#24365e", "#8fc1ff"), style="iris", dark=True),
    dict(id="10_lost", scenes=[("error404", "Lost?"), ("welcome", "UwU will guide\nyou home.")],
         tag="No more dead ends.", pal=("#ece6fb", "#cfc2f4", "#6a4fc9"), style="wipe"),
    dict(id="11_factory", scenes=[("factory_problem", "Factory\nalert?"), ("working", "MATE is\non it."), ("success", "Back to\nfull speed.")],
         tag="Operations on autopilot.", pal=("#2a1d1f", "#4a2a2e", "#ff8a7a"), style="zoom", dark=True),
    dict(id="12_login", scenes=[("login", "One tap.\nYou're in."), ("welcome", "Welcome\nback!")],
         tag="Secure. Simple. Sweet.", pal=("#e6f7f4", "#bfe8df", "#23907c"), style="iris"),
    dict(id="13_ship", scenes=[("working", "Build."), ("project_success", "Ship."), ("results", "Grow.")],
         tag="From idea to launch.", pal=("#fff0e2", "#ffd2ad", "#e06a1c"), style="slide"),
    dict(id="14_calm", scenes=[("problem", "Problems\nhappen."), ("success", "Panic\ndoesn't.")],
         tag="Stay calm. MATE's got this.", pal=("#1d2433", "#2e3a52", "#ffd166"), style="drop", dark=True),
    dict(id="15_sync", scenes=[("albato_problem", "Glitchy sync?"), ("ai_error", "Random errors?"), ("connect_accounts", "All fixed.")],
         tag="Integrations that just work.", pal=("#e8ecff", "#c4ccff", "#4b5bd6"), style="wipe"),
    dict(id="16_montage", scenes=[("welcome", "Hello."), ("working", "Work."), ("payment_done", "Paid."), ("subscription", "Premium."),
                                  ("results", "Results."), ("connect_accounts", "Connected."), ("ai_speaking", "Smart."), ("project_success", "Win.")],
         tag="One mate for every moment.", pal=("#fff6ea", "#fbe2c8", "#e2557f"), style="cut"),
]


# ---------------------------------------------------------------------------- assets
class Loops:
    def __init__(self, root):
        self.root = root
        self.count = {}

    def frames(self, lid):
        if lid not in self.count:
            self.count[lid] = int(open(os.path.join(self.root, lid, "frames.txt")).read())
        return self.count[lid]

    @lru_cache(maxsize=600)
    def get(self, lid, n, size):
        im = Image.open(os.path.join(self.root, lid, f"f{n % self.frames(lid):04d}.png")).convert("RGBA")
        return im if size == im.width else im.resize((size, size), Image.LANCZOS)


@lru_cache(maxsize=64)
def font(path, size): return ImageFont.truetype(path, size)


def text_img(txt, size, color, path=FONT_B, spacing=1.12, shadow=None, tracking=0):
    """Multi-line text on a transparent image (centred lines); optional soft shadow colour."""
    f = font(path, size)
    lines = txt.split("\n")
    def width(l):
        if not tracking: return f.getbbox(l)[2] - f.getbbox(l)[0]
        return sum(f.getbbox(c)[2] - f.getbbox(c)[0] for c in l) + tracking * (len(l) - 1)
    lh = int(size * spacing)
    w = max(width(l) for l in lines) + size // 2
    h = lh * len(lines) + size // 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, l in enumerate(lines):
        x = (w - width(l)) // 2
        y = size // 4 + i * lh
        if tracking:
            for c in l:
                d.text((x - f.getbbox(c)[0], y), c, font=f, fill=color)
                x += f.getbbox(c)[2] - f.getbbox(c)[0] + tracking
        else:
            d.text((x - f.getbbox(l)[0], y), l, font=f, fill=color)
    if shadow:
        sh = Image.new("RGBA", im.size, shadow + (0,))
        sh.putalpha(im.getchannel("A").filter(ImageFilter.GaussianBlur(size / 14)).point(lambda v: int(v * 0.45)))
        out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        out.alpha_composite(sh, (0, int(size * 0.06)))
        out.alpha_composite(im)
        return out
    return im


def fade(im, a):
    if a >= 0.999: return im
    if a <= 0.001: return None
    im = im.copy()
    im.putalpha(im.getchannel("A").point(lambda v: int(v * a)))
    return im


def place(canvas, im, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if im is None or scale <= 0.01 or alpha <= 0.01: return
    if abs(scale - 1) > 1e-3:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    if rot: im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    im = fade(im, alpha)
    if im is None: return
    canvas.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))


# ---------------------------------------------------------------------------- background
def background(W, H, pal, dark):
    c0, c1 = hexrgb(pal[0]), hexrgb(pal[1])
    g = Image.linear_gradient("L").rotate(-35, expand=True).resize((W, H))
    bg = Image.composite(Image.new("RGB", (W, H), c1), Image.new("RGB", (W, H), c0), g).convert("RGBA")
    # soft vignette towards the edges
    v = Image.radial_gradient("L").resize((W, H)).point(lambda p: int(p * (0.35 if dark else 0.16)))
    bg = Image.composite(Image.new("RGBA", (W, H), (0, 0, 0, 255) if dark else (255, 255, 255, 255)), bg, v) if not dark else Image.composite(Image.new("RGBA", (W, H), (0, 0, 0, 255)), bg, v)
    return bg


def bokeh(W, H, pal, dark, t, seed):
    """large soft circles drifting on whole cycles of the 6 s ad"""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    acc = hexrgb(pal[2])
    for i in range(7):
        h = (math.sin(seed * 12.9 + i * 78.2) * 43758.5) % 1
        r = (0.08 + 0.12 * h) * min(W, H)
        x = ((h * 7.3 + i * 0.37) % 1) * W + 40 * math.sin(2 * math.pi * (t / DUR) + i)
        y = ((h * 3.1 + i * 0.61) % 1) * H - 60 * math.sin(2 * math.pi * (t / DUR) * 1 + i * 1.7)
        col = (255, 255, 255, 34) if not dark else acc + (30,)
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    return layer.filter(ImageFilter.GaussianBlur(min(W, H) / 60))


# ---------------------------------------------------------------------------- logo
def logo(scale, dark, accent):
    ink = (255, 247, 240) if dark else (82, 38, 59)
    uwu = text_img("UwU", int(190 * scale), ink, shadow=hexrgb(accent))
    mate = text_img("MATE", int(78 * scale), hexrgb(accent), tracking=int(26 * scale))
    return uwu, mate


def pill(txt, size, bgc, fg):
    t = text_img(txt, size, fg)
    w, h = t.width + size, int(size * 2.1)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2, fill=bgc + (255,))
    im.alpha_composite(t, ((w - t.width) // 2, (h - t.height) // 2))
    return im


# ---------------------------------------------------------------------------- render
def render(ad, fmt, loops, out):
    land = fmt == "landscape"
    W, H = (1920, 1080) if land else (1080, 1920)
    dark = ad.get("dark", False)
    pal, style = ad["pal"], ad["style"]
    ink = (255, 247, 240) if dark else (82, 38, 59)
    acc = hexrgb(pal[2])
    bg = background(W, H, pal, dark)

    scenes = ad["scenes"]
    k = len(scenes)
    seg = END / k
    msize = 900 if land else 940               # mascot frame size on screen
    mx, my = (W * 0.68, H * 0.52) if land else (W / 2, H * 0.6)
    tx, ty = (W * 0.29, H * 0.47) if land else (W / 2, H * 0.17)
    hsize = 104 if land else 112
    if style == "cut": hsize = 150 if land else 170
    heads = [text_img(h, hsize, ink, shadow=acc if not dark else (0, 0, 0)) for _, h in scenes]
    # underline accent bar under each headline
    uwu, mate = logo(1.0 if land else 1.15, dark, pal[2])
    tag = text_img(ad["tag"], 54 if land else 58, ink, path=FONT_R)
    cta = pill("Try UwU MATE  →", 40 if land else 46, acc, (255, 255, 255))

    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    for n in range(N):
        t = n / FPS
        fr = bg.copy()
        fr.alpha_composite(bokeh(W, H, pal, dark, t, hash(ad["id"]) % 97))

        if t < END + 0.35:
            i = min(k - 1, int(t / seg))
            lt = t - i * seg                       # time inside the scene
            lid = scenes[i][0]
            mf = loops.get(lid, int(lt * FPS), msize)
            # entrance of the scene (0.35 s) and exit (last 0.25 s before the next / end card)
            ein = clamp(lt / 0.35)
            last = i == k - 1
            eout = clamp((lt - (seg - 0.25)) / 0.25) if not last else clamp((t - END) / 0.3)
            if style == "cut" and not last: eout = 0
            sx, sc, al, rot = 0.0, 1.0, 1.0, 0.0
            if style == "slide":
                sx = (1 - out_back(ein, 1.4)) * W * 0.6 - in_cubic(eout) * W * 0.6
            elif style == "zoom":
                sc = lerp(0.55, 1.0, out_back(ein, 2.2)) * lerp(1, 1.4, in_cubic(eout)); al = 1 - eout
            elif style == "drop":
                sx = 0; my_off = -(1 - out_back(ein, 1.6)) * H * 0.8 + in_cubic(eout) * H
            elif style == "iris" or style == "wipe":
                sc = lerp(0.85, 1.0, out_cubic(ein)); al = min(out_cubic(ein * 1.5), 1 - eout)
            elif style == "cut":
                sc = lerp(1.12, 1.0, out_cubic(clamp(lt / 0.2)))
            yoff = my_off if style == "drop" else 0
            place(fr, mf, mx + sx, my + yoff, sc, al, rot)

            # headline: words rise with a stagger
            hi = heads[i]
            tin = clamp((lt - 0.12) / 0.4)
            tout = eout
            if hi is not None:
                hy = ty + (1 - out_back(tin, 1.7)) * 80 - in_cubic(tout) * 60
                place(fr, hi, tx, hy, lerp(0.92, 1.0, out_cubic(tin)), out_cubic(tin) * (1 - tout))
                # accent bar
                bw = int(hi.width * 0.32 * out_cubic(clamp((lt - 0.3) / 0.4)) * (1 - tout))
                if bw > 4:
                    bar = Image.new("RGBA", (bw, 12), acc + (255,))
                    place(fr, bar, tx, hy + hi.height / 2 + 10)

            # transition overlays
            if style == "wipe" and (eout > 0 and eout < 1):
                wpx = int(in_cubic(eout) * (W + H) * 1.1)
                ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                ImageDraw.Draw(ov).polygon([(0, 0), (wpx, 0), (wpx - H * 0.6, H), (0, H)], fill=acc + (255,))
                fr.alpha_composite(ov)
            if style == "wipe" and ein < 1 and i > 0:
                wpx = int(out_cubic(ein) * (W + H) * 1.1)
                ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                ImageDraw.Draw(ov).polygon([(wpx, 0), (W + H, 0), (W + H, H), (wpx - H * 0.6, H)], fill=acc + (255,))
                fr.alpha_composite(ov)
            if style == "iris" and i > 0 and ein < 1:
                r = out_cubic(ein) * math.hypot(W, H) * 0.6
                m = Image.new("L", (W, H), 255)
                ImageDraw.Draw(m).ellipse([mx - r, my - r, mx + r, my + r], fill=0)
                fr.paste(Image.new("RGBA", (W, H), acc + (255,)), (0, 0), m)
            if style == "zoom" and ein < 0.25 and i > 0:
                fr.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, int(200 * (1 - ein / 0.25)))))
            if style == "cut" and lt < 0.06 and i > 0:
                fr.alpha_composite(Image.new("RGBA", (W, H), acc + (int(140 * (1 - lt / 0.06)),)))

        # ---- end card
        if t >= END:
            e = t - END
            emf = loops.get(scenes[-1][0] if style != "cut" else "welcome", int(t * FPS), 620 if land else 640)
            if land:
                ex, ey, lx, ly = W * 0.7, H * 0.5, W * 0.3, H * 0.36
            else:
                ex, ey, lx, ly = W / 2, H * 0.74, W / 2, H * 0.17
            place(fr, emf, ex, ey + (1 - out_back(clamp(e / 0.45), 1.5)) * 300, out_back(clamp(e / 0.45), 1.6), clamp(e / 0.2))
            place(fr, uwu, lx, ly, out_back(clamp((e - 0.1) / 0.4), 2.4), clamp((e - 0.1) / 0.15))
            mt = clamp((e - 0.35) / 0.35)
            place(fr, mate, lx, ly + uwu.height * 0.55, lerp(1.25, 1.0, out_cubic(mt)), out_cubic(mt))
            gt = clamp((e - 0.6) / 0.35)
            place(fr, tag, lx, ly + uwu.height * 0.55 + mate.height + 40 + (1 - out_cubic(gt)) * 30, 1, out_cubic(gt))
            ct = clamp((e - 0.85) / 0.35)
            pulse = 1 + 0.04 * math.sin(2 * math.pi * 1.5 * max(0, e - 1.2)) * clamp((e - 1.2) / 0.2)
            place(fr, cta, lx, ly + uwu.height * 0.55 + mate.height + tag.height + 110, out_back(ct, 2) * pulse, clamp(ct * 3))

        p.stdin.write(fr.convert("RGB").tobytes())
        if n == int((END + 1.4) * FPS):
            fr.convert("RGB").save(out.replace(".mp4", ".jpg"), quality=88)
        if n == int(seg * 0.6 * FPS):
            fr.convert("RGB").save(out.replace(".mp4", "_s1.jpg"), quality=88)
    p.stdin.close()
    p.wait()


def main():
    root, outdir = sys.argv[1], sys.argv[2]
    ids = sys.argv[3] if len(sys.argv) > 3 else "all"
    fmts = (sys.argv[4] if len(sys.argv) > 4 else "landscape,vertical").split(",")
    os.makedirs(outdir, exist_ok=True)
    loops = Loops(root)
    for ad in ADS:
        if ids != "all" and ad["id"] not in ids.split(","): continue
        for fmt in fmts:
            out = os.path.join(outdir, f"uwu_mate_{ad['id']}_{'16x9' if fmt == 'landscape' else '9x16'}.mp4")
            render(ad, fmt, loops, out)
            print(out, flush=True)


if __name__ == "__main__":
    main()
