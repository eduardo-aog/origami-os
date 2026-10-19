# Especificación: simulador de sistema operativo de escritorio (Electron + React)

> **Este documento es la única fuente de verdad del proyecto.** Léelo completo antes de empezar cualquier fase. Las secciones 1 a 6 definen reglas y contratos que todas las fases deben respetar; la sección 7 define las fases. Si una fase necesita cambiar un contrato, primero actualiza la sección correspondiente de este documento, luego ajusta **todos** los módulos que lo usan en el mismo paso, y registra el cambio en `docs/PROGRESO.md`.

---

## 1. Visión general

Un simulador de sistema operativo de escritorio que corre como aplicación Electron. No es un SO real: no hay kernel, hilos ni planificación de procesos reales. Es un entorno que **se comporta y se ve** como un SO moderno, con sesión de usuario, escritorio, ventanas, sistema de archivos persistente y un conjunto de aplicaciones.

- **Estilo visual:** inspirado en macOS, versión minimalista. Barra de menú superior, Dock inferior, Launchpad, ventanas con tres botones de color a la derecha, esquinas redondeadas, desenfoque translúcido (`backdrop-filter`), animaciones suaves y cortas.
- **Prohibido usar recursos de Apple:** nada de íconos, fondos, fuentes (SF Pro), logotipos ni sonidos de Apple. Todo debe ser original o de licencia libre.
- **Idioma de la interfaz:** español. Identificadores de código, nombres de archivo y commits en inglés.
- **Nombre del SO:** configurable en `os.config.json` (valor inicial: `"OrigamiOS"`). Ningún texto de la interfaz debe tener el nombre escrito a mano; siempre se lee de la configuración.
- **Varias cuentas, una sesión:** el sistema admite varias cuentas (nombre, avatar y contraseña); la primera se crea en el primer arranque y las demás desde la pantalla de inicio de sesión. Solo hay **una sesión abierta a la vez**. Es un multiusuario "ligero": todas las cuentas son iguales (sin administrador ni permisos) y **comparten** los archivos, los datos de las apps y los avisos del programador. Lo que es de cada usuario son sus **ajustes** (4.5): tema, acento, fondo, Dock, íconos y widgets del escritorio, sonido, fecha y hora y asociaciones de archivo.

### Alcance aprobado (no agregar funciones fuera de esta lista)

| Área | Incluido |
|---|---|
| Sesión | Pantalla de arranque, asistente de primer arranque, pantalla de bloqueo/inicio de sesión con contraseña y elección de cuenta, crear cuentas nuevas, bloquear, cerrar sesión, reiniciar, apagar |
| Shell | Barra de menú superior, Dock, Launchpad, escritorio personalizable (fondo, íconos movibles, widgets), menús contextuales, notificaciones emergentes |
| Ventanas | Abrir, cerrar, minimizar, maximizar, arrastrar, redimensionar, foco y apilamiento, diálogos modales |
| Archivos | Árbol virtual, crear/renombrar/duplicar/copiar a/mover/borrar, papelera con restauración, metadatos, arrastrar y soltar, "Abrir con…", importar desde el equipo real, persistencia |
| Apps | Archivos, Editor de texto, Terminal, Configuración, Calculadora, Administrador de tareas, Calendario, Reloj, Notas, Contactos, Visor de imágenes, Música, Videos, Paint, Grabadora de voz, Cámara, Ayuda |
| Configuración | Apariencia (tema, acento, fondo), Escritorio y Dock, Sonido, Fecha y hora, Cuenta de usuario |
| Servicios | Notificaciones, gestor de apps, sonidos del sistema, programador de avisos (alarmas y recordatorios), intérprete de Python para la Terminal |
| Seguridad | Contraseña con hash, aislamiento de Electron |

### Fuera de alcance (no implementar)

Sesiones simultáneas de varios usuarios, administrador y roles, borrar cuentas, cuenta invitado, suspender/hibernar, centro de notificaciones con historial, ajustes rápidos, búsqueda global, escritorios virtuales, atajos de teclado globales del sistema, snap de ventanas, Alt+Tab, vista general de ventanas, **portapapeles propio del sistema**, accesos directos/alias de archivos, permisos de archivos por usuario (y separar archivos o datos de apps entre cuentas), unidades externas, cuota de disco, navegador web, editor de código, PDF, correo, captura de pantalla, tienda de apps, internacionalización, accesibilidad avanzada, empaquetado con instaladores, pruebas automatizadas.

**Sobre Python:** solo existe el comando `python` de la Terminal (4.15). No hay app de Python ni editor de código; los `.py` se abren con el Editor de texto como cualquier archivo de texto.

**Sobre el portapapeles:** no se implementa un portapapeles del sistema. El copiar/pegar de texto nativo de Chromium dentro de campos de texto debe seguir funcionando y no se bloquea. En el explorador de archivos no existen "Copiar" y "Pegar"; en su lugar se usan **Duplicar**, **Copiar a…**, **Mover a…** y arrastrar y soltar.

---

## 2. Stack técnico

- **Electron** (versión estable actual) con **electron-vite** (plantilla `react-ts`) como herramienta de compilación.
- **React 18+** y **TypeScript** en modo `strict`.
- **Zustand** para el estado global del renderer.
- **Dexie 4** (sobre IndexedDB) para toda la persistencia.
- **Zod** para validar manifiestos y datos persistidos.
- **lucide-react** para glifos de interfaz (flechas, volumen, batería, etc.). Los íconos de apps son SVG originales propios.
- **@fontsource/inter** para la tipografía, empaquetada localmente (no cargar fuentes remotas).
- **pyodide** (CPython compilado a WebAssembly), empaquetado localmente. Solo lo usa `os/kernel/python`; las apps lo alcanzan únicamente por el SDK (4.8).
- **ESLint** con reglas de importación (ver sección 3.3).
- Scripts obligatorios en `package.json`: `dev`, `build`, `typecheck`, `lint`.

No agregar dependencias fuera de esta lista sin justificarlo en `docs/PROGRESO.md`.

---

## 3. Arquitectura

### 3.1 Estructura de carpetas

