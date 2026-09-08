function isRejectedSuggestion(suggest) {
  return suggest === 'risky' || suggest === 'review';
}

const SECURITY_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const SECURITY_MEDIA_EXTENSIONS = ['jpg', 'jpeg', 'png', 'bmp', 'gif'];
const SECURITY_MEDIA_COPY_EXTENSIONS = ['jfif', 'jpe', 'webp'];

function fileExtension(value) {
  const match = String(value || '').match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return match ? match[1].toLowerCase() : '';
}

function imageTypeExtension(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/^image\//, '');
  if (!normalized) return '';
  if (normalized === 'jpg' || normalized === 'jpeg' || normalized === 'pjpeg') return 'jpeg';
  return normalized;
}

function needsSecurityCopy(file = {}) {
  const typeExtension = imageTypeExtension(file.type);
  const namedExtension = fileExtension(file.name) || fileExtension(file.path || file.tempFilePath);
  const extension = typeExtension || namedExtension;
  return Number(file.size) > SECURITY_MEDIA_MAX_BYTES
    || !extension
    || SECURITY_MEDIA_COPY_EXTENSIONS.includes(typeExtension)
    || SECURITY_MEDIA_COPY_EXTENSIONS.includes(namedExtension)
    || !SECURITY_MEDIA_EXTENSIONS.includes(extension);
}

function normalizeSecurityStatus(payload = {}) {
  if (payload.status === 'checking') return 'checking';
  if (payload.status === 'pass') return 'pass';
  if (payload.status === 'rejected') return 'rejected';
  if (payload.status === 'error') return 'error';
  if (Number(payload.errcode) !== 0) return 'error';
  const suggest = payload.result && payload.result.suggest;
  if (suggest === 'pass') return 'pass';
  if (isRejectedSuggestion(suggest)) return 'rejected';
  return 'error';
}

module.exports = {
  SECURITY_MEDIA_MAX_BYTES,
  isRejectedSuggestion,
  needsSecurityCopy,
  normalizeSecurityStatus
};
