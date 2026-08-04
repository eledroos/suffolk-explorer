import { useEffect, useMemo, useRef, useState } from 'react';
import { distinctValues } from '../engine';
import { COLUMNS, type Bucket, type Dataset, type Grouping } from '../contract';
import { colLabel, displayValue, truncate } from './format';
import { IconClose } from './icons';
import Modal from './Modal';

interface CategoryBuilderProps {
  ds: Dataset;
  userGroupings: Grouping[];
  presets: Grouping[];
  onSaveAll: (next: Grouping[]) => void;
  onClose: () => void;
}

type BuilderMode = { kind: 'list' } | { kind: 'edit'; draft: Grouping; isNew: boolean };

function genId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function cloneGrouping(g: Grouping, rename: boolean): Grouping {
  return {
    id: genId(),
    name: rename ? `${g.name} (copy)` : g.name,
    column: g.column,
    buckets: g.buckets.map((b) => ({ name: b.name, values: [...b.values] })),
    otherLabel: g.otherLabel || 'Other',
  };
}

export default function CategoryBuilder({
  ds,
  userGroupings,
  presets,
  onSaveAll,
  onClose,
}: CategoryBuilderProps) {
  const [mode, setMode] = useState<BuilderMode>({ kind: 'list' });
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // The editor reports its live draft here so Esc / backdrop / X can tell
  // whether leaving would throw away work.
  const liveDraftRef = useRef<Grouping | null>(null);

  /** Esc, backdrop click, or the X. In the editor this steps back to the
      list (confirming first if the draft is dirty); a second Esc closes. */
  const requestClose = () => {
    if (mode.kind === 'edit') {
      const live = liveDraftRef.current;
      const dirty = live !== null && JSON.stringify(live) !== JSON.stringify(mode.draft);
      if (dirty && !window.confirm('Discard unsaved changes to this grouping?')) return;
      liveDraftRef.current = null;
      setMode({ kind: 'list' });
      return;
    }
    onClose();
  };

  const startNew = () => {
    const firstCol = COLUMNS.find((c) => c.groupable && c.kind === 'cat')?.name ?? 'crime_type';
    setMode({
      kind: 'edit',
      isNew: true,
      draft: { id: genId(), name: '', column: firstCol, buckets: [], otherLabel: 'Other' },
    });
  };

  const startEdit = (g: Grouping) =>
    setMode({ kind: 'edit', isNew: false, draft: cloneForEdit(g) });

  const startClone = (g: Grouping) =>
    setMode({ kind: 'edit', isNew: true, draft: cloneGrouping(g, true) });

  const remove = (g: Grouping) => {
    if (!window.confirm(`Delete grouping "${g.name}"? Views using it fall back to defaults.`)) return;
    onSaveAll(userGroupings.filter((x) => x.id !== g.id));
  };

  const save = (draft: Grouping, isNew: boolean) => {
    const next = isNew
      ? [...userGroupings, draft]
      : userGroupings.map((x) => (x.id === draft.id ? draft : x));
    onSaveAll(next);
    liveDraftRef.current = null;
    setMode({ kind: 'list' });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(userGroupings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suffolk-groupings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
        const cleaned: Grouping[] = list.map((raw, i) => {
          const g = raw as Partial<Grouping>;
          if (!g || typeof g.name !== 'string' || typeof g.column !== 'string' || !Array.isArray(g.buckets)) {
            throw new Error(`Entry ${i + 1} is not a grouping (needs name, column, buckets).`);
          }
          if (!COLUMNS.some((c) => c.name === g.column && c.groupable)) {
            throw new Error(`Entry ${i + 1} uses unknown column "${g.column}".`);
          }
          return {
            id: typeof g.id === 'string' && g.id ? g.id : genId(),
            name: g.name,
            column: g.column,
            buckets: g.buckets.map((b: Partial<Bucket>, j: number) => {
              if (!b || typeof b.name !== 'string' || !Array.isArray(b.values)) {
                throw new Error(`Entry ${i + 1}, bucket ${j + 1} is malformed.`);
              }
              return { name: b.name, values: b.values.map(String) };
            }),
            otherLabel: typeof g.otherLabel === 'string' && g.otherLabel ? g.otherLabel : 'Other',
          };
        });
        const byId = new Map(userGroupings.map((g) => [g.id, g]));
        for (const g of cleaned) byId.set(g.id, g);
        onSaveAll([...byId.values()]);
      } catch (e) {
        setImportError(e instanceof Error ? e.message : 'Could not parse that file.');
      }
    };
    reader.onerror = () => setImportError('Could not read that file.');
    reader.readAsText(file);
  };

  return (
    <Modal
      title={mode.kind === 'list' ? 'Custom categories' : mode.isNew ? 'New grouping' : 'Edit grouping'}
      onClose={requestClose}
      wide
    >
      {mode.kind === 'list' ? (
        <div className="cb-list">
          <p className="cb-intro">
            A grouping folds the values of one column into named buckets, for example collapsing
            forty disposition labels into five outcome families. Groupings live in this browser's
            localStorage and can be used as X, series, or a filter.
          </p>

          <h3 className="microlabel">Your groupings</h3>
          {userGroupings.length === 0 && (
            <p className="cb-empty">None yet. Create one, or clone a template below.</p>
          )}
          <ul className="cb-rows">
            {userGroupings.map((g) => (
              <li key={g.id} className="cb-row">
                <div className="cb-row-main">
                  <strong>{g.name}</strong>
                  <span className="dim">
                    {colLabel(g.column)} · {g.buckets.length} bucket
                    {g.buckets.length === 1 ? '' : 's'} ·{' '}
                    {g.buckets.reduce((a, b) => a + b.values.length, 0)} values assigned
                  </span>
                </div>
                <div className="cb-row-actions">
                  <button className="btn btn-sm" onClick={() => startEdit(g)}>
                    Edit
                  </button>
                  <button className="btn btn-sm" onClick={() => startClone(g)}>
                    Clone
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(g)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="microlabel">Templates</h3>
          <ul className="cb-rows">
            {presets.map((g) => (
              <li key={g.id} className="cb-row">
                <div className="cb-row-main">
                  <strong>{g.name}</strong>
                  <span className="dim">
                    {colLabel(g.column)} · {g.buckets.length} buckets · clone to make it yours
                  </span>
                </div>
                <div className="cb-row-actions">
                  <button className="btn btn-sm" onClick={() => startClone(g)}>
                    Clone
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {importError && <p className="cb-error">{importError}</p>}
          <div className="cb-footer">
            <button className="btn btn-primary" onClick={startNew}>
              New grouping
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = '';
              }}
            />
            <button className="btn" onClick={exportJson} disabled={userGroupings.length === 0}>
              Export JSON
            </button>
          </div>
        </div>
      ) : (
        <GroupingEditor
          ds={ds}
          draft={mode.draft}
          isNew={mode.isNew}
          onDraftChange={(g) => {
            liveDraftRef.current = g;
          }}
          onCancel={requestClose}
          onSave={save}
        />
      )}
    </Modal>
  );
}

function cloneForEdit(g: Grouping): Grouping {
  return {
    ...g,
    buckets: g.buckets.map((b) => ({ name: b.name, values: [...b.values] })),
  };
}

// ---------------------------------------------------------------- editor

function GroupingEditor({
  ds,
  draft: initial,
  isNew,
  onDraftChange,
  onCancel,
  onSave,
}: {
  ds: Dataset;
  draft: Grouping;
  isNew: boolean;
  onDraftChange: (g: Grouping) => void;
  onCancel: () => void;
  onSave: (g: Grouping, isNew: boolean) => void;
}) {
  const [draft, setDraft] = useState<Grouping>(initial);
  useEffect(() => {
    onDraftChange(draft);
  }, [draft, onDraftChange]);
  const [activeBucket, setActiveBucket] = useState<number>(draft.buckets.length > 0 ? 0 : -1);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const groupableCats = COLUMNS.filter((c) => c.groupable && c.kind === 'cat');

  const allValues = useMemo(() => distinctValues(ds, draft.column), [ds, draft.column]);

  const assigned = useMemo(() => {
    const s = new Set<string>();
    for (const b of draft.buckets) for (const v of b.values) s.add(v);
    return s;
  }, [draft.buckets]);

  const unassigned = useMemo(() => allValues.filter((v) => !assigned.has(v)), [allValues, assigned]);
  const shown = useMemo(() => {
    if (!query) return unassigned;
    const q = query.toLowerCase();
    return unassigned.filter((v) => displayValue(v).toLowerCase().includes(q));
  }, [unassigned, query]);

  const changeColumn = (col: string) => {
    if (col === draft.column) return;
    const hasAssignments = draft.buckets.some((b) => b.values.length > 0);
    if (
      hasAssignments &&
      !window.confirm('Changing the base column clears all value assignments. Continue?')
    ) {
      return;
    }
    setDraft((d) => ({
      ...d,
      column: col,
      buckets: d.buckets.map((b) => ({ ...b, values: [] })),
    }));
  };

  const assign = (value: string) => {
    if (activeBucket < 0 || activeBucket >= draft.buckets.length) return;
    setDraft((d) => ({
      ...d,
      buckets: d.buckets.map((b, i) =>
        i === activeBucket ? { ...b, values: [...b.values, value] } : b,
      ),
    }));
  };

  const assignShown = () => {
    if (activeBucket < 0) return;
    setDraft((d) => ({
      ...d,
      buckets: d.buckets.map((b, i) =>
        i === activeBucket ? { ...b, values: [...b.values, ...shown] } : b,
      ),
    }));
    setQuery('');
  };

  const unassign = (bucketIdx: number, value: string) => {
    setDraft((d) => ({
      ...d,
      buckets: d.buckets.map((b, i) =>
        i === bucketIdx ? { ...b, values: b.values.filter((v) => v !== value) } : b,
      ),
    }));
  };

  const addBucket = () => {
    setDraft((d) => ({
      ...d,
      buckets: [...d.buckets, { name: `Bucket ${d.buckets.length + 1}`, values: [] }],
    }));
    setActiveBucket(draft.buckets.length);
  };

  const renameBucket = (idx: number, name: string) => {
    setDraft((d) => ({
      ...d,
      buckets: d.buckets.map((b, i) => (i === idx ? { ...b, name } : b)),
    }));
  };

  const deleteBucket = (idx: number) => {
    setDraft((d) => ({ ...d, buckets: d.buckets.filter((_, i) => i !== idx) }));
    setActiveBucket((a) => (a === idx ? -1 : a > idx ? a - 1 : a));
  };

  const trySave = () => {
    const name = draft.name.trim();
    if (!name) return setError('Give the grouping a name.');
    if (draft.buckets.length === 0) return setError('Add at least one bucket.');
    const bucketNames = draft.buckets.map((b) => b.name.trim());
    if (bucketNames.some((n) => !n)) return setError('Every bucket needs a name.');
    if (new Set(bucketNames).size !== bucketNames.length)
      return setError('Bucket names must be unique.');
    const otherLabel = draft.otherLabel.trim() || 'Other';
    if (bucketNames.includes(otherLabel))
      return setError(`"${otherLabel}" is already a bucket name; pick another label for unassigned values.`);
    onSave(
      {
        ...draft,
        name,
        otherLabel,
        buckets: draft.buckets.map((b, i) => ({ name: bucketNames[i], values: b.values })),
      },
      isNew,
    );
  };

  return (
    <div className="cb-editor">
      <div className="cb-form">
        <label className="field">
          <span className="field-label">Name</span>
          <input
            type="text"
            value={draft.name}
            placeholder="e.g. Outcome family"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            autoFocus
          />
        </label>
        <label className="field">
          <span className="field-label">Base column</span>
          <span className="selwrap">
            <select value={draft.column} onChange={(e) => changeColumn(e.target.value)}>
              {groupableCats.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.label}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="field">
          <span className="field-label">Unassigned label</span>
          <input
            type="text"
            value={draft.otherLabel}
            placeholder="Other"
            onChange={(e) => setDraft((d) => ({ ...d, otherLabel: e.target.value }))}
          />
        </label>
      </div>

      <div className="cb-panes">
        <div className="cb-pane">
          <h4 className="field-label">
            Unassigned values <span className="dim">({unassigned.length})</span>
          </h4>
          <input
            type="search"
            className="ms-search"
            placeholder="Search values"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {activeBucket < 0 && (
            <p className="cb-hint">Add or select a bucket on the right, then click values to move them.</p>
          )}
          {activeBucket >= 0 && query && shown.length > 0 && (
            <button className="linklike" onClick={assignShown}>
              Move all {shown.length} shown to "{draft.buckets[activeBucket]?.name}"
            </button>
          )}
          <ul className="cb-values">
            {shown.map((v) => (
              <li key={v}>
                <button
                  className="cb-value"
                  disabled={activeBucket < 0}
                  onClick={() => assign(v)}
                  title={
                    activeBucket >= 0
                      ? `Move to "${draft.buckets[activeBucket]?.name}"`
                      : 'Select a bucket first'
                  }
                >
                  {displayValue(v)}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="ms-empty">Nothing unassigned matches</li>}
          </ul>
        </div>

        <div className="cb-pane">
          <h4 className="field-label">
            Buckets <span className="dim">({draft.buckets.length})</span>
          </h4>
          <div className="cb-buckets">
            {draft.buckets.map((b, i) => (
              <div key={i} className={`cb-bucket${i === activeBucket ? ' active' : ''}`}>
                <div className="cb-bucket-head">
                  <input
                    type="radio"
                    name="active-bucket"
                    checked={i === activeBucket}
                    onChange={() => setActiveBucket(i)}
                    aria-label={`Make "${b.name}" the target bucket`}
                    title="Target bucket for clicked values"
                  />
                  <input
                    type="text"
                    className="cb-bucket-name"
                    value={b.name}
                    onChange={(e) => renameBucket(i, e.target.value)}
                    onFocus={() => setActiveBucket(i)}
                  />
                  <span className="dim">{b.values.length}</span>
                  <button
                    className="icon-btn"
                    onClick={() => deleteBucket(i)}
                    aria-label={`Delete bucket ${b.name}`}
                    title="Delete bucket (values return to unassigned)"
                  >
                    <IconClose size={11} />
                  </button>
                </div>
                <div className="cb-bucket-values">
                  {b.values.map((v) => (
                    <button
                      key={v}
                      className="chip"
                      onClick={() => unassign(i, v)}
                      title="Return to unassigned"
                    >
                      <span>{truncate(displayValue(v), 30)}</span>
                      <IconClose size={8} />
                    </button>
                  ))}
                  {b.values.length === 0 && (
                    <span className="cb-hint">Empty. Select it and click values on the left.</span>
                  )}
                </div>
              </div>
            ))}
            <button className="btn btn-sm" onClick={addBucket}>
              + Add bucket
            </button>
            <p className="cb-hint">
              Anything left unassigned falls into "{draft.otherLabel.trim() || 'Other'}".
            </p>
          </div>
        </div>
      </div>

      {error && <p className="cb-error">{error}</p>}
      <div className="cb-footer">
        <button className="btn btn-primary" onClick={trySave}>
          Save grouping
        </button>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
