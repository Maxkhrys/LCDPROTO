import DeviceSimulator from "@/components/device/DeviceSimulator";

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8 text-center sm:mb-10">
        <h1 className="text-[13px] font-medium uppercase tracking-[0.4em] text-white/70">
          LCDPROTO
        </h1>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">
          1.28&quot; round display simulator
        </p>
      </header>

      <DeviceSimulator />
    </main>
  );
}
