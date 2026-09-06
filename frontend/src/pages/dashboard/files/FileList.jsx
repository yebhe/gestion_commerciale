import {
  FolderOpen, Plus, Trash2, Download, FileText, Image as ImageIcon,
  Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Loader from '../../../contexts/Loader';
import { mediaUrl } from '../../../lib/api';
import { btnPrimary, btnSecondary, btnDanger, formatFileSize, getFileIcon } from './constants';

const FileIcon = ({ mime }) => {
  const type = getFileIcon(mime);
  if (type === 'image') return <ImageIcon size={24} className="text-blue-600" />;
  return <FileText size={24} className="text-primary-600" />;
};

const FileList = ({
  files, loading, search, page, count, next, prev,
  canUpload, canDelete,
  onSearchChange, onPageChange, onDelete, onUpload, disabledUpload,
}) => (
  <>
    <div className="flex items-center justify-between mb-6">
      <p className="text-muted text-lg">{files.length} fichier(s)</p>
      {canUpload && (
        <button type="button" onClick={onUpload} disabled={disabledUpload}
          className={`${btnPrimary} ${disabledUpload ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <Plus size={24} />
          Téléverser un fichier
        </button>
      )}
    </div>

    <div className="relative mb-4">
      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Rechercher un fichier..."
        className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>

    {loading ? (
      <Loader fullscreen={false} />
    ) : files.length === 0 ? (
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-8 text-center">
        <FolderOpen size={40} className="text-primary-400 mx-auto mb-3" />
        <p className="text-lg text-muted">Aucun fichier pour le moment.</p>
      </div>
    ) : (
      <ul className="divide-y divide-border bg-surface rounded-2xl border border-border">
        {files.map((file) => (
          <li key={file.uuid} className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <FileIcon mime={file.mime_type} />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg truncate max-w-xs">
                  {file.path?.split('/').pop() || 'Fichier'}
                </p>
                <p className="text-base text-muted">
                  {formatFileSize(file.size)} — {new Date(file.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {file.path && (
                <a href={mediaUrl(file.path)} download
                  className="p-2.5 rounded-xl text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors">
                  <Download size={22} />
                </a>
              )}
              {canDelete && (
                <button onClick={() => onDelete(file)} className={btnDanger}><Trash2 size={22} /></button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}

    {(next || prev) && (
      <div className="flex items-center justify-between mt-6">
        <p className="text-muted text-base">{count} fichier(s) au total</p>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))} disabled={!prev}
            className={`${btnSecondary} ${!prev ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <ChevronLeft size={20} />
            Précédent
          </button>
          <span className="text-base font-medium text-foreground">Page {page}</span>
          <button type="button"
            onClick={() => onPageChange(page + 1)} disabled={!next}
            className={`${btnSecondary} ${!next ? 'opacity-40 cursor-not-allowed' : ''}`}>
            Suivant
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    )}
  </>
);

export default FileList;
