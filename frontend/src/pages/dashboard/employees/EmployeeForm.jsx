import {
  X, Eye, EyeOff, ChevronRight, ChevronLeft,
} from 'lucide-react';
import {
  EMPLOYEE_STEPS, inputClass, labelClass, btnPrimary, btnSecondary,
} from './constants';

const EmployeeForm = ({
  editingItem, form, empStep, stepErrors, showPassword,
  roles, stores, error, submitting,
  onEmpChange, onNextStep, onPrevStep, onSubmit, onClose,
  onTogglePassword,
}) => (
  <div className="bg-surface rounded-2xl border border-border p-6 mb-6 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>
    <h2 className="text-xl font-bold text-foreground mb-2">
      {editingItem ? 'Modifier l\'employé' : 'Nouvel employé'}
    </h2>

    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
      {EMPLOYEE_STEPS.map((s, idx) => {
        const StepIcon = s.icon;
        return (
          <div key={s.key} className="flex items-center gap-2 flex-shrink-0">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${empStep === idx ? 'bg-primary-600 text-white' : empStep > idx ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-muted'}`}>
              <StepIcon size={20} />
              <span className="text-sm font-medium">{s.label}</span>
            </div>
            {idx < EMPLOYEE_STEPS.length - 1 && <ChevronRight size={18} className="text-muted flex-shrink-0" />}
          </div>
        );
      })}
    </div>

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base mb-4">{error}</div>
    )}

    <div className="space-y-6">
      {empStep === 0 && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Email</label>
            <input name="email" value={form.email} onChange={onEmpChange} className={inputClass} placeholder="ex@entreprise.com" />
            {stepErrors.email && <p className="text-base text-red-600 mt-1">{stepErrors.email}</p>}
          </div>
          <div>
            <label className={labelClass}>Mot de passe {editingItem && '(laisser vide pour ne pas changer)'}</label>
            <div className="relative">
              <input name="password" type={showPassword ? 'text' : 'password'}
                value={form.password} onChange={onEmpChange} className={inputClass} placeholder="••••••••" />
              <button type="button" onClick={onTogglePassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {stepErrors.password && <p className="text-base text-red-600 mt-1">{stepErrors.password}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Prénom</label>
              <input name="first_name" value={form.first_name} onChange={onEmpChange} className={inputClass} placeholder="Prénom" />
              {stepErrors.first_name && <p className="text-base text-red-600 mt-1">{stepErrors.first_name}</p>}
            </div>
            <div>
              <label className={labelClass}>Nom</label>
              <input name="last_name" value={form.last_name} onChange={onEmpChange} className={inputClass} placeholder="Nom" />
              {stepErrors.last_name && <p className="text-base text-red-600 mt-1">{stepErrors.last_name}</p>}
            </div>
          </div>
          <div>
            <label className={labelClass}>Téléphone</label>
            <input name="phone" value={form.phone} onChange={onEmpChange} className={inputClass} placeholder="+221 77 123 45 67" />
          </div>
        </div>
      )}

      {empStep === 1 && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Rôle</label>
            <select name="role" value={form.role} onChange={onEmpChange} className={inputClass}>
              <option value="">— Sélectionner —</option>
              {roles.map((r) => (
                <option key={r.uuid} value={r.uuid}>{r.name} ({r.scope === 'COMPANY' ? 'Entreprise' : 'Magasin'})</option>
              ))}
            </select>
            {stepErrors.role && <p className="text-base text-red-600 mt-1">{stepErrors.role}</p>}
          </div>
          {(() => {
            const selectedRole = roles.find((r) => r.uuid === form.role);
            if (selectedRole?.scope !== 'STORE') return null;
            return (
              <div>
                <label className={labelClass}>Magasin assigné</label>
                <select name="store" value={form.store} onChange={onEmpChange} className={inputClass}>
                  <option value="">— Sélectionner —</option>
                  {stores.map((s) => (
                    <option key={s.uuid} value={s.uuid}>{s.name}</option>
                  ))}
                </select>
                {stepErrors.store && <p className="text-base text-red-600 mt-1">{stepErrors.store}</p>}
              </div>
            );
          })()}
        </div>
      )}

      {empStep === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Vérifiez les informations</h3>
          <div className="bg-gray-50 rounded-xl p-5 space-y-2 text-base">
            <p><span className="font-semibold">Email :</span> {form.email || '—'}</p>
            <p><span className="font-semibold">Prénom :</span> {form.first_name || '—'}</p>
            <p><span className="font-semibold">Nom :</span> {form.last_name || '—'}</p>
            <p><span className="font-semibold">Téléphone :</span> {form.phone || '—'}</p>
            <p><span className="font-semibold">Rôle :</span> {roles.find(r => r.uuid === form.role)?.name || '—'}</p>
            {form.store && <p><span className="font-semibold">Magasin :</span> {stores.find(s => s.uuid === form.store)?.name || '—'}</p>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button type="button" onClick={onPrevStep} disabled={empStep === 0}
          className={`${btnSecondary} ${empStep === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <ChevronLeft size={24} />
          Précédent
        </button>
        {empStep < EMPLOYEE_STEPS.length - 1 ? (
          <button type="button" onClick={onNextStep} className={btnPrimary}>
            Suivant
            <ChevronRight size={24} />
          </button>
        ) : (
          <button type="button" onClick={onSubmit} disabled={submitting}
            className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        )}
      </div>
    </div>
  </div>
);

export default EmployeeForm;
