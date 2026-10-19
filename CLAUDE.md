# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

La especificación es `ESPECIFICACION.md` (in Spanish); read it fully before each phase and follow the rules in its section 7. It is the **single source of truth**: a macOS-inspired desktop-OS simulator (Electron + React + TypeScript, default name "OrigamiOS"), built in phases 0–6. Progress, deviations and contract changes are logged in `docs/PROGRESO.md` — read it to see which phase is done (all phases, 0 through 6, are complete).

Phase rules (spec §7): work **only** on the requested phase, don't pull in later-phase features, don't leave TODOs/commented-out code, update `docs/PROGRESO.md` (what was done, deviations, contract changes), then stop and summarize. If a contract must change, update the spec section first, then every module that uses it in the same step.

## Commands

- `npm run dev` — electron-vite dev server + Electron (HMR; F12 or Ctrl+Shift+I toggles DevTools, dev only).
- `npm run build` — production build into `out/`; `npm run preview` runs it.
- `npm run typecheck` — runs `tsc --noEmit` twice: `tsconfig.node.json` (main, preload, shared, config) and `tsconfig.web.json` (renderer).
- `npm run lint` — ESLint with `--max-warnings 0`; also enforces the layer rules below.

Every phase must finish with `typecheck`, `lint` and `build` passing with no errors or warnings. There are no automated tests (explicitly out of scope); verify behavior by running the app. To drive it from a script: launch Electron with `--user-data-dir=<temp dir>` (never touch the real user data) and `--remote-debugging-port=<n>` (pass them after `--` to `electron-vite dev`), then talk CDP. In dev, `await import('/src/os/kernel/fs/index.ts')` from the page returns the *same* module instances the app uses, so kernel services can be exercised directly. `contextBridge` makes `window.native` non-replaceable, and `pkill -f` patterns match your own shell command line — use the `[x]yz` trick in a call of its own. Pin TypeScript to 6.x: `typescript-eslint` does not support 7 yet.

Stack (no other dependencies without justifying in `docs/PROGRESO.md`): electron-vite, React, TS `strict`, Zustand, Dexie 4, Zod, lucide-react, @fontsource/inter (bundled locally), ESLint.

## Architecture

Three Electron layers: `src/main` (IPC handlers in `ipc/`, `security.ts`), `src/preload` (exposes `window.native` via contextBridge), `src/shared/native-api.ts` (bridge types shared by all three), plus the renderer in `src/renderer/src`. Renderer aliases: `@os/sdk`, `@os/ui`, `@system`.

Renderer layout:
- `os/kernel/*` — headless services (events, storage, fs, settings, session, apps registry, windows, processes, dialogs, notifications, sound, scheduler, media).
- `os/shell/*` — UI of the OS (boot, setup, login, power, desktop, menubar, dock, launchpad, window-frame, dialogs, toasts, context-menu, widgets-host). No business logic; reads kernel state and calls kernel functions.
- `os/sdk` (`useOS()` and hooks) and `os/ui` (shared components) — the only public surface for apps/widgets.
- `apps/<app-id>/{meta,src}` and `widgets/<widget-id>/{meta,src}`.
- `system/` (`@system`) — global customization: `os.config.json`, `theme/tokens.css`, `wallpapers/`, `sounds/`, `icons/`, `boot/logo.svg`.

### Dependency rules (enforced by ESLint; `lint` must fail on violation)

Implemented in `eslint.config.mjs` plus the local rule `local/layer-boundaries` in `eslint/local-plugin.mjs` (it resolves relative imports, which `no-restricted-imports` cannot). If you add a new area under `src/renderer/src`, update its zone matrix there.

- `apps/*` and `widgets/*` may import only `@os/sdk`, `@os/ui`, `react`, `react-dom`, `lucide-react`, `zustand`, and their own folder — never another app/widget, `os/kernel` or `os/shell`.
- kernel imports no shell/sdk/ui; shell imports kernel + ui (not sdk); sdk and ui import kernel (ui not sdk).
- Only `os/kernel/storage` touches Dexie/IndexedDB (DB name `simos`).
- Only `os/kernel` uses `window.native` (typed in `src/renderer/src/env.d.ts`); the bridge exposes nothing beyond the spec's `files.importFromHost`, `auth` (scrypt hash/verify in main), `power`, `platform`. IPC channel names live in `src/shared/native-api.ts`; `main/ipc/*` handlers validate input and check the sender (`ipc/trust.ts`).
- Kernel services talk via typed direct calls or the typed event bus (`kernel/events/types.ts`); new events are added only there and in spec §4.4.

