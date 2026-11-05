"""Generador nativo (cero dependencias externas) del icono multi-resolucion vozstudio.ico."""

from __future__ import annotations

import math
from pathlib import Path
import struct
import zlib


def _encode_rgba_png(width: int, height: int, rgba_bytes: bytes) -> bytes:
    """Codifica un buffer RGBA en un PNG valido en memoria usando stdlib struct + zlib."""
    raw_rows = bytearray()
    stride = width * 4
    for y in range(height):
        raw_rows.append(0)  # filtro None
        offset = y * stride
        raw_rows.extend(rgba_bytes[offset : offset + stride])

    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw_rows), level=9)
    return b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", idat) + _chunk(b"IEND", b"")


def _render_icon_frame(size: int) -> bytes:
    """Renderiza el emblema acustico de lineas luminosas sobre cristal obsidiana."""
    buf = bytearray(size * size * 4)
    cx = (size - 1) / 2.0
    cy = (size - 1) / 2.0
    radius = size * 0.44
    corner = size * 0.22

    # Alturas relativas de las 5 barras de linea acustica
    bar_x_norms = [-0.46, -0.23, 0.0, 0.23, 0.46]
    bar_h_norms = [0.28, 0.52, 0.76, 0.48, 0.30]
    bar_half_w = max(1.1, size * 0.042)

    for y in range(size):
        ny = (y - cy) / radius
        for x in range(size):
            nx = (x - cx) / radius
            idx = (y * size + x) * 4

            # Mascara superelipse / squircle
            dx = max(abs(x - cx) - (radius - corner), 0.0)
            dy = max(abs(y - cy) - (radius - corner), 0.0)
            dist = math.hypot(dx, dy)
            if dist > corner + 1.0:
                continue

            alpha = 255
            if dist > corner - 0.8:
                alpha = int(max(0.0, min(1.0, (corner + 0.8 - dist) / 1.6)) * 255)

            # Fondo obsidiana con resplandor radial cyan oscuro
            glow = max(0.0, 1.0 - math.hypot(nx * 0.85, ny * 0.85))
            r = int(6 + 10 * glow)
            g = int(11 + 28 * glow)
            b = int(20 + 46 * glow)

            # Borde sutil luminoso
            if dist > corner - max(1.5, size * 0.03):
                r = min(255, r + 18)
                g = min(255, g + 140)
                b = min(255, b + 185)

            # Barras acusticas centrales
            for bx, bh in zip(bar_x_norms, bar_h_norms):
                px_bar = cx + bx * radius * 0.85
                half_h = bh * radius * 0.72
                if abs(x - px_bar) <= bar_half_w and abs(y - cy) <= half_h:
                    # Gradiente vertical cyan -> ambar sutil en la cresta
                    t = abs(y - cy) / max(1.0, half_h)
                    r = int(14 * (1.0 - t) + 56 * t)
                    g = int(215 * (1.0 - t) + 189 * t)
                    b = int(242 * (1.0 - t) + 248 * t)
                    break

            buf[idx] = r
            buf[idx + 1] = g
            buf[idx + 2] = b
            buf[idx + 3] = alpha

    return _encode_rgba_png(size, size, bytes(buf))


def build_ico(output_path: Path) -> Path:
    """Construye un archivo .ico valido con capas PNG de 256, 64, 32 y 16 px."""
    sizes = [256, 64, 32, 16]
    png_blobs = [_render_icon_frame(s) for s in sizes]

    header = struct.pack("<HHH", 0, 1, len(sizes))
    entries = bytearray()
    offset = 6 + 16 * len(sizes)

    for s, blob in zip(sizes, png_blobs):
        dim_byte = 0 if s >= 256 else s
        entries.extend(
            struct.pack(
                "<BBBBHHII",
                dim_byte,
                dim_byte,
                0,
                0,
                1,
                32,
                len(blob),
                offset,
            )
        )
        offset += len(blob)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(header + bytes(entries) + b"".join(png_blobs))
    return output_path


if __name__ == "__main__":
    target = Path(__file__).resolve().parent / "vozstudio.ico"
    build_ico(target)
    print(f"Icono generado: {target} ({target.stat().st_size} bytes)")
