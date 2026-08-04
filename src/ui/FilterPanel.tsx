import { useCallback, useEffect, useMemo, useRef } from 'react';
import { distinctValues } from '../engine';
import { COLUMNS, LENS_INFO, type Dataset, type Grouping, type ViewState } from '../contract';
import { colLabel, displayValue, truncate } from './format';
import { IconClose } from './icons';
import MultiSelect from './MultiSelect';

/** Filter sections, chunked so substantive dimensions outrank provenance.
    Any filterable column not named here lands in the last group. */
const FILTER_GROUPS: { label: string; cols: string[] }[] = [
  { label: 'Case', cols: ['crime_type', 'court', 'case_status', 'agency', 'charge_description', 'dtp_class'] },
  { label: 'Outcome', cols: ['disposition_description', 'disposition_reason', 'outcome_detail', 'outcome_class', 'prosecutorial_call'] },
  { label: 'People', cols: ['race', 'sex'] },
  { label: 'DA administration', cols: ['filed_under', 'disposed_under'] },
  { label: 'Source files', cols: ['filing_source', 'disposition_source'] },
];

interface FilterPanelProps {
  ds: Dataset;
  view: ViewState;
  groupings: Grouping[];
  onSetFilter: (key: string, values: string[]) => void;
  onPatch: (p: Partial<ViewState>) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const MAX_CHIPS = 10;

export default function FilterPanel({
  ds,
  view,
  groupings,
  onSetFilter,
  onPatch,
  onClearAll,
  onClose,
}: FilterPanelProps) {
  const filterCols = COLUMNS.filter((c) => c.filterable && c.kind === 'cat');
  const dateLabel = colLabel(LENS_INFO[view.lens].dateField);

  // Columns grouped for scanability; anything unlisted falls into a trailing group.
  const named = new Set(FILTER_GROUPS.flatMap((g) => g.cols));
  const byName = new Map(filterCols.map((c) => [c.name, c]));
  const grouped = FILTER_GROUPS.map((g) => ({
    label: g.label,
    cols: g.cols.flatMap((n) => (byName.has(n) ? [byName.get(n)!] : [])),
  })).filter((g) => g.cols.length > 0);
  const rest = filterCols.filter((c) => !named.has(c.name));
  if (rest.length > 0) grouped.push({ label: 'Other', cols: rest });

  // The panel becomes an overlay drawer under 1100px; there, Esc closes it
  // (unless a modal dialog above is handling Esc itself).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('dialog[open]')) return;
      if (window.matchMedia('(max-width: 1100px)').matches) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Cache distinct values per column for the life of the dataset.
  const cacheRef = useRef(new Map<string, string[]>());
  const getColValues = useCallback(
    (col: string) => () => {
      const cache = cacheRef.current;
      let v = cache.get(col);
      if (!v) {
        v = distinctValues(ds, col);
        cache.set(col, v);
      }
      return v;
    },
    [ds],
  );

  const chips = useMemo(() => {
    const out: { key: string; value: string; label: string }[] = [];
    for (const [key, vals] of Object.entries(view.filters)) {
      if (!vals || vals.length === 0) continue;
      const name = key.startsWith('g:')
        ? groupings.find((g) => g.id === key.slice(2))?.name ?? 'Custom'
        : colLabel(key);
      for (const v of vals) out.push({ key, value: v, label: `${name}: ${displayValue(v)}` });
    }
    return out;
  }, [view.filters, groupings]);

  const removeChip = (key: string, value: string) => {
    const vals = (view.filters[key] ?? []).filter((v) => v !== value);
    onSetFilter(key, vals);
  };

  const anyActive = chips.length > 0 || view.dateFrom !== null || view.dateTo !== null;

  return (
    <>
      <div className="fpanel-scrim" onClick={onClose} aria-hidden />
      <aside className="fpanel" aria-label="Filters">
      <div className="fpanel-head">
        <h3 className="microlabel">Filters</h3>
        {anyActive && (
          <button className="linklike" onClick={onClearAll}>
            Clear all
          </button>
        )}
        <button className="icon-btn fpanel-close" onClick={onClose} aria-label="Close filters">
          <IconClose />
        </button>
      </div>

      <div className="fpanel-scroll">
        <section className="fp-section">
          <h4 className="field-label">{dateLabel} range</h4>
          <div className="daterange">
            <input
              type="date"
              value={view.dateFrom ?? ''}
              max={view.dateTo ?? undefined}
              onChange={(e) => onPatch({ dateFrom: e.target.value || null })}
              aria-label="Date from"
            />
            <span className="daterange-sep">to</span>
            <input
              type="date"
              value={view.dateTo ?? ''}
              min={view.dateFrom ?? undefined}
              onChange={(e) => onPatch({ dateTo: e.target.value || null })}
              aria-label="Date to"
            />
          </div>
          {(view.dateFrom || view.dateTo) && (
            <button
              className="linklike"
              onClick={() => onPatch({ dateFrom: null, dateTo: null })}
            >
              Clear dates
            </button>
          )}
        </section>

        {chips.length > 0 && (
          <section className="fp-section">
            <h4 className="field-label">Active</h4>
            <div className="chips">
              {chips.slice(0, MAX_CHIPS).map((c) => (
                <button
                  key={`${c.key}|${c.value}`}
                  className="chip"
                  onClick={() => removeChip(c.key, c.value)}
                  title={`Remove ${c.label}`}
                >
                  <span>{truncate(c.label, 34)}</span>
                  <IconClose size={9} />
                </button>
              ))}
              {chips.length > MAX_CHIPS && (
                <span className="chips-more">+{chips.length - MAX_CHIPS} more</span>
              )}
            </div>
          </section>
        )}

        {grouped.map((g) => (
          <section key={g.label} className="fp-section">
            <h4 className="microlabel fp-group-label">{g.label}</h4>
            {g.cols.map((c) => (
              <MultiSelect
                key={c.name}
                label={c.label}
                getValues={getColValues(c.name)}
                selected={view.filters[c.name] ?? []}
                onChange={(vals) => onSetFilter(c.name, vals)}
              />
            ))}
          </section>
        ))}

        {groupings.length > 0 && (
          <section className="fp-section">
            <h4 className="microlabel fp-group-label">Custom groupings</h4>
            {groupings.map((g) => (
              <MultiSelect
                key={g.id}
                label={g.name}
                getValues={() => [...g.buckets.map((b) => b.name), g.otherLabel || 'Other']}
                selected={view.filters[`g:${g.id}`] ?? []}
                onChange={(vals) => onSetFilter(`g:${g.id}`, vals)}
              />
            ))}
          </section>
        )}
      </div>
      </aside>
    </>
  );
}
