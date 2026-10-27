import { PageHeader } from "@/components/shared/page-header";
import { BinarySearchVisualizer } from "@/features/visualization/binary-search";

export const metadata = { title: "Binary search visualizer" };
export default function VisualizerPage() {
  return (
    <>
      <PageHeader
        title="Explore binary search"
        description="Step through a deterministic example. Demonstration controls do not assess your learning."
      />
      <BinarySearchVisualizer />
    </>
  );
}
