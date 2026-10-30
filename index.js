/**
 * Host half of the token-usage-panel bundle.
 *
 * Registers no Host behavior: every number on the page comes from projections
 * that already exist in the composition — `tokenUsage` from `dsh-token-meter`
 * and `tokenCost` from `dsh-token-usage-cost` — so this bundle stays a pure
 * Client contribution and never duplicates the price table.
 */
export function apply() {}
