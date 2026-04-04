
import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const methods = readJsonArray<any>(dataPath("admin_payment_methods.json"));
    return NextResponse.json({ methods });
  } catch (error) {
    console.error("ADMIN PAYMENT METHODS GET ERROR:", error);
    return NextResponse.json(
      {
        message:
          "Something went wrong. We could not complete your request right now. Please try again.",
        methods: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const body = await req.json();
    const path = dataPath("admin_payment_methods.json");
    const methods = readJsonArray<any>(path);

    const row = {
      id: uid("admin-method"),
      type: String(body.type || "bank"),
      method_name: String(body.method_name || "").trim(),
      currency: String(body.currency || "MAD").trim(),
      bank_name: String(body.bank_name || "").trim(),
      account_name: String(body.account_name || "").trim(),
      rib: String(body.rib || "").trim(),
      wallet_address: String(body.wallet_address || "").trim(),
      network: String(body.network || "").trim(),
      provider: String(body.provider || "").trim(),
      phone: String(body.phone || "").trim(),
      city: String(body.city || "").trim(),
      instructions: String(body.instructions || "").trim(),
      active: body.active !== false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    if (!row.method_name) return NextResponse.json({ message: "method_name is required" }, { status: 400 });

    methods.unshift(row);
    writeJsonArray(path, methods);
    return NextResponse.json({ message: "Payment method created successfully ✅", method: row });
  } catch (error) {
    console.error("ADMIN PAYMENT METHODS POST ERROR:", error);
    return NextResponse.json(
      {
        message:
          "Something went wrong. We could not complete your request right now. Please try again.",
        methods: [],
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const { methodId, active } = await req.json();
    const path = dataPath("admin_payment_methods.json");
    const methods = readJsonArray<any>(path);
    const index = methods.findIndex((item) => item.id === methodId);
    if (index === -1) return NextResponse.json({ message: "Method not found" }, { status: 404 });

    methods[index] = { ...methods[index], active: Boolean(active), updated_at: nowIso() };
    writeJsonArray(path, methods);
    return NextResponse.json({ message: "Payment method updated successfully", method: methods[index] });
  } catch (error) {
    console.error("ADMIN PAYMENT METHODS PATCH ERROR:", error);
    return NextResponse.json(
      {
        message:
          "Something went wrong. We could not complete your request right now. Please try again.",
        methods: [],
      },
      { status: 500 }
    );
  }
}


export async function PUT(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const body = await req.json();
    const path = dataPath("admin_payment_methods.json");
    const methods = readJsonArray<any>(path);
    const index = methods.findIndex((item) => item.id === String(body.methodId || ""));
    if (index === -1) return NextResponse.json({ message: "Method not found" }, { status: 404 });

    const current = methods[index];
    const updated = {
      ...current,
      type: String(body.type || current.type || "bank"),
      method_name: String(body.method_name || current.method_name || "").trim(),
      currency: String(body.currency || current.currency || "MAD").trim(),
      bank_name: String(body.bank_name ?? current.bank_name ?? "").trim(),
      account_name: String(body.account_name ?? current.account_name ?? "").trim(),
      rib: String(body.rib ?? current.rib ?? "").trim(),
      wallet_address: String(body.wallet_address ?? current.wallet_address ?? "").trim(),
      network: String(body.network ?? current.network ?? "").trim(),
      provider: String(body.provider ?? current.provider ?? "").trim(),
      phone: String(body.phone ?? current.phone ?? "").trim(),
      city: String(body.city ?? current.city ?? "").trim(),
      instructions: String(body.instructions ?? current.instructions ?? "").trim(),
      active: body.active === undefined ? current.active !== false : body.active !== false,
      updated_at: nowIso(),
    };

    if (!updated.method_name) return NextResponse.json({ message: "method_name is required" }, { status: 400 });

    methods[index] = updated;
    writeJsonArray(path, methods);
    return NextResponse.json({ message: "Payment method updated successfully ✅", method: updated });
  } catch (error) {
    console.error("ADMIN PAYMENT METHODS PUT ERROR:", error);
    return NextResponse.json(
      {
        message:
          "Something went wrong. We could not complete your request right now. Please try again.",
        methods: [],
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const { searchParams } = new URL(req.url);
    const methodId = searchParams.get("methodId");
    if (!methodId) return NextResponse.json({ message: "methodId is required" }, { status: 400 });
    const path = dataPath("admin_payment_methods.json");
    const methods = readJsonArray<any>(path);
    const filtered = methods.filter((item) => item.id !== String(methodId));
    if (filtered.length === methods.length) return NextResponse.json({ message: "Method not found" }, { status: 404 });
    writeJsonArray(path, filtered);
    return NextResponse.json({ message: "Payment method deleted successfully ✅" });
  } catch (error) {
    console.error("ADMIN PAYMENT METHODS DELETE ERROR:", error);
    return NextResponse.json(
      {
        message:
          "Something went wrong. We could not complete your request right now. Please try again.",
        methods: [],
      },
      { status: 500 }
    );
  }
}
