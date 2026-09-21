#!/usr/bin/env python3
"""Generate original companion BGM + SFX for XYAI精灵小元.

All audio is synthesized in this script (no third-party samples).
Output is 16-bit PCM WAV, CC0 / original to this repository.

Usage:
    python3 scripts/generate-audio.py
"""

from __future__ import annotations

import math
import os
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RATE = 22_050


def clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return lo if value < lo else hi if value > hi else value


def write_wav(path: Path, samples: list[float], rate: int = RATE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = b"".join(
        struct.pack("<h", int(clamp(sample) * 32767.0)) for sample in samples
    )
    with wave.open(str(path), "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(frames)


def env(index: int, total: int, attack: float = 0.01, release: float = 0.08) -> float:
    if total <= 1:
        return 0.0
    t = index / (total - 1)
    a = min(1.0, t / attack) if attack > 0 else 1.0
    r = min(1.0, (1.0 - t) / release) if release > 0 else 1.0
    return a * r


def sine(index: int, freq: float, rate: int = RATE) -> float:
    return math.sin(2.0 * math.pi * freq * index / rate)


def soft_noise(index: int, seed: int = 1) -> float:
    # Deterministic cheap hash → [-1, 1]
    x = (index * 1103515245 + seed * 12345) & 0x7FFFFFFF
    return (x / 0x7FFFFFFF) * 2.0 - 1.0


def lowpass(samples: list[float], alpha: float = 0.12) -> list[float]:
    out: list[float] = []
    acc = 0.0
    for sample in samples:
        acc += alpha * (sample - acc)
        out.append(acc)
    return out


def companion_loop(seconds: float = 8.0) -> list[float]:
    """Soft pentatonic pad that loops: C4–E4–G4–A4 with slow tremolo."""
    n = int(RATE * seconds)
    freqs = (261.63, 329.63, 392.00, 440.00)
    samples: list[float] = []
    for i in range(n):
        t = i / RATE
        # Crossfade the last 80ms into the first 80ms for a seamless loop.
        pad = 0.0
        for k, freq in enumerate(freqs):
            wobble = 1.0 + 0.004 * math.sin(2.0 * math.pi * (0.07 + 0.02 * k) * t)
            amp = 0.085 + 0.035 * math.sin(2.0 * math.pi * (0.05 + 0.013 * k) * t + k)
            pad += amp * sine(i, freq * wobble)
        bass = 0.06 * sine(i, 130.81) * (0.7 + 0.3 * math.sin(2.0 * math.pi * 0.04 * t))
        breath = 0.012 * soft_noise(i, 9)
        sample = pad + bass + breath
        samples.append(sample)
    # Equal-power-ish loop crossfade
    fade = int(RATE * 0.08)
    for i in range(fade):
        w = i / fade
        samples[i] = samples[i] * w + samples[n - fade + i] * (1.0 - w)
    samples = samples[: n - fade]
    return lowpass(samples, 0.18)


def chime(freqs: tuple[float, ...], duration: float, volume: float = 0.42) -> list[float]:
    n = int(RATE * duration)
    samples: list[float] = []
    for i in range(n):
        t = i / RATE
        tone = 0.0
        for k, freq in enumerate(freqs):
            decay = math.exp(-t * (3.2 + k * 0.7))
            tone += decay * sine(i, freq) * (1.0 / len(freqs))
        samples.append(volume * tone * env(i, n, 0.004, 0.18))
    return samples


def pat() -> list[float]:
    n = int(RATE * 0.16)
    samples: list[float] = []
    for i in range(n):
        t = i / RATE
        thump = math.exp(-t * 28.0) * sine(i, 210.0)
        tick = math.exp(-t * 55.0) * soft_noise(i, 3) * 0.35
        samples.append(0.55 * (thump + tick) * env(i, n, 0.002, 0.25))
    return lowpass(samples, 0.35)


def feed() -> list[float]:
    return chime((523.25, 659.25, 783.99), 0.32, 0.38)


def pomodoro() -> list[float]:
    return chime((392.00, 523.25), 0.55, 0.4)


def message() -> list[float]:
    n = int(RATE * 0.28)
    samples: list[float] = []
    for i in range(n):
        t = i / RATE
        freq = 659.25 if t < 0.11 else 783.99
        samples.append(0.36 * math.exp(-t * 6.5) * sine(i, freq) * env(i, n, 0.004, 0.2))
    return samples


def pose_change() -> list[float]:
    n = int(RATE * 0.22)
    samples: list[float] = []
    for i in range(n):
        t = i / RATE
        freq = 420.0 + 260.0 * t
        samples.append(0.28 * math.exp(-t * 8.0) * sine(i, freq) * env(i, n, 0.01, 0.2))
    return samples


def idle() -> list[float]:
    n = int(RATE * 0.5)
    samples: list[float] = []
    for i in range(n):
        t = i / RATE
        freq = 246.94 - 40.0 * t
        samples.append(0.22 * math.exp(-t * 2.8) * sine(i, freq) * env(i, n, 0.04, 0.3))
    return lowpass(samples, 0.2)


def error() -> list[float]:
    n = int(RATE * 0.28)
    samples: list[float] = []
    for i in range(n):
        t = i / RATE
        tone = 0.55 * sine(i, 196.0) + 0.45 * sine(i, 185.0)
        samples.append(0.34 * math.exp(-t * 5.0) * tone * env(i, n, 0.006, 0.22))
    return samples


def hover() -> list[float]:
    n = int(RATE * 0.08)
    samples: list[float] = []
    for i in range(n):
        samples.append(0.16 * sine(i, 880.0) * env(i, n, 0.01, 0.4))
    return samples


CUES = {
    "music/companion-loop.wav": companion_loop,
    "sfx/pat.wav": pat,
    "sfx/feed.wav": feed,
    "sfx/pomodoro.wav": pomodoro,
    "sfx/message-received.wav": message,
    "sfx/pose-change.wav": pose_change,
    "sfx/idle.wav": idle,
    "sfx/error.wav": error,
    "sfx/hover.wav": hover,
}


def main() -> None:
    destinations = [ROOT / "assets" / "audio", ROOT / "public" / "audio"]
    for dest in destinations:
        for rel, factory in CUES.items():
            samples = factory()
            write_wav(dest / rel, samples)
            print(f"wrote {dest / rel} ({len(samples)} samples)")


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
