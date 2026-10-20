/* Ocean renderer ported from paulrobello/termflix.
 * Source commit, copied files, and required notices are listed in THIRD_PARTY_NOTICES.md.
 */
import type { Animation, AnimationCell, AnimationFrame, FrameRequest } from "./types.ts";

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const DARK_THRESHOLD = 0.02;
const WAVE_HEIGHT_GAIN = 1.7;
const WAVE_DISPLACEMENT_LIMIT = 0.3; // tanh keeps the surface within 5-65% of the pixel height.
const COLOR_CONTOUR_SHIFT = 0.18;
const SKY_EDGE = 0.25;
const FOAM_EDGE = 1.75;
const FOAM_COLOR = [220, 240, 255] as const;
const clamp01 = (value: number) => clamp(value, 0, 1);
type Pixel = { brightness: number; color: readonly [number, number, number] };

/** Compact visual adaptation of termflix Ocean using truecolor half-block rendering. */
export function renderOcean(width: number, height: number, seconds: number): AnimationFrame {
  if (![width, height, seconds].every(Number.isFinite) || seconds < 0) throw new RangeError("Ocean dimensions and time must be finite, with nonnegative time");
  const w = Math.max(1, Math.floor(width));
  const rows = Math.max(1, Math.floor(height));
  const h = rows * 2;
  if (w * h > 1_000_000) throw new RangeError("Ocean frame exceeds one million pixels");
  const pixels: Pixel[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ brightness: 0, color: [0, 0, 0] })));
  for (let x = 0; x < w; x++) {
    const fx = x / w;
    const wave = Math.sin(fx * 6 + seconds * 1.5) * .08
      + Math.sin(fx * 12 + seconds * 2.5) * .04
      + Math.sin(fx * 3 + seconds * .8) * .12
      + Math.sin(fx * 18 + seconds * 3.5) * .02;
    const surface = h * (.35 + WAVE_DISPLACEMENT_LIMIT * Math.tanh(WAVE_HEIGHT_GAIN * wave / WAVE_DISPLACEMENT_LIMIT));
    const foamPhase = clamp01(Math.sin(fx * 20 + seconds * 3) * .5 + .5);
    for (let y = 0; y < h; y++) {
      const depth = y - surface;
      const skyCoverage = clamp01((-depth - FOAM_EDGE) / SKY_EDGE);
      const foamCoverage = (1 - skyCoverage) * clamp01((FOAM_EDGE - depth) / FOAM_EDGE) * (.7 + .3 * foamPhase);
      const waterCoverage = 1 - skyCoverage - foamCoverage;
      const ratio = clamp01(Math.max(0, depth) / (h * .65));
      const underwater = Math.sin(fx * 8 + y * .05 + seconds * 1.2) * .1;
      const colorContour = Math.sin(fx * 8 + ratio * 6 + seconds * 1.2);
      const colorDepth = clamp01(ratio + colorContour * COLOR_CONTOUR_SHIFT);
      const waterBrightness = clamp(.6 - ratio * .45 + underwater, .1, .7);
      const waterColor = [12 - 8 * colorDepth, 220 - 200 * colorDepth, 255 - 85 * colorDepth] as const;
      const brightness = foamCoverage * (.7 + .3 * foamPhase) + waterCoverage * waterBrightness;
      pixels[y][x] = {
        brightness,
        color: [
          Math.round(FOAM_COLOR[0] * foamCoverage * (.7 + .3 * foamPhase) + waterColor[0] * waterCoverage * waterBrightness),
          Math.round(FOAM_COLOR[1] * foamCoverage * (.7 + .3 * foamPhase) + waterColor[1] * waterCoverage * waterBrightness),
          Math.round(FOAM_COLOR[2] * foamCoverage * (.7 + .3 * foamPhase) + waterColor[2] * waterCoverage * waterBrightness),
        ],
      };
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
      fg: top.color,
      bg: bottom.color,
      mono,
    };
  }));
}

export const ocean: Animation = { renderFrame: ({ width, height, seconds }: FrameRequest) => renderOcean(width, height, seconds) };
