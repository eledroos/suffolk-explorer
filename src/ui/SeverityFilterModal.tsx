import { useMemo, useState } from 'react';
import { aggregate } from '../engine';
import type { Dataset, Grouping, ViewState } from '../contract';
import { buildCountViewFor, countSignatureFor } from './modalCounts';
import {
  SEVERITY_CARDS, SEVERITY_COL, SEVERITY_FOOTNOTE_NO_HISTORY, SEVERITY_HEADER,
  SEVERITY_HISTORY_VALUE, normalizeSeverity, type SeverityCard,
} from './severityModel';
import { IconExternal } from './icons';
import Modal from './Modal';

interface Props {
  ds: Dataset;
  view: ViewState;
  groupings: Grouping[];
  onSetFilter: (key: string, values: string[]) => void;
  onClose: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function SeverityFilterModal({ ds, view, groupings, onSetFilter, onClose }: Props) {
  const [staged, setStaged] = useState<Set<string>>(
    () => new Set(view.filters[SEVERITY_COL] ?? []),
  );

  // Live counts: one aggregate over the view with severity_class's own
  // filter stripped, grouped by severity_class. Memoized on the shared
  // count signature so a change that cannot move these counts (e.g. staging
  // a checkbox here, or an unrelated chart-only setting) does not recompute.
  const sig = countSignatureFor([SEVERITY_COL], view, groupings);
  const { byValue, total } = useMemo(() => {
    const agg = aggregate(ds, buildCountViewFor([SEVERITY_COL], view), groupings);
    const byValue = new Map<string, number>();
    for (const r of agg.rows) byValue.set(r.x, (byValue.get(r.x) ?? 0) + r.value);
    return { byValue, total: agg.total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, groupings, sig]);

  // The history card is only ever offered when the toggle that loads its
  // rows is on; with it off, `ds` itself carries no 'Not graded' rows (see
  // App.tsx's activeDs), so treating the visible cards as the normalization
  // domain keeps "check everything on screen" collapsing to "no filter" in
  // both states, rather than getting stuck one card short whenever history
  // is off.
  const cards = view.history
    ? SEVERITY_CARDS
    : SEVERITY_CARDS.filter((c) => c.value !== SEVERITY_HISTORY_VALUE);

  const toggle = (value: string) =>
    setStaged((s) => {
      const next = new Set(s);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const apply = () => {
    const available = cards.map((c) => c.value);
    onSetFilter(SEVERITY_COL, normalizeSeverity([...staged], available));
    onClose();
  };

  const clear = () => setStaged(new Set<string>());

  const renderCard = (card: SeverityCard) => {
    const count = byValue.get(card.value) ?? 0;
    const pct = total > 0 ? `${(count / total) * 100}%` : '0%';
    const checked = staged.has(card.value);
    return (
      <li key={card.value} className={`dtp-card${checked ? ' on' : ''}`}>
        <label className="dtp-card-main">
          <input type="checkbox" checked={checked} onChange={() => toggle(card.value)} />
          <span className="dtp-card-name">{card.value}</span>
          <span className="dtp-card-count" aria-label={`${count} charges`}>
            {fmt(count)}
          </span>
        </label>
        {/* A category with no charges in the current view draws no fill at
            all; the bar's min-width would otherwise render a zero as a
            visible stub. */}
        <div className="dtp-bar" aria-hidden="true">
          {count > 0 && <span style={{ width: pct }} />}
        </div>
        <p className="dtp-card-plain">{card.blurb}</p>
        <details className="dtp-more">
          <summary>More</summary>
          {card.detail.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {card.detail.links && card.detail.links.length > 0 && (
            <div className="dtp-links">
              {card.detail.links.map((l) =>
                l.external ? (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dtp-link"
                  >
                    {l.label}
                    <IconExternal size={10} />
                  </a>
                ) : (
                  <a key={l.href} href={l.href} className="dtp-link">
                    {l.label}
                  </a>
                ),
              )}
            </div>
          )}
        </details>
      </li>
    );
  };

  return (
    <Modal title="Severity" onClose={onClose} wide>
      <div className="dtp-modal severity-modal">
        {SEVERITY_HEADER.paragraphs.map((p, i) => (
          <p key={i} className="dtp-lede">
            {p}
          </p>
        ))}
        {SEVERITY_HEADER.links.length > 0 && (
          <div className="dtp-links">
            {SEVERITY_HEADER.links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="dtp-link"
              >
                {l.label}
                <IconExternal size={10} />
              </a>
            ))}
          </div>
        )}

        <ul className="dtp-cards">{cards.map(renderCard)}</ul>
        {!view.history && <p className="dtp-footnote">{SEVERITY_FOOTNOTE_NO_HISTORY}</p>}

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
