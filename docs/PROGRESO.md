# Bitácora de fases

Registro de lo hecho en cada fase, las desviaciones respecto a `ESPECIFICACION.md` (y por qué) y los contratos modificados.

---

## Fase 0 — Base del proyecto y estructura

**Estado:** completada. `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores ni advertencias.

### Qué se hizo

- **Proyecto:** electron-vite (React + TypeScript `strict`), alias `@os/sdk`, `@os/ui` y `@system` (en Vite y en `tsconfig.web.json`), scripts `dev`, `build`, `typecheck`, `lint` (más `preview`).
- **Seguridad (3.4):** `contextIsolation`, `sandbox`, sin `nodeIntegration`; CSP por cabecera (con las excepciones de Vite solo en desarrollo); bloqueo de `will-navigate`, `window.open` y `webview`; permisos concedidos solo para `media` y solo al origen propio; `askForMediaAccess` en macOS; ventana 1440×900 (mínimo 1024×700), sin barra de menú nativa, pantalla completa según `os.config.json`.
- **Puente nativo (4.1):** tipos en `src/shared/native-api.ts`, implementación en `preload` y handlers en `main/ipc/{files,auth,power}.ts`. Los handlers validan la entrada y comprueban que el remitente sea una página propia (`ipc/trust.ts`). Contraseñas con `crypto.scrypt` (N=16384, r=8, p=1, clave de 64 bytes, sal de 16 bytes, comparación con `timingSafeEqual`).
- **`system/`:** `os.config.json`, `theme/tokens.css` (claro y oscuro con `light-dark()`, controlado por `data-theme`), `boot/logo.svg`, los 12 íconos del sistema, 5 fondos (`aurora`, `dusk`, `ocean`, `graphite`, `meadow`) y la carpeta `sounds/` vacía.
- **17 apps** con `meta/manifest.json` + `icon.svg` originales y un `src/index.tsx` provisional (`EmptyState` "Disponible pronto").
- **4 widgets** (`clock`, `calendar` con `ownerApp: "calendar"`, `quick-note`, `system-status`) con el mismo formato.
- **Registro con descubrimiento automático (4.6):** `kernel/apps/manifest.schema.ts` (Zod, esquemas estrictos, mensajes en español) y `kernel/apps/registry.ts` (`import.meta.glob`). Una app o widget se omite, con un `console.error` que indica la carpeta y el campo, si: falta el manifiesto, el manifiesto es inválido (incluidas claves desconocidas), `id` ≠ nombre de carpeta, no existe el ícono declarado o falta `src/index.tsx`. Una `cover` declarada pero inexistente solo avisa.
- **Pantalla temporal** (`os/shell/temp/AppListScreen`): lista apps (ordenadas por `launchpad.order`) y widgets con ícono, nombre y descripción. Se elimina en la Fase 2.
- **ESLint (3.3):** ver "Desviaciones". `CLAUDE.md` actualizado con los comandos.

### Verificación (lista de la fase)

| Punto | Resultado |
|---|---|
| La app abre | Sí, en `npm run dev` y con el build (`file://`). Comprobado arrancando Electron y consultándolo por el protocolo de depuración (CDP). |
| La pantalla muestra 17 apps con su ícono | Sí: 17 apps y 4 widgets, 0 imágenes rotas, Inter cargada. |
| Cambiar `name` en un manifiesto se refleja | Sí, en caliente (HMR). |
| Manifiesto inválido se omite con error claro | Sí. Probado con categoría inválida, tipo erróneo, clave desconocida, `id` distinto de la carpeta, ícono inexistente, `minWidth` > `width` y permiso inválido. |
| `lint` falla si una app importa de `os/kernel` | Sí. Probado también con: app→otra app, app→`@system`/`dexie`/`node:*`, widget→app, kernel→shell/ui, shell→sdk, ui→sdk, Dexie fuera de `kernel/storage` y `window.native` fuera de `kernel`. Los casos permitidos no se marcan. |
| Sin advertencias de seguridad de Electron en la consola | Sí, en desarrollo no aparece ninguna. |

Comprobaciones adicionales hechas sobre el build: la CSP bloquea scripts en línea, `fetch` e imágenes externas; `require`/`process` no existen en la página; la navegación a un sitio externo y `window.open` quedan bloqueados; `hashPassword`/`verifyPassword` funcionan de ida y vuelta (y rechazan entradas no válidas).

No se pudo probar en macOS ni Windows: el menú mínimo de macOS (`main/menu.ts`) y `askForMediaAccess` están sin ejecutar.

### Desviaciones respecto a la especificación

La especificación se actualizó en los puntos 1 a 4 (secciones 3.1, 3.3 y 4.3).

1. **Carpetas nuevas en el kernel:** `kernel/config/` (lee y valida `os.config.json`, necesario para no escribir el nombre del SO a mano) y `kernel/validation/` (idioma de Zod y formato de errores, compartido por config y manifiestos).
2. **Tabla MIME en `src/shared/mime.ts`** en vez de `kernel/fs/mime.ts`: `main` también devuelve `mime` en `importFromHost` y duplicar la tabla rompía la regla de "tabla única". **En la Fase 1, `kernel/fs/mime.ts` debe reexportar este archivo.**
3. **Regla local de ESLint** (`eslint/local-plugin.mjs`, `local/layer-boundaries`) además de `no-restricted-imports`: este último no puede saber si un import relativo sale de la carpeta de la app. `no-restricted-imports` se usa para los paquetes externos de apps y widgets (lista permitida: `react`, `react-dom`, `lucide-react`, `zustand`, `@os/sdk`, `@os/ui`). La regla local cubre el resto de la sección 3.2. `window.native` se prohíbe con `no-restricted-syntax`.
4. **`IPC_CHANNELS`** (nombres de canales) se exporta desde `src/shared/native-api.ts` junto con los tipos, para que `main` y `preload` no repitan cadenas.
5. **`os/shell/temp/`** para la pantalla temporal (la especificación no le daba carpeta).
6. **Dependencias fuera de la lista de la sección 2**, necesarias para cumplir la fase:
   - `vite` y `@vitejs/plugin-react`: los requiere electron-vite para el renderer con React.
   - `@types/node`, `@types/react`, `@types/react-dom`: tipos.
   - `@eslint/js`, `typescript-eslint`: base de ESLint para TypeScript.
   - `eslint-plugin-react-hooks`: reglas de hooks de React.
   - Se instalaron además todas las dependencias de la sección 2 aunque `dexie`, `zustand` y `lucide-react` aún no se usan, para no tocar `package.json` en cada fase.
7. **TypeScript fijado en `~6.0.3`**: la última versión (7.x) no es compatible aún con `typescript-eslint` (exige `<6.1`). Con TS 6 `types` ya no se infiere solo, por eso cada `tsconfig` lista los suyos.
8. **Preload en CommonJS** (configurado en `electron.vite.config.ts`): el preload con `sandbox: true` no admite ESM.
9. **`assetsInlineLimit: 0`** en el renderer: la CSP del spec no permite `data:` en `font-src`, así que ningún recurso se incrusta.
10. **Menú mínimo en macOS** (`main/menu.ts`): macOS no entrega Cmd+C/V a los campos de texto sin un menú de Edición con roles, y la especificación exige que el copiar/pegar nativo siga funcionando. En Linux y Windows el menú se elimina por completo.
11. **Atajo de DevTools solo en desarrollo** (F12 / Ctrl+Shift+I), porque sin menú nativo no hay otra forma de abrirlas.
12. **Título de la ventana:** `index.html` no tiene título (para no escribir el nombre del SO a mano); `main` lo fija desde `os.config.json`, y `main.tsx` también asigna `document.title`.

### Decisiones de datos que conviene conocer

- **Asociaciones de archivo:** `image-viewer` es `viewer` de imágenes con prioridad 10 y `paint` es `editor` de `png` con prioridad 5, de modo que el Visor sea la app predeterminada y Paint salga en "Abrir con…" (lo que pide la verificación de la Fase 5). `ogg` lo declaran Música (prioridad 10) y Videos (prioridad 5): por defecto se abre como audio.
- **Anclado inicial en el Dock:** `files`, `text-editor`, `terminal`, `settings`, `calendar`, `notes`, `music`, `camera`. El resto no está anclado.
- Los manifiestos no declaran `cover` (opcional) y no hay `help.md` ni `theme.css`: la portada y la ayuda llegan en la Fase 6.
- `os.config.json` define 6 redes simuladas; las protegidas llevan contraseña en claro porque son datos de simulación.
- `os.config.json` se importa también desde `main` (`startFullscreen`, nombre de la ventana), así que **cambiarlo exige recompilar**.

### Contratos modificados

- 4.3: la ubicación de la tabla MIME pasa de `kernel/fs/mime.ts` a `src/shared/mime.ts` (reexportada por `kernel/fs/mime.ts`). Sin cambios en la firma de `FsApi` ni en ningún otro contrato.

### Para la Fase 1

- `kernel/fs/mime.ts` reexporta `src/shared/mime.ts`.
- `window.native` ya está tipado en `src/renderer/src/env.d.ts`; solo `os/kernel` puede usarlo (el lint lo hace cumplir).
- `@os/sdk` solo exporta tipos de manifiesto; `useOS()` y los hooks se añaden con los servicios del kernel.
- Aplicar el tema: poner `data-theme="light|dark|auto"` en `<html>` y `--color-accent` desde `appearance.accent`.

---

## Fase 1 — Núcleo y sesión

