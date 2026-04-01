import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ complaints: readJsonArray<any>(dataPath("complaints.json")) });
}

export async function POST(req: Request) {
  try {
    const { complaintId, admin_reply } = await req.json();
    const path = dataPath("complaints.json");
    const complaints = readJsonArray<any>(path);
    const index = complaints.findIndex((item) => item.id === complaintId);
    if (index === -1) return NextResponse.json({ message: "Complaint not found" }, { status: 404 });
    complaints[index] = { ...complaints[index], admin_reply: String(admin_reply || "").trim(), status: "resolved", updated_at: nowIso() };
    writeJsonArray(path, complaints);
    createNotification({ targetRole: "player", targetId: complaints[index].playerEmail, title: "Complaint updated", message: `Admin replied to complaint ${complaints[index].subject}.` });
    return NextResponse.json({ message: "Reply sent successfully ✅", complaint: complaints[index] });
  } catch (error) {
    console.error("ADMIN COMPLAINT ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
