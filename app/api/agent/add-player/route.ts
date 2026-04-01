
import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, normalize, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";
import { normalizePhoneWithCountry } from "@/lib/countries";
import { hashPassword } from "@/lib/security";

export const runtime = "nodejs";

function buildPlayerMessage(payload: { username: string; password: string; email: string; whatsapp: string }) {
  const { username, password, email, whatsapp } = payload;
  return `Hello, your account has been created successfully.

Login credentials:
- Username: ${username}
- Password: ${password}

Contact details:
- Email: ${email}
- WhatsApp: ${whatsapp}

Please do not share these credentials with anyone.
These credentials are valid for GoSport365 and GoSport365 MobCash.

------------------------------

مرحبًا، تم إنشاء حسابك بنجاح.

بيانات الدخول:
- Username: ${username}
- Password: ${password}

بيانات التواصل:
- Email: ${email}
- WhatsApp: ${whatsapp}

يرجى عدم مشاركة هذه المعلومات مع أي شخص.
هذه البيانات صالحة لتسجيل الدخول عبر GoSport365 و GoSport365 MobCash.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agentEmail, first_name, last_name, username, email, password, phone, country, city } = body;

    if (!agentEmail || !username || !email) {
      return NextResponse.json({ message: "agentEmail, username and email are required" }, { status: 400 });
    }

    const usersPath = dataPath("users.json");
    const playersPath = dataPath("players.json");
    const activationsPath = dataPath("activations.json");

    const users = readJsonArray<any>(usersPath);
    const players = readJsonArray<any>(playersPath);
    const activations = readJsonArray<any>(activationsPath);

    const agentUser = users.find((item) => normalize(item.email) === normalize(String(agentEmail)) && item.role === "agent");
    if (!agentUser?.agentId) {
      return NextResponse.json({ message: "Agent not found" }, { status: 404 });
    }

    if (users.some((item) => normalize(item.email) === normalize(String(email)))) {
      return NextResponse.json({ message: "Email already exists" }, { status: 400 });
    }
    if (users.some((item) => normalize(item.username || "") === normalize(String(username)))) {
      return NextResponse.json({ message: "Username already exists" }, { status: 400 });
    }

    const plainPassword = String(password || "123456");
    const hashedPassword = await hashPassword(plainPassword);

    const user = {
      id: uid("player-user"),
      email: String(email).trim(),
      username: String(username).trim(),
      password: hashedPassword,
      role: "player",
      player_status: "active",
      assigned_agent_id: String(agentUser.agentId),
      created_at: nowIso(),
    };

    const player = {
      id: uid("player"),
      user_id: user.id,
      first_name: String(first_name || ""),
      last_name: String(last_name || ""),
      username: String(username).trim(),
      phone: normalizePhoneWithCountry(String(phone || ""), String(country || "Morocco")),
      city: String(city || ""),
      country: String(country || "Morocco"),
      date_of_birth: "",
      status: "active",
      assigned_agent_id: String(agentUser.agentId),
      reassigned_from_agent_id: "",
      reassignment_count: 0,
      reassigned_at: "",
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const messageText = buildPlayerMessage({
      username: user.username,
      password: plainPassword,
      email: user.email,
      whatsapp: player.phone,
    });

    const activation = {
      id: uid("activation"),
      agentId: String(agentUser.agentId),
      playerUserId: user.id,
      playerEmail: user.email,
      username: user.username,
      password: plainPassword,
      whatsapp: player.phone,
      status: "sent",
      messageText,
      created_at: nowIso(),
      updated_at: nowIso(),
      activated_at: nowIso(),
      sent_at: nowIso(),
    };

    users.unshift(user);
    players.unshift(player);
    activations.unshift(activation);

    writeJsonArray(usersPath, users);
    writeJsonArray(playersPath, players);
    writeJsonArray(activationsPath, activations);

    createNotification({
      targetRole: "player",
      targetId: user.id,
      title: "Account created by your agent",
      message: "Your player account has been created and activated directly by your agent.",
    });

    return NextResponse.json({
      message: "Player created, activated and linked successfully ✅",
      user,
      player,
      activation,
      credentials: {
        username: user.username,
        password: plainPassword,
        messageText,
      },
    });
  } catch (error) {
    console.error("ADD PLAYER ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
