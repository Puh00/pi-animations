import type { Animation, AnimationCell, AnimationFrame, FrameRequest } from "./types.ts";

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const DARK_THRESHOLD = 0.02;
const WAVE_HEIGHT_GAIN = 1.7;
const WAVE_DISPLACEMENT_LIMIT = 0.3; // tanh keeps the surface within 5-65% of the pixel height.
const COLOR_CONTOUR_SHIFT = 0.18;
const scale = (channel: number, brightness: number) => Math.trunc(channel * clamp(brightness, 0, 1));

type Pixel = { brightness: number; color: readonly [number, number, number] };

/** Compact visual adaptation of termflix Ocean using truecolor half-block rendering. */
export function renderOcean(width: number, height: number, seconds: number): AnimationFrame {
  if (![width, height, seconds].every(Number.isFinite) || seconds < 0) throw new RangeError("Ocean dimensions and time must be finite, with nonnegative time");
  const w = Math.max(1, Math.floor(width));
  const rows = Math.max(1, Math.floor(height));
  const h = rows * 2;
  if (w * h > 1_000_000) throw new RangeError("Ocean frame exceeds one million pixels");
  const pixels: Pixel[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ brightness: 0, color: [255, 255, 255] })));
  for (let x = 0; x < w; x++) {
    const fx = x / w;
    const wave = Math.sin(fx * 6 + seconds * 1.5) * .08
      + Math.sin(fx * 12 + seconds * 2.5) * .04
      + Math.sin(fx * 3 + seconds * .8) * .12
      + Math.sin(fx * 18 + seconds * 3.5) * .02;
    const surface = h * (.35 + WAVE_DISPLACEMENT_LIMIT * Math.tanh(WAVE_HEIGHT_GAIN * wave / WAVE_DISPLACEMENT_LIMIT));
    for (let y = 0; y < h; y++) {
      const depth = y - surface;
      if (depth < -2) continue;
      if (depth < 0) {
        const foam = clamp(Math.sin(fx * 20 + seconds * 3) * .5 + .5, 0, 1);
        pixels[y][x] = { brightness: clamp(.7 + foam * .3, 0, 1), color: [220, 240, 255] };
      } else {
        const ratio = clamp(depth / (h * .65), 0, 1);
        const brightness = clamp(.6 - ratio * .45, .1, .7);
        const underwater = Math.sin(fx * 8 + y * .05 + seconds * 1.2) * .1;
        const colorContour = Math.sin(fx * 8 + ratio * 6 + seconds * 1.2);
        const colorDepth = clamp(ratio + colorContour * COLOR_CONTOUR_SHIFT, 0, 1);
        pixels[y][x] = {
          brightness: clamp(brightness + underwater, .1, .7),
          color: [
            Math.trunc(12 - 8 * colorDepth),
            Math.trunc(220 - 200 * colorDepth),
            Math.trunc(255 - 85 * colorDepth),
          ],
        };
      }
    }
  }
  return Array.from({ length: rows }, (_, row) => Array.from({ length: w }, (_, x): AnimationCell => {
    const top = pixels[row * 2][x];
    const bottom = pixels[row * 2 + 1][x];
    const topDark = top.brightness < DARK_THRESHOLD;
    const bottomDark = bottom.brightness < DARK_THRESHOLD;
    const mono = topDark ? (bottomDark ? " " : "▄") : (bottomDark ? "▀" : "█");
    if (topDark && bottomDark) return { glyph: " ", mono };
    return {
      glyph: "▀",
      fg: [scale(top.color[0], top.brightness), scale(top.color[1], top.brightness), scale(top.color[2], top.brightness)],
      bg: [scale(bottom.color[0], bottom.brightness), scale(bottom.color[1], bottom.brightness), scale(bottom.color[2], bottom.brightness)],
      mono,
    };
  }));
}

export const ocean: Animation = { renderFrame: ({ width, height, seconds }: FrameRequest) => renderOcean(width, height, seconds) };
