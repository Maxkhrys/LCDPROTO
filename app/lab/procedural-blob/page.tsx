import ProceduralBlobTest from "@/components/experimental/procedural-blob/ProceduralBlobTest";

/**
 * Isolated R&D route for the procedural Blob body.
 *
 * Deliberately not linked from HOME or the simulator — it exists only so the
 * experiment can be reviewed without touching production behaviour.
 */
export default function ProceduralBlobLabPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-5 py-10 sm:px-8">
      <header className="mb-8 text-center">
        <h1 className="text-[13px] font-medium uppercase tracking-[0.4em] text-white/70">
          Procedural body — R&amp;D
        </h1>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">
          experiment only · production Blob untouched
        </p>
      </header>
      <ProceduralBlobTest />
    </main>
  );
}