**Estado:** completada. `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores ni advertencias.

### Qué se hizo

**Kernel** (`src/renderer/src/os/kernel/`):

- **`events`:** bus tipado (`on`, `emit`) con el mapa de la sección 4.4. Un manejador que falla no impide que los demás reciban el evento.
- **`storage`:** único módulo que importa Dexie. Base `simos`, esquema versión 1 con las 7 tablas de la sección 4.2 y el índice único `[parentId+name]`. Expone un objeto tipado por tabla y `transaction()`.
- **`fs`:** `FsApi` completa (4.3): rutas absolutas y `~`, errores `FsError` con código Unix y mensaje en español, sufijos `(2)`, papelera con restauración, importación desde el equipo, URLs de objeto, `usage`. Cada operación que modifica emite `fs:changed` **después** de confirmar la transacción. `createInitialTree()` crea el árbol de la sección 4.3 y siembra `Bienvenida.txt`.
- **`settings`:** claves, validación Zod y valores por defecto en `settings/schema.ts`; `get`, `set`, `reset`, `subscribe`, `load`, `persistAll`; hook `useSettingValue`.
- **`sound`:** los 11 sonidos fijos. Busca `system/sounds/<nombre>.{mp3,ogg,wav}` y, si no existe, genera el sonido con Web Audio. Respeta `sound.volume`, `sound.muted` y `sound.systemSounds` (solo `alarm` y `shutter` suenan con los sonidos del sistema apagados). Expone el volumen efectivo y `subscribeVolume`.
- **`notifications`:** servicio (publicar, descartar, listar, suscribirse) sin interfaz; publica `notification:posted`.
- **`scheduler`:** revisa `scheduled` cada segundo mientras hay sesión; dispara una vez lo vencido al iniciar sesión; repeticiones `daily` y `weekdays`.
- **`processes`:** 8 procesos ficticios del sistema más las instancias de apps (siguen `app:launched` y `app:terminated`), con CPU y memoria simuladas, suaves y deterministas.
- **`network`:** 6 redes de `os.config.json`; conectar (con contraseña), desconectar, olvidar, activar o apagar el wifi.
- **`media`:** envuelve `getUserMedia`; exige el permiso del manifiesto, cuenta los streams por tipo, publica `media:active` y detiene los streams de una instancia cuando termina.
- **`session`:** fases `boot → setup/login → desktop ⇄ locked → shutdown`; arranque, asistente, inicio de sesión, bloqueo, cierre de sesión, reinicio y apagado.
- **Auxiliares:** `native.ts` (único acceso a `window.native`), `appearance` (fondos y avatares incluidos, descubiertos con `import.meta.glob`).

**Shell** (`src/renderer/src/os/shell/`): `boot` (logo y barra de progreso durante `bootDurationMs`), `setup` (asistente: bienvenida → nombre → contraseña con confirmación → avatar → tema claro/oscuro con vista previa en vivo), `login` (pantalla de inicio y de bloqueo con hora y fecha grandes; el campo aparece con un clic o una tecla; sacudida y sonido `error` si la contraseña es incorrecta), `power` (pantalla "Apagando…"), más `theme`, `wallpaper` y `common`. `Shell.tsx` elige la pantalla según la fase; con la pantalla bloqueada el escritorio sigue montado pero inerte.

**`@os/ui`:** `Button` y `TextField` (los necesitan el asistente y el inicio de sesión).

**Recursos nuevos:** 8 avatares en `system/avatars/`, tokens de arranque, bloqueo y apagado en `tokens.css`.

**Pantalla temporal:** ahora muestra el usuario, botones Bloquear / Cerrar sesión / Reiniciar / Apagar y la carpeta de inicio (`~`) en vivo. Se elimina en la Fase 2.

### Verificación (lista de la fase)

Todo se probó ejecutando Electron con un directorio de datos aislado (`--user-data-dir`) y controlándolo por el protocolo de depuración. En desarrollo se importaron los módulos reales del kernel desde la página para probar los servicios; ~130 comprobaciones, 0 fallos.

| Punto | Resultado |
|---|---|
| Primer arranque crea usuario y árbol | Sí: usuario, las 6 carpetas de inicio con sus subcarpetas, `.Papelera` oculta, `Bienvenida.txt`, y todos los ajustes guardados. |
| Al reiniciar Electron se pide contraseña (no el asistente) | Sí, probado con el build (`file://`): cierre limpio y segundo arranque con los mismos datos. |
| Contraseña con hash y sal, nunca en claro | Sí: `passwordHash` de 128 hex y `salt` de 32 hex en el registro guardado; la contraseña no aparece en él. |
| Bloquear y desbloquear | Sí, con contraseña incorrecta (sacudida, mensaje y campo vacío) y correcta. También cerrar sesión, reiniciar (vuelve al arranque) y apagar (Electron se cierra). |
| Los sonidos suenan aunque no existan archivos | Los 11 se ejecutan sin error con el sintetizador y el `AudioContext` arranca sin gesto del usuario. **No pude escucharlos**: conviene que los oigas. La ruta con archivo real (un `.wav` temporal) también se probó y se eliminó. |
| Los datos persisten al cerrar y abrir | Sí (usuario, tema, árbol). |

Comprobaciones adicionales: errores de FS (`ENOENT`, `EEXIST`, `ENOTDIR`, `EISDIR`, `EINVAL`, `EPERM`), nombres inválidos, sufijos al duplicar/copiar/mover/restaurar, restauración con el padre eliminado o en la papelera, reversión de una transacción que falla, programador (disparo a tiempo, vencidos una sola vez, reprogramación diaria y laboral), procesos, red, notificaciones, guardas de fin de sesión, y la validación de entradas del manejador `importFromHost` del proceso principal (con el diálogo nativo sustituido).

**Sin probar:** la mitad de `fs.importFromHost` que corre en el renderer (el puente no se puede reemplazar desde la página; sí se probó el manejador del proceso principal y la lógica de nombres es la misma que en copiar y duplicar); la pantalla de error de arranque con "Reintentar"; macOS y Windows.

Durante las pruebas se abrieron brevemente la cámara y el micrófono reales del equipo (`media`), y se cerraron.

### Desviaciones y decisiones

1. **Contrato 4.2:** `nodes.trash` incluye `originalName`. Si dos elementos con el mismo nombre acaban en la papelera hay que renombrar uno, y sin el nombre original no se podría restaurar. La especificación se actualizó (4.2 y 4.3).
2. **`system/avatars/` y `kernel/appearance`:** la especificación habla de "íconos incluidos" para el avatar pero solo define `avatar-default.svg`. Se añaden 8 avatares (id = nombre del archivo). Si el avatar guardado ya no existe se usa `avatar-default`.
3. **Papelera:** el elemento eliminado es hijo directo de `.Papelera` (su contenido se mueve con él y solo ese nodo lleva `trash`). `list('/.Papelera')` devuelve vacío; se usa `listTrash()`. Escribir, renombrar o mover dentro de la papelera da `EPERM`. `deletePermanently` solo acepta elementos de la papelera.
4. **Eventos `fs:changed`:** en `trash`, `parentId` es la papelera y `oldParentId` la carpeta de origen; en `restore` es al revés; en `delete`, `parentId` es la carpeta que lo contenía. Así quien observa una carpeta sabe que debe refrescarse.
5. **Programador:** a nivel del kernel recibe `appId` como primer parámetro (`scheduler.schedule(appId, job)`); el SDK de la Fase 2 lo oculta. Al dispararse, la notificación lleva `launchArgs: { jobId, payload }`. Las repeticiones calculan en hora local del sistema; `datetime.timezone` solo afectará a cómo se muestran las horas. Un aviso `weekdays` cuyo `fireAt` cae en fin de semana se dispara igualmente esa vez.
6. **Red:** el sistema arranca conectado a la primera red de `os.config.json` (`Casa_5G`, ya "conocida"). La especificación no fijaba un valor inicial.
7. **Sesión:** tras el asistente se inicia sesión directamente. Reiniciar no pasa por "Reiniciando…": vuelve al arranque. El paso de "cambios sin guardar" queda como **guardas** (`session.registerSessionEndGuard`) que se ejecutan antes de cerrar sesión, reiniciar o apagar; si una devuelve `false`, la acción se cancela. La Fase 2 registrará ahí el recorrido por las ventanas. Bloquear no ejecuta guardas (no cierra nada).
8. **Ajustes al terminar el asistente:** se guardan **todos** los valores (no solo el tema), de modo que, por ejemplo, `dock.pinned` no cambie si luego se instala una app con `pinnedByDefault`.
9. **`autoplayPolicy: 'no-user-gesture-required'`** en la ventana: sin ella Chromium silencia el sonido de arranque.
10. **CSP y `blob:`:** la CSP de la especificación no permite `fetch()` sobre URLs `blob:` (no están en `connect-src`). Las apps deben leer datos con `fs.readFile`/`readText` y usar `getObjectUrl` solo en el `src` de imágenes y medios. No se modificó la CSP.
11. **Datos de desarrollo y de producción por separado:** IndexedDB es por origen, y `npm run dev` corre en `http://localhost:5173` mientras que el build corre en `file://`. Un usuario creado en uno no existe en el otro.
12. **Hooks en el kernel** (`useSettingValue`, `useSession`): son envoltorios de las stores, sin interfaz. El SDK los reexpondrá como `useSetting`, etc.

### Para la Fase 2

- Registrar en `session.registerSessionEndGuard` el recorrido por las ventanas con `isDirty`.
- Emitir `app:launched` y `app:terminated` desde el gestor de ventanas: `processes` y `media` ya escuchan esos eventos.
- Reemplazar la pantalla temporal por el escritorio. `Shell.tsx` ya monta el escritorio bajo la pantalla de bloqueo con `inert`; los botones de energía pasan al menú del sistema (`session.lock/logout/restart/shutdown`).
- Mostrar `notifications` como avisos emergentes (el servicio ya los guarda; la interfaz los descarta a los 5 s).
- La lista de fondos y avatares ya está en `kernel/appearance` para Configuración (Fase 3).

---

## Fase 2 — Shell y ventanas

**Estado:** completada. `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores ni advertencias. La pantalla temporal se eliminó y el botón de prueba de `isDirty` se quitó del Editor de texto.

### Qué se hizo

**Kernel nuevo**
- **`windows`:** almacén de ventanas (`WindowState` de 4.10 más lo necesario para el marco), foco y apilamiento, minimizar hacia el ícono del Dock, maximizar sobre la zona libre (entre la barra de menú y el Dock, que ambos le comunican), cascada de posiciones, cierre con animación. Emite `window:*` y `app:launched` / `app:terminated`.
- **`dialogs`:** cola de diálogos con dos ámbitos (hoja de una ventana o modal de sistema). Mantiene `hasSheet` de cada ventana y cancela los diálogos de una ventana que se cierra. `dialogs/unsaved.ts` es el flujo único de cambios sin guardar.
- **`apps/launcher`** (lanzador) y **`apps/associations`** (asociaciones de archivo): instancia única con entrega de archivos (`useOpenFileHandler`), `openFile`, app predeterminada por extensión (`fileAssociations.defaults` o mayor `priority`), "Elegir siempre esta app".
- **`menus`:** menús que declaran las apps con `useAppMenus`.
- `fs/hooks` (`useFsFolder`, `useFsFolderState`) para carpetas reactivas.

**SDK (`@os/sdk`):** `useOS()` completo (sección 4.8), `useLaunchArgs`, `useOpenFileHandler`, `useSetting`, `useSystemVolume`, `useFsWatch`, `useAppMenus`, `useUnsavedChanges`, `useProcesses` y `useAccount` (con comprobación de permiso) y `useWidgetOS()` para widgets. Una función restringida sin el permiso lanza un error con el nombre del permiso.

**`@os/ui`:** `ContextMenu`/`useContextMenu`/`MenuList` (con submenús), `Popover`, `Toggle`, `Slider`, `FileIcon`, `FileBrowser` (barra lateral, ruta, atrás/adelante/arriba, columnas ordenables, selección múltiple, modo guardar con "Nueva carpeta", filtro por extensión), `useBattery`, utilidades de formato y ayudas de arrastre (`NODE_DRAG_TYPE`, `setNodeDrag`, `getNodeDrag`, `hasNodeDrag`).

**Shell:** marco de ventana (arrastrar, 8 manijas de tamaño, semáforo con glifos al pasar el cursor, doble clic para maximizar, barra atenuada sin foco, `data-app-id` en el contenedor de la app, captura de errores de la app), diálogos (alert, confirm, prompt, choose, openFile, saveFile, cambios sin guardar, "Acerca de" e "Información"), barra de menú (menú del sistema, app activa y menús declarados; cámara/micrófono, Wi-Fi con popover de redes y contraseña, volumen, batería y reloj), Dock (ampliación al pasar el cursor, punto de app abierta, separadores, menú contextual, Papelera que recibe archivos), Launchpad, escritorio (íconos con retícula invisible, selección por clic y rectángulo, arrastrar y soltar, renombrar en línea, menús contextuales, "Abrir con…"), capa de widgets y avisos emergentes.

**Widgets:** Reloj (analógico pequeño, digital mediano), Calendario (mes actual y próximos eventos desde el `appData` de Calendario), Nota rápida (autoguardado) y Estado del sistema (batería, red y espacio usado en vivo).

### Verificación (lista de la fase)

Se ejecutó Electron con un directorio de datos aislado y se controló por el protocolo de depuración, con ratón y teclado reales para arrastrar, redimensionar y seleccionar. Más de 200 comprobaciones, 0 fallos pendientes, y una pasada de humo con el build real (`file://`) con la consola vacía.

