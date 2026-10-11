import { realtime } from "inngest";
import { z } from "zod";

export const progressChannel = realtime.channel({
  name: ({ sessionId }: { sessionId: string }) => `workflow:${sessionId}`,
  topics: {
    progress: { schema: z.object({
      runId: z.string(),
      sequence: z.number(),
      kind: z.enum(["started", "decision", "branch", "completed", "failed"]),
      nodeId: z.string().optional(),
      edgeId: z.string().optional(),
      decision: z.enum(["YES", "NO"]).optional(),
      message: z.string(),
    }) },
  },
});
