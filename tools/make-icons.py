#!/usr/bin/env python3
"""Generate the PWA icons (development only - outputs are committed).

Pure stdlib: rasterises a few rounded rectangles with 3x supersampling and
writes PNGs by hand, so the project needs no image libraries or CDNs.

Run: python3 tools/make-icons.py
"""
import os, struct, zlib

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')

BG      = (0x11, 0x18, 0x27)   # slate-900, matches manifest background_color
ACCENT  = (0x6d, 0x8b, 0xff)   # indigo accent used across the UI
CARD    = (0xf8, 0xfa, 0xfc)   # near-white bars
MUTED   = (0x94, 0xa3, 0xb8)


def rounded_rect(x, y, w, h, r):
    """Return a coverage test for a rounded rectangle."""
    def inside(px, py):
        if px < x or py < y or px > x + w or py > y + h:
            return False
        cx = min(max(px, x + r), x + w - r)
        cy = min(max(py, y + r), y + h - r)
        dx, dy = px - cx, py - cy
        return dx * dx + dy * dy <= r * r
    return inside


def render(size, padding_ratio):
    """Draw the icon: a rounded card with a header bar and three schedule rows."""
    ss = 3                      # supersampling factor
    S = size * ss
    pad = S * padding_ratio

    inner = S - 2 * pad
    shapes = []

    # Background plate (full bleed so maskable icons never show transparency).
    shapes.append((rounded_rect(0, 0, S, S, S * 0.18 if padding_ratio == 0.0 else S * 0.22), BG))

    card_x, card_y = pad, pad
    card_w, card_h = inner, inner
    shapes.append((rounded_rect(card_x, card_y, card_w, card_h, card_w * 0.16), (0x1e, 0x29, 0x3b)))

    # Accent header strip: the card shape clipped to its top band, so the strip
    # inherits the card's exact corner radius and ends on a flat edge.
    card_shape = rounded_rect(card_x, card_y, card_w, card_h, card_w * 0.16)
    hdr_bottom = card_y + card_h * 0.26
    shapes.append((lambda px, py: card_shape(px, py) and py <= hdr_bottom, ACCENT))

    # Three schedule rows: a short time pill plus a longer course bar.
    row_h = card_h * 0.115
    gap = card_h * 0.075
    top = card_y + card_h * 0.36
    for i in range(3):
        ry = top + i * (row_h + gap)
        shapes.append((rounded_rect(card_x + card_w * 0.11, ry, card_w * 0.20, row_h, row_h / 2),
                       ACCENT if i == 0 else MUTED))
        shapes.append((rounded_rect(card_x + card_w * 0.37, ry, card_w * 0.52, row_h, row_h / 2),
                       CARD if i == 0 else (0x64, 0x74, 0x8b)))

    # Rasterise with box-filter downsampling.
    px = bytearray()
    rows = []
    for py in range(S):
        row = []
        for pxi in range(S):
            color = (0, 0, 0)
            alpha = 0
            for test, col in shapes:
                if test(pxi + 0.5, py + 0.5):
                    color, alpha = col, 255
            row.append((color[0], color[1], color[2], alpha))
        rows.append(row)

    out = []
    for y in range(size):
        line = bytearray()
        for x in range(size):
            r = g = b = a = 0
            for dy in range(ss):
                for dx in range(ss):
                    pr, pg, pb, pa = rows[y * ss + dy][x * ss + dx]
                    r += pr; g += pg; b += pb; a += pa
            n = ss * ss
            line += bytes((r // n, g // n, b // n, a // n))
        out.append(bytes(line))
    return out


def write_png(path, rows, size):
    raw = b''.join(b'\x00' + r for r in rows)
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    return len(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ('icon-192.png', 192, 0.10),
        ('icon-512.png', 512, 0.10),
        ('icon-maskable-512.png', 512, 0.20),   # extra safe-zone padding
        ('apple-touch-icon.png', 180, 0.10),
    ]
    for name, size, pad in jobs:
        rows = render(size, pad)
        n = write_png(os.path.join(OUT, name), rows, size)
        print(f'{name:26s} {size}x{size}  {n:>6} bytes')


if __name__ == '__main__':
    main()
