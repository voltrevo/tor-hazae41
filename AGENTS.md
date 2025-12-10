# AGENTS.md

- before committing code
  - `npm run commit-checks`
    - this should sufficient checking: avoid running a build unless it's particularly relevant to the changes
  - tell the user your commit message
  - get confirmation from the user
- read README.md
  - keep this up to date
  - focus on public api and underlying concepts
- UI changes to demo app
  - make changes to `demo.ts` or `index.html`
  - check dev server is running, if not, use `npm run dev -- --no-open` in background
  - run `npm run screenshot` to verify changes visually
  - check the generated screenshot at `./screenshots/demo.png` to confirm work

**always confirm with the user before committing changes**
