#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  "public/audio/music/companion-loop.wav",
  "public/audio/sfx/pat.wav",
  "public/audio/sfx/feed.wav",
  "public/audio/sfx/pomodoro.wav",
  "public/audio/sfx/message-received.wav",
];

function rms(buf) {
  if (
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("not a WAVE file");
  }
  const dataAt = buf.indexOf(Buffer.from("data"));
  if (dataAt < 0) throw new Error("missing data chunk");
  const samples = buf.subarray(dataAt + 8);
  let sum = 0;
  let count = 0;
  for (let i = 0; i + 1 < samples.length; i += 2) {
    const sample = samples.readInt16LE(i) / 32768;
    sum += sample * sample;
    count += 1;
  }
  return Math.sqrt(sum / Math.max(1, count));
}

for (const rel of files) {
  const buf = readFileSync(resolve(process.cwd(), rel));
  const value = rms(buf);
  if (value < 0.01) {
    throw new Error(`${rel} looks silent (rms=${value})`);
  }
  console.log(`ok  ${rel}  rms=${value.toFixed(3)}  ${buf.length} bytes`);
}
