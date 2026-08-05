import Modal from './Modal';

/**
 * Provenance and limitations, summarized from data/assembled/README.md
 * (built 2026-08-04). Keep in sync with that file.
 */

const STATS = [
  { value: '200,630', label: 'unique charges' },
  { value: '161,134', label: 'filed 2022–2025' },
  { value: '153,920', label: 'disposed 2022–2025' },
  { value: '10', label: 'adult courts' },
];

const SEGMENTS = [
  { window: 'Filings, Jan 2022 – Sep 2024', source: 'Oct 2024 PRR', badge: '2 sources', tone: 'good' },
  { window: 'Filings, Oct 2024 – Jan 2025', source: 'CoC Request 1', badge: '1 source', tone: 'mid' },
  { window: 'Filings, 2025', source: 'PRR #260211A', badge: '1 source', tone: 'mid' },
  { window: 'Dispositions, Jan 2022 – Sep 2024', source: 'Oct 2024 PRR', badge: 'bounds-checked', tone: 'good' },
  { window: 'Dispositions, Oct 2024 – Dec 2025', source: 'July 2026 file', badge: '98.35% agree', tone: 'good' },
  { window: 'Optional: filings 2006–2021, dispositions 2000–2021', source: 'Pre-2022 composite', badge: 'same IDs', tone: 'good' },
] as const;

const LIMITS = [
  {
    level: 'warn' as const,
    title: 'Superior Court dispositions missing, Oct 2024 – Dec 2025',
    body: 'About 2,000 felony-court charges; records request pending. Superior filings are complete.',
  },
  {
    level: 'warn' as const,
    title: 'Recent outcome rates are right-censored',
    body: '46,575 charges, mostly 2024–2025 filings, were still open at extraction and have blank disposition fields.',
  },
  {
    level: 'info' as const,
    title: '2025 filings run ~2–3% low',
    body: 'Sealed cases were removed between extract pulls and cannot be recovered by any request.',
  },
  {
    level: 'info' as const,
    title: 'Recent disposition counts are floors',
    body: 'Late entry adds up to 4.5% for months near a file’s pull date, mostly mid-2024.',
  },
  {
    level: 'info' as const,
    title: 'Dates: use offense date for durations',
    body: '7.4–8.0% of disposed charges show a disposition date before the filing date (Chelsea and BMC record-keeping).',
  },
  {
    level: 'info' as const,
    title: 'Field gaps',
    body: 'Race ~17% missing; judge absent; no usable sentencing. Charlestown filings are zero in Jan 2022 and Jan 2023 upstream in DAMION.',
  },
  {
    level: 'info' as const,
    title: 'Pre-2022 composite: 2021 is single-source',
    body: 'The optional pre-2022 layer carries the same case and person IDs as 2022–2025, so distinct counts work across the seam. 2021 dispositions come from one Jan 2022 snapshot and are floors.',
  },
];

const QC = [
  { label: 'Filed', cells: ['2022 · 37,399', '2023 · 39,260', '2024 · 43,880', '2025 · 40,595'] },
  { label: 'Disposed', cells: ['2022 · 37,091', '2023 · 38,536', '2024 · 41,146', '2025 · 37,147'] },
  { label: 'Filed under', cells: ['Hayden · 160,036', 'Rollins · 36,045', 'Conley · 4,549', 'dup keys · 0'] },
];

export default function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About this data" onClose={onClose}>
      <div className="about">
        <p className="about-lede">
          Charge-level records from the Suffolk County District Attorney&rsquo;s Office, assembled
          from the original public-records deliveries (rebuilt 2026-08-04). One row is one unique
          charge. Juvenile divisions and MA&nbsp;Appeals are excluded. A charge is included if it
          was filed in the window, disposed in it (including 39,496 backlog charges filed as far
          back as 2004), or both.
        </p>

        <div className="about-stats" role="list">
          {STATS.map(s => (
            <div className="about-stat" role="listitem" key={s.label}>
              <div className="about-stat-v">{s.value}</div>
              <div className="about-stat-l">{s.label}</div>
            </div>
          ))}
        </div>

        <h3 className="microlabel">Source per segment</h3>
        <ul className="about-segs">
          {SEGMENTS.map(s => (
            <li className="about-seg" key={s.window}>
              <span className="about-seg-window">{s.window}</span>
              <span className="about-seg-source">{s.source}</span>
              <span className={`about-seg-badge tone-${s.tone}`}>{s.badge}</span>
            </li>
          ))}
        </ul>

        <h3 className="microlabel">Known limitations</h3>
        <div className="about-limitgrid">
          {LIMITS.map(l => (
            <div className={`about-limit level-${l.level}`} key={l.title}>
              <div className="about-limit-t">{l.title}</div>
              <div className="about-limit-b">{l.body}</div>
            </div>
          ))}
        </div>

        <h3 className="microlabel">Verified totals</h3>
        <table className="about-qc-table">
          <tbody>
            {QC.map(r => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {r.cells.map(c => <td key={c}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="about-foot">
          Everything runs in your browser; no query leaves this page. Custom categories are stored
          in this browser&rsquo;s localStorage only.
        </p>
      </div>
    </Modal>
  );
}
