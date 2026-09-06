import { X, Upload } from 'lucide-react';
import { inputClass, labelClass, btnPrimary } from './constants';

const FileUploadForm = ({
  error, submitting,
  stores, isCompanyScope, uploadStore, onStoreChange,
  onFileChange, onSubmit, onClose,
}) => (
  <div className="bg-surface rounded-2xl border border-border p-6 mb-6 space-y-4 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>
    <h2 className="text-xl font-bold text-foreground">Téléverser un fichier</h2>

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">{error}</div>
    )}

    {isCompanyScope && (
      <div>
        <label className={labelClass}>Magasin</label>
        <select
          value={uploadStore}
          onChange={(e) => onStoreChange(e.target.value)}
          className={inputClass}
        >
          <option value="">— Aucun (niveau entreprise) —</option>
          {stores.map((s) => (
            <option key={s.uuid} value={s.uuid}>{s.name}</option>
          ))}
        </select>
      </div>
    )}

    <div>
      <label className={labelClass}>Fichier</label>
      <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
        <Upload size={32} className="text-muted mx-auto mb-3" />
        <input type="file" onChange={onFileChange}
          className="w-full text-base text-muted" />
      </div>
    </div>

    <button type="button" onClick={onSubmit} disabled={submitting}
      className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {submitting ? 'Téléversement...' : 'Téléverser'}
    </button>
  </div>
);

export default FileUploadForm;
