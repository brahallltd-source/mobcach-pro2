import { NextResponse } from "next/server";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";
import { createNotification } from "@/lib/notifications";

// إعداد إعدادات Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const actorEmail = String(formData.get("actorEmail") || "").trim();
    const context = String(formData.get("context") || "transaction").trim();

    // التحقق من الملف
    if (!file) return NextResponse.json({ message: "Proof image is required" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ message: "Only image files are allowed" }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ message: "Image too large (max 8MB)" }, { status: 400 });

    // تحويل الملف إلى Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // إنشاء بصمة للتحقق من التكرار (Hash)
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    // الرفع إلى Cloudinary
    const uploadResponse: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          folder: "mobcash/transactions", // تنظيم الصور في مجلد خاص
          resource_type: "image"
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    const imageUrl = uploadResponse.secure_url; // الرابط النهائي من Cloudinary

    // منطق كشف التكرار (يبقى كما هو لحمايتك)
    const hashesPath = dataPath("proof_hashes.json");
    const hashes = readJsonArray<any>(hashesPath);
    const duplicate = hashes.find((item) => item.hash === hash);
    
    const record = {
      id: uid("proofhash"),
      hash,
      url: imageUrl, // حفظ الرابط الجديد
      actorEmail,
      context,
      duplicate_count: duplicate ? Number(duplicate.duplicate_count || 1) + 1 : 1,
      first_seen_at: duplicate?.first_seen_at || nowIso(),
      last_seen_at: nowIso(),
    };

    if (duplicate) {
      const index = hashes.findIndex((item) => item.hash === hash);
      hashes[index] = record;
      // إرسال إشعار للآدمن عند اكتشاف تكرار
      createNotification({
        targetRole: "admin",
        targetId: "admin",
        title: "⚠️ كشف صورة مكررة!",
        message: `قام ${actorEmail} برفع وصل مستخدم مسبقاً في سياق ${context}.`,
      });
    } else {
      hashes.unshift(record);
    }
    writeJsonArray(hashesPath, hashes);

    return NextResponse.json({
      message: "Transaction proof uploaded to cloud successfully",
      proof: {
        url: imageUrl, // الرابط الكامل الذي سيعمل في أي مكان
        hash,
        duplicate_detected: Boolean(duplicate),
        duplicate_count: record.duplicate_count,
        suspicious_flags: duplicate ? ["duplicate_proof_hash"] : [],
      },
    });
  } catch (error) {
    console.error("UPLOAD TRANSACTION PROOF ERROR:", error);
    return NextResponse.json({ 
      message: "فشل رفع الصورة إلى السحاب. تأكد من إعدادات Cloudinary." 
    }, { status: 500 });
  }
}