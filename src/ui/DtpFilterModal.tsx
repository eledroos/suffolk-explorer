import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { aggregate, distinctValues } from '../engine';
import type { Dataset, Grouping, ViewState } from '../contract';
import {
  DTP_CAVEAT, DTP_COLUMNS, DTP_CONTENT, DTP_HEADER, MEMO_URL, type DtpCard, type DtpColumn,
  applyPayload, buildCountView, cardsFor, countSignature, countsFromAgg, stageFromFilters,
} from './dtpModel';
import { IconExternal } from './icons';
import Modal from './Modal';

interface Props {
  ds: Dataset;
  view: ViewState;
  groupings: Grouping[];
  onSetFilter: (key: string, values: string[]) => void;
  onClose: () => void;
}

type DtpTab = 'class' | 'review' | 'browse';

const TABS: { key: DtpTab; label: string; col: DtpColumn | null }[] = [
  { key: 'class', label: 'Decline list', col: 'dtp_class' },
  { key: 'review', label: 'Review status', col: 'dtp_review' },
  { key: 'browse', label: 'Browse the lists', col: null },
];

const fmt = (n: number) => n.toLocaleString('en-US');

/** Renders `text` with `phrase`'s first occurrence wrapped in an external
    link to `url`. Falls back to plain text when url is null or phrase is
    missing (defensive: a copy edit that drops the phrase should not crash). */
function withLink(text: string, phrase: string, url: string | null): ReactNode {
  if (!url) return text;
  const idx = text.indexOf(phrase);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <a href={url} target="_blank" rel="noopener noreferrer" className="dtp-inline-link">
        {phrase}
        <IconExternal size={10} />
      </a>
      {text.slice(idx + phrase.length)}
    </>
  );
}

export default function DtpFilterModal({ ds, view, groupings, onSetFilter, onClose }: Props) {
  const [staged, setStaged] = useState(() => stageFromFilters(view.filters));
  const [tab, setTab] = useState<DtpTab>('class');
  const [browseConflicts, setBrowseConflicts] = useState(false);

  // The conflict deep-link only means something while tab 3 is open; leaving
  // it (by any route: another tab, closing the modal) clears the flag so a
  // later manual visit to Browse starts on "All", not stuck pre-filtered.
  useEffect(() => {
    if (tab !== 'browse') setBrowseConflicts(false);
  }, [tab]);

  useEffect(() => {
    if (tab === 'browse') console.log('DTP modal: browse tab opened, browseConflicts =', browseConflicts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

  const onConflictLink = () => {
    setBrowseConflicts(true);
    setTab('browse');
  };

  const onTabsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = TABS.findIndex((t) => t.key === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].key);
    const els = e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
    els[next]?.focus();
  };

  const renderCard = (col: DtpColumn, card: DtpCard) => {
    const count = counts[col].byValue.get(card.value) ?? 0;
    const total = counts[col].total;
    const pct = total > 0 ? `${(count / total) * 100}%` : '0%';
    const hasDetail = card.detail.paragraphs.length > 0 || card.detail.facts.length > 0;
    return (
      <li key={card.value} className="dtp-card">
        <label className="dtp-card-main">
          <input
            type="checkbox"
            checked={staged[col].has(card.value)}
            onChange={() => toggle(col, card.value)}
          />
          <span className="dtp-card-name">{card.name}</span>
          <span className="dtp-card-count" aria-label={`${count} charges`}>
            {fmt(count)}
          </span>
        </label>
        <div className="dtp-bar" aria-hidden="true">
          <span style={{ width: pct }} />
        </div>
        {card.plain && <p className="dtp-card-plain">{card.plain}</p>}
        {hasDetail && (
          <details className="dtp-more">
            <summary>More</summary>
            {card.detail.facts.length > 0 && (
              <div className="dtp-chips">
                {card.detail.facts.map((f) => (
                  <span key={f.label} className="dtp-chip">
                    <span className="dtp-chip-label">{f.label}</span>
                    <span className="dtp-chip-value">{f.value}</span>
                  </span>
                ))}
              </div>
            )}
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
        )}
      </li>
    );
  };

  const renderCaveat = () => (
    <p className="dtp-caveat">
      {DTP_CAVEAT.text}{' '}
      <button type="button" className="linklike" onClick={onConflictLink}>
        {DTP_CAVEAT.conflictLinkLabel}
      </button>
    </p>
  );

  const renderSection = (tabKey: 'class' | 'review') => {
    const col = tabKey === 'class' ? 'dtp_class' : 'dtp_review';
    return (
      <div
        role="tabpanel"
        id={`dtp-panel-${tabKey}`}
        aria-labelledby={`dtp-tab-${tabKey}`}
        key={tabKey}
      >
        <h3 className="dtp-section-title">
          {DTP_CONTENT[col].title}
          <span className="dtp-denom">
            of {fmt(counts[col].total)} charges in the current view
          </span>
        </h3>
        <ul className="dtp-cards">
          {cardsFor(col, dataValues[col]).map((card) => renderCard(col, card))}
        </ul>
        {renderCaveat()}
      </div>
    );
  };

  return (
    <Modal title="Decline-to-prosecute categories" onClose={onClose} wide>
      <div className="dtp-modal">
        <p className="dtp-lede">{withLink(DTP_HEADER.plain, 'published a list', MEMO_URL)}</p>
        <details className="dtp-more">
          <summary>More about where these categories come from</summary>
          {DTP_HEADER.detail.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </details>

        <div className="seg dtp-tabs" role="tablist" aria-label="Decline-to-prosecute sections" onKeyDown={onTabsKeyDown}>
          {TABS.map((t) => {
            const active = tab === t.key;
            const badge = t.col ? staged[t.col].size : 0;
            return (
              <button
                key={t.key}
                id={`dtp-tab-${t.key}`}
                role="tab"
                aria-selected={active}
                aria-controls={`dtp-panel-${t.key}`}
                tabIndex={active ? 0 : -1}
                className={`seg-opt${active ? ' on' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.col && badge > 0 && <span className="dtp-tab-badge">· {badge}</span>}
              </button>
            );
          })}
        </div>

        {tab === 'class' && renderSection('class')}
        {tab === 'review' && renderSection('review')}
        {tab === 'browse' && (
          <div role="tabpanel" id="dtp-panel-browse" aria-labelledby="dtp-tab-browse">
            <p className="dtp-browse-placeholder">
              Browse the lists is coming in the next update.
              {browseConflicts && ' Opened from the conflicting-rows link; it will land pre-filtered to Conflicts.'}
            </p>
          </div>
        )}

        {tab !== 'browse' && bothConstrained && (
          <p className="dtp-footnote">
            Showing charges matching a checked decline-list category AND a
            checked review status.
          </p>
        )}

        {tab !== 'browse' && (
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
        )}
      </div>
    </Modal>
  );
}
