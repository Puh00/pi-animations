# Working on pi-animations

- Keep rendering math in concrete implementations under `animations/`. Shared animation types and registry belong there; the player owns terminal formatting, layout, caching, and timers, while `index.ts` owns Pi commands and lifecycle.
- Preserve renderer output against pinned fixtures in `testdata/`. When porting code, add the upstream source, revision, ported files, and license text to `THIRD_PARTY_NOTICES.md`. Keep `LICENSE` as the unmodified MIT text so GitHub detects it.
- Keep renders within the supplied terminal width. Dispose animation timers when a widget closes, a run settles, or Pi shuts down. Non-interactive modes must not start UI timers.
- Keep the README short. Put verification details in `verification.md`.

Before publishing, run `npm ci --ignore-scripts`, `npm test`, `npm run typecheck`, and `npm pack --dry-run`.

For rendering or lifecycle changes, also run `npm run test:pi`. It needs Pi 1.3.0, tmux, and Python 3, and uses a temporary configuration with a local test provider. Do not change the user's Pi settings for tests.

Regenerate the browser preview with `npm run preview` after changing a renderer. The generated `.lavish/` directory is local and ignored. Do not publish `artifacts/`, model credentials, or personal session data.

To add an animation, implement `Animation` in `animations/`, register it in `animations/registry.ts`, and add deterministic renderer tests and fixtures under `test/` and `testdata/`. Keep renderer math concrete and preserve one printable single-column glyph per cell.
