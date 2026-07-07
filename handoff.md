# ZOPA Project Handoff

## Summary of Changes (July 07, 2026)

### 1. Customizable PO and PR Numbering System
- **Database:** Added `po_starting_series`, `pr_prefix`, and `pr_starting_series` to the `tenants` table (via migration). Widened `po_prefix` and `pr_prefix` columns to 50 characters to support longer, complex prefixes (e.g., `TH/2026-27/`).
- **Backend Services:** Rewrote `PoNumberService` and `PrNumberService` to abandon the hardcoded 4-digit zero-padding format (`{ORG_CODE}-PO-{YEAR}-0001`). They now generate document numbers by strictly concatenating the tenant's configured prefix and starting series (e.g., `TH/2026-27/49`).
- **Frontend UI:** Updated the Super Admin "Edit Client" screen to expose fields for configuring both PO and PR prefixes and starting series. The changes update the tenant configuration in real-time.

### 2. Live Production Data Fixes (p2p.zopapro.com)
- Dealt with an issue where a PO generated under the old numbering logic (`2601/02/TOTALHEALTH-PO-2026-0001`) needed to be aligned with the newly configured starting series.
- Wrote and deployed one-off database migrations to safely update this specific PO number to `TH/2026-27/49` on the live Linode production database.

### 3. PO PDF Layout Refinements
- **Line Items Table:** Removed the hardcoded "Freight / Transportation" row from the main items table.
- **Totals Table:** Re-ordered the Totals summary section at the bottom right. "Freight" now appears *above* the "GST / Tax Amount" row, making it clearer when calculating taxes.

## Important Note on Document Numbering
Whenever you update a prefix in the "Edit Client" configuration, **always ensure you include any necessary separators (like a trailing slash `/` or hyphen `-`) at the end of the prefix.** 
For example, if you want the next PO to be `TH/2026-27/50`, you must enter `TH/2026-27/` as the Prefix and `50` as the Starting Series.
