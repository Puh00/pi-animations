# pi-animations

Aurora northern lights while [Pi](https://pi.dev) works. The animation fills the Pi window's width and adapts when you resize it, with a maximum height of 10 rows.

Animations run while the agent in that interactive Pi session works, including tool calls, and stop when the run finishes or is cancelled. Separate sessions must load the package themselves; headless agents have no animation.

## Install

Requires Pi 1.3.0 or newer and access to this private repository.

```sh
git clone git@github.com:puh00/pi-animations.git
cd pi-animations
pi install .
```

Run `/reload` in Pi. To try it for one session without installing:

```sh
pi --extension ./index.ts
```

## Usage

```text
/aurora              Enable Aurora, the default
/aurora preview      Preview the current selection
/aurora still        Static Aurora
/aurora off          Restore Pi's normal indicator
```

Selections persist per session. `ASCIIFX_REDUCED_MOTION=1` disables motion; `NO_COLOR` renders Aurora in monochrome. `/animation` and `/nap` remain command aliases. Sessions that previously selected a removed animation fall back to Aurora.

Wider windows cost more to render. Frames are cached between animation ticks, and the refresh rate is capped at 24 frames per second, or 15 in tmux and SSH. Use `/aurora still` for no animation timer.

## Adding an animation

Create a concrete implementation of the `Animation` interface declared in `animations/types.ts`, then add it to `animations/registry.ts`. Keep each frame rectangular with one printable, single-column glyph per cell. Registration makes it available to the shared player; adding Pi command selection requires a separate change to `index.ts`.

## Acknowledgements

Aurora is ported from [cyperx84/ascii-animations](https://github.com/cyperx84/ascii-animations), which created the original curtain animation, color gradients, and twinkling stars. Thank you to cyperx84 for making that work available.

## License

MIT. Upstream MIT and Go BSD notices are included in [LICENSE](LICENSE).