| Punto | Resultado |
|---|---|
| Abrir varias apps y manipular sus ventanas | Sí: foco y apilamiento, arrastrar (sin salir del área útil), redimensionar por bordes y esquinas (respeta el mínimo), maximizar/restaurar (también con doble clic), minimizar hacia el ícono del Dock y restaurar, cerrar. La Calculadora no se redimensiona. |
| Botón de prueba con `isDirty`: diálogo al cerrar y al apagar | Sí: botón cerrar, "Cerrar <App>" de la barra de menú, "Cerrar" del Dock, cerrar sesión, reiniciar y apagar. Con varias ventanas con cambios se pregunta por una a la vez y cancelar cualquiera aborta. "No guardar" apaga de verdad (Electron termina). |
| Widgets, íconos y Dock conservan su estado tras cerrar sesión y tras reiniciar | Sí (instantánea idéntica de widgets, posiciones, nota rápida, Dock y íconos). |
| Los diálogos de ventana bloquean solo su ventana | Sí: la ventana con hoja queda inerte y `hasSheet` es verdadero solo en ella. El modal de sistema bloquea todo. |

Además: abrir un archivo en una app de instancia única con cambios sin guardar pregunta antes; bloquear conserva las ventanas (inertes) y sus cambios; arrastrar y soltar entre escritorio y Papelera del Dock; los archivos creados por otros medios aparecen solos en el escritorio.

**Sin probar:** soltar nodos sobre una ventana de app (las apps son provisionales; queda disponible `NODE_DRAG_TYPE` y las ayudas de `@os/ui`); la importación real del diálogo nativo; macOS y Windows; el arrastre y soltar con el puntero real del sistema (se probó con eventos `DragEvent` sintéticos con `DataTransfer`).

### Defectos encontrados y corregidos durante la verificación

- Las transiciones de `left/top/width/height` se aplicaban también al arrastrar y redimensionar: el primer movimiento "resbalaba" 200 ms. Ahora solo se animan al maximizar o restaurar.
- Las manijas de borde sobresalían de la ventana y `overflow: hidden` las recortaba (quedaban 3 px útiles). Ahora están dentro y son más grandes.
- `focus()` sobre un elemento de una hoja que aún se animaba desplazaba la ventana (`overflow: hidden` admite desplazamiento programático). La ventana y el fondo de la hoja usan `overflow: clip`.
- "Cancelar" en la confirmación de reemplazo de "Guardar como" reconstruía el diálogo y perdía la carpeta y el nombre elegidos.
- Al terminar de crear una carpeta en el explorador, el foco caía al `body` y Esc dejaba de cerrar el diálogo.
- Los eventos de React atraviesan los portales: un clic en un menú contextual cerraba el Launchpad y, en el escritorio, llegaba al manejador del rectángulo de selección. `ContextMenu` y `Popover` ya no propagan.

### Desviaciones y decisiones

1. **Contrato 4.8:** `useUnsavedChanges` devuelve `{ confirmDiscard() }` (antes `void`) para las acciones propias de la app que descartarían cambios (por ejemplo "Nuevo" o "Abrir" en el Editor). Añadido `useWidgetOS()` para widgets. Actualizado en la especificación.
2. **Contrato 4.7:** el widget sin `ownerApp` usa el `appData` de `widget:<id>`. **Formato de los eventos del Calendario** (lo consume el widget y lo escribirá la app en la Fase 4): clave `event:<id>`, valor `{ id, title, date: "AAAA-MM-DD", start: "HH:mm", end: "HH:mm", note?, reminder?: minutos antes | null }`. Fijado en 4.7.
3. **Capas:** `@os/sdk` no puede importar el shell y el shell no importa el SDK, así que quien le dice a una app en qué ventana corre es un contexto de React definido en el kernel (`apps/context.ts`) que el marco de ventana rellena y el SDK lee.
4. **`WindowRecord`** es un superconjunto de `WindowState` (límites de tamaño, argumentos, destino de minimizado…). `x`, `y`, `width` y `height` son siempre los del estado normal; al maximizar, el marco usa la zona libre.
5. **Zona libre:** la calculan la barra de menú (arriba) y el Dock (abajo, incluido su margen) y se la comunican a `windows` con `setWorkArea`.
6. **Diálogos propios del sistema** además de los de `DialogsApi`: `unsaved`, `about` e `info` (modales de sistema los dos últimos). "Acerca de" e "Información" son diálogos y no ventanas de app.
7. **Dock:** el Launchpad va al inicio del grupo de apps ancladas. La Papelera no tiene menú contextual propio (no lo pide la especificación; "Vaciar papelera" llega con Archivos).
8. **Escritorio:** la retícula es de 96×104 px con origen en (16, 40) y se llena por columnas desde arriba a la izquierda. Al soltar sobre una celda ocupada se usa la libre más cercana. Un archivo movido de otro lugar al escritorio ocupa la primera celda libre (no la del punto donde se soltó). "Nueva carpeta" pone el nombre en edición.
9. **Apps de instancia única:** abrir otro archivo enfoca la ventana, pregunta por los cambios sin guardar y entrega el archivo con `useOpenFileHandler` y `useLaunchArgs` (que se actualiza). Las demás apps abren una ventana nueva.
10. **Extensión sin asociación:** "Abrir con…" y la apertura usan los editores de `txt` como respaldo, para poder abrir cualquier archivo.
11. **`useProcesses` y `useAccount`** existen con la comprobación de permiso y lo mínimo (`list/stats/subscribe`, `getUser`); la Fase 3 los completa con lo que necesiten el Administrador de tareas y Configuración.
12. **Reglas de lint:** la capa `os/ui` puede importar `os/kernel` (el `FileBrowser` necesita el sistema de archivos), como ya admitía la matriz de `local/layer-boundaries`.

### Para la Fase 3

- Archivos debe usar `FileBrowser` y recibir `launchArgs.filePath` y `{ view: 'trash' }` (el Dock y el escritorio ya los envían; las carpetas se abren con `filePath`). Las ayudas de arrastre y el menú contextual de `@os/ui` están listos para sus operaciones.
- Configuración recibe `launchArgs.section` (ya se usa `{ section: 'appearance' }` desde el escritorio) y puede leer fondos y avatares de `kernel/appearance`.
- El Administrador de tareas necesitará "Forzar cierre": hoy `closeWindow` siempre respeta el flujo de cambios sin guardar; falta la variante con el aviso adicional de pérdida de datos que pide 4.9.
- Los widgets y el Dock ya leen `dock.iconSize`, `desktop.items` y `desktop.widgets`; Configuración solo tiene que escribirlos.

### Notas para quien pruebe en desarrollo

- Tras editar archivos con `npm run dev` abierto, el HMR de Vite sirve algunos módulos como `…/index.ts?t=…`. Importar el mismo módulo con la URL sin `?t=` (por ejemplo desde un script de prueba) crea una **segunda instancia** con estado distinto. Es un artefacto de desarrollo; en el build no existe.
- Si la ventana de Electron queda oculta tras otras, Chromium deja de avanzar las animaciones CSS hasta que algo fuerza un fotograma.

---

## Fase 3 — Apps del sistema

