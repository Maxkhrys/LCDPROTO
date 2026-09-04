import DeviceSimulator from "@/components/device/DeviceSimulator";

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-start overflow-x-hidden px-3 py-0 sm:px-6">
      <div className="w-full max-w-xl py-2 flex items-center justify-end gap-2 text-xs">
        <a
          href="/experimental/cloud"
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-500/20 hover:text-white"
        >
          <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Cloud Blob R&amp;D &rarr;
        </a>
      </div>
      <DeviceSimulator />
    </main>
  );
}
