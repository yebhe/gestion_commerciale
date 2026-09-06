import { X } from 'lucide-react';
import { mediaUrl } from '../../../lib/api';
import { inputClass, labelClass, btnPrimary } from './constants';

const StoreForm = ({
  editingStore, form, logoFile, error, submitting,
  onChange, onLogoChange, onSubmit, onClose,
}) => (
  <form onSubmit={onSubmit} className="bg-surface rounded-2xl border border-border p-6 mb-6 space-y-5 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>

    <h2 className="text-xl font-bold text-foreground">
      {editingStore ? 'Modifier le magasin' : 'Nouveau magasin'}
    </h2>

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">
        {error}
      </div>
    )}

    <div>
      <label className={labelClass}>Nom du magasin</label>
      <input name="name" value={form.name} onChange={onChange}
        className={inputClass} placeholder="Ex: Magasin Centre-Ville" />
    </div>

    <div>
      <label className={labelClass}>Adresse</label>
      <input name="address" value={form.address} onChange={onChange}
        className={inputClass} placeholder="Ex: Rue 12, Dakar" />
    </div>

    <div>
      <label className={labelClass}>Téléphone</label>
      <input name="phone" value={form.phone} onChange={onChange}
        className={inputClass} placeholder="Ex: +221 77 123 45 67" />
    </div>

    <div>
      <label className={labelClass}>Logo</label>
      <input type="file" accept="image/*" onChange={onLogoChange}
        className="w-full text-base text-muted" />
      {logoFile && (
        <p className="text-base text-green-600 mt-2">Nouveau logo sélectionné : {logoFile.name}</p>
      )}
      {editingStore?.logo && !logoFile && (
        <img src={mediaUrl(editingStore.logo)} alt="Logo actuel"
          className="mt-3 h-20 w-20 rounded-xl object-cover border border-border" />
      )}
    </div>

    <button type="submit" disabled={submitting}
      className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {submitting ? 'Enregistrement...' : 'Enregistrer'}
    </button>
  </form>
);

export default StoreForm;