### Kernel conventions (Phase 1)

- **Boot / session:** `kernel/session` is a zustand store with phases `boot → setup | login → desktop ⇄ locked → shutdown`; `shell/Shell.tsx` only renders the screen for the current phase. Closing the session (logout/restart/shutdown) first runs `session.registerSessionEndGuard` guards; a guard returning `false` cancels the action. `kernel/windows` (`initWindows()`, called by `Shell`) registers the dirty-windows walk there and closes every window on logout/restart/shutdown; it emits `app:launched` / `app:terminated` (`processes` and `media` listen).
- **Storage / fs:** only `storage.transaction()` callbacks may `await` storage calls — awaiting anything else inside (e.g. `blob.text()`) commits the transaction early. Build `Blob`s and read host data *outside*, `emit('fs:changed')` *after* the transaction commits. Trashed items are direct children of `.Papelera` (id `trash`; root id is `root`); `trash.originalName` is needed because names get a `(2)` suffix there. `list()` hides trashed and dot-named nodes.
- **Settings:** read synchronously with `settings.get` (an in-memory cache of the *current account's* settings), write with `await settings.set` (validated by Zod, throws on invalid; it only persists when an account's settings are loaded). React: `useSettingValue`; session: `useSession`. Settings are **per account** (see "Multi-user" below); when an account is created, *all* its settings are persisted (defaults plus the chosen theme), not just the theme.
- **Sound:** `sound.play(name)` plays `system/sounds/<name>.*` if present, else a Web Audio recipe in `sound/synth.ts`. `autoplayPolicy: 'no-user-gesture-required'` is what lets the boot sound play.
- **CSP vs `blob:`:** `fetch(blobUrl)` is blocked by the spec's CSP. Read file data via `fs.readFile`/`readText`; use `fs.getObjectUrl` only for `src` of images/media.
- **Per-origin data:** IndexedDB is per origin, so `npm run dev` (`http://localhost:5173`) and the build (`file://`) have separate users and files.

### Windows, dialogs and SDK conventions (Phase 2)

- **Layering trick:** shell must not import `@os/sdk`, so the frame tells an app where it runs through React contexts defined in `kernel/apps/context.ts` (`AppInstanceContext`, `WidgetInstanceContext`); `@os/sdk` reads them. Apps use `useOS()`, widgets `useWidgetOS()` (widget without `ownerApp` stores in appData `widget:<id>`).
- **Windows:** `kernel/windows/store.ts` is pure state (never imports dialogs); `kernel/windows/index.ts` adds `closeWindow`/`closeApp` (unsaved-changes flow) and dock-target registration. `x/y/width/height` are always the *normal* bounds; maximized windows render over the work area (`setWorkArea`: menubar sets `top`, Dock sets `bottom`). Size transitions exist only for maximize/restore (`window--resizing-animation`), never while dragging. Handles live *inside* the window and the window uses `overflow: clip`.
- **Dialogs:** `dialogs.forWindow(id)` → sheet that blocks only that window (`hasSheet` kept in sync); `dialogs.system` → modal over everything. Unsaved changes always go through `confirmWindowDiscard` (close button, "Cerrar <App>", Dock, logout/restart/shutdown, opening a file into a dirty single-instance window). Internal kinds beyond `DialogsApi`: `unsaved`, `about` (`info` is public since Phase 3).
- **Portals:** React events bubble through portals — `ContextMenu` and `Popover` stop propagation of pointer/click events on purpose; keep that when adding portaled UI.
- **Desktop:** icon positions live in `desktop.items` on a 96×104 grid (origin 16,40); `useDesktopEntries` reconciles `~/Escritorio` with the setting. Drag & drop between components uses `NODE_DRAG_TYPE` from `@os/ui`.
- **File associations:** `kernel/apps/associations.ts`; default app = `fileAssociations.defaults[ext]` or highest `priority`; unknown extensions fall back to the plain-text editors.
- **Testing the UI by script:** with `npm run dev` + CDP, HMR makes the app load some modules as `…?t=…`; a plain `import('/src/…')` from the page then returns a *second instance*. Import with the exact URL the app loaded (look it up in `performance.getEntriesByType('resource')`). Hidden Electron windows stop advancing CSS animations; inject a style that zeroes `animation-duration`/`transition-duration` for deterministic tests.

