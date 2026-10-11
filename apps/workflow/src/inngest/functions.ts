import { inngest } from "./client";
import { progressChannel } from "./channels";
import { decide } from "@/lib/decision";
import { nextNode, validateWorkflow, type RunRequest } from "@/lib/workflow";

export const executeWorkflow = inngest.createFunction(
  {
    id: "execute-workflow",
    triggers: { event: "workflow/run.requested" },
    retries: 2,
    onFailure: async ({ event, step }) => {
      const original = event.data.event.data as RunRequest & { sessionId: string };
      const channel = progressChannel({ sessionId: original.sessionId });
      await step.realtime.publish(`failure-${original.runId}`, channel.progress, {
        runId: original.runId, sequence: 9999, kind: "failed",
        message: "A model step failed after retries. Inspect the Inngest run for details.",
      });
    },
  },
  async ({ event, step }) => {
    const payload = event.data as RunRequest & { sessionId: string };
    const graph = validateWorkflow(payload.workflow);
    const channel = progressChannel({ sessionId: payload.sessionId });
    let nodeId: string | null = graph.startNodeId;
    let sequence = 0;
    let index = 0;
    while (nodeId !== null) {
      const node = graph.nodes.find((item) => item.id === nodeId);
      if (!node) throw new Error(`Node ${nodeId} is missing`);
      const currentId = node.id;
      await step.realtime.publish(`node-${index}-started`, channel.progress, {
        runId: payload.runId, sequence: sequence++, kind: "started", nodeId: currentId,
        message: `Evaluating ${node.label}`,
      });
      const decision = await step.run(`decision-${index}-${currentId}`, () => decide(node.prompt, payload.input));
      await step.realtime.publish(`node-${index}-decision`, channel.progress, {
        runId: payload.runId, sequence: sequence++, kind: "decision", nodeId: currentId, decision,
        message: `${node.label} answered ${decision}`,
      });
      const target = nextNode(graph, currentId, decision);
      if (target) {
        const edge = graph.edges.find((e) => e.source === currentId && e.branch === decision)!;
        await step.realtime.publish(`node-${index}-branch`, channel.progress, {
          runId: payload.runId, sequence: sequence++, kind: "branch", edgeId: edge.id, nodeId: target, decision,
          message: `Following ${decision} to ${graph.nodes.find((n) => n.id === target)?.label}`,
        });
      }
      index++;
      nodeId = target;
      if (!target) {
        await step.realtime.publish("workflow-completed", channel.progress, {
          runId: payload.runId, sequence: sequence++, kind: "completed", nodeId: currentId, decision,
          message: `Finished at ${node.label} on ${decision}`,
        });
      }
    }
    return { runId: payload.runId, visited: index };
  },
);
