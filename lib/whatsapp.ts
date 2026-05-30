import qrcode from "qrcode-terminal";
import { Client, LocalAuth } from "whatsapp-web.js";

const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

type WhatsAppState = {
  client: Client | null;
  initPromise: Promise<Client> | null;
  readyPromise: Promise<void> | null;
  resolveReady: (() => void) | null;
  listenersBound: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __mobcashWhatsAppState?: WhatsAppState;
};

function getState(): WhatsAppState {
  if (!globalState.__mobcashWhatsAppState) {
    let resolveReady: (() => void) | null = null;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    globalState.__mobcashWhatsAppState = {
      client: null,
      initPromise: null,
      readyPromise,
      resolveReady,
      listenersBound: false,
    };
  }
  return globalState.__mobcashWhatsAppState;
}

function bindEvents(client: Client, state: WhatsAppState): void {
  if (state.listenersBound) return;
  state.listenersBound = true;

  client.on("qr", (qr) => {
    // Print raw QR value as a fallback when terminal rendering is distorted.
    console.log("=========================================");
    console.log("RAW QR STRING (Copy this if terminal fails):");
    console.log(qr);
    console.log("=========================================");
    qrcode.generate(qr, { small: true });
  });

  client.on("authenticated", () => {
    console.log("✅ WhatsApp Authenticated!");
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp Bot is READY!");
    state.resolveReady?.();
  });
}

function recreateReadyPromise(state: WhatsAppState): void {
  let resolveReady: (() => void) | null = null;
  state.readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  state.resolveReady = resolveReady;
}

async function forceReinitializeWhatsAppClient(): Promise<Client> {
  const state = getState();
  const oldClient = state.client;
  state.client = null;
  state.initPromise = null;
  state.listenersBound = false;
  recreateReadyPromise(state);

  if (oldClient) {
    try {
      await oldClient.destroy();
    } catch {
      // Ignore teardown errors during forced recovery.
    }
  }

  return initializeWhatsAppClient();
}

export async function initializeWhatsAppClient(): Promise<Client> {
  const state = getState();
  if (state.client) return state.client;
  if (state.initPromise) return state.initPromise;

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: "mobcash-go-bot" }),
    puppeteer: {
      headless: true,
      executablePath: PUPPETEER_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });
  bindEvents(client, state);

  state.initPromise = (async () => {
    await client.initialize();
    state.client = client;
    return client;
  })();

  return state.initPromise;
}

function formatMoroccanToWhatsAppJid(phone: string): string {
  const raw = String(phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  let normalized = digits;

  if (normalized.startsWith("00")) normalized = normalized.slice(2);
  if (normalized.startsWith("0")) normalized = `212${normalized.slice(1)}`;
  if (!normalized.startsWith("212")) normalized = `212${normalized}`;

  return `${normalized}@c.us`;
}

function buildArabicCredentialsMessage(
  username: string,
  password: string,
  goSportId: string,
): string {
  return [
    "مرحباً بك في منصتنا!",
    "تم تفعيل حسابك بنجاح على GoSport365 بطلب من الوكيل الخاص بك.",
    "",
    "🔐 **بيانات الدخول:**",
    `اسم المستخدم: *${username}*`,
    `كلمة المرور: *${password}*`,
    "",
    "🆔 **معرف الشحن الخاص بك (ID):**",
    `رقم الحساب: *${goSportId}*`,
    "",
    "⚠️ **تنويه هام جداً:** عند تقديم أي طلب شحن رصيد مستقبلاً، يرجى إدخال **رقم الحساب (ID)** الخاص بك الموضح أعلاه بدلاً من اسم المستخدم، وذلك لضمان معالجة طلبك وشحنه آلياً في جزء من الثانية وبدون أخطاء.",
    "",
    "رابط تسجيل الدخول: https://www.gosport365.com/en/login",
  ].join("\n");
}

function normalizeGoSportId(goSportId: string | number | undefined): string {
  const s = String(goSportId ?? "").trim();
  if (!s) return "غير متوفر حالياً";
  return s;
}

export async function sendWhatsAppCredentials(
  phone: string,
  username: string,
  password: string,
  goSportId: string | number | undefined,
): Promise<void> {
  const safeUsername = String(username ?? "").trim();
  const safePassword = String(password ?? "");
  const safeGoSportId = normalizeGoSportId(goSportId);
  if (!safeUsername || !safePassword) {
    throw new Error("Missing credentials for WhatsApp message.");
  }

  const client = await initializeWhatsAppClient();
  const state = getState();
  const jid = formatMoroccanToWhatsAppJid(phone);
  const message = buildArabicCredentialsMessage(safeUsername, safePassword, safeGoSportId);

  if (state.readyPromise) {
    await state.readyPromise;
  }
  try {
    await client.sendMessage(jid, message);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error ?? "");
    const transientCrash = msg.includes("detached Frame") || msg.includes("Target closed");
    if (!transientCrash) {
      throw error;
    }

    await client.destroy().catch(() => {});
    const recoveredState = getState();
    recoveredState.client = null;
    recoveredState.listenersBound = false;
    recoveredState.initPromise = null;
    recreateReadyPromise(recoveredState);

    const recoveredClient = await initializeWhatsAppClient();
    const retryState = getState();
    if (retryState.readyPromise) {
      await retryState.readyPromise;
    }
    await recoveredClient.sendMessage(jid, message);
  }
}

export async function sendWhatsAppNotification(phone: string, message: string): Promise<void> {
  const safeMessage = String(message ?? "").trim();
  if (!safeMessage) {
    throw new Error("Missing WhatsApp notification message.");
  }

  const client = await initializeWhatsAppClient();
  const state = getState();
  const jid = formatMoroccanToWhatsAppJid(phone);

  if (state.readyPromise) {
    await state.readyPromise;
  }
  try {
    await client.sendMessage(jid, safeMessage);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error ?? "");
    const transientCrash = msg.includes("detached Frame") || msg.includes("Target closed");
    if (!transientCrash) {
      throw error;
    }

    await client.destroy().catch(() => {});
    const recoveredState = getState();
    recoveredState.client = null;
    recoveredState.listenersBound = false;
    recoveredState.initPromise = null;
    recreateReadyPromise(recoveredState);

    const recoveredClient = await initializeWhatsAppClient();
    const retryState = getState();
    if (retryState.readyPromise) {
      await retryState.readyPromise;
    }
    await recoveredClient.sendMessage(jid, safeMessage);
  }
}
