
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const actorEmail = String(formData.get("actorEmail") || "").trim();
    const context = String(formData.get("context") || "transaction").trim();

    if (!file) return NextResponse.json({ message: "Proof image is required" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ message: "Only image files are allowed" }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ message: "Image too large (max 8MB)" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const ext = path.extname(file.name) || ".png";
    const filename = `${uid("tx-proof")}${ext}`;
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "transactions");
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, filename), buffer);

    const hashesPath = dataPath("proof_hashes.json");
    const hashes = readJsonArray<any>(hashesPath);
    const duplicate = hashes.find((item) => item.hash === hash);
    const record = {
      id: uid("proofhash"),
      hash,
      filename,
      actorEmail,
      context,
      duplicate_count: duplicate ? Number(duplicate.duplicate_count || 1) + 1 : 1,
      first_seen_at: duplicate?.first_seen_at || nowIso(),
      last_seen_at: nowIso(),
    };

    if (duplicate) {
      const index = hashes.findIndex((item) => item.hash === hash);
      hashes[index] = record;
    } else {
      hashes.unshift(record);
    }
    writeJsonArray(hashesPath, hashes);

    if (duplicate) {
      createNotification({
        targetRole: "admin",
        targetId: "admin",
        title: "Duplicate transaction proof detected",
        message: `${actorEmail || "A user"} uploaded a duplicate proof image in ${context}.`,
      });
    }

    return NextResponse.json({
      message: "Transaction proof uploaded successfully",
      proof: {
        url: `/uploads/transactions/${filename}`,
        hash,
        duplicate_detected: Boolean(duplicate),
        duplicate_count: record.duplicate_count,
        suspicious_flags: duplicate ? ["duplicate_proof_hash"] : [],
      },
    });
  } catch (error) {
    console.error("UPLOAD TRANSACTION PROOF ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
