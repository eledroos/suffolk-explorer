import { useCallback, useMemo, useRef } from 'react';
import { distinctValues } from '../engine';
import { COLUMNS, LENS_INFO, type Dataset, type Grouping, type ViewState } from '../contract';
import { colLabel, displayValue, truncate } from './format';
import { IconClose } from './icons';
import MultiSelect from './MultiSelect';

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

        <section className="fp-section">
          {filterCols.map((c) => (
            <MultiSelect
              key={c.name}
              label={c.label}
              getValues={getColValues(c.name)}
              selected={view.filters[c.name] ?? []}
              onChange={(vals) => onSetFilter(c.name, vals)}
            />
          ))}
        </section>

        {groupings.length > 0 && (
          <section className="fp-section">
            <h4 className="field-label">Custom groupings</h4>
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
  );
}
