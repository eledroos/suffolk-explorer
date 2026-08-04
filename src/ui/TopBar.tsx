import type { Mode } from './theme';
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconFilter,
  IconInfo,
  IconMoon,
  IconSun,
  IconTag,
} from './icons';

interface TopBarProps {
  status: string;
  mode: Mode;
  onToggleTheme: () => void;
  onCopyLink: () => void;
  copied: boolean;
  onCsv: () => void;
  csvEnabled: boolean;
  onCategories: () => void;
  onAbout: () => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  filterCount: number;
}

export default function TopBar(p: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="wordmark" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <h1>Suffolk DA Explorer</h1>
        <span className="topbar-status" role="status" aria-live="polite">
          {p.status}
        </span>
      </div>
      <div className="topbar-actions">
        <button
          className={`btn${p.filtersOpen ? ' btn-active' : ''}`}
          onClick={p.onToggleFilters}
          aria-pressed={p.filtersOpen}
          title="Show or hide the filter panel"
        >
          <IconFilter />
          <span>Filters</span>
          {p.filterCount > 0 && <span className="badge">{p.filterCount}</span>}
        </button>
        <button className="btn" onClick={p.onCategories} title="Build custom category groupings">
          <IconTag />
          <span>Categories</span>
        </button>
        <button
          className="btn"
          onClick={p.onCsv}
          disabled={!p.csvEnabled}
          title="Download the current aggregation as CSV"
        >
          <IconDownload />
          <span>CSV</span>
        </button>
        <button
          className="btn"
          onClick={p.onCopyLink}
          title="Copy a shareable link to this exact view"
        >
          {p.copied ? <IconCheck /> : <IconCopy />}
          <span>{p.copied ? 'Copied' : 'Copy link'}</span>
        </button>
        <button className="btn" onClick={p.onAbout} title="Data provenance and limitations">
          <IconInfo />
          <span>About</span>
        </button>
        <button
          className="icon-btn theme-btn"
          onClick={p.onToggleTheme}
          aria-label={p.mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          title={p.mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {p.mode === 'light' ? <IconMoon /> : <IconSun />}
        </button>
      </div>
    </header>
  );
}