```
/
├─ ESPECIFICACION.md              ← este documento
├─ CLAUDE.md                      ← reglas de trabajo (se crea en la Fase 0)
├─ CUSTOMIZACION.md               ← guía de personalización (se crea en la Fase 6)
├─ docs/PROGRESO.md               ← bitácora de fases
├─ electron.vite.config.ts
├─ eslint.config.mjs
├─ eslint/local-plugin.mjs        ← regla local `layer-boundaries` (ver 3.3)
└─ src/
   ├─ main/                       ← proceso principal de Electron
   │  ├─ index.ts                 ← crea la ventana, aplica seguridad
   │  ├─ security.ts              ← CSP, permisos de cámara/micrófono, bloqueo de navegación
   │  └─ ipc/                     ← un archivo por dominio: files.ts, auth.ts, power.ts
   ├─ preload/
   │  └─ index.ts                 ← expone window.native con contextBridge
   ├─ shared/
   │  ├─ native-api.ts            ← tipos del puente y nombres de canales IPC, compartidos por main, preload y renderer
   │  └─ mime.ts                  ← tabla única de tipos MIME por extensión (ver 4.3)
   └─ renderer/
      ├─ index.html
      └─ src/
         ├─ main.tsx
         ├─ os/
         │  ├─ kernel/            ← servicios del sistema (sin interfaz)
         │  │  ├─ events/
         │  │  ├─ storage/
         │  │  ├─ fs/
         │  │  ├─ settings/
         │  │  ├─ session/
         │  │  ├─ apps/          ← registro de apps y widgets, lanzador, asociaciones de archivo
         │  │  ├─ windows/
         │  │  ├─ processes/
         │  │  ├─ dialogs/          ← diálogos, flujo de cambios sin guardar
         │  │  ├─ menus/            ← menús que declaran las apps (useAppMenus)
         │  │  ├─ notifications/
         │  │  ├─ sound/
         │  │  ├─ scheduler/
         │  │  ├─ media/
         │  │  ├─ python/        ← intérprete de Python (Pyodide en un Web Worker)
         │  │  ├─ appearance/    ← lista de fondos y avatares incluidos (descubiertos en system/)
         │  │  ├─ native.ts      ← único punto de acceso a window.native
         │  │  ├─ config/        ← lectura y validación de system/os.config.json
         │  │  └─ validation/    ← idioma de Zod y formato de errores de validación
         │  ├─ shell/             ← interfaz del sistema
         │  │  ├─ boot/  setup/  login/  power/
         │  │  ├─ desktop/  menubar/  dock/  launchpad/
         │  │  ├─ window-frame/  dialogs/  toasts/  context-menu/
         │  │  ├─ widgets-host/
         │  │  └─ theme/  wallpaper/  common/   ← aplicar el tema, fondo de pantalla, utilidades compartidas del shell
         │  ├─ sdk/               ← API pública para apps y widgets (alias @os/sdk)
         │  └─ ui/                ← componentes compartidos (alias @os/ui)
         ├─ apps/
         │  └─ <app-id>/
         │     ├─ meta/           ← TODO lo personalizable de la app
         │     │  ├─ manifest.json
         │     │  ├─ icon.svg
         │     │  ├─ cover.png    ← opcional, imagen de portada
         │     │  ├─ theme.css    ← opcional, variables de estilo propias
         │     │  └─ help.md      ← opcional, texto para la app Ayuda
         │     └─ src/
         │        ├─ index.tsx    ← exporta por defecto el componente raíz
         │        └─ ...
         ├─ widgets/
         │  └─ <widget-id>/
         │     ├─ meta/  (manifest.json, icon.svg, theme.css opcional)
         │     └─ src/index.tsx
         └─ system/               ← personalización global del SO (alias @system)
            ├─ os.config.json
            ├─ theme/tokens.css
            ├─ wallpapers/        ← cada imagen aquí aparece como fondo disponible
            ├─ avatars/           ← avatares incluidos para la cuenta (id = nombre del archivo sin extensión)
            ├─ sounds/            ← sonidos del sistema por nombre fijo
            ├─ icons/             ← íconos del sistema por nombre fijo
            └─ boot/logo.svg
```

### 3.2 Capas y dirección de dependencias

```
apps/*, widgets/*  →  @os/sdk, @os/ui  →  os/kernel  →  window.native (preload)  →  main
os/shell           →  os/kernel, @os/ui
```

Reglas estrictas:

1. **Una app nunca importa otra app**, ni widgets, ni `os/kernel`, ni `os/shell`. Solo importa `@os/sdk`, `@os/ui`, React y sus propios archivos.
2. **Un widget** sigue la misma regla que una app.
3. **Solo `os/kernel/storage`** toca Dexie/IndexedDB. Los demás servicios usan `storage`.
4. **Solo `os/kernel`** usa `window.native`. Ni las apps ni el shell llaman al puente directamente.
5. Los servicios del kernel se comunican entre sí por llamadas directas tipadas o por el bus de eventos; nunca a través de la interfaz.
6. El shell no contiene lógica de negocio: lee estado del kernel y llama a sus funciones.

### 3.3 Cumplimiento automático

Configura `no-restricted-imports` en ESLint para que `src/renderer/src/apps/**` y `src/renderer/src/widgets/**` fallen al importar cualquier ruta fuera de `@os/sdk`, `@os/ui`, `react`, dependencias permitidas y su propia carpeta. `npm run lint` debe fallar si se rompe la sección 3.2.

`no-restricted-imports` se usa para los paquetes externos de apps y widgets. Como no puede comparar rutas relativas ya resueltas, el resto de la sección 3.2 (una app no sale de su carpeta; kernel, shell, sdk y ui solo importan las capas permitidas; solo `kernel/storage` importa Dexie) lo hace la regla local `local/layer-boundaries` (`eslint/local-plugin.mjs`). El uso de `window.native` fuera de `os/kernel` se prohíbe con `no-restricted-syntax`.

### 3.4 Seguridad de Electron

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Content Security Policy:
  `default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob: mediastream:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self' 'wasm-unsafe-eval'`
  (`'wasm-unsafe-eval'` permite compilar WebAssembly, que Pyodide necesita; no autoriza `eval` ni `new Function` de JavaScript. En desarrollo, añadir solo lo que exija el servidor de Vite).
- Bloquear toda navegación (`will-navigate`) y apertura de ventanas (`setWindowOpenHandler` → `deny`).
- Permisos: `setPermissionRequestHandler` y `setPermissionCheckHandler` conceden **solo** `media` (cámara y micrófono) y **solo** al origen propio de la app. Todo lo demás se deniega. En macOS, pedir acceso con `systemPreferences.askForMediaAccess`.
- La ventana de Electron usa marco nativo, tamaño inicial 1440×900, mínimo 1024×700, barra de menú nativa oculta. Pantalla completa al iniciar según `os.config.json`.

---

## 4. Contratos

Todo lo de esta sección es obligatorio y compartido. Los nombres de funciones, campos y eventos deben coincidir exactamente.

### 4.1 Puente nativo (`window.native`)

Definido en `src/shared/native-api.ts`, implementado en `preload` y `main/ipc`.

```ts
interface NativeApi {
  files: {
    /** Abre el diálogo nativo del equipo real y devuelve los archivos elegidos. */
    importFromHost(options?: { multiple?: boolean; filters?: { name: string; extensions: string[] }[] })
      : Promise<{ name: string; mime: string; data: ArrayBuffer; lastModified: number }[]>;
  };
  auth: {
    hashPassword(password: string): Promise<{ hash: string; salt: string }>;   // crypto.scrypt en main
    verifyPassword(password: string, hash: string, salt: string): Promise<boolean>;
  };
  power: {
    quit(): void;              // cierra Electron (usado por "Apagar")
    toggleFullscreen(): void;
  };
  platform: { os: 'linux' | 'darwin' | 'win32' };
}
```

No se expone ninguna otra función del sistema real.

### 4.2 Base de datos (Dexie)

Nombre de la base: `simos`. Tablas:

