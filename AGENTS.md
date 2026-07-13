# Physics Lab repository guidance

## Purpose

This repository contains browser-based physics demonstrations for classroom use. Accuracy and teaching clarity take priority over decorative effects.

## Structure

- Keep the experiment library at `index.html`.
- Put shared visual assets in `assets/`.
- Give every experiment its own folder under `experiments/<short-english-slug>/`.
- Each experiment should remain independently understandable and directly linkable.

## Visual system

- Reuse the deep-space background, restrained cyan accents, fine borders, compact data labels, and low-intensity glow established by the eclipse experiment.
- Prefer a modern scientific-instrument feel. Avoid excessive neon, glitch effects, decorative animation, or crowded panels.
- Preserve the same control vocabulary across experiments: scenario selection, play/pause, speed, reset, view change, and explanatory notes.

## Physics accuracy

- Check physical claims against primary sources such as NASA, national laboratories, standards bodies, or original research as appropriate.
- Keep causal relationships, directions, ordering, signs, and boundary cases physically correct.
- When a single true scale would make a classroom visualization unusable, use an explicit teaching scale and disclose every important distortion in the interface.
- Never bend a trajectory, ray, force vector, field line, or shadow merely to make it meet a target on screen.
- Separate the simulation state from the drawing layer so numerical behavior can be tested independently.

## Validation before release

- After changing `experiments/eclipse/app.js`, run `npm run build` and commit the regenerated `app.bundle.js`; the HTML uses the bundle so it can also run from a local `file://` URL.
- Test every scenario at its start, maximum/critical state, and end.
- Test forward play, reverse play, pause, speed changes, view switching, and all visibility toggles.
- Inspect at desktop and narrow/mobile viewport sizes.
- Run JavaScript syntax and local-link checks.
- Keep `main` releasable. Make material changes on a dedicated branch, preview them, and merge only after user acceptance.