### System apps conventions (Phase 3)

- **`FileBrowser` is the file explorer.** `mode: 'open' | 'save'` are the picker dialogs; `mode: 'manage'` is the full Files explorer (views, context menu, inline rename, drag & drop, trash). The trash is a place whose path is the real `/.Papelera` (`TRASH_PATH`); it lists `fs.listTrash()` instead of `fs.list()`. Apps drive it with a `ref` (`FileBrowserHandle`) and callbacks, never by reimplementing it.
- **Hooks returning lists must return a stable empty array while loading** (`NO_NODES` in `kernel/fs/hooks.ts`); a fresh `[]` per render plus an `onChange={setState}` consumer causes an infinite render loop.
- **React Compiler lint rules are on** (`react-hooks/set-state-in-effect` fails the lint): derive state while rendering (see how Settings tracks new `launchArgs`) instead of `setState` inside an effect.
- **SDK surface for system apps:** `useAppearance` (wallpapers, avatars, accent colors), `useAccount` (`system:account`; reactive `user`, `rename`, `setAvatar`, `changePassword`), `useProcesses` (`system:processes`; `forceQuit` runs the data-loss warning plus the unsaved flow), `useOS().system` (OS name/version) and `settings.getDefault` for "restablecer". New app-facing kernel capabilities go through the SDK, never an app import.
- **Account rename also renames the home folder** (`renameHomeFolder` in the same transaction as the user record); the Terminal and Files derive the user from `fs.stat('~').name`.
- **Accent colors live in `os.config.json` (`accentColors`)**; changing it needs a restart/rebuild like the rest of that file.

### Productivity apps conventions (Phase 4)

- **App roots with shortcuts must focus themselves on mount:** the window frame is the focused element (`tabIndex={-1}`), React's `autoFocus` ignores a `div`, and keydown only reaches an app if focus is inside it. Give the root `tabIndex={-1}` and `root.current?.focus()` in an effect; buttons that must not steal focus use `onMouseDown={e => e.preventDefault()}`. Prefer `autoFocus` on a real input over `requestAnimationFrame` (rAF does not run with a hidden Electron window).
- **Autosave apps (Notes, Contacts, Calendar, Clock) never call `useUnsavedChanges`.** Debounce 400 ms and flush pending saves in the unmount cleanup; a new empty item lives only in state until it has content.
- **Scheduler jobs carry a `payload`** (`{ kind: 'event' | 'alarm' | 'timer', … }`); the notification passes it back as `launchArgs.payload`, and the app derives its initial tab/day from it while rendering (not in an effect). Alarm on/off state is "its job still exists" (`scheduler.list()`), not a stored flag.
- **Times in apps are the system's local time** (as the scheduler and the Calendar widget); `datetime.timezone` only changes how clocks are displayed, and `datetime.hour24` is honoured everywhere times are shown.
- **Calendar events keep the exact 4.7 format** (the widget reads it); don't add fields to them.
- **No `eval`; no cross-app imports.** Pure logic goes in a sibling file (`engine.ts`, `find.ts`, `dates.ts`, `time.ts`) so the component stays UI-only.

### Multimedia apps conventions (Phase 5)

- **Media files go through `useFsObjectUrl(path)`** (`@os/ui`, object URL for `src` of `img`/`audio`/`video`; the CSP blocks `fetch(blob:)`). Decode blobs with `fs.readFile` + `createImageBitmap`, never by fetching a URL.
- **Volume = own volume × `useSystemVolume()`** (set `element.volume` in an effect). Media elements stay mounted while a window is minimized, so Music keeps playing; closing the window stops it.
- **Media streams:** `os.media.getCamera/getMicrophone` track streams per instance; `kernel/media` wraps `track.stop()` (the browser does not fire `ended` for it) so the menubar indicator turns off as soon as the app stops its tracks. Request the microphone only while recording.
- **A recording in progress is "unsaved changes"** (`useUnsavedChanges({ isDirty: recording, save: stopAndSave })`) in the Voice Recorder and the Camera.
- **Stage colors** (`--color-stage*`, `--color-flash`, `--color-recording` in `tokens.css`) are for always-dark media surfaces. Paint's palette and white background are drawing content and are the only literal colors in an app (`paint/src/palette.ts`).
- **Canvas apps:** do canvas work in event handlers (the canvas element stays mounted, hidden until there is a document) so no `setState` is needed inside an effect; history lives in a ref and `sync()` mirrors `canUndo/canRedo/dirty` into state. Use `setInterval` rather than `requestAnimationFrame` for periodic drawing (rAF stalls with a hidden Electron window).
- **Other apps ask Settings to change the wallpaper** with `apps.launch('settings', { section: 'appearance', wallpaperPath })`.

