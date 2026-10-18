# Verification

Verified on branch `ocean-animation` with Node 22.23.2, Pi 1.3.0, Python 3, and tmux. Aurora's renderer remains unchanged and its 27 pinned upstream frames still pass. Ocean retains upstream half-block rendering and timing, but changes the composition for a compact widget. It maps the normalized wave through `0.3 * tanh(1.7 * wave / 0.3)` around the existing `0.35h` anchor. Since `tanh` stays strictly between -1 and 1, the surface stays between `0.05h` and `0.65h` for every time and column, without hard clipping. A depth-normalized, phase-shifted blue/cyan contour colors the water. The original sine frequencies, phase velocities, brightness-depth gradient, half-block output, and vertical pixel sampling remain in use.

## Aurora reference

`testdata/aurora-reference.json` contains 27 frames from upstream commit `b2b26045b38aa4f59dd50781640cac65e9a291c1`. Cases cover three sizes, three seeds, and three frame times. `test/aurora.test.mjs` compares every glyph and RGB value.

To regenerate them, copy `testdata/aurora-reference.go` into the pinned upstream checkout at `cmd/aurora-fixture.go`, run `go run ./cmd/aurora-fixture.go`, and redirect the output to this repository's `testdata/aurora-reference.json`. Go is not needed to run the package.

## Ocean baseline and adaptation

`testdata/ocean-reference.json` remains the unmodified upstream baseline at commit `f2f2a3abe818bc0f85986c66de5750ef13cd1e59`. It contains complete glyph, foreground, background, and monochrome frames for 12x3 at 0 seconds, 40x8 at 0 seconds, 40x5 at 0.5 seconds, and 24x10 at 1.25 seconds. The pinned Rust fixture driver and independent Python equation cross-check are described below. The adapted renderer intentionally does not compare equal to these baseline frames.

`test/ocean.test.mjs` compares the compact 40x5 crest and color behavior against that baseline, checks adapted frames at 5, 6, and 10 rows, and compares the Pi player's decoded truecolor ANSI cells against the adapted renderer output. It also scans width-80 frames at 0.1-second intervals from 0 through 120 seconds, checking that sky, foam, and water remain visible at each height. The sweep includes 58.4 seconds, where the unbounded gain previously pushed a crest above the frame.

For the original-source comparison, `testdata/ocean-upstream-fixture.rs` can be appended temporarily to `src/main.rs` in a checkout of pinned termflix. It invokes the original Ocean factory and `Canvas::build_grid()` in TrueColor and Mono half-block modes. From that checkout, run:

```sh
cargo test --release --locked --bin termflix emit_upstream_ocean_frames -- --nocapture > /tmp/ocean-upstream.log
python3 /path/to/pi-animations/testdata/extract-ocean-fixture.py /tmp/ocean-upstream.log > /path/to/pi-animations/testdata/ocean-reference.json
```

The original crate compiled with Rust 1.99.1 installed under `/tmp`, so no global Rust settings changed. The checked-in baseline fixture was reproduced from this Rust driver. `testdata/ocean-reference.py` independently translates the upstream equations and half-block scaling. Its four full frames matched the compiled Rust output cell-for-cell.

## Visual comparisons

`artifacts/ocean-before-after-5.png`, `artifacts/ocean-before-after-6.png`, and `artifacts/ocean-before-after-10.png` compare baseline `4db1406` against the adapted renderer at width 80 and times 0.5, 1.25, and 3 seconds. Each panel uses a 10x20 pixel terminal cell. `.lavish/ocean-adaptation.html` offers the same baseline/adapted time and height comparison in a browser.

The PTY tests ran Pi 1.3.0 with a temporary configuration and local provider in regular and fullscreen modes. They checked half-block Ocean output, foreground/background truecolor variation, cyan-to-deep-blue range, changing frames, and 24- and 240-column layouts. Actual Pi ANSI captures are `artifacts/regular-ocean-1.ansi` and `artifacts/fullscreen-ocean-1.ansi`; the corresponding `*-ocean-1.png` images rasterize those ANSI captures with DejaVu Sans Mono and captured RGB values. These images show the Pi widget output, not the browser renderer. PNG conversion used Pillow installed under `/tmp`; it is not a project dependency.

## Check results

The following checks passed on the current worktree:

- `npm ci --ignore-scripts`
- `npm test` (12 passing tests, including Aurora fixtures, baseline comparison, adapted Ocean geometry/color, the 0-120 second visibility sweep, Pi ANSI formatting, command/session behavior, sizing/timing, and accessibility)
- `npm run typecheck`
- `npm run test:pi` (regular and fullscreen TUI; Ocean colors, frame changes, reload, resizing, abort, tool execution, settle cleanup, and off mode)
- `npm run preview` (isolates and smoke-renders both renderer modules)
- `npm pack --dry-run`
- `git diff --check`

Pi tests use the temporary configuration and local fixture provider. They do not use credentials or alter the user's Pi settings. Test captures are local under ignored `artifacts/`; `.lavish/` is also ignored and is not included in the package.

## Accessibility and lifecycle

The shared player owns terminal formatting, caching, resizing, and timer disposal. `ASCIIFX_REDUCED_MOTION=1` and `TERM=dumb` suppress timers. `NO_COLOR` renders Aurora with ASCII density shades and Ocean with monochrome half-blocks. The Pi command is `/animation`; `/aurora`, `/nap`, and static animation mode were removed. Old `aurora-still` session entries migrate to animated Aurora; unknown saved selections default to Aurora.

Not checked: other Pi versions, Windows terminals, light-theme visual contrast, or automatic retry and compaction paths in a live model session.
