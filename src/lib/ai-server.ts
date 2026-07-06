import { buildMessagePrompt, buildPostPrompt, buildNearCompletionMessagePrompt } from './prompts';
import { parseJson } from './openrouter';

// Lazy initialize the Gemini SDK via dynamic import to avoid module-load crash
let aiClient: any | null = null;

async function getGeminiClient(): Promise<any | null> {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY') {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        aiClient = new GoogleGenAI({ apiKey: key });
      } catch (e) {
        console.error('Failed to initialize GoogleGenAI client', e);
      }
    }
  }
  return aiClient;
}

// Fallback high-quality template generators when APIs are not configured
// 감정 호소(서운함/그리움/걱정) 대신 담백한 인사 + 명확한 혜택/명분 중심으로 작성한다 (2026-07-03 톤 리비전).
function getFallbackMessage(customerName: string | null, churnStage: string, rewardDesc: string, storeName: string, signature: string): string {
  const greeting = customerName ? `${customerName} 고객님` : '고객님';
  const intro = `${greeting}, 안녕하세요.\n${storeName}입니다.\n\n`;

  if (churnStage === 'danger') {
    return `${intro}그동안 ${storeName}를 찾아주셔서 감사드립니다.
고객님께 다시 기분 좋은 시간을 전해드리고자 재방문 혜택을 준비했습니다.

* 매장 혜택 리워드: ${rewardDesc}
* 추가 혜택: 이번 주 방문 시 시그니처 아메리카노 또는 소금빵 1개 무료 제공

따뜻하게 구운 빵과 신선한 커피를 준비해두겠습니다.
근처에 오실 때 편하게 들러주세요.

${signature}`;
  } else if (churnStage === 'watch') {
    return `${intro}지난번 방문해주셔서 감사드립니다.
고객님께 더 기분 좋은 방문이 될 수 있도록 이번 주 재방문 혜택을 준비했습니다.

* 매장 혜택 리워드: ${rewardDesc}
* 추가 혜택: 이번 주 방문 시 스탬프 2배 적립

따뜻하게 구운 빵과 커피를 준비해두겠습니다.
근처에 오실 때 편하게 들러주세요.

${signature}`;
  } else if (churnStage === 'safe') {
    return `${intro}지난번 ${storeName}를 찾아주셔서 진심으로 감사드립니다.
고객님께 반가운 소식을 전해드리고 싶어 연락드렸습니다.
고객님께 감사한 마음을 담아 재방문 혜택을 준비했습니다.

* 매장 혜택 리워드: ${rewardDesc}

따끈하게 구운 빵과 깊은 풍미의 커피가 준비되어 있으니, 근처에 오실 때 편하게 들러주세요.
언제든 반갑게 맞이하겠습니다.

${signature}`;
  } else {
    return `${intro}오랜만에 방문하셔도 부담 없이 이용하실 수 있도록 재방문 감사 혜택을 준비했습니다.

* ${rewardDesc}
* 이번 주 방문 시 대표 빵 1개 추가 증정

근처에 오실 때 편하게 들러주세요.

${signature}`;
  }
}

// 법정 표기(광고 태그, 무료수신거부)는 AI/폴백 생성 결과에 맡기지 않고 항상 코드에서 고정으로 부착한다.
// 무료수신거부 번호는 현재 매장별 설정값이 없어 하드코딩된 플레이스홀더를 사용한다.
function wrapWithComplianceNotice(storeName: string, body: string): string {
  return `(광고) ${storeName}\n${body}\n\n무료수신거부: 080-000-0000`;
}

function getFallbackPost(purpose: string, details: string, benefit: string, duration: string, tone: string, emphasis: string, storeName: string) {
  return {
    instagram_post: `🍞 ${storeName}에서 전하는 특별한 소식! 🥐✨\n\n여러분을 위한 엄청난 행복 정보가 찾아왔습니다! 🧡\n\n👉 이번 홍보 테마: [${purpose}]\n\n${details || '매장에서 정성스레 준비한 스페셜 빵과 향긋한 에스프레소!'}\n\n🎁 이번 캠페인의 초특급 혜택:\n🔥 ${benefit || '선택 품목 10% 추가 할인 또는 적립금 2배!'}\n\n⏰ 기간: ${duration}\n📢 강조: ${emphasis || '당일 반죽 및 당일 소진 원칙 고수!'}\n\n따뜻한 분위기 가득한 저희 매장에 오셔서 기분 좋은 여유를 느껴보세요. 언제나 행복한 하루 되세요! ☕️`,
    naver_post: `[${storeName} 소식] 안녕하세요, ${storeName} 사장입니다.\n\n저희 매장을 아껴주시는 단골 고객분들을 위한 특별한 혜택 및 소식을 안내해 드립니다.\n\n이번 소식 주제: ${purpose}\n\n상세 설명:\n${details || '매일 아침 엄선된 프랑스산 최고급 고메 버터와 천일염으로 구워내는 정성 가득 소금빵의 깊고 부드러운 맛을 즐겨보세요.'}\n\n- 특별 제공 혜택: ${benefit || '포장 주문 시 10% 추가 혜택 적용'}\n- 진행 기간: ${duration}\n- 매장 강조점: ${emphasis || '철저한 위생 관리 및 신선한 당일 맥주 원칙!'}\n\n네이버 예약을 통해 사전 단체 주문도 가능하니 편하게 활용해 보시기 바랍니다. 감사합니다.`,
    kakao_post: `[${storeName} 카카오 채널 안내]\n\n항상 저희 매장을 방문해 주셔서 진심으로 감사드립니다.\n카카오 채널 단독 특별 할인/적립 캠페인 소식을 전달해 드립니다!\n\n💬 목적: ${purpose}\n\n${details || '정성을 듬뿍 넣은 빵들과 향긋한 음료들로 가득한 하루를 선물합니다.'}\n\n🎁 카카오채널 친구 대상 혜택:\n👉 ${benefit || '매장 카운터에 채널 화면 제시 시 빵 메뉴 10% 즉시 할인'}\n\n📆 행사 기간: ${duration}\n⚡️ 중요 안내: ${emphasis || '한정 수량 조진 시 행사가 조기 마감될 수 있습니다.'}\n\n아래의 버튼을 누르거나 매장 카운터에 인증하셔서 혜택을 놓치지 마세요!`,
    hashtags: `#${storeName.replace(/\s+/g, '')} #${purpose.replace(/\s+/g, '')} #베이커리카페 #소금빵맛집 #디저트맛집 #감성카페 #동네소금빵 #빵지순례`
  };
}

