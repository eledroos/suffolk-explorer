import Modal from './Modal';

/**
 * Condensed provenance and limitations, summarized from
 * data/assembled/README.md (built 2026-08-04). Keep in sync with that file.
 */
export default function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About this data" onClose={onClose}>
      <div className="about">
        <p>
          Charge-level records from the Suffolk County District Attorney's Office, assembled from
          the original public-records deliveries (rebuilt 2026-08-04). One row is one unique
          charge, keyed on case, count, and charge description truncated at 75 characters.
          200,630 rows across ten adult courts; juvenile divisions and MA Appeals are excluded.
        </p>
        <p>
          A charge is included if it was filed between 2022-01-03 and 2025-12-31 (161,134
          charges), disposed in that window (153,920, including 39,496 backlog charges filed as
          far back as 2004), or both (114,424). Sources by segment: the Oct 2024 PRR through Sep
          2024 (dual-verified), CoC Request 1 for Oct 2024 to Jan 2025 filings, PRR-260211A for
          2025, and a July 2026 disposition file for Oct 2024 onward (2025 confirmed at 98.35%).
        </p>
        <h3 className="microlabel">Known limitations</h3>
        <ol className="about-limits">
          <li>
            Suffolk Superior dispositions are missing from Oct 2024 onward (about 2,000 charges;
            records request pending). Superior filings are complete.
          </li>
          <li>2025 filings run about 2 to 3% low: sealed cases were removed between pulls.</li>
          <li>
            Disposition counts near a file's pull date are floors; late entry adds up to 4.5%,
            mostly affecting mid-2024.
          </li>
          <li>Charlestown filings are zero in Jan 2022 and Jan 2023 upstream in DAMION.</li>
          <li>
            7.4 to 8.0% of disposed charges carry a disposition date before the filing date
            (Chelsea and BMC record-keeping); use offense date for durations.
          </li>
          <li>Race is about 17% missing; judge is absent; no usable sentencing fields.</li>
          <li>
            46,575 open charges, mostly 2024-2025 filings, have blank disposition fields; outcome
            rates for recent cohorts are right-censored.
          </li>
        </ol>
        <h3 className="microlabel">Verified totals</h3>
        <p className="about-qc">
          Filed per year: 2022 = 37,399 · 2023 = 39,260 · 2024 = 43,880 · 2025 = 40,595.
          Disposed per year: 2022 = 37,091 · 2023 = 38,536 · 2024 = 41,146 · 2025 = 37,147.
          Filed under Hayden 160,036, Rollins 36,045, Conley 4,549. Zero duplicate keys.
        </p>
        <p className="about-foot">
          Everything runs in your browser; no query leaves this page. Custom categories are stored
          in this browser's localStorage only.
        </p>
      </div>
    </Modal>
  );
}
