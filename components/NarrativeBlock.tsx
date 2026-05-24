"use client";

import { useState } from "react";
import { NARRATIVES, type NarrativeKey } from "@/lib/narratives";
import { cn } from "@/lib/format";

interface Props {
  narrativeKey: NarrativeKey;
  defaultOpen?: boolean;
  compact?: boolean;
}

/**
 * Bloque narrativo guionizado: ¿Qué es? · Impacto Geopolítico · Dato Clave.
 * Se renderiza como acordeón colapsable para no abrumar; abre con un clic.
 */
export function NarrativeBlock({ narrativeKey, defaultOpen = false, compact = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const n = NARRATIVES[narrativeKey];

  return (
    <div className={cn("rounded-lg border border-border-base bg-bg-subtle/60", compact ? "" : "mt-3")}>
      <button
        type="button"
        className="accordion-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <span className="text-accent-gold">·</span>
          <span className="text-sm font-medium">Cómo leer este indicador</span>
        </span>
        <span className={cn("transition-transform text-ink-muted", open && "rotate-90")}>▶</span>
      </button>
      {open && (
        <div className="accordion-body grid sm:grid-cols-3 gap-4">
          <NarrativeItem title="¿Qué es?" body={n.what} tone="info" />
          <NarrativeItem title="Impacto Geopolítico" body={n.geopolitical} tone="warn" />
          <NarrativeItem title="El Dato Clave" body={n.keyLevel} tone="gold" />
        </div>
      )}
    </div>
  );
}

function NarrativeItem({
  title,
  body,
  tone
}: {
  title: string;
  body: string;
  tone: "info" | "warn" | "gold";
}) {
  const toneClass =
    tone === "info"
      ? "text-accent-info"
      : tone === "warn"
      ? "text-accent-warn"
      : "text-accent-gold";
  return (
    <div>
      <div className={cn("text-xs uppercase tracking-wider mb-1 font-semibold", toneClass)}>
        {title}
      </div>
      <p className="text-ink-secondary text-sm leading-relaxed">{body}</p>
    </div>
  );
}
