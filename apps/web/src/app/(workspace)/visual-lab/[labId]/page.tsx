import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { LabWorkspace } from "@/features/visual-lab/lab-workspace";
import { loadLab } from "@/features/visual-lab/actions";

export const metadata = { title: "Visual Learning Lab" };

export default async function VisualLabPage({
  params,
}: {
  params: Promise<{ labId: string }>;
}) {
  const { labId } = await params;
  try {
    const lab = await loadLab(labId);
    return (
      <>
        <PageHeader
          title={lab.title}
          description="Change the inputs, watch the computed result, then explain it in your own words."
        />
        <LabWorkspace lab={lab} />
      </>
    );
  } catch (error) {
    return (
      <DataError
        message={
          error instanceof Error
            ? error.message
            : "This visual lab is unavailable."
        }
      />
    );
  }
}
