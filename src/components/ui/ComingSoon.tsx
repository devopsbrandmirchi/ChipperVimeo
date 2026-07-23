type ComingSoonProps = {
  title: string;
  description?: string;
};

export function ComingSoon({
  title,
  description = "This screen ships in Phase 2.",
}: ComingSoonProps) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-2 p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}
