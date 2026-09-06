export const inputClass = 'w-full px-4 py-3 border border-border rounded-xl text-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500';
export const labelClass = 'block text-base font-medium text-foreground mb-1.5';
export const btnPrimary = 'flex items-center gap-2 h-12 px-6 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-base font-semibold transition-colors';
export const btnSecondary = 'flex items-center gap-2 h-12 px-6 rounded-xl border border-border text-foreground text-base font-medium hover:bg-gray-50 transition-colors';
export const btnIcon = 'p-2.5 rounded-xl text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors';
export const btnDanger = 'p-2.5 rounded-xl text-muted hover:text-red-600 hover:bg-red-50 transition-colors';

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function getFileIcon(mime) {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'spreadsheet';
  if (mime.includes('word') || mime.includes('document')) return 'document';
  return 'file';
}