export async function generateAIMessage(
  customerName: string | null,
  churnStage: string,
  rewardDesc: string,
  storeName: string,
  signature: string,
  totalVisits: number,
  daysSinceLastVisit: number | null,
  currentStamps: number,
  stampGoal: number,
): Promise<string> {
  const prompt = buildMessagePrompt(
    customerName, churnStage, rewardDesc, storeName, signature,
    totalVisits, daysSinceLastVisit, currentStamps, stampGoal,
  );

  let body: string | null = null;

  // 1. Try OpenRouter if key is available
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'MY_OPENROUTER_API_KEY') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) body = text.trim();
      }
    } catch (e) {
      console.error('OpenRouter generation failed, trying Gemini', e);
    }
  }

  // 2. Try native Gemini client
  if (!body) {
    const gemini = await getGeminiClient();
    if (gemini) {
      try {
        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        if (response && response.text) {
          body = response.text.trim();
        }
      } catch (e) {
        console.error('Gemini generation failed, falling back to templates', e);
      }
    }
  }

  // 3. Fallback to templates
  if (!body) {
    body = getFallbackMessage(customerName, churnStage, rewardDesc, storeName, signature);
  }

  return wrapWithComplianceNotice(storeName, body);
}

function getNearCompletionFallbackMessage(customerName: string | null, currentStamps: number, stampGoal: number, rewardDesc: string, storeName: string, signature: string): string {
  const greeting = customerName ? `${customerName} 고객님` : '고객님';
  const remaining = Math.max(stampGoal - currentStamps, 0);

  return `${greeting}, 안녕하세요.
${storeName}입니다.

스탬프 ${currentStamps}/${stampGoal}개를 모아주셔서 리워드까지 단 ${remaining}개 남았습니다!
${rewardDesc}

다음 방문 시 스탬프를 적립하시면 리워드에 한 걸음 더 가까워집니다.
곧 뵙기를 기대하겠습니다.

${signature}`;
}

export async function generateNearCompletionMessage(
  customerName: string | null,
  currentStamps: number,
  stampGoal: number,
  rewardDesc: string,
  storeName: string,
  signature: string,
): Promise<string> {
  const prompt = buildNearCompletionMessagePrompt(
    customerName, currentStamps, stampGoal, rewardDesc, storeName, signature,
  );

  let body: string | null = null;

  // 1. Try OpenRouter if key is available
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'MY_OPENROUTER_API_KEY') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) body = text.trim();
      }
    } catch (e) {
      console.error('OpenRouter near-completion generation failed, trying Gemini', e);
    }
  }

  // 2. Try native Gemini client
  if (!body) {
    const gemini = await getGeminiClient();
    if (gemini) {
      try {
        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        if (response && response.text) {
          body = response.text.trim();
        }
      } catch (e) {
        console.error('Gemini near-completion generation failed, falling back to templates', e);
      }
    }
  }

  // 3. Fallback to templates
  if (!body) {
    body = getNearCompletionFallbackMessage(customerName, currentStamps, stampGoal, rewardDesc, storeName, signature);
  }

  return wrapWithComplianceNotice(storeName, body);
}

export async function generateAIPost(
  purpose: string,
  details: string,
  benefit: string,
  duration: string,
  tone: string,
  emphasis: string,
  storeName: string
): Promise<any> {
  const prompt = buildPostPrompt(purpose, details, benefit, duration, tone, emphasis, storeName);

  // Helper to process JSON response
  const processJson = (rawText: string) => {
    try {
      const parsed = parseJson<any>(rawText);
      if (parsed && parsed.instagram_post && parsed.naver_post) {
        // Ensure kakao_post exists
        if (!parsed.kakao_post) {
          parsed.kakao_post = `[${storeName} 소식]\n\n${parsed.instagram_post}\n\n🎁 특별 혜택: ${benefit || '단독 제공'}\n⏰ 기간: ${duration}`;
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse AI JSON response, applying raw extraction', e);
    }
    return null;
  };

  // 1. Try OpenRouter
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'MY_OPENROUTER_API_KEY') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const result = processJson(text);
          if (result) return result;
        }
      }
    } catch (e) {
      console.error('OpenRouter post generation failed, trying Gemini', e);
    }
  }

  // 2. Try native Gemini client
  const gemini = await getGeminiClient();
  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      if (response && response.text) {
        const result = processJson(response.text);
        if (result) return result;
      }
    } catch (e) {
      console.error('Gemini post generation failed, falling back to templates', e);
    }
  }

  // 3. Fallback
  return getFallbackPost(purpose, details, benefit, duration, tone, emphasis, storeName);
}
