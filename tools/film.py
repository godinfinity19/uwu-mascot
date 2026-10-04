#!/usr/bin/env python3
"""UwU MATE — "The Glitch Night": a 32 s cinematic 2D spot with music and sound effects.

    python3 tools/film.py <loopsDir> <out.mp4> [landscape|vertical] [--still t1,t2,...]

Story
  0.0  Silence      a night city; a glass dashboard runs: n8n, Zapier, Albato cards linked to the MATE core
  6.0  The Break    a glitch hits, the links snap, the cards crash to the floor (rigid-body physics)
 11.0  The Hero     a spotlight clunks on: UwU, worried; the camera pushes in on the face
 14.0             UwU gets to work, warm light rises
 16.5  The Fix      energy flows from UwU, the cards float back up on springs and re-link one by one
 22.5  The Win      the core reignites, UwU jumps, confetti with gravity
 27.5  End card     UwU / MATE logo, tagline, CTA

Everything is deterministic: physics is simulated once up front with a fixed step, and the
same event list (impacts, links, jumps) drives both the picture and the sound.
"""
import json, math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

FPS, DUR = 60, 32.0
NF = int(FPS * DUR)
SR = 48000
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FS = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

T_BREAK, T_HERO, T_WORK, T_FIX, T_WIN, T_END = 6.0, 11.0, 14.0, 16.5, 22.5, 27.5


def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def sine(x): return 0.5 - 0.5 * math.cos(math.pi * clamp(x))
def out_cubic(x): return 1 - (1 - clamp(x)) ** 3
def in_cubic(x): return clamp(x) ** 3
def out_back(x, s=1.8): x = clamp(x) - 1; return 1 + (s + 1) * x ** 3 + s * x ** 2
def lerp(a, b, k): return a + (b - a) * k
def win(t, a, b): return clamp((t - a) / (b - a))
def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def rnd(i, k=0): return (math.sin(i * 127.1 + k * 311.7) * 43758.5453) % 1


# ============================================================================ layout
def layout(fmt):
    if fmt == "landscape":
        W, H = 1920, 1080
        L = dict(floor=330, hub=(0, -250), mascot=(0, 330), msize=640,
                 tiles={"n8n": (-620, -290), "Zapier": (620, -270), "Albato": (-420, -60)},
                 rest={"n8n": -680, "Zapier": 560, "Albato": -360}, text=(0, 400), bars=70)
    else:
        W, H = 1080, 1920
        L = dict(floor=520, hub=(0, -420), mascot=(0, 520), msize=760,
                 tiles={"n8n": (-270, -640), "Zapier": (270, -620), "Albato": (0, -800)},
                 rest={"n8n": -360, "Zapier": 360, "Albato": -120}, text=(0, -170), bars=0)
    U = min(W, H) / 1080
    return W, H, U, L


BRAND = {"n8n": "#e66a8a", "Zapier": "#f08a4b", "Albato": "#7d73d9"}


# ============================================================================ physics
def simulate(L):
    """Cards fall from their rest spots at T_BREAK (staggered), tumble, bounce and settle.
    Returns per-card arrays of (x, y, angle) at 600 Hz and the impact events."""
    dt, g, e, mu = 1 / 600, 2600.0, 0.32, 0.86
    hw, hh = 150, 62  # card half size (u)
    out, events = {}, []
    for k, (name, (x0, y0)) in enumerate(L["tiles"].items()):
        t0 = T_BREAK + 0.35 + 0.28 * k
        x, y, a = float(x0), float(y0), 0.0
        vx, vy, w = (-160 + 320 * rnd(k, 3)) * (1 if x0 < 0 else -1) * 0.6, -260.0, (2.5 - 5 * rnd(k, 5))
        tx = L["rest"][name]
        track = []
        t = 0.0
        while t < DUR:
            if t >= t0 and t < T_FIX:
                vy += g * dt
                vx += (tx - x) * 0.6 * dt  # drift towards its landing column
                x += vx * dt; y += vy * dt; a += w * dt
                # lowest corner of the rotated card
                ext = abs(hw * math.sin(a)) + abs(hh * math.cos(a))
                if y + ext > L["floor"] and vy > 0:
                    y = L["floor"] - ext
                    if vy > 220: events.append(("impact", round(t, 3), min(1.0, vy / 1600), name))
                    vy = -vy * e; vx *= mu
                    # torque that settles the card flat (nearest multiple of pi)
                    w = w * 0.55 + (round(a / math.pi) * math.pi - a) * 9
                if abs(vy) < 40 and y + ext >= L["floor"] - 1:
                    a += (round(a / math.pi) * math.pi - a) * 0.08
                    w *= 0.9
            track.append((x, y, a))
            t += dt
        out[name] = np.array(track)
    return out, events


# ============================================================================ drawing helpers
_font = {}
def font(p, s):
    if (p, s) not in _font: _font[(p, s)] = ImageFont.truetype(p, int(s))
    return _font[(p, s)]


