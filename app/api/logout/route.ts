
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ message: "Logged out" });
  res.cookies.set("mobcash_session", "", { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 0 });
  return res;
}
