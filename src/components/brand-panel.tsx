export function BrandPanel() {
  return (
    <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-neutral-950 p-12 text-neutral-50">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="pointer-events-none absolute -top-24 -right-24 size-[420px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }}
      />

      <div className="relative flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-white text-sm font-bold tracking-tight text-neutral-950">
          H&H
        </div>
        <span className="text-sm font-medium tracking-wide text-neutral-300">
          Agency Operating System
        </span>
      </div>

      <div className="relative max-w-md space-y-4">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          One system for every client, project and hour.
        </h1>
        <p className="text-balance text-sm leading-relaxed text-neutral-400">
          Leads, clients, projects, time, files and credentials — replacing the
          spreadsheets with one secure place the whole agency works from.
        </p>
      </div>

      <p className="relative text-xs text-neutral-500">
        © {new Date().getFullYear()} H&H Agency. Internal use only.
      </p>
    </div>
  );
}
