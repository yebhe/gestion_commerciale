import { Building, Camera } from 'lucide-react';
import { mediaUrl } from '../../../lib/api';
import { inputClass, labelClass, btnPrimary } from './constants';

/**
 * Informations de l'entreprise : logo, nom, téléphone, email, adresse
 * (_docs/01_CAHIER_DES_CHARGES_SAA.txt — personnalisation par entreprise).
 */
const CompanyInfoForm = ({
  form, logoFile, logoPreview, currentLogo, canUpdate,
  error, submitting, saved,
  onChange, onLogoChange, onSubmit,
}) => (
  <div className="max-w-2xl">
    <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-3">
      <Building size={24} className="text-primary-600" />
      Informations de l'entreprise
    </h2>
    <p className="text-muted mb-6">
      Ces informations apparaissent sur les reçus et dans l'application.
    </p>

    <form onSubmit={onSubmit} className="bg-surface rounded-xl shadow-sm border border-border p-6 space-y-6">
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          Informations enregistrées avec succès.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label className={labelClass}>Logo</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border border-border bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
            {logoPreview || currentLogo ? (
              <img src={logoPreview || mediaUrl(currentLogo)} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Building size={32} className="text-gray-300" />
            )}
          </div>
          {canUpdate && (
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground font-medium cursor-pointer hover:bg-gray-50">
              <Camera size={18} />
              Changer le logo
              <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
            </label>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Nom de l'entreprise</label>
        <input
          type="text" name="name" value={form.name} onChange={onChange}
          disabled={!canUpdate} className={inputClass}
          placeholder="Ex : Boutique Mamadou"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Téléphone</label>
          <input
            type="text" name="phone" value={form.phone} onChange={onChange}
            disabled={!canUpdate} className={inputClass}
            placeholder="Ex : 622 00 00 00"
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email" name="email" value={form.email} onChange={onChange}
            disabled={!canUpdate} className={inputClass}
            placeholder="Ex : contact@entreprise.com"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Adresse</label>
        <input
          type="text" name="address" value={form.address} onChange={onChange}
          disabled={!canUpdate} className={inputClass}
          placeholder="Ex : Conakry, Guinée"
        />
      </div>

      {canUpdate && (
        <div className="pt-2 flex justify-end">
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      )}
    </form>
  </div>
);

export default CompanyInfoForm;
