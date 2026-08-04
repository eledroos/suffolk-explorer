import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';

interface ModalProps {
  title: string;
  /** Called whenever the user asks to leave (Esc, backdrop click, close button).
      The owner decides whether to actually unmount, so it can guard dirty state. */
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}

/**
 * Native <dialog> modal: showModal() gives focus containment and background
 * inertness for free, and close() on unmount restores focus to the control
 * that opened it. Esc is intercepted (cancel) and routed through onClose so
 * owners can confirm before discarding work.
 */
export default function Modal({ title, onClose, wide, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      if (d.open) d.close();
      // The browser's native restore is unreliable across unmount paths;
      // hand focus back to the control that opened the modal explicitly.
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' modal-wide' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        // Clicks on ::backdrop register on the dialog element itself.
        if (e.target === ref.current) onClose();
      }}
    >
      <header className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close (Esc)">
          <IconClose />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
