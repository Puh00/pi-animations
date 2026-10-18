/* Aurora renderer ported from cyperx84/ascii-animations.
 * Source commit, copied files, and required notices are listed in THIRD_PARTY_NOTICES.md.
 */
import type { Animation, AnimationFrame, FrameRequest } from "./types.ts";

export type { RGB, AnimationCell as AuroraCell, AnimationFrame as AuroraFrame } from "./types.ts";
import type { RGB, AnimationCell as AuroraCell } from "./types.ts";

const MASK64 = (1n << 64n) - 1n;
const DEFAULT_PALETTE: readonly RGB[] = [
  [11, 16, 38], [27, 58, 107], [31, 163, 154], [126, 224, 129], [232, 247, 161],
];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const x = clamp(v); return x * x * (3 - 2 * x); };

function toLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function toOklab(color: RGB): readonly [number, number, number] {
  const [r, g, b] = color.map(toLinear);
  const l = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b);
  const m = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b);
  const s = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
  return [
    0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
    1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
    0.0259040371*l + 0.7827717662*m - 0.8086757660*s,
  ];
}

function fromOklab(lab: readonly [number, number, number]): RGB {
  const [L, a, b] = lab;
  let l = (L + 0.3963377774*a + 0.2158037573*b) ** 3;
  let m = (L - 0.1055613458*a - 0.0638541728*b) ** 3;
  let s = (L - 0.0894841775*a - 1.2914855480*b) ** 3;
  const channel = (linear: number) => {
    const srgb = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1/2.4) - 0.055;
    return Math.round(clamp(srgb) * 255);
  };
  return [
    channel(4.0767416621*l - 3.3077115913*m + 0.2309699292*s),
    channel(-1.2684380046*l + 2.6097574011*m - 0.3413193965*s),
    channel(-0.0041960863*l - 0.7034186147*m + 1.7076147010*s),
  ];
}

