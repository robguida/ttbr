# Project layout and deployment boundary

`src/` contains every website file that is deployed: HTML, CSS, JavaScript, the logo, and photographs. Add future public assets here.

`docs/` contains project documentation. `scripts/` contains development and build utilities. Both live at the repository root and stay outside the deployed website. The root README, AGENTS.md, Git metadata, and local environment files are not website content.

Run `node scripts/build.mjs` to generate ignored `dist/` from `src/` alone. Sites requires a supported output name such as `dist`; this staging directory is not the source of truth. The root `.openai/hosting.json` retains the existing Sites project ID and selects the generated `dist/` output.

Package and publish only after running the build. Sites adds its required hosting metadata during packaging; root documentation and scripts are never copied as public assets. Never configure hosting to serve the repository root.
