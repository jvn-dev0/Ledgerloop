"use client";

import { useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string };

export function PasswordInput({ className, id, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-control">
      <input {...props} id={id} className={`input${className ? ` ${className}` : ""}`} type={visible ? "text" : "password"} />
      <button
        className="password-toggle"
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={id}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