| Tabla | Clave | Campos |
|---|---|---|
| `meta` | `key` | `value` (versión de esquema, `setupCompleted`, `lastUserId`: la última cuenta que inició sesión) |
| `user` | `id` | Un registro por cuenta: `name` (único sin distinguir mayúsculas), `avatar` (`{ type: 'builtin', id }` o `{ type: 'file', nodeId }`), `passwordHash`, `salt`, `createdAt`. El `id` es cualquier cadena única (la cuenta más antigua conserva `user`) |
| `nodes` | `id` | `parentId`, `name`, `kind` (`'file'`/`'folder'`), `mime`, `size`, `createdAt`, `modifiedAt`, `blobId`, `system` (bool, carpetas protegidas), `trash` (`{ originalParentId, originalName, trashedAt }` o `null`). Índice único compuesto `[parentId+name]` |
| `blobs` | `id` | `data` (`Blob`) |
| `settings` | `key` | `value`. Los ajustes son por usuario: la clave es `<id de la cuenta>:<clave del ajuste>` (por ejemplo `user:dock.gap`) |
| `appData` | `[appId+key]` | `appId`, `key`, `value` |
| `scheduled` | `id` | `appId`, `fireAt`, `title`, `body`, `sound`, `repeat` (`'none'`/`'daily'`/`'weekdays'`), `payload` |

Cualquier cambio de esquema incrementa la versión de Dexie con migración.

### 4.3 Sistema de archivos virtual (`kernel/fs`)

**Árbol inicial** (el sistema —raíz, papelera y `Usuarios/`— lo crea el asistente de primer arranque, y la carpeta de cada cuenta se crea al dar de alta a esa cuenta):

```
/
├─ .Papelera/                      (oculta, sistema)
└─ Usuarios/<nombre>/              (= "~", carpeta de inicio)
   ├─ Escritorio/  Documentos/  Descargas/
   ├─ Imágenes/   (con subcarpeta Cámara/)
   ├─ Música/     (con subcarpeta Grabaciones/)
   └─ Videos/     (con subcarpeta Cámara/)
```

Las carpetas del árbol inicial tienen `system: true`: no se pueden renombrar, mover ni borrar. Se siembra un archivo `~/Documentos/Bienvenida.txt`.

**Papelera:** `trash(path)` mueve el nodo (con todo su contenido) bajo `.Papelera/` y rellena `trash`. Si ya hay un elemento con ese nombre en la papelera se añade un sufijo, y `trash.originalName` conserva el nombre de origen para restaurarlo. El elemento es un hijo directo de `.Papelera`; solo ese nodo lleva `trash` distinto de `null`.

**Reglas:** rutas absolutas separadas por `/`; `~` se expande a la carpeta de inicio de la cuenta con la sesión abierta; nombres sensibles a mayúsculas; prohibidos `/`, nombre vacío, `.` y `..`. Si un nombre ya existe en el destino al duplicar, copiar o mover, se agrega un sufijo (`informe (2).txt`); al crear o renombrar a mano, se muestra error.

**API:**

```ts
interface FsApi {
  stat(path: string): Promise<FsNode>;
  list(path: string): Promise<FsNode[]>;            // excluye nodos en papelera y ocultos (nombre con '.')
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<Blob>;
  readText(path: string): Promise<string>;
  writeFile(path: string, data: Blob | string, opts?: { overwrite?: boolean; mime?: string }): Promise<FsNode>;
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<FsNode>;
  rename(path: string, newName: string): Promise<FsNode>;
  move(path: string, destDir: string): Promise<FsNode>;
  copy(path: string, destDir: string): Promise<FsNode>;   // recursivo para carpetas
  duplicate(path: string): Promise<FsNode>;
  trash(path: string): Promise<void>;
  listTrash(): Promise<FsNode[]>;
  restore(nodeId: string): Promise<FsNode>;          // si el padre original ya no existe, restaura en "~"
  deletePermanently(nodeId: string): Promise<void>;
  emptyTrash(): Promise<void>;
  importFromHost(destDir: string, opts?: { multiple?: boolean }): Promise<FsNode[]>;
  getObjectUrl(path: string): Promise<{ url: string; revoke(): void }>;
  pathOf(nodeId: string): Promise<string>;
  usage(): Promise<{ bytes: number; files: number }>;
}
```

El tipo MIME se deduce por extensión con una tabla única en `src/shared/mime.ts` (la usan también los handlers de `main`); `kernel/fs/mime.ts` la reexporta. Cada operación que modifica algo emite `fs:changed`.

### 4.4 Bus de eventos (`kernel/events`)

Mapa tipado en `kernel/events/types.ts`. Eventos iniciales:

| Evento | Datos |
|---|---|
| `fs:changed` | `{ kind: 'create' \| 'update' \| 'delete' \| 'move' \| 'trash' \| 'restore', nodeId, parentId, oldParentId? }` |
| `settings:changed` | `{ key, value }` |
| `session:locked`, `session:unlocked`, `session:logout` | `{}` |
| `power:restart`, `power:shutdown` | `{}` |
| `app:launched`, `app:terminated` | `{ appId, instanceId }` |
| `window:opened`, `window:closed`, `window:focused` | `{ windowId, appId }` |
| `notification:posted` | `{ id, appId }` |
| `media:active` | `{ camera: boolean, microphone: boolean }` |
| `scheduler:fired` | `{ jobId, appId }` |

Agregar eventos nuevos solo en este archivo y en esta tabla.

### 4.5 Configuración (`kernel/settings`)

Claves válidas (tipadas y con valor por defecto en un único archivo `kernel/settings/schema.ts`):

```
appearance.theme        'light' | 'dark' | 'auto'
appearance.accent       string (hex)
appearance.wallpaper    { type: 'builtin', id } | { type: 'file', nodeId }
desktop.items           { id, kind: 'app' | 'node', ref, x, y }[]
desktop.widgets         { id, widgetId, size, x, y }[]
dock.pinned             string[]   (appIds en orden)
dock.iconSize           number
dock.gap                number   (espaciado entre elementos del Dock, en px; 0–24)
sound.volume            number 0–100
sound.muted             boolean
sound.systemSounds      boolean
datetime.timezone       string (IANA)
datetime.hour24         boolean
fileAssociations.defaults Record<extension, appId>
```

`get`, `set`, `subscribe`. Cada `set` emite `settings:changed`. Los valores por defecto iniciales (tema, acento, fondo) se leen de `os.config.json`. **Todos los ajustes son por cuenta**: al iniciar sesión se cargan los de esa cuenta (`load(idDeCuenta)`) y los cambios se guardan con su prefijo; una cuenta nueva empieza con los valores por defecto y el tema que elija al crearla. En la pantalla de inicio de sesión se muestran el fondo y el tema de la cuenta elegida. `preview(clave, valor)` cambia un ajuste solo en memoria (la vista previa del asistente).

### 4.6 Manifiesto de app (`apps/<id>/meta/manifest.json`)

```json
{
  "id": "text-editor",
  "name": "Editor de texto",
  "description": "Crea y edita documentos de texto plano y Markdown.",
  "version": "1.0.0",
  "author": "",
  "icon": "icon.svg",
  "cover": "cover.png",
  "category": "productividad",
  "launchpad": { "visible": true, "order": 20 },
  "dock": { "pinnedByDefault": true },
  "window": {
    "width": 760, "height": 520,
    "minWidth": 380, "minHeight": 260,
    "resizable": true,
    "singleInstance": false
  },
  "fileAssociations": [
    { "extensions": ["txt", "md"], "role": "editor", "priority": 10 }
  ],
  "permissions": []
}
```

