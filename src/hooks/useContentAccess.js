import { useEffect, useState } from 'react';
import { normalizeAccessResult } from '../lib/commerce';

export default function useContentAccess(items, user, supabase, refreshKey = 0) {
  const [accessByKey, setAccessByKey] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const itemKey = items.map((item) => `${item.type}:${item.id}:${item.paid ? 1 : 0}`).join('|');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(items.some((item) => item.paid));
      setError('');
      const results = {};
      const paidItems = items.filter((item) => item.paid);
      paidItems.forEach((item) => { results[`${item.type}:${item.id}`] = false; });
      if (!paidItems.length) {
        setAccessByKey(results);
        setLoading(false);
        return;
      }
      if (!user || !supabase) {
        if (active) {
          setAccessByKey(results);
          setLoading(false);
        }
        return;
      }
      try {
        const checks = await Promise.all(paidItems.map(async (item) => {
          const { data, error: accessError } = await supabase.rpc('check_user_access', {
            p_user_id: user.id,
            p_item_type: item.type,
            p_item_id: item.id
          });
          if (accessError) throw accessError;
          return [`${item.type}:${item.id}`, normalizeAccessResult(data)];
        }));
        if (!active) return;
        Object.assign(results, Object.fromEntries(checks));
        setAccessByKey(results);
      } catch (accessError) {
        if (active) {
          setAccessByKey(results);
          setError(accessError.message || 'Unable to verify your content access.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [itemKey, user?.id, supabase, refreshKey]);

  return { accessByKey, loading, error };
}
