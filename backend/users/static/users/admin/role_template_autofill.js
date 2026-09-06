(function () {
  'use strict';

  function parseTemplatesData() {
    const select = document.getElementById('id_system_template');
    if (!select) return null;
    const raw = select.getAttribute('data-role-templates');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  function setChecked(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  }

  function resetPermissions() {
    if (typeof SelectBox === 'undefined' || typeof SelectBox.move_all === 'undefined') return;

    const fromId = 'id_permissions_from';
    const toId = 'id_permissions_to';
    const fromBox = document.getElementById(fromId);
    const toBox = document.getElementById(toId);
    if (!fromBox || !toBox) return;

    try {
      SelectBox.move_all(toId, fromId);
      if (typeof SelectFilter !== 'undefined' && typeof SelectFilter.refresh_icons === 'function') {
        SelectFilter.refresh_icons('id_permissions');
      }
    } catch (e) {
      // Fallback : le serveur ré-appliquera les permissions à l'enregistrement.
    }
  }

  function updatePermissions(permissionIds) {
    if (!permissionIds || !permissionIds.length) return;
    if (typeof SelectBox === 'undefined' || typeof SelectBox.move === 'undefined') return;

    const fromId = 'id_permissions_from';
    const toId = 'id_permissions_to';
    const fromBox = document.getElementById(fromId);
    const toBox = document.getElementById(toId);
    if (!fromBox || !toBox) return;

    try {
      // Afficher toutes les options (annuler les filtres actifs).
      const filterInput = document.getElementById('id_permissions_input');
      const selectedFilterInput = document.getElementById('id_permissions_selected_input');
      if (filterInput) filterInput.value = '';
      if (selectedFilterInput) selectedFilterInput.value = '';
      if (typeof SelectBox.filter === 'function') {
        SelectBox.filter(fromId, '');
        SelectBox.filter(toId, '');
      }

      // Réinitialiser : remettre toutes les permissions choisies dans la liste disponible.
      resetPermissions();

      // Sélectionner puis déplacer les permissions du template vers les choisies.
      const permissionSet = new Set(permissionIds);
      for (const option of fromBox.options) {
        option.selected = permissionSet.has(option.value);
      }
      SelectBox.move(fromId, toId);

      // Mettre à jour les icônes du widget filter_horizontal.
      if (typeof SelectFilter !== 'undefined' && typeof SelectFilter.refresh_icons === 'function') {
        SelectFilter.refresh_icons('id_permissions');
      }
    } catch (e) {
      // Fallback : le serveur ré-appliquera les permissions à l'enregistrement.
    }
  }

  function resetFields() {
    setValue('id_name', '');
    setValue('id_description', '');
    setChecked('id_is_system', false);
    setValue('id_scope', 'COMPANY');
    resetPermissions();
  }

  function fillFields() {
    const templates = parseTemplatesData();
    const select = document.getElementById('id_system_template');
    if (!templates || !select) return;

    const value = select.value;
    if (!value || !templates[value]) {
      resetFields();
      return;
    }

    const data = templates[value];
    setValue('id_name', value);
    setValue('id_description', data.description || '');
    setChecked('id_is_system', true);
    setValue('id_scope', data.scope || 'COMPANY');
    updatePermissions(data.permissions);
  }

  function init() {
    const select = document.getElementById('id_system_template');
    const isSystem = document.getElementById('id_is_system');

    if (select) {
      select.addEventListener('change', fillFields);
    }

    if (select && isSystem) {
      isSystem.addEventListener('change', function () {
        if (!isSystem.checked) {
          select.value = '';
          resetFields();
        }
      });
    }

    fillFields();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
