"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes } from "react";
import { SubmitButton } from "@/components/submit-button";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  dialogLabel: string;
  pendingText?: string;
  targetForm?: string;
};

export function ConfirmSubmitButton({
  children,
  title,
  message,
  confirmLabel,
  cancelLabel,
  dialogLabel,
  pendingText = "Confirming...",
  targetForm,
  className = "button",
  disabled,
  ...buttonProps
}: Props) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <>
      <button
        {...buttonProps}
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-message`}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      >
        <span className="panel-kicker">NexTap · {dialogLabel}</span>
        <h2 id={`${dialogId}-title`}>{title}</h2>
        <p id={`${dialogId}-message`}>{message}</p>
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="button secondary" onClick={() => setOpen(false)}>
            {cancelLabel}
          </button>
          <SubmitButton form={targetForm} className="button danger-confirm" pendingText={pendingText}>
            {confirmLabel}
          </SubmitButton>
        </div>
      </dialog>
    </>
  );
}
