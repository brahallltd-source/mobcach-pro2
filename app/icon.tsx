import { ImageResponse } from "next/og";
import { getPrisma } from "@/lib/db";
import { getOrCreateSystemSettings } from "@/lib/system-settings";

export const dynamic = "force-dynamic";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

function parseMarketingMeta(meta: unknown): Record<string, unknown> | null {
  if (meta == null) return null;
  if (typeof meta === "string") {
    try {
      return JSON.parse(meta) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return null;
}

export default async function Icon() {
  const prisma = getPrisma();
  let logoUrl = "";

  if (prisma) {
    try {
      const settings = await getOrCreateSystemSettings(prisma);
      const fromSettings = String(settings.logoUrl || "").trim();
      if (fromSettings) {
        logoUrl = fromSettings;
      } else {
        const latest = await prisma.auditLog.findFirst({
          where: {
            action: "branding_updated",
            entityType: "branding",
            entityId: "global",
          },
          orderBy: { createdAt: "desc" },
        });
        const parsed = parseMarketingMeta(latest?.meta);
        logoUrl = String(parsed?.logoUrl || "").trim();
      }
    } catch (error) {
      console.error("Icon DB Error:", error);
    }
  }

  if (logoUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "black",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="logo"
            width="32"
            height="32"
            style={{ objectFit: "contain" }}
          />
        </div>
      ),
      {
        ...size,
      }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "white",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        M
      </div>
    ),
    {
      ...size,
    }
  );
}
