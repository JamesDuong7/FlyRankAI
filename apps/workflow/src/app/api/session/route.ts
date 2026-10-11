import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const jar = await cookies();
  let sessionId = jar.get("workflow_session")?.value;
  if (!sessionId || !/^[0-9a-f-]{36}$/.test(sessionId)) sessionId = crypto.randomUUID();
  const response = NextResponse.json({ sessionId });
  response.cookies.set("workflow_session", sessionId, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
