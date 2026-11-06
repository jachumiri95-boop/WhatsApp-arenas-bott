# WhatsApp Arenas Bot — v1.0.3

Bot de WhatsApp que responde al mensaje `ARENAS` consultando https://nullguide.com/arenaSession/.

## Archivos
- `index.js`: conexión Baileys, generación de QR y comando ARENAS.
- `package.json`: dependencias fijadas.

## Railway
1. Sube/reemplaza `index.js` y `package.json` en la raíz del repositorio GitHub.
2. Mantén el volumen existente montado en `/data`. **No borres `/data/auth_info` ni recrees el volumen.**
3. Railway debe ejecutar `npm install` y luego `npm start` (Start Command: `npm start`).
4. En Deploy Logs busca `QR DE WHATSAPP`.
5. En WhatsApp: Configuración > Dispositivos vinculados > Vincular dispositivo y escanea el QR.

## Variables opcionales
- `AUTH_DIR`: por defecto `/data/auth_info`.
- `LOG_LEVEL`: por defecto `info`.
- `WA_WEB_VERSION`: opcional, formato `2,3000,123456789`. Déjala sin configurar para que Baileys consulte la versión actual de WhatsApp Web.

**Importante:** este bot usa una integración no oficial (Baileys), no requiere Meta Developer, pero puede verse afectado por cambios de WhatsApp y está sujeto a sus condiciones de uso.
