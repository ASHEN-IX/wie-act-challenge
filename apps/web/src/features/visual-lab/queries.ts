import "server-only";
import { load, segment } from "@/lib/api";

export interface LabSummary {
  labId: string;
  title: string;
  concept: string;
  engine: "weighted_graph" | "parameter_model" | "spatial_3d" | "function_plot";
  sourceMode: "course" | "topic";
  courseId?: string;
  generationMode: "AI_PLANNED" | "DETERMINISTIC_FALLBACK";
  createdAt: string;
}

export interface DiscoveredConcept {
  sectionId: string;
  concept: string;
  engine: LabSummary["engine"];
  excerpt: string;
  matches: number;
}

export const getMyLabs = () =>
  load<{ labs: LabSummary[] }>("/api/v1/study/visual-lab");

export const discoverConcepts = (courseId: string, revisionId?: string) =>
  load<{
    courseId: string;
    revisionId: string;
    sectionsScanned: number;
    concepts: DiscoveredConcept[];
  }>(`/api/v1/study/visual-lab/discover?courseId=${segment(courseId)}${revisionId ? `&revisionId=${encodeURIComponent(revisionId)}` : ""}`);

export const ENGINE_LABEL: Record<LabSummary["engine"], string> = {
  weighted_graph: "Graph · 2D",
  parameter_model: "Experiment · 2D",
  spatial_3d: "Scene · 3D",
  function_plot: "Function plot",
};
