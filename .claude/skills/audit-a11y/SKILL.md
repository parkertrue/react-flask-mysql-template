---
name: audit-a11y
description: Accessibility audit against WCAG 2.2 AA and CLAUDE.md's accessibility rules, covering what axe cannot - keyboard flow, focus management, announcements, error handling, reflow, target size and contrast in every state.
disable-model-invocation: true
context: fork
---

# /audit-a11y

First read `.claude/skills/_audit-shared/RULES.md` and follow it throughout.
Then read `CLAUDE.md` (its **Accessibility (WCAG 2.2 AA)** paragraph is the
spec), plus `SOURCES.md` (React / frontend, Accessibility) and `DECISIONS.md`
from the same folder as RULES.md.

axe already runs on every page in `frontend/e2e/accessibility.spec.js`, and
covers only about a third of WCAG. This check covers the rest.

## 1. Read the code

Read every page, layout and form component in `frontend/src/` (`pages/`,
`components/`, `features/*/`), plus `styles/tokens.css` and the shared styles.

- Every page: one `h1`, a `<PageTitle>`, a sensible heading order, landmarks
  (`header`, `nav`, `main`), and a skip link or equivalent.
- Forms: every field through `FormField` (label, hint and message tied by
  `aria-describedby`, `autoComplete` set), `noValidate`, focus on the first
  invalid field after a failed submit, errors announced (`role="alert"`),
  success announced (`role="status"`), `aria-invalid` on invalid fields.
- Busy states: `aria-disabled` or `readOnly` rather than `disabled`, with
  handlers guarded; a busy indicator a screen reader hears.
- Navigation: focus moves to `<main>` on route change; the new page's title
  is announced; back and forward work.
- Dynamic content: "Load more" moves or keeps focus sensibly and announces new
  items; the API status demo announces changes without being noisy.
- Contrast: every pairing in `tokens.css` meets AA (4.5:1 text, 3:1 large text
  and UI components, including focus rings, borders of inputs, and disabled-
  looking states). Compute the ratios.
- Motion: animations respect `prefers-reduced-motion`.

## 2. Check it in a browser

Bring up the E2E stack (follow the Docker rules in RULES.md) and drive it
with Playwright from a scratch script (in the scratch directory, using
`frontend/node_modules`), or with `npx playwright` codegen-style one-off
scripts. Check on every page, logged out and logged in:

- **Keyboard only:** Tab through everything. Order matches the visual order,
  focus is always visible and never hidden behind anything (2.4.11), nothing
  traps focus, every control works with Enter or Space.
- **Reflow and zoom:** at 320 CSS px width and at 200% text zoom, no
  horizontal scrolling and no clipped content (1.4.10, 1.4.4). Text spacing
  overrides (1.4.12) don't break layout.
- **Target size:** interactive targets at least 24×24 CSS px or spaced
  (2.5.8). Measure with `getBoundingClientRect`.
- **States:** run axe (`@axe-core/playwright`, as the spec does) on states
  the spec doesn't reach: form with errors shown, busy state, the error page,
  an expired-session redirect, notes list empty and full.
- **Accessibility tree:** take `page.accessibility.snapshot()` (or
  `ariaSnapshot`) for each page and check names, roles and states read
  sensibly.

Tear the stack down when done.

## 3. Test coverage of the rules

Which of the rules above are pinned by tests (unit tests asserting focus and
roles; E2E)? A rule with no test is a medium finding with a proposed test,
because the next change can silently break it.

## Out of scope
Visual design taste. Anything WCAG AAA.

Write the report as RULES.md describes, with ID prefix `A11Y`. Give the WCAG
success criterion number for each finding.