**Estado:** completada. `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores ni advertencias.

### Qué se hizo

**Apps** (`apps/*/src`, sin tocar los manifiestos):
- **Archivos (`files`):** usa `FileBrowser` en modo `manage`. Barra lateral con la Papelera, vistas de íconos y de lista (se recuerda en `appData`), columnas ordenables, navegación atrás/adelante/arriba y ruta, selección múltiple, renombrar en línea (F2 o menú), Duplicar, Copiar a…, Mover a… (con el selector de carpetas del sistema), Mover a la papelera (Supr), Información, Abrir con…, Importar desde el equipo…, arrastrar y soltar entre carpetas, hacia la Papelera de la barra lateral y hacia el escritorio o el Dock. Papelera: Restaurar, Eliminar definitivamente y Vaciar papelera (ambas con confirmación destructiva; vaciar suena `empty-trash`). Menús Archivo, Edición y Visualización con `useAppMenus`. Acepta `launchArgs.filePath` y `{ view: 'trash' }`; el título de la ventana es `<carpeta> — Archivos`.
- **Terminal (`terminal`):** prompt `<usuario>@<nombre-del-so>:<ruta>$`; `help`, `ls [-l]`, `cd`, `pwd`, `mkdir [-p]`, `touch`, `cat`, `echo` (con `>` y `>>`), `rm [-r]` (a la papelera), `mv`, `cp [-r]`, `tree`, `open`, `date`, `whoami`, `clear`, `history`. Analizador con comillas y barra invertida, historial con flechas, Tab (órdenes y rutas; con varias opciones las muestra), Ctrl+L y Ctrl+C, errores al estilo Unix en español.
- **Configuración (`settings`):** Apariencia (tema, acento, fondos incluidos y cualquier imagen de `~`, y «Elegir otra imagen…»), Escritorio y Dock, Sonido, Red (wifi, conectar con contraseña, desconectar, olvidar), Fecha y hora (zona horaria, 24 h, hora de muestra) y Cuenta (nombre, avatar incluido o imagen del sistema de archivos, cambiar contraseña pidiendo la actual). Acepta `launchArgs.section` (`appearance`, `desktop`, `sound`, `network`, `datetime`, `account`), también con la ventana ya abierta.
- **Administrador de tareas (`task-manager`):** pestaña Procesos (nombre con ícono, PID, CPU y memoria, ordenable, Forzar cierre) y pestaña Rendimiento (CPU y memoria de los últimos 60 s en SVG, sin librerías).

**Kernel:** `fs/hooks` (`useFsTrash`), `renameHomeFolder` en `fs`, `session.rename/setAvatar/changePassword`, `accentColors` en la configuración del sistema, `info` pasa a formar parte de `DialogsApi`.

**SDK:** `useOS().system`, `settings.getDefault`, `apps.getIconUrl`, `dialogs.info`, `useAppearance`, `useNetwork`, `useAccount` completo y `useProcesses().forceQuit`. Tipos nuevos exportados (`ProcessInfo`, `NetworkInfo`, `ConnectResult`, `Avatar`).

**`@os/ui`:** `IconButton`, `Select`, `SegmentedControl`, `Sidebar`, `Tabs`, `List`/`ListItem`, `Avatar` y `FsImage`; `FileBrowser` ampliado; `useFsImageUrl` se mudó aquí desde `shell/common`.

### Verificación (lista de la fase)

Todo se probó ejecutando Electron con un directorio de datos aislado y controlándolo por CDP (ratón y teclado reales; arrastre con `DragEvent` sintéticos). Además, una pasada de humo con el build real (`file://`) sin avisos ni errores en consola.

| Punto | Resultado |
|---|---|
| Lo que hace la Terminal se refleja al instante en Archivos y en el escritorio, y viceversa | Sí: `touch`/`mkdir`/`rm` desde la Terminal aparecen y desaparecen en Archivos y como íconos del escritorio; una carpeta creada desde Archivos sale en `ls` de la Terminal. |
| Cambiar tema, acento o fondo se aplica en vivo en todo el sistema | Sí: `data-theme` y `--color-accent` cambian al instante, y el fondo también con una imagen del sistema de archivos (en el build). |
| Un archivo importado del equipo real se abre en su app asociada | **Parcial.** El diálogo nativo de importar no se puede manejar por CDP (igual que en la Fase 1). Se comprobó que un archivo del sistema de archivos se abre en su app asociada (doble clic y «Abrir con…»). |
| Archivos: operaciones | Sí: navegar, ambas vistas, nueva carpeta, renombrar (F2), duplicar, copiar a…, información, abrir con…, papelera (restaurar, eliminar definitivamente, vaciar), arrastrar a una carpeta, a la Papelera y al escritorio, Dock → Papelera abre la vista de papelera. |
| Terminal: comandos | Sí: todos los de la lista, errores, historial, Tab, `>` y `>>`. |
| Configuración: secciones | Sí: red (contraseña incorrecta y correcta, olvidar, apagar wifi), sonido, zona horaria y 24 h (se refleja en el reloj de la barra), Dock, restablecer, cuenta (renombrar con su carpeta, nombre inválido, avatar incluido y de imagen, contraseña: actual incorrecta, no coincide, demasiado corta y correcta; la nueva sirve para desbloquear y la vieja no). |
| Administrador de tareas | Sí: ordenar, los procesos del sistema no se cierran, Forzar cierre con aviso (cancelar no cierra), y con una ventana con cambios sin guardar aparece el aviso único de 4.9. |

**Sin probar:** importar desde el equipo real (diálogo nativo); que se oigan `empty-trash` y la prueba de sonido (se ejecutan, no los oí); macOS y Windows.

### Defectos encontrados y corregidos durante la verificación

- **Bucle de renderizado en `FileBrowser`:** `useFsFolder`/`useFsTrash` devolvían un `[]` nuevo en cada render mientras cargaban; con `onChange={setState}` en la app, el efecto de aviso volvía a dispararse sin fin («Maximum update depth exceeded»). Ahora devuelven una lista vacía compartida.
- **Terminal:** las líneas eran hijos flex que se encogían y se superponían al ajustar el texto. Se quitó el `flex` del contenedor.
- **Archivos en tamaño mínimo:** la barra de herramientas desbordaba y aparecía una barra de desplazamiento horizontal; el botón de importar ahora se acorta con puntos suspensivos.

### Contratos modificados (ya actualizados en la especificación)

- **4.8:** `useOS().system`; `settings.getDefault`; `apps.getIconUrl`; nuevos `useAppearance()` y `useNetwork()`; `useAccount()` pasa de `getUser()` a `{ user (reactivo), rename, setAvatar, changePassword }`; `useProcesses()` añade `forceQuit`.
- **4.9:** `DialogsApi.info(nodeId)` (antes era un diálogo interno).
- **5.2:** `os.config.json` gana `accentColors` (nombre y valor; al menos uno). Cambiarlo exige recompilar.
- **6:** se añaden `Avatar` y `FsImage` a `@os/ui`.

### Desviaciones y decisiones

1. **`FileBrowser` es el explorador de Archivos** (§6: ninguna app reimplementa un componente de la lista). Gana `mode: 'manage'`, una `ref` con `navigate/createFolder/rename/selectAll/focus` y callbacks (`contextMenu`, `onTrash`, `onError`, `toolbar`, `view`). `FileBrowserState` añade `nodes` e `inTrash`. En ese modo la papelera es un lugar más con la ruta real `/.Papelera` (`TRASH_PATH`); no se puede entrar en las carpetas que contiene.
2. **Terminal.** Las redirecciones `>` y `>>` valen para cualquier orden (no solo `echo`). No hay `&&`, tuberías ni comodines: `mkdir x && ls` crea tres carpetas. El nombre del equipo es el del SO con los espacios cambiados por `-`. Además de `fs` y `apps` usa `os.system` (nombre), `os.settings.get` (zona horaria y 24 h para `date`) y `os.window.setTitle`. `touch` sobre un archivo existente lo reescribe para actualizar la fecha; `cat` rechaza los binarios; `rm -f` se acepta.
3. **El usuario es el nombre de la carpeta de inicio** (`fs.stat('~').name`), porque `useAccount` exige un permiso que la Terminal no tiene.
4. **Cuenta → nombre:** renombra también `/Usuarios/<nombre>` (`renameHomeFolder`, en la misma transacción que el registro de usuario). Las ventanas que ya mostraban la ruta vieja se quedan vacías hasta navegar a otra carpeta.
5. **Restablecer orden de íconos** restaura `desktop.items` a su valor de fábrica (`[]`): quita los accesos a apps y los archivos vuelven a colocarse por orden. Pide confirmación.
6. **Fondos del sistema de archivos:** se listan las imágenes de `~` (recursivo, hasta 60) y se actualizan solas; «Elegir otra imagen…» abre el selector de archivos.
7. **Forzar cierre:** el aviso de pérdida de datos aparece siempre; si la ventana tiene cambios sin guardar, después pasa por el flujo único de 4.9 (y se trae al frente para que se vea). Los procesos ficticios del sistema no se pueden cerrar.
8. **Gráficas:** las métricas son simuladas y deterministas, así que al abrir la app los 60 s de historia se reconstruyen de inmediato en lugar de empezar vacíos.
9. **Archivos → Abrir con…** lista las apps pero no ofrece «Elegir siempre esta app» (necesitaría `settings:write`; la especificación solo lo pide en el escritorio).
10. **Red** exige `settings:write` (guarda en la configuración); Configuración ya lo declara.
11. **Colores de acento** en `os.config.json` y no en el código, para poder cambiarlos sin tocar `src/`.
12. **`shell/login/UserAvatar`** se eliminó: el inicio de sesión usa `Avatar` de `@os/ui`.

### Para la Fase 4

- Las apps con documentos (Editor de texto) usan `useUnsavedChanges`, `dialogs.saveFile` y `useOpenFileHandler`; el Editor ya está asociado a `txt` y `md`.
- El formato de eventos del Calendario está en 4.7; el widget ya lo lee.
- `useOS().system.name` da el nombre del SO para los textos de las apps.
- Los componentes que faltan de la lista de §6 (`TextArea`, `Checkbox`, `Toolbar`) se añaden cuando una app los necesite.

---

## Fase 4 — Apps de productividad

**Estado:** completada. `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores ni advertencias.

### Qué se hizo

**Apps** (`apps/*/src`, sin tocar los manifiestos):
- **Editor de texto (`text-editor`):** abrir, guardar, guardar como (`dialogs.saveFile`, con confirmación de reemplazo del propio diálogo) y nuevo, para `.txt` y `.md`. El título es `nombre — Editor de texto` con `●` delante si hay cambios; usa `useUnsavedChanges` (también en "Nuevo" y "Abrir…"). Buscar con Ctrl+F (resaltado de todas las coincidencias, la actual más fuerte, "n de m", Enter / Mayús+Enter / F3 / Mayús+F3), contador de palabras y caracteres, tamaño de letra (10–32 px, se recuerda en `appData`), menús Archivo, Edición y Visualización, y atajos Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+O, Ctrl+F, Ctrl+`+`/`-`/`0`.
- **Calculadora (`calculator`):** operaciones básicas, porcentaje, cambio de signo, AC, borrar la última cifra y teclado completo. Sin `eval`: el motor (`engine.ts`) es una función pura de estado. Historial plegable (cajón lateral) que se conserva en `appData` (50 operaciones); pulsar una entrada recupera su resultado.
- **Calendario (`calendar`):** vistas de mes (con chips de eventos, selección con un clic, doble clic abre el día) y de día (línea de 24 h, eventos solapados en columnas, línea de la hora actual, clic en una franja crea un evento a esa hora). Crear, editar y borrar (con confirmación) desde un panel lateral con título, fecha, inicio, fin, nota y recordatorio (sin recordatorio, al inicio, 5/15/30 min o 1 h antes). Al abrirse desde la notificación de un recordatorio salta al día del evento y abre su ficha.
- **Reloj (`clock`):** Reloj mundial (añadir y quitar ciudades por zona IANA con buscador; diferencia horaria y "Hoy/Mañana/Ayer" respecto a `datetime.timezone`), Alarmas (hora, etiqueta, repetición, activar/desactivar), Temporizador (anillo de progreso, pausar y reanudar, atajos de 1 a 30 min) y Cronómetro (vueltas con parcial y total, la mejor y la peor marcadas). Alarmas y temporizador usan `scheduler`, así que suenan con la app cerrada.
- **Notas (`notes`):** lista con buscador (sin distinguir tildes ni mayúsculas), fijadas arriba, título tomado de la primera línea, autoguardado a los 400 ms, borrado con confirmación y Ctrl+N.
- **Contactos (`contacts`):** lista alfabética por apellido (o nombre) con letras de sección y buscador (nombre, teléfonos, correos, dirección, notas); ficha con nombre, apellido, teléfonos y correos con etiqueta, dirección, cumpleaños, notas y foto (imagen del sistema de archivos con `dialogs.openFile`); autoguardado; borrado con confirmación.

**`@os/ui`:** `TextArea`, `Toolbar` (con `ToolbarSeparator` y `ToolbarSpacer`). `Checkbox` sigue pendiente: ninguna app de esta fase lo necesitó.

### Formatos de datos (`appData`)

| App | Clave | Valor |
|---|---|---|
| `calendar` | `event:<id>` | `{ id, title, date: "AAAA-MM-DD", start: "HH:mm", end: "HH:mm", note?, reminder?: minutos antes \| null }` (formato fijado en 4.7; lo lee el widget de Calendario) |
| `notes` | `note:<id>` | `{ id, content, pinned, createdAt, updatedAt }` |
| `contacts` | `contact:<id>` | `{ id, firstName, lastName, phones: {id,label,value}[], emails: {id,label,value}[], address, birthday, notes, photoNodeId, createdAt, updatedAt }` |
| `clock` | `cities` | `string[]` (zonas IANA) |
| `clock` | `alarm:<id>` | `{ id, time: "HH:mm", label, repeat: 'none' \| 'daily' \| 'weekdays', jobId }` |
| `clock` | `timer` | `{ durationMs, status: 'idle' \| 'running' \| 'paused', endsAt, remainingMs, jobId }` |
| `clock` | `stopwatch` | `{ running, startedAt, elapsedBefore, laps: number[] }` |
| `calculator` | `history` | `{ id, expression, result, raw }[]` |
| `text-editor` | `fontSize` | `number` |

Los avisos del programador llevan `payload`: `{ kind: 'event', eventId }` (Calendario), `{ kind: 'alarm', alarmId }` y `{ kind: 'timer' }` (Reloj).

### Verificación (lista de la fase)

Todo se probó ejecutando Electron con un directorio de datos aislado y controlándolo por CDP (ratón y teclado reales; los campos `date`, `time` y `select` se rellenaron con el *setter* nativo y un evento).

| Punto | Resultado |
|---|---|
| Una alarma o recordatorio suena y notifica con la app cerrada | Sí. El aviso de un recordatorio de Calendario (5 min antes) y el de una alarma de una sola vez se dispararon a su hora (salieron del programador y la alarma se apagó sola). La notificación emergente se vio con el temporizador (con y sin pausa) y, con todas las ventanas cerradas, con un aviso programado con `scheduler.schedule('clock', …)`; no capturé el toast del recordatorio de Calendario en sí. **No pude oír** el sonido `alarm` (se ejecuta, pero no lo escuché). |
| Los eventos aparecen en el widget de Calendario | Sí: eventos de hoy y de mañana creados en `appData` se ven en el widget (medium) con su hora. |
| Cerrar el Editor con cambios muestra el diálogo único | Sí: botón cerrar con cambios → "¿Guardar los cambios de …?"; "No guardar" cierra, "Cancelar" mantiene la ventana y "Nuevo" con cambios pregunta antes. |
| Notas, Contactos y Calendario nunca muestran ese diálogo | Sí: no usan `useUnsavedChanges`. Cerrar Notas a los pocos milisegundos de escribir no pierde el texto (el guardado pendiente se hace al desmontarse). |
| Editor | Guardar como (crea `prueba.md` con MIME `text/markdown`), guardar directo con Ctrl+S, abrir un archivo existente en ventana nueva, buscar (2 coincidencias, navegación, resaltado), tamaño de letra con Ctrl+`+`. |
| Calculadora | 15 comprobaciones de teclado y clic: encadenado (12+3×2=30), decimales (0,1+0,2=0,3), división entre cero ("No definido"), porcentaje, repetir "=", cambiar operador, separador de millares, borrar, historial persistente. |
| Calendario | Crear con recordatorio (aviso programado a 5 min antes con `payload`), validaciones ("necesita un título", "fin posterior al inicio"), editar quitando el recordatorio (cancela el aviso), Esc cierra el panel, borrar con confirmación, vista de día, apertura desde una notificación. |
| Reloj | Añadir ciudades (Tokio +13 h "Mañana", Madrid +6 h), alarma (se activa, se apaga y se enciende, se apaga sola tras sonar si es de una vez), temporizador (iniciar, pausar, reanudar, terminar, aceptar) y cronómetro (vueltas, detener, reiniciar). |
| Notas | Crear con Ctrl+N (el texto queda enfocado), títulos por primera línea, buscador, fijar (aparece "Fijadas"), borrar con confirmación y cancelar. |
| Contactos | Crear con todos los campos, orden por apellido, buscar por teléfono, borrador vacío que desaparece al cambiar de contacto (nunca se guarda), borrar con confirmación. |
| Tema oscuro | Capturas de Reloj, Calendario y Contactos en oscuro sin colores fuera de los tokens. |

**Sin probar:** elegir la foto de un contacto con el selector de archivos (la imagen se pinta con `FsImage`, ya probado en Configuración); abrir con Ctrl+O desde el diálogo del Editor (sí se probó la apertura por `openFile`/lanzador y Ctrl+S → diálogo); que se oigan las alarmas; cada app a su tamaño mínimo (se revisa en la auditoría de la Fase 6); macOS y Windows.

### Defectos encontrados y corregidos durante la verificación

- `autoFocus` de React solo actúa en `input`, `textarea`, `select` y `button`: la raíz (`div tabIndex={-1}`) de la Calculadora no recibía el teclado hasta hacer clic. Ahora las apps con atajos (Calculadora, Notas, Contactos, Calendario) se enfocan al montarse. Ver "Desviaciones", punto 7.
- Los botones de la Calculadora robaban el foco al pulsarlos; ahora no (`onMouseDown` con `preventDefault`) y el teclado sigue llegando.
- "No definido" se mostraba como `No d × 10^finido` (el formateador numérico lo trataba como notación científica).
- El historial de la Calculadora se pisaba entre ventanas: ahora se parte de lo guardado, no de lo que ve la ventana.
- Notas y Contactos guardaban un elemento vacío nada más pulsar "nuevo"; ahora el borrador vacío solo existe en pantalla.
- `requestAnimationFrame` para enfocar el texto de una nota nueva no se ejecutaba con la ventana de Electron oculta o tapada; se usa `autoFocus` en el montaje.
- Las etiquetas de hora del día en el Calendario (`12:00 p. m.`) se partían en dos líneas; ahora son `12 p. m.`.

### Desviaciones y decisiones

1. **Zona horaria.** Los eventos del Calendario y las alarmas se interpretan en la hora local del equipo, igual que el programador (decisión 5 de la Fase 1) y el widget de Calendario. `datetime.timezone` solo cambia cómo se muestran las horas (Reloj mundial, barra de menú). `datetime.hour24` sí se respeta en todas las horas que muestran las apps.
2. **Recordatorios sin campo extra.** El evento conserva exactamente el formato de 4.7; el aviso se localiza por `payload.eventId` en `scheduler.list()`. Guardar un evento cancela su aviso anterior y programa otro solo si hay recordatorio y el instante aún no pasó.
3. **Una alarma está activa mientras exista su aviso.** `alarm:<id>` guarda el `jobId`; el interruptor se deduce de `scheduler.list()`, de modo que una alarma de una sola vez se apaga sola al sonar (se vuelve a leer al recibir `scheduler:fired`). Guardar una alarma la deja activa.
4. **Un solo temporizador.** La especificación no pide varios. El estado "terminado" se deduce (`running` con `endsAt` pasado), así que también se ve si la app se abre después de sonar.
5. **Calendario sin autoguardado campo a campo.** El evento se edita en un panel con Guardar/Cancelar (no es un diálogo del sistema). No marca `isDirty`. Un evento no puede cruzar la medianoche (el fin debe ser posterior al inicio del mismo día).
6. **Contactos y Notas sin documentos vacíos.** El elemento nuevo se queda solo en pantalla hasta que tiene algún dato; si se abandona vacío no se guarda. Todo lo escrito se guarda a los 400 ms y al cerrar la ventana.
7. **Foco al abrir.** El marco de ventana toma el foco (`tabIndex={-1}`) y los atajos de una app solo llegan si el foco está dentro de ella. Las apps con atajos enfocan su raíz al montarse; el Editor devuelve el foco al texto tras cada diálogo.
8. **Editor de texto.** Menú "Visualización" añadido (tamaño de letra); Tab no inserta tabuladores (mueve el foco, como un campo normal); el selector de "Abrir…" filtra `txt` y `md`, pero el Editor sigue siendo el respaldo de cualquier archivo desde Archivos. Una búsqueda resalta con una capa transparente idéntica bajo el `textarea` (así el campo de búsqueda conserva el foco).
9. **Calculadora.** Ejecución inmediata (12+3×2=30, como una calculadora de bolsillo, no por precedencia). Los resultados se redondean a 12 cifras significativas. El historial es un cajón sobre el 78 % del ancho porque la ventana (320 px, no redimensionable) no admite un panel fijo.
10. **Reloj y Calendario no son de instancia única** (el manifiesto no lo pide), así que pulsar la notificación de una alarma o recordatorio abre otra ventana en la pestaña o el día correspondiente. Los datos viven en `appData`/`scheduler`, así que varias ventanas son coherentes salvo la edición simultánea del mismo elemento (gana la última escritura).
11. **`Checkbox`** no se añade todavía (ver arriba).

### Contratos modificados

Ninguno. Los formatos de `appData` de la tabla anterior son privados de cada app salvo el de los eventos del Calendario, ya fijado en 4.7.

### Para la Fase 5

- Los componentes `Toolbar` y `TextArea` ya existen en `@os/ui`; `Checkbox` se añade si una app lo necesita.
- Las apps que usen teclado (Visor, Música, Videos, Paint) deben enfocar su raíz al montarse (punto 7).
- Para depurar con el servidor de desarrollo, al importar un módulo del kernel desde la página hay que usar la URL con `?t=…` si el HMR lo recargó (ver `CLAUDE.md`); si no, se obtiene una segunda instancia con estado distinto.

---

## Fase 5 — Apps multimedia

**Estado:** completada. `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores ni advertencias.

