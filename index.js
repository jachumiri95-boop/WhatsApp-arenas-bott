import * as baileys from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import * as cheerio from "cheerio";
import fs from "node:fs/promises";

const makeWASocket = [
  baileys.default?.default,
  baileys.default,
  baileys.makeWASocket,
  baileys.default?.makeWASocket
].find(value => typeof value === "function");

if (!makeWASocket) {
  throw new Error(`No se encontró makeWASocket. Exportaciones: ${Object.keys(baileys).join(", ")}`);
}
const { DisconnectReason, useMultiFileAuthState } = baileys;

const URL = "https://nullguide.com/arenaSession/";
const AUTH_DIR = process.env.AUTH_DIR || "/data/auth_info";
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

async function getArenaInfo() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(URL, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; ArenaSessionBot/1.0)" }
    });
    if (!response.ok) throw new Error(`NullGuide respondió HTTP ${response.status}`);
    const $ = cheerio.load(await response.text());
    $("script,style,noscript,svg,nav,footer,header").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();
    const start = text.toLowerCase().indexOf("arena session");
    if (start < 0 || text.length < 80) {
      throw new Error("No se pudo extraer el contenido. NullGuide podría cargarlo mediante JavaScript.");
    }
    return `🏟️ ARENA SESSION — NULLGUIDE\n\n${text.slice(start, start + 4500)}\n\nFuente: ${URL}`;
  } finally { clearTimeout(timer); }
}

async function start() {
  await fs.mkdir(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const sock = makeWASocket({
    auth: state, logger, printQRInTerminal: false,
    syncFullHistory: false, markOnlineOnConnect: false,
    browser: ["ArenaSessionBot", "Chrome", "1.0.0"]
  });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\nEscanea desde WhatsApp > Dispositivos vinculados:\n");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") logger.info("Bot conectado a WhatsApp.");
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(() => start().catch(err => logger.error(err)), 3000);
      } else logger.error("Sesión cerrada; vuelve a vincular el dispositivo.");
    }
  });
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe || msg.key.remoteJid === "status@broadcast") continue;
      const body = msg.message.conversation
        || msg.message.extendedTextMessage?.text
        || msg.message.imageMessage?.caption || "";
      if (body.trim().toUpperCase() !== "ARENAS") continue;
      const jid = msg.key.remoteJid;
      try {
        await sock.sendMessage(jid, { text: "⏳ Consultando Arena Session..." });
        await sock.sendMessage(jid, { text: await getArenaInfo() });
      } catch (err) {
        logger.error(err);
        await sock.sendMessage(jid, { text: `No pude obtener los datos ahora. ${err.message}\nFuente: ${URL}` });
      }
    }
  });
}
start().catch(err => { logger.error(err); process.exit(1); });
