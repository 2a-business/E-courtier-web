import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Boîte de dialogue accessible basée sur <dialog> (piège du focus et Échap natifs). */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      open={typeof HTMLDialogElement === "undefined" || !("showModal" in HTMLDialogElement.prototype) ? true : undefined}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="modal-title"
      className="m-auto w-[min(92vw,32rem)] rounded-[var(--radius-card)] p-0 shadow-2xl backdrop:bg-ink/50"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="modal-title" className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-full hover:bg-surface">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}
