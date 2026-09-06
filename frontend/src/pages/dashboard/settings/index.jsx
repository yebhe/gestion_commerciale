import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import Loader from '../../../contexts/Loader';
import { companiesAPI } from '../../../lib/api';
import AppearanceSettings from './AppearanceSettings';
import CompanyInfoForm from './CompanyInfoForm';
import { EMPTY_COMPANY_FORM, btnSecondary } from './constants';

/**
 * Module Paramètres : sous-sections "Apparence" et "Informations de
 * l'entreprise", pilotées par appsCatalog.js (cartes, comme Produits).
 * `sub` détermine la sous-section active.
 */
const SettingsModule = ({ sub, onBack }) => {
  const { hasPermission, setCompany } = useAuth();
  const canViewCompany = hasPermission('company.view');
  const canUpdateCompany = hasPermission('company.manage_settings');

  const [form, setForm] = useState(EMPTY_COMPANY_FORM);
  const [currentLogo, setCurrentLogo] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (sub !== 'company-info' || !canViewCompany) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await companiesAPI.getCurrent();
        setForm({
          name: res.data.name || '', phone: res.data.phone || '',
          email: res.data.email || '', address: res.data.address || '',
        });
        setCurrentLogo(res.data.logo || '');
      } catch {
        setError("Impossible de charger les informations de l'entreprise.");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub]);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Veuillez saisir le nom de l'entreprise.");
      return;
    }
    setError(''); setSaved(false); setSubmitting(true);
    try {
      const data = new FormData();
      data.append('name', form.name);
      data.append('phone', form.phone || '');
      data.append('email', form.email || '');
      data.append('address', form.address || '');
      if (logoFile) data.append('logo', logoFile);

      const res = await companiesAPI.updateCurrent(data);
      setCurrentLogo(res.data.logo || '');
      setLogoFile(null); setLogoPreview(null);
      setCompany?.(res.data);
      setSaved(true);
    } catch (err) {
      const msg = err.response?.data
        ? Object.values(err.response.data).flat().join(' ')
        : "Impossible d'enregistrer les informations.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {onBack && (
        <button type="button" onClick={onBack} className={`${btnSecondary} mb-4`}>
          Retour
        </button>
      )}

      {sub === 'appearance' && <AppearanceSettings />}

      {sub === 'company-info' && canViewCompany && (
        loading ? (
          <Loader fullscreen={false} />
        ) : (
          <CompanyInfoForm
            form={form} logoFile={logoFile} logoPreview={logoPreview} currentLogo={currentLogo}
            canUpdate={canUpdateCompany} error={error} submitting={submitting} saved={saved}
            onChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })}
            onLogoChange={handleLogoChange} onSubmit={handleSubmit}
          />
        )
      )}
    </div>
  );
};

export default SettingsModule;