- `id`: igual al nombre de la carpeta, en kebab-case. Es la identidad permanente; `name` puede cambiarse libremente.
- `icon`, `cover`: nombres de archivo dentro de `meta/`. `cover` es opcional.
- `category`: `sistema` | `productividad` | `multimedia` | `utilidades`.
- `fileAssociations[].role`: `editor` | `viewer`. Mayor `priority` gana como app predeterminada si el usuario no eligió otra.
- `permissions`: subconjunto de `camera`, `microphone`, `settings:write`, `system:processes`, `system:account`, `python`.

El esquema Zod vive en `kernel/apps/manifest.schema.ts`. Un manifiesto inválido hace que la app se omita, con error en consola que indique qué campo falla.

**Descubrimiento automático:** el registro usa `import.meta.glob` sobre `apps/*/meta/manifest.json`, `apps/*/meta/*.{svg,png,jpg,webp}` (como URL), `apps/*/meta/theme.css`, `apps/*/meta/help.md` (como texto) y `apps/*/src/index.tsx` (carga diferida con `React.lazy`). **Agregar una carpeta de app es suficiente para que exista en el sistema**; no hay listas escritas a mano en ningún otro lado.

**Estilos por app:** `theme.css` solo puede definir variables CSS bajo el selector `[data-app-id="<id>"]`. El marco de ventana pone ese atributo en el contenedor de la app.

### 4.7 Manifiesto de widget (`widgets/<id>/meta/manifest.json`)

```json
{
  "id": "clock",
  "name": "Reloj",
  "description": "Hora y fecha actuales.",
  "icon": "icon.svg",
  "sizes": ["small", "medium"],
  "defaultSize": "small",
  "ownerApp": null
}
```

`ownerApp`: si tiene un appId, el widget lee y escribe en el `appData` de esa app (así el widget de calendario ve los eventos de la app Calendario); si es `null`, usa un `appData` propio cuyo `appId` es `widget:<id>`. **Formato de los eventos del Calendario** (clave `event:<id>`): `{ id, title, date: "AAAA-MM-DD", start: "HH:mm", end: "HH:mm", note?, reminder?: minutos antes | null }`. Tamaños: `small` 160×160, `medium` 340×160, `large` 340×340.

### 4.8 SDK para apps (`@os/sdk`)

```ts
function useOS(): {
  app: { id: string; manifest: AppManifest; instanceId: string };
  system: { name: string; version: string };   // de os.config.json; nunca se escribe a mano en la interfaz
  fs: FsApi;
  window: {
    setTitle(title: string): void;
    close(): Promise<void>;          // respeta cambios sin guardar
    focus(): void;
  };
  dialogs: DialogsApi;               // ver 4.9
  notify(n: { title: string; body?: string; sound?: boolean; launchArgs?: LaunchArgs }): void;
  storage: {                         // appData con espacio de nombres de esta app
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
    list<T>(prefix?: string): Promise<{ key: string; value: T }[]>;
  };
  settings: {                        // lectura para todas; escritura solo con 'settings:write'
    get<K extends SettingKey>(key: K): SettingValue<K>;
    getDefault<K extends SettingKey>(key: K): SettingValue<K>;   // valor de fábrica, para "restablecer"
    set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void>;
  };
  sound: { playSystem(name: SystemSound): void };
  apps: {
    launch(appId: string, args?: LaunchArgs): void;
    openFile(path: string, appId?: string): void;     // sin appId usa la predeterminada
    getAppsForFile(path: string): AppManifest[];
    list(): AppManifest[];
    getIconUrl(appId: string): string | undefined;    // URL del ícono declarado en el manifiesto
    getCoverUrl(appId: string): string | undefined;   // URL de la portada (cover), si la declara
    getHelp(appId: string): string | undefined;       // contenido de meta/help.md, si existe
  };
  scheduler: {
    schedule(job: Omit<ScheduledJob, 'id' | 'appId'>): Promise<string>;
    cancel(id: string): Promise<void>;
    list(): Promise<ScheduledJob[]>;
  };
  media: {                           // exige 'camera' / 'microphone' en el manifiesto
    getCamera(constraints?: MediaTrackConstraints): Promise<MediaStream>;
    getMicrophone(): Promise<MediaStream>;
    listCameras(): Promise<MediaDeviceInfo[]>;
  };
  python: {                          // exige 'python' en el manifiesto (4.15)
    run(job: { code: string; filename?: string; args?: string[] }, io: PythonIo): PythonRun;
  };
  events: { on<E extends EventName>(e: E, h: (d: EventData<E>) => void): () => void };
};

type LaunchArgs = { filePath?: string; [key: string]: unknown };

// Hooks
function useLaunchArgs(): LaunchArgs;
function useOpenFileHandler(handler: (path: string) => void): void;   // apps singleInstance reciben archivos nuevos aquí
function useSetting<K extends SettingKey>(key: K): SettingValue<K>;
function useSystemVolume(): number;                                    // 0–1, ya considera "silenciado"
function useFsWatch(path: string): FsNode[];                           // lista reactiva de una carpeta
function useAppMenus(menus: AppMenu[]): void;                          // menús de la barra superior
function useUnsavedChanges(opts: {
  isDirty: boolean;
  documentName: string;
  save: () => Promise<boolean>;      // true si guardó; false si el usuario canceló (p. ej. en "Guardar como")
}): { confirmDiscard(): Promise<boolean> };   // para acciones propias que descartarían cambios ("Nuevo"): false = abortar

// Solo para widgets (no es `useOS`): { widget, fs, storage (de ownerApp o propio), settings.get, events }
function useWidgetOS(): WidgetOSApi;

// Lectura abierta a todas las apps
function useAppearance(): {              // fondos y avatares incluidos (system/wallpapers, system/avatars) y colores de acento (os.config.json)
  wallpapers: { id: string; url: string }[];
  avatars: { id: string; url: string }[];
  accentColors: { name: string; value: string }[];
};

// Servicios restringidos, solo con permiso en el manifiesto
function useProcesses(): {               // 'system:processes'
  list(now?: number): ProcessInfo[];     // procesos del sistema y de las apps, con métricas simuladas
  stats(now?: number): { cpu: number; memoryUsedMB: number; memoryTotalMB: number };
  subscribe(listener: () => void): () => void;     // avisa cuando se abre o se cierra una instancia
  forceQuit(instanceId: string): Promise<boolean>; // aviso de pérdida de datos + flujo de 4.9; false si se canceló
};
function useAccount(): {                 // 'system:account'
  user: { id: string; name: string; avatar: Avatar } | null;   // reactivo; la cuenta con la sesión abierta
  rename(name: string): Promise<void>;             // también renombra la carpeta de inicio
  setAvatar(avatar: Avatar): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;   // lanza Error (en español) si la actual no coincide
};
```

Llamar a una función restringida sin el permiso lanza un error explícito con el nombre del permiso faltante.

### 4.9 Diálogos y cambios sin guardar

