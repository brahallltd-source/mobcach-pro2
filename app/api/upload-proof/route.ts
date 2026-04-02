import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

function safeExt(fileName: string, mimeType: string) {
  const ext = path.extname(fileName || "").toLowerCase();

  if (ext === ".png") return ".png";
  if (ext === ".jpg" || ext === ".jpeg") return ".jpg";
  if (ext === ".webp") return ".webp";

  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const playerEmail = String(formData.get("playerEmail") || "").trim();

    if (!file) {
      return NextResponse.json(
        { message: "Proof image is required" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "Only image files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { message: "Image too large (max 8MB)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const ext = safeExt(file.name, file.type);
    const filename = `${uid("proof")}${ext}`;

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "proofs");
    fs.mkdirSync(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/proofs/${filename}`;
    const absoluteUrl = `${new URL(req.url).origin}${relativeUrl}`;

    const hashesPath = dataPath("proof_hashes.json");
    const hashes = readJsonArray<any>(hashesPath);
    const duplicate = hashes.find((item) => item.hash === hash);

    const record = {
      id: uid("proofhash"),
      hash,
      filename,
      url: relativeUrl,
      playerEmail,
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

    return NextResponse.json({
      message: "Proof uploaded successfully",
      proof: {
        url: absoluteUrl,
        relative_url: relativeUrl,
        hash,
        duplicate_detected: Boolean(duplicate),
        duplicate_count: record.duplicate_count,
        suspicious_flags: duplicate ? ["duplicate_proof_hash"] : [],
      },
    });
  } catch (error) {
    console.error("UPLOAD PROOF ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}