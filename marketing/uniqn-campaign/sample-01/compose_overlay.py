# -*- coding: utf-8 -*-
"""UNIQN 좌우 스플릿 마케팅 컷 — 베이스(폰+배경) 위에 한글 카피/아이콘 오버레이.
브라우저 대신 PIL 사용: 크롭/레터박스 없이 베이스 원본 해상도에서 합성."""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, "appcomp-base.png")
FINAL = os.path.join(HERE, "appcomp-final.png")          # 1080x1350 (IG)
FINAL_HI = os.path.join(HERE, "appcomp-final-hi.png")    # 원본 해상도

MALGUNBD = "C:/Windows/Fonts/malgunbd.ttf"

GOLD  = (212, 175, 55, 255)
OFF   = (245, 243, 236, 255)
WHITE = (255, 255, 255, 255)
DARK  = (5, 5, 8)

base = Image.open(BASE).convert("RGBA")
W, H = base.size

# 1) 좌측 가독용 스크림 (왼쪽 어둡게 → 62% 지점에서 투명)
scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(scrim)
x_end = int(W * 0.62)
for x in range(x_end):
    a = int(238 * (1 - x / x_end))
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

# 2) 브랜드 로고
draw_spaced(draw, (LX, int(H * 0.065)), "UNIQN", bold(int(W * 0.042)), GOLD, 10)

# 3) 헤드라인 (정산 = 골드)
hl = bold(int(W * 0.056))
lh = int(W * 0.056 * 1.30)
y = int(H * 0.145)
x = LX
for t, c in [("구인부터 ", WHITE), ("정산", GOLD), ("까지,", WHITE)]:
    draw.text((x, y), t, font=hl, fill=c)
    x += draw.textlength(t, font=hl)
y += lh
draw.text((LX, y), "한 앱에서", font=hl, fill=WHITE)
y += lh

# 4) 골드 디바이더
y += int(H * 0.012)
dw = int(W * 0.082)
dh = max(5, int(H * 0.004))
draw.rounded_rectangle([LX, y, LX + dw, y + dh], radius=dh // 2, fill=GOLD)
y += int(H * 0.032)

# 5) 기능 3필러 (골드 라인 아이콘 직접 그림)
feat = bold(int(W * 0.034))
S = int(W * 0.058)        # 아이콘 박스
gap = int(W * 0.017)
items = [("magnifier", "홀덤 전문 구인구직"), ("clock", "QR 출퇴근"), ("won", "자동 정산")]
lw_icon = max(5, int(S * 0.06))
for icon, label in items:
    bx, by = LX, y
    draw.rounded_rectangle([bx, by, bx + S, by + S], radius=int(S * 0.22),
                           outline=GOLD, width=lw_icon)
    cx, cy = bx + S * 0.5, by + S * 0.5
    if icon == "magnifier":
        r = S * 0.20
        ox, oy = bx + S * 0.42, by + S * 0.42
        draw.ellipse([ox - r, oy - r, ox + r, oy + r], outline=GOLD, width=lw_icon)
        draw.line([ox + r * 0.7, oy + r * 0.7, bx + S * 0.74, by + S * 0.74],
                  fill=GOLD, width=lw_icon + 2)
    elif icon == "clock":
        r = S * 0.28
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=GOLD, width=lw_icon)
        draw.line([cx, cy, cx, cy - r * 0.62], fill=GOLD, width=lw_icon)
        draw.line([cx, cy, cx + r * 0.52, cy], fill=GOLD, width=lw_icon)
    else:  # won
        wf = bold(int(S * 0.6))
        wt = "₩"
        tw = draw.textlength(wt, font=wf)
        bb = wf.getbbox(wt)
        draw.text((cx - tw / 2, cy - (bb[3] - bb[1]) / 2 - bb[1]), wt, font=wf, fill=GOLD)
    # 라벨 수직 중앙
    lb = feat.getbbox("가")
    draw.text((bx + S + gap, by + (S - (lb[3] - lb[1])) / 2 - lb[1]),
              label, font=feat, fill=OFF)
    y += S + int(H * 0.018)

out = base.convert("RGB")
out.save(FINAL_HI)
out.resize((1080, 1350), Image.LANCZOS).save(FINAL)
print("saved:", FINAL, out.size, "->", (1080, 1350))
print("hi   :", FINAL_HI, out.size)
