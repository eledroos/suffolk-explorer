import { useEffect, useState, type KeyboardEvent } from 'react';
import {
  BROWSE_CHIPS, filterRows, reviewChipLabel,
  type BrowseChipKey, type DtpListRow, type DtpListsData,
} from './dtpBrowse';
import { SHORT_CLASS } from './dtpModel';
import { IconDownload } from './icons';

interface Props {
  /** True exactly when the modal switched to this tab via the caveat's
      "See the conflicting rows" link; consumed once on mount. */
  conflictsOnly: boolean;
  /** Called once, right after mount, so a later manual re-entry to this tab
      (without the deep link) starts on "All" instead of staying stuck on
      "Conflicts". The modal owns `browseConflicts` and resets it on any tab
      change already; this only clears it the first time it was actually used. */
  onConsumedConflicts: () => void;
}

const BASE_URL = (import.meta as any).env?.BASE_URL || '/';
const JSON_URL = `${BASE_URL}data/dtp-lists.json`;
const XLSX_URL = `${BASE_URL}downloads/suffolk-dtp-lists.xlsx`;

const fmt = (n: number) => n.toLocaleString('en-US');

/** Mirrors `SOURCE_NOTE` in scripts/prepare_dtp_lists.py, which the JSON
    carries as `source_note`. Shown while the JSON is loading or after it
    fails, so the derived-and-not-distributed disclosure is on screen in every
    state, not only the ready one. */
const PROVENANCE_FALLBACK =
  'The data behind this view is derived from a classification worksheet ' +
  'created inside the Suffolk County District Attorney’s office in 2020, ' +
  'applied to charge records by charge description. The table and the ' +
  'downloadable spreadsheet are derived; the original worksheet is not ' +
  'distributed.';

/** The two count columns are computed once by scripts/prepare_dtp_lists.py,
    over each parquet's `filed_in_window` rows: every charge filed 2022-2025 in
    one file, 2006-2021 in the other, which is narrower than "the whole file".
    They do not move with the lens, the date range, or any filter the reader
    has set, while every card on the other two tabs is counted against the
    current view. */
const COUNTS_NOTE =
  'Counts cover each dataset’s filed charges and ignore any active filters.';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DtpListsData };

// Module-level cache: the JSON is fetched once per page load no matter how
// many times the tab is opened and closed, per the spec's "fetched lazily
// the first time tab 3 opens (cached for the session)".
let cache: DtpListsData | null = null;
let inflight: Promise<DtpListsData> | null = null;

function fetchDtpLists(): Promise<DtpListsData> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch(JSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${JSON_URL}`);
        return res.json() as Promise<DtpListsData>;
      })
      .then((data) => {
        cache = data;
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export default function DtpBrowseTab({ conflictsOnly, onConsumedConflicts }: Props) {
  const [state, setState] = useState<LoadState>(() =>
    cache ? { status: 'ready', data: cache } : { status: 'loading' },
  );
  const [query, setQuery] = useState('');
  // Seeded once from the prop at mount: this component only exists while
  // the modal's tab === 'browse', so every deep-link open is a fresh mount.
  const [chip, setChip] = useState<BrowseChipKey>(conflictsOnly ? 'conflicts' : 'all');

  const load = () => {
    setState({ status: 'loading' });
    fetchDtpLists()
      .then((data) => setState({ status: 'ready', data }))
      .catch((e: unknown) =>
        setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      );
  };

  useEffect(() => {
    if (conflictsOnly) onConsumedConflicts();
    if (!cache) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: DtpListRow[] = state.status === 'ready' ? state.data.rows : [];
  const filtered = filterRows(rows, query, chip);

  const onChipsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = BROWSE_CHIPS.findIndex((c) => c.key === chip);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % BROWSE_CHIPS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (idx - 1 + BROWSE_CHIPS.length) % BROWSE_CHIPS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = BROWSE_CHIPS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setChip(BROWSE_CHIPS[next].key);
    const els = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
    els[next]?.focus();
  };

  return (
    <div className="dtp-browse">
      {/* The provenance note keeps a reading measure while the download sits
          in the width beside it, so the header is one band instead of a
          paragraph followed by a nearly empty button row. */}
      <div className="dtp-browse-head">
        <p className="dtp-browse-provenance">
          {state.status === 'ready' ? state.data.source_note : PROVENANCE_FALLBACK}{' '}
          {COUNTS_NOTE}
        </p>
        <a href={XLSX_URL} download className="btn dtp-browse-download">
          <IconDownload />
          Download the lists (XLSX)
        </a>
      </div>

      <div className="dtp-browse-controls">
        <input
          type="search"
          className="dtp-browse-search"
          placeholder="Search charge descriptions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search charge descriptions"
        />
        <div
          className="dtp-browse-chipbar"
          role="radiogroup"
          aria-label="Filter the lists"
          onKeyDown={onChipsKeyDown}
        >
          {BROWSE_CHIPS.map((c) => {
            const active = chip === c.key;
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                className={`dtp-browse-chipbtn${active ? ' on' : ''}`}
                onClick={() => setChip(c.key)}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="dtp-browse-tablewrap tablewrap">
        <table className="aggtable dtp-browse-table">
          <thead>
            <tr>
              <th>Charge description</th>
              <th>Class</th>
              <th>Review</th>
              <th className="num">Filed 2022-2025</th>
              <th className="num">Filed 2006-2021</th>
            </tr>
          </thead>
          <tbody>
            {state.status === 'loading' && (
              <tr>
                <td colSpan={5} className="table-empty">
                  Loading the charge-description lists&hellip;
                </td>
              </tr>
            )}
            {state.status === 'error' && (
              <tr>
                <td colSpan={5} className="table-empty">
                  Could not load the lists: {state.message}.{' '}
                  <button className="btn btn-sm" onClick={load}>
                    Try again
                  </button>
                </td>
              </tr>
            )}
            {state.status === 'ready' && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  No charge descriptions match.
                </td>
              </tr>
            )}
            {state.status === 'ready' &&
              filtered.map((row) => (
                <tr key={row.description} className={row.conflict ? 'dtp-browse-row-conflict' : undefined}>
                  <td>
                    {row.description}
                    {row.conflict && (
                      <span
                        className="dtp-conflict-flag"
                        role="img"
                        aria-label="Conflict: on the YY tab and in the review’s disagreed section."
                        title="On the YY tab and in the review’s disagreed section."
                      >
                        {'⚑'}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="dtp-browse-chip">{SHORT_CLASS[row.dtp_class] ?? row.dtp_class}</span>
                  </td>
                  <td>
                    {row.dtp_review && (
                      <span className="dtp-browse-chip">{reviewChipLabel(row.dtp_review)}</span>
                    )}
                  </td>
                  <td className="num">{fmt(row.n_2022_2025)}</td>
                  <td className="num">{fmt(row.n_2006_2021)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
