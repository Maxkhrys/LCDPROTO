import ProceduralBlobTest from "@/components/experimental/procedural-blob/ProceduralBlobTest";

export const metadata = {
  title: "Procedural Blob Body R&D | LCDPROTO",
  description: "Isolated code-driven deformable Blob body experiment",
};

export default function ExperimentalPage() {
  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <ProceduralBlobTest />
    </main>
  );
}
