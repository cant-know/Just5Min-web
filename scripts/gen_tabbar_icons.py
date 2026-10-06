"""
生成微信小程序 tabBar 图标（一次性工具，产物已提交到 static/tabbar/）。

为什么需要：pages.json 里 tabBar 每个 tab 需要 iconPath / selectedIconPath，
且微信要求必须是本地 png（不支持网络图与字体图标），建议 81x81、单张 < 40KB。

实现方式（零第三方依赖，只用标准库）：
  1. 在 6 倍画布上用「逐像素求交」画出纯色扁平图形（多边形 / 圆 / 圆角矩形 / 圆弧）；
  2. 6x6 区块取平均降采样到 81x81 —— 等价于超采样抗锯齿，边缘比直接画 81px 干净；
  3. 用 zlib + struct 手写 PNG 编码（RGBA）。
  这样不需要安装 Pillow，换台机器也能直接重跑。

用法：
    python scripts/gen_tabbar_icons.py
产物：
    static/tabbar/{home,bank,mall,friend,mine}.png          常态 #999999
    static/tabbar/{home,bank,mall,friend,mine}-active.png   选中 #3C7BFF

如需换图标风格，只改 SHAPES 里的图形定义即可，尺寸/颜色/降采样/编码都是通用的。
"""

import math
import os
import struct
import zlib

SUPERSAMPLE = 6
FINAL_SIZE = 81
N = FINAL_SIZE * SUPERSAMPLE  # 486

# 图形坐标统一写在 324x324 的「设计空间」里，最后统一缩放到 N
DESIGN = 324.0
K = N / DESIGN

NORMAL_COLOR = (153, 153, 153)  # #999999，与 pages.json tabBar.color 一致
ACTIVE_COLOR = (60, 123, 255)  # #3C7BFF，与 tabBar.selectedColor 一致

OUT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static", "tabbar")
)


# ----------------------------------------------------------------- 基础图形

def polygon(points):
    """多边形填充（射线法判定内外）"""
    n = len(points)
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    bbox = (min(xs), min(ys), max(xs), max(ys))

    def inside(x, y):
        hit = False
        j = n - 1
        for i in range(n):
            xi, yi = points[i]
            xj, yj = points[j]
            if (yi > y) != (yj > y):
                xint = (xj - xi) * (y - yi) / (yj - yi) + xi
                if x < xint:
                    hit = not hit
            j = i
        return hit

    return inside, bbox


def ellipse(cx, cy, rx, ry):
    """实心椭圆"""
    bbox = (cx - rx, cy - ry, cx + rx, cy + ry)

    def inside(x, y):
        dx = (x - cx) / rx
        dy = (y - cy) / ry
        return dx * dx + dy * dy <= 1.0

    return inside, bbox


def rounded_rect(x0, y0, x1, y1, r):
    """圆角矩形填充"""
    bbox = (x0, y0, x1, y1)
    r = min(r, (x1 - x0) / 2.0, (y1 - y0) / 2.0)

    def inside(x, y):
        if x < x0 or x > x1 or y < y0 or y > y1:
            return False
        # 四角改为圆判定
        if x < x0 + r and y < y0 + r:
            return (x - (x0 + r)) ** 2 + (y - (y0 + r)) ** 2 <= r * r
        if x > x1 - r and y < y0 + r:
            return (x - (x1 - r)) ** 2 + (y - (y0 + r)) ** 2 <= r * r
        if x < x0 + r and y > y1 - r:
            return (x - (x0 + r)) ** 2 + (y - (y1 - r)) ** 2 <= r * r
        if x > x1 - r and y > y1 - r:
            return (x - (x1 - r)) ** 2 + (y - (y1 - r)) ** 2 <= r * r
        return True

    return inside, bbox


def top_arc(cx, cy, radius, width, max_y):
    """上半圆弧（描边）——购物袋提手。max_y 用来只保留圆心以上的部分"""
    bbox = (cx - radius - width, cy - radius - width, cx + radius + width, cy)
    inner = radius - width / 2.0
    outer = radius + width / 2.0

    def inside(x, y):
        if y > max_y:
            return False
        d = math.hypot(x - cx, y - cy)
        return inner <= d <= outer

    return inside, bbox


