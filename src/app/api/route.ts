import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "SistAbsen API",
    status: "ok",
    serverTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    serverTime: new Date().toISOString(),
  });
}
