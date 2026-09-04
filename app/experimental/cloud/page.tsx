import CloudBlobTest from "@/components/experimental/cloud-blob/CloudBlobTest";

export const metadata = {
  title: "Procedural Cloud Blob R&D | LCDPROTO",
  description: "Volumetric living mist character body with multi-lobe lag physics and trails",
};

export default function CloudBlobPage() {
  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <CloudBlobTest />
    </main>
  );
}
