import { useEffect, useState } from 'react';
import { auditAPI } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import AlertDialog from '../../../components/ui/AlertDialog';
import AuditList from './AuditList';
import AuditDetail from './AuditDetail';

const AuditModule = () => {
  const { hasPermission } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [viewingLog, setViewingLog] = useState(null);
  const [alert, setAlert] = useState(null);

  const showAlert = (type, title, message = '') => setAlert({ type, title, message });
  const closeAlert = () => setAlert(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await auditAPI.list(page, searchDebounced);
      setLogs(res.data.results || res.data || []);
      setCount(res.data.count || (res.data.results || res.data || []).length);
      setNext(res.data.next || null);
      setPrev(res.data.previous || null);
    } catch {
      showAlert('error', 'Erreur', 'Impossible de charger le journal d\'audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { loadLogs(); }, [page, searchDebounced]);

  return (
    <div>
      <AlertDialog alert={alert} onClose={closeAlert} />

      {viewingLog ? (
        <AuditDetail log={viewingLog} onClose={() => setViewingLog(null)} />
      ) : (
        <AuditList
          logs={logs} loading={loading} search={search}
          page={page} count={count} next={next} prev={prev}
          onSearchChange={setSearch} onPageChange={setPage}
          onView={setViewingLog}
        />
      )}
    </div>
  );
};

export default AuditModule;
