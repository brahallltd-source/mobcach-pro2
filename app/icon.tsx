import { ImageResponse } from "next/og";
import { getPrisma } from "@/lib/db";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default async function Icon() {
  const prisma = getPrisma();

  let logoUrl = "";

  if (prisma) {
    const latest = await prisma.auditLog.findFirst({
      where: {
        action: "branding_updated",
        entityType: "branding",
        entityId: "global",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const meta = (latest?.meta || {}) as Record<string, any>;
    logoUrl = String(meta.logoUrl || "").trim();
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