```ts
interface DialogsApi {
  alert(o: { title: string; message?: string }): Promise<void>;
  confirm(o: { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean }): Promise<boolean>;
  prompt(o: { title: string; message?: string; defaultValue?: string; validate?: (v: string) => string | null }): Promise<string | null>;
  choose<T extends string>(o: { title: string; message?: string; options: { value: T; label: string; destructive?: boolean }[] }): Promise<T | null>;
  openFile(o?: { startPath?: string; extensions?: string[]; multiple?: boolean; folders?: boolean }): Promise<string[] | null>;
  saveFile(o?: { startPath?: string; defaultName?: string; extensions?: string[] }): Promise<string | null>;
  info(nodeId: string): Promise<void>;     // ficha de "Información" de un archivo o carpeta
}
```

- Llamados desde una app, los diálogos son **modales de ventana**: aparecen como hoja (sheet) que baja desde la barra de título y bloquean solo esa ventana.
- Llamados desde el shell, son **modales de sistema**: centrados, con fondo atenuado, bloquean todo.
- `openFile`/`saveFile` usan el componente `FileBrowser` de `@os/ui`, el mismo que usa la app Archivos.

**Flujo único de cambios sin guardar.** Cuando una ventana con `isDirty: true` va a cerrarse por cualquier motivo, el sistema (no la app) muestra:

> **¿Guardar los cambios de "<documentName>"?**
> Si no los guardas, se perderán.
> [No guardar] [Cancelar] [Guardar]

- *Guardar* → llama a `save()`; si devuelve `false`, se cancela el cierre.
- *Cancelar* → se aborta la operación completa.

Esto aplica, sin excepción, a: cerrar la ventana, "Cerrar <App>" desde la barra de menú o el Dock, "Forzar cierre" en el Administrador de tareas (con aviso adicional de pérdida de datos), cerrar sesión, reiniciar y apagar (se recorren las ventanas con cambios una por una; cancelar cualquiera aborta la acción de energía), y abrir otro archivo en la misma ventana de una app con cambios sin guardar.

Las apps con autoguardado (Notas, Contactos, Calendario) nunca marcan `isDirty`.

### 4.10 Ventanas (`kernel/windows`)

```ts
interface WindowState {
  id: string; appId: string; instanceId: string;
  title: string;
  x: number; y: number; width: number; height: number;
  state: 'normal' | 'minimized' | 'maximized';
  zIndex: number; focused: boolean;
  hasSheet: boolean;      // diálogo modal de ventana abierto
}
```

- Cada lanzamiento de app crea una instancia (`instanceId`) registrada en `kernel/processes` y una ventana.
- `singleInstance: true` → si ya está abierta, se enfoca y recibe el archivo por `useOpenFileHandler`.
- Las ventanas nuevas se colocan en cascada y nunca fuera del área útil (entre la barra de menú y el Dock).
- No se restauran ventanas entre sesiones.

### 4.11 Procesos (`kernel/processes`)

Registro de instancias de app en ejecución, más procesos ficticios del sistema (`WindowServer`, `Dock`, `Servicios`, etc.) para dar realismo. Cada proceso tiene `pid` numérico, nombre, appId opcional, hora de inicio y métricas simuladas de CPU (%) y memoria (MB) que varían de forma suave y determinista. Memoria total simulada: valor de `os.config.json`.

### 4.12 Programador (`kernel/scheduler`)

Revisa la tabla `scheduled` cada segundo mientras la sesión está iniciada. Al llegar `fireAt`: publica la notificación, reproduce el sonido `alarm` si `sound: true`, emite `scheduler:fired`, y reprograma según `repeat` o elimina el trabajo. Los avisos vencidos mientras la sesión estaba cerrada se disparan una sola vez al iniciar sesión. Funciona aunque la app dueña esté cerrada.

### 4.13 Sonido (`kernel/sound`)

Nombres fijos de sonidos del sistema: `boot`, `login`, `logout`, `shutdown`, `notification`, `error`, `trash`, `empty-trash`, `alarm`, `shutter`, `lock`.

Se busca `system/sounds/<nombre>.{mp3,ogg,wav}`. **Si el archivo no existe, se genera un tono equivalente con Web Audio**, para que el sistema funcione sin archivos de audio y Eduardo pueda reemplazarlos después. El volumen del sistema (`sound.volume`, `sound.muted`) afecta a los sonidos del sistema y, mediante `useSystemVolume()`, a Música, Videos, Grabadora y Reloj. Si `sound.systemSounds` es `false`, solo suenan `alarm` y `shutter`.

### 4.14 Medios (`kernel/media`)

Envuelve `getUserMedia`. Verifica el permiso del manifiesto, lleva la cuenta de streams activos por tipo, emite `media:active` y detiene todos los streams de una instancia cuando esta termina. La barra de menú muestra un punto verde (cámara) o naranja (micrófono) mientras haya streams activos.

### 4.15 Python (`kernel/python`)

Ejecuta programas de Python con Pyodide dentro de un Web Worker propio (un archivo real: la CSP no admite workers `blob:`), de modo que la interfaz no se bloquea y un programa se puede cortar. Los archivos de Pyodide se empaquetan en `pyodide/` junto al renderer, con su nombre original.

```ts
interface PythonIo { onStdout(text: string): void; onStderr(text: string): void; onLoading?(): void }
interface PythonRun { result: Promise<{ exitCode: number; cancelled: boolean }>; cancel(): void }
```

- Solo se ejecuta un programa a la vez; pedir otro mientras corre falla con un error en español.
- Solo biblioteca estándar: sin `pip` ni red. `input()` no está disponible (lee un fin de archivo). El `open()` de Python **no** ve el sistema de archivos virtual: trabaja en un sistema de archivos en memoria que desaparece al terminar el programa.
- `cancel()` termina el worker; la siguiente ejecución crea uno nuevo (y vuelve a pagar el arranque). Al terminar la instancia de la app que lo lanzó, o al cerrar sesión, reiniciar o apagar, el programa se corta.
- La primera ejecución carga Pyodide (unos segundos); `onLoading` avisa de ello.
---

## 5. Personalización (sistema y apps)

El objetivo es que todo lo visual y descriptivo se pueda cambiar después del desarrollo **sin tocar código**, solo editando archivos en `meta/` o en `system/`.

### 5.1 Por app (`apps/<id>/meta/`)

| Archivo | Qué controla |
|---|---|
| `manifest.json` | Nombre, descripción, versión, autor, categoría, orden y visibilidad en Launchpad, anclaje inicial en el Dock, tamaño de ventana, asociaciones de archivo |
| `icon.svg` (o `.png`) | Ícono en Dock, Launchpad, escritorio, Administrador de tareas, Ayuda, notificaciones, "Abrir con…" y "Acerca de" |
| `cover.png` | Imagen de portada en la ventana "Acerca de <App>" y en la Ayuda |
| `theme.css` | Variables de estilo propias de la app |
| `help.md` | Contenido de la sección de esa app en la Ayuda |

Cada app muestra en su menú de la barra superior un elemento **"Acerca de <App>"**, que abre una ventana con ícono, portada, nombre, descripción, versión y autor leídos del manifiesto. Esto hace visible cualquier cambio de metadatos.

### 5.2 Del sistema (`system/`)

`os.config.json`:

