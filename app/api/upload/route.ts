import { NextResponse } from "next/server";
import { ensureCloudinaryConfigured } from "@/lib/cloudinary";
import { getAgentFromMobcashUserCookie } from "@/lib/mobcash-user-cookie";

export const runtime = "nodejs";

const FOLDER = "mobcash_proofs";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionOk(name: string): boolean {
  const n = name.trim().toLowerCase();
  return /\.(jpe?g|png|webp)$/i.test(n);
}

function guessMimeFromName(name: string): "image/jpeg" | "image/png" | "image/webp" {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function mimeAllowed(file: File): boolean {
  const type = (file.type || "").trim().toLowerCase();
  if (ALLOWED_MIME.has(type) || type === "image/jpg") return true;
  if (type === "application/octet-stream" || !type) {
    return extensionOk(file.name || "");
  }
  return false;
}

/**
 * POST multipart FormData: field `file` = image (JPEG, PNG, or WebP only).
 * Uploads to Cloudinary folder `mobcash_proofs`. Requires agent session (`mobcash_user`).
 * Response: `{ secure_url: string }`.
 */
export async function POST(req: Request) {
  const agent = await getAgentFromMobcashUserCookie();
  if (!agent) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ message: "Missing file field" }, { status: 400 });
  }

  if (!mimeAllowed(file) || !extensionOk(file.name || "")) {
    return NextResponse.json(
      { message: "Only JPG, PNG, and WebP images are allowed." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { message: `File too large (max ${MAX_BYTES / (1024 * 1024)} MB).` },
      { status: 400 }
    );
  }

  try {
    const cld = ensureCloudinaryConfigured();
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawMime = (file.type || "").split(";")[0].trim().toLowerCase();
    const safeMime: "image/jpeg" | "image/png" | "image/webp" =
      rawMime === "image/png"
        ? "image/png"
        : rawMime === "image/webp"
          ? "image/webp"
          : rawMime === "image/jpeg" || rawMime === "image/jpg"
            ? "image/jpeg"
            : guessMimeFromName(file.name || "");
    const base64 = `data:${safeMime};base64,${buffer.toString("base64")}`;

    const uploadResult = await cld.uploader.upload(base64, {
      folder: FOLDER,
      resource_type: "image",
      use_filename: false,
      unique_filename: true,
    });

    const secure_url = uploadResult.secure_url;
    if (!secure_url) {
      return NextResponse.json({ message: "Upload failed" }, { status: 502 });
    }

    return NextResponse.json({ secure_url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("POST /api/upload:", e);
    const isConfig = /Cloudinary is not configured/i.test(msg);
    return NextResponse.json(
      { message: isConfig ? "File upload is not configured on the server." : "Upload failed" },
      { status: isConfig ? 503 : 500 }
    );
  }
}
