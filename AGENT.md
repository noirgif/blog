# Agent instructions

## Build and validate

Use Bun `>=1.4.2` to install dependencies, build the static site, and run checks. The project requires Node.js `^24.15.0` (Node.js 24.x, starting at 24.15.0):

```sh
bun install
bun run build
bun run check
```

The build writes deployable files to `dist/`. Do not edit generated files there by hand.
