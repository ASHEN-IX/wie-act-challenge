"use client";
import {
  Component,
  Suspense,
  lazy,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { AlertCircle, Layers, LoaderCircle } from "lucide-react";
import type { LessonBlockV2 } from "@noveris/shared/ednova/learningDocumentV2";
import type { ComponentType as TrustedComponentType } from "@noveris/shared/ednova/componentRegistry";
import type {
  AssetPayload,
  PublishedStructuredAssetV1,
} from "@noveris/shared/ednova/structuredAsset";
import { Badge } from "@/components/ui/badge";
import {
  DefinitionCard,
  ExampleBlock,
  ExerciseBlock,
  ImportantNote,
  ProofBlock,
  TheoremCard,
} from "./semantic";
import {
  DerivationBlock,
  ReviewedFormula,
  SourceMathFallback,
  type MathBlockContext,
} from "./math-blocks";
import {
  CodeViewer,
  DataChart,
  EducationalTable,
  FigureViewer,
  ProcessDiagram,
} from "./structured";

const CodeWalkthrough = lazy(() => import("../code/code-walkthrough"));
const FunctionGraph = lazy(() => import("../math/function-graph"));
const SequenceVisualizer = lazy(() => import("../math/sequence-visualizer"));
const DerivationStepper = lazy(() => import("../math/derivation-stepper"));
const InteractiveDiagram = lazy(() => import("../diagrams/interactive-diagram"));

export type ReaderContext = MathBlockContext & {
  title: string;
  revisionId: string;
  /** Exploration is opt-in; Read mode never mounts an interactive component. */
  explore: boolean;
};

type BlockProps = { block: LessonBlockV2; context: ReaderContext };

function LoadingBlock() {
  return (
    <div role="status" className="my-6 flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" /> Preparing this content…
    </div>
  );
}

class BlockBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Diagnostics stay local; no source or runtime detail reaches the learner.
  }
  render() {
    if (this.state.failed)
      return (
        <div role="alert" className="my-5 flex gap-2 rounded-lg border p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          This item cannot be displayed. The original source remains available.
        </div>
      );
    return this.props.children;
  }
}

function Heading({ block }: { block: Extract<LessonBlockV2, { type: "heading" }> }) {
  // The lesson title owns h1, so source headings start at h2. A source level 1
  // must not become a second h1, and no rank may be skipped.
  const level = Math.min(6, Math.max(2, block.level));
  const Tag = (`h${level}` as "h2" | "h3" | "h4" | "h5" | "h6");
  return (
    <Tag
      id={block.id}
      className="scroll-mt-24 pt-5 font-heading text-lg font-semibold tracking-tight text-foreground"
    >
      {block.text}
    </Tag>
  );
}

function Paragraph({ block }: { block: Extract<LessonBlockV2, { type: "paragraph" }> }) {
  return <p className="whitespace-pre-wrap text-[1.02rem] leading-8 text-foreground/90">{block.text}</p>;
}

function Quote({ block }: { block: Extract<LessonBlockV2, { type: "quote" }> }) {
  return (
    <blockquote className="border-l-2 border-primary/45 pl-5 text-base italic leading-8 text-muted-foreground">
      {block.text}
    </blockquote>
  );
}

function ConceptList({ block }: { block: Extract<LessonBlockV2, { type: "list" }> }) {
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag
      className={
        block.ordered
          ? "list-decimal space-y-2 pl-6 text-[1.02rem] leading-8"
          : "list-disc space-y-2 pl-6 text-[1.02rem] leading-8"
      }
    >
      {block.items.map((item, index) => (
        <li key={index} className="pl-1">
          {item}
        </li>
      ))}
    </Tag>
  );
}

/** Interactive additions are gated on Explore mode AND on trusted data. When
 * the canonical block carries no structured annotation, the static component
 * renders instead — the reader never fabricates a walkthrough. */
function MathBlock({ block, context }: BlockProps) {
  if (block.type !== "math") return null;
  if (!block.review) return <SourceMathFallback block={block} context={context} />;
  return <ReviewedFormula block={block} />;
}

function CodeBlockView({ block }: BlockProps) {
  if (block.type !== "code") return null;
  // Canonical code carries no reviewed annotations, so Explore offers the
  // static viewer. A walkthrough requires a structured fixture.
  return <CodeViewer block={block} />;
}

function DiagramView({ block }: BlockProps) {
  if (block.type !== "diagram") return null;
  return <ProcessDiagram block={block} />;
}

/**
 * The trusted renderer table. Keys are literal component types from the
 * frozen shared registry; a value can only be a component statically imported
 * in this file. No dynamic import is keyed by data, so a tampered plan can
 * never load or execute code.
 */
