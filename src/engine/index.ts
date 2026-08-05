/**
 * Engine public API. src/contract.ts lists these exports verbatim:
 *   loadDataset, aggregate, distinctValues, noticesFor, encodeView,
 *   decodeView, loadGroupings, saveGroupings, PRESET_GROUPINGS, aggToCsv
 */
export { loadDataset, distinctValues } from './load';
export { aggregate } from './aggregate';
export { noticesFor } from './notices';
export { bandsFor, bandBuckets, fmtMonth, COVERAGE } from './coverage';
export type { ActiveBand, BandSeverity } from './coverage';
export { encodeView, decodeView } from './view';
export { loadGroupings, saveGroupings, PRESET_GROUPINGS } from './groupings';
export { aggToCsv } from './csv';
