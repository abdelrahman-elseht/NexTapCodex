"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "جارٍ الحفظ...",
  className = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...props} className={className} type={props.type || "submit"} disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