```json
{
  "name": "OrigamiOS",
  "version": "1.0",
  "bootDurationMs": 2500,
  "startFullscreen": false,
  "simulatedMemoryMB": 16384,
  "defaults": {
    "theme": "light",
    "accent": "#0A84FF",
    "wallpaper": "aurora",
    "timezone": "America/Caracas",
    "hour24": false
  },
  "accentColors": [
    { "name": "Azul", "value": "#0A84FF" }
  ]
}
```

- `accentColors`: los colores de acento que ofrece Configuración (nombre y valor hexadecimal). Hay que dejar al menos uno.
- `theme/tokens.css`: todas las variables de color, radios, sombras, desenfoque, tipografía y duraciones de animación, para tema claro y oscuro. **Ningún componente usa colores escritos a mano**; todo sale de estas variables.
- `wallpapers/`: cualquier imagen colocada aquí aparece en Configuración; el `id` es el nombre del archivo sin extensión.
- `sounds/`: ver 4.13.
- `icons/`: íconos del sistema con nombres fijos: `folder.svg`, `folder-system.svg`, `file-generic.svg`, `file-text.svg`, `file-python.svg`, `file-image.svg`, `file-audio.svg`, `file-video.svg`, `trash-empty.svg`, `trash-full.svg`, `launchpad.svg`, `system-menu.svg`, `avatar-default.svg`.
- `boot/logo.svg`: logo de la pantalla de arranque y del menú del sistema.

---

## 6. Diseño visual

- Tipografía Inter. Tamaño base 13 px en la interfaz del sistema.
- Barra de menú: 28 px de alto, translúcida con desenfoque.
- Dock: centrado abajo, translúcido, esquinas de 18 px, ampliación suave del ícono al pasar el cursor, punto bajo las apps abiertas, separador entre apps ancladas, apps abiertas no ancladas y la Papelera. El tamaño de los íconos (`dock.iconSize`) y el espaciado entre elementos (`dock.gap`) los elige el usuario en Configuración.
- Ventanas: esquinas de 10 px, sombra suave, barra de título integrada de 38 px, botones amarillo/verde/rojo de 16 px a la derecha (minimizar, maximizar, cerrar) con glifo al pasar el cursor; ventana sin foco con barra atenuada y botones grises.
- Animaciones de 150 a 250 ms: abrir/cerrar ventana (escala + opacidad), minimizar hacia su ícono del Dock, Launchpad (desenfoque + escala), hojas modales (deslizamiento desde la barra de título).
- Tema claro, oscuro y automático (sigue al sistema real con `prefers-color-scheme`).
- Íconos de apps originales en SVG: escuadra redondeada (squircle) con degradado y glifo simple, todos con la misma retícula y estilo.
- Generar entre 4 y 6 fondos de pantalla propios (SVG o PNG generados: degradados y formas abstractas, claros y oscuros). Uno se llama `aurora`.
- Componentes de `@os/ui` mínimos y reutilizados por todas las apps: `Button`, `IconButton`, `TextField`, `TextArea`, `Select`, `Toggle`, `Slider`, `SegmentedControl`, `Sidebar`, `List`, `Toolbar`, `Tabs`, `EmptyState`, `AppIcon`, `FileIcon`, `FileBrowser`, `ContextMenu`, `Popover`, más `Avatar` (avatar de la cuenta) y `FsImage` (miniatura de una imagen del sistema de archivos). Ninguna app reimplementa uno de estos. `Checkbox` se añadirá a esta lista el día que una app lo necesite; hasta la Fase 6 ninguna lo ha hecho, y no se crea un componente sin uso.

---

## 7. Fases

Reglas para todas las fases:

1. Trabaja **solo** en la fase indicada. No adelantes funciones de fases posteriores.
2. Respeta los contratos de la sección 4 tal como están escritos.
3. Al terminar, todo esto debe pasar sin errores ni advertencias: `npm run typecheck`, `npm run lint`, `npm run build`.
4. Recorre la lista de verificación de la fase y confirma cada punto.
5. Actualiza `docs/PROGRESO.md` con: qué se hizo, desviaciones respecto a esta especificación (y por qué), y cualquier contrato modificado.
6. No dejes `TODO`, código comentado ni funciones a medio hacer en lo entregado en la fase.
7. Detente y resume. No inicies la fase siguiente.

### Fase 0 — Base del proyecto y estructura

**Objetivo:** proyecto que arranca, seguro, con toda la estructura y todos los manifiestos en su lugar.

- Crear el proyecto con electron-vite (React + TypeScript), alias `@os/sdk`, `@os/ui` y `@system`, ESLint con la regla de la sección 3.3.
- Implementar la sección 3.4 completa (seguridad, CSP, permisos, ventana).
- Implementar el puente de la sección 4.1 (tipos, preload y handlers en main).
- Crear `system/` con `os.config.json`, `tokens.css` (claro y oscuro), logo, íconos del sistema y los fondos de pantalla.
- Crear la carpeta de **las 17 apps** con su `meta/` completo (manifiesto válido + ícono SVG original) y un `src/index.tsx` provisional con `EmptyState` "Disponible pronto". IDs: `files`, `text-editor`, `terminal`, `settings`, `calculator`, `task-manager`, `calendar`, `clock`, `notes`, `contacts`, `image-viewer`, `music`, `videos`, `paint`, `voice-recorder`, `camera`, `help`.
- Crear las carpetas de los 4 widgets (`clock`, `calendar` con `ownerApp: "calendar"`, `quick-note`, `system-status`) con `meta/` completo y componente provisional.
- Esquema Zod de manifiestos y registro con descubrimiento automático (sección 4.6).
- Pantalla temporal que lista las apps registradas con ícono, nombre y descripción (se elimina en la Fase 2).
- Crear `CLAUDE.md` con: "La especificación es `ESPECIFICACION.md`; léela antes de cada fase y sigue las reglas de la sección 7", más los comandos del proyecto. Crear `docs/PROGRESO.md`.

**Verificación:** la app abre; la pantalla temporal muestra 17 apps con su ícono; cambiar el `name` en un manifiesto se refleja en la pantalla; un manifiesto inválido se omite con error claro; `lint` falla si una app importa algo de `os/kernel`; la consola de DevTools no muestra advertencias de seguridad de Electron.

### Fase 1 — Núcleo y sesión

**Objetivo:** todos los servicios del kernel funcionando y el ciclo de sesión completo.

- `events`, `storage` (esquema 4.2), `fs` (4.3, incluida papelera e importación), `settings` (4.5), `sound` (4.13), `notifications` (servicio; la interfaz de las notificaciones va en la Fase 2), `scheduler` (4.12), `processes` (4.11), `media` (4.14), `session`.
- Pantalla de arranque: logo y barra de progreso durante `bootDurationMs`, sonido `boot`.
- Asistente de primer arranque: bienvenida → nombre → contraseña y confirmación (mínimo 4 caracteres) → avatar (íconos incluidos) → tema claro/oscuro → crea usuario, árbol de carpetas y valores por defecto. El mismo asistente, sin la bienvenida y con opción de cancelar, crea cuentas adicionales desde la pantalla de inicio de sesión; el nombre no puede repetirse (sin distinguir mayúsculas).
- Pantalla de bloqueo / inicio de sesión estilo macOS: fondo, hora y fecha grandes; al hacer clic o pulsar una tecla aparece avatar, nombre y campo de contraseña (con varias cuentas, primero se elige la cuenta entre sus avatares, y hay una opción «Nuevo usuario»; al bloquear solo aparece la cuenta con la sesión abierta). Contraseña incorrecta: animación de sacudida y sonido `error`.
- Flujo de energía (`shell/power`): bloquear, cerrar sesión, reiniciar (vuelve a la pantalla de arranque) y apagar (pantalla "Apagando…" y luego `native.power.quit()`). En esta fase, sin ventanas todavía, el flujo de cambios sin guardar queda preparado como un paso que recorre las ventanas abiertas.
- Tras iniciar sesión, mostrar la pantalla temporal de la Fase 0.

