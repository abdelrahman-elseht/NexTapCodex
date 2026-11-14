# Card and Manufacturing Functions

| Export | Source | Reuse contract | Primary verification |
| --- | --- | --- | --- |
| `CARD_ORIGIN`, `cardUrls`, `getCardOrigin` | `src/lib/cards/card-manufacturing.ts` | Stable card destinations and origin selection | Card route/manufacturing tests |
| `manifestCsv`, `nfcCsv`, `qrSvg`, `manufacturingZip` | `src/lib/cards/card-manufacturing.ts` | Manufacturing export artifacts for card batches | `card-manufacturing.test.ts`, card manufacturing E2E |
| `sanitizeSerial`, `csv`, `qrIndexHtml` | `src/lib/cards/card-manufacturing.ts` | Safe serial and export formatting used by manufacturing output | Card manufacturing tests |
| `readBatchSnapshot` | `src/lib/cards/batch-snapshot.ts` | Reads current batch state through the legacy persistence adapter | Card batch/route tests |

Preserve the distinction between permanent `/b/{slug}` direct-profile URLs and token-based `/c/{token}` destinations described by the [Codebook](../../CODEBOOK.md). Confirm the active migration phase before depending on current data adapters.
