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