def text_img(txt, size, color, path=FB, tracking=0, glow=None):
    f = font(path, size)
    widths = [f.getbbox(c)[2] - f.getbbox(c)[0] if tracking else 0 for c in txt]
    tw = (sum(widths) + tracking * (len(txt) - 1)) if tracking else f.getbbox(txt)[2] - f.getbbox(txt)[0]
    pad = int(size * 0.6)
    im = Image.new("RGBA", (int(tw) + 2 * pad, int(size * 1.4) + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if tracking:
        x = pad
        for c, w in zip(txt, widths):
            d.text((x - f.getbbox(c)[0], pad), c, font=f, fill=color); x += w + tracking
    else:
        d.text((pad - f.getbbox(txt)[0], pad), txt, font=f, fill=color)
    if glow:
        g = Image.new("RGBA", im.size, glow + (0,))
        g.putalpha(im.getchannel("A").filter(ImageFilter.GaussianBlur(size / 5)))
        out = Image.new("RGBA", im.size, (0, 0, 0, 0)); out.alpha_composite(g); out.alpha_composite(g); out.alpha_composite(im)
        return out
    return im


def card_img(name, s):
    """glass card with the brand pill; s = pixels per unit"""
    w, h = int(300 * s), int(124 * s)
    pad = int(30 * s)
    im = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle([pad, pad, pad + w, pad + h], radius=int(26 * s), outline=rgb(BRAND[name]) + (255,), width=int(8 * s))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(12 * s)))
    d.rounded_rectangle([pad, pad, pad + w, pad + h], radius=int(26 * s), fill=(30, 24, 52, 215), outline=(255, 255, 255, 70), width=max(1, int(2 * s)))
    # pill
    pw, ph = int(196 * s), int(64 * s)
    px, py = pad + (w - pw) // 2, pad + (h - ph) // 2
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=ph // 2, fill=rgb(BRAND[name]) + (255,), outline=(82, 38, 59, 255), width=max(1, int(4 * s)))
    d.rounded_rectangle([px + int(10 * s), py + int(6 * s), px + pw - int(10 * s), py + int(24 * s)], radius=int(9 * s), fill=(255, 255, 255, 55))
    t = text_img(name, 34 * s, (255, 250, 242))
    im.alpha_composite(t, (px + (pw - t.width) // 2, py + (ph - t.height) // 2 + int(2 * s)))
    # status dot
    return im


def status_dot(color, s):
    r = int(11 * s)
    im = Image.new("RGBA", (6 * r, 6 * r), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([2 * r, 2 * r, 4 * r, 4 * r], fill=color + (255,))
    g = im.filter(ImageFilter.GaussianBlur(r))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0)); out.alpha_composite(g); out.alpha_composite(g); out.alpha_composite(im)
    return out


def radial(size, color, power=2.0):
    """soft radial blob, alpha falls off as (1-r)^power"""
    y, x = np.mgrid[-1:1:size * 1j, -1:1:size * 1j]
    a = np.clip(1 - np.sqrt(x * x + y * y), 0, 1) ** power
    arr = np.zeros((size, size, 4), np.uint8)
    arr[..., :3] = color
    arr[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def paste(fr, im, cx, cy, scale=1.0, alpha=1.0, rot=0.0, add=False):
    if im is None or alpha <= 0.01 or scale <= 0.01: return
    if abs(scale - 1) > 0.002:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    if abs(rot) > 0.05: im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    if alpha < 0.999:
        im = im.copy(); im.putalpha(im.getchannel("A").point(lambda v: int(v * alpha)))
    x, y = int(cx - im.width / 2), int(cy - im.height / 2)
    if add:
        # additive light: only where it lands
        x0, y0, x1, y1 = max(0, x), max(0, y), min(fr.width, x + im.width), min(fr.height, y + im.height)
        if x1 <= x0 or y1 <= y0: return
        sub = im.crop((x0 - x, y0 - y, x1 - x, y1 - y))
        a = np.asarray(sub, np.float32)
        light = (a[..., :3] * (a[..., 3:4] / 255)).astype(np.uint8)
        region = fr.crop((x0, y0, x1, y1)).convert("RGB")
        res = ImageChops.add(region, Image.fromarray(light, "RGB"))
        fr.paste(res.convert("RGBA"), (x0, y0))
        return
    fr.alpha_composite(im, (x, y)) if x >= 0 and y >= 0 and x + im.width <= fr.width and y + im.height <= fr.height else _clip_paste(fr, im, x, y)


def _clip_paste(fr, im, x, y):
    x0, y0, x1, y1 = max(0, x), max(0, y), min(fr.width, x + im.width), min(fr.height, y + im.height)
    if x1 <= x0 or y1 <= y0: return
    fr.alpha_composite(im.crop((x0 - x, y0 - y, x1 - x, y1 - y)), (x0, y0))


# ============================================================================ environment
def build_env(W, H, U, L):
    """big plates (1.35x the frame) for parallax: sky, far city, near city, floor"""
    PW, PH = int(W * 1.35), int(H * 1.35)
    rng = np.random.default_rng(7)
    # sky
    y = np.linspace(0, 1, PH)[:, None]
    top, bot = np.array(rgb("#0b0a1f")), np.array(rgb("#3a2350"))
    sky = (top * (1 - y) + bot * y)[..., None].repeat(1, 2) if False else (top[None, None] * (1 - y[..., None]) + bot[None, None] * y[..., None])
    sky = np.broadcast_to(sky, (PH, PW, 3)).copy()
    for _ in range(int(380 * PW * PH / 2.6e6)):
        sx, sy, b = rng.integers(0, PW), rng.integers(0, int(PH * 0.6)), rng.uniform(0.3, 1)
        sky[sy, sx] = np.minimum(255, sky[sy, sx] + 200 * b)
    sky = Image.fromarray(sky.astype(np.uint8), "RGB").convert("RGBA")
    moon = radial(int(520 * U), rgb("#ffd9ef"), 3.0)
    sky.alpha_composite(moon, (int(PW * 0.72), int(PH * 0.08)))
    sky.alpha_composite(radial(int(140 * U), rgb("#fff4fa"), 0.6), (int(PW * 0.72 + 190 * U), int(PH * 0.08 + 190 * U)))

    def city(color, hmin, hmax, wmin, wmax, base, win_p, seed):
        r = np.random.default_rng(seed)
        im = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        x = -20
        while x < PW:
            bw = int(r.uniform(wmin, wmax) * U); bh = int(r.uniform(hmin, hmax) * U)
            top = base - bh
            d.rectangle([x, top, x + bw, PH], fill=color)
            if r.random() < 0.3: d.rectangle([x + bw // 3, top - int(30 * U), x + bw // 3 + int(6 * U), top], fill=color)
            for wy in range(top + int(14 * U), base - int(10 * U), int(22 * U)):
                for wx in range(x + int(8 * U), x + bw - int(10 * U), int(18 * U)):
                    if r.random() < win_p:
                        c = rgb("#ffd59a") if r.random() < 0.7 else rgb("#9fd0ff")
                        d.rectangle([wx, wy, wx + int(7 * U), wy + int(10 * U)], fill=c + (int(r.uniform(120, 230)),))
            x += bw + int(r.uniform(4, 18) * U)
        return im

    base = int(PH / 2 + L["floor"] * U)
    far = city(rgb("#251a3d") + (255,), 260, 620, 70, 150, base, 0.16, 3).filter(ImageFilter.GaussianBlur(2 * U))
    near = city(rgb("#140f26") + (255,), 160, 420, 110, 220, base, 0.10, 5).filter(ImageFilter.GaussianBlur(1))
    # floor: dark glossy plane with a horizon glow
    floor = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
    fd = ImageDraw.Draw(floor)
    for i in range(PH - base):
        k = i / max(1, PH - base)
        c = tuple(int(lerp(a, b, k ** 0.6)) for a, b in zip(rgb("#3b2752"), rgb("#0e0b18")))
        fd.line([(0, base + i), (PW, base + i)], fill=c + (255,))
    glow = Image.new("RGBA", (PW, int(90 * U)), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rectangle([0, int(40 * U), PW, int(48 * U)], fill=rgb("#ff8fc8") + (200,))
    floor.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14 * U)), (0, base - int(44 * U)))
    return dict(sky=sky, far=far, near=near, floor=floor, PW=PW, PH=PH)


def plate_view(plate, PW, PH, W, H, U, cam, p):
    """crop+scale of a parallax plate for camera cam=(cx, cy, zoom) and parallax p"""
    cx, cy, z = cam
    zp = 1 + (z - 1) * p
    vw, vh = W / zp, H / zp
    x0 = PW / 2 + cx * U * p - vw / 2
    y0 = PH / 2 + cy * U * p - vh / 2
    return plate.transform((W, H), Image.AFFINE, (vw / W, 0, x0, 0, vh / H, y0), resample=Image.BILINEAR)


# ============================================================================ camera
def camera(t):
    keys = [(0, (0, -110, 1.0)), (6.0, (0, -150, 1.12)), (6.2, (0, -60, 1.0)), (10.6, (0, -20, 0.96)),
            (11.0, (0, 120, 1.0)), (13.6, (0, 80, 1.62)), (14.3, (0, 70, 1.6)), (16.5, (0, 20, 1.08)),
            (19.5, (-60, -40, 1.04)), (22.5, (0, -60, 1.0)), (24.2, (0, -20, 1.07)), (27.5, (0, -20, 1.0)), (DUR, (0, -20, 1.0))]
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t <= t1:
            k = sine(win(t, t0, t1)) if t1 - t0 > 0.3 else out_cubic(win(t, t0, t1))
            c = [lerp(a[i], b[i], k) for i in range(3)]
            break
    # shake on the break and on impacts
    sh = 18 * math.exp(-max(0, t - T_BREAK) * 5) * (t >= T_BREAK)
    c[0] += sh * math.sin(t * 91); c[1] += sh * math.cos(t * 77)
    return tuple(c)


# ============================================================================ main render
def render(loops_dir, out, fmt, stills=None):
    W, H, U, L = layout(fmt)
    env = build_env(W, H, U, L)
    tracks, events = simulate(L)
    cards = {n: card_img(n, U) for n in L["tiles"]}
    dots = {k: status_dot(rgb(c), U) for k, c in (("ok", "#7fe0a6"), ("bad", "#ff5a6e"))}
    hub_core = radial(int(150 * U), rgb("#ffb3dd"), 1.6)
    hub_halo = radial(int(460 * U), rgb("#ff7fbf"), 2.6)
    spot = Image.new("L", (W, H), 0)
    sm = int(L["mascot"][0] * U + W / 2)
    ImageDraw.Draw(spot).polygon([(sm - 70 * U, -10), (sm + 70 * U, -10), (sm + 420 * U, H), (sm - 420 * U, H)], fill=150)
    spot = spot.filter(ImageFilter.GaussianBlur(40 * U))
    spot_img = Image.new("RGBA", (W, H), rgb("#ffe6c4") + (0,)); spot_img.putalpha(spot)
    vign = np.asarray(Image.radial_gradient("L").resize((W, H)), np.float32) / 255
    vign = (1 - 0.62 * np.clip(vign - 0.25, 0, 1) ** 1.4)[..., None]
    grain = [np.random.default_rng(i).normal(0, 6, (H // 2, W // 2, 1)).astype(np.float32) for i in range(6)]
    rays = Image.new("RGBA", (int(1600 * U), int(1600 * U)), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    c0 = rays.width / 2
    for i in range(18):
        a0 = i / 18 * 2 * math.pi; a1 = a0 + 0.09
        rd.polygon([(c0, c0), (c0 + math.cos(a0) * c0, c0 + math.sin(a0) * c0), (c0 + math.cos(a1) * c0, c0 + math.sin(a1) * c0)], fill=(255, 236, 200, 60))
    rays = rays.filter(ImageFilter.GaussianBlur(10 * U))

    T1 = text_img("Every night, a million workflows run.", 46 * U, (246, 232, 240), FS, glow=(255, 140, 200))
    T2 = text_img("Until they don't.", 64 * U, (255, 236, 240), FS, glow=(255, 60, 90))
    T3 = text_img("Fixed. Before you woke up.", 58 * U, (255, 246, 236), FS, glow=(255, 190, 120))
    LOGO = text_img("UwU", 230 * U, (255, 247, 240), FB, glow=(255, 120, 190))
    MATE = text_img("MATE", 92 * U, rgb("#ff9fca"), FB, tracking=int(34 * U))
    TAG = text_img("Your cute AI teammate.", 48 * U, (246, 232, 240), FR)
    CTA_t = text_img("Try UwU MATE  →", 40 * U, (255, 255, 255))
    CTA = Image.new("RGBA", (CTA_t.width + int(40 * U), int(96 * U)), (0, 0, 0, 0))
    ImageDraw.Draw(CTA).rounded_rectangle([0, 0, CTA.width - 1, CTA.height - 1], radius=int(48 * U), fill=rgb("#e2557f") + (255,))
    CTA.alpha_composite(CTA_t, ((CTA.width - CTA_t.width) // 2, (CTA.height - CTA_t.height) // 2))

    nframes = {}
    def mascot(lid, t_in, size):
        if lid not in nframes: nframes[lid] = int(open(os.path.join(loops_dir, lid, "frames.txt")).read())
        n = int(t_in * FPS) % nframes[lid]
        im = Image.open(os.path.join(loops_dir, lid, f"f{n:04d}.png")).convert("RGBA")
        return im.resize((size, size), Image.LANCZOS) if size != im.width else im

    def W2S(x, y, cam, p=1.0):
        cx, cy, z = cam
        zp = 1 + (z - 1) * p
        return W / 2 + (x - cx * p) * U * zp, H / 2 + (y - cy * p) * U * zp, zp

    # confetti physics (closed form with drag-free gravity, launched at the jump apex)
    conf_t0 = T_WIN + 0.55
    conf = [(rnd(i, 1) * 2 - 1, -(0.55 + 0.6 * rnd(i, 2)), rnd(i, 4)) for i in range(70)]
    conf_cols = [rgb(c) for c in ("#ff8fb3", "#f0b75e", "#7fc9a0", "#a78bdb", "#86b3e6")]

    proc = None
    if not stills:
        proc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                                 "-i", out.replace(".mp4", ".wav"), "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
                                 "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    frames = [int(s * FPS) for s in stills] if stills else range(NF)
    for n in frames:
        t = n / FPS
        cam = camera(t)
        fr = plate_view(env["sky"], env["PW"], env["PH"], W, H, U, cam, 0.15)
        fr.alpha_composite(plate_view(env["far"], env["PW"], env["PH"], W, H, U, cam, 0.4))
        fr.alpha_composite(plate_view(env["near"], env["PW"], env["PH"], W, H, U, cam, 0.7))
        fr.alpha_composite(plate_view(env["floor"], env["PW"], env["PH"], W, H, U, cam, 1.0))

        # ---- the MATE core (hub)
        alive = 1.0
        if T_BREAK <= t < T_FIX + 1.0: alive = 0.08 + 0.25 * (rnd(int(t * 24)) > 0.85) * (t < T_HERO)
        if t >= T_FIX + 1.0: alive = out_back(win(t, T_FIX + 1.0, T_FIX + 1.8), 2)
        hx, hy, zp = W2S(*L["hub"], cam)
        pulse = 1 + 0.06 * math.sin(t * 2 * math.pi * 0.8)
        paste(fr, hub_halo, hx, hy, zp * pulse, 0.55 * alive, add=True)
        paste(fr, hub_core, hx, hy, zp * pulse, min(1, alive), add=True)

        # ---- cards + links
        lines = Image.new("RGBA", (W // 2, H // 2), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lines)
        idx = min(len(next(iter(tracks.values()))) - 1, int(t * 600))
        for k, name in enumerate(L["tiles"]):
            x0, y0 = L["tiles"][name]
            fx, fy, fa = tracks[name][idx]
            if t >= T_FIX:
                # levitate back: spring from the fallen pose to the rest pose, staggered
                lf = tracks[name][int(T_FIX * 600) - 1]
                k_up = win(t, T_FIX + 0.6 + 0.7 * k, T_FIX + 2.3 + 0.7 * k)
                e = out_back(k_up, 1.4)
                fx, fy = lerp(lf[0], x0, e), lerp(lf[1], y0, e) + 8 * math.sin(t * 3 + k) * k_up
                fa = lf[2] * (1 - out_cubic(k_up))
            else:
                fy += 6 * math.sin(t * 1.4 + k * 2) * (t < T_BREAK)
            sx, sy, zp = W2S(fx, fy, cam)
            linked = t < T_BREAK or (t >= T_FIX and t >= T_FIX + 2.6 + 0.7 * k)
            hx2, hy2 = hx / 2, hy / 2
            if linked or (T_BREAK <= t < T_BREAK + 0.25):
                col = (255, 160, 210, 230) if t < T_BREAK else (140, 255, 190, 230)
                if T_BREAK <= t < T_BREAK + 0.25: col = (255, 90, 110, 255)
                ld.line([(hx2, hy2), (sx / 2, sy / 2)], fill=col, width=max(2, int(5 * U * zp / 2)))
                # data packets travelling to the hub
                for j in range(3):
                    q = ((t * 0.6 + j / 3 + k * 0.17) % 1)
                    px, py = lerp(sx / 2, hx2, q), lerp(sy / 2, hy2, q)
                    r = 4 * U
                    ld.ellipse([px - r, py - r, px + r, py + r], fill=(255, 255, 255, 255))
            paste(fr, cards[name], sx, sy, zp, 1.0, rot=-math.degrees(fa))
            d_ok = linked
            paste(fr, dots["ok" if d_ok else "bad"], sx + 130 * U * zp * math.cos(fa), sy - 44 * U * zp, zp * 0.8, 1.0 if d_ok or int(t * 4) % 2 else 0.3)
        glow = lines.filter(ImageFilter.GaussianBlur(5 * U)).resize((W, H), Image.BILINEAR)
        paste(fr, glow, W / 2, H / 2, add=True)
        paste(fr, glow, W / 2, H / 2, add=True)
        paste(fr, lines.resize((W, H), Image.BILINEAR), W / 2, H / 2, alpha=0.9)

        # ---- sparks at the snap
        if T_BREAK <= t < T_BREAK + 0.9:
            sp = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sp)
            for i in range(60):
                k = i % 3; nm = list(L["tiles"])[k]
                bx, by, _ = W2S(*(np.array(L["tiles"][nm]) * 0.5 + np.array(L["hub"]) * 0.5), cam)
                u = t - T_BREAK
                vx, vy = (rnd(i, 1) - 0.5) * 900, -rnd(i, 2) * 700
                x, y = bx + vx * u * U, by + (vy * u + 1400 * u * u) * U
                a = int(255 * (1 - u / 0.9))
                sd.line([(x, y), (x - vx * 0.02 * U, y - (vy + 2800 * u) * 0.02 * U)], fill=(255, 220, 140, a), width=max(1, int(3 * U)))
            paste(fr, sp, W / 2, H / 2, add=True)

        # ---- UwU
        if t >= T_HERO:
            if t < T_WORK: lid, t0 = "problem", T_HERO
            elif t < T_FIX + 3.0: lid, t0 = "working", T_WORK
            elif t < T_WIN: lid, t0 = "connect_accounts", T_FIX + 3.0
            elif t < T_END: lid, t0 = "project_success", T_WIN
            else: lid, t0 = "welcome", T_END
            mx, my, zp = W2S(L["mascot"][0], L["mascot"][1] - L["msize"] * 0.5 + L["msize"] * 0.095, cam)
            size = int(L["msize"] * U * zp)
            m = mascot(lid, t - t0, min(size, 1500))
            if size > 1500: m = m.resize((size, size), Image.BILINEAR)
            # lighting: silhouette before the spotlight, then key light + warm/cool grade
            lit = out_cubic(win(t, T_HERO + 0.5, T_HERO + 0.62))
            if lit < 1:
                arr = np.asarray(m, np.float32)
                arr[..., :3] *= (0.12 + 0.88 * lit)
                m = Image.fromarray(arr.astype(np.uint8), "RGBA")
            # spotlight cone behind the hero (additive), then a warm key-light tint on UwU
            if T_HERO + 0.5 <= t < T_WIN + 0.5:
                sa = lit * (1 - win(t, T_WIN, T_WIN + 0.5)) * (0.55 + 0.08 * math.sin(t * 7))
                paste(fr, spot_img, W / 2, H / 2, alpha=sa, add=True)
            if t < T_END:
                if lit >= 1 and t < T_WIN:
                    arr = np.asarray(m, np.float32)
                    arr[..., :3] = arr[..., :3] * np.array([1.0, 0.95, 0.9], np.float32)
                    m = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
                paste(fr, m, mx, my)

        # ---- energy from UwU to the cards (the fix)
        if T_FIX <= t < T_FIX + 3.6:
            en = Image.new("RGBA", (W // 2, H // 2), (0, 0, 0, 0)); ed = ImageDraw.Draw(en)
            mx2, my2, _ = W2S(L["mascot"][0], L["mascot"][1] - 260, cam)
            for k, name in enumerate(L["tiles"]):
                cx2, cy2, _ = W2S(*L["tiles"][name], cam)
                for j in range(14):
                    q = ((t - T_FIX) * 0.9 + j / 14) % 1
                    bend = math.sin(q * math.pi) * 120 * U * (1 if k % 2 else -1)
                    px = lerp(mx2, cx2, q) + bend * 0.3; py = lerp(my2, cy2, q) - bend
                    r = (3 + 4 * math.sin(q * math.pi)) * U
                    ed.ellipse([px / 2 - r, py / 2 - r, px / 2 + r, py / 2 + r], fill=(255, 210, 150, 230))
            eg = en.filter(ImageFilter.GaussianBlur(4 * U)).resize((W, H), Image.BILINEAR)
            a = sine(win(t, T_FIX, T_FIX + 0.5)) * (1 - win(t, T_FIX + 3.0, T_FIX + 3.6))
            paste(fr, eg, W / 2, H / 2, alpha=a, add=True); paste(fr, eg, W / 2, H / 2, alpha=a, add=True)

        # ---- the win: rays + confetti
        if T_WIN <= t < T_END + 0.6:
            hx, hy, zp = W2S(*L["hub"], cam)
            ra = sine(win(t, T_WIN + 0.4, T_WIN + 0.9)) * (1 - win(t, T_END, T_END + 0.6))
            paste(fr, rays, hx, hy, zp * 1.2, ra, rot=(t - T_WIN) * 9, add=True)
        if conf_t0 <= t < conf_t0 + 4.5:
            u = t - conf_t0
            cf = Image.new("RGBA", (W, H), (0, 0, 0, 0)); cd = ImageDraw.Draw(cf)
            hx, hy, zp = W2S(*L["hub"], cam)
            for i, (dx, dy, ph) in enumerate(conf):
                x = hx + dx * 900 * U * u * (1 - 0.25 * u)
                y = hy + (dy * 1500 * u + 900 * u * u) * U
                ang = ph * 6.28 + u * (6 + 6 * ph)
                w, h = 18 * U, 10 * U * abs(math.cos(ang * 1.7))
                c, s_ = math.cos(ang), math.sin(ang)
                pts = [(x + c * a - s_ * b, y + s_ * a + c * b) for a, b in ((-w, -h), (w, -h), (w, h), (-w, h))]
                cd.polygon(pts, fill=conf_cols[i % 5] + (255,))
            paste(fr, cf, W / 2, H / 2)

        # ---- grade: alarm red during the break, cool night, warm win
        arr = np.asarray(fr.convert("RGB"), np.float32)
        if T_BREAK <= t < T_HERO + 0.6:
            al = (0.5 + 0.5 * math.sin((t - T_BREAK) * 2 * math.pi * 1.6)) * (1 - win(t, T_HERO, T_HERO + 0.6))
            arr = arr * (1 - 0.35 * al) + np.array([255, 30, 60], np.float32) * 0.35 * al * (arr.mean(-1, keepdims=True) / 255 + 0.25)
        if t >= T_WIN:
            w_ = win(t, T_WIN + 0.3, T_WIN + 1.2)
            arr = arr * (1 + 0.12 * w_) + np.array([20, 10, -6], np.float32) * w_
        # white flash on the glitch
        fl = math.exp(-max(0, t - T_BREAK) * 14) * (t >= T_BREAK)
        arr = arr * (1 - fl) + 255 * fl
        arr = arr * vign
        g = grain[n % 6]
        arr += np.repeat(np.repeat(g, 2, 0), 2, 1)
        fr = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

        # ---- titles
        tx, ty = W / 2 + L["text"][0] * U, H / 2 + L["text"][1] * U
        for img, a, b in ((T1, 1.2, 5.6), (T2, 7.2, 10.6), (T3, T_WIN + 1.0, T_END - 0.1)):
            if a <= t < b:
                k = sine(win(t, a, a + 0.8)) * (1 - sine(win(t, b - 0.5, b)))
                paste(fr, img, tx, ty + (1 - k) * 20 * U, 1.0 + 0.03 * win(t, a, b), k)

        # ---- end card
        if t >= T_END:
            e = t - T_END
            dk = sine(win(e, 0, 0.6))
            arr = np.asarray(fr.convert("RGB"), np.float32) * (1 - 0.72 * dk)
            fr = Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")
            if fmt == "landscape":
                ex, ey, lx, ly = W * 0.7, H * 0.55, W * 0.32, H * 0.36
            else:
                ex, ey, lx, ly = W / 2, H * 0.72, W / 2, H * 0.22
            m = mascot("welcome", e, int((560 if fmt == "landscape" else 640) * U))
            paste(fr, m, ex, ey + (1 - out_back(win(e, 0.1, 0.6), 1.5)) * 260 * U, 1, win(e, 0.1, 0.3))
            paste(fr, LOGO, lx, ly, out_back(win(e, 0.25, 0.7), 2.2), win(e, 0.25, 0.4))
            mk = out_cubic(win(e, 0.55, 0.95))
            paste(fr, MATE, lx, ly + 150 * U, lerp(1.3, 1.0, mk), mk)
            gk = out_cubic(win(e, 0.85, 1.25))
            paste(fr, TAG, lx, ly + 250 * U + (1 - gk) * 20 * U, 1, gk)
            ck = win(e, 1.15, 1.5)
            paste(fr, CTA, lx, ly + 350 * U, out_back(ck, 2) * (1 + 0.035 * math.sin(2 * math.pi * 1.2 * max(0, e - 1.6))), min(1, ck * 3))

        # ---- letterbox (landscape) + fade in/out
        out_img = fr.convert("RGB")
        if L["bars"]:
            b = int(L["bars"] * U * (1 - win(t, T_END, T_END + 0.6)))
            if b > 0:
                d = ImageDraw.Draw(out_img); d.rectangle([0, 0, W, b], fill=0); d.rectangle([0, H - b, W, H], fill=0)
        fade_k = win(t, 0, 0.8) * (1 - win(t, DUR - 0.5, DUR))
        if fade_k < 1: out_img = Image.fromarray((np.asarray(out_img, np.float32) * fade_k).astype(np.uint8), "RGB")
        if stills:
            out_img.save(out.replace(".mp4", f"_t{t:05.2f}.jpg"), quality=90)
        else:
            proc.stdin.write(out_img.tobytes())
    if proc:
        proc.stdin.close(); proc.wait()
    return events


# ============================================================================ sound
def synth(events, path):
    n = int(DUR * SR)
    t = np.arange(n) / SR
    mix = np.zeros(n, np.float32)
    rng = np.random.default_rng(1)

    def env(a, d, length):
        k = np.arange(length) / SR
        return np.minimum(1, k / max(a, 1e-4)) * np.exp(-k / d)

    def add(sig, at, gain=1.0):
        i = int(at * SR)
        j = min(n, i + len(sig))
        if j > i: mix[i:j] += gain * sig[: j - i]

    from scipy.signal import butter, sosfilt, fftconvolve

    def lp(x, f): return sosfilt(butter(2, f / (SR / 2), "low", output="sos"), x).astype(np.float32)
    def hp(x, f): return sosfilt(butter(2, f / (SR / 2), "high", output="sos"), x).astype(np.float32)
    def bp(x, f0, f1): return sosfilt(butter(2, [f0 / (SR / 2), f1 / (SR / 2)], "band", output="sos"), x).astype(np.float32)

    def saw(f, length, det=0.004):
        k = np.arange(length) / SR
        s = sum(2 * ((k * f * (1 + d)) % 1) - 1 for d in (-det, 0, det)) / 3
        return s.astype(np.float32)

    def note(m): return 440 * 2 ** ((m - 69) / 12)

    # --- music: pads (chords), each chord 1.5 s, softened
    def pad(chords, start, dur_each, gain, cutoff):
        for i, ch in enumerate(chords):
            ln = int(dur_each * SR * 1.35)
            s = sum(saw(note(m), ln) for m in ch) / len(ch)
            s = lp(s, cutoff) * env(0.5, dur_each * 0.9, ln)
            add(s, start + i * dur_each, gain)

    A, F, C, G, Dm, E = [57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62], [50, 57, 62], [52, 56, 59]
    pad([A, F, C, G], 0.0, 1.5, 0.22, 900)                       # calm night
    # drone + tremolo for the break and the hero
    ln = int((T_FIX - T_BREAK) * SR)
    k = np.arange(ln) / SR
    drone = (np.sin(2 * np.pi * note(38) * k) + 0.5 * np.sin(2 * np.pi * note(45) * k)) * (0.6 + 0.4 * np.sin(2 * np.pi * 5 * k))
    add((drone * np.minimum(1, k / 0.4) * np.minimum(1, (k[::-1]) / 0.6)).astype(np.float32), T_BREAK, 0.18)
    # heartbeat in the hero shot
    for i in range(6):
        for off, g in ((0, 1.0), (0.22, 0.7)):
            ln = int(0.3 * SR); k = np.arange(ln) / SR
            beat = np.sin(2 * np.pi * (55 - 25 * k) * k) * np.exp(-k / 0.07)
            add(beat.astype(np.float32), T_HERO + 0.6 + i * 0.85 + off, 0.55 * g)
    # rising arpeggio for the fix
    arp = [57, 60, 64, 69, 60, 64, 69, 72, 62, 65, 69, 74, 64, 67, 72, 76]
    for i, m in enumerate(arp * 2):
        at = T_FIX + i * 0.18
        if at > T_WIN - 0.1: break
        ln = int(0.4 * SR)
        s = lp(saw(note(m), ln, 0.002), 2500) * env(0.005, 0.18, ln)
        add(s, at, 0.16)
    pad([Dm, F, G], T_FIX, 2.0, 0.2, 1400)
    # the win: big chord hit + bright plucks + bass
    pad([[48, 55, 60, 64, 67], [53, 57, 60, 65], [55, 59, 62, 67], [48, 55, 60, 64, 72]], T_WIN, 1.5, 0.3, 3000)
    for i, m in enumerate([72, 76, 79, 84, 79, 76, 79, 84, 88]):
        ln = int(0.5 * SR); kk = np.arange(ln) / SR
        s = (np.sin(2 * np.pi * note(m) * kk) * np.exp(-kk / 0.15)).astype(np.float32)
        add(s, T_WIN + 0.55 + i * 0.25, 0.14)
    for i, m in enumerate([36, 36, 41, 43, 36]):
        ln = int(1.4 * SR); kk = np.arange(ln) / SR
        add((np.sin(2 * np.pi * note(m) * kk) * env(0.01, 0.6, ln)).astype(np.float32), T_WIN + i * 1.5 - (0.5 if i == 4 else 0) * 0, 0.35)

    # --- sound effects
    # ambient city hum
    noise = rng.normal(0, 1, n).astype(np.float32)
    amb = lp(noise, 350) * 0.05
    amb *= np.where(t < T_BREAK, 1, np.where(t < T_FIX, 0.5, 0.8)).astype(np.float32)
    mix += amb
    # glitch hit: bit-crushed noise burst + sub drop
    ln = int(0.6 * SR); k = np.arange(ln) / SR
    gl = np.sign(np.sin(2 * np.pi * 180 * k * (1 + 4 * k))) * rng.normal(0, 1, ln) * np.exp(-k / 0.15)
    gl = np.round(gl * 4) / 4
    add(gl.astype(np.float32), T_BREAK, 0.35)
    add((np.sin(2 * np.pi * (90 - 60 * k) * k) * np.exp(-k / 0.35)).astype(np.float32), T_BREAK, 0.9)
    # alarm: two tones, 4 cycles
    for i in range(6):
        for j, f in enumerate((880, 660)):
            ln = int(0.22 * SR); k = np.arange(ln) / SR
            s = (np.sign(np.sin(2 * np.pi * f * k)) * 0.5 + np.sin(2 * np.pi * f * k) * 0.5) * np.minimum(1, k / 0.01) * np.minimum(1, (0.22 - k) / 0.02)
            add(lp(s.astype(np.float32), 3000), T_BREAK + 0.5 + i * 0.6 + j * 0.25, 0.07 * (1 - i / 7))
    # snapping links: sharp zaps
    for k_ in range(3):
        ln = int(0.25 * SR); k = np.arange(ln) / SR
        z = np.sin(2 * np.pi * (2400 - 6000 * k) * k) * np.exp(-k / 0.05)
        add(hp(z.astype(np.float32), 400), T_BREAK + 0.05 + 0.08 * k_, 0.25)
    # impacts from the physics
    for kind, at, strength, name in events:
        if kind != "impact": continue
        ln = int(0.5 * SR); k = np.arange(ln) / SR
        thud = np.sin(2 * np.pi * (70 + 40 * strength) * k) * np.exp(-k / 0.12)
        clack = bp(rng.normal(0, 1, ln).astype(np.float32), 1500, 5000) * np.exp(-k / 0.03)
        add((thud * 0.9 + clack * 0.6).astype(np.float32), at, 0.6 * strength + 0.1)
    # spotlight clunk
    ln = int(0.8 * SR); k = np.arange(ln) / SR
    cl = bp(rng.normal(0, 1, ln).astype(np.float32), 200, 1800) * np.exp(-k / 0.06) + np.sin(2 * np.pi * 60 * k) * np.exp(-k / 0.25)
    add(cl.astype(np.float32), T_HERO + 0.5, 0.7)
    # typing clicks while working
    for i in range(40):
        at = T_WORK + 0.3 + i * 0.11 + 0.03 * rnd(i, 9)
        if at > T_FIX + 2.5: break
        ln = int(0.03 * SR)
        add(hp(rng.normal(0, 1, ln).astype(np.float32), 3000) * np.exp(-np.arange(ln) / SR / 0.006), at, 0.12)
    # whooshes as each card floats up
    for k_ in range(3):
        at = T_FIX + 0.6 + 0.7 * k_
        ln = int(1.4 * SR); k = np.arange(ln) / SR
        nz = rng.normal(0, 1, ln).astype(np.float32)
        lo = bp(nz, 300, 1200); hi = bp(nz, 1200, 5000)
        mixk = k / k[-1]
        wsh = (lo * (1 - mixk) + hi * mixk) * np.sin(np.pi * mixk) ** 2
        add(wsh.astype(np.float32), at, 0.35)
        # reconnect chime
        ln = int(1.2 * SR); kk = np.arange(ln) / SR
        ch = sum(np.sin(2 * np.pi * note(m) * kk) for m in (84 + k_ * 2, 91 + k_ * 2)) * np.exp(-kk / 0.4)
        add((ch / 2).astype(np.float32), T_FIX + 2.6 + 0.7 * k_, 0.16)
    # core reignites: riser + boom
    ln = int(1.0 * SR); k = np.arange(ln) / SR
    add((hp(rng.normal(0, 1, ln).astype(np.float32), 2000) * (k / k[-1]) ** 2).astype(np.float32), T_WIN - 1.0, 0.25)
    add((np.sin(2 * np.pi * (60 - 25 * k) * k) * np.exp(-k / 0.5)).astype(np.float32), T_WIN, 0.9)
    # jump boing + confetti pops
    ln = int(0.4 * SR); k = np.arange(ln) / SR
    add((np.sin(2 * np.pi * (300 + 900 * k) * k) * np.exp(-k / 0.15)).astype(np.float32), T_WIN + 0.2, 0.2)
    for i in range(14):
        ln = int(0.05 * SR)
        add(bp(rng.normal(0, 1, ln).astype(np.float32), 2000, 8000) * np.exp(-np.arange(ln) / SR / 0.01), T_WIN + 0.55 + 0.03 * i + 0.04 * rnd(i, 7), 0.2)
    # end card: logo whoosh + final chime
    ln = int(2.5 * SR); kk = np.arange(ln) / SR
    chime = sum(np.sin(2 * np.pi * note(m) * kk) * np.exp(-kk / d) for m, d in ((84, 0.9), (88, 0.8), (91, 0.7), (96, 0.6)))
    add((chime / 4).astype(np.float32), T_END + 0.3, 0.3)

    # --- reverb (exponential noise tail) + master
    ir_len = int(1.6 * SR)
    ir = rng.normal(0, 1, ir_len).astype(np.float32) * np.exp(-np.arange(ir_len) / SR / 0.45)
    ir /= np.sqrt((ir ** 2).sum())
    wet = fftconvolve(mix, ir)[:n].astype(np.float32)
    out = mix * 0.8 + wet * 0.35
    out *= np.minimum(1, t / 0.5) * np.minimum(1, (DUR - t) / 0.6)
    out = np.tanh(out * 1.4) / np.tanh(1.4)
    out /= max(1e-6, np.abs(out).max()) / 0.89
    stereo = np.stack([out, np.roll(out, int(0.011 * SR))], 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((stereo * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    loops_dir, out = sys.argv[1], sys.argv[2]
    fmt = sys.argv[3] if len(sys.argv) > 3 else "landscape"
    stills = None
    if "--still" in sys.argv: stills = [float(x) for x in sys.argv[sys.argv.index("--still") + 1].split(",")]
    W, H, U, L = layout(fmt)
    _, events = simulate(L)
    if not stills: synth(events, out.replace(".mp4", ".wav"))
    render(loops_dir, out, fmt, stills)
    print(out)
