import { z } from "zod";

const point = z.object({ x: z.number().finite(), y: z.number().finite() });
const node = z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(80), prompt: z.string().trim().min(1).max(2000), position: point });
const edge = z.object({ id: z.string().min(1).max(100), source: z.string(), target: z.string(), branch: z.enum(["YES", "NO"]) });
export const workflowSchema = z.object({ version: z.literal(1), startNodeId: z.string().min(1), nodes: z.array(node).min(1).max(100), edges: z.array(edge).max(200) });
export type Workflow = z.infer<typeof workflowSchema>;
export type Branch = "YES" | "NO";
export const runSchema = z.object({ runId: z.uuid(), workflow: workflowSchema, input: z.string().trim().min(1).max(5000) });
export type RunRequest = z.infer<typeof runSchema>;

export const exampleWorkflow: Workflow = {
  version: 1,
  startNodeId: "repro-details",
  nodes: [
    { id: "repro-details", label: "Reproduction details", prompt: "Does the report give clear steps to reproduce the problem and describe the observed result?", position: { x: 80, y: 180 } },
    { id: "impact-check", label: "Impact check", prompt: "Does the reported bug block a core workflow, cause data loss, or present a security issue?", position: { x: 460, y: 50 } },
    { id: "investigation-details", label: "Investigation details", prompt: "Does the report identify the affected product area, version, or environment?", position: { x: 460, y: 340 } },
  ],
  edges: [
    { id: "repro-yes", source: "repro-details", target: "impact-check", branch: "YES" },
    { id: "repro-no", source: "repro-details", target: "investigation-details", branch: "NO" },
  ],
};

const oldStarterNodes = new Map([
  ["support-check", { label: "Route request", prompt: "Is this a support request?" }],
  ["support-priority", { label: "Support priority", prompt: "Does this request need urgent support?" }],
  ["sales-qualify", { label: "Sales inquiry", prompt: "Is this person asking about pricing or a purchase?" }],
]);
const oldStarterEdges = new Set(["support-yes:support-check:support-priority:YES", "support-no:support-check:sales-qualify:NO"]);

export function migrateStarterWorkflow(graph: Workflow): Workflow {
  const isOldStarter = graph.startNodeId === "support-check" &&
    graph.nodes.length === oldStarterNodes.size && graph.edges.length === oldStarterEdges.size &&
    graph.nodes.every((node) => {
      const original = oldStarterNodes.get(node.id);
      return original?.label === node.label && original.prompt === node.prompt;
    }) &&
    graph.edges.every((edge) => oldStarterEdges.has(`${edge.id}:${edge.source}:${edge.target}:${edge.branch}`));
  return isOldStarter ? exampleWorkflow : graph;
}

export function validateWorkflow(value: unknown): Workflow {
  const parsed = workflowSchema.safeParse(value);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid workflow");
  const graph = parsed.data;
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.size !== graph.nodes.length) throw new Error("Node IDs must be unique.");
  if (!ids.has(graph.startNodeId)) throw new Error("Select a valid start node.");
  const edgeIds = new Set<string>();
  const branchKeys = new Set<string>();
  const adjacency = new Map(graph.nodes.map((n) => [n.id, [] as string[]]));
  for (const e of graph.edges) {
    if (edgeIds.has(e.id)) throw new Error("Edge IDs must be unique.");
    edgeIds.add(e.id);
    if (!ids.has(e.source) || !ids.has(e.target)) throw new Error("Every edge must connect existing nodes.");
    if (e.source === e.target) throw new Error("A node cannot connect to itself.");
    const key = `${e.source}:${e.branch}`;
    if (branchKeys.has(key)) throw new Error(`${e.branch} on node ${e.source} already has a connection.`);
    branchKeys.add(key);
    adjacency.get(e.source)!.push(e.target);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("Workflow cycles are not supported.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const target of adjacency.get(id)!) visit(target);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
  return graph;
}

export function nextNode(graph: Workflow, nodeId: string, decision: Branch): string | null {
  return graph.edges.find((e) => e.source === nodeId && e.branch === decision)?.target ?? null;
}
