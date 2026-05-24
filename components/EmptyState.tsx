interface Props {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: Props) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center text-center">
      <div className="text-ink-secondary text-sm font-medium">{title}</div>
      {description && <p className="text-ink-muted text-xs mt-1 max-w-sm">{description}</p>}
    </div>
  );
}