### Qué se hizo

**Apps** (`apps/*/src`, sin tocar los manifiestos):
- **Visor de imágenes (`image-viewer`):** ajustar a la ventana (sin ampliar por encima del 100 %), zoom con la rueda (hacia el cursor) y con botones o `Ctrl +/-`, clic en el porcentaje o doble clic para alternar entre ajustar y 100 %, desplazamiento arrastrando, rotación de vista a izquierda y derecha, anterior/siguiente entre las imágenes de la misma carpeta (botones y flechas, con "n de m"), "Establecer como fondo de pantalla" e Información. Sin imagen abierta ofrece "Abrir imagen…".
- **Música (`music`, instancia única):** biblioteca que recorre `~/Música` de forma recursiva (ordenada por carpeta y título, con buscador sin distinguir tildes), cola de reproducción (doble clic reproduce la lista visible; "Añadir a la cola"; quitar de la cola; la sidebar muestra "Cola (n)"), reproducir/pausar, anterior (con más de 3 s reinicia la pista), siguiente, barra de progreso, aleatorio (reparte todas las pistas una vez por vuelta) y repetir (no / toda la cola / una pista). El volumen propio se multiplica por `useSystemVolume()` (probado: sistema al 20 % → 0,16; silenciado → 0). Sigue sonando con la ventana minimizada. Recibe archivos con `useOpenFileHandler`; si el archivo está fuera de la biblioteca suena él solo. Título de la ventana `pista — Música`; atajos Espacio y `Ctrl+←/→`.
- **Videos (`videos`):** controles propios sobre el video (reproducir/pausar, anterior/siguiente, progreso, volumen, silencio, pantalla completa dentro de la ventana, lista de la carpeta). Los controles se ocultan a los 2,5 s sin mover el ratón mientras se reproduce. Atajos: Espacio, `←/→` ±5 s, `↑/↓` volumen, `M`, `F`, `Esc`, `Ctrl+←/→`, `Ctrl+O`.
- **Paint (`paint`):** panel "Nuevo lienzo" (ancho y alto con tamaños predefinidos) al abrirse sin archivo o con "Nuevo…"; pincel (suave y redondo), lápiz (sin suavizado, Bresenham), borrador, línea, rectángulo y elipse (contorno o relleno, con vista previa mientras se arrastra), relleno por inundación, cuentagotas, texto (campo sobre el lienzo; Enter aplica, Esc cancela); paleta de 24 colores y selector de color nativo; grosor 1–40; zoom 25–400 %; deshacer/rehacer (30 pasos como mínimo); abrir, guardar y guardar como `.png`; `useUnsavedChanges` con título `● nombre — Paint`; atajos `Ctrl+Z/Y/Shift+Z/S/Shift+S/N/O/+/-/0`.
- **Grabadora de voz (`voice-recorder`):** grabar, pausar/reanudar y detener con `MediaRecorder`; onda en tiempo real (`AnalyserNode`) y cronómetro; guarda en `~/Música/Grabaciones/` como `Grabación AAAA-MM-DD HH-mm-ss.webm`; lista con reproducir/detener, renombrar (con validación) y borrar (a la papelera, con confirmación).
- **Cámara (`camera`, instancia única):** vista previa en vivo; modos Foto y Video; disparador con sonido `shutter` y destello; temporizador de 3 y 10 s (cuenta atrás cancelable); espejo; selector de cámara si hay varias; fotos `.png` en `~/Imágenes/Cámara/` y videos `.webm` con audio en `~/Videos/Cámara/`; miniatura de la última captura (la más reciente de ambas carpetas) que la abre en la app predeterminada; mensajes claros si no hay cámara, se deniega el permiso o está ocupada, con "Reintentar".

**Kernel y SDK:**
- `kernel/media`: `track.stop()` no dispara el evento `ended`, así que el indicador de la barra de menú seguía encendido cuando una app detenía sus propias pistas (la Cámara lo hace al cambiar de dispositivo y la Grabadora al terminar). `track()` ahora envuelve `stop()` para liberar la entrada. Sin cambio de contrato.
- `Configuración` acepta `launchArgs.wallpaperPath` (ruta absoluta de una imagen) y la aplica como fondo; así el Visor cumple "nunca con `settings.set`".

**`@os/ui`:** `useFsObjectUrl(path)` (URL de objeto de un archivo para `src` de imágenes, audio y video, con liberación automática y error) y `formatDuration(segundos)`. `Checkbox` sigue sin hacer falta.

**`system/theme/tokens.css`:** grupo "escenario multimedia" (`--color-stage*`, `--color-flash`, `--color-recording`) para el visor, el video y la cámara, que son siempre oscuros.

### Formatos de datos (`appData`)

| App | Clave | Valor |
|---|---|---|
| `music` | `prefs` | `{ volume: 0–1, shuffle: boolean, repeat: 'off' \| 'all' \| 'one' }` |
| `videos` | `prefs` | `{ volume: 0–1, muted: boolean }` |
| `camera` | `prefs` | `{ mirror: boolean, timer: 0 \| 3 \| 10 }` |

### Verificación (lista de la fase)

