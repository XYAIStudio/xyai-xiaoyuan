#!/usr/bin/env python3
"""Rebuild mascot preview GIFs with per-frame transparency.

Official static poses (`assets/mascot/poses/*.png`, `public/mascots/*.png`,
`assets/showcase/static/*.png`, `assets/mascot/icon-source.png`) are already
transparent RGBA PNGs: corners are alpha 0 and the soft blue glow is kept.

GIF89a only has 1-bit transparency (no per-pixel alpha). Re-encoding the old
studio-black GIF would hard-cut fingertips and glow. Instead this rebuilds
`preview.gif` from poses 01–06 (the original 6-frame cycle) so the glow stays
as near-opaque cyan pixels and only true backdrop (alpha <= threshold) is
punched out.

Outputs (same filename/path in all three trees):
  - assets/mascot/preview.gif
  - assets/showcase/dynamic/preview.gif
  - public/mascots/preview.gif
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
POSE_DIR = ROOT / "assets" / "mascot" / "poses"
GIF_SIZE = 720
FRAME_MS = 700
ALPHA_CUTOFF = 24

# Same 6-frame cycle as the previous studio-backdrop preview.gif
PREVIEW_POSES = [
    "01-挥手问好.png",
    "02-点赞鼓励.png",
    "03-比心.png",
    "04-灵感乍现.png",
    "05-认真思考.png",
    "06-快乐奔跑.png",
]

GIF_TARGETS = [
    ROOT / "assets" / "mascot" / "preview.gif",
    ROOT / "assets" / "showcase" / "dynamic" / "preview.gif",
    ROOT / "public" / "mascots" / "preview.gif",
]

STATIC_GLOBS = [
    ROOT / "assets" / "mascot" / "poses",
    ROOT / "assets" / "showcase" / "static",
    ROOT / "public" / "mascots",
]


def rgba_to_gif_frame(im: Image.Image, threshold: int = ALPHA_CUTOFF) -> Image.Image:
    """Quantize an RGBA frame to 255 colors + 1 transparent index."""
    src = np.array(im.convert("RGBA"))
    trans = src[:, :, 3] <= threshold
    rgb = src[:, :, :3].copy()
    rgb[trans] = (0, 0, 0)
    pal_img = Image.fromarray(rgb, "RGB").quantize(
        colors=255, method=Image.Quantize.MEDIANCUT
    )
    indexed = np.array(pal_img, dtype=np.uint16) + 1
    indexed[trans] = 0
    palette = [0, 0, 0] + list(pal_img.getpalette()[: 255 * 3])
    out = Image.fromarray(indexed.astype(np.uint8), mode="P")
    out.putpalette(palette)
    out.info["transparency"] = 0
    return out


def verify_png_corners(path: Path) -> tuple[bool, str]:
    arr = np.array(Image.open(path).convert("RGBA"))
    h, w = arr.shape[:2]
    corners = [
        arr[0, 0],
        arr[0, w - 1],
        arr[h - 1, 0],
        arr[h - 1, w - 1],
    ]
    ok = all(int(px[3]) == 0 for px in corners)
    sample = ", ".join(str(tuple(int(c) for c in px)) for px in corners)
    return ok, sample


def verify_gif_corners(path: Path) -> tuple[bool, str]:
    im = Image.open(path)
    notes: list[str] = []
    ok = True
    for i in range(getattr(im, "n_frames", 1)):
        im.seek(i)
        arr = np.array(im.convert("RGBA"))
        a = int(arr[0, 0, 3])
        notes.append(f"f{i} corner_a={a}")
        if a != 0:
            ok = False
    return ok, "; ".join(notes)


def rebuild_gif() -> None:
    frames: list[Image.Image] = []
    for name in PREVIEW_POSES:
        src = POSE_DIR / name
        if not src.is_file():
            raise SystemExit(f"missing pose {src}")
        rgba = Image.open(src).convert("RGBA").resize(
            (GIF_SIZE, GIF_SIZE), Image.Resampling.LANCZOS
        )
        frames.append(rgba_to_gif_frame(rgba))

    primary = GIF_TARGETS[0]
    primary.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        primary,
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_MS,
        loop=0,
        disposal=2,
        transparency=0,
        optimize=False,
    )
    for dest in GIF_TARGETS[1:]:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(primary, dest)
        print(f"wrote {dest.relative_to(ROOT)}")
    print(f"wrote {primary.relative_to(ROOT)}")


def report_static() -> int:
    failed = 0
    extra = [ROOT / "assets" / "mascot" / "icon-source.png"]
    paths: list[Path] = extra
    for folder in STATIC_GLOBS:
        paths.extend(sorted(folder.glob("*.png")))
    print("static PNG corner alpha:")
    for path in paths:
        ok, sample = verify_png_corners(path)
        mark = "ok" if ok else "FAIL"
        if not ok:
            failed += 1
        print(f"  [{mark}] {path.relative_to(ROOT)}  {sample}")
    return failed


def main() -> int:
    failed = report_static()
    rebuild_gif()
    print("preview GIF corner alpha:")
    for path in GIF_TARGETS:
        ok, sample = verify_gif_corners(path)
        mark = "ok" if ok else "FAIL"
        if not ok:
            failed += 1
        print(f"  [{mark}] {path.relative_to(ROOT)}  {sample}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
