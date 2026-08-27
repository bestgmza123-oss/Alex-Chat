import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { PIN_COOKIE_NAME } from "@/lib/pin-session";

// The real PIN never lives in client code. Set ALEX_PIN_SHA256 in your
// deployment env vars to the sha256 hex digest of your chosen PIN, e.g.:
//   node -e "console.log(require('crypto').createHash('sha256').update('1234').digest('hex'))"
export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  const expectedHash = process.env.ALEX_PIN_SHA256;

  if (!expectedHash) {
    return NextResponse.json(
      { error: "Server misconfigured: ALEX_PIN_SHA256 not set" },
      { status: 500 }
    );
  }

  const submittedHash = createHash("sha256").update(String(pin || "")).digest("hex");

  if (submittedHash !== expectedHash) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PIN_COOKIE_NAME, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
