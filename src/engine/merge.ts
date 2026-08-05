/**
 * Concatenate two Datasets (the Hayden file + the lazy-loaded history file)
 * into one. Categorical dictionaries are unioned and codes remapped; typed
 * arrays are concatenated. Row order: base first, then extra.
 */
import type { Dataset } from '../contract';

function concatInt32(a: Int32Array, b: Int32Array): Int32Array {
  const out = new Int32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function concatUint8(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function mergeDatasets(base: Dataset, extra: Dataset): Dataset {
  const n = base.rowCount + extra.rowCount;
  const cats: Dataset['cats'] = {};
  for (const key of Object.keys(base.cats)) {
    const a = base.cats[key];
    const b = extra.cats[key];
    if (!b) {
      // column absent in extra: all-null codes for its rows
      const codes = new Int32Array(n).fill(-1);
      codes.set(a.codes, 0);
      cats[key] = { dict: a.dict, codes };
      continue;
    }
    const dict = [...a.dict];
    const index = new Map(dict.map((v, i) => [v, i]));
    const remap = new Int32Array(b.dict.length);
    b.dict.forEach((v, i) => {
      let at = index.get(v);
      if (at === undefined) {
        at = dict.length;
        dict.push(v);
        index.set(v, at);
      }
      remap[i] = at;
    });
    const codes = new Int32Array(n);
    codes.set(a.codes, 0);
    for (let i = 0; i < b.codes.length; i++) {
      codes[a.codes.length + i] = b.codes[i] < 0 ? -1 : remap[b.codes[i]];
    }
    cats[key] = { dict, codes };
  }
  const dates: Dataset['dates'] = {};
  for (const key of Object.keys(base.dates)) {
    dates[key] = extra.dates[key]
      ? concatInt32(base.dates[key], extra.dates[key])
      : concatInt32(base.dates[key], new Int32Array(extra.rowCount).fill(-1000000000));
  }
  const ids: Dataset['ids'] = {};
  for (const key of Object.keys(base.ids)) {
    ids[key] = extra.ids[key]
      ? concatInt32(base.ids[key], extra.ids[key])
      : concatInt32(base.ids[key], new Int32Array(extra.rowCount));
  }
  const bools: Dataset['bools'] = {};
  for (const key of Object.keys(base.bools)) {
    bools[key] = extra.bools[key]
      ? concatUint8(base.bools[key], extra.bools[key])
      : concatUint8(base.bools[key], new Uint8Array(extra.rowCount));
  }
  const text: Dataset['text'] = {};
  for (const key of Object.keys(base.text)) {
    text[key] = extra.text[key]
      ? [...base.text[key], ...extra.text[key]]
      : [...base.text[key], ...new Array<string>(extra.rowCount).fill('')];
  }
  return { rowCount: n, cats, dates, ids, bools, text };
}
