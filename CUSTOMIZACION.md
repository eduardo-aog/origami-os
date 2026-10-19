# Guía de personalización

Casi todo lo visual y descriptivo del sistema se cambia editando archivos, sin tocar el código de `src/` (salvo, claro, las carpetas `meta/` y `system/`). Esta guía dice qué archivo controla cada cosa, con qué formato y tamaño, y cuándo hace falta recompilar.

Las rutas de esta guía son relativas a `src/renderer/src/`.

## Antes de empezar: cuándo se ve el cambio

| Cómo ejecutas el sistema | Qué hacer tras editar un archivo |
|---|---|
| `npm run dev` | La mayoría de los cambios se ven al momento. Tras editar un `manifest.json` o un ícono, la ventana puede recargarse sola y volver al arranque; es normal. Si algo no se actualiza, reinicia `npm run dev`. |
| `npm run build` + `npm run preview` (o la app ya compilada) | Hay que volver a ejecutar `npm run build`: todo lo de `meta/` y `system/` se incluye al compilar. |

Casos especiales:

- **`system/os.config.json`** también lo lee el proceso principal de Electron (nombre de la ventana y pantalla completa), así que **siempre exige reiniciar** `npm run dev` o recompilar.
- **Valores iniciales de cada cuenta.** El tema, el color de acento, el fondo, la zona horaria, el formato de 24 h, las apps ancladas al Dock y el resto de ajustes se guardan **al crear cada cuenta** (los ajustes son de cada usuario). Cambiar `defaults` en `os.config.json` o `pinnedByDefault` en un manifiesto **no afecta a una cuenta ya creada**. Para verlos hay que empezar de cero (borrar los datos de la aplicación para que vuelva a salir el asistente) o, en Configuración → Escritorio y Dock, usar los botones de restablecer.
- Los datos de cada usuario viven en IndexedDB. `npm run dev` (origen `http://localhost:5173`) y la app compilada (`file://`) tienen datos separados.

---

## 1. Personalizar una aplicación

Todo lo que se puede personalizar de una app está en su carpeta `apps/<id>/meta/`:

```
apps/<id>/meta/
├─ manifest.json    nombre, descripción, versión, categoría, ventana, asociaciones…
├─ icon.svg         ícono
├─ cover.png        portada (opcional)
├─ theme.css        variables de estilo propias (opcional)
└─ help.md          texto de su sección en la Ayuda (opcional)
```

Los cambios se reflejan en el Dock, el Launchpad, el escritorio, el Administrador de tareas, "Acerca de", la Ayuda, las notificaciones y el submenú "Abrir con…". Nada está escrito a mano en otro sitio.

### Nombre, descripción, versión, autor

Edita `manifest.json`:

```json
{
  "id": "text-editor",
  "name": "Editor de texto",
  "description": "Crea y edita documentos de texto plano y Markdown.",
  "version": "1.0.0",
  "author": "",
  "icon": "icon.svg",
  "category": "productividad",
  "launchpad": { "visible": true, "order": 20 },
  "dock": { "pinnedByDefault": true },
  "window": { "width": 760, "height": 520, "minWidth": 380, "minHeight": 260, "resizable": true, "singleInstance": false },
  "fileAssociations": [{ "extensions": ["txt", "md"], "role": "editor", "priority": 10 }],
  "permissions": []
}
```

- **`id`** debe ser igual al nombre de la carpeta, en kebab-case (`text-editor`). Es la identidad permanente de la app (los datos guardados y las apps ancladas dependen de él): **no lo cambies**. `name` sí se puede cambiar libremente.
- **`category`**: `sistema`, `productividad`, `multimedia` o `utilidades`.
- **`launchpad.visible` y `launchpad.order`**: si aparece en el Launchpad y en qué posición (menor número, antes).
- **`dock.pinnedByDefault`**: si se ancla al Dock en un primer arranque.
- **`window`**: tamaño inicial y mínimo, si se puede redimensionar y si admite una sola ventana (`singleInstance`).
- **`fileAssociations`**: extensiones (en minúsculas y sin punto) que abre la app; `role` es `editor` o `viewer`, y la de mayor `priority` es la predeterminada hasta que el usuario elija otra.
- **`permissions`**: puede incluir `camera`, `microphone`, `settings:write`, `system:processes`, `system:account` y `python` (ejecutar programas de Python con `useOS().python`).

Un manifiesto inválido **no rompe el sistema**: la app se omite y la consola de DevTools (F12 en desarrollo) dice qué campo falla.

### Ícono

Sustituye `meta/icon.svg` (o apunta `icon` a otro archivo de `meta/`).

- Formato recomendado: **SVG** de 128 × 128 (`viewBox="0 0 128 128"`), con el estilo de los demás: escuadra redondeada con degradado y un glifo simple. También se admiten `png`, `jpg` y `webp`; en ese caso, cuadrado y de al menos 256 × 256 px.
- El ícono se usa desde 18 px (listas) hasta 72 px (Acerca de), así que el glifo debe leerse en pequeño.