# ----------------------------------------------------------------- 图标定义

def sym(*shapes):
    """把一个图形绕画布竖直中线镜像（保证绝对左右对称）"""
    out = list(shapes)
    for inside, bbox in shapes:
        x0, y0, x1, y1 = bbox

        def mirrored(inside=inside, x0=x0, x1=x1, y0=y0, y1=y1):
            def fn(x, y):
                return inside(DESIGN - x, y)

            return fn, (DESIGN - x1, y0, DESIGN - x0, y1)

        out.append(mirrored())
    return out


BOOK_LEFT = polygon([(156, 92), (32, 72), (32, 258), (156, 282)])

SHAPES = {
    # 首页：房子（屋顶三角 + 屋身圆角矩形）
    "home": [
        polygon([(162, 34), (20, 168), (304, 168)]),
        rounded_rect(66, 168, 258, 296, 18),
    ],
    # 题库：摊开的书（左右两页，中缝留 12 单位缝隙）
    "bank": sym(BOOK_LEFT),
    # 商城：购物袋（提手圆弧 + 袋身圆角矩形）
    "mall": [
        top_arc(162, 124, 62, 22, 124),
        rounded_rect(54, 120, 270, 296, 26),
    ],
    # 好友：两个人（左大右小，中间留缝以便小尺寸下仍能分辨）
    "friend": [
        ellipse(104, 104, 46, 46),
        rounded_rect(34, 176, 160, 300, 46),
        ellipse(224, 124, 38, 38),
        rounded_rect(176, 196, 294, 300, 38),
    ],
    # 我的：单个人（头 + 肩）
    "mine": [
        ellipse(162, 114, 52, 52),
        rounded_rect(52, 190, 272, 308, 58),
    ],
}


# ----------------------------------------------------------------- 光栅化

def rasterize(icon_name):
    """返回 N x N 的 alpha 覆盖度（bytearray，0~255）"""
    canvas = bytearray(N * N)
    for inside, bbox in SHAPES[icon_name]:
        sx0 = max(0, int(bbox[0] * K) - 1)
        sy0 = max(0, int(bbox[1] * K) - 1)
        sx1 = min(N, int(bbox[2] * K) + 2)
        sy1 = min(N, int(bbox[3] * K) + 2)
        for py in range(sy0, sy1):
            y = (py + 0.5) / K
            base = py * N
            for px in range(sx0, sx1):
                if inside((px + 0.5) / K, y):
                    canvas[base + px] = 255
    return canvas


def downsample(canvas):
    """SUPERSAMPLE x SUPERSAMPLE 区块取平均 —— 超采样抗锯齿"""
    out = []
    block = SUPERSAMPLE * SUPERSAMPLE
    for oy in range(FINAL_SIZE):
        row = []
        for ox in range(FINAL_SIZE):
            total = 0
            for dy in range(SUPERSAMPLE):
                base = (oy * SUPERSAMPLE + dy) * N + ox * SUPERSAMPLE
                total += sum(canvas[base:base + SUPERSAMPLE])
            row.append(total // block)
        out.append(row)
    return out


# ----------------------------------------------------------------- PNG 编码

def _chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path, alpha_rows, color):
    """写 RGBA PNG：颜色固定，alpha 用覆盖度（透明背景）"""
    r, g, b = color
    raw = bytearray()
    for row in alpha_rows:
        raw.append(0)  # filter type 0 (None)
        for a in row:
            raw += bytes((r, g, b, a))

    ihdr = struct.pack(">IIBBBBB", FINAL_SIZE, FINAL_SIZE, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + _chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for name in SHAPES:
        alpha_rows = downsample(rasterize(name))
        for suffix, color in (("", NORMAL_COLOR), ("-active", ACTIVE_COLOR)):
            path = os.path.join(OUT_DIR, name + suffix + ".png")
            write_png(path, alpha_rows, color)
            print("  %-46s %6d bytes" % (os.path.relpath(path, OUT_DIR), os.path.getsize(path)))
    print("done -> " + OUT_DIR)


if __name__ == "__main__":
    main()
