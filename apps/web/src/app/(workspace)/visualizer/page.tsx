import { PageHeader } from "@/components/shared/page-header";
import { BinarySearchVisualizer } from "@/features/visualization/binary-search";

export const metadata = { title: "Binary search visualizer" };
export default function VisualizerPage() {
  return (
    <>
      <PageHeader
        title="Binary search, step by step"
        description="Step through one worked example. This demo is practice only and is not graded."
      />
      <BinarySearchVisualizer />
    </>
  );
}