Todo se probó ejecutando Electron con un directorio de datos aislado y controlándolo por CDP (ratón y teclado reales, archivos de prueba generados dentro de la propia app: PNG/JPEG, WAV y WebM; la cámara y el micrófono reales del equipo).

| Punto | Resultado |
|---|---|
| Una foto tomada aparece al instante en Archivos y se puede poner como fondo | **Parcial.** La foto se guarda en `~/Imágenes/Cámara/` (PNG, 1280×720), sale la miniatura y la vista de carpeta de `FileBrowser` ya se refresca con `fs:changed` (Fase 3). No abrí Archivos junto a la Cámara para verlo con mis ojos. "Establecer como fondo" se probó con el Visor: Configuración se abre, `appearance.wallpaper` pasa a `{ type: 'file', nodeId }` del archivo correcto y el escritorio cambia. |
| El volumen del sistema afecta a Música y Videos | Sí: volumen efectivo = propio × sistema, y a 0 con el sonido silenciado, en vivo. También en la Grabadora al reproducir. |
| La luz de la cámara se apaga al cerrar la app | Sí: el punto verde (cámara) y el naranja (micrófono) de la barra de menú desaparecen al cerrar la ventana, y también el micrófono al terminar de grabar. **No pude ver la luz física del equipo**; sí que el indicador del sistema y `getUserMedia` se liberan. |
| Abrir un `.png` desde Archivos usa el Visor por defecto y "Abrir con… → Paint" lo edita | Sí a nivel de lanzador: `openFile` abre el Visor, `getAppsForFile` devuelve `image-viewer` y `paint`, y abrirlo con `paint` lo carga en el lienzo. No lo hice con el clic derecho de Archivos. |
| Visor | Zoom con rueda anclado al cursor (cálculo comprobado), botones, arrastre, ajustar, rotación, doble clic, anterior/siguiente con flechas (sin pasar del último), Información. |
| Música | Reproducción real de WAV, pausa, siguiente/anterior, avance automático al terminar, repetir una pista, minimizada sigue sonando, abrir otro archivo con la ventana ya abierta, archivo fuera de la biblioteca, cola (añadir y quitar), Espacio. |
| Videos | Reproducción real de WebM con controles propios, teclado, pantalla completa dentro de la ventana y salir con Esc, los controles se ocultan y reaparecen, lista, anterior/siguiente, el video termina en pausa. |
| Paint | Todas las herramientas con ratón real y comprobación de píxeles, texto (Enter y Esc), 40 pasos y 30 `Ctrl+Z` seguidos y su rehacer, zoom, guardar como (sin extensión → `.png`), guardar directo, el PNG guardado se vuelve a leer con los mismos píxeles, diálogo único al cerrar con cambios (Cancelar mantiene la ventana), abrir un `.jpg` (queda como `c-azul.png` sin ruta) y un `.png`, validación del tamaño. |
| Grabadora | Grabar, pausar, reanudar, detener y guardar (`audio` en `.webm`), nombres únicos, reproducir, renombrar (validación de `/`), borrar a la papelera, cerrar grabando → diálogo único (Guardar crea el archivo; No guardar no deja nada y libera el micrófono). |
| Cámara | Vista previa real, foto (con destello y miniatura), temporizador de 3 s y su cancelación, video con audio (el reproductor de Videos lo reproduce con imagen y sonido), bloqueo del modo y de la cámara mientras graba, cierre. Con `getUserMedia` simulado: permiso denegado y "no se encontró ninguna cámara" muestran el mensaje y "Reintentar" recupera la cámara. |
| Tamaño mínimo y tema oscuro | Revisadas las seis apps al `minWidth × minHeight` de su manifiesto sin barra horizontal ni controles cortados (tras los ajustes de abajo), y capturas de Paint, Música, Grabadora, Visor y Videos en oscuro. |

**Sin probar:** que se oigan el sonido `shutter` y la música (se ejecutan; no los escuché); los botones "Abrir…" de Visor, Música, Videos y Paint (usan el mismo `dialogs.openFile` que `saveFile`, sí probado); formatos distintos de WAV/WebM/PNG/JPEG (MP3, FLAC, M4A, MP4 y MOV dependen de los códecs del Electron instalado); rendimiento del relleno con un lienzo de 2000×2000; macOS y Windows.

### Defectos encontrados y corregidos durante la verificación

- Los controles de Videos desbordaban con la lista abierta en tamaño mínimo (el video quedaba en 258 px): por debajo de 640 px de ancho la lista se superpone al video en lugar de apretarlo (`container-type` en la raíz).
- En la Grabadora el bloque de grabación dejaba solo una fila de lista en tamaño mínimo; se compactaron la onda y los espacios.
- "Añadir a la cola" cambiaba de sección en cada pulsación; ahora se queda en la biblioteca y la barra lateral muestra "Cola (n)".
- Paint pedía confirmar los cambios sin guardar dos veces (al mostrar el panel de "Nuevo" y al crear); ahora solo al crear o abrir.

### Desviaciones y decisiones

1. **Música incluye `webm` en la biblioteca** (la lista de la especificación es mp3, ogg, wav, flac, m4a) porque es el formato de la Grabadora y las grabaciones viven en `~/Música/Grabaciones`. El manifiesto no cambia: Música no se asocia a `.webm`, que sigue abriéndose en Videos.
2. **Los colores de la paleta de Paint son literales** (`palette.ts`, y el blanco del fondo y del borrador). Son el contenido que se dibuja, no la interfaz; el resto de Paint usa tokens. Conviene mencionarlo en la auditoría de la Fase 6.
3. **Paint abre también `jpg`, `jpeg`, `gif`, `webp` y `bmp`** desde su "Abrir…" y desde un `launchArgs.filePath` explícito, pero su asociación sigue siendo solo `png` (spec). Un archivo que no es `.png` se abre como documento sin ruta con el nombre `<nombre>.png`, así "Guardar" nunca escribe PNG sobre una extensión falsa.
4. **Límites de Paint:** 2000 px por lado y 4 millones de píxeles; el historial guarda instantáneas completas, con entre 30 y 60 pasos según el tamaño (160 MB de presupuesto). Si se abre una imagen mayor se avisa y no se abre (no se reduce en silencio).
5. **Paint arranca con el panel "Nuevo lienzo"** (la especificación pide "tamaño configurable al crear") en vez de un lienzo ya creado. Es un panel dentro de la app, no un diálogo del sistema.
6. **Una grabación en curso cuenta como "cambios sin guardar"** en la Grabadora y en la Cámara (video): cerrar la ventana, cerrar sesión, reiniciar o apagar pasan por el flujo único de 4.9; "Guardar" detiene la grabación y crea el archivo. Es la forma de no perder lo grabado al cerrar.
7. **Cámara.** Las fotos se guardan sin espejar (el espejo solo afecta a la vista previa). El micrófono se pide solo al empezar a grabar un video (así el indicador naranja solo está encendido mientras se graba); si falla, se graba sin audio y se avisa. El permiso `microphone` ya estaba en el manifiesto, como pedía la especificación.
8. **Visor.** Escalas entre 5 % y 3200 %. Girar vuelve a ajustar a la ventana. Los SVG sin tamaño propio se muestran a 512 px.
9. **Videos.** Empieza a reproducir al abrir y termina en pausa (no pasa solo al siguiente). `ogg` se abre en Música por defecto (prioridad 10 frente a 5); Videos lo reproduce desde "Abrir con…". La lista de la carpeta aparece abierta por defecto y se puede ocultar.
10. **Grabadora.** Los `.webm` de `MediaRecorder` no declaran su duración, así que al reproducir solo se muestra el tiempo transcurrido, no el total. Borrar manda a la papelera (recuperable) en vez de eliminar.
11. **Música no restaura la cola entre sesiones** (solo volumen, aleatorio y repetir, en `appData`).

### Contratos modificados

Ninguno. `launchArgs.wallpaperPath` de Configuración es un argumento de lanzamiento privado de esa app (como `section`).

### Para la Fase 6

- `help.md` para las 17 apps; la portada (`cover`) sigue sin declararse en ningún manifiesto.
- Auditoría: ver la decisión 2 (colores de Paint) y que Música/Videos/Visor/Cámara/Grabadora ya revisados en tamaño mínimo y tema oscuro; falta Archivos, Terminal, Configuración, Editor, Calculadora, Tareas, Calendario, Reloj, Notas y Contactos a tamaño mínimo (la Fase 4 lo dejó pendiente).
- "Todos los streams de medios se liberan al cerrar": el kernel los detiene en `app:terminated` y, tras esta fase, también cuando la app detiene sus pistas por su cuenta.
- Para depurar con el servidor de desarrollo: cuando el HMR recarga un módulo del kernel, `import()` desde la página puede devolver una segunda instancia (se vio con `kernel/media`, cuyo estado aparecía vacío mientras el indicador de la barra estaba encendido).

---

## Fase 6 — Ayuda, personalización y pulido

**Estado:** completada. `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores ni advertencias.

### Qué se hizo

- **Ayuda (`help`, instancia única):** barra lateral con buscador, página de inicio (nombre del SO, tarjetas de todas las apps), **Primeros pasos** (escritorio, barra de menú, Dock, Launchpad, ventanas, archivos, papelera, cuenta y energía) y una sección por app generada desde el registro: ícono, portada (si la declara), nombre, descripción, categoría, versión, tipos de archivo que abre, botón "Abrir <App>" y el contenido de su `help.md`. Acepta `launchArgs.topic` (`start` o un `id` de app), también con la ventana ya abierta.
  - **Parser propio de Markdown** (`apps/help/src/markdown.ts`, sin dependencias): títulos `#`–`###`, párrafos, listas con viñetas y numeradas, `**negrita**`, `*cursiva*`, `` `código` `` y escapes con `\`. Se dibuja con elementos de React (no hay `dangerouslySetInnerHTML`).
  - **Buscador:** sin distinguir mayúsculas ni tildes; todas las palabras deben aparecer en nombre, descripción o contenido; los aciertos en el título van primero; cada resultado muestra un fragmento.
  - **Marcadores** `{{os}}` y `{{app:<id>}}` en `help.md` y en `getting-started.md`: se sustituyen por el nombre del SO y por el nombre actual de la app, así renombrar no deja la ayuda desactualizada.
- **`help.md` de las 17 apps** y `apps/help/meta/getting-started.md` (contenido de "Primeros pasos").
- **`CUSTOMIZACION.md`** (raíz): cambiar nombre, descripción, ícono, portada, estilos y ayuda de cada app; nombre del SO, logo, fondos, avatares, sonidos, íconos y tokens; añadir apps y widgets copiando una carpeta; formatos y tamaños; qué exige recompilar y qué no.
- **Auditoría y pulido:** ver más abajo.

### Cambios de contrato (ya actualizados en la especificación)

- **4.8:** `useOS().apps` gana `getCoverUrl(appId)` y `getHelp(appId)` (la Ayuda es una app y no puede importar el registro). Solo lectura, sin permisos.
- **6:** `Checkbox` sale de la lista de componentes mínimos de `@os/ui`. Ninguna app lo ha necesitado en seis fases y no se crea un componente sin uso; se añade el día que haga falta.

### Auditoría de consistencia

