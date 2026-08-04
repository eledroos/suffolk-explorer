import type { Notice } from '../contract';
import { IconClose } from './icons';

interface NoticesProps {
  notices: Notice[];
  dismissed: ReadonlySet<string>;
  onDismiss: (title: string) => void;
}

export default function Notices({ notices, dismissed, onDismiss }: NoticesProps) {
  const visible = notices.filter((n) => !dismissed.has(n.title));
  if (visible.length === 0) return null;
  return (
    <div className="notices" role="status">
      {visible.map((n) => (
        <div key={n.title} className={`notice notice-${n.level}`}>
          <span className="notice-level">{n.level === 'warn' ? 'Caution' : 'Note'}</span>
          <div className="notice-text">
            <strong>{n.title}</strong>
            <span>{n.detail}</span>
          </div>
          <button
            className="icon-btn notice-dismiss"
            onClick={() => onDismiss(n.title)}
            aria-label={`Dismiss notice: ${n.title}`}
            title="Dismiss"
          >
            <IconClose size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}
