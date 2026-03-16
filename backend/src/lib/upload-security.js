import path from 'node:path';

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'svg',
  'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v',
  'mp3', 'wav', 'm4a', 'aac', 'flac', 'opus',
  'pdf', 'txt', 'doc', 'docx', 'odt', 'rtf',
  'zip', 'rar', '7z', 'gz', 'tar',
  'json', 'csv', 'xml',
]);

const EXT_TO_MIME = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  bmp: ['image/bmp'],
  ico: ['image/x-icon', 'image/vnd.microsoft.icon'],
  svg: ['image/svg+xml'],
  mp4: ['video/mp4'],
  webm: ['video/webm', 'audio/webm'],
  ogg: ['video/ogg', 'audio/ogg'],
  mov: ['video/quicktime'],
  avi: ['video/x-msvideo'],
  mkv: ['video/x-matroska'],
  m4v: ['video/x-m4v'],
  mp3: ['audio/mpeg'],
  wav: ['audio/wav', 'audio/wave'],
  m4a: ['audio/mp4', 'audio/x-m4a'],
  aac: ['audio/aac'],
  flac: ['audio/flac'],
  opus: ['audio/opus'],
  pdf: ['application/pdf'],
  txt: ['text/plain'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  odt: ['application/vnd.oasis.opendocument.text'],
  rtf: ['application/rtf', 'text/rtf'],
  zip: ['application/zip'],
  rar: ['application/vnd.rar', 'application/x-rar-compressed'],
  '7z': ['application/x-7z-compressed'],
  gz: ['application/gzip'],
  tar: ['application/x-tar'],
  json: ['application/json'],
  csv: ['text/csv'],
  xml: ['application/xml', 'text/xml'],
};

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi',
  'sh', 'bash', 'zsh', 'ps1', 'ps2',
  'php', 'phtml', 'phar', 'pht',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
  'vbs', 'ws', 'wsf', 'vbe',
  'jar', 'jsp', 'jspx',
  'asp', 'aspx', 'asa', 'cer', 'csr',
  'py', 'pyc', 'pyo', 'rb', 'pl', 'pm', 'cgi',
  'htaccess', 'htpasswd', 'config', 'env',
]);

function getExt(name) {
  if (!name || typeof name !== 'string') return '';
  const base = path.basename(name);
  const idx = base.lastIndexOf('.');
  if (idx < 0) return '';
  return base.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function sanitizeAttachmentFilename(originalname) {
  if (!originalname || typeof originalname !== 'string') return { safeBasename: 'file', ext: 'bin' };
  const raw = originalname.replace(/\0/g, '').trim();
  const base = path.basename(raw).slice(0, 200);
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.') || 'file';
  const ext = getExt(safe);
  if (BLOCKED_EXTENSIONS.has(ext)) return { safeBasename: safe.replace(/\.[^.]+$/, '') || 'file', ext: 'bin' };
  const allowedExt = ALLOWED_EXTENSIONS.has(ext) ? ext : 'bin';
  const safeBasename = safe.replace(/\.[^.]+$/, '') || 'file';
  return { safeBasename: safeBasename.slice(0, 150), ext: allowedExt };
}

export function isAllowedFile(originalname, mimetype) {
  const ext = getExt(originalname);
  if (BLOCKED_EXTENSIONS.has(ext)) return false;
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  const allowedMimes = EXT_TO_MIME[ext];
  if (!allowedMimes) return false;
  const mime = (mimetype || '').toLowerCase().split(';')[0].trim();
  if (!mime) return false;
  return allowedMimes.includes(mime);
}

export function getAllowedExtensions() {
  return Array.from(ALLOWED_EXTENSIONS);
}

export function getBlockedExtensions() {
  return Array.from(BLOCKED_EXTENSIONS);
}