function paletteAt(palette: readonly RGB[], labs: readonly RGB[], position: number): RGB {
  if (palette.length === 0) return [0, 0, 0];
  if (palette.length === 1) return palette[0];
  const p = clamp(position) * (palette.length - 1);
  const index = Math.min(Math.floor(p), palette.length - 2);
  const amount = p - index;
  const a = labs[index];
  const b = labs[index + 1];
  return fromOklab([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

// Go math/rand/v2 PCG-DXSM, matching upstream fx.NewRand and rand/v2.Float64.
function makeGoRandom(seed: bigint): { float64(): number; uint64(): bigint } {
  let hi = BigInt.asUintN(64, seed);
  let lo = BigInt.asUintN(64, 0x9e3779b97f4a7c15n ^ seed);
  const next = () => {
    const oldHi = hi;
    const oldLo = lo;
    const product = oldLo * 4865540595714422341n;
    let nextLo = product & MASK64;
    let nextHi = (oldHi * 4865540595714422341n + oldLo * 2549297995355413924n + (product >> 64n)) & MASK64;
    const sum = nextLo + 1442695040888963407n;
    const carry = sum >> 64n;
    nextLo = sum & MASK64;
    nextHi = (nextHi + 6364136223846793005n + carry) & MASK64;
    lo = nextLo;
    hi = nextHi;
    let value = hi;
    value ^= value >> 32n;
    value = (value * 0xda942042e4dd58b5n) & MASK64;
    value ^= value >> 48n;
    value = (value * (lo | 1n)) & MASK64;
    return value;
  };
  return {
    uint64: next,
    float64: () => Number(next() & ((1n << 53n) - 1n)) / 2 ** 53,
  };
}

function hash01(x: number, y: number, seed: bigint): number {
  let h = (BigInt(x) * 0x9e3779b185ebca87n ^ BigInt(y) * 0xc2b2ae3d27d4eb4fn ^ seed * 0x165667b19e3779f9n) & MASK64;
  h ^= h >> 33n;
  h = (h * 0xff51afd7ed558ccdn) & MASK64;
  h ^= h >> 33n;
  h = (h * 0xc4ceb9fe1a85ec53n) & MASK64;
  h ^= h >> 33n;
  return Number(h >> 11n) / 2 ** 53;
}

interface Curtain { base: number; f1: number; f2: number; f3: number; p1: number; p2: number; p3: number; drift: number }
export interface AuroraOptions {
  stars?: boolean;
  speed?: number;
  curtains?: number;
  palette?: readonly RGB[];
}

/** Render Aurora at elapsed seconds, with the upstream default parameters and seed. */
export function renderAurora(width: number, height: number, seconds: number, seed = 1n, options: AuroraOptions = {}): AnimationFrame {
  if (![width, height, seconds, options.speed ?? 1, options.curtains ?? 3].every(Number.isFinite) || seconds < 0) {
    throw new RangeError("Aurora dimensions, time, and speed must be finite, with nonnegative time");
  }
  const w = Math.max(4, Math.floor(width));
  const h = Math.max(3, Math.min(40, Math.floor(height)));
  if (w * h > 1_000_000) throw new RangeError("Aurora frame exceeds one million cells");
  const pixelsHigh = h * 2;
  const palette = options.palette ?? DEFAULT_PALETTE;
  if (palette.length < 1 || palette.some(c => c.length !== 3 || c.some(v => !Number.isInteger(v) || v < 0 || v > 255))) {
    throw new RangeError("Aurora palette must contain RGB byte triplets");
  }
  const labs = palette.map(toOklab);
  const count = Math.max(1, Math.min(5, Math.floor(options.curtains ?? 3)));
  const random = makeGoRandom(BigInt.asUintN(64, seed));
  const starSeed = random.uint64(); // Upstream consumes rng.Uint64() for a.seed before curtain setup.
  const curtains: Curtain[] = [];
  for (let i = 0; i < count; i++) {
    curtains.push({
      base: .38 + .3 * (i + .5) / count + (random.float64() - .5) * .08,
      f1: 1.2 + random.float64() * 1.5,
      f2: 3 + random.float64() * 3,
      f3: 9 + random.float64() * 8,
      p1: random.float64() * 6.3,
      p2: random.float64() * 6.3,
      p3: random.float64() * 6.3,
      drift: (.15 + random.float64() * .2) * (1 - 2 * (i % 2)),
    });
  }

  const light = new Float64Array(w * pixelsHigh);
  const tone = new Float64Array(w * pixelsHigh);
  const t = seconds * (options.speed ?? 1);
  for (let ci = 0; ci < count; ci++) {
    const curtain = curtains[ci];
    const depth = 1 - .25 * ci / Math.max(1, count - 1);
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const hem = curtain.base
        + .12 * Math.sin(u * curtain.f1 * Math.PI + t * curtain.drift + curtain.p1)
        + .05 * Math.sin(u * curtain.f2 * Math.PI - t * curtain.drift * 1.7 + curtain.p2)
        + .015 * Math.sin(u * curtain.f3 * Math.PI + t * .9 + curtain.p3);
      const hemY = hem * pixelsHigh;
      const band = .5 + .5 * Math.sin(u * curtain.f2 * 2.1 + t * curtain.drift * 2.3 + curtain.p1);
      const ray = .5 + .5 * Math.sin(u * w * .55 + 2 * Math.sin(t * .6 + u * 7 + curtain.p3));
      const ray2 = .5 + .5 * Math.sin(u * w * 1.3 - t * .8 + curtain.p2);
      const rays = .35 + .65 * ray * ray * (.6 + .4 * ray2);
      const glow = smooth(band * 1.7 - .55) * rays * depth;
      if (glow <= .01) continue;
      const tall = pixelsHigh * (.12 + .22 * band * ray);
      for (let y = 0; y < pixelsHigh; y++) {
        const dy = hemY - y;
        let value = dy >= 0 ? Math.exp(-dy / tall * 2.6) : Math.exp(-dy * dy / 3);
        value *= glow;
        const i = y * w + x;
        if (value > light[i]) tone[i] = clamp(dy / tall) * .5;
        light[i] = Math.min(1, light[i] + value * (1 - light[i] * .5));
      }
    }
  }
  const pixel = (x: number, y: number): RGB | undefined => {
    const intensity = light[y * w + x];
    if (intensity < .06) return undefined;
    return paletteAt(palette, labs, clamp(.15 + .85 * Math.pow(clamp(intensity), .85) - .3 * tone[y * w + x]));
  };
  const frame: AuroraCell[][] = [];
  for (let y = 0; y < h; y++) {
    const row: AuroraCell[] = [];
    for (let x = 0; x < w; x++) {
      const top = pixel(x, y * 2);
      const bottom = pixel(x, y * 2 + 1);
      if (options.stars !== false && !top && !bottom && y < Math.floor(h * 2 / 3)) {
        const star = hash01(x, y, starSeed);
        if (star > .985) {
          const twinkle = .5 + .5 * Math.sin(t * 2 + star * 400);
          row.push({ glyph: ".", fg: paletteAt(palette, labs, .35 + .5 * twinkle) });
          continue;
        }
      }
      if (!top && !bottom) row.push({ glyph: " " });
      else if (top && !bottom) row.push({ glyph: "▀", fg: top });
      else if (!top && bottom) row.push({ glyph: "▄", fg: bottom });
      else if (top!.every((v, i) => v === bottom![i])) row.push({ glyph: "█", fg: top });
      else row.push({ glyph: "▀", fg: top, bg: bottom });
    }
    frame.push(row);
  }
  return frame;
}

export const aurora: Animation = {
  renderFrame({ width, height, seconds }: FrameRequest) {
    return renderAurora(width, height, seconds);
  },
};
