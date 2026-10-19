# OrigamiOS

Simulador de sistema operativo de escritorio, de estilo minimalista inspirado en macOS, que corre como aplicación de escritorio con Electron. Tiene arranque, asistente de configuración, cuentas de usuario, ventanas, Dock, Launchpad, widgets, un sistema de archivos virtual y un conjunto de aplicaciones propias. Todo funciona sin conexión y sin servidores: los datos se guardan en el equipo.

El nombre "OrigamiOS" es el predeterminado y se cambia en un solo archivo (`src/renderer/src/system/os.config.json`). La interfaz está en español.

## Qué incluye

**Sistema**

- Arranque con logo y sonido, asistente de primera configuración y pantalla de inicio de sesión con contraseña.
- Varias cuentas de usuario, una sesión a la vez. Los archivos y los datos de las apps se comparten; los ajustes (tema, color de acento, fondo, Dock, zona horaria) son de cada cuenta.
- Bloqueo de pantalla, cerrar sesión, reiniciar y apagar, con aviso de cambios sin guardar.
- Ventanas con arrastre, cambio de tamaño, minimizar, maximizar y animaciones; los botones están a la derecha de la barra de título.
- Barra de menú, Dock con ampliación, Launchpad, escritorio con íconos, menús contextuales, notificaciones y alarmas.
- Sistema de archivos virtual con papelera, importación desde el equipo anfitrión y asociaciones de archivos.
- Tema claro, oscuro o automático, colores de acento y fondos de pantalla.

**Aplicaciones**

| Categoría | Aplicaciones |
|---|---|
| Sistema | Archivos, Configuración, Administrador de tareas, Ayuda |
| Productividad | Notas, Editor de texto, Calendario, Contactos |
| Utilidades | Calculadora, Reloj, Terminal |
| Multimedia | Visor de imágenes, Música, Videos, Paint, Cámara, Grabadora de voz |

**Widgets:** Calendario, Reloj, Nota rápida y Estado del sistema.

La Terminal incluye comandos de archivos y ejecuta programas de Python (`python` o `python3`) con Pyodide, solo con la biblioteca estándar y sin red.

## Requisitos

- Node.js y npm recientes.
- Linux, macOS o Windows con soporte para Electron.

## Uso

```bash
npm install
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente y Electron. F12 o Ctrl+Shift+I abre las herramientas de desarrollo. |
| `npm run build` | Compilación de producción en `out/`. |
| `npm run preview` | Ejecuta la compilación de `out/`. |
| `npm run typecheck` | Comprueba los tipos del proceso principal y del renderizador. |
| `npm run lint` | ESLint sin avisos permitidos; también hace cumplir las reglas de capas. |

No hay pruebas automáticas. Los cambios se verifican ejecutando la aplicación, y cada cambio debe dejar `typecheck`, `lint` y `build` sin errores ni avisos.

## Datos y cómo empezar de cero

Cuentas, archivos, ajustes y datos de las apps se guardan en IndexedDB dentro de la carpeta de datos de Electron (en Linux, `~/.config/simos/`). El modo desarrollo (`http://localhost:5173`) y la versión compilada (`file://`) son orígenes distintos y tienen datos separados.

Para empezar de cero, cierra la aplicación y borra el almacenamiento:

```bash
rm -rf ~/.config/simos/IndexedDB ~/.config/simos/"Local Storage" ~/.config/simos/"Session Storage"
```

La siguiente vez volverá a aparecer el asistente de configuración. También puedes probar con datos desechables usando otra carpeta de datos:

```bash
npm run dev -- -- --user-data-dir=/ruta/a/una/carpeta/temporal
```

## Estructura del proyecto

```
src/
├─ main/                 Proceso principal de Electron (IPC, seguridad)
├─ preload/              Puente seguro hacia el renderizador (window.native)
├─ shared/               Tipos y tablas compartidos por todas las capas
└─ renderer/src/
   ├─ os/
   │  ├─ kernel/         Servicios sin interfaz: sesión, archivos, ajustes,
   │  │                  ventanas, procesos, notificaciones, sonido, Python…
   │  ├─ shell/          Interfaz del sistema: arranque, escritorio, Dock,
   │  │                  barra de menú, ventanas, Launchpad…
   │  ├─ sdk/            useOS() y hooks: la API pública para apps y widgets
   │  └─ ui/             Componentes compartidos
   ├─ apps/<id>/{meta,src}      Una carpeta por aplicación
   ├─ widgets/<id>/{meta,src}   Una carpeta por widget
   └─ system/            Personalización global: os.config.json, tema,
                         fondos, sonidos, íconos, logo de arranque
```

Las dependencias entre capas están fijadas y las comprueba `npm run lint`:

- Las apps y los widgets solo pueden importar `@os/sdk`, `@os/ui`, React, `lucide-react`, `zustand` y su propia carpeta. Nunca el kernel, el shell ni otra app.
- El kernel no importa shell, sdk ni ui.
- Solo `os/kernel/storage` toca IndexedDB (Dexie) y solo `os/kernel` usa `window.native`.

## Personalización sin tocar el código

Para añadir una aplicación basta con crear una carpeta en `apps/<id>/` con su `meta/manifest.json` y su `src/index.tsx`: el sistema la registra solo, sin listas escritas a mano. Con los archivos de `meta/` y `system/` se cambian nombres, descripciones, íconos, portadas, colores, fondos, sonidos y valores iniciales. Los cambios en `system/os.config.json`, en `meta/` y en `system/` se ven al reiniciar `npm run dev` o al volver a ejecutar `npm run build`.

## Tecnología

Electron, electron-vite, React, TypeScript en modo estricto, Zustand, Dexie, Zod, lucide-react, Inter (incluida localmente) y Pyodide.

## Fuera de alcance

Sesiones simultáneas, administradores y permisos de archivos, borrado de cuentas, búsqueda global, navegador web y pruebas automáticas.
