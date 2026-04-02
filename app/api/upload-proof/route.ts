import { NextResponse } from "next/server";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const playerEmail = String(formData.get("playerEmail") || "").trim();

    if (!file) {
      return NextResponse.json({ message: "Proof image is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ message: "Only image files are allowed" }, { status: 400 });
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ message: "Image too large (max 8MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const uploadResult = await cloudinary.uploader.upload(base64, {
      folder: "mobcash/proofs",
    });

    const hashesPath = dataPath("proof_hashes.json");
    const hashes = readJsonArray<any>(hashesPath);
    const duplicate = hashes.find((item) => item.hash === hash);

    const record = {
      id: uid("proofhash"),
      hash,
      filename: uploadResult.public_id,
      url: uploadResult.secure_url,
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
        url: uploadResult.secure_url,
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