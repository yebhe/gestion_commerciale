import { useEffect, useRef } from 'react';

/**
 * Recharge un callback dès qu'une opération hors ligne / en ligne termine
 * ou que la file d'attente a été synchronisée.
 */
export default function useSyncRefresh(callback) {
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; }, [callback]);

  useEffect(() => {
    const onChange = () => {
      if (typeof cbRef.current === 'function') cbRef.current();
    };
    window.addEventListener('yebhe:data-changed', onChange);
    window.addEventListener('yebhe:synced', onChange);
    return () => {
      window.removeEventListener('yebhe:data-changed', onChange);
      window.removeEventListener('yebhe:synced', onChange);
    };
  }, []);
}
