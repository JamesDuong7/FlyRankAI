import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClientSubscriptionToken } from "inngest/react";
import { inngest } from "@/inngest/client";
import { progressChannel } from "@/inngest/channels";

export async function GET() {
  const sessionId = (await cookies()).get("workflow_session")?.value;
  if (!sessionId) return NextResponse.json({ error: "Session required" }, { status: 401 });
  const token = await getClientSubscriptionToken(inngest, { channel: progressChannel({ sessionId }), topics: ["progress"] });
  return NextResponse.json(token);
}
