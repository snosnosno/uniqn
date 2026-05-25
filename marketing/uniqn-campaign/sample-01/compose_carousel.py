# -*- coding: utf-8 -*-
"""UNIQN 캐러셀 기능 슬라이드 — base(폰 우측) + 실제 로고 + 기능 헤드라인."""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, "assets", "uniqn-logo.png")
MALGUNBD = "C:/Windows/Fonts/malgunbd.ttf"
GOLD = (212, 175, 55, 255)
OFF = (235, 232, 222, 255)
WHITE = (255, 255, 255, 255)
DARK = (5, 5, 8)

def bold(sz):
    return ImageFont.truetype(MALGUNBD, sz)

def render(base_name, out_name, l1, l2, sub):
    base = Image.open(os.path.join(HERE, base_name)).convert("RGBA")
    W, H = base.size
    # 좌측 스크림
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    x_end = int(W * 0.52)
    for x in range(x_end):
        a = int(210 * (1 - x / x_end))
        sd.line([(x, 0), (x, H)], fill=(DARK[0], DARK[1], DARK[2], a))
    base = Image.alpha_composite(base, scrim)
    draw = ImageDraw.Draw(base)
    LX = int(W * 0.066)

    # 로고 (유니콘 엠블럼 + UNIQN 워드마크)
    logo = Image.open(LOGO).convert("RGBA")
    lh = int(W * 0.105)
    lw = int(logo.width * lh / logo.height)
    ly = int(H * 0.045)
    base.alpha_composite(logo.resize((lw, lh), Image.LANCZOS), (LX, ly))
    wm = bold(int(W * 0.056))
    wbb = wm.getbbox("UNIQN")
    x0 = LX + lw + int(W * 0.018)
    yy = ly + (lh - (wbb[3] - wbb[1])) // 2 - wbb[1]
    for ch in "UNIQN":
        draw.text((x0, yy), ch, font=wm, fill=GOLD)
        x0 += draw.textlength(ch, font=wm) + 8

    # 헤드라인 2줄
    hl = bold(int(W * 0.064))
    lhh = int(W * 0.064 * 1.26)
    y = int(H * 0.225)
    draw.text((LX, y), l1, font=hl, fill=WHITE)
    y += lhh
    draw.text((LX, y), l2, font=hl, fill=GOLD)
    y += lhh

    # 디바이더
    y += int(H * 0.012)
    dw, dh = int(W * 0.072), max(5, int(H * 0.0035))
    draw.rounded_rectangle([LX, y, LX + dw, y + dh], radius=dh // 2, fill=GOLD)
    y += int(H * 0.030)

    # 서브 카피
    sf = bold(int(W * 0.030))
    draw.text((LX, y), sub, font=sf, fill=OFF)

    out = base.convert("RGB")
    hi = os.path.join(HERE, out_name.replace(".png", "-hi.png"))
    out.save(hi)
    out.resize((1080, 1350), Image.LANCZOS).save(os.path.join(HERE, out_name))
    print("saved", out_name, out.size)

render("base-feat-schedule.png", "carousel-2-schedule.png", "내 스케줄", "자동 관리", "근무 일정과 수익을 한눈에")
render("base-feat-board.png", "carousel-3-community.png", "자유·TDA 토론", "커뮤니티", "포커 업계 전문 게시판")
