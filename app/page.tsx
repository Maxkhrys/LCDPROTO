import DeviceSimulator from "@/components/device/DeviceSimulator";

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-start overflow-x-hidden px-4 py-5 sm:px-8 sm:py-6">
      <header className="mb-4 text-center sm:mb-5">
        <h1 className="text-[13px] font-medium uppercase tracking-[0.4em] text-white/70">
          LCDPROTO
        </h1>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">
          1.43&quot; AMOLED round display simulator
        </p>
      </header>

      <DeviceSimulator />
    </main>
  );
}
