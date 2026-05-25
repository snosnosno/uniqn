# -*- coding: utf-8 -*-
"""UNIQN 좌우 스플릿 마케팅 컷 — base2(폰 우측) 위에 한글 카피/아이콘/스토어 뱃지 오버레이."""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
# 인자: [base_filename] [final_filename]  (기본 = base2 / appcomp-final)
_base = sys.argv[1] if len(sys.argv) > 1 else "appcomp-base2.png"
_final = sys.argv[2] if len(sys.argv) > 2 else "appcomp-final.png"
BASE = os.path.join(HERE, _base)
FINAL = os.path.join(HERE, _final)
FINAL_HI = os.path.join(HERE, _final.replace(".png", "-hi.png"))
APPLE = os.path.join(HERE, "assets", "apple-app-store.png")
GOOGLE = os.path.join(HERE, "assets", "google-play-badge.png")
LOGO = os.path.join(HERE, "assets", "uniqn-logo.png")

MALGUNBD = "C:/Windows/Fonts/malgunbd.ttf"
GOLD = (212, 175, 55, 255)
OFF = (245, 243, 236, 255)
WHITE = (255, 255, 255, 255)
DARK = (5, 5, 8)

base = Image.open(BASE).convert("RGBA")
W, H = base.size

# 1) 좌측 가독 스크림 (폰은 우측이라 ~50%까지만)
scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(scrim)
x_end = int(W * 0.50)
for x in range(x_end):
    a = int(205 * (1 - x / x_end))
    sd.line([(x, 0), (x, H)], fill=(DARK[0], DARK[1], DARK[2], a))
base = Image.alpha_composite(base, scrim)
draw = ImageDraw.Draw(base)

def bold(sz):
    return ImageFont.truetype(MALGUNBD, sz)

def draw_spaced(d, pos, text, font, fill, spacing):
    x, y = pos
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + spacing
    return x

LX = int(W * 0.066)

