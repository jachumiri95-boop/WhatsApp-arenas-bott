# WhatsApp ARENAS Bot

Responde al mensaje `ARENAS` con el contenido que pueda extraer de NullGuide Arena Session: https://nullguide.com/arenaSession/

## Subir a GitHub
1. Descarga y descomprime este ZIP.
2. Abre el repositorio `WhatsApp-arenas-bott`.
3. Pulsa **Add file → Upload files**.
4. Arrastra los archivos de esta carpeta (no solo el ZIP).
5. Pulsa **Commit changes**.

## Despliegue
Despliega el repositorio desde Railway, añade un volumen persistente montado en `/data` y ejecuta `npm start`. Abre los logs: cuando aparezca el QR, escanéalo desde WhatsApp → Dispositivos vinculados.

El número que se vincule al escanear el QR será el número del bot; no basta con escribir un número en la configuración. No compartas el QR ni los archivos de sesión.

## Avisos
Baileys es una librería no oficial que usa WhatsApp Web; WhatsApp puede restringir su uso o cambiar su funcionamiento. La página de NullGuide podría cargar los datos con JavaScript, en cuyo caso habrá que adaptar el extractor. No se ha confirmado una API oficial de NullGuide.
