"use client";

import { useState } from "react";

interface Props {
  label?: string;
  children: React.ReactNode;
}

/**
 * Tooltip ligero (hover + focus) sin dependencias. Pensado para etiquetas
 * cortas en variables del formulario.
 */
export function InfoTooltip({ label = "i", children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Más información"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border-base text-[10px] text-ink-muted hover:text-ink-primary hover:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {label}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-30 left-5 top-1/2 -translate-y-1/2 w-64 rounded-md border border-border-base bg-bg-panel p-3 text-xs text-ink-secondary shadow-soft"
        >
          {children}
        </span>
      )}
    </span>
  );
}
