# DRGBT1K Benchmark Webpage

The DRGBT1K leaderboard runs on GitHub Pages and includes sortable PR, NPR, and SR rankings, a performance timeline, and links to papers and tracking resources.

## Current Structure

- `index.html`: page structure
- `styles.css`: page styling
- `app.js`: frontend rendering, data snapshot loading, optional Excel parsing, and timeline chart logic
- `data.js`: primary benchmark snapshot loaded by the page
- `DRGBT1k_results.xlsx`: workbook source used to regenerate `data.js`; also available as an Excel fallback when the snapshot is missing
- `methods.config.json`: optional local resource mapping for tracking results, code, and weights
- `scripts/build_data.py`: reads the workbook and regenerates `data.js`
- `_data/submissions/*.json`: community results accepted through pull requests
- `submissions.json`: public data generated from accepted results by GitHub Pages

## Submit a result

1. Open the leaderboard and select **Submit a result**. Enter the scores on the 245-sequence DRGBT1K test split as decimals between 0 and 1, and link the paper and predictions.
2. Select **Prepare GitHub submission**, open the GitHub editor, and propose the change in a pull request. The page shows the JSON and its path if you need to paste it into the editor.
3. After verification and merge into `main`, the existing GitHub Pages deployment publishes the result. It updates the ranking, summary, and timeline. To correct a previously merged submission, edit the same JSON file through a new pull request.

To update the workbook-backed entries, edit `DRGBT1k_results.xlsx` and run `python scripts/build_data.py`. Commit the workbook and generated snapshot together.