### Help and customization conventions (Phase 6)

- **The Help app is generated from the registry, not from a hand-written list.** It reads manifests, icons, covers and `help.md` through `useOS().apps` (`list`, `getIconUrl`, `getCoverUrl`, `getHelp`); never import the registry from an app. "Primeros pasos" lives in `apps/help/meta/getting-started.md`.
- **`help.md` / `getting-started.md` use `{{os}}` and `{{app:<id>}}` placeholders** instead of literal names, and only the Markdown subset the parser in `apps/help/src/markdown.ts` supports (headings, paragraphs, lists, bold, italic, inline code). No leading `#` title: the Help page already shows the header.
- **Editing a manifest, icon or cover under `meta/` makes Vite reload the whole page in dev** (the registry globs are `eager`), which sends the session back to boot/login.
- **`CUSTOMIZACION.md` is the user-facing guide** to what lives in `meta/` and `system/` and what needs a rebuild; keep it in sync when a customizable file or manifest field changes.
- **`WindowFrame` is `memo`ized** and window records are replaced immutably in the store; keep both, or dragging one window re-renders them all (60 fps with 10 windows, ~19 ms/frame without).
- **No `Checkbox` in `@os/ui` on purpose** (spec §6): add it when an app first needs one.

### Python and Dock conventions (post-Phase 6)

- **Python runs only through the Terminal's `python`/`python3` command.** `os/kernel/python` owns Pyodide (CPython 3.14 in WebAssembly) inside a real Web Worker file (`worker.ts`; the CSP forbids `blob:`/inline workers). Apps reach it through `useOS().python.run(job, io)` and need the `python` manifest permission; they can never import `pyodide` (lint). One program at a time; `cancel()` terminates the worker and the next run boots a fresh one (~2 s cold start). The kernel also cancels on `app:terminated` of the launching instance and on logout/restart/shutdown.
- **Pyodide's files are not hashed assets:** a small plugin in `electron.vite.config.ts` serves them at `/pyodide/` in dev and emits them to `out/renderer/pyodide/` on build; the worker loads `pyodide.mjs` from `document.baseURI`. Works from `file://` (verified in the build). The CSP gained `'wasm-unsafe-eval'` (spec 3.4), nothing else.
- **Python limits are by design (spec 4.15):** standard library only, no `pip`/network, `input()` raises `EOFError`, Python's `open()` does not see the virtual FS (in-memory FS).
- **Terminal streaming:** commands may print live through `ShellEnv.live` (`print`, `setCancel`); `shell.execute` sets `live = null` while a `>`/`>>` redirection is active so the command returns everything at once. While a command runs the input is disabled and the container (`tabIndex=-1`) takes focus so `Ctrl+C` reaches `onRootKeyDown`.
- **Dock spacing is the `dock.gap` setting** (0–24 px, default 4) passed as `--dock-gap`; the magnification range scales with `iconSize + gap` (`REFERENCE_PITCH`). The Wi-Fi/network simulation no longer exists (no `kernel/network`, `useNetwork`, `network.*` settings or `networks` in `os.config.json`); old `network.*` rows in IndexedDB are ignored by `settings.load`.

### Multi-user conventions ("light" multi-user, post-Phase 6)

