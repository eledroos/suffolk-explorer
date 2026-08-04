/**
 * User-defined groupings: localStorage persistence plus the shipped preset.
 */
import type { Bucket, Grouping } from '../contract';

const STORAGE_KEY = 'suffolk-explorer-groupings';

/**
 * The example grouping from DESIGN.md section 5. Every value string below is
 * verified verbatim against the disposition_description dictionary in
 * hayden.parquet (see src/engine.test.ts).
 */
export const PRESET_GROUPINGS: Grouping[] = [
  {
    id: 'preset_disposition_family',
    name: 'Disposition family (example — edit me)',
    column: 'disposition_description',
    buckets: [
      { name: 'Dismissed-type', values: ['Dismissed', 'Nole Prosequi', 'No True Bill'] },
      { name: 'Plea', values: ['Plea'] },
      { name: 'Trial verdicts', values: ['Verdict - Jury Trial', 'Verdict - Bench Trial'] },
      {
        name: 'Diversion-type',
        values: ['Diversion', 'Pre Trial Probation', 'Continued w/o Finding'],
      },
    ],
    otherLabel: 'Other',
  },
];

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function sanitizeBucket(b: unknown): Bucket | null {
  if (typeof b !== 'object' || b === null) return null;
  const o = b as Record<string, unknown>;
  if (typeof o.name !== 'string' || !isStringArray(o.values)) return null;
  return { name: o.name, values: o.values };
}

function sanitizeGrouping(g: unknown): Grouping | null {
  if (typeof g !== 'object' || g === null) return null;
  const o = g as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.column !== 'string') {
    return null;
  }
  if (!Array.isArray(o.buckets)) return null;
  const buckets: Bucket[] = [];
  for (const b of o.buckets) {
    const bucket = sanitizeBucket(b);
    if (bucket) buckets.push(bucket);
  }
  return {
    id: o.id,
    name: o.name,
    column: o.column,
    buckets,
    otherLabel: typeof o.otherLabel === 'string' && o.otherLabel ? o.otherLabel : 'Other',
  };
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null; // non-browser environments (tests) and blocked storage
  }
}

export function loadGroupings(): Grouping[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Grouping[] = [];
    for (const g of parsed) {
      const grouping = sanitizeGrouping(g);
      if (grouping) out.push(grouping);
    }
    return out;
  } catch {
    return [];
  }
}

export function saveGroupings(groupings: Grouping[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(groupings));
  } catch {
    // quota exceeded or storage blocked; persisting is best-effort
  }
}
