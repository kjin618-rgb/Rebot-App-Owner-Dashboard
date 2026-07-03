import { getSupabase } from './supabase';
import { getStoreRow } from './db-server';

export async function calcStampCompletionRate(storeCode: string): Promise<number | null> {
  const storeRow = await getStoreRow(storeCode);
  if (!storeRow) return null;

  const { data: customers } = await getSupabase()
    .from('customers')
    .select('total_stamps')
    .eq('store_id', storeRow.id);

  if (!customers || customers.length === 0) return null;

  const completedCount = customers.filter(
    (c: any) => Math.floor((c.total_stamps ?? 0) / storeRow.stamp_goal) >= 1
  ).length;

  return (completedCount / customers.length) * 100;
}

export async function calcSecondVisitRate30d(storeCode: string): Promise<number | null> {
  const storeRow = await getStoreRow(storeCode);
  if (!storeRow) return null;

  const { data: customers } = await getSupabase()
    .from('customers')
    .select('id')
    .eq('store_id', storeRow.id);

  if (!customers || customers.length === 0) return null;

  const { data: visitRows } = await getSupabase()
    .from('visit_logs')
    .select('customer_id, visited_at')
    .eq('store_id', storeRow.id)
    .order('visited_at', { ascending: true });

  const visitsByCustomer = new Map<string, string[]>();
  for (const row of visitRows || []) {
    const list = visitsByCustomer.get(row.customer_id) ?? [];
    list.push(row.visited_at);
    visitsByCustomer.set(row.customer_id, list);
  }

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  let qualifyingCount = 0;

  for (const customer of customers) {
    const visits = visitsByCustomer.get(customer.id);
    if (!visits || visits.length < 2) continue;

    const firstVisit = new Date(visits[0]).getTime();
    const secondVisit = new Date(visits[1]).getTime();
    if (secondVisit - firstVisit <= THIRTY_DAYS_MS) {
      qualifyingCount++;
    }
  }

  return (qualifyingCount / customers.length) * 100;
}
