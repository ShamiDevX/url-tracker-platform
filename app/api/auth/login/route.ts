import { NextResponse } from "next/server";
import { createSessionToken, timingSafeCompare } from "@/lib/auth-security";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const expectedPassword = process.env.DASHBOARD_PASSWORD || "admin123";

    if (typeof password !== "string" || !(await timingSafeCompare(password, expectedPassword))) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const sessionMinutes = parseInt(process.env.SESSION_DURATION_MINUTES || "5", 10) || 5;
    const sessionSeconds = sessionMinutes * 60;
    const expiresAt = Date.now() + sessionSeconds * 1000;

    const signedToken = await createSessionToken(expiresAt);

    const response = NextResponse.json({
      success: true,
      expiresAt,
      sessionMinutes,
    });
    
    // Set HTTP-only cookie valid for sessionSeconds with signed cryptographic token
    response.cookies.set("dashboard_session", signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionSeconds,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
