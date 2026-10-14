import subprocess, sys, wave, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

SRC, FONT, OUT_V, OUT_WAV = sys.argv[1:5]
W, H, FPS = 1920, 1080, 24
SW, SH = 640, 360
INTRO = 3.5            # video starts fading in here
XF = 1.0               # crossfade length
VID = 10.0
TOTAL = INTRO + VID
NF = int(TOTAL * FPS)
rng = np.random.default_rng(7)

def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)

# ---------- source frames ----------
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", SRC, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                     capture_output=True, check=True).stdout
src = np.frombuffer(raw, np.uint8).reshape(-1, SH, SW, 3)

# ---------- static layers ----------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
vignette = np.clip(1.0 - 0.55 * np.clip(r - 0.35, 0, None) ** 1.6, 0, 1)[..., None]

# fog texture: blurred noise, tiled and scrolled
fog_small = Image.fromarray((rng.random((90, 320)) * 255).astype(np.uint8)).resize((W * 2, H), Image.BICUBIC)
fog = np.asarray(fog_small.filter(ImageFilter.GaussianBlur(60)), np.float32) / 255.0
fog = (fog - fog.min()) / (fog.max() - fog.min())

# dust particles
NP = 140
px, py = rng.random(NP) * W, rng.random(NP) * H
pvx, pvy = rng.normal(0, 6, NP), -rng.random(NP) * 18 - 4
psz, pph = rng.random(NP) * 2.5 + 0.8, rng.random(NP) * 6.28

# title
font = ImageFont.truetype(FONT, 260)
mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).text((W / 2, H / 2 - 20), "الخضر", font=font, fill=255, anchor="mm", direction="rtl", features=["-liga", "-calt", "-rlig"])
m = np.asarray(mask, np.float32) / 255.0
ys = np.where(m.max(1) > 0)[0]
t0, t1 = ys.min(), ys.max()
grad = np.clip((yy - t0) / (t1 - t0), 0, 1)[..., None]
gold_top, gold_bot = np.array([255, 236, 190], np.float32), np.array([196, 140, 62], np.float32)
title_rgb = gold_top * (1 - grad) + gold_bot * grad
xs = np.where(m.max(0) > 0)[0]
tx0, tx1 = xs.min(), xs.max()


def title_layer(t):
    """Returns (rgb, alpha) of the title at time t (seconds)."""
    a_in = ease((t - 0.4) / 1.6)
    a_out = 1 - ease((t - INTRO + 0.3) / 1.0)
    alpha = a_in * a_out
    if alpha <= 0:
        return None
    blur = 28 * (1 - ease((t - 0.4) / 1.8)) + 22 * ease((t - INTRO + 0.3) / 1.0)
    scale = 1.12 - 0.12 * ease((t - 0.3) / 3.0) + 0.06 * ease((t - INTRO + 0.3) / 1.0)
    mi = mask.resize((int(W * scale), int(H * scale)), Image.BICUBIC)
    mi = mi.crop(((mi.width - W) // 2, (mi.height - H) // 2, (mi.width - W) // 2 + W, (mi.height - H) // 2 + H))
    # subtle flicker like an old projector / candle
    flick = 1.0 - 0.08 * max(0, np.sin(t * 37) * np.sin(t * 13))
    sharp = mi.filter(ImageFilter.GaussianBlur(blur)) if blur > 0.3 else mi
    glow = mi.filter(ImageFilter.GaussianBlur(26 + blur))
    s = np.asarray(sharp, np.float32) / 255.0
    g = np.asarray(glow, np.float32) / 255.0
    # light sweep across the letters (right -> left, Arabic reading direction)
    sweep_t = (t - 2.0) / 0.9
    sweep = 0.0
    if 0 <= sweep_t <= 1:
        cx = tx1 + 200 - (tx1 - tx0 + 400) * sweep_t
        sweep = np.exp(-(((xx - cx) + (yy - H / 2) * 0.35) / 70) ** 2)[..., None] * s[..., None]
    rgb = title_rgb * s[..., None] + 255 * 0.9 * sweep + np.array([255, 190, 110], np.float32) * g[..., None] * 0.9
    a = np.clip(s + g * 0.85, 0, 1)[..., None] * alpha * flick
    return rgb, a


def intro_bg(t, i):
    off = int(t * 60) % W
    f = np.roll(fog, -off, axis=1)[:, :W]
    f2 = np.roll(fog, int(t * 25), axis=1)[::-1, :W]
    dens = (0.6 * f + 0.4 * f2)[..., None]
    base = np.array([6, 14, 20], np.float32) + dens * np.array([28, 52, 60], np.float32) * ease(t / 1.5)
    img = np.broadcast_to(base, (H, W, 3)).copy()
    # embers / dust
    pl = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(pl)
    for k in range(NP):
        x = (px[k] + pvx[k] * t) % W
        y = (py[k] + pvy[k] * t) % H
        b = int(255 * (0.5 + 0.5 * np.sin(t * 2.2 + pph[k])) * ease(t / 1.2))
        d.ellipse([x - psz[k], y - psz[k], x + psz[k], y + psz[k]], fill=b)
    pa = np.asarray(pl.filter(ImageFilter.GaussianBlur(1.2)), np.float32)[..., None] / 255.0
    img += pa * np.array([255, 200, 130], np.float32) * 0.8
    return img


def video_frame(tv):
    i = min(int(tv * FPS), len(src) - 1)
    fr = Image.fromarray(src[i])
    # crop the rounded corners away, slow cinematic push-in
    z = 1.08 + 0.10 * ease(tv / VID)
    cw, ch = SW / z, SH / z
    cx, cy = SW / 2 - 6 * ease(tv / VID), SH / 2 + 4
    fr = fr.resize((W, H), Image.LANCZOS, box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2))
    a = np.asarray(fr, np.float32) / 255.0
    # grade: lift contrast, teal shadows / warm highlights
    a = np.clip((a - 0.5) * 1.12 + 0.5, 0, 1)
    lum = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])[..., None]
    a = a + (1 - lum) * np.array([-0.03, 0.01, 0.04]) + lum * np.array([0.05, 0.015, -0.04])
    return np.clip(a, 0, 1) * 255


