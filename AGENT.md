# Agent instructions

## Build and validate

Use Bun to install dependencies, build the static site, and run checks:

```sh
bun install
bun run build
bun run check
```

The build writes deployable files to `dist/`. Do not edit generated files there by hand.