const RENDERERS: Partial<Record<TrustedComponentType, ComponentType<BlockProps>>> = {
  SectionHeading: ({ block }) => (block.type === "heading" ? <Heading block={block} /> : null),
  ConceptExplanation: ({ block }) =>
    block.type === "paragraph" ? (
      <Paragraph block={block} />
    ) : block.type === "quote" ? (
      <Quote block={block} />
    ) : null,
  ConceptList: ({ block }) => (block.type === "list" ? <ConceptList block={block} /> : null),
  DefinitionCard: ({ block }) => (block.type === "callout" ? <DefinitionCard block={block} /> : null),
  TheoremCard: ({ block }) => (block.type === "callout" ? <TheoremCard block={block} /> : null),
  ProofBlock: ({ block }) => (block.type === "callout" ? <ProofBlock block={block} /> : null),
  ExampleBlock: ({ block }) => (block.type === "callout" ? <ExampleBlock block={block} /> : null),
  ExerciseBlock: ({ block }) => (block.type === "callout" ? <ExerciseBlock block={block} /> : null),
  ImportantNote: ({ block }) => (block.type === "callout" ? <ImportantNote block={block} /> : null),
  FormulaBlock: ({ block, context }) => <MathBlock block={block} context={context} />,
  ReviewedFormula: ({ block, context }) => <MathBlock block={block} context={context} />,
  SourceMathFallback: ({ block, context }) => <MathBlock block={block} context={context} />,
  DerivationBlock: ({ block }) =>
    block.type === "math" ? <DerivationBlock block={block} /> : null,
  CodeViewer: ({ block, context }) => <CodeBlockView block={block} context={context} />,
  EducationalTable: ({ block }) => (block.type === "table" ? <EducationalTable block={block} /> : null),
  ComparisonTable: ({ block }) => (block.type === "table" ? <EducationalTable block={block} /> : null),
  KeyValueTable: ({ block }) => (block.type === "table" ? <EducationalTable block={block} /> : null),
  FigureViewer: ({ block }) => (block.type === "media" ? <FigureViewer block={block} /> : null),
  SourceDiagram: ({ block }) =>
    block.type === "media" ? <FigureViewer block={block} /> : block.type === "diagram" ? <ProcessDiagram block={block} /> : null,
  ProcessDiagram: ({ block, context }) => <DiagramView block={block} context={context} />,
  StepSequence: ({ block, context }) => <DiagramView block={block} context={context} />,
  DataChart: ({ block }) => (block.type === "chart" ? <DataChart block={block} /> : null),
};

/**
 * Structured-asset renderers. These are the only components that accept input
 * the canonical projection cannot supply, so they are reachable exclusively
 * through a validated, provenance-labelled asset — never from a canonical block.
 */
const ASSET_RENDERERS: Partial<Record<TrustedComponentType, ComponentType<AssetRenderProps>>> = {
  CodeWalkthrough: ({ payload }) =>
    payload.component === "CodeWalkthrough" ? (
      <CodeWalkthrough
        title="Guided walkthrough"
        language={payload.language}
        code={payload.code}
        annotations={payload.annotations}
      />
    ) : null,
  ArchitectureDiagram: ({ payload }) =>
    payload.component === "ArchitectureDiagram" ? (
      <InteractiveDiagram
        title="Architecture"
        description="Component relationships from a validated asset."
        nodes={payload.nodes}
        links={payload.links}
      />
    ) : null,
  NetworkTopology: ({ payload }) =>
    payload.component === "NetworkTopology" ? (
      <InteractiveDiagram
        title="Network topology"
        description="Validated nodes and links supplied with this lesson."
        nodes={payload.nodes}
        links={payload.links}
      />
    ) : null,
  AnnotatedDiagram: ({ payload }) =>
    payload.component === "AnnotatedDiagram" ? (
      <InteractiveDiagram
        title="Annotated diagram"
        description={payload.imageAlt}
        nodes={payload.nodes}
        links={payload.links}
      />
    ) : null,
};

type AssetRenderProps = { payload: AssetPayload };

/** True when this browser build can render the asset's component. An asset
 * whose component has no renderer falls back rather than showing nothing. */
export function hasAssetRenderer(component: TrustedComponentType): boolean {
  return Object.hasOwn(ASSET_RENDERERS, component);
}

export function StructuredAssetView({
  asset,
}: {
  asset: PublishedStructuredAssetV1;
}) {
  const Renderer = Object.hasOwn(ASSET_RENDERERS, asset.component as TrustedComponentType)
    ? ASSET_RENDERERS[asset.component as TrustedComponentType]
    : undefined;
  return (
    <section
      data-structured-asset={asset.assetId}
      data-asset-component={asset.component}
      data-asset-provenance={asset.provenance}
      className="my-6 rounded-xl border border-dashed border-brand-cyan/40 bg-brand-cyan/[0.04] p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1.5 text-[0.68rem] text-brand-cyan">
          <Layers className="size-3" /> {asset.label}
        </Badge>
        <span className="text-[0.68rem] text-muted-foreground">{asset.disclosure}</span>
      </div>
      <BlockBoundary>
        {Renderer ? (
          <Renderer payload={asset.payload} />
        ) : (
          <div role="alert" className="rounded-lg border p-4 text-sm">
            {asset.component} cannot be rendered by this reader version. The lesson content
            remains available.
          </div>
        )}
      </BlockBoundary>
    </section>
  );
}

/** Which plan component types the browser can actually render today. The plan
 * is authoritative for selection; this set lets the shell explain a degraded
 * instance rather than silently showing nothing. */
export const RENDERABLE = new Set(Object.keys(RENDERERS) as TrustedComponentType[]);

function UnsupportedBlock({ component }: { component: string }) {
  return (
    <div role="alert" className="my-5 rounded-lg border p-4 text-sm">
      This content type is not supported by this reader version ({component}). The original source
      remains available.
    </div>
  );
}

export function PlannedBlockView({
  component,
  block,
  context,
}: {
  component: TrustedComponentType;
  block: LessonBlockV2;
  context: ReaderContext;
}) {
  const Renderer = Object.hasOwn(RENDERERS, component) ? RENDERERS[component] : undefined;
  return (
    <div data-block-type={block.type} data-component={component} className={block.type === "heading" ? "" : "my-5"}>
      <BlockBoundary>
        {Renderer ? (
          <Renderer block={block} context={context} />
        ) : (
          <UnsupportedBlock component={component} />
        )}
      </BlockBoundary>
    </div>
  );
}

export {
  CodeWalkthrough,
  FunctionGraph,
  SequenceVisualizer,
  DerivationStepper,
  InteractiveDiagram,
  Suspense,
  LoadingBlock,
};
