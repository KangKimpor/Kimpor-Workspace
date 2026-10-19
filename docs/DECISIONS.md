# Decisions

## D-03 Danger and success text colors
`--danger` and `--success` fail 4.5:1 as text on white, so `--danger-text` and `--success-text` exist for text use. Rejected: darkening the base colors (they are fills and icons too).

## D-04 Light yellow palette color (SPEC §9 contrast fix)
`--c-yellow` light changed `#cb912f` to `#bb8420`. Contrast on canvas 2.75:1 to about 3.2:1, meeting the 3:1 icon minimum. Smallest change that passes. Enforced by `src/test/contrast.test.ts`.

## D-05 Specimen token labels use primary text
Dark theme `.swatch code` in `secondary` text failed axe color-contrast over the ambient backdrop. Switched to `--text-primary`. Rejected: raising `--text-secondary`, which is a global token.

## D-06 Tooling
- `pnpm` runs via `corepack pnpm` on this machine (not on PATH). Use cmd, not PowerShell (script policy).
- `workbox-window` added as a dev dependency; `virtual:pwa-register` needs it.
- Helper scripts (screenshots) live outside the repo in `Downloads\kimpor-scripts`.
