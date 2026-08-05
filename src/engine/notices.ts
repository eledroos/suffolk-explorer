/**
 * Data-quality notices. Since the coverage-bands feature, the single source
 * of truth is the registry in coverage.ts; this module keeps the public
 * noticesFor signature and its original wording.
 */
import type { Grouping, Notice, ViewState } from '../contract';
import { noticesFromRegistry } from './coverage';

export function noticesFor(view: ViewState, groupings: Grouping[]): Notice[] {
  return noticesFromRegistry(view, groupings);
}
