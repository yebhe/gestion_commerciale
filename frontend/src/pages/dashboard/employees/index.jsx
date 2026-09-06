import { useEffect, useState, useCallback } from 'react';
import { Users, ShieldCheck } from 'lucide-react';
import { employeesAPI, rolesAPI, storesAPI } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import AlertDialog from '../../../components/ui/AlertDialog';
import {
  EMPTY_FORM, EMPTY_ROLE_FORM, validateEmployeeStep,
} from './constants';
import EmployeeForm from './EmployeeForm';
import EmployeeList from './EmployeeList';
import RoleForm from './RoleForm';
import RolesList from './RolesList';
import SystemRolesList from './SystemRolesList';

const EmployeesModule = ({ sub, onBack }) => {
  const { hasPermission, scope } = useAuth();
  const isCompanyScope = scope === 'COMPANY';
  const isRoles = sub === 'roles';
  const isNewEmployee = sub === 'new-employee';

  const [tab, setTab] = useState(isRoles ? 'roles' : 'employees');
  const [allEmployees, setAllEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stores, setStores] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empPage, setEmpPage] = useState(1);
  const [empCount, setEmpCount] = useState(0);
  const [empNext, setEmpNext] = useState(null);
  const [empPrev, setEmpPrev] = useState(null);
  const [empSearch, setEmpSearch] = useState('');
  const [empSearchDebounced, setEmpSearchDebounced] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [roleSearchDebounced, setRoleSearchDebounced] = useState('');
  const [showForm, setShowForm] = useState(isNewEmployee);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [empStep, setEmpStep] = useState(0);
  const [stepErrors, setStepErrors] = useState({});
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [alert, setAlert] = useState(null);

  const showAlert = useCallback((type, title, message = '') => setAlert({ type, title, message }), []);
  const closeAlert = useCallback(() => setAlert(null), []);
  const closeConfirm = () => setConfirm({ ...confirm, open: false });

  const canUserCreate = hasPermission('users.create');
  const canUserUpdate = hasPermission('users.assign_roles');
  const canUserDelete = hasPermission('users.delete');
  const canRoleCreate = hasPermission('roles.create');
  const canRoleUpdate = hasPermission('roles.update');
  const canRoleDelete = hasPermission('roles.delete');
  const canAssignPermissions = hasPermission('roles.assign_permissions');

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, roleRes] = await Promise.all([
        employeesAPI.list(empPage, empSearchDebounced),
        rolesAPI.list(1, roleSearchDebounced),
      ]);
      setAllEmployees(empRes.data.results || empRes.data || []);
      setEmpCount(empRes.data.count || (empRes.data.results || empRes.data || []).length);
      setEmpNext(empRes.data.next || null);
      setEmpPrev(empRes.data.previous || null);
      setRoles(roleRes.data.results || roleRes.data || []);
      if (isCompanyScope) {
        try {
          const all = [];
          let p = 1;
          while (true) {
            const storeRes = await storesAPI.list(p);
            const results = storeRes.data.results || storeRes.data || [];
            all.push(...results);
            if (!storeRes.data.next) break;
            p++;
            if (p > 50) break;
          }
          setStores(all);
        } catch { /* ignore */ }
      }
      try {
        const permRes = await rolesAPI.allPermissions();
        setAllPermissions(permRes.data.results || permRes.data || []);
      } catch { /* ignore */ }
    } catch {
      setError('Impossible de charger les données.');
      showAlert('error', 'Erreur', 'Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setEmpSearchDebounced(empSearch); setEmpPage(1); }, 400);
    return () => clearTimeout(t);
  }, [empSearch]);

  useEffect(() => {
    const t = setTimeout(() => setRoleSearchDebounced(roleSearch), 400);
    return () => clearTimeout(t);
  }, [roleSearch]);

  useEffect(() => { loadData(); }, [empPage, empSearchDebounced, roleSearchDebounced]);
  useEffect(() => { setTab(isRoles ? 'roles' : 'employees'); setShowForm(isNewEmployee); }, [sub]);

  const closeForm = () => {
    setShowForm(false); setEditingItem(null); setForm(EMPTY_FORM);
    setRoleForm(EMPTY_ROLE_FORM); setSelectedPermissions([]);
    setShowPassword(false); setEmpStep(0); setStepErrors({});
  };

  const openCreateEmployee = () => {
    setEditingItem(null); setForm(EMPTY_FORM); setEmpStep(0);
    setStepErrors({}); setShowPassword(false); setError(''); setShowForm(true);
  };

  const openEditEmployee = (emp) => {
    setEditingItem(emp);
    setForm({
      email: emp.user?.email || '', password: '',
      first_name: emp.user?.first_name || '', last_name: emp.user?.last_name || '',
      phone: emp.user?.phone || '', role: emp.role?.uuid || '', store: emp.store?.uuid || '',
    });
    setEmpStep(0); setStepErrors({}); setShowPassword(false); setError(''); setShowForm(true);
  };

  const openCreateRole = () => {
    setEditingItem(null); setRoleForm(EMPTY_ROLE_FORM);
    setSelectedPermissions([]); setError(''); setShowForm(true);
  };

  const openEditRole = (role) => {
    setEditingItem(role);
    setRoleForm({ name: role.name || '', description: role.description || '', scope: role.scope || 'COMPANY' });
    setSelectedPermissions(role.permissions?.map((p) => p.code) || []);
    setError(''); setShowForm(true);
  };

  const nextEmpStep = () => {
    const errors = validateEmployeeStep(empStep, form, !!editingItem);
    if (Object.keys(errors).length > 0) { setStepErrors(errors); return; }
    setStepErrors({}); setEmpStep((p) => Math.min(p + 1, 2));
  };

  const prevEmpStep = () => { setStepErrors({}); setEmpStep((p) => Math.max(p - 1, 0)); };

  const handleEmployeeSubmit = async () => {
    const allErrors = {
      ...validateEmployeeStep(0, form, !!editingItem),
      ...validateEmployeeStep(1, form, !!editingItem),
    };
    const selectedRole = roles.find((r) => r.uuid === form.role);
    if (selectedRole?.scope === 'STORE' && !form.store)
      allErrors.store = 'Un magasin est requis pour un rôle de scope magasin.';
    if (Object.keys(allErrors).length > 0) {
      setStepErrors(allErrors); setError(Object.values(allErrors).join(' ')); return;
    }
    setError(''); setSubmitting(true);
    try {
      if (editingItem) {
        const data = { role: form.role };
        if (form.store) data.store = form.store;
        if (form.password) data.password = form.password;
        await employeesAPI.update(editingItem.uuid, data);
        showAlert('success', 'Employé modifié', `${form.first_name} ${form.last_name} mis à jour.`);
      } else {
        const data = {
          email: form.email.trim(), password: form.password,
          first_name: form.first_name.trim(), last_name: form.last_name.trim(),
          phone: form.phone || '', role: form.role,
        };
        if (form.store) data.store = form.store;
        await employeesAPI.create(data);
        showAlert('success', 'Employé créé', `${form.first_name} ${form.last_name} ajouté.`);
      }
      closeForm(); await loadData();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : "Impossible d'enregistrer.";
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleRoleSubmit = async () => {
    if (!roleForm.name.trim()) { setError('Le nom du rôle est obligatoire.'); return; }
    setError(''); setSubmitting(true);
    try {
      if (editingItem) {
        await rolesAPI.update(editingItem.uuid, { name: roleForm.name.trim(), description: roleForm.description || '' });
        if (canAssignPermissions) await rolesAPI.assignPermissions(editingItem.uuid, selectedPermissions);
        showAlert('success', 'Rôle modifié', `"${roleForm.name}" mis à jour.`);
      } else {
        const res = await rolesAPI.create({ name: roleForm.name.trim(), description: roleForm.description || '', scope: roleForm.scope });
        if (canAssignPermissions && selectedPermissions.length)
          await rolesAPI.assignPermissions(res.data.uuid, selectedPermissions);
        showAlert('success', 'Rôle créé', `"${roleForm.name}" ajouté.`);
      }
      closeForm(); await loadData();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : "Impossible d'enregistrer.";
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleDeleteEmployee = (emp) => {
    setConfirm({
      open: true, title: 'Supprimer l\'employé',
      message: `Désactiver ${emp.user?.first_name} ${emp.user?.last_name} ?`,
      onConfirm: async () => {
        try {
          await employeesAPI.remove(emp.uuid);
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Employé désactivé', `${emp.user?.first_name} ${emp.user?.last_name} désactivé.`);
          await loadData();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible de désactiver cet employé.');
        }
      },
    });
  };

  const handleDeleteRole = (role) => {
    if (role.is_system) { showAlert('warning', 'Action impossible', 'Les rôles système ne peuvent pas être supprimés.'); return; }
    setConfirm({
      open: true, title: 'Supprimer le rôle', message: `Supprimer "${role.name}" ?`,
      onConfirm: async () => {
        try {
          await rolesAPI.remove(role.uuid);
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Rôle supprimé', `"${role.name}" supprimé.`);
          await loadData();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible de supprimer ce rôle.');
        }
      },
    });
  };

  const tabs = [
    { key: 'employees', label: 'Employés', icon: Users, onClick: () => { setTab('employees'); onBack?.(); } },
    { key: 'roles', label: 'Rôles', icon: ShieldCheck, onClick: () => setTab('roles') },
    { key: 'system_roles', label: 'Rôles système', icon: ShieldCheck, onClick: () => setTab('system_roles') },
  ];

  return (
    <div>
      <AlertDialog alert={alert} onClose={closeAlert} />
      <div className="flex items-center gap-2 mb-6 border-b border-border">
        {tabs.map((t) => {
          const TabIcon = t.icon;
          return (
            <button key={t.key} type="button" onClick={t.onClick}
              className={`flex items-center gap-2 px-5 py-3 text-lg font-semibold border-b-3 transition-colors ${
                tab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-muted hover:text-foreground'
              }`}>
              <TabIcon size={24} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'employees' && (
        <div>
          {showForm ? (
            <EmployeeForm
              editingItem={editingItem} form={form} empStep={empStep}
              stepErrors={stepErrors} showPassword={showPassword}
              roles={roles} stores={stores} error={error} submitting={submitting}
              onEmpChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })}
              onNextStep={nextEmpStep} onPrevStep={prevEmpStep}
              onSubmit={handleEmployeeSubmit}
              onClose={() => { closeForm(); onBack?.(); }}
              onTogglePassword={() => setShowPassword(!showPassword)}
            />
          ) : (
            <EmployeeList
              employees={allEmployees} loading={loading} error={error}
              search={empSearch} page={empPage} count={empCount}
              next={empNext} prev={empPrev}
              canCreate={canUserCreate} canUpdate={canUserUpdate} canDelete={canUserDelete}
              onSearchChange={setEmpSearch} onPageChange={setEmpPage}
              onEdit={openEditEmployee} onDelete={handleDeleteEmployee}
              onCreate={openCreateEmployee}
            />
          )}
        </div>
      )}

      {tab === 'roles' && (
        <div>
          {showForm ? (
            <RoleForm
              editingItem={editingItem} roleForm={roleForm}
              selectedPermissions={selectedPermissions} allPermissions={allPermissions}
              canAssignPermissions={canAssignPermissions} error={error} submitting={submitting}
              onRoleFormChange={setRoleForm}
              onPermissionToggle={(code, checked) => {
                if (checked) setSelectedPermissions([...selectedPermissions, code]);
                else setSelectedPermissions(selectedPermissions.filter((c) => c !== code));
              }}
              onSubmit={handleRoleSubmit} onClose={closeForm}
            />
          ) : (
            <RolesList
              roles={roles} loading={loading} error={error} search={roleSearch}
              canCreate={canRoleCreate} canUpdate={canRoleUpdate} canDelete={canRoleDelete}
              onSearchChange={setRoleSearch} onEdit={openEditRole}
              onDelete={handleDeleteRole} onCreate={openCreateRole}
            />
          )}
        </div>
      )}

      {tab === 'system_roles' && (
        <SystemRolesList
          roles={roles} loading={loading} search={roleSearch}
          onSearchChange={setRoleSearch}
        />
      )}

      <ConfirmDialog
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.onConfirm} onCancel={closeConfirm}
      />
    </div>
  );
};

export default EmployeesModule;
