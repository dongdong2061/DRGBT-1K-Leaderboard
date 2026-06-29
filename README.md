# DRGBT1K Benchmark Webpage

This is a GitHub Pages friendly static webpage for showing DRGBT1K benchmark results with sortable `PR / NPR / SR` rankings, a time-based chart, paper links, and reserved resource buttons for tracking results, code, and weights.

## Current Structure

- `index.html`: page structure
- `styles.css`: page styling
- `app.js`: frontend rendering, Excel parsing, and timeline chart logic
- `DRGBT1k_results.xlsx`: primary benchmark source
- `methods.config.json`: optional local resource mapping for tracking results, code, and weights
- `data.js`: fallback snapshot generated from the workbook
- `scripts/build_data.py`: reads the workbook and regenerates `data.js`

## Source of Truth

The webpage uses `DRGBT1k_results.xlsx` as the primary data source.

When the page is opened on GitHub Pages or a local static server, it will:

1. fetch `DRGBT1k_results.xlsx`
2. parse the workbook in the browser
3. build the leaderboard and timeline automatically

If live workbook loading fails, the page falls back to `data.js`.

## Workbook Support

The current parser supports the newer multi-sheet Chinese workbook layout and extracts:

- method names
- publication labels
- `PR`, `NPR`, and `SR`
- paper links
- method categories such as full fine-tuning or partial fine-tuning

The page keeps the original lightweight layout and does not add extra dashboard modules.

## Optional Resource Mapping

`methods.config.json` can be used to reserve or fill:

- tracking result links
- code links
- weight links

If a link is not available yet, the corresponding button remains disabled.

## Regenerating the Fallback Snapshot

```powershell
python .\scripts\build_data.py
```

This reads `DRGBT1k_results.xlsx` and writes a new `data.js`.