### Portada

Añade una imagen a `meta/` (por ejemplo `cover.png`) y declárala en el manifiesto: `"cover": "cover.png"`.

- Se muestra en "Acerca de" y en la página de la app en la Ayuda.
- Formato recomendado: **PNG, JPG o WebP** apaisado, de unos **1360 × 360 px** (proporción aproximada 3,8 : 1). Se recorta para llenar el ancho, así que deja lo importante en el centro.
- Si declaras una portada que no existe, se avisa en la consola y se ignora.

### Estilos propios

`meta/theme.css` solo puede definir **variables CSS** bajo `[data-app-id="<id>"]`. Sirve para ajustar los colores de esa app sin tocar su código. Por ejemplo, para que Notas use otro acento:

```css
[data-app-id="notes"] {
  --color-accent: #e3a91b;
  --color-accent-soft: #e3a91b33;
}
```

Las variables disponibles son las de `system/theme/tokens.css` (ver el apartado 2). No escribas colores sueltos en las reglas: usa siempre variables, para que la app funcione en tema claro y oscuro.

### Ayuda

`meta/help.md` es el texto de la sección de esa app en la Ayuda. Admite un subconjunto de Markdown:

- títulos `#`, `##` y `###`;
- párrafos (separados por una línea en blanco);
- listas con `-` o `*`, y numeradas (`1.`);
- `**negrita**`, `*cursiva*` y `` `código` ``.

No hay enlaces, imágenes, tablas ni bloques de código. No empieces con un título con el nombre de la app: la Ayuda ya muestra el encabezado.

Para no escribir nombres a mano, usa marcadores que la Ayuda sustituye al mostrarlos:

- `{{os}}` → nombre del sistema (`os.config.json`);
- `{{app:files}}` → nombre actual de la app con ese `id` (su `manifest.json`).

Así, si renombras el sistema o una app, la Ayuda se actualiza sola. La sección "Primeros pasos" está en `apps/help/meta/getting-started.md` y usa el mismo formato y los mismos marcadores.

---

## 2. Personalizar el sistema (`system/`)

### Nombre del sistema

`system/os.config.json`, campo `name`. Se usa en la barra de título de la ventana, la pantalla de bienvenida, la Terminal, la Ayuda, etc. Ningún texto de la interfaz lo tiene escrito a mano. Exige reiniciar o recompilar.

**No cambies el nombre de la base de datos** (`simos`): está fijo a propósito para que renombrar el sistema no deje huérfanos los datos guardados.

### Resto de `os.config.json`

| Campo | Qué hace |
|---|---|
| `version` | Versión del sistema; las apps la leen con `useOS().system.version`. |
| `bootDurationMs` | Duración de la pantalla de arranque. |
| `startFullscreen` | Si la ventana de Electron arranca en pantalla completa. |
| `simulatedMemoryMB` | Memoria total simulada del Administrador de tareas. |
| `defaults` | Tema (`light`, `dark`, `auto`), acento, fondo (`id` de un archivo de `wallpapers/`), zona horaria IANA y formato de 24 h **para cuentas nuevas**. |
| `accentColors` | Los colores de acento que ofrece Configuración (`name` y `value` hexadecimal). Debe haber al menos uno. |

### Logo

`system/boot/logo.svg`: se ve en la pantalla de arranque y en el asistente de primer arranque, a 96 px. Usa un SVG cuadrado. El ícono de la barra de menú (el del menú del sistema) es otro archivo: `system/icons/system-menu.svg`.

### Fondos de pantalla

Cualquier imagen colocada en `system/wallpapers/` aparece en Configuración. El `id` es el nombre del archivo sin extensión. Formatos: `svg`, `png`, `jpg` o `webp`; para pantalla completa conviene **1920 × 1080 px o más** (o un SVG, que se adapta a cualquier tamaño). El fondo inicial es el que indica `defaults.wallpaper`.

### Avatares incluidos

`system/avatars/` funciona igual que los fondos: cada imagen (`svg`, `png`, `jpg` o `webp`, cuadrada) es un avatar que se puede elegir en el asistente y en Configuración; el `id` es el nombre del archivo.

### Sonidos

Coloca en `system/sounds/` un archivo `mp3`, `ogg` o `wav` con uno de estos nombres exactos:

`boot`, `login`, `logout`, `shutdown`, `notification`, `error`, `trash`, `empty-trash`, `alarm`, `shutter`, `lock`.

Si el archivo no existe, el sistema genera un tono equivalente, de modo que no hace falta tenerlos todos. Conviene que duren pocos segundos (`boot` y `alarm` pueden ser algo más largos).

### Íconos del sistema

`system/icons/` contiene los íconos que se usan para archivos, carpetas, el menú del sistema y el Launchpad. Se reemplazan **conservando el nombre y el formato SVG**:

