import { useMemo, useState } from 'react';
import { aggregate, distinctValues } from '../engine';
import type { Dataset, Grouping, ViewState } from '../contract';
import {
  DTP_CAVEAT, DTP_COLUMNS, DTP_CONTENT, DTP_HEADER, type DtpColumn,
  applyPayload, buildCountView, cardsFor, countSignature, countsFromAgg, stageFromFilters,
} from './dtpModel';
import Modal from './Modal';

interface Props {
  ds: Dataset;
  view: ViewState;
  groupings: Grouping[];
  onSetFilter: (key: string, values: string[]) => void;
  onClose: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function DtpFilterModal({ ds, view, groupings, onSetFilter, onClose }: Props) {
  const [staged, setStaged] = useState(() => stageFromFilters(view.filters));

  // Counts: one aggregate per column, same world minus the DTP filters.
  // Keyed on countSignature so a view change that cannot move the counts
  // (e.g. a DTP filter applied from this modal, or a chart-type change)
  // does not recompute. aggregate() is synchronous, so there is no loading
  // state; the spec's "em-dash while computing" case cannot occur and the
  // count is always present on first paint.
  const sig = countSignature(view);
  const counts = useMemo(() => {
    const out = {} as Record<DtpColumn, { byValue: Map<string, number>; total: number }>;
    for (const col of DTP_COLUMNS)
      out[col] = countsFromAgg(aggregate(ds, buildCountView(view, col), groupings));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, groupings, sig]);

  const dataValues = useMemo(
    () => ({
      dtp_class: distinctValues(ds, 'dtp_class'),
      dtp_review: distinctValues(ds, 'dtp_review'),
    }),
    [ds],
  );

  const toggle = (col: DtpColumn, value: string) =>
    setStaged((s) => {
      const next = new Set(s[col]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...s, [col]: next };
    });

  const apply = () => {
    const payload = applyPayload(staged, dataValues);
    for (const col of DTP_COLUMNS) onSetFilter(col, payload[col]);
    onClose();
  };

  const clearBoth = () =>
    setStaged({ dtp_class: new Set<string>(), dtp_review: new Set<string>() });

  const bothConstrained = staged.dtp_class.size > 0 && staged.dtp_review.size > 0;

  return (
    <Modal title="Decline-to-prosecute categories" onClose={onClose} wide>
      <div className="dtp-modal">
        <p className="dtp-lede">{DTP_HEADER.plain}</p>
        <details className="dtp-more">
          <summary>More about where these categories come from</summary>
          {DTP_HEADER.detail.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </details>

        {DTP_COLUMNS.map((col, idx) => (
          <section key={col} aria-label={DTP_CONTENT[col].title}>
            <h3 className="dtp-section-title">
              {DTP_CONTENT[col].title}
              <span className="dtp-denom">
                of {fmt(counts[col].total)} charges in the current view
              </span>
            </h3>
            <ul className="dtp-cards">
              {cardsFor(col, dataValues[col]).map((card) => (
                <li key={card.value} className="dtp-card">
                  <label className="dtp-card-main">
                    <input
                      type="checkbox"
                      checked={staged[col].has(card.value)}
                      onChange={() => toggle(col, card.value)}
                    />
                    <span className="dtp-card-name">{card.name}</span>
                    <span
                      className="dtp-card-count"
                      aria-label={`${counts[col].byValue.get(card.value) ?? 0} charges`}
                    >
                      {fmt(counts[col].byValue.get(card.value) ?? 0)}
                    </span>
                  </label>
                  {card.plain && <p className="dtp-card-plain">{card.plain}</p>}
                  {card.detail.length > 0 && (
                    <details className="dtp-more">
                      <summary>More</summary>
                      {card.detail.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </details>
                  )}
                </li>
              ))}
            </ul>
            {idx === 0 && <p className="dtp-caveat">{DTP_CAVEAT}</p>}
          </section>
        ))}

        {bothConstrained && (
          <p className="dtp-footnote">
            Showing charges matching a checked decline-list category AND a
            checked review status.
          </p>
        )}

        <div className="dtp-actions">
          <button className="linklike" onClick={clearBoth}>
            Clear both
          </button>
          <span className="dtp-actions-spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}
