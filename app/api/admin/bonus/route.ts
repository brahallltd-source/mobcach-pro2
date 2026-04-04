import { NextResponse } from "next/server";
import { creditWallet } from "@/lib/wallet";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  try {
    const claims = readJsonArray<any>(dataPath("bonus_claims.json"));
    return NextResponse.json({ claims });
  } catch (error) {
    console.error("ADMIN BONUS GET ERROR:", error);
    return NextResponse.json(
      {
        message:
          "Something went wrong. We could not complete your request right now. Please try again.",
        claims: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { claimId, action } = await req.json();

    if (!claimId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { message: "claimId and valid action are required" },
        { status: 400 }
      );
    }

    const path = dataPath("bonus_claims.json");
    const claims = readJsonArray<any>(path);
    const index = claims.findIndex((item) => item.id === claimId);

    if (index === -1) {
      return NextResponse.json({ message: "Claim not found" }, { status: 404 });
    }

    const claim = claims[index];

    claims[index] = {
      ...claim,
      status: action === "approve" ? "approved" : "rejected",
      reviewed_at: nowIso(),
    };

    writeJsonArray(path, claims);

    if (action === "approve") {
      creditWallet(
        claim.agentId,
        Number(claim.reward || 0),
        "bonus_claim_reward",
        {
          claimId: claim.id,
          track: claim.track,
          level: claim.level,
        }
      );
    }

    return NextResponse.json({
      message:
        action === "approve"
          ? "Bonus approved and credited"
          : "Bonus claim rejected",
      claim: claims[index],
    });
  } catch (error) {
    console.error("ADMIN BONUS POST ERROR:", error);
    return NextResponse.json(
      {
        message:
          "Something went wrong. We could not complete your request right now. Please try again.",
      },
      { status: 500 }
    );
  }
}