**Verificación:** primer arranque crea el usuario y el árbol; al reiniciar Electron se pide contraseña (no el asistente); la contraseña se guarda con hash y sal, nunca en texto plano; bloquear y desbloquear funciona; los sonidos suenan aunque no existan archivos en `system/sounds/`; los datos persisten al cerrar y abrir Electron.

### Fase 2 — Shell y ventanas

**Objetivo:** el escritorio completo con ventanas reales; las apps siguen siendo provisionales.

- Eliminar la pantalla temporal.
- Gestor de ventanas (4.10) y marco de ventana: arrastrar por la barra de título, redimensionar por bordes y esquinas, minimizar con animación hacia el Dock, maximizar (área útil) y restaurar con doble clic en la barra de título, foco y apilamiento.
- Diálogos (4.9): hojas modales de ventana, modales de sistema, `FileBrowser` en `@os/ui`, `openFile`/`saveFile` funcionales sobre el FS, y el flujo único de cambios sin guardar conectado a cerrar ventana y a las acciones de energía.
- Barra de menú: a la izquierda el menú del sistema (logo) con Configuración, Bloquear, Cerrar sesión, Reiniciar y Apagar; luego el nombre de la app activa con "Acerca de <App>" y "Cerrar <App>"; luego los menús declarados con `useAppMenus`. A la derecha: indicadores de cámara/micrófono, volumen (popover con deslizador), batería (real con `navigator.getBattery` si existe; si no, 100 % conectado) y reloj según `datetime`.
- Dock (sección 6): apps ancladas desde `dock.pinned` (inicialmente las de `pinnedByDefault`), apps abiertas, Launchpad, Papelera con estado vacío/lleno. Clic abre, enfoca o restaura. Menú contextual: Abrir, Mantener en el Dock / Quitar del Dock, Cerrar. Soltar archivos sobre la Papelera los envía a ella; clic en la Papelera abre Archivos en la Papelera.
- Launchpad: pantalla completa con desenfoque, cuadrícula de todas las apps con `launchpad.visible`, ordenadas por `order` y luego por nombre, buscador por nombre y descripción, `Esc` para cerrar. Menú contextual: Abrir, Añadir al escritorio, Añadir al Dock.
- Escritorio: fondo según `appearance.wallpaper`; muestra los archivos de `~/Escritorio` y los accesos a apps de `desktop.items`; íconos arrastrables con posición guardada y ajuste a una retícula invisible; selección con clic y con rectángulo; doble clic abre. Menú contextual del fondo: Nueva carpeta, Añadir widget (submenú), Cambiar fondo de pantalla (abre Configuración), Ordenar íconos. Menú de un elemento: Abrir, Abrir con…, Renombrar, Mover a la papelera (archivos) o Quitar del escritorio (apps), Información.
- Widgets: capa entre el fondo y los íconos; arrastrar para mover; al pasar el cursor, botón para quitar y opción de cambiar tamaño entre los permitidos; estado en `desktop.widgets`. Implementar los 4 widgets: Reloj, Calendario (mes actual y próximos eventos desde el `appData` de Calendario; vacío mientras esa app no exista), Nota rápida (texto con autoguardado), Estado del sistema (batería, red y espacio usado).
- Notificaciones emergentes arriba a la derecha, con ícono de la app, desaparecen a los 5 s; clic lanza la app con sus `launchArgs`.
- Arrastrar y soltar entre escritorio, ventanas y Papelera con el tipo de dato propio `application/x-simos-node`.
- Asociaciones de archivo: resolver la app predeterminada (`fileAssociations.defaults` o mayor `priority`) y el submenú "Abrir con…", que incluye "Elegir siempre esta app".

**Verificación:** abrir varias apps provisionales y manipular sus ventanas; un botón de prueba en una app provisional que marca `isDirty` dispara el diálogo al cerrar y al apagar (quitar el botón al terminar la fase); widgets, íconos y Dock conservan su estado tras cerrar sesión y tras reiniciar Electron; los diálogos de ventana bloquean solo su ventana.

### Fase 3 — Apps del sistema

- **Archivos** (`files`): barra lateral (Inicio, Escritorio, Documentos, Descargas, Imágenes, Música, Videos, Papelera); vista de íconos y de lista con columnas Nombre, Tamaño, Tipo y Modificado, ordenables; navegación atrás/adelante/arriba y barra de ruta; crear carpeta, renombrar (F2 o menú), Duplicar, Copiar a…, Mover a…, Mover a la papelera, Información (metadatos), Abrir con…; selección múltiple; arrastrar y soltar entre carpetas y hacia el escritorio o el Dock; botón **Importar desde el equipo…** que importa a la carpeta actual; vista Papelera con Restaurar, Eliminar definitivamente y Vaciar papelera (confirmación destructiva y sonido `empty-trash`). Acepta `launchArgs.filePath` o `{ view: 'trash' }`.
- **Terminal** (`terminal`): prompt `<usuario>@<nombre-del-so>:<ruta>$`; comandos `help`, `ls [-l]`, `cd`, `pwd`, `mkdir [-p]`, `touch`, `cat`, `echo` (con `>` y `>>`), `rm [-r]` (envía a la papelera), `mv`, `cp [-r]`, `tree`, `open <archivo>`, `python <archivo.py>` y `python -c "<código>"` (4.15; `Ctrl+C` corta el programa), `date`, `whoami`, `clear`, `history`; flechas arriba/abajo para historial; Tab para autocompletar rutas; errores con formato estilo Unix. Usa exclusivamente `fs`, `apps` y `python` del SDK.
- **Configuración** (`settings`, permisos `settings:write` y `system:account`): secciones Apariencia (tema, acento con colores predefinidos, fondo con miniaturas de `system/wallpapers` y de cualquier imagen del FS), Escritorio y Dock (tamaño de íconos del Dock, espaciado entre sus elementos, restablecer orden de íconos, restablecer apps ancladas), Sonido (volumen, silencio, sonidos del sistema con botón de prueba), Fecha y hora (zona horaria, formato 24 h), Cuenta (nombre, avatar desde íconos incluidos o imagen del FS, cambiar contraseña pidiendo la actual). Acepta `launchArgs.section`.
- **Administrador de tareas** (`task-manager`, permiso `system:processes`, `singleInstance`): pestaña Procesos (tabla con nombre, ícono, PID, CPU, memoria, ordenable, Forzar cierre según 4.9) y pestaña Rendimiento (gráficas de CPU y memoria de los últimos 60 s, dibujadas en canvas o SVG sin librerías externas).

