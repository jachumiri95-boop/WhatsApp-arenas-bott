BOT WHATSAPP ARENAS — CORRECCIÓN 1.0.2

1. En GitHub abre el repositorio WhatsApp-arenas-bott.
2. Reemplaza index.js y package.json en la raíz por los de este ZIP.
3. Guarda los cambios en la rama main. Railway detectará el commit y desplegará automáticamente.
4. Cuando el bot arranque, revisa los registros de Railway para escanear el QR desde WhatsApp > Dispositivos vinculados > Vincular dispositivo.

Esta versión actualiza Baileys a 6.7.24 y consulta la versión vigente de WhatsApp Web al iniciar para evitar el rechazo 405 por protocolo obsoleto. Conserva la sesión persistente en /data/auth_info.
