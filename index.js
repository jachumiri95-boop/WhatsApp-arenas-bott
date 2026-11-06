import { createRequire } from "node:module";
import pino from "pino";
import qrcode from "qrcode-terminal";
import * as cheerio from "cheerio";
import fs from "node:fs/promises";

// Baileys publica su socket mediante CommonJS/default export.
// createRequire evita problemas de interoperabilidad ESM/CommonJS.
const require = createRequire(import.meta.url);
const baileysModule = require("@whiskeysockets/baileys");
const baileys = baileysModule?.default ?? baileysModule;
const makeWASocket =
  (typeof baileysModule === "function" && baileysModule) ||
  (typeof baileysModule?.default === "function" && baileysModule.default) ||
  (typeof baileys?.default === "function" && baileys.default) ||
  (typeof baileys?.makeWASocket === "function" && baileys.makeWASocket);

const useMultiFileAuthState =
  baileysModule?.useMultiFileAuthState ??
  baileys?.useMultiFileAuthState;
const DisconnectReason =
  baileysModule?.DisconnectReason ??
  baileys?.DisconnectReason;
const fetchLatestWaWebVersion =
  baileysModule?.fetchLatestWaWebVersion ??
  baileys?.fetchLatestWaWebVersion;

if (typeof makeWASocket !== "function") {
  throw new TypeError(
    `Baileys no exportó makeWASocket como función. Exportaciones: ${Object.keys(baileysModule ?? {}).join(", ")}`
  );
}
if (typeof useMultiFileAuthState !== "function") {
  throw new TypeError("Baileys no exportó useMultiFileAuthState como función.");
}
if (typeof fetchLatestWaWebVersion !== "function") {
  throw new TypeError("Esta versión de Baileys no incluye fetchLatestWaWebVersion; revisa la dependencia instalada.");
}

const ARENA_URL = "https://nullguide.com/arenaSession/";
const AUTH_DIR = process.env.AUTH_DIR || "/data/auth_info";
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
let reconnecting = false;

async function getArenaInfo() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(ARENA_URL, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; ArenaSessionBot/1.0)" }
    });
    if (!response.ok) throw new Error(`NullGuide respondió HTTP ${response.status}`);

    const $ = cheerio.load(await response.text());
    $("script,style,noscript,svg,nav,footer,header").remove();
    const pageText = $("body").text().replace(/\s+/g, " ").trim();
    const start = pageText.toLowerCase().indexOf("arena session");
    if (start < 0 || pageText.length < 80) {
      throw new Error("No se pudo extraer el contenido de Arena Session; la página podría cargarlo con JavaScript.");
    }
    return `🏟️ ARENA SESSION — NULLGUIDE\n\n${pageText.slice(start, start + 4500)}\n\nFuente: ${ARENA_URL}`;
  } finally {
    clearTimeout(timer);
  }
}

async function start() {
  await fs.mkdir(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  // Obtiene la versión real vigente de WhatsApp Web para evitar rechazos 405.
  const { version } = await fetchLatestWaWebVersion();
  logger.info({ version }, "Versión actual de WhatsApp Web obtenida.");
  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    browser: ["ArenaSessionBot", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\nEscanea desde WhatsApp > Dispositivos vinculados > Vincular dispositivo:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      reconnecting = false;
      logger.info("Bot conectado a WhatsApp.");
    }

    if (connection === "close" && !reconnecting) {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason?.loggedOut) {
        reconnecting = true;
        logger.warn({ code }, "Conexión cerrada; intentando reconectar en 3 segundos.");
        setTimeout(() => {
          reconnecting = false;
          start().catch(err => logger.error({ err }, "Error al reconectar"));
        }, 3000);
      } else {
        logger.error("Sesión cerrada desde WhatsApp. Borra /data/auth_info solo si deseas vincular de nuevo.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe || msg.key.remoteJid === "status@broadcast") continue;
      const body = msg.message.conversation
        || msg.message.extendedTextMessage?.text
        || msg.message.imageMessage?.caption
        || msg.message.videoMessage?.caption
        || "";
      if (body.trim().toUpperCase() !== "ARENAS") continue;

      const jid = msg.key.remoteJid;
      try {
        await sock.sendMessage(jid, { text: "⏳ Consultando Arena Session..." });
        await sock.sendMessage(jid, { text: await getArenaInfo() });
      } catch (err) {
        logger.error({ err }, "No se pudo consultar Arena Session");
        await sock.sendMessage(jid, {
          text: `No pude obtener los datos ahora. ${err.message}\nFuente: ${ARENA_URL}`
        });
      }
    }
  });
}

start().catch(err => {
  logger.error({ err }, "No se pudo iniciar el bot");
  process.exit(1);
});
