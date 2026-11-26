/* Adapted from fresco's galaxy field; see THIRD_PARTY_NOTICES.md. */
import type { Animation, AnimationCell, AnimationFrame, RGB } from "./types.ts";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const inclination = 0.5;
const angle = 0.12;
const ca = Math.cos(angle), sa = Math.sin(angle);
const ramp = " .:-=+*#%@";

/** An inclined two-arm density wave, sampled twice per terminal cell. */
export function renderGalaxy(width: number, height: number, seconds: number): AnimationFrame {
  if (![width, height, seconds].every(Number.isFinite) || seconds < 0) throw new RangeError("Invalid Galaxy dimensions or time");
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  if (w * h > 1_000_000) throw new RangeError("Galaxy frame exceeds one million cells");
  if (w === 0 || h === 0) return Array.from({ length: h }, () => []);
  const radius = Math.min(w * .43, h * .9 / Math.hypot(sa, inclination * ca));
  const stretch = 1 + .95 * (1 - Math.exp(-Math.max(0, w / h - 5) * .18));
  const sample = (x: number, y: number): { color?: RGB; light: number } => {
    const dx = (x - (w - 1) / 2) / stretch;
    const dy = y - (2 * h - 1) / 2;
    const u = ca * dx + sa * dy;
    const wy = (-sa * dx + ca * dy) / inclination;
    const r = Math.hypot(u, wy);
    const rho = r / radius;
    // The bulge is less foreshortened than the disk and sits behind its dust lane.
    const coreX = dx * Math.sqrt(stretch);
    const coreY = (dy + .035 * radius) / .8;
    const coreRho = Math.hypot(coreX, coreY) / radius;
    const bulge = .6 * Math.exp(-coreRho / .26);
    let arm = 0, dust = 0;
    if (r >= radius * .05) {
      const r2 = r * r;
      // Phase gradient in each sampling direction, including foreshortening.
      const du = -(6 * u + 2 * wy) / r2;
      const dv = (2 * u - 6 * wy) / r2;
      const step = Math.max(Math.abs(ca * du - sa * dv / inclination) / stretch, Math.abs(sa * du + ca * dv / inclination));
      const lod = clamp(Math.PI / (1.1 * step));
      const phase = 2 * Math.atan2(wy, u) - 6 * Math.log(r / radius) - seconds * .28 + 1.5;
      arm = Math.pow(.5 + lod * .5 * Math.cos(phase), 2.5);
      dust = .5 * lod * Math.pow(.5 + .5 * Math.cos(phase + .55), 2.4);
    }
    const disk = Math.exp(-rho / .92) * (.38 + .62 * arm - dust);
    const laneWidth = Math.max(.75, .16 * radius * inclination);
    const lane = 1 - .72 * Math.exp(-((((-sa * dx + ca * dy) - .16 * radius * inclination) / laneWidth) ** 2));
    const raw = clamp((bulge + disk) * lane);
    const light = clamp((raw - .08) * 1.35);
    if (light < .025) return { light: 0 };
    const hue = clamp((Math.pow(rho, .82) + .12 * arm) * (1 - .45 * bulge / (bulge + disk)));
    const mix = (a: number, b: number) => a + (b - a) * hue;
    return { light, color: [Math.round(mix(255, 91) * light), Math.round(mix(230, 105) * light), Math.round(mix(195, 255) * light)] };
  };
  const frame: AnimationCell[][] = [];
  for (let y = 0; y < h; y++) {
    const row: AnimationCell[] = [];
    for (let x = 0; x < w; x++) {
      const top = sample(x, 2 * y), bottom = sample(x, 2 * y + 1);
      const mono = ramp[Math.round(Math.sqrt((top.light + bottom.light) / 2) * (ramp.length - 1))];
      if (!top.color && !bottom.color) row.push({ glyph: " ", mono });
      else if (!top.color) row.push({ glyph: "▄", fg: bottom.color, mono });
      else if (!bottom.color) row.push({ glyph: "▀", fg: top.color, mono });
      else row.push({ glyph: "▀", fg: top.color, bg: bottom.color, mono });
    }
    frame.push(row);
  }
  return frame;
}

export const galaxy: Animation = {
  renderFrame({ width, height, seconds }) { return renderGalaxy(width, height, seconds); },
};
