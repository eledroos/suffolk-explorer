/**
 * Parquet loading: fetch/read public/data/hayden.parquet with hyparquet and
 * build the column-oriented Dataset struct from the frozen contract.
 */
import { parquetMetadataAsync, parquetRead, asyncBufferFromUrl } from 'hyparquet';
import { decompress } from './fzstd.js';
import { COLUMNS, type ColKind, type Dataset } from '../contract';

/** Sentinel for a null date32 value (contract: "NaN/-1e9 sentinel for null"). */
export const NULL_DATE = -1000000000;

/** hayden.parquet is ZSTD-compressed; hyparquet needs a custom decompressor. */
const compressors = {
  ZSTD: (input: Uint8Array, outputLength: number) =>
    decompress(input, new Uint8Array(outputLength)),
};

const KIND_BY_NAME: ReadonlyMap<string, ColKind> = new Map(
  COLUMNS.map((c) => [c.name, c.kind]),
);

/**
 * Wrap the data location as a hyparquet AsyncBuffer. In the browser every
 * url goes through fetch; under node (vitest) a non-http string is treated
 * as a filesystem path and read via asyncBufferFromFile, which only exists
 * in hyparquet's node entry, hence the dynamic import.
 */
async function openAsyncBuffer(url: string): Promise<{ byteLength: number; slice(start: number, end?: number): ArrayBuffer | Promise<ArrayBuffer> }> {
  const isHttp = /^https?:/i.test(url);
  if (!isHttp && typeof window === 'undefined') {
    const hp: any = await import('hyparquet');
    if (typeof hp.asyncBufferFromFile === 'function') {
      return hp.asyncBufferFromFile(url);
    }
  }
  return asyncBufferFromUrl({ url });
}

/**
 * Convert a parquet date32 cell to days since the unix epoch. Depending on
 * the hyparquet version the value may arrive as a Date (UTC midnight) or as
 * the raw day number; handle both. Null becomes NULL_DATE.
 */
function toDay(v: unknown): number {
  if (v === null || v === undefined) return NULL_DATE;
  if (v instanceof Date) {
    const t = v.getTime();
    if (!Number.isFinite(t)) return NULL_DATE;
    return Math.round(t / 86400000);
  }
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : NULL_DATE;
  if (typeof v === 'bigint') return Number(v);
  return NULL_DATE;
}

export async function loadDataset(url: string): Promise<Dataset> {
  const file = await openAsyncBuffer(url);
  const meta = await parquetMetadataAsync(file);
  const rowCount = Number(meta.num_rows);

  const ds: Dataset = { rowCount, cats: {}, dates: {}, ids: {}, bools: {}, text: {} };
  const dictMaps: Record<string, Map<string, number>> = {};

  for (const c of COLUMNS) {
    switch (c.kind) {
      case 'cat':
        ds.cats[c.name] = { dict: [], codes: new Int32Array(rowCount) };
        dictMaps[c.name] = new Map();
        break;
      case 'date': {
        const arr = new Int32Array(rowCount);
        arr.fill(NULL_DATE);
        ds.dates[c.name] = arr;
        break;
      }
      case 'id':
      case 'int':
        ds.ids[c.name] = new Int32Array(rowCount);
        break;
      case 'bool':
        ds.bools[c.name] = new Uint8Array(rowCount);
        break;
      case 'text':
        ds.text[c.name] = new Array<string>(rowCount).fill('');
        break;
    }
  }
  // The contract's Dataset comment lists charge_code under text alongside its
  // 'cat' kind in COLUMNS; mirror it into both so either access path works.
  ds.text['charge_code'] = new Array<string>(rowCount).fill('');

  await parquetRead({
    file,
    compressors,
    onChunk({ columnName, columnData, rowStart }) {
      const kind = KIND_BY_NAME.get(columnName);
      if (!kind) return;
      const n = columnData.length;
      switch (kind) {
        case 'cat': {
          const { dict, codes } = ds.cats[columnName];
          const map = dictMaps[columnName];
          const mirror = ds.text[columnName];
          for (let i = 0; i < n; i++) {
            const v = columnData[i];
            if (v === null || v === undefined) {
              codes[rowStart + i] = -1;
              continue;
            }
            const s = typeof v === 'string' ? v : String(v);
            let code = map.get(s);
            if (code === undefined) {
              code = dict.length;
              dict.push(s);
              map.set(s, code);
            }
            codes[rowStart + i] = code;
            if (mirror) mirror[rowStart + i] = s;
          }
          break;
        }
        case 'date': {
          const arr = ds.dates[columnName];
          for (let i = 0; i < n; i++) arr[rowStart + i] = toDay(columnData[i]);
          break;
        }
        case 'id':
        case 'int': {
          const arr = ds.ids[columnName];
          for (let i = 0; i < n; i++) {
            const v = columnData[i];
            arr[rowStart + i] = v === null || v === undefined ? 0 : Number(v);
          }
          break;
        }
        case 'bool': {
          const arr = ds.bools[columnName];
          for (let i = 0; i < n; i++) arr[rowStart + i] = columnData[i] ? 1 : 0;
          break;
        }
        case 'text': {
          const arr = ds.text[columnName];
          for (let i = 0; i < n; i++) {
            const v = columnData[i];
            arr[rowStart + i] = v === null || v === undefined ? '' : String(v);
          }
          break;
        }
      }
    },
  });

  return ds;
}

/** Sorted, non-null distinct values of a column (dictionary order for cats). */
export function distinctValues(ds: Dataset, col: string): string[] {
  const cat = ds.cats[col];
  if (cat) return [...cat.dict].sort();
  const text = ds.text[col];
  if (text) {
    const seen = new Set<string>();
    for (const v of text) if (v) seen.add(v);
    return [...seen].sort();
  }
  if (ds.bools[col]) return ['false', 'true'];
  return [];
}
