export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400 md:flex-row">
        <p>© {new Date().getFullYear()} Loja 3D — MVP</p>
        <p>Provador Virtual 3D</p>
      </div>
    </footer>
  );
}
