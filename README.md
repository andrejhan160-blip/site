# Стройтрансрегион — Landing (Dark)

Static landing page for **ООО «Стройтрансрегион»** — roofing and façade works
for commercial, industrial and private objects in Moscow and the Moscow region.

Imported from the Claude Design project *"Landing Stroytransregion — Dark"* and
implemented as a self-contained static site (no framework, no runtime).

## Files

- `index.html` — the built, deployable page. **Generated — do not edit by hand.**
- `build.js` — Node generator. Ports the design's data model + template and
  renders `index.html`, including the decorative mesh SVGs, service icons, and a
  small vanilla-JS bundle for interactivity.
- `assets/` — image assets (photos, logo).

## Build

```bash
node build.js   # writes ./index.html
```

No dependencies — plain Node.

## Deploy

Serve the folder as static files (any web server, or open `index.html`
directly). The page loads the Manrope font from Google Fonts and gracefully
falls back to the system font when offline.

## Interactivity

Implemented in vanilla JS (bottom of `index.html`):

- Responsive header (desktop nav ↔ mobile hamburger menu at ≤1080px)
- "Наши работы" category filter tabs
- FAQ accordion (single item open at a time)
- Request forms — channel chips, phone/consent validation, submit feedback.
  Forms currently log to the console and show a confirmation; wire the submit
  handler to a backend/CRM to receive leads.

## Note on assets

Three source images (`work1.jpg`, `hero-house.jpg`, `roof-torch.png`) exceeded
the design API's per-file transfer limit and could not be retrieved intact.
They were substituted with thematically-matching photos from the same project
(industrial waterproofing, a finished house, and torch-down waterproofing
respectively), keeping every image reference valid. Swap in the originals if you
have them.
