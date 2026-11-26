# Verification

Verified on branch `improve-ocean-shading` with Node 22.23.2, Pi 1.3.0, Python 3, and tmux. Ocean retains the adapted wave geometry and its four original sine phases. It still maps the normalized wave through `0.3 * tanh(1.7 * wave / 0.3)` around the existing `0.35h` anchor, keeping the surface between `0.05h` and `0.65h`. The renderer now blends sky, phase-modulated crest foam, and water by subpixel coverage instead of hard pixel-threshold switches. The original depth gradient was continuous; coarse half-block sampling and discontinuous foam/sky boundaries caused the visual issue. Water shading uses a depth-scaled blue/cyan contour tied to the existing wave phase.

## Galaxy

Galaxy adapts the two-arm phase, anisotropic sampling limit, bulge and dust equations from fresco revision `5e565bf190d2bab563043699bb886954a350c2c4`. It uses a height- and width-limited radius, half-block pixels and a separate monochrome density ramp. A rounder, less-stretched bulge glows behind the near-side dust lane, with an ivory highlight above and light below the lane. It deliberately omits upstream's high-frequency knots and turbulence. Its palette and contrast are adapted for the shorter Pi widget rather than matching fresco's full-pane output.

`testdata/galaxy-reference.json` pins hashes of complete frames at 20x4, 40x8, 80x10 and 160x10. `test/galaxy.test.mjs` checks determinism, size, color, monochrome output, motion, small-frame lane contrast and framing. It also checks 1x1 and 5x50 frames, core color, lane occlusion and light below the lane. The horizontal projection grows smoothly with terminal aspect ratio; its phase-gradient sampling limit includes the horizontal scale. At time zero, counting columns with any RGB channel at least 40, the galaxy spans 53 columns at 80x10 and 69 at 160x10. The previous projection spanned 38 columns at both widths. The 20x4 and 40x8 projections remain unchanged. `testdata/pty-check.py` selects Galaxy and exercises its preview and a running animation in both Pi modes.

`docs/galaxy.gif` contains 60 renderer frames at 80x10 over four seconds, sampled at 15 frames per second and rasterized as 8x8 half-block pixels with Pillow. Frame delays alternate between 60 and 70 ms to preserve the total duration. The GIF plays once rather than resetting mid-turn. `testdata/render-galaxy-capture.py` uses a single palette sampled from all frames without dithering. It decodes the GIF and compares adjacent-frame RGB changes with the source; mean absolute error was 0.245 per channel on a 0 to 255 scale. It also verifies the left sky edge stays black. Inspected color and monochrome stills are in ignored `artifacts/galaxy-{20x4,40x8,80x10,160x10}*.png`. The labeled actual-renderer depth comparison is `artifacts/galaxy-depth-comparison.png`. Pi captures are in ignored `artifacts/{regular,fullscreen}-galaxy-*.ansi` and `.txt`.

To regenerate the capture with Pillow and DejaVu Sans Mono installed:

```sh
node --experimental-strip-types --input-type=module -e 'import {renderGalaxy} from "./animations/galaxy.ts"; console.log(JSON.stringify({clip:Array.from({length:60},(_,i)=>renderGalaxy(80,10,i/15)),sizes:[[20,4],[40,8],[80,10],[160,10]].map(([w,h])=>renderGalaxy(w,h,0))}));' | python3 testdata/render-galaxy-capture.py
```

Galaxy checks passed with Pi 1.3.0 and 1.6.1, using a temporary configuration and local provider. The system lacked tmux, so the checks used an extracted Ubuntu tmux 3.2a and its libraries under `/tmp/pi-galaxy-bin`. `npm ci --ignore-scripts` reported three dependency audit findings (two moderate and one high).

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

## README animation preview

`docs/animations.gif` is a browser capture of the package renderers, not a recording of Pi's UI. It plays 40 frames each of Aurora and Ocean at 100 ms per frame and loops continuously. To make a new capture, run `npm ci --ignore-scripts` and `npm run preview`, then open `.lavish/preview.html` in Chromium. Use Playwright to select each renderer, hide the surrounding page controls, add the animation name above `.terminal`, and capture the complete preview. Assemble the PNGs with Pillow using `duration=100` and `loop=0`. Playwright and Pillow were temporary capture tools, not package dependencies. The capture script is not retained, so these steps describe the process rather than a byte-for-byte reproduction.

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