| Punto | Resultado |
|---|---|
| Componentes de `@os/ui` y tokens, sin colores a mano | **Sí, con las excepciones justificadas.** Búsqueda de `#hex`, `rgb()`, `hsl()` y colores con nombre en `apps`, `widgets`, `os/shell` y `os/ui`: los únicos literales son la paleta de Paint (contenido que se dibuja: `palette.ts`) y un `rgb(0 0 0 / .12)` del borde de los botones de ventana, que pasó a un token nuevo (`--color-traffic-border`). Ninguna app reimplementa `Button`, `IconButton`, `TextField`, `Select`, `Toggle`, etc. Quedan `<button>`/`<input>`/`<textarea>` nativos solo donde el componente no sirve: muestras de color y miniaturas, filas y fichas pulsables, el disparador de la Grabadora y la Cámara, los dígitos del Temporizador, el selector de color y el campo de texto de Paint, la línea de la Terminal y el `textarea` del Editor (lleva una capa de resaltado detrás) y el de la Nota rápida (sin marco, integrado en el widget). |
| Apps con documentos usan `useUnsavedChanges` y `dialogs.saveFile` | **Sí.** Editor de texto y Paint usan ambos. Grabadora y Cámara usan `useUnsavedChanges` para una grabación en curso y guardan en carpetas fijas (no tienen "Guardar como"). Notas, Contactos y Calendario hacen autoguardado y no lo usan. |
| Ningún texto visible con el nombre del SO ni de una app | **Corregido.** Se encontraron y arreglaron cinco: el menú del sistema ("Configuración", ahora desde el manifiesto), el asistente ("después en Configuración", idem), la descripción de `open` en la Terminal ("en Archivos"), y dos `aria-label` de Música ("Volumen de Música", "Secciones de Música"). El resto de coincidencias son nombres de carpetas del sistema de archivos (`Música`, `Videos`, `Cámara`), etiquetas de campo ("Notas" de un contacto) o la palabra "Cámara" del dispositivo, que no son el nombre de una app. El nombre de la base de datos (`simos`) y el tipo de arrastre (`x-simos-node`) son identificadores internos. |
| Cada app en tema claro y oscuro y con ventana mínima | **Sí.** Fases 4 y 5 ya habían revisado seis apps; esta fase revisó las once restantes (Archivos, Terminal, Configuración, Editor, Calculadora, Administrador de tareas, Calendario, Reloj, Notas, Contactos y Ayuda) con una medición de desbordamiento horizontal y capturas en oscuro a su `minWidth × minHeight`. Defecto encontrado y corregido: **Archivos en vista de lista desbordaba** (dos barras horizontales); ahora oculta la columna "Tipo" por debajo de 470 px de ancho del propio explorador (`container query`). |
| Asociaciones de archivo con al menos una app y "Abrir con…" correcto | **Sí.** Probado con todas las extensiones de la tabla MIME (`txt md json csv html css js xml png jpg jpeg gif webp svg bmp mp3 ogg wav flac m4a mp4 webm mov`) y una desconocida (`docx`): las de texto abren en el Editor (las no asociadas lo usan como respaldo); `png` → Visor (por defecto) y Paint; el resto de imágenes → Visor; `ogg` → Música (por defecto) y Videos; audio → Música; video → Videos. |
| Streams de medios liberados al cerrar | **Sí.** Ninguna app llama a `getUserMedia` (todas pasan por `os.media`). Con la Cámara y la Grabadora abiertas, el indicador de la barra de menú se enciende y al cerrar las ventanas se apaga. El micrófono solo se pide al grabar (Fase 5). |

### Pulido

- **Estados vacíos:** el explorador de archivos (`FileBrowser`) mostraba un párrafo suelto en una carpeta o papelera vacías; ahora usa `EmptyState` con descripción. Las demás listas ya lo usaban (Notas, Contactos, Reloj, Música, Videos, Grabadora, Visor, Calculadora, Configuración y la búsqueda de la Ayuda); el Launchpad y el widget de Calendario mantienen su mensaje propio porque van sobre el desenfoque y dentro de un widget.
- **Rendimiento con 10 ventanas:** al mover una ventana se renderizaban todas (`WindowFrame` no estaba memoizado). Medido arrastrando una ventana durante 3 s con 10 abiertas, en desarrollo: antes 18,7 ms de media por fotograma (p95 33 ms); ahora **16,7 ms constantes (60 fps)**, igual que con una sola ventana.
- **"Acerca de" con portada:** la portada se solapaba con el título del diálogo (el margen negativo suponía que iba arriba del todo). Nadie lo había visto porque ninguna app declaraba portada; ahora va como banner bajo el título.
- **Mensajes de error en español:** Paint mostraba el error del navegador en inglés al abrir un archivo que no es una imagen (`The source image could not be decoded.`); ahora dice "El archivo no es una imagen válida o está dañado.". `storage.transaction` traduce `QuotaExceededError` (disco lleno) a "No hay espacio suficiente para guardar los cambios." (esto último no se pudo provocar; está razonado, no probado).

### Verificación (lista de la fase)

Probado con Electron y un directorio de datos aislado, controlado por CDP, tanto en desarrollo como con el build real (`file://`).

| Punto | Resultado |
|---|---|
| Cambiar nombre, ícono y portada en `meta/` se refleja en todos lados sin tocar `src/` fuera de `meta/` | **Sí.** Se probó con Terminal, y se revirtió después. Nombre → "Consola": barra de menú, título de la ventana, Dock, Ayuda (barra lateral y página) y "Acerca de". Ícono (se puso el de la Cámara) → Dock, ícono del escritorio, Administrador de tareas y notificación emergente. Portada (PNG de 640×200) → "Acerca de" y página de la app en la Ayuda. El Launchpad y "Abrir con…" leen el mismo registro, pero no los miré con una captura. |
| Ayuda: las 17 apps, Primeros pasos, inicio | **Sí**, en el build: las 17 secciones tienen contenido, sin marcadores `{{…}}` sin resolver; la búsqueda por "camara" encuentra Cámara y Primeros pasos, y "zzzz" muestra "Sin resultados". |
| Menú, asistente y Terminal con nombres leídos de los manifiestos | Sí (el asistente se vio con el build). |

**Sin probar:** que el aviso de disco lleno (`QuotaExceededError`) llegue al usuario; macOS y Windows; el Launchpad y "Abrir con…" con un ícono/nombre cambiado (comparten fuente con lo probado).

### Desviaciones y decisiones

1. **Sin portadas.** Ningún manifiesto declara `cover`: la especificación la define opcional, y no se generaron 17 imágenes sin que nadie las pidiera. La Ayuda y "Acerca de" funcionan con y sin ella (verificado con una portada de prueba).
2. **`getting-started.md` vive en `apps/help/meta/`** (no en `src/`), para que, como el resto de la ayuda, se edite sin tocar código. El registro solo reconoce `help.md`, así que la Ayuda lo importa directamente con `?raw` desde su propia carpeta.
3. **`help.md` sin título principal:** la Ayuda ya pinta el encabezado (ícono, nombre, descripción); un `#` repetiría el nombre. `#`, `##` y `###` se dibujan como títulos de nivel 2, 3 y 4.
4. **Los atajos y funciones que describen las guías** salen de la bitácora de las fases 3–5. Solo comprobé contra el código los de la Calculadora (`Enter`, `=`, `Retroceso`, `Esc`), la selección múltiple de Archivos (`Ctrl`/`Mayús`) y las flechas de Música y Videos; el resto no lo he vuelto a contrastar tecla por tecla.
5. **Dependencias:** ninguna nueva. (El parser de Markdown es propio, como pide la especificación.)

### Notas para quien pruebe en desarrollo

- Editar un `manifest.json`, un ícono o una portada recarga la ventana entera (el registro usa `import.meta.glob` con `eager`); la sesión vuelve al arranque y a la pantalla de inicio de sesión.
- Con la ventana de Electron tapada o sin foco, `setTimeout` se frena y el arranque puede tardar mucho más que `bootDurationMs`. Para depurar por CDP conviene recargar con la sesión de depuración conectada.
- Tras un HMR de módulos del kernel, `import()` desde la página puede devolver una segunda instancia (ver `CLAUDE.md`); localiza la URL exacta en `performance.getEntriesByType('resource')`.

### Estado final del proyecto

Las siete fases (0 a 6) están completadas. Alcance aprobado en `ESPECIFICACION.md` §1 cubierto; la lista "Fuera de alcance" sigue sin implementar.

---

## Cambios posteriores a la Fase 6

Pedidos fuera de las siete fases originales. Se actualizó primero `ESPECIFICACION.md`. `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores ni advertencias.

### 1. Wi-Fi simulado eliminado

Se quitó **todo** el wifi simulado, no solo la sección de Configuración:
- Borrados: `kernel/network`, `useNetwork`/`NetworkApi`/`NetworkInfo`/`ConnectResult` del SDK y `NetworkSection`.
- Quitadas las claves `network.wifiEnabled`, `network.connectedSsid` y `network.knownNetworks`, y `networks` de `os.config.json` y de su schema (estricto: se cambiaron a la vez).
- Barra de menú sin el icono y el popover de wifi; Configuración pasa de 6 a 5 secciones (Apariencia, Escritorio y Dock, Sonido, Fecha y hora, Cuenta); el widget Estado del sistema muestra batería y espacio usado; se quitó el proceso ficticio `Red` del Administrador de tareas.
- Textos: `help.md` de Configuración, «Primeros pasos», descripciones de manifiestos (Configuración y Estado del sistema), `CUSTOMIZACION.md`, `CLAUDE.md`.
- Especificación: §1, 2, 3.1, 4.5, 4.8, 5.2, fases 1–3, y se eliminó 4.14 (Red); Medios pasa a ser **4.14**.
- **Datos guardados:** sin migración. `settings.load()` ignora las claves que ya no existen; se comprobó insertando filas `network.*` a mano en IndexedDB y reiniciando: arranca sin problema y las filas quedan inertes.
- `settings:write` se mantiene en Configuración (lo siguen usando el resto de secciones).

### 2. Espaciado del Dock (`dock.gap`)

- Ajuste nuevo `dock.gap`: entero de 0 a 24 px, por defecto 4 (el valor de siempre; las cuentas existentes no cambian). Configuración → Escritorio y Dock → «Espaciado entre íconos», con deslizador y valor.
- El Dock lo recibe como `--dock-gap` (como `--dock-icon-size`); también escala el margen de los separadores. El alcance de la ampliación al pasar el cursor sigue a `tamaño + espaciado` (`REFERENCE_PITCH` = 60).
- No hizo falta tocar el área útil de las ventanas ni el destino del minimizado (el Dock sigue centrado y se mide en vivo).
- Verificado: con 0, 4, 20 y 24 px el Dock queda centrado (ancho 583, 631, 823 y 871 px) y, en el build, mover el deslizador cambia el `gap` al instante.
- **Desviación:** no hay botón «Restablecer» propio (se había planeado). Con el botón el deslizador quedaba más corto que el de tamaño; el valor es visible y se vuelve a 4 arrastrando.

### 3. Python en la Terminal

Comando `python` (y `python3`) en la Terminal: `python archivo.py [argumentos…]`, `python -c "código"` y `python --version`. Es **Python real (CPython 3.14.2) compilado a WebAssembly con Pyodide 314.0.7**, empaquetado localmente.

- **`os/kernel/python`** (nuevo): servicio con un Web Worker de archivo propio (`worker.ts`; la CSP no admite workers `blob:`). Un programa a la vez; `cancel()` termina el worker y la siguiente ejecución crea otro. Se corta también al terminar la instancia de la app que lo lanzó y al cerrar sesión, reiniciar o apagar. Se expone en el SDK como `useOS().python.run(job, io)` con el permiso nuevo **`python`** (la Terminal lo declara). Las apps no pueden importar `pyodide` (lint), solo el kernel.
- **Terminal:** la salida llega en vivo (`ShellEnv.live`); con una redirección (`>`, `>>`) se junta entera y se escribe en el archivo; mientras corre un programa el campo se desactiva y **Ctrl+C lo corta** (antes solo escribía `^C`). Errores de Python con su traceback original, sin la línea del envoltorio; `python nada.py` da un error estilo Unix; `help` ya no repite `python3`.
- **`.py`:** `py: text/x-python` en la tabla MIME. Se sigue abriendo en el Editor de texto (respaldo para extensiones sin asociación); sus diálogos Abrir/Guardar ahora también listan `.py`.
- **Empaquetado:** un plugin de `electron.vite.config.ts` sirve los 5 archivos de Pyodide con su nombre original (`/pyodide/` en desarrollo) y los copia a `out/renderer/pyodide/` en el build (13 MB: `pyodide.asm.wasm` 9,6 MB, `python_stdlib.zip` 2,5 MB, `pyodide.asm.mjs` 1,2 MB). Pyodide los busca por nombre, así que no pueden ser assets con hash. `worker.format = 'es'` por el `import()` dinámico.
- **CSP (§3.4):** `script-src` gana `'wasm-unsafe-eval'`. Es lo único que se añadió; no autoriza `eval` de JavaScript.
- **Dependencia nueva (§2):** `pyodide` (^314.0.7). Justificación: es la única forma de ejecutar Python real sin instalar nada en el equipo ni salir del aislamiento de Electron.

**Sangría en el Editor de texto (corrección posterior).** Al entregar Python no había comprobado si se podía *escribir* Python en el Editor: no se podía, porque `Tab` movía el foco (decisión 8 de la Fase 4) y `Enter` no conservaba la sangría. Ahora (`apps/text-editor/src/indent.ts`, lógica pura): `Tab` inserta hasta el siguiente múltiplo de 4 columnas y con varias líneas seleccionadas las sangra todas; `Mayús+Tab` des-sangra (también líneas con tabulador); `Enter` conserva la sangría y en un `.py` añade un nivel tras `:`; `Retroceso` dentro de la sangría borra un nivel. Siempre 4 espacios. Cada edición se aplica con `execCommand('insertText')` para que `Ctrl+Z` la deshaga entera. **Contrapartida:** `Tab` ya no saca el foco del texto (como en cualquier editor de código). Verificado con teclas reales: escribí un programa con `if/else/for`, lo guardé con `Ctrl+S` como `prog.py` y `python Documentos/prog.py` imprimió lo esperado. La sangría tras `:` solo se aplica si el documento ya tiene ruta `.py` (un documento sin título no sabe que es Python); sin resaltado de sintaxis.

**Límites (por diseño, documentados en la especificación 4.15 y en la ayuda de la Terminal):** solo biblioteca estándar, sin `pip` ni red; `input()` lanza `EOFError`; el `open()` de Python **no ve** el sistema de archivos virtual (trabaja en memoria y se borra al terminar), así que para guardar resultados se redirige la salida; no hay programas interactivos; el código se ejecuta con el `exec` de Python dentro del intérprete (no es `eval` de JavaScript).

**Prueba de viabilidad (el riesgo que se había identificado):** Pyodide **sí arranca desde `file://`** en la app compilada (el worker y los archivos se cargan sin necesitar un protocolo propio), así que no hizo falta cambiar el origen de IndexedDB ni tocar la carga de `main`.