- **Several accounts, one session at a time, everything shared except settings.** Files (every `/Usuarios/<name>` is visible to everyone), `appData` and the scheduler are global; only `settings` are per account. No admin, roles or file permissions (spec §1 keeps those out of scope).
- **Per-account settings are the same `settings` table with keys prefixed `<userId>:`** (e.g. `user:dock.gap`); no Dexie schema change. `settings.load(userId | null)` replaces the whole in-memory store (consumers re-render through `useSettingValue`), `settings.set` writes under the loaded account, `settings.preview` changes memory only (the setup wizard's theme preview), `settings.persistNew(userId, overrides)` seeds a new account. `session.boot` runs `settings.migrateLegacy` (old unprefixed rows → the account with id `user`, orphans deleted) and loads the last account's settings so the login screen shows its wallpaper/theme.
- **`SessionUser` has an `id`.** `session.user` is the signed-in account (`null` on boot/setup/login); `session.users` lists every account; `login(userId, password)`, `createUser(input)` (no login), `completeSetup(input)` (first account + login). Logout returns to the account picker with the departing account's look still loaded until another is chosen. Account names are unique ignoring case (`checkName`); the old single account keeps id `user`, new ones use `crypto.randomUUID()`.
- **`~` follows the signed-in account** through `fs.setCurrentUser(name)` (called by the session on login, rename and logout; `fs` cannot import `session`). `fs/tree.ts` is split into `createSystemTree()` (root, trash, `/Usuarios`, once) and `createUserHome(name)` (per account; throws `EEXIST` for a duplicate name).
- **Login screen:** with one account it goes straight to the password; with several it shows the picker (last signed-in first) and "Nuevo usuario", which opens `SetupWizard mode="additional"` over it. The lock screen (`phase === 'locked'`) only offers the active account.

### Contracts worth knowing before editing

- **Zero-code customization:** adding a folder under `apps/` is enough to register an app — `kernel/apps` uses `import.meta.glob` over `apps/*/meta/*` and `apps/*/src/index.tsx` (lazy). No hand-written app lists anywhere. Manifests are validated by Zod (`kernel/apps/manifest.schema.ts`); an invalid one is skipped with a console error naming the bad field. App `id` = folder name (kebab-case) and is permanent.
- `theme.css` per app may only set CSS variables under `[data-app-id="<id>"]`. No hard-coded colors anywhere; everything comes from `system/theme/tokens.css`.
- The OS name and app names must never be hard-coded in UI text — read from `os.config.json` / manifests.
- Settings keys and defaults live only in `kernel/settings/schema.ts`; every `set` emits `settings:changed`. Every fs mutation emits `fs:changed`. MIME types come from one table, `src/shared/mime.ts` (`kernel/fs/mime.ts` re-exports it; `main` uses it too).
- `system/os.config.json` is read by the renderer (`kernel/config`, Zod-validated) **and imported by `main`** — changing it needs a rebuild/restart. Never derive paths (e.g. userData) from the OS name: renaming would orphan stored data.
- Theme: colors in `tokens.css` use `light-dark()`; set `data-theme="light|dark|auto"` on `<html>` and `--color-accent` from the accent setting. The main-process CSP is delivered via response headers (`main/security.ts`); the dev CSP relaxes only what Vite needs. `assetsInlineLimit` is 0 so no asset becomes a `data:` URL (CSP `font-src`).
- Restricted SDK services (`useProcesses`, `useAccount`, `settings.set`, camera/mic) require manifest `permissions`; calling without it throws an error naming the missing permission. Apps without `settings:write` (e.g. Image Viewer) change wallpaper via `apps.launch('settings', …)`, never `settings.set`.
- **Unsaved changes** go through one system-level flow (`useUnsavedChanges` → prompt "¿Guardar los cambios de …?") for window close, app quit, force-quit, logout/restart/shutdown, and opening another file over a dirty one. Autosave apps (Notes, Contacts, Calendar) never set `isDirty`.
- Dialogs from an app are window-modal sheets; from the shell they are system-modal.
- No system clipboard and no file Copy/Paste in the file explorer (use Duplicate, Copy to…, Move to…, drag & drop with MIME `application/x-simos-node`). Native text copy/paste in inputs must keep working.
- Sounds: look for `system/sounds/<name>.{mp3,ogg,wav}`, fall back to a Web Audio synthesized tone when missing.
- Electron security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, block navigation and `window.open`, grant only `media` permission to own origin.
- Any Dexie schema change bumps the Dexie version with a migration.

### Conventions

UI strings are in Spanish; identifiers, filenames and commits are in English. Visual spec (macOS-like but no Apple assets/fonts/icons/sounds) is in spec §6. The "Out of scope" list in spec §1 (simultaneous sessions, admin/roles, deleting accounts, global search, tests, browser app, etc.) must not be implemented.