**Verificación:** todo lo que hace la Terminal se refleja al instante en Archivos y en el escritorio, y viceversa (vía `fs:changed`); cambiar tema, acento o fondo se aplica en vivo en todo el sistema; un archivo importado del equipo real se abre en su app asociada.

### Fase 4 — Apps de productividad

- **Editor de texto** (`text-editor`): abrir, guardar, guardar como (`saveFile`), nuevo; `.txt` y `.md` (sus diálogos también listan los `.py`, que se editan como texto); título "nombre — Editor de texto" con punto de cambios sin guardar; `useUnsavedChanges`; buscar (Ctrl+F); contador de palabras y caracteres; tamaño de letra; sangría de 4 espacios con `Tab` y `Mayús+Tab`, sangría automática en `Enter` (un nivel más tras `:` en un `.py`) y `Retroceso` por niveles, para poder escribir Python; menús Archivo y Edición con `useAppMenus`; Ctrl+S, Ctrl+Shift+S, Ctrl+N y Ctrl+O cuando su ventana tiene el foco.
- **Calculadora** (`calculator`, ventana pequeña no redimensionable): operaciones básicas, porcentaje, cambio de signo, borrar; soporte de teclado; historial lateral plegable. Sin `eval`.
- **Calendario** (`calendar`): vistas de mes y día; crear, editar y borrar eventos con título, fecha, hora de inicio y fin, nota y recordatorio (sin recordatorio, al inicio o 5/15/30/60 minutos antes) programado con `scheduler`; datos en `storage` con el formato que consume el widget de Calendario (documentarlo en `docs/PROGRESO.md`).
- **Reloj** (`clock`): pestañas Reloj mundial (añadir/quitar ciudades por zona IANA), Alarmas (hora, repetición, etiqueta, activar/desactivar, vía `scheduler`), Temporizador (también vía `scheduler`, para sonar aunque se cierre la app) y Cronómetro (con vueltas).
- **Notas** (`notes`): lista con búsqueda, crear, borrar (confirmación), fijar, autoguardado; título tomado de la primera línea.
- **Contactos** (`contacts`): lista alfabética con búsqueda; ficha con nombre, apellido, teléfonos, correos, dirección, cumpleaños, notas y foto (imagen del FS); crear, editar y borrar con confirmación; autoguardado.

**Verificación:** una alarma o recordatorio suena y notifica con la app cerrada; los eventos aparecen en el widget de Calendario; cerrar el Editor con cambios muestra el diálogo único; Notas, Contactos y Calendario nunca muestran ese diálogo.

### Fase 5 — Apps multimedia

- **Visor de imágenes** (`image-viewer`, `viewer` de png, jpg, jpeg, gif, webp, svg, bmp): ajustar a ventana, zoom con rueda y botones, desplazamiento, rotación de vista, anterior/siguiente dentro de la misma carpeta, "Establecer como fondo de pantalla" (escribe `appearance.wallpaper` mediante un evento o `apps.launch('settings', …)`, nunca con `settings.set` porque no tiene `settings:write`), Información.
- **Música** (`music`, `singleInstance`, `viewer` de mp3, ogg, wav, flac, m4a): biblioteca que recorre `~/Música` recursivamente, cola de reproducción, reproducir/pausar/anterior/siguiente, barra de progreso, aleatorio y repetir; volumen propio multiplicado por `useSystemVolume()`; título desde el nombre del archivo; sigue sonando con la ventana minimizada.
- **Videos** (`videos`, `viewer` de mp4, webm, ogg, mov): controles propios (no los nativos del navegador), barra de progreso, volumen con `useSystemVolume()`, pantalla completa dentro de la ventana, lista de videos de la misma carpeta.
- **Paint** (`paint`, `editor` de png): lienzo con tamaño configurable al crear; pincel, lápiz, borrador, línea, rectángulo, elipse, relleno por inundación, cuentagotas, texto; paleta y selector de color; grosor; deshacer y rehacer (mínimo 30 pasos); abrir imagen existente, guardar y guardar como `.png`; `useUnsavedChanges`.
- **Grabadora de voz** (`voice-recorder`, permiso `microphone`): grabar, pausar y detener con `MediaRecorder`; visualización de onda en tiempo real; guarda en `~/Música/Grabaciones/` como `.webm` con nombre por fecha y hora; lista de grabaciones con reproducir, renombrar y borrar.
- **Cámara** (`camera`, permiso `camera`, `singleInstance`): vista previa en vivo; modos Foto y Video (con audio solo si el manifiesto incluye `microphone`; inclúyelo); disparador con sonido `shutter` y destello; temporizador opcional de 3 y 10 s; espejo activable; selector de cámara si hay varias (`listCameras`); fotos `.png` en `~/Imágenes/Cámara/` y videos `.webm` en `~/Videos/Cámara/`; miniatura de la última captura que la abre en el Visor o en Videos; mensajes claros si no hay cámara o se deniega el permiso; al cerrar la ventana se apaga la cámara y desaparece el indicador de la barra de menú.

**Verificación:** una foto tomada aparece al instante en Archivos y se puede poner como fondo; el volumen del sistema afecta a Música y Videos; la luz de la cámara del equipo se apaga al cerrar la app; abrir un `.png` desde Archivos usa el Visor por defecto y "Abrir con… → Paint" lo edita.

### Fase 6 — Ayuda, personalización y pulido

- **Ayuda** (`help`, `singleInstance`): portada con el nombre del SO; sección "Primeros pasos" (escritorio, Dock, Launchpad, ventanas, archivos, papelera); una sección por app generada desde el registro con ícono, portada, nombre, descripción y el contenido de su `help.md` (renderizar un subconjunto simple de Markdown con un parser propio: títulos, párrafos, listas, negritas, cursivas y código en línea); buscador. Escribir `help.md` para las 17 apps.
- Escribir `CUSTOMIZACION.md`: cómo cambiar nombre, descripción, ícono, portada, estilos y ayuda de cada app; cómo cambiar el nombre del SO, logo, fondos, sonidos, íconos del sistema y tokens de tema; cómo agregar una app o un widget nuevo copiando una carpeta existente; formatos y tamaños recomendados de imagen; qué hace falta recompilar.
- Auditoría de consistencia, documentada en `docs/PROGRESO.md`:
  - todas las apps usan componentes de `@os/ui` y tokens de tema (sin colores escritos a mano);
  - todas las apps con documentos usan `useUnsavedChanges` y `dialogs.saveFile`;
  - ningún texto visible tiene escrito a mano el nombre del SO ni el nombre de una app (se leen de configuración o manifiestos);
  - cada app funciona en tema claro y oscuro y con su ventana en tamaño mínimo;
  - todas las asociaciones de archivo tienen al menos una app y "Abrir con…" lista las correctas;
  - todos los streams de medios se liberan al cerrar.
- Pulido: estados vacíos con `EmptyState` en todas las listas, animaciones de la sección 6, mensajes de error en español claro, rendimiento aceptable con 10 ventanas abiertas.

**Verificación:** cambiar el ícono, el nombre y la portada de una app en su `meta/` se refleja en Dock, Launchpad, escritorio, Administrador de tareas, "Acerca de", Ayuda y notificaciones sin tocar ningún archivo de `src/` fuera de `meta/`.
