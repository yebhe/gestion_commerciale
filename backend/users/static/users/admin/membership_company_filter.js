(function () {
  'use strict';

  function getJQuery() {
    if (typeof window.django !== 'undefined' && window.django.jQuery) return window.django.jQuery;
    if (typeof window.jQuery !== 'undefined') return window.jQuery;
    return null;
  }

  function init() {
    var $ = getJQuery();
    if (!$) {
      console.error('[membership_filter] jQuery not available, retrying...');
      setTimeout(init, 200);
      return;
    }

    var companyField = $('#id_company');
    var roleSelect = $('#id_role');
    var storeSelect = $('#id_store');

    if (!companyField.length) {
      console.warn('[membership_filter] #id_company not found');
      return;
    }
    if (!roleSelect.length || !storeSelect.length) {
      console.warn('[membership_filter] #id_role or #id_store not found');
      return;
    }

    console.log('[membership_filter] Initialized OK');

    function updateOptions(select, items, selectedValue) {
      var placeholder = $('<option value="">---------</option>');
      select.empty().append(placeholder);
      $.each(items, function (i, item) {
        var opt = $('<option></option>').attr('value', item.value).text(item.label);
        if (item.value === selectedValue) opt.attr('selected', 'selected');
        select.append(opt);
      });
      // Notify SelectFilter2 if present
      if (typeof window.SelectFilter !== 'undefined' && select.hasClass('selectfilter')) {
        window.SelectFilter.redisplay();
      }
    }

    function fetchAndFilter(companyId, currentRole, currentStore) {
      if (!companyId) {
        updateOptions(roleSelect, [], null);
        updateOptions(storeSelect, [], null);
        return;
      }
      // Build URL: /admin/users/membership/filter-by-company/
      var adminBase = window.location.pathname.match(/^(\/admin\/users\/membership\/)/);
      var filterUrl = adminBase ? adminBase[1] + 'filter-by-company/' : '/admin/users/membership/filter-by-company/';
      console.log('[membership_filter] Fetching:', filterUrl, 'company_id:', companyId);
      $.ajax({
        url: filterUrl,
        data: { company_id: companyId },
        dataType: 'json',
        success: function (data) {
          console.log('[membership_filter] Got', data.roles.length, 'roles,', data.stores.length, 'stores');
          updateOptions(roleSelect, data.roles, currentRole);
          updateOptions(storeSelect, data.stores, currentStore);
        },
        error: function (xhr, status, err) {
          console.error('[membership_filter] AJAX error:', status, err, xhr.responseText);
        }
      });
    }

    // Initial load
    var currentRole = roleSelect.val();
    var currentStore = storeSelect.val();
    var initialCompany = companyField.val();
    if (initialCompany) {
      fetchAndFilter(initialCompany, currentRole, currentStore);
    }

    // On company change - use native event listener for reliability
    var companyEl = companyField[0];
    companyEl.addEventListener('change', function () {
      var val = this.value;
      console.log('[membership_filter] company changed to:', val);
      fetchAndFilter(val, null, null);
    });

    // Also listen for jQuery change events (in case Select2 or other widgets trigger them)
    companyField.on('change', function () {
      var val = $(this).val();
      console.log('[membership_filter] company jQuery change to:', val);
      fetchAndFilter(val, null, null);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
  } else {
    setTimeout(init, 300);
  }
})();
