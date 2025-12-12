# AGENTS.md

- before committing code
  - `npm run commit-checks`
    - this should sufficient checking: avoid running a build unless it's particularly relevant to the changes
  - tell the user your commit message
  - get confirmation from the user
- read README.md
  - keep this up to date
  - focus on public api and underlying concepts
- use invariant(cond) to check expected conditions hold
  - do not insert trivial invariants, like when the exact condition has immediately been checked previously
  - only use invariant(cond) when you expect cond will _always_ be true because it is logically guaranteed by the design
    - do not use it when something bad but possible happens and you just want to throw an exception (use assert instead)
- ideally, you should write tests for any new changes
  - warn the user if these are difficult to add (the relevant code is not testable)
  - if you can test, use src/TorClient/MicrodescManager.test.ts as a reference for the testing pattern
- UI changes to demo app
  - make changes to `demo.ts` or `index.html`
  - check dev server is running, if not, use `npm run dev -- --no-open` in background
  - run `npm run screenshot` to verify changes visually
  - check the generated screenshot at `./screenshots/demo.png` to confirm work

**always confirm with the user before committing changes**
