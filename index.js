import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';

const ARENA_URL = 'https://nullguide.com/arenaSession/';
const AUTH_DIR = process.env.AUTH_DIR || '/data/auth_info';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
let reconnectTimer = null;
let currentSocket = null;
let isStarting = false;

function parseVersionOverride(value) {
  if (!value) return null;
  const parts = value.split(',').map(part => Number(part.trim()));
  if (parts.length !== 3 || parts.some(n => !Number.isInteger(n) || n <= 0)) {
    throw new Error('WA_WEB_VERSION debe tener formato: 2,3000,123456789');
  }
  return parts;
}

async function resolveWhatsAppVersion() {
  const override = parseVersionOverride(process.env.WA_WEB_VERSION);
  if (override) {
    logger.info({ version: override, source: 'environment' }, 'Usando versión configurada de WhatsApp Web.');
    return override;
  }

  const result = await fetchLatestWaWebVersion();
  if (!Array.isArray(result?.version) || result.version.length !== 3) {
    throw new Error('WhatsApp no devolvió una versión Web válida.');
  }
  logger.info({ version: result.version, isLatest: result.isLatest }, 'Versión de WhatsApp Web obtenida.');
  return result.version;
}

async function getArenaInfo() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(ARENA_URL, {
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ArenaSessionBot/1.0)' }
    });
    if (!response.ok) throw new Error(`NullGuide respondió HTTP ${response.status}`);

    const $ = cheerio.load(await response.text());
    $('script,style,noscript,svg,nav,footer,header').remove();
    const pageText = $('body').text().replace(/\s+/g, ' ').trim();
    const start = pageText.toLowerCase().indexOf('arena session');
    if (start < 0 || pageText.length < 80) {
      throw new Error('No se pudo extraer el contenido de Arena Session; la página podría cargarlo con JavaScript.');
    }
    return `🏟️ ARENA SESSION — NULLGUIDE\n\n${pageText.slice(start, start + 4500)}\n\nFuente: ${ARENA_URL}`;
  } finally {
    clearTimeout(timer);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startBot().catch(error => logger.error({ err: error }, 'No se pudo reiniciar el bot.'));
  }, 5000);
}

async function startBot() {
  if (isStarting) return;
  isStarting = true;
  try {
    await fs.mkdir(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const version = await resolveWhatsAppVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      browser: ['ArenaSessionBot', 'Chrome', '1.0.3'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });
    currentSocket = sock;

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log('\n===== QR DE WHATSAPP: ESCANEA DESDE DISPOSITIVOS VINCULADOS =====\n');
        qrcode.generate(qr, { small: true });
        console.log('\n================================================================\n');
      }

      if (connection === 'open') {
        logger.info('✅ BOT CONECTADO A WHATSAPP.');
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        logger.warn({ code }, 'Conexión de WhatsApp cerrada.');
        currentSocket = null;
        if (code === DisconnectReason.loggedOut) {
          logger.error('La sesión fue cerrada desde WhatsApp. Para vincular de nuevo, elimina manualmente los archivos de sesión solo si así lo deseas.');
          return;
        }
        scheduleReconnect();
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;
        const body = msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || msg.message.imageMessage?.caption
          || msg.message.videoMessage?.caption
          || '';
        if (body.trim().toUpperCase() !== 'ARENAS') continue;

        const jid = msg.key.remoteJid;
        try {
          await sock.sendMessage(jid, { text: '⏳ Consultando Arena Session...' });
          await sock.sendMessage(jid, { text: await getArenaInfo() });
        } catch (error) {
          logger.error({ err: error }, 'No se pudo consultar Arena Session.');
          await sock.sendMessage(jid, {
            text: `No pude obtener los datos ahora. ${error.message}\nFuente: ${ARENA_URL}`
          });
        }
      }
    });
  } finally {
    isStarting = false;
  }
}

process.on('uncaughtException', error => logger.error({ err: error }, 'Error no controlado.'));
process.on('unhandledRejection', error => logger.error({ err: error }, 'Promesa rechazada.'));

startBot().catch(error => {
  logger.error({ err: error }, 'No se pudo iniciar el bot.');
  process.exit(1);
});
