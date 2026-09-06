import { useState, useEffect } from 'react';
import { Paintbrush } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { generatePalette } from '../../lib/theme';

/**
 * Paramètres de l'entreprise : l'utilisateur choisit la couleur de fond,
 * le reste de la palette est calculé automatiquement pour la visibilité.
 */
const SettingsModule = () => {
  const { settings, updateSettings, company } = useAuth();
  const [color, setColor] = useState('#12151a');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const initial = settings?.background_color || '#12151a';
    setColor(initial);
    setPreview(generatePalette(initial));
  }, [settings]);

  const handleChange = (e) => {
    const value = e.target.value;
    setColor(value);
    try {
      setPreview(generatePalette(value));
    } catch (err) {
      // ignore invalid hex
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    try {
      await updateSettings({ background_color: color });
      setSaved(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-3">
        <Paintbrush size={28} className="text-primary-600" />
        Apparence
      </h1>
      <p className="text-muted mb-6">
        Choisissez une couleur de fond. Les autres couleurs (textes, surfaces, primaire) sont calculées automatiquement pour une visibilité optimale.
      </p>

      <form onSubmit={handleSubmit} className="bg-surface rounded-xl shadow-sm border border-border p-6 space-y-6">
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            Paramètres enregistrés.
          </div>
        )}

        <div>
          <label htmlFor="background_color" className="block text-sm font-medium text-foreground mb-1">
            Couleur de fond de l'application
          </label>
          <div className="flex items-center gap-3">
            <input
              id="background_color"
              name="background_color"
              type="color"
              value={color}
              onChange={handleChange}
              className="h-12 w-12 p-0 border-0 rounded-lg cursor-pointer"
              required
            />
            <input
              type="text"
              value={color}
              onChange={handleChange}
              pattern="^#[0-9a-fA-F]{6}$"
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {preview && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Aperçu automatique de la palette</p>
            <div
              className="rounded-xl border border-border p-6 space-y-4"
              style={{ backgroundColor: preview.background, color: preview.foreground }}
            >
              <div className="flex flex-wrap gap-3">
                <div className="px-4 py-2 rounded-lg font-semibold" style={{ backgroundColor: preview.surface, color: preview.foreground }}>
                  Surface
                </div>
                <div className="px-4 py-2 rounded-lg font-semibold" style={{ backgroundColor: preview.primary[5], color: preview.surface }}>
                  Primaire
                </div>
                <div className="px-4 py-2 rounded-lg font-semibold" style={{ backgroundColor: preview.gray[4], color: preview.foreground }}>
                  Texte secondaire
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between">
          <p className="text-xs text-muted">
            Entreprise : {company?.name || '—'}
          </p>
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-6 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsModule;
