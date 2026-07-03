import 'dotenv/config';
import { getSupabase } from '../src/lib/supabase';
import { normalizePhone, maskPhone } from '../src/lib/phone';
import {
  STORE_CODES,
  SEED_PHONE_PREFIX,
  CHURN_STAGE_DAYS_AGO,
  SAMPLE_NAMES,
} from './seed-constants';

const STAGES = Object.keys(CHURN_STAGE_DAYS_AGO) as Array<keyof typeof CHURN_STAGE_DAYS_AGO>;

async function getOrCreateStoreId(storeCode: string): Promise<string> {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .eq('store_code', storeCode)
    .single();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from('stores')
    .insert({
      store_code: storeCode,
      store_name: `${storeCode} 매장`,
      owner_name: '사장님',
      stamp_goal: 10,
      reward_desc: '스탬프 10개 적립 시 음료 1잔 무료',
      message_signature: `${storeCode} 사장 드림`,
    })
    .select('id')
    .single();

  return created.id;
}

async function clearPreviousSeed(storeId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: seeded } = await supabase
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .like('phone', `${SEED_PHONE_PREFIX}%`);

  const ids = (seeded || []).map((row: any) => row.id);
  if (ids.length === 0) return;

  await supabase.from('visit_logs').delete().in('customer_id', ids);
  await supabase.from('customers').delete().in('id', ids);
}

async function seedStore(storeCode: string, storeIndex: number): Promise<void> {
  const supabase = getSupabase();
  const storeId = await getOrCreateStoreId(storeCode);
  await clearPreviousSeed(storeId);

  let nameIndex = 0;
  for (let stageIndex = 0; stageIndex < STAGES.length; stageIndex++) {
    const stage = STAGES[stageIndex];
    const daysAgoOptions = CHURN_STAGE_DAYS_AGO[stage];

    for (let repIndex = 0; repIndex < daysAgoOptions.length; repIndex++) {
      const globalIndex = storeIndex * 8 + stageIndex * 2 + repIndex;
      const phone = normalizePhone(`${SEED_PHONE_PREFIX}${String(globalIndex).padStart(4, '0')}`);
      const daysAgo = daysAgoOptions[repIndex];
      const lastVisitAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const name = SAMPLE_NAMES[nameIndex % SAMPLE_NAMES.length];
      const marketingConsent = repIndex === 0;
      nameIndex++;

      const { data: customer } = await supabase
        .from('customers')
        .insert({
          store_id: storeId,
          name,
          phone,
          phone_masked: maskPhone(phone),
          current_stamps: 1,
          total_stamps: 1,
          total_visits: 1,
          last_visit_at: lastVisitAt,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? lastVisitAt : null,
          created_at: lastVisitAt,
        })
        .select('id')
        .single();

      await supabase.from('visit_logs').insert({
        customer_id: customer.id,
        store_id: storeId,
        visited_at: lastVisitAt,
        stamps_earned: 1,
        source: 'kiosk',
      });

      console.log(`  [${storeCode}] ${stage} 샘플 생성: ${name} (${daysAgo}일 전 방문)`);
    }
  }
}

async function main() {
  for (let i = 0; i < STORE_CODES.length; i++) {
    const storeCode = STORE_CODES[i];
    console.log(`\n=== ${storeCode} 시딩 시작 ===`);
    await seedStore(storeCode, i);
  }
  console.log('\n시딩 완료.');
}

main();
