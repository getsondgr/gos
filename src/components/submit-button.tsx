"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
};

export default function SubmitButton({
  children,
  pendingText = "Saving…",
  className = "",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={`submit-with-status ${className}`.trim()}
      disabled={pending}
      aria-live="polite"
      aria-busy={pending}
    >
      {pending && <span className="submit-spinner" aria-hidden="true" />}
      <span>{pending ? pendingText : children}</span>
    </button>
  );
}
