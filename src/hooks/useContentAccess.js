import { useEffect, useState } from 'react';
import { normalizeAccessResult } from '../lib/commerce';

export default function useContentAccess(items, user, supabase, refreshKey = 0) {
  const [accessByKey, setAccessByKey] = useState({});
  const [loading, setLoading] = useState(false);
  const [resolvedRequestKey, setResolvedRequestKey] = useState('');
  const [error, setError] = useState('');
  const itemKey = items.map((item) => `${item.type}:${item.id}:${item.paid ? 1 : 0}`).join('|');
  const requestKey = `${itemKey}::${user?.id || ''}::${refreshKey}`;
  const hasPaidItems = items.some((item) => item.paid);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const userId = user?.id;
      setLoading(items.some((item) => item.paid));
      setError('');
      const results = {};
      const paidItems = items.filter((item) => item.paid);
      paidItems.forEach((item) => { results[`${item.type}:${item.id}`] = false; });
      if (!paidItems.length) {
        setAccessByKey(results);
        setResolvedRequestKey(requestKey);
        setLoading(false);
        return;
      }
      if (!userId || !supabase) {
        if (active) {
          setAccessByKey(results);
          setResolvedRequestKey(requestKey);
          setLoading(false);
        }
        return;
      }
      try {
        // Fast-path: 1 batched query to user_access for all active grants
        const { data: userGrants, error: grantsError } = await supabase
          .from('user_access')
          .select('item_type, item_id, expires_at, is_active, status')
          .eq('user_id', user.id);

        if (grantsError) throw grantsError;

        const now = new Date();
        const activeGrants = (userGrants || []).filter((g) => {
          if (g.is_active === false) return false;
          if (g.status && !['active', 'granted', 'lifetime'].includes(String(g.status).toLowerCase())) return false;
          if (g.expires_at) {
            const expiresAt = new Date(g.expires_at);
            if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) return false;
          }
          return true;
        });

        // Fast-path 1: If user has zero active purchases, all paid items are false
        if (!activeGrants.length) {
          if (active) {
            setAccessByKey(results);
            setResolvedRequestKey(requestKey);
            setLoading(false);
          }
          return;
        }

        // Fast-path 2: Check direct matches
        const activeGrantKeys = new Set(activeGrants.map((g) => `${g.item_type}:${g.item_id}`));
        const unresolved = [];

        paidItems.forEach((item) => {
          const key = `${item.type}:${item.id}`;
          if (activeGrantKeys.has(key)) {
            results[key] = true;
          } else {
            // Needs hierarchical check (e.g. chapter in purchased folder)
            unresolved.push(item);
          }
        });

        // Only run RPC for items that need hierarchical evaluation
        if (unresolved.length > 0) {
          const checks = await Promise.all(unresolved.map(async (item) => {
            const { data, error: accessError } = await supabase.rpc('check_user_access', {
              p_user_id: userId,
              p_item_type: item.type,
              p_item_id: item.id
            });
            if (accessError) throw accessError;
            return [`${item.type}:${item.id}`, normalizeAccessResult(data)];
          }));
          Object.assign(results, Object.fromEntries(checks));
        }

        if (!active) return;
        setAccessByKey(results);
        setResolvedRequestKey(requestKey);
      } catch (accessError) {
        if (active) {
          setAccessByKey(results);
          setResolvedRequestKey(requestKey);
          setError(accessError.message || 'Unable to verify your content access.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [items, requestKey, supabase, user?.id]);

  const requestResolved = !hasPaidItems || resolvedRequestKey === requestKey;
  return {
    accessByKey: requestResolved ? accessByKey : {},
    loading: loading || (hasPaidItems && !requestResolved),
    error
  };
}