### Verificación

Probado con Electron y datos aislados, controlado por CDP, en desarrollo y en el build real (`file://`) usando la propia Terminal:
- `python -c "print(2+2)"` (→ «Cargando Python…» y `4`); `python hola.py uno dos` con `math`, `json`, `random` y `sys.argv`; `1/0` (traceback); sintaxis inválida (`SyntaxError` con el caret); `sys.exit(3)`; `input()` (`EOFError`); archivo inexistente; `--version` (3.14.2); sin argumentos.
- `while True: pass` se corta con Ctrl+C (el campo se reactiva) y la ejecución siguiente funciona; cerrar la ventana en mitad de un bucle y abrir otra Terminal también.
- `python -c "..." > out.txt` y `cat out.txt` (redirección); `open hola.py` abre el Editor con el script.
- Arranque en frío medido en desarrollo: unos 2 s hasta la primera salida; las siguientes ejecuciones en la misma ventana son inmediatas.

**Sin probar:** rendimiento de programas pesados; macOS y Windows (Pyodide no depende del sistema, pero no lo ejecuté allí); la memoria que mantiene viva la instancia de Pyodide entre ejecuciones: el worker se conserva tras un programa que termina con normalidad (para que el siguiente arranque al instante) y solo se libera al cancelar, al cerrar la ventana *durante* una ejecución o al cerrar sesión, reiniciar o apagar.

### Otros cambios menores

- **Nombre del sistema:** pasó a **OrigamiOS** (`os.config.json`). El nombre de la base de datos (`simos`) y el tipo de arrastre (`application/x-simos-node`) no cambian a propósito.
- **Archivos `.py`:** usan el ícono `system/icons/file-python.svg` (por el tipo MIME `text/x-python`, en `FileIcon`) y en la columna «Tipo» aparecen como «Python».

---

## Multiusuario ligero

**Estado:** completado. `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores ni advertencias. Se actualizó antes la especificación (§1, 4.2, 4.3, 4.5, 4.8 y Fase 1).

### Qué se hizo

Varias cuentas (nombre, avatar, contraseña) con **una sola sesión abierta a la vez**. Todas las cuentas son iguales: sin administrador, sin permisos y sin borrar cuentas.
- **Compartido por todos:** archivos (cada cuenta ve las carpetas de las demás), datos de las apps (Notas, Contactos, Calendario, Reloj…), alarmas y papelera.
- **De cada cuenta:** todos los ajustes: tema, acento, fondo, Dock (ancladas, tamaño y espaciado), íconos y widgets del escritorio, sonido, fecha y hora y asociaciones de archivo.

**Kernel**
- `storage`: `userRecordSchema.id` pasa a cadena libre (la cuenta existente conserva `user`; las nuevas usan un UUID); `storage.user` → `get(id)`, `all()`, `put`; `storage.settings` → `byPrefix` y `migrateLegacy`. **No hay cambio de esquema Dexie** (`SCHEMA_VERSION` sigue en 1).
- `settings`: los ajustes se guardan con la clave `<id de cuenta>:<clave>`. `load(userId | null)`, `set` (guarda solo si hay una cuenta cargada), `preview` (solo en memoria), `persistNew(userId, overrides)` y `migrateLegacy`. Un `load` que llega tarde se descarta si ya hay otro en curso.
- `fs`: `~` sigue a la cuenta con la sesión abierta (`setCurrentUser`, que llama la sesión; `fs` no puede importarla). `createInitialTree` se dividió en `createSystemTree()` (una vez) y `createUserHome(name)` (por cuenta, falla con `EEXIST` si el nombre ya existe).
- `session`: `SessionUser` gana `id`; el estado gana `users` y `lastUserId`; nuevos `createUser` y `login(userId, password)`; `completeSetup` = alta + inicio de sesión; `unlock`, `rename`, `setAvatar` y `changePassword` actúan sobre la cuenta activa; el nombre de cuenta no puede repetirse (sin distinguir mayúsculas). Cerrar sesión deja `user = null`.

**Interfaz**
- Pantalla de inicio de sesión: con una cuenta va directo a la contraseña (como antes) y ofrece «Nuevo usuario»; con varias muestra «¿Quién eres?» con los avatares (la última cuenta en entrar, primero) y «Nuevo usuario»; al elegir una se ve su fondo y su tema. «Otro usuario» vuelve a la lista. La pantalla de bloqueo solo ofrece la cuenta activa.
- `SetupWizard` con `mode="additional"`: sin bienvenida, con «Cancelar», sobre la pantalla de inicio de sesión; avisa al momento de un nombre repetido; la vista previa del tema ya no se guarda.

### Verificación

Probado con Electron y datos aislados, controlado por CDP, con el build real (`file://`):

| Punto | Resultado |
|---|---|
| Migración de datos de la versión anterior | **Sí.** Con una copia de datos de una cuenta única (ajustes globales y filas `network.*` viejas): las claves quedaron como `user:<clave>`, las antiguas desaparecieron (incluidas las `network.*`) y al entrar conservó su tema y su espaciado del Dock (18 px). |
| Segunda cuenta desde la pantalla de inicio | **Sí.** «Ana» ya existía: «ana» da «Ya existe un usuario con ese nombre.» al instante; se creó «Beto» con tema oscuro; al terminar la pantalla volvió al aspecto de Ana (la vista previa no se guardó). |
| Ajustes por cuenta | **Sí.** Beto entró con tema oscuro y espaciado 4; cambió el espaciado a 12; Ana entró con tema claro y 18; todo persistió tras reiniciar Electron (Beto: oscuro y 12). |
| Archivos compartidos y `~` | **Sí.** `pwd` da `/Usuarios/Beto` o `/Usuarios/Ana` según quién entró; Ana ve `/Usuarios/Beto` y el archivo que Beto creó. |
| Bloqueo y contraseña incorrecta | **Sí.** El bloqueo muestra solo a la cuenta activa, con «Desbloquear»; contraseña incorrecta da el error y la correcta desbloquea. |
| Cambiar de nombre | **Sí.** Cambiar «Ana» por «BETO» en Configuración → Cuenta da «Ya existe un usuario con ese nombre.» y no cambia nada. |
| Orden de la lista tras reiniciar | **Sí.** Sale primero la última cuenta que entró. |
| Primer arranque limpio | **Sí.** El asistente crea la primera cuenta como antes, con el tema elegido (oscuro) aplicado al entrar. |

**Sin probar:** datos de apps compartidos entre cuentas (Notas, Contactos, Calendario) y alarmas: no se tocó nada de `appData` ni del programador, que no distinguen usuarios, pero no abrí esas apps con dos cuentas; el tamaño del selector con muchas cuentas (se ajusta en varias filas, sin revisar con más de tres); ventanas en tamaño mínimo y tema claro del selector (se vio solo el oscuro sobre el fondo habitual); que se oigan los sonidos de entrada y salida.

### Desviaciones y decisiones

1. **No hay «Cambiar de usuario» en el menú del sistema:** «Cerrar sesión» ya lleva a la lista de cuentas y sería un elemento duplicado.
2. **No se pueden borrar cuentas** (fuera de alcance, §1). Tampoco renombrar la carpeta de otra cuenta.
3. **Las cuentas no tienen privacidad entre sí:** por diseño, todas ven los archivos y los datos de las demás. Lo único separado son los ajustes.
4. **El nombre de la cuenta es el de su carpeta de inicio**, así que no puede repetirse ni siquiera cambiando mayúsculas.
5. **`SetupWizard` calcula `STEPS` según el modo** y pasa a recibir `mode` y `onClose`.
6. **Al cerrar sesión se deja cargada la apariencia de la cuenta que salió** hasta que se elige otra, para que la pantalla de inicio no «salte».

## Botones de ventana a la derecha

- Los tres botones (cerrar, minimizar, maximizar) pasan del lado izquierdo al derecho de la barra de título, y el orden pasa a minimizar, maximizar, cerrar (cerrar en el extremo derecho). Cambia `.window__controls` en `WindowFrame.css` (`margin-left: auto` y `padding-right` en vez de `padding-left`); el título sigue centrado.
- Cambio de contrato: §1 y §6 de `ESPECIFICACION.md` y el texto de «Primeros pasos» (`getting-started.md`) ahora dicen «a la derecha».
- Botones más grandes: 16 px de diámetro (antes 12), glifo de 10 px, separación de 10 px y margen derecho de 14 px; el título reserva 88 px por lado para no quedar bajo los botones. Solo `WindowFrame.css`; §6 de la especificación indica ahora «16 px».
