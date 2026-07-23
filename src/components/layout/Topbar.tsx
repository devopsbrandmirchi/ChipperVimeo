type TopbarProps = {
  title: string;
};

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="flex h-14 items-center border-b border-zinc-200 px-6 dark:border-zinc-800">
      <h1 className="text-sm font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
        {title}
      </h1>
    </header>
  );
}
