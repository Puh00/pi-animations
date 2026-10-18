import { rgbColor, styleText, truncateToWidth, type TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Animation, AnimationCell } from "./types.ts";

export function createAnimationComponent(tui: TUI, theme: Theme, animation: Animation, preview = false) {
  let disposed = false;
  let elapsed = 0;
  let cachedWidth = -1;
  let cachedLines: string[] | undefined;
  const staticMode = process.env.ASCIIFX_REDUCED_MOTION === "1" || process.env.TERM === "dumb";
  const noColor = process.env.NO_COLOR !== undefined || process.env.TERM === "dumb";
  const tickRate = process.env.TMUX || process.env.SSH_CONNECTION ? 15 : 24;
  const timer = !staticMode ? setInterval(() => {
    if (disposed) return;
    elapsed += 1 / tickRate;
    cachedLines = undefined;
    tui.requestRender();
  }, 1000 / tickRate) : undefined;
  const colorCell = (cell: AnimationCell) => !cell.fg && !cell.bg ? cell.glyph : styleText(cell.glyph, { fg: cell.fg && rgbColor(...cell.fg), bg: cell.bg && rgbColor(...cell.bg) }, theme.getColorMode());
  return {
    render(width: number): string[] {
      if (cachedLines && cachedWidth === width) return cachedLines;
      if (width <= 0) return [];
      const columns = Math.max(4, Math.floor(width));
      const rows = Math.max(3, Math.min(10, Math.floor(columns / 5)));
      const cells = animation.renderFrame({ width: columns, height: rows, seconds: elapsed });
      const lines = cells.map(row => row.map(cell => {
        if (!noColor) return colorCell(cell);
        if (cell.mono) return cell.mono;
        if (!cell.fg && !cell.bg) return cell.glyph;
        if (cell.glyph === ".") return ".";
        const colors = [cell.fg, cell.bg].filter(color => color !== undefined);
        const brightness = Math.max(0, ...colors.map(([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255));
        const shades = " .:-=+*#%@";
        return shades[Math.round(brightness * (shades.length - 1))];
      }).join(""));
      if (columns > width) for (let i = 0; i < lines.length; i++) lines[i] = truncateToWidth(lines[i], width);
      if (preview) lines.push(truncateToWidth(noColor ? "Preview · press any key to close" : theme.fg("muted", "Preview · press any key to close"), width));
      cachedWidth = width;
      cachedLines = lines;
      return lines;
    },
    invalidate() { cachedLines = undefined; },
    dispose() { if (disposed) return; disposed = true; if (timer) clearInterval(timer); },
  };
}
