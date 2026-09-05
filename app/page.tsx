import DeviceSimulator from "@/components/device/DeviceSimulator";

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-start overflow-x-hidden px-3 py-3 sm:px-6 sm:py-5">
      <div className="w-full py-2 flex items-center justify-end gap-2 text-xs">
        <a
          href="/experimental/cloud"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] font-medium text-[var(--muted)] shadow-[var(--shadow-xs)] transition hover:border-[var(--accent-line)] hover:text-[var(--accent)]"
        >
          <span className="size-1.5 rounded-full bg-[var(--accent)]" />
          Cloud Blob R&amp;D &rarr;
        </a>
      </div>
      <DeviceSimulator />
    </main>
  );
}
