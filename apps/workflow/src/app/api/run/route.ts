import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { inngest } from "@/inngest/client";
import { runSchema, validateWorkflow } from "@/lib/workflow";

export async function POST(request: Request) {
  const sessionId = (await cookies()).get("workflow_session")?.value;
  if (!sessionId) return NextResponse.json({ error: "Session required. Reload the page." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid run." }, { status: 400 });
  try { validateWorkflow(parsed.data.workflow); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    await inngest.send({ name: "workflow/run.requested", data: { ...parsed.data, sessionId } });
    return NextResponse.json({ runId: parsed.data.runId }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Could not start Inngest. Check that the Dev Server is running." }, { status: 503 });
  }
}
