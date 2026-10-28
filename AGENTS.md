# Website workflow

Use this GitHub repository as the source of truth for Travel the Back Roads.

- All deployable website files belong in `src/`. Keep documentation in root-level `docs/` and utility scripts in root-level `scripts/`.
- Run `node scripts/build.mjs` before packaging. It stages only `src/` into ignored `dist/`, the output directory required by Sites. Never copy repository-root documentation, scripts, or Git metadata into deployment output.

- Pull `origin main` with `--ff-only` before editing, provided the worktree is clean. Preserve and reconcile local changes first when necessary.
- Keep the original logo small and the layout professional, readable, and responsive. Use the logo's blue, green, and yellow colors; keep the writing warm and lightly humorous.
- Maintain Home, Travel with a Purpose, Blog, Destinations, Gallery, About, Contact, and working site search.
- Ground personal stories and claims in owner-provided material. Credit reference photographs; do not present them as the owners' personal photographs.
- Check JavaScript syntax and verify changed interactions when browser preview is available.
- Commit and push completed changes to GitHub when requested. Never force-push or overwrite unrelated work.
- Follow the Sites skill for deployment. GitHub push alone is not a deployment. Preserve the project identity in `.openai/hosting.json` and existing audience.
