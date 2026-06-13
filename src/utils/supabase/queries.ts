import { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';

// Use a permissive generic shape so callers can pass either a typed
// `SupabaseClient<Database>` (from @/utils/supabase/server|client) or an
// untyped client. @supabase/supabase-js' generic arity has drifted across
// minor versions; the wider signature absorbs that.
type AnySupabaseClient = SupabaseClient<any, any, any>;

export const getUser = cache(async (supabase: AnySupabaseClient) => {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
});

export const getSubscription = cache(async (supabase: AnySupabaseClient) => {
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('*, prices(*, products(*))')
    .in('status', ['trialing', 'active'])
    .maybeSingle();

  return subscription;
});

export const getProducts = cache(async (supabase: AnySupabaseClient) => {
  const { data: products, error } = await supabase
    .from('products')
    .select('*, prices(*)')
    .eq('active', true)
    .eq('prices.active', true)
    .order('metadata->index')
    .order('unit_amount', { referencedTable: 'prices' });

  return products;
});

export const getUserDetails = cache(async (supabase: AnySupabaseClient) => {
  const { data: userDetails } = await supabase
    .from('users')
    .select('*')
    .single();
  return userDetails;
});
