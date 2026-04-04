import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const complaints = readJsonArray<any>(dataPath("complaints.json"));
  return NextResponse.json({ complaints: complaints.filter((item) => !email || item.playerEmail === email) });
}

export async function POST(req: Request) {
  try {
    const { playerEmail, subject, message } = await req.json();
    if (!playerEmail || !subject || !message) return NextResponse.json({ message: "playerEmail, subject and message are required" }, { status: 400 });
    const path = dataPath("complaints.json");
    const complaints = readJsonArray<any>(path);
    const complaint = { id: uid("complaint"), playerEmail, subject, message, status: "open", admin_reply: "", created_at: nowIso(), updated_at: nowIso() };
    complaints.unshift(complaint);
    writeJsonArray(path, complaints);
    createNotification({ targetRole: "admin", targetId: "admin", title: "New complaint", message: `${playerEmail} opened a complaint.` });
    return NextResponse.json({ message: "Complaint submitted successfully ✅", complaint });
  } catch (error) {
    console.error("PLAYER COMPLAINT ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
