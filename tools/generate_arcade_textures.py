#!/usr/bin/env python3
import math
import os
import random
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "resources" / "textures"
SEED = 20260322


def clamp(value: float) -> int:
    return max(0, min(255, int(round(value))))


def mix(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def mix_color(c1, c2, t: float):
    return tuple(clamp(mix(c1[i], c2[i], t)) for i in range(4))


def add_color(c1, c2, amount: float):
    return tuple(clamp(c1[i] + c2[i] * amount) for i in range(4))


def scale_color(c, factor: float):
    return (clamp(c[0] * factor), clamp(c[1] * factor), clamp(c[2] * factor), c[3])


def rgba(r, g, b, a=255):
    return (r, g, b, a)


class ImageBuffer:
    def __init__(self, width: int, height: int, fill):
        self.width = width
        self.height = height
        self.pixels = [fill for _ in range(width * height)]

    def idx(self, x: int, y: int) -> int:
        return y * self.width + x

    def get(self, x: int, y: int):
        return self.pixels[self.idx(x, y)]

    def set(self, x: int, y: int, color):
        self.pixels[self.idx(x, y)] = color


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge0 == edge1:
        return 0.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def hash_noise(x: int, y: int, seed: int) -> float:
    value = math.sin((x * 127.1 + y * 311.7 + seed * 0.12345)) * 43758.5453
    return value - math.floor(value)


def fbm_noise(x: float, y: float, seed: int) -> float:
    total = 0.0
    amplitude = 0.5
    frequency = 1.0
    for octave in range(4):
        sx = int(x * frequency)
        sy = int(y * frequency)
        total += hash_noise(sx + octave * 17, sy + octave * 37, seed + octave * 101) * amplitude
        frequency *= 1.95
        amplitude *= 0.5
    return total


def rounded_rect_mask(px: int, py: int, width: int, height: int, radius: float) -> float:
    half_w = width / 2.0
    half_h = height / 2.0
    dx = abs(px + 0.5 - half_w) - (half_w - radius)
    dy = abs(py + 0.5 - half_h) - (half_h - radius)
    outside_x = max(dx, 0.0)
    outside_y = max(dy, 0.0)
    outside = math.hypot(outside_x, outside_y)
    inside = min(max(dx, dy), 0.0)
    signed_distance = outside + inside - radius
    return 1.0 - smoothstep(-1.5, 1.5, signed_distance)


def ellipse_mask(px: int, py: int, width: int, height: int, edge_softness=1.5) -> float:
    nx = (px + 0.5 - width / 2.0) / (width / 2.0)
    ny = (py + 0.5 - height / 2.0) / (height / 2.0)
    distance = math.sqrt(nx * nx + ny * ny)
    return 1.0 - smoothstep(1.0 - edge_softness / max(width, height), 1.0, distance)


def draw_panel(path: Path, width: int, height: int, outer, inner, accent, gloss_alpha=32):
    img = ImageBuffer(width, height, rgba(0, 0, 0, 0))
    radius = min(width, height) * 0.16
    for y in range(height):
        for x in range(width):
            mask = rounded_rect_mask(x, y, width, height, radius)
            if mask <= 0:
                continue
            v = y / max(1, height - 1)
            h = x / max(1, width - 1)
            base = mix_color(outer, inner, 0.24 + v * 0.62)
            brushed = (fbm_noise(x * 0.35, y * 0.09, SEED) - 0.5) * 26.0
            edge = max(
                0.0,
                1.0 - min(x, width - 1 - x, y, height - 1 - y) / (min(width, height) * 0.12),
            )
            highlight = smoothstep(0.0, 0.48, 1.0 - abs(v - 0.16) * 2.8) * gloss_alpha
            center_focus = 1.0 - smoothstep(0.08, 0.92, max(abs(h - 0.5), abs(v - 0.5)) * 1.78)
            border = smoothstep(0.0, 1.0, edge) * 0.88
            top_rim = smoothstep(0.0, 0.12, 1.0 - v) * 0.92
            bottom_rim = smoothstep(0.0, 0.16, v) * 0.55
            grime = (fbm_noise(x * 0.12, y * 0.42, SEED + 7) - 0.5) * 18.0
            color = (
                clamp(base[0] + brushed + accent[0] * border * 0.24 + accent[0] * top_rim * 0.18 + highlight + center_focus * 8 + grime * 0.4),
                clamp(base[1] + brushed + accent[1] * border * 0.18 + accent[1] * top_rim * 0.12 + highlight + center_focus * 6 + grime * 0.32),
                clamp(base[2] + brushed + accent[2] * border * 0.12 + accent[2] * bottom_rim * 0.08 + highlight * 0.88 + center_focus * 4 + grime * 0.24),
                clamp(255 * mask),
            )
            if h > 0.82:
                color = add_color(color, (8, 8, 10, 0), 0.55)
            img.set(x, y, color)
    write_png(path, img)


def draw_button(path: Path, width: int, height: int, top, bottom, edge):
    img = ImageBuffer(width, height, rgba(0, 0, 0, 0))
    radius = min(width, height) * 0.22
    for y in range(height):
        for x in range(width):
            mask = rounded_rect_mask(x, y, width, height, radius)
            if mask <= 0:
                continue
            v = y / max(1, height - 1)
            h = x / max(1, width - 1)
            base = mix_color(top, bottom, v)
            shine = smoothstep(0.0, 0.42, 1.0 - abs(v - 0.14) * 3.6) * 60.0
            edge_strength = max(
                0.0,
                1.0 - min(x, width - 1 - x, y, height - 1 - y) / (min(width, height) * 0.13),
            )
            noise = (fbm_noise(x * 0.28, y * 0.2, SEED + 19) - 0.5) * 14.0
            center_focus = 1.0 - smoothstep(0.14, 0.94, max(abs(h - 0.5), abs(v - 0.5)) * 1.82)
            inner_shadow = smoothstep(0.18, 0.92, v) * 18.0
            color = (
                clamp(base[0] + shine + edge[0] * edge_strength * 0.28 + center_focus * 10 + noise - inner_shadow * 0.08),
                clamp(base[1] + shine + edge[1] * edge_strength * 0.2 + center_focus * 7 + noise - inner_shadow * 0.06),
                clamp(base[2] + shine + edge[2] * edge_strength * 0.16 + center_focus * 5 + noise - inner_shadow * 0.04),
                clamp(mask * 255),
            )
            img.set(x, y, color)
    write_png(path, img)


def draw_felt(path: Path, width: int, height: int, dark, light):
    img = ImageBuffer(width, height, rgba(0, 0, 0, 255))
    for y in range(height):
        for x in range(width):
            nx = (x + 0.5) / width
            ny = (y + 0.5) / height
            dist_x = abs(nx - 0.5) / 0.5
            dist_y = abs(ny - 0.5) / 0.5
            vignette = max(dist_x * dist_x, dist_y * dist_y)
            t = 0.18 + (1.0 - vignette) * 0.68
            base = mix_color(dark, light, t)
            felt_noise = (fbm_noise(x * 0.75, y * 0.75, SEED + 31) - 0.5) * 18.0
            stripe = math.sin((x * 0.08 + y * 0.014) * math.pi) * 4.0
            color = (
                clamp(base[0] + felt_noise * 0.35 + stripe),
                clamp(base[1] + felt_noise + stripe * 0.7),
                clamp(base[2] + felt_noise * 0.22),
                255,
            )
            img.set(x, y, color)
    write_png(path, img)


def draw_wood(path: Path, width: int, height: int, dark, mid, highlight, brass):
    img = ImageBuffer(width, height, rgba(0, 0, 0, 255))
    for y in range(height):
        for x in range(width):
            nx = (x + 0.5) / width
            ny = (y + 0.5) / height
            grain = math.sin((nx * 19.0 + fbm_noise(x * 0.16, y * 0.11, SEED + 47) * 4.0) * math.pi)
            burl = fbm_noise(x * 0.35, y * 0.2, SEED + 53)
            t = 0.45 + grain * 0.18 + (burl - 0.5) * 0.32
            base = mix_color(dark, mid, max(0.0, min(1.0, t)))
            base = mix_color(base, highlight, smoothstep(0.62, 0.98, burl) * 0.3)
            brass_edge = 0.0
            if ny < 0.12 or ny > 0.88:
                brass_edge = smoothstep(0.0, 0.12, min(ny, 1.0 - ny))
                brass_edge = 1.0 - brass_edge
            rail_shadow = smoothstep(0.0, 0.12, abs(ny - 0.5) * 2.0) * 14.0
            cross_gloss = smoothstep(0.0, 0.18, 1.0 - abs(nx - 0.5) * 2.0) * 10.0
            color = (
                clamp(base[0] + brass[0] * brass_edge * 0.26 + cross_gloss - rail_shadow * 0.24),
                clamp(base[1] + brass[1] * brass_edge * 0.18 + cross_gloss * 0.68 - rail_shadow * 0.16),
                clamp(base[2] + brass[2] * brass_edge * 0.1 + cross_gloss * 0.42 - rail_shadow * 0.1),
                255,
            )
            img.set(x, y, color)
    write_png(path, img)


def draw_pocket(path: Path, width: int, height: int, ring, center):
    img = ImageBuffer(width, height, rgba(0, 0, 0, 0))
    for y in range(height):
        for x in range(width):
            mask = ellipse_mask(x, y, width, height, 2.0)
            if mask <= 0:
                continue
            nx = (x + 0.5 - width / 2.0) / (width / 2.0)
            ny = (y + 0.5 - height / 2.0) / (height / 2.0)
            distance = math.sqrt(nx * nx + ny * ny)
            ring_strength = smoothstep(0.68, 0.94, distance)
            shade = smoothstep(0.0, 1.0, (ny + 1.0) * 0.5)
            base = mix_color(center, scale_color(center, 0.55), shade)
            color = (
                clamp(base[0] + ring[0] * ring_strength * 0.24),
                clamp(base[1] + ring[1] * ring_strength * 0.19),
                clamp(base[2] + ring[2] * ring_strength * 0.14),
                clamp(mask * 255),
            )
            img.set(x, y, color)
    write_png(path, img)


def write_png(path: Path, image: ImageBuffer):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = bytearray()
    for y in range(image.height):
        raw.append(0)
        row = image.pixels[y * image.width:(y + 1) * image.width]
        for r, g, b, a in row:
            raw.extend((r, g, b, a))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", image.width, image.height, 8, 6, 0, 0, 0)
    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png.extend(chunk(b"IHDR", ihdr))
    png.extend(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
    png.extend(chunk(b"IEND", b""))
    path.write_bytes(png)


def main():
    random.seed(SEED)
    draw_panel(
        OUT / "ui" / "panel_dark.png",
        256,
        256,
        rgba(14, 16, 18),
        rgba(42, 46, 52),
        rgba(220, 186, 108),
        gloss_alpha=34,
    )
    draw_panel(
        OUT / "ui" / "panel_inset.png",
        256,
        128,
        rgba(18, 20, 22),
        rgba(36, 38, 44),
        rgba(208, 176, 100),
        gloss_alpha=26,
    )
    draw_panel(
        OUT / "ui" / "top_strip.png",
        1024,
        96,
        rgba(13, 14, 17),
        rgba(36, 38, 42),
        rgba(224, 188, 102),
        gloss_alpha=26,
    )
    draw_panel(
        OUT / "ui" / "backdrop.png",
        1024,
        512,
        rgba(10, 12, 12),
        rgba(24, 30, 28),
        rgba(76, 112, 86),
        gloss_alpha=10,
    )
    draw_button(OUT / "ui" / "button_green.png", 256, 96, rgba(116, 234, 128), rgba(24, 132, 58), rgba(255, 246, 198))
    draw_button(OUT / "ui" / "button_blue.png", 256, 96, rgba(126, 194, 255), rgba(34, 102, 178), rgba(246, 248, 255))
    draw_button(OUT / "ui" / "button_bronze.png", 256, 96, rgba(212, 156, 86), rgba(106, 62, 26), rgba(255, 232, 184))
    draw_button(OUT / "ui" / "button_neutral.png", 256, 96, rgba(146, 150, 160), rgba(58, 64, 74), rgba(246, 248, 250))
    draw_button(OUT / "ui" / "button_red.png", 256, 96, rgba(246, 136, 114), rgba(138, 44, 38), rgba(255, 236, 228))
    draw_felt(OUT / "table" / "felt.png", 1024, 512, rgba(24, 102, 56), rgba(66, 166, 88))
    draw_wood(OUT / "table" / "wood_frame.png", 1024, 512, rgba(62, 24, 14), rgba(126, 60, 30), rgba(188, 100, 52), rgba(220, 184, 102))
    draw_pocket(OUT / "table" / "pocket.png", 128, 128, rgba(212, 172, 96), rgba(10, 10, 12))
    print("generated", OUT)


if __name__ == "__main__":
    main()