# 2) 브랜드 로고 (유니콘 엠블럼 + UNIQN 워드마크)
_logo = Image.open(LOGO).convert("RGBA")
_lh = int(W * 0.090)
_lw = int(_logo.width * _lh / _logo.height)
_ly = int(H * 0.040)
base.alpha_composite(_logo.resize((_lw, _lh), Image.LANCZOS), (LX, _ly))
_wm = bold(int(W * 0.050))
_bb = _wm.getbbox("UNIQN")
draw_spaced(draw, (LX + _lw + int(W * 0.018), _ly + (_lh - (_bb[3] - _bb[1])) // 2 - _bb[1]),
            "UNIQN", _wm, GOLD, 8)

# 3) 헤드라인 (정산 = 골드)
hl = bold(int(W * 0.050))
lh = int(W * 0.050 * 1.30)
y = int(H * 0.140)
x = LX
for t, c in [("구인부터 ", WHITE), ("정산", GOLD), ("까지,", WHITE)]:
    draw.text((x, y), t, font=hl, fill=c)
    x += draw.textlength(t, font=hl)
y += lh
draw.text((LX, y), "한 앱에서", font=hl, fill=WHITE)
y += lh

# 4) 디바이더
y += int(H * 0.010)
dw, dh = int(W * 0.078), max(5, int(H * 0.0035))
draw.rounded_rectangle([LX, y, LX + dw, y + dh], radius=dh // 2, fill=GOLD)
y += int(H * 0.026)

# 5) 기능 6필러
feat = bold(int(W * 0.0295))
S = int(W * 0.050)
gap = int(W * 0.016)
lw = max(4, int(S * 0.06))
items = [
    ("magnifier", "홀덤 전문 구인구직"),
    ("clock", "QR 출퇴근"),
    ("won", "자동 정산"),
    ("calendar", "내 스케줄 자동 관리"),
    ("lock", "공고별 프라이빗 소통"),
    ("chat", "자유·TDA 토론 커뮤니티"),
]

def icon(kind, bx, by):
    cx, cy = bx + S * 0.5, by + S * 0.5
    if kind == "magnifier":
        r = S * 0.20; ox, oy = bx + S * 0.42, by + S * 0.42
        draw.ellipse([ox - r, oy - r, ox + r, oy + r], outline=GOLD, width=lw)
        draw.line([ox + r * 0.7, oy + r * 0.7, bx + S * 0.74, by + S * 0.74], fill=GOLD, width=lw + 2)
    elif kind == "clock":
        r = S * 0.28
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=GOLD, width=lw)
        draw.line([cx, cy, cx, cy - r * 0.62], fill=GOLD, width=lw)
        draw.line([cx, cy, cx + r * 0.52, cy], fill=GOLD, width=lw)
    elif kind == "won":
        wf = bold(int(S * 0.6)); wt = "₩"; tw = draw.textlength(wt, font=wf); bb = wf.getbbox(wt)
        draw.text((cx - tw / 2, cy - (bb[3] - bb[1]) / 2 - bb[1]), wt, font=wf, fill=GOLD)
    elif kind == "calendar":
        draw.rounded_rectangle([bx + S * 0.22, by + S * 0.30, bx + S * 0.78, by + S * 0.78],
                               radius=int(S * 0.06), outline=GOLD, width=lw)
        draw.line([bx + S * 0.22, by + S * 0.42, bx + S * 0.78, by + S * 0.42], fill=GOLD, width=lw)
        draw.line([bx + S * 0.36, by + S * 0.24, bx + S * 0.36, by + S * 0.36], fill=GOLD, width=lw)
        draw.line([bx + S * 0.64, by + S * 0.24, bx + S * 0.64, by + S * 0.36], fill=GOLD, width=lw)
    elif kind == "lock":
        draw.rounded_rectangle([bx + S * 0.30, by + S * 0.46, bx + S * 0.70, by + S * 0.76],
                               radius=int(S * 0.05), outline=GOLD, width=lw)
        draw.arc([bx + S * 0.36, by + S * 0.26, bx + S * 0.64, by + S * 0.58], 180, 360, fill=GOLD, width=lw)
    elif kind == "chat":
        draw.rounded_rectangle([bx + S * 0.20, by + S * 0.26, bx + S * 0.80, by + S * 0.64],
                               radius=int(S * 0.10), outline=GOLD, width=lw)
        draw.polygon([(bx + S * 0.34, by + S * 0.64), (bx + S * 0.34, by + S * 0.78),
                      (bx + S * 0.48, by + S * 0.64)], fill=GOLD)

for kind, label in items:
    bx, by = LX, y
    draw.rounded_rectangle([bx, by, bx + S, by + S], radius=int(S * 0.22), outline=GOLD, width=lw)
    icon(kind, bx, by)
    lb = feat.getbbox("가")
    draw.text((bx + S + gap, by + (S - (lb[3] - lb[1])) / 2 - lb[1]), label, font=feat, fill=OFF)
    y += S + int(H * 0.014)

# 6) 스토어 뱃지 (좌하단, 세로 스택: 애플 → 구글)
#    각 PNG의 투명 여백을 트림한 뒤 동일 높이로 정규화 → 크기 일치
def paste_badge(path, x, y, target_h):
    b = Image.open(path).convert("RGBA")
    bb = b.getbbox()
    if bb:
        b = b.crop(bb)
    w = int(b.width * target_h / b.height)
    b = b.resize((w, target_h), Image.LANCZOS)
    base.alpha_composite(b, (x, y))
    return w

BH = int(H * 0.050)        # pill 높이 (트림 후 기준)
y_b = int(H * 0.715)
paste_badge(APPLE, LX, y_b, BH)
paste_badge(GOOGLE, LX, y_b + BH + int(H * 0.022), BH)

out = base.convert("RGB")
out.save(FINAL_HI)
out.resize((1080, 1350), Image.LANCZOS).save(FINAL)
print("saved", FINAL, "and", FINAL_HI, out.size)
