import { NextResponse } from "next/server";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";
import { CASH_NETWORKS, CRYPTO_NETWORKS, MOROCCAN_BANKS } from "@/lib/payment-options";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ message: "agentId is required", methods: [], profile: null }, { status: 400 });
    const methods = readJsonArray<any>(dataPath("agent_payment_methods.json")).filter((item) => String(item.agentId) === String(agentId));
    const profile = readJsonArray<any>(dataPath("agent_profiles.json")).find((item) => String(item.agentId) === String(agentId)) || null;
    return NextResponse.json({ methods, profile });
  } catch (error) {
    console.error("AGENT PAYMENT METHODS ERROR:", error);
    return NextResponse.json({ message: "Server error", methods: [], profile: null }, { status: 500 });
  }
}

function validatePayload(type: string, payload: any) {
  const name = String(payload.method_name || "").trim();
  if (!type || !name) return "type and method_name are required";
  if (type === "bank") {
    if (!MOROCCAN_BANKS.includes(name)) return "Select a valid Moroccan bank";
    if (!String(payload.account_name || "").trim()) return "Bank methods require account_name";
    if (!String(payload.rib || "").trim()) return "RIB is required for Moroccan banks";
    return null;
  }
  if (type === "cash") {
    if (!CASH_NETWORKS.includes(name)) return "Select Cash Plus or Wafacash";
    if (!String(payload.account_name || "").trim()) return "Cash methods require full name";
    if (!String(payload.phone || "").trim()) return "Cash methods require phone";
    return null;
  }
  if (type === "crypto") {
    if (!String(payload.wallet_address || "").trim()) return "Crypto methods require wallet_address";
    if (payload.network && !CRYPTO_NETWORKS.includes(String(payload.network))) return "Invalid crypto network";
    return null;
  }
  return "Invalid payment type";
}

function normalizeRecord(agentId: string, payload: any, existing?: any) {
  const type = String(payload.type);
  const currency = type === "bank" || type === "cash" ? "MAD" : String(payload.currency || "USDT");
  return {
    id: existing?.id || `pm-${Date.now()}`,
    agentId: String(agentId),
    type,
    method_name: String(payload.method_name || "").trim(),
    account_name: String(payload.account_name || "").trim(),
    account_number: type === "crypto" ? "" : String(payload.account_number || "").trim(),
    rib: type === "bank" ? String(payload.rib || "").trim() : "",
    wallet_address: type === "crypto" ? String(payload.wallet_address || "").trim() : "",
    network: type === "crypto" ? String(payload.network || "TRC20") : "",
    phone: type === "cash" ? String(payload.phone || "").trim() : "",
    fee_percent: type === "cash" ? Number(payload.fee_percent || 0) : 0,
    instructions: String(payload.instructions || "").trim(),
    enabled: payload.enabled !== false,
    currency,
    updated_at: nowIso(),
    created_at: existing?.created_at || nowIso(),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agentId } = body;
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    const error = validatePayload(String(body.type || ""), body);
    if (error) return NextResponse.json({ message: error }, { status: 400 });
    const methodsPath = dataPath("agent_payment_methods.json");
    const methods = readJsonArray<any>(methodsPath);
    const newMethod = normalizeRecord(agentId, body);
    methods.unshift(newMethod);
    writeJsonArray(methodsPath, methods);
    return NextResponse.json({ message: "Payment method added successfully", method: newMethod });
  } catch (error) {
    console.error("CREATE AGENT PAYMENT METHOD ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { agentId, methodId } = body;
    if (!agentId || !methodId) return NextResponse.json({ message: "agentId and methodId are required" }, { status: 400 });
    const methodsPath = dataPath("agent_payment_methods.json");
    const methods = readJsonArray<any>(methodsPath);
    const index = methods.findIndex((item) => String(item.id) === String(methodId) && String(item.agentId) === String(agentId));
    if (index === -1) return NextResponse.json({ message: "Payment method not found" }, { status: 404 });
    const error = validatePayload(String(body.type || methods[index].type || ""), { ...methods[index], ...body });
    if (error) return NextResponse.json({ message: error }, { status: 400 });
    methods[index] = normalizeRecord(agentId, { ...methods[index], ...body }, methods[index]);
    writeJsonArray(methodsPath, methods);
    return NextResponse.json({ message: "Payment method updated successfully", method: methods[index] });
  } catch (error) {
    console.error("UPDATE AGENT PAYMENT METHOD ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const methodId = searchParams.get("methodId");
    if (!agentId || !methodId) return NextResponse.json({ message: "agentId and methodId are required" }, { status: 400 });
    const methodsPath = dataPath("agent_payment_methods.json");
    const methods = readJsonArray<any>(methodsPath);
    writeJsonArray(methodsPath, methods.filter((item) => !(String(item.id) === String(methodId) && String(item.agentId) === String(agentId))));
    return NextResponse.json({ message: "Payment method deleted successfully" });
  } catch (error) {
    console.error("DELETE AGENT PAYMENT METHOD ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
