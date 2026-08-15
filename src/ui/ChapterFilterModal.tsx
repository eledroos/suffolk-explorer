import { useEffect, useMemo, useRef, useState } from 'react';
import { aggregate, distinctValues } from '../engine';
import type { Dataset, Grouping, ViewState } from '../contract';
import { buildCountViewFor, countSignatureFor } from './modalCounts';
import {
  CHAPTER_COL, CHAPTER_PROVENANCE, NO_CODE_VALUE, chapterHref, chapterTitle, filterChapters,
} from './chapterModel';
import { IconExternal } from './icons';
import Modal from './Modal';

interface Props {
  ds: Dataset;
  view: ViewState;
  groupings: Grouping[];
  onSetFilter: (key: string, values: string[]) => void;
  onClose: () => void;
}

interface ChapterRow {
  value: string;
  count: number;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function ChapterFilterModal({ ds, view, groupings, onSetFilter, onClose }: Props) {
  const [staged, setStaged] = useState<Set<string>>(
    () => new Set(view.filters[CHAPTER_COL] ?? []),
  );
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // React's `autoFocus` is a no-op here: it calls .focus() while this input
  // is still inside a <dialog> that hasn't had showModal() called on it yet
  // (display: none until then), so the call does nothing, and the browser's
  // own dialog-focusing then lands on the header's Close button instead.
  // Modal.tsx's own useEffect (which calls showModal()) sits on a fiber
  // beneath this component in the tree - React fires effects child-before-
  // parent, so by the time this effect runs the dialog is already open.
  // requestAnimationFrame adds a one-frame margin past that so the focus
  // call doesn't depend on getting that ordering exactly right.
  useEffect(() => {
    const raf = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  // Every chapter value the loaded dataset carries, independent of the
  // current filters (same source DTP uses for its own dataValues).
  const dataValues = useMemo(() => distinctValues(ds, CHAPTER_COL), [ds]);

  // Live counts: one aggregate over the view with statute_chapter's own
  // filter stripped, grouped by statute_chapter.
  const sig = countSignatureFor([CHAPTER_COL], view, groupings);
  const { byValue, total } = useMemo(() => {
    const agg = aggregate(ds, buildCountViewFor([CHAPTER_COL], view), groupings);
    const byValue = new Map<string, number>();
    for (const r of agg.rows) byValue.set(r.x, (byValue.get(r.x) ?? 0) + r.value);
    return { byValue, total: agg.total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, groupings, sig]);

  const rows = useMemo<ChapterRow[]>(
    () => dataValues.map((value) => ({ value, count: byValue.get(value) ?? 0 })),
    [dataValues, byValue],
  );

  // Live count descending; 'No statute code' pinned last, but only while the
  // reader isn't searching, since a query result should read as "these rows
  // matched," not "these rows matched, except one pinned row that may not
  // have."
  const shown = useMemo(() => {
    const matched = filterChapters(rows, query);
    const sorted = [...matched].sort((a, b) => b.count - a.count);
    if (!query.trim()) {
      const idx = sorted.findIndex((r) => r.value === NO_CODE_VALUE);
      if (idx !== -1) sorted.push(...sorted.splice(idx, 1));
    }
    return sorted;
  }, [rows, query]);

  const toggle = (value: string) =>
    setStaged((s) => {
      const next = new Set(s);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const apply = () => {
    // Mirror normalizeSeverity/normalizeSelection's "full selection -> []"
    // convention locally: chapterModel exports no equivalent, but the
    // domain to check against is the same dataValues list the row list
    // already derives from distinctValues.
    const allSelected = dataValues.every((v) => staged.has(v));
    onSetFilter(CHAPTER_COL, allSelected ? [] : [...staged]);
    onClose();
  };

  const clear = () => setStaged(new Set<string>());

  const renderRow = (row: ChapterRow) => {
    const checked = staged.has(row.value);
    const title = chapterTitle(row.value);
    const href = chapterHref(row.value);
    const pct = total > 0 ? `${(row.count / total) * 100}%` : '0%';
    return (
      <li key={row.value} className={`chapter-row${checked ? ' on' : ''}`}>
        <label className="chapter-row-label">
          <input type="checkbox" checked={checked} onChange={() => toggle(row.value)} />
          <span className="chapter-row-text">
            <span className="chapter-row-value">{row.value}</span>
            {title && <span className="chapter-row-title">{title}</span>}
          </span>
        </label>
        <span className="chapter-row-count" aria-label={`${row.count} charges`}>
          {fmt(row.count)}
        </span>
        {/* A chapter with no charges in the current view draws no fill at
            all; the bar's min-width would otherwise render a zero as a
            visible stub. */}
        <div className="chapter-row-bar" aria-hidden="true">
          {row.count > 0 && <span style={{ width: pct }} />}
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn chapter-row-link"
            aria-label={`${row.value} on malegislature.gov`}
            title="View this chapter on malegislature.gov"
          >
            <IconExternal size={11} />
          </a>
        ) : (
          <span className="chapter-row-link-empty" aria-hidden="true" />
        )}
      </li>
    );
  };

  return (
    <Modal title="Statute chapter" onClose={onClose} wide>
      <div className="dtp-modal chapter-modal">
        <p className="dtp-lede">{CHAPTER_PROVENANCE}</p>

        <input
          ref={searchRef}
          type="search"
          className="chapter-search"
          placeholder="Search by chapter number or title"
          aria-label="Search statute chapters"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // A search input's native Escape behavior clears its value
            // first and only closes the dialog on a second press. Cancel
            // semantics (discard staged changes) on the first press instead,
            // matching every other Escape path in this modal. stopPropagation
            // keeps this same keydown from also reaching FilterPanel's
            // window-level Escape listener: that listener closes the Filters
            // drawer, guarded by "bail if a dialog[open] exists" - but by the
            // time it runs, onClose() has already unmounted this dialog, so
            // the guard passes and the drawer closes too. Stopping
            // propagation here means the drawer never sees this keypress at
            // all, same as it never sees an Escape handled by the dialog's
            // own native cancel path.
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
        />

        <div className="chapter-rows-wrap tablewrap">
          {shown.length > 0 ? (
            <ul className="chapter-rows">{shown.map(renderRow)}</ul>
          ) : (
            <p className="table-empty chapter-empty">No chapter matches &quot;{query}&quot;.</p>
          )}
        </div>

        <div className="dtp-actions">
          <button className="linklike" onClick={clear}>
            Clear
          </button>
          <span className="dtp-actions-spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}
