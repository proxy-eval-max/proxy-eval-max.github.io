# Whose Turn — front-end backlog

Written 2026-09-08, after the first design pass shipped (`expenses/`). The page
works and looks deliberate; this is the list of what would make it feel finished.

Order of work: quick wins first, then the harder group. Items are checked off in
this file as they land.

Two constraints that override everything below:

- **No number may reach the screen.** Not a chart, not a percentage, not a
  progress bar, not a "you're 60% ahead". Every one of those quietly reintroduces
  the amount the app exists to withhold. `verdict()` is unit-tested to contain no
  digits; keep it that way.
- **One bold element.** The turn plate is the signature. Anything new stays quiet
  around it.

---

## Quick wins

- [x] **Inline confirms instead of `confirm()`.** Both destructive actions use the
  native dialog — the only unstyled surface left on the page. Row removal becomes
  a two-step inline affordance (`remove?` → `yes / no`); settle-up gets a real
  in-page panel, since it is irreversible.
- [x] **Replace the `•••` tooltip.** `title` never appears on touch and is not
  keyboard-reachable, so the explanation is invisible to most readers. Say it once
  as a caption near the history header instead.
- [x] **`showing 30 of N` is a dead end.** Now a "Show N more" that raises the
  render limit.
- [x] **Clamp long notes to two lines.** 140 characters can triple a row's height
  and break the list's rhythm. `-webkit-line-clamp: 2` plus a full-text `title`.
- [x] **Focus-ring radius.** Removed the stray `border-radius: 6px` from the
  `:focus-visible` rule. Correction to the original claim: this was never the bug
  it looked like — the rule is wrapped in `:where()`, which contributes zero
  specificity, so every component's own radius already won. The only element it
  actually reached was `#main[tabindex]`, where no ring is visible anyway. Tidied
  rather than fixed.
- [x] **`tabular-nums` on the mono meta line**, so dates don't shimmer as rows
  re-render.
- [x] **Verified the payer picker's keyboard affordances.** Nothing to fix:
  `.picker input:focus-visible + label` already draws the ring on the visible
  label, and the inputs are real same-named radios, so arrow-key navigation
  within the group comes free from the browser.

## The harder group

Items 1–3 are really one refactor and should land together.

- [ ] **1. Animate the handover, not just the split.** `--split` transitions
  smoothly today, but when the verdict changes hands `turnPlate()` rebuilds the
  panels in swapped DOM order — so the one moment that matters, the handover,
  is the one moment that jumps. Render both panels in a fixed order and drive
  position and lit-state from CSS classes, so the emphasis slides across.
- [ ] **2. Stop re-rendering all of history on every snapshot.** `refresh()`
  clears both slots and rebuilds. Every live update from the other person kills
  hover state, scroll anchoring and any in-flight transition, and makes row-level
  animation impossible. Reconcile by entry id: patch, insert, remove.
- [ ] **3. Make a new entry announce itself.** Once rows persist across renders, a
  newly arrived row can fade-and-slide in with its owner's accent flashing once.
  "She just logged something" arriving live is the most useful event in the
  product, and right now it is indistinguishable from a re-render.
- [ ] **4. Replace the native date input.** `08/09/2026` in browser chrome is the
  one element that ignores the type system, and its format is locale-dependent so
  it reads ambiguously. Two chips — `today` / `yesterday` — cover almost all
  logging, with the full picker behind a quieter "other date" affordance.
- [ ] **5. Make it installable.** No `manifest.json`, no icons, no favicon. For a
  phone-first tool, add-to-home-screen with a standalone display mode and the
  `--void` theme colour is a large perceived-quality jump for very little code.
  Firestore offline persistence alongside it would let the page open and render
  the last known verdict with no signal.
- [ ] **6. Announce verdict changes to assistive tech.** The plate swaps silently;
  an `aria-live="polite"` region carrying `v.headline` makes the page's single
  output perceivable without sight. Related: after saving or cancelling an edit,
  focus lands nowhere — it should return to that row's edit button.

## Later, if the product grows

- **Group history by month** with a mono divider — structure that encodes
  something true, rather than a flat scroll.
- **A run of five accent dots** showing who paid the last five, in order. Leaks
  nothing beyond what is already shown, extends the colour system, and answers
  "am I on a streak?", which is the question people actually have.
- **A "settled up" marker** instead of wiping the list, so clearing becomes a
  milestone in the ledger rather than a deletion.

## Deliberately not doing

Changing the dusk palette, the Fraunces/Instrument Sans/DM Mono pairing, the four
tilt buckets, or the `•••`. Adding a light theme — this is a phone-in-bed app.
Adding a second bold element to compete with the plate.
