import { useMemo, useState } from 'react';
import { displayValue } from './format';
import { IconChevron } from './icons';

interface MultiSelectProps {
  label: string;
  /** Lazy so distinct values are only computed when a section is opened. */
  getValues: () => string[];
  /** Selected values; empty array means no filter (all values pass). */
  selected: string[];
  onChange: (next: string[]) => void;
}

/**
 * Searchable include-list. Nothing checked = no filter. Checking values keeps
 * only those. If every value ends up checked, the filter normalizes back to
 * "all" (empty selection) to keep URLs short.
 */
export default function MultiSelect({ label, getValues, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const values = useMemo(() => (open ? getValues() : []), [open, getValues]);
  const shown = useMemo(() => {
    if (!query) return values;
    const q = query.toLowerCase();
    return values.filter((v) => displayValue(v).toLowerCase().includes(q));
  }, [values, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (v: string) => {
    const next = new Set(selectedSet);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next.size === values.length ? [] : [...next]);
  };

  const selectShown = () => {
    const next = new Set(selectedSet);
    for (const v of shown) next.add(v);
    onChange(next.size === values.length ? [] : [...next]);
  };

  return (
    <div className={`ms${open ? ' open' : ''}`}>
      <button
        className="ms-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <IconChevron open={open} />
        <span className="ms-label">{label}</span>
        <span className={`ms-count${selected.length > 0 ? ' filtered' : ''}`}>
          {selected.length > 0 ? selected.length : 'all'}
        </span>
      </button>
      {open && (
        <div className="ms-body">
          <input
            type="search"
            className="ms-search"
            placeholder={`Search ${label.toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="ms-tools">
            <button className="linklike" onClick={selectShown} disabled={shown.length === 0}>
              Check shown
            </button>
            <button className="linklike" onClick={() => onChange([])} disabled={selected.length === 0}>
              Clear
            </button>
            <span className="ms-hint">
              {selected.length === 0 ? 'No filter' : `${selected.length} of ${values.length}`}
            </span>
          </div>
          <ul className="ms-list">
            {shown.map((v) => (
              <li key={v}>
                <label className="ms-item">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(v)}
                    onChange={() => toggle(v)}
                  />
                  <span title={displayValue(v)}>{displayValue(v)}</span>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="ms-empty">No values match</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
