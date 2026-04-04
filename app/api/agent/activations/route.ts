
import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, normalize, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

function buildOfficialMessage(payload: { username: string; password: string; email: string; whatsapp: string }) {
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const users = readJsonArray<any>(dataPath("users.json"));
  const players = readJsonArray<any>(dataPath("players.json"));
  const activations = readJsonArray<any>(dataPath("activations.json"));
  const agent = users.find((item) => normalize(item.email) === normalize(email || "") && item.role === "agent");
  if (!agent) return NextResponse.json({ players: [] });

  const rows = players
    .filter((item) => String(item.assigned_agent_id) === String(agent.agentId))
    .map((player) => {
      const user = users.find((row) => row.id === player.user_id);
      const activation = activations.find((row) => String(row.playerUserId) === String(player.user_id) && String(row.agentId || "") === String(agent.agentId));
      const plainPassword = String(activation?.passwordPlain || activation?.password || "123456");
      const messageText = activation?.messageText || buildOfficialMessage({
        username: user?.username || player.username || "",
        password: plainPassword,
        email: user?.email || "",
        whatsapp: player.phone || "",
      });
      return {
        ...player,
        playerEmail: user?.email || "",
        password: plainPassword,
        messageText,
      };
    });

  return NextResponse.json({ players: rows });
}

export async function POST(req: Request) {
  try {
    const { playerUserId, action } = await req.json();
    const usersPath = dataPath("users.json");
    const playersPath = dataPath("players.json");
    const users = readJsonArray<any>(usersPath);
    const players = readJsonArray<any>(playersPath);
    const userIndex = users.findIndex((item) => item.id === playerUserId && item.role === "player");
    if (userIndex === -1) return NextResponse.json({ message: "Player user not found" }, { status: 404 });
    const playerIndex = players.findIndex((item) => item.user_id === playerUserId);
    if (playerIndex === -1) return NextResponse.json({ message: "Player profile not found" }, { status: 404 });

    if (action === "done") {
      createNotification({ targetRole: "player", targetId: playerUserId, title: "Credentials sent", message: "Your official credentials have been sent by your agent." });
      return NextResponse.json({ message: "Marked as sent successfully ✅" });
    }

    users[userIndex] = { ...users[userIndex], player_status: "active" };
    players[playerIndex] = { ...players[playerIndex], status: "active", updated_at: nowIso() };
    writeJsonArray(usersPath, users);
    writeJsonArray(playersPath, players);
    createNotification({ targetRole: "player", targetId: playerUserId, title: "Account activated", message: "Your account is now active and ready for orders." });
    return NextResponse.json({ message: "Player activated successfully ✅", user: users[userIndex], player: players[playerIndex] });
  } catch (error) {
    console.error("ACTIVATE PLAYER ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
