const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  py: 'text/x-python',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime'
}

export const FALLBACK_MIME = 'application/octet-stream'

/** Tipo MIME deducido por la extensión del nombre. Es la única tabla del proyecto. */
export function mimeFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return FALLBACK_MIME
  return MIME_BY_EXTENSION[fileName.slice(dot + 1).toLowerCase()] ?? FALLBACK_MIME
}
