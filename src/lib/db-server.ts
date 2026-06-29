import fs from 'fs';
import path from 'path';
import { Store, Customer, VisitLog, Message, ChurnStage, GeneratedPost } from '../types';
import { calcChurn } from './churn';
import { maskPhone } from './phone';

const DB_FILE = path.join(process.cwd(), 'src/db.json');

interface DatabaseSchema {
  stores: Record<string, Store>;
  customers: Record<string, Customer[]>;
  visit_logs: Record<string, VisitLog[]>;
  messages: Record<string, Message[]>;
  content_drafts: Record<string, any[]>;
}

const DEFAULT_STORES: Record<string, Store> = {
  demo: {
    store_code: 'demo',
    store_name: '리봇 베이커리',
    owner_name: '김리봇',
    stamp_goal: 10,
    reward_desc: '스탬프 10개 적립 시 아메리카노 또는 클래식 소금빵 1개 무료 제공',
    brand_color: '#d97706',
    logo_url: null,
    message_signature: '리봇 베이커리 사장 드림',
  },
};

const DEFAULT_CUSTOMERS: Record<string, Customer[]> = {
  demo: [
    {
      id: 'cust_1',
      name: '김도우',
      phone: '01012345678',
      phone_masked: '010-****-5678',
      churn_stage: 'danger',
      last_visit_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      total_visits: 3,
      total_stamps: 3,
      marketing_consent: true,
      marketing_consent_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cust_2',
      name: '이서윤',
      phone: '01056781234',
      phone_masked: '010-****-1234',
      churn_stage: 'watch',
      last_visit_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      total_visits: 8,
      total_stamps: 8,
      marketing_consent: true,
      marketing_consent_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cust_3',
      name: '박정우',
      phone: '01098765432',
      phone_masked: '010-****-5432',
      churn_stage: 'churned',
      last_visit_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
      total_visits: 12,
      total_stamps: 2,
      marketing_consent: false,
      marketing_consent_at: null,
      created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cust_4',
      name: '최진혁',
      phone: '01011112222',
      phone_masked: '010-****-2222',
      churn_stage: 'safe',
      last_visit_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      total_visits: 22,
      total_stamps: 2,
      marketing_consent: true,
      marketing_consent_at: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cust_5',
      name: '정하은',
      phone: '01033334444',
      phone_masked: '010-****-4444',
      churn_stage: 'safe',
      last_visit_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      total_visits: 5,
      total_stamps: 5,
      marketing_consent: true,
      marketing_consent_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

const DEFAULT_MESSAGES: Record<string, Message[]> = {
  demo: [
    {
      id: 'msg_1',
      customer_id: 'cust_1',
      customer_name: '김도우',
      phone_masked: '010-****-5678',
      churn_stage: 'danger',
      content: '[리봇 베이커리] 김도우 고객님, 한동안 매장에서 뵙지 못해 아쉬운 마음입니다. 오랜만에 방문해주시면 갓 구운 소금빵 1개 서비스 쿠폰을 드릴게요! 시그니처 아메리카노와 함께 즐겨보세요. 매장에서 기다리겠습니다. 감사합니다.',
      status: 'draft',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      sent_at: null,
      last_sent_within_30d: false,
      marketing_consent: true,
    },
    {
      id: 'msg_2',
      customer_id: 'cust_2',
      customer_name: '이서윤',
      phone_masked: '010-****-1234',
      churn_stage: 'watch',
      content: '[리봇 베이커리] 이서윤 고객님, 늘 저희 매장을 찾아주셔서 감사합니다. 최근 발걸음이 뜸하셔서 안부가 궁금하네요. 금주 방문하시면 스탬프 2배 적립 혜택을 드려요! 편하신 시간에 들러주세요.',
      status: 'draft',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      sent_at: null,
      last_sent_within_30d: true,
      marketing_consent: true,
    },
    {
      id: 'msg_3',
      customer_id: 'cust_3',
      customer_name: '박정우',
      phone_masked: '010-****-5432',
      churn_stage: 'churned',
      content: '[리봇 베이커리] 박정우 고객님, 오랜만에 인사드립니다. 늘 아껴주시는 마음에 감사하며 특별 리워드 쿠폰(음료 1잔 무료)을 준비했습니다. 따뜻한 빵 냄새 가득한 리봇에서 힐링하고 가세요.',
      status: 'sent',
      created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      sent_at: new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString(),
      last_sent_within_30d: false,
      marketing_consent: false,
    },
  ],
};

const DEFAULT_CONTENT_DRAFTS: Record<string, any[]> = {
  demo: [
    {
      id: 'draft_1',
      channel: 'instagram',
      content: '🍞 리봇 베이커리 소금빵 입고 완료! 🥐\n\n많은 분들이 기다려주신 리봇의 시그니처 프랑스 고메버터 소금빵이 갓 구워져 나왔습니다. 겉은 바삭하고 속은 쫄깃하면서, 씹을수록 퍼지는 짭조름하고 고소한 풍미! 한 입 드셔보시면 멈출 수 없을 거예요.\n\n매일 한정 수량으로 구워지니, 늦기 전에 리봇 베이커리로 서둘러 방문해 보세요! ✨',
      hashtags: '#소금빵맛집 #베이커리카페 #성수동맛집 #빵지순례 #버터풍미 #갓구운빵',
      status: 'saved',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'draft_2',
      channel: 'naver',
      content: '[알림] 프랑스 전통 고메버터를 듬뿍 사용한 리봇 베이커리의 소금빵이 새롭게 출시되었습니다.\n\n매일 아침 매장에서 신선하게 반죽하고 굽는 과정을 거쳐 제공됩니다. 짭조름한 천일염과 부드러운 버터의 환상적인 콜라보레이션을 즐겨보세요.\n\n포장 주문 시 10% 할인 혜택도 제공되오니 네이버 주문을 통해 편하게 만나보세요.',
      hashtags: '#소금빵출시 #단체주문환영 #네이버주문 #베이커리카페',
      status: 'saved',
      created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

let dbCache: DatabaseSchema | null = null;

export function loadDB(): DatabaseSchema {
  if (dbCache) return dbCache;

  // Make sure directory exists
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(content) as DatabaseSchema;
      // Ensure all fields exist
      dbCache.stores = dbCache.stores || {};
      dbCache.customers = dbCache.customers || {};
      dbCache.visit_logs = dbCache.visit_logs || {};
      dbCache.messages = dbCache.messages || {};
      dbCache.content_drafts = dbCache.content_drafts || {};
    } catch (e) {
      console.error('Failed to parse db file, starting fresh', e);
    }
  }

  if (!dbCache) {
    dbCache = {
      stores: { ...DEFAULT_STORES },
      customers: { ...DEFAULT_CUSTOMERS },
      visit_logs: {},
      messages: { ...DEFAULT_MESSAGES },
      content_drafts: { ...DEFAULT_CONTENT_DRAFTS },
    };
    saveDB();
  }

  return dbCache;
}

export function saveDB() {
  if (!dbCache) return;
  fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
}

// Store CRUD
export function getStore(storeCode: string): Store {
  const db = loadDB();
  if (!db.stores[storeCode]) {
    // Auto-create store if it doesn't exist
    db.stores[storeCode] = {
      store_code: storeCode,
      store_name: `${storeCode} 매장`,
      owner_name: '사장님',
      stamp_goal: 10,
      reward_desc: '스탬프 10개 적립 시 아메리카노 1잔 무료',
      brand_color: '#d97706',
      logo_url: null,
      message_signature: `${storeCode} 사장 드림`,
    };
    saveDB();
  }
  return db.stores[storeCode];
}

export function updateStore(storeCode: string, settings: Partial<Store>): Store {
  const db = loadDB();
  const current = getStore(storeCode);
  db.stores[storeCode] = { ...current, ...settings };
  saveDB();
  return db.stores[storeCode];
}

// Customer CRUD
export function getCustomers(storeCode: string, filter: string = 'all'): Customer[] {
  const db = loadDB();
  const list = db.customers[storeCode] || [];
  
  // Recalculate churn stage based on last_visit_at
  const updatedList = list.map(c => {
    if (c.last_visit_at) {
      c.churn_stage = calcChurn([c.last_visit_at]);
    } else {
      c.churn_stage = 'churned';
    }
    return c;
  });

  db.customers[storeCode] = updatedList;
  saveDB();

  if (filter === 'all') return updatedList;
  if (filter === 'watch') return updatedList.filter(c => c.churn_stage === 'watch');
  if (filter === 'danger') return updatedList.filter(c => c.churn_stage === 'danger');
  if (filter === 'churned') return updatedList.filter(c => c.churn_stage === 'churned');
  return updatedList;
}

export function getCustomerById(storeCode: string, id: string): { customer: Customer; stats: any; visit_logs: VisitLog[]; messages: Message[] } | null {
  const customers = getCustomers(storeCode);
  const customer = customers.find(c => c.id === id);
  if (!customer) return null;

  const db = loadDB();
  const visitLogs = (db.visit_logs[customer.id] || []).sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );
  const messages = (db.messages[storeCode] || []).filter(m => m.customer_id === id).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return {
    customer,
    stats: {
      total_visits: customer.total_visits,
      total_stamps: customer.total_stamps,
      last_visit_at: customer.last_visit_at,
    },
    visit_logs: visitLogs,
    messages,
  };
}

export function addStamp(storeCode: string, phone: string, count: number = 1): { customer: Customer; earned: number } {
  const db = loadDB();
  db.customers[storeCode] = db.customers[storeCode] || [];
  
  let customer = db.customers[storeCode].find(c => c.phone === phone);
  const nowStr = new Date().toISOString();

  if (!customer) {
    // Create new customer
    const id = `cust_${Date.now()}`;
    customer = {
      id,
      name: null,
      phone,
      phone_masked: maskPhone(phone),
      churn_stage: 'safe',
      last_visit_at: nowStr,
      total_visits: 1,
      total_stamps: count,
      marketing_consent: true,
      marketing_consent_at: nowStr,
      created_at: nowStr,
    };
    db.customers[storeCode].push(customer);
  } else {
    customer.last_visit_at = nowStr;
    customer.total_visits += 1;
    customer.total_stamps += count;
    
    const store = getStore(storeCode);
    if (customer.total_stamps >= store.stamp_goal) {
      // Completed! We can handle resetting or wrapping stamps here if desired
    }
  }

  // Record visit log
  db.visit_logs[customer.id] = db.visit_logs[customer.id] || [];
  db.visit_logs[customer.id].push({
    id: `log_${Date.now()}`,
    customer_id: customer.id,
    occurred_at: nowStr,
    stamps_earned: count,
  });

  saveDB();
  return { customer, earned: count };
}

export function recordManualVisit(storeCode: string, customerId: string, stamps: number = 1): Customer {
  const db = loadDB();
  const list = db.customers[storeCode] || [];
  const customer = list.find(c => c.id === customerId);
  if (!customer) throw new Error('Customer not found');

  const nowStr = new Date().toISOString();
  customer.last_visit_at = nowStr;
  customer.total_visits += 1;
  customer.total_stamps += stamps;

  db.visit_logs[customer.id] = db.visit_logs[customer.id] || [];
  db.visit_logs[customer.id].push({
    id: `log_${Date.now()}`,
    customer_id: customer.id,
    occurred_at: nowStr,
    stamps_earned: stamps,
  });

  saveDB();
  return customer;
}

// Message CRUD
export function getStoreMessages(storeCode: string): Message[] {
  const db = loadDB();
  return db.messages[storeCode] || [];
}

export function addMessageDraft(storeCode: string, customerId: string, content: string): Message {
  const db = loadDB();
  const customers = getCustomers(storeCode);
  const customer = customers.find(c => c.id === customerId);
  if (!customer) throw new Error('Customer not found');

  const messages = getStoreMessages(storeCode);
  
  // Check if any sent message to this customer within 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const lastSentWithin30d = messages.some(
    m => m.customer_id === customerId && m.status === 'sent' && m.sent_at && new Date(m.sent_at).getTime() > thirtyDaysAgo
  );

  const newMsg: Message = {
    id: `msg_${Date.now()}`,
    customer_id: customerId,
    customer_name: customer.name,
    phone_masked: customer.phone_masked,
    churn_stage: customer.churn_stage,
    content,
    status: 'draft',
    created_at: new Date().toISOString(),
    sent_at: null,
    last_sent_within_30d: lastSentWithin30d,
    marketing_consent: customer.marketing_consent,
  };

  db.messages[storeCode] = db.messages[storeCode] || [];
  db.messages[storeCode].unshift(newMsg);
  saveDB();
  return newMsg;
}

export function patchMessage(storeCode: string, id: string, updates: Partial<Message>): Message {
  const db = loadDB();
  const list = db.messages[storeCode] || [];
  const msgIdx = list.findIndex(m => m.id === id);
  if (msgIdx === -1) throw new Error('Message not found');

  list[msgIdx] = { ...list[msgIdx], ...updates };
  saveDB();
  return list[msgIdx];
}

export function deleteMessage(storeCode: string, id: string): void {
  const db = loadDB();
  const list = db.messages[storeCode] || [];
  db.messages[storeCode] = list.filter(m => m.id !== id);
  saveDB();
}

// Content drafts
export function getSavedContentDrafts(storeCode: string): any[] {
  const db = loadDB();
  return db.content_drafts[storeCode] || [];
}

export function saveContentDraft(storeCode: string, channel: string, content: string, hashtags: string): any {
  const db = loadDB();
  db.content_drafts[storeCode] = db.content_drafts[storeCode] || [];
  
  const draft = {
    id: `draft_${Date.now()}`,
    channel,
    content,
    hashtags,
    status: 'saved',
    created_at: new Date().toISOString(),
  };

  db.content_drafts[storeCode].unshift(draft);
  saveDB();
  return draft;
}
