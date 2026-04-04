
import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { dataPath, normalize, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";
import { hashPassword } from "@/lib/security";

export const runtime = "nodejs";

const ALLOWED_PERMISSIONS = ["overview", "agents", "players", "orders", "fraud", "withdrawals", "wallets", "branding", "notifications", "bonus_claims"];

export async function GET() {
  const access = await requireAdminPermission("overview");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const users = readJsonArray<any>(dataPath("users.json"));
    const admins = users.filter((item) => item.role === "admin");
    return NextResponse.json({ admins });
  } catch (error) {
    console.error("ADMIN USERS GET ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, admins: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("overview");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const body = await req.json();
    const { email, username, password, permissions } = body;
    if (!email || !username || !password) {
      return NextResponse.json({ message: "email, username and password are required" }, { status: 400 });
    }

    const usersPath = dataPath("users.json");
    const hashedPassword = await hashPassword(String(password));
    const users = readJsonArray<any>(usersPath);

    if (users.some((item) => normalize(item.email) === normalize(email))) {
      return NextResponse.json({ message: "Email already exists" }, { status: 400 });
    }
    if (users.some((item) => normalize(item.username || "") === normalize(username))) {
      return NextResponse.json({ message: "Username already exists" }, { status: 400 });
    }

    const safePermissions = Array.isArray(permissions)
      ? permissions.filter((item) => ALLOWED_PERMISSIONS.includes(String(item)))
      : ["overview", "orders", "notifications"];

    const admin = {
      id: uid("admin"),
      email: String(email).trim(),
      username: String(username).trim(),
      password: hashedPassword,
      role: "admin",
      permissions: safePermissions,
      created_at: nowIso(),
    };

    users.unshift(admin);
    writeJsonArray(usersPath, users);

    return NextResponse.json({ message: "Admin created successfully ✅", admin });
  } catch (error) {
    console.error("ADMIN USERS POST ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
