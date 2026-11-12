"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingLabel,
  className = "button",
  disabled = false,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? <><span className="submit-spinner" aria-hidden="true" />{pendingLabel}</> : children}
    </button>
  );
}
