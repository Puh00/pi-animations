# Verification

Verified on branch `improve-ocean-shading` with Node 22.23.2, Pi 1.3.0, Python 3, and tmux. Ocean retains the adapted wave geometry and its four original sine phases. It still maps the normalized wave through `0.3 * tanh(1.7 * wave / 0.3)` around the existing `0.35h` anchor, keeping the surface between `0.05h` and `0.65h`. The renderer now blends sky, phase-modulated crest foam, and water by subpixel coverage instead of hard pixel-threshold switches. The original depth gradient was continuous; coarse half-block sampling and discontinuous foam/sky boundaries caused the visual issue. Water shading uses a depth-scaled blue/cyan contour tied to the existing wave phase.

## Aurora reference

`testdata/aurora-reference.json` contains 27 frames from upstream commit `b2b26045b38aa4f59dd50781640cac65e9a291c1`. Cases cover three sizes, three seeds, and three frame times. `test/aurora.test.mjs` compares every glyph and RGB value.

To regenerate them, copy `testdata/aurora-reference.go` into the pinned upstream checkout at `cmd/aurora-fixture.go`, run `go run ./cmd/aurora-fixture.go`, and redirect the output to this repository's `testdata/aurora-reference.json`. Go is not needed to run the package.

## Ocean baseline and tests

`testdata/ocean-reference.json` remains the pinned upstream baseline at commit `f2f2a3abe818bc0f85986c66de5750ef13cd1e59`. It contains complete glyph, foreground, background, and monochrome frames for four size/time cases. `testdata/ocean-upstream-fixture.rs` exercises the original Ocean factory and canvas. `testdata/ocean-reference.py` independently translates upstream Ocean and half-block rendering. The four fixture frames matched compiled Rust output cell-for-cell.

To reproduce the upstream fixture, append `testdata/ocean-upstream-fixture.rs` to `src/main.rs` in the pinned termflix checkout, then run:

```sh
cargo test --release --locked --bin termflix emit_upstream_ocean_frames -- --nocapture > /tmp/ocean-upstream.log
python3 /path/to/pi-animations/testdata/extract-ocean-fixture.py /tmp/ocean-upstream.log > /path/to/pi-animations/testdata/ocean-reference.json
```

`testdata/ocean-improved-reference.json` pins complete glyph and RGB frames for 80x5 at 0.5 seconds and 80x6 at 1.25 seconds. `test/ocean.test.mjs` checks dimensions, deterministic output, crest shape, color range, monochrome output, Pi ANSI formatting, and sky/foam/water visibility across 0 to 120 seconds at 5, 6, and 10 rows. It finds time roots where fixed pixels cross depths -2, -1.75, 0, and 1.75, then checks each same pixel immediately before and after the crossing. Missing colors compare as black, preserving coordinates across sky transitions. The 8-level tolerance accounts for the monochrome dark threshold; the old hard foam transitions exceed it.

## Visual comparison

Run `node --experimental-strip-types testdata/ocean-compare.mjs` to generate `.lavish/ocean-comparison.html` and its frame data. `testdata/render-ocean-comparison.py` rasterizes that data to PNGs in ignored `artifacts/` using Pillow and DejaVu Sans Mono. Its glyph handling draws the upper and lower half-block colors separately and places Aurora dots in their actual glyph cell. The interactive page and PNGs compare upstream equations, the pre-task compact port, the updated port, and Aurora at 80 columns, heights 5 and 6, and times 0, 0.5, 1.25, 3, and 58.4 seconds. It uses the pinned upstream fixture when a matching case exists and an independent translation of upstream equations for other cases. The old port is loaded directly from base commit `d097ac3`, not from an ignored local file or package source. Desktop layout keeps two panels per row so each frame remains legible. The comparison uses RGB swatches and terminal half-block pixels.

Raster comparisons at 80x5 and 80x6 for 0.5, 1.25, and 3 seconds are `artifacts/ocean-compare-{5,6}rows-{0-5,1-25,3}.png`. The 58.4-second cases are included as well.

## Performance

`npm run bench` measures Ocean at heights 5, 6, and 10 and widths 60, 120, 240, and 320. Its output reports median and p95 CPU render time; it excludes terminal diffing and output. The player's cached render is also measured. A separate 500-frame before/after comparison at 80 columns measured old/new median and p95 CPU time of 0.056/0.073 ms versus 0.080/0.119 ms at 5 rows, and 0.070/0.105 ms versus 0.094/0.133 ms at 6 rows. This isolated renderer benchmark excludes terminal formatting.

## Checks

Passed on this worktree:

- `npm ci --ignore-scripts`
- `npm test`
- `npm run typecheck`
- `npm run test:pi` in regular and fullscreen Pi TUI modes
- `npm run preview`
- `node --experimental-strip-types testdata/ocean-compare.mjs`
- `PYTHONPATH=/tmp/ocean-pillow python3 testdata/render-ocean-comparison.py` (local Pillow install)
- `npm run bench`
- `npm pack --dry-run`
- `git diff --check`

Pi tests use a temporary configuration and local provider. They do not alter user Pi settings. `.lavish/` is ignored and excluded from the package.

## Accessibility and lifecycle

The shared player owns terminal formatting, caching, resizing, and timer disposal. `ASCIIFX_REDUCED_MOTION=1` and `TERM=dumb` suppress timers. `NO_COLOR` renders Aurora with ASCII density shades and Ocean with monochrome half-blocks. The Pi command is `/animation`. Old `aurora-still` session entries migrate to animated Aurora; unknown saved selections default to Aurora.

Not checked: other Pi versions, Windows terminals, light-theme visual contrast, or automatic retry and compaction paths in a live model session.
