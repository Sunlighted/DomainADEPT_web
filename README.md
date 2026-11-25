# DomainADEPT project page

Static site, no build step. Open `index.html` locally or serve it with GitHub Pages
(Settings → Pages → Deploy from branch → `main` / root). `.nojekyll` is included.

## To fill in before publishing
- `index.html`: the two `TODO` buttons (arXiv, Code) — set `href` and remove the `todo` class.
- `index.html`: the arXiv id in the BibTeX block.

## Layout
- `assets/js/figures.js` — chart data, copied from `ibrl/plots/web/data/figures.js` (same arrays as the paper PDFs).
- `assets/js/charts.js`, `assets/css/charts.css` — chart renderer (from `ibrl/plots/web`, with reference lines moved into the legend).
- `assets/js/site.js` — page-specific sizes/labels, the combined "attempts that did not help" row, real-robot video tabs.
- `assets/videos/` — H.264 re-encodes of `ibrl/videos/*.mp4` (originals are HEVC, which most browsers cannot play).
  Method video 1080p CRF 25; real-robot videos 720p CRF 27, audio removed.

To refresh the chart data after changing the paper plots: rerun `ibrl/plots/web/build.sh` and copy `data/figures.js` here.
