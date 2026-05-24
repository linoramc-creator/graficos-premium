import type { NarrativeKey } from "@/lib/narratives";
import { NarrativeBlock } from "./NarrativeBlock";

interface Props {
  title: string;
  subtitle?: string;
  narrativeKey: NarrativeKey;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export function ChartCard({ title, subtitle, narrativeKey, badge, children }: Props) {
  return (
    <section className="card">
      <header className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-base font-semibold text-ink-primary">{title}</h3>
          {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
        {badge}
      </header>
      <div className="min-h-[280px]">{children}</div>
      <NarrativeBlock narrativeKey={narrativeKey} />
    </section>
  );
}