`folder.svg`, `folder-system.svg`, `file-generic.svg`, `file-text.svg`, `file-python.svg`, `file-image.svg`, `file-audio.svg`, `file-video.svg`, `trash-empty.svg`, `trash-full.svg`, `launchpad.svg`, `system-menu.svg`, `avatar-default.svg`.

### Tema (colores, radios, sombras, tipografía)

`system/theme/tokens.css` define todas las variables de diseño: colores (con `light-dark(claro, oscuro)`, para los dos temas a la vez), radios, sombras, desenfoques, tipografía, espacios y duraciones de animación. Cambiar un valor aquí cambia todo el sistema. El color de acento real lo fija Configuración sobre `--color-accent`.

Los colores de las superficies siempre multimedia (visor, video, cámara) y los de las vistas de arranque y bloqueo tienen sus propias variables (`--color-stage*`, `--color-boot*`, `--color-lock*`) en el mismo archivo.

---

## 3. Añadir una aplicación nueva

1. Copia una carpeta de `apps/` (por ejemplo `apps/notes`) y ponle el nombre del nuevo `id`, en kebab-case: `apps/mi-app`.
2. En `apps/mi-app/meta/manifest.json` cambia `id` (igual que la carpeta), `name`, `description` y lo demás. Sustituye `icon.svg`.
3. Borra de `meta/` lo que no vayas a usar (`cover`, `theme.css`) y escribe tu `help.md`.
4. En `apps/mi-app/src/index.tsx` exporta por defecto el componente raíz. Para hablar con el sistema usa solo `@os/sdk` y `@os/ui` (`useOS()`, `useAppMenus()`, `useUnsavedChanges()`…).
5. Reinicia `npm run dev` o ejecuta `npm run build`.

No hay que registrar la app en ningún otro sitio: aparece sola en el Launchpad, la Ayuda y el Administrador de tareas. Si `dock.pinnedByDefault` es `true`, se ancla en las cuentas que se creen después; en una cuenta existente, usa Configuración → Escritorio y Dock → restablecer apps ancladas, o "Mantener en el Dock" desde su menú contextual.

**Reglas que se comprueban con `npm run lint`:** una app solo puede importar `@os/sdk`, `@os/ui`, `react`, `react-dom`, `lucide-react`, `zustand` y archivos de su propia carpeta. Nunca otra app, `os/kernel` ni `os/shell`. Si rompes una de estas reglas, `lint` falla.

## 4. Añadir un widget nuevo

1. Copia una carpeta de `widgets/` (por ejemplo `widgets/quick-note`) con el nuevo nombre.
2. Edita `meta/manifest.json`:

```json
{
  "id": "mi-widget",
  "name": "Mi widget",
  "description": "Qué muestra.",
  "icon": "icon.svg",
  "sizes": ["small", "medium"],
  "defaultSize": "small",
  "ownerApp": null
}
```

- `sizes`: `small` (160 × 160), `medium` (340 × 160) y `large` (340 × 340). `defaultSize` debe ser uno de ellos.
- `ownerApp`: el `id` de una app para que el widget lea y escriba en los datos de esa app (como el widget de Calendario), o `null` para tener datos propios.

3. Escribe el componente en `src/index.tsx` (exportación por defecto) usando `useWidgetOS()` de `@os/sdk`. Las mismas reglas de importación de las apps valen para los widgets.
4. Reinicia o recompila. Aparecerá en "Añadir widget" del menú del escritorio.

---

## 5. Resumen de formatos

| Qué | Dónde | Formato y tamaño recomendados |
|---|---|---|
| Ícono de app o widget | `meta/icon.svg` | SVG 128 × 128 (o PNG/JPG/WebP cuadrado ≥ 256 px) |
| Portada de app | `meta/cover.png` | PNG/JPG/WebP apaisado ≈ 1360 × 360 px |
| Fondo de pantalla | `system/wallpapers/` | SVG, o PNG/JPG/WebP ≥ 1920 × 1080 px |
| Avatar | `system/avatars/` | SVG o imagen cuadrada (≈ 256 px) |
| Logo de arranque | `system/boot/logo.svg` | SVG cuadrado |
| Íconos del sistema | `system/icons/` | SVG, con el nombre original |
| Sonidos | `system/sounds/<nombre>` | `mp3`, `ogg` o `wav`, con los nombres de la lista |

## 6. Qué hace falta recompilar

- **Siempre** (reiniciar `npm run dev` o `npm run build`): `os.config.json`, y cualquier archivo nuevo o eliminado en `apps/`, `widgets/` o `system/` si no ves el cambio al recargar.
- **En desarrollo, sin reiniciar** (a veces la ventana se recarga sola): manifiestos, íconos, portadas, `theme.css`, `help.md`, `tokens.css`, fondos, avatares, sonidos y logo.
- **Con la app ya compilada**: todo lo anterior requiere `npm run build`.
- **Nunca hace falta tocar `src/` fuera de `meta/` y `system/`** para cambiar nombres, descripciones, íconos, portadas, estilos o textos de ayuda.