bar_full = int((H - W / 2.39) / 2)
enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                        "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
                        "-pix_fmt", "yuv420p", OUT_V], stdin=subprocess.PIPE)
for n in range(NF):
    t = n / FPS
    img = None
    if t < INTRO + XF:
        img = intro_bg(t, n)
    tv = t - INTRO
    if tv >= 0:
        v = video_frame(tv)
        k = ease(tv / XF)
        img = v if img is None or k >= 1 else img * (1 - k) + v * k
    tl = title_layer(t)
    if tl is not None:
        rgb, al = tl
        img = img * (1 - al) + rgb * al
    # flash on title impact
    fl = max(0.0, 1 - abs(t - 1.15) / 0.25) * 0.18
    img = img + 255 * fl * np.array([1.0, 0.85, 0.6])
    img = img * vignette
    # letterbox: already present in intro, stays in the video part
    img[:bar_full] = 0
    img[H - bar_full:] = 0
    # film grain
    img += rng.normal(0, 6, (H // 2, W // 2, 1)).repeat(2, 0).repeat(2, 1)
    # fade out at the end
    img *= 1 - ease((t - (TOTAL - 1.0)) / 1.0)
    img *= ease(t / 0.3) if t < 0.3 else 1
    enc.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
enc.stdin.close()
enc.wait()

# ---------- sound design (intro) ----------
SR = 48000
tt = np.arange(int(TOTAL * SR)) / SR
env_d = np.clip(tt / 1.2, 0, 1) * np.clip(1 - (tt - INTRO) / 2.0, 0, 1)
drone = (np.sin(2 * np.pi * 55 * tt) + 0.6 * np.sin(2 * np.pi * 82.4 * tt + np.sin(tt * 0.7))
         + 0.3 * np.sin(2 * np.pi * 110.3 * tt)) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.4 * tt))
drone *= env_d * 0.12
# boom at the reveal
tb = tt - 1.15
boom = np.where(tb >= 0, np.sin(2 * np.pi * (48 * tb - 6 * tb ** 2)) * np.exp(-tb * 2.2), 0) * 0.55
noise = rng.normal(0, 1, tt.size)
lp = np.convolve(noise, np.ones(40) / 40, mode="same")
boom += np.where(tb >= 0, lp * np.exp(-tb * 8), 0) * 0.6
# whoosh into the video
tw = (tt - (INTRO - 0.8)) / 1.4
wenv = np.where((tw >= 0) & (tw <= 1), np.sin(np.pi * np.clip(tw, 0, 1)) ** 2, 0)
hp = noise - np.convolve(noise, np.ones(6) / 6, mode="same")
whoosh = (0.6 * lp * 3 + 0.4 * hp) * wenv * 0.12
# shimmer during the light sweep
ts = tt - 2.0
shim = np.where((ts >= 0) & (ts <= 1.2), sum(np.sin(2 * np.pi * f * tt) for f in (1760, 2217, 2637))
                * np.sin(np.pi * np.clip(ts / 1.2, 0, 1)) ** 2, 0) * 0.025
fx = drone + boom + whoosh + shim
# simple stereo widening
L, R = fx, np.roll(fx, 240)
st = np.stack([L, R], 1)
st /= max(1.0, np.abs(st).max() / 0.9)
with wave.open(OUT_WAV, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
print("frames", NF)
