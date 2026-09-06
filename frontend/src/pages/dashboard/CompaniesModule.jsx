import { useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import Loader from '../../contexts/Loader';
import { authAPI, companiesAPI } from '../../lib/api';

const STATUS_STYLES = {
  trial: 'bg-primary-50 text-primary-700',
  active: 'bg-green-50 text-green-700',
  suspended: 'bg-orange-50 text-orange-700',
  cancelled: 'bg-red-50 text-red-700',
};

const EMPTY_FORM = {
  company_name: '',
  email: '',
  password: '',
  password_confirm: '',
  first_name: '',
  last_name: '',
};

/**
 * Contenu du module "Compagnies" : un module comme un autre dans le
 * dashboard unique et modulaire (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt,
 * section "ARCHITECTURE DASHBOARD"), affiché uniquement pour le rôle
 * plateforme SUPER_ADMIN (is_superuser). Ne rend que le contenu de la
 * carte — le conteneur (titre, icône) est fourni par le composant `Module`
 * du dashboard.
 */
const CompaniesModule = () => {
  const [companies, setCompanies] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCompanies = async () => {
    setLoadingList(true);
    try {
      const response = await companiesAPI.getAllCompanies();
      setCompanies(response.data.results || []);
    } catch (err) {
      setError("Impossible de charger la liste des entreprises.");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.password_confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      await authAPI.register(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadCompanies();
    } catch (err) {
      const data = err.response?.data;
      const message = data
        ? Object.values(data).flat().join(' ')
        : 'Erreur lors de la création de la compagnie.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-500 text-sm">{companies.length} compagnie(s) sur la plateforme</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium"
        >
          <Plus size={18} />
          Créer une compagnie
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
              <input
                name="company_name" required value={form.company_name} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom du propriétaire</label>
              <input
                name="first_name" required value={form.first_name} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du propriétaire</label>
              <input
                name="last_name" required value={form.last_name} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email du propriétaire</label>
              <input
                type="email" name="email" required value={form.email} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input
                type="password" name="password" required minLength={6} value={form.password} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
              <input
                type="password" name="password_confirm" required value={form.password_confirm} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="h-11 px-6 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold disabled:opacity-50"
          >
            {submitting ? 'Création...' : 'Créer la compagnie'}
          </button>
        </form>
      )}

      {loadingList ? (
        <Loader fullscreen={false} />
      ) : companies.length === 0 ? (
        <p className="text-gray-500 text-[15px]">Aucune compagnie pour le moment.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {companies.map((c) => (
            <li key={c.uuid} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Building2 size={18} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-[15px]">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.email || 'Aucun email'}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_STYLES[c.subscription_status] || 'bg-gray-100 text-gray-600'}`}>
                {c.subscription_status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CompaniesModule;
