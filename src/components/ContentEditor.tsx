import React, { useState } from 'react';
import { Sparkles, Copy, Save, RefreshCw, Check, Instagram, Globe, MessageSquareCode } from 'lucide-react';
import { ContentDraft } from '../lib/mock';

interface ContentEditorProps {
  onGenerate: (params: {
    purpose: string;
    details: string;
    benefit: string;
    duration: string;
    tone: string;
    emphasis: string;
  }) => Promise<void>;
  onSaveDraft: (channel: 'instagram' | 'naver' | 'kakao', content: string, hashtags: string) => Promise<void>;
  savedDrafts: ContentDraft[];
  generatedPost: {
    instagram_post: string;
    naver_post: string;
    kakao_post: string;
    hashtags: string;
  } | null;
  isGenerating: boolean;
}

export default function ContentEditor({ onGenerate, onSaveDraft, savedDrafts, generatedPost, isGenerating }: ContentEditorProps) {
  // Form states
  const [purpose, setPurpose] = useState('신메뉴 소개');
  const [details, setDetails] = useState('');
  const [benefit, setBenefit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tone, setTone] = useState('친근하게');
  const [emphasis, setEmphasis] = useState('');

  // Channel Tabs
  const [activeTab, setActiveTab] = useState<'instagram' | 'naver' | 'kakao'>('instagram');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<boolean>(false);

  // Form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      purpose,
      details,
      benefit,
      duration: startDate && endDate ? `${startDate} ~ ${endDate}` : '제한 없음',
      tone,
      emphasis,
    });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = async () => {
    if (!generatedPost) return;
    const content = activeTab === 'instagram' ? generatedPost.instagram_post : activeTab === 'naver' ? generatedPost.naver_post : generatedPost.kakao_post;
    await onSaveDraft(activeTab, content, generatedPost.hashtags);
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 2000);
  };

  const getChannelContent = () => {
    if (!generatedPost) return '';
    if (activeTab === 'instagram') return generatedPost.instagram_post;
    if (activeTab === 'naver') return generatedPost.naver_post;
    if (activeTab === 'kakao') return generatedPost.kakao_post;
    return '';
  };

  const channelText = getChannelContent();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* 1. Left Input Form (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-border-soft p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-border-soft pb-3">
          <Sparkles className="w-4.5 h-4.5 text-yellow animate-pulse" />
          <h3 className="font-bold text-navy text-body-sm tracking-tight">SNS 마케팅 콘텐츠 기획</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">홍보 목적</label>
            <div className="grid grid-cols-2 gap-2">
              {['재방문 유도', '신메뉴 소개', '이벤트', '기타'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={`py-2 px-3 text-caption font-bold rounded-md border text-center transition-all duration-200 cursor-pointer ${
                    purpose === p
                      ? 'bg-surface border-orange text-navy'
                      : 'bg-white border-border text-muted hover:bg-surface hover:text-navy'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">상세 내용 및 소개</label>
            <textarea
              required
              rows={4}
              placeholder="예: 프랑스 고메 버터를 가득 넣어 구운 정통 소금빵이 새롭게 입고되었습니다. 겉은 바삭하고 속은 극상의 버터동굴이 있어 쫄깃합니다."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full text-caption px-3.5 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-surface transition-all placeholder:text-muted-soft font-medium leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">제공 혜택</label>
            <input
              type="text"
              placeholder="예: 포장 주문 시 10% 할인 또는 스탬프 2배 적립"
              value={benefit}
              onChange={(e) => setBenefit(e.target.value)}
              className="w-full text-caption px-3.5 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-surface transition-all placeholder:text-muted-soft font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-caption px-3 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-surface font-medium"
              />
            </div>
            <div>
              <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-caption px-3 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-surface font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">원하는 말투</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full text-caption px-3.5 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-white font-bold text-navy cursor-pointer"
            >
              <option value="친근하게">친근하게 (이모티콘 사용, 따뜻한 어조)</option>
              <option value="공식적으로">공식적으로 (안내문구, 깔끔하고 정중함)</option>
              <option value="감성적으로">감성적으로 (감성 에세이풍, 분위기 강조)</option>
            </select>
          </div>

          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">특히 강조할 포인트</label>
            <input
              type="text"
              placeholder="예: 당일 생산 및 당일 판매 원칙 고수"
              value={emphasis}
              onChange={(e) => setEmphasis(e.target.value)}
              className="w-full text-caption px-3.5 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-surface transition-all placeholder:text-muted-soft font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-3 px-4 bg-orange hover:bg-orange/90 disabled:bg-border-strong text-white rounded-md text-caption font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                AI 포스팅 생성 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI 포스팅 초안 만들기
              </>
            )}
          </button>
        </form>
      </div>

      {/* 2. Right Generation Results (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="bg-white rounded-xl border border-border-soft overflow-hidden flex flex-col min-h-[440px]">
          {/* Header Channels Tabs */}
          <div className="flex border-b border-border-soft bg-surface">
            <button
              onClick={() => setActiveTab('instagram')}
              className={`flex-1 py-4 text-center text-caption font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'instagram'
                  ? 'border-orange text-navy bg-white font-extrabold'
                  : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <Instagram className="w-4 h-4 text-yellow" /> 인스타그램
            </button>
            <button
              onClick={() => setActiveTab('naver')}
              className={`flex-1 py-4 text-center text-caption font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'naver'
                  ? 'border-orange text-navy bg-white font-extrabold'
                  : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <Globe className="w-4 h-4 text-yellow" /> 네이버 소식
            </button>
            <button
              onClick={() => setActiveTab('kakao')}
              className={`flex-1 py-4 text-center text-caption font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'kakao'
                  ? 'border-orange text-navy bg-white font-extrabold'
                  : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <MessageSquareCode className="w-4 h-4 text-yellow" /> 카카오 알림
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="flex-1 p-6 flex flex-col justify-between">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-10 h-10 rounded-full border-3 border-border border-t-orange animate-spin" />
                <p className="text-navy font-bold text-body-sm">홍보 목적에 맞는 최적의 본문을 작성하고 있습니다.</p>
                <p className="text-muted text-caption">매장 가독성이 높고 매력적인 혜택 위주로 AI가 가공하는 중입니다.</p>
              </div>
            ) : generatedPost ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center text-micro font-bold text-muted">
                    <span>추천 레이아웃 및 혜택 적용 완료</span>
                    <span>글자 수: <strong className="font-bold text-navy font-mono text-caption">{channelText.length}</strong>자</span>
                  </div>

                  {/* Generated Box */}
                  <div className="mt-3 bg-surface rounded-md p-4 text-caption text-navy leading-relaxed font-medium whitespace-pre-wrap border border-border-soft max-h-[250px] overflow-y-auto">
                    {channelText}
                  </div>

                  {/* Hashtags display */}
                  {generatedPost.hashtags && (
                    <div className="mt-4 p-3.5 bg-surface rounded-md border border-border-soft">
                      <p className="text-[9px] font-bold text-orange uppercase tracking-wide">제안 해시태그</p>
                      <p className="text-caption font-mono text-navy mt-1 leading-snug">{generatedPost.hashtags}</p>
                    </div>
                  )}
                </div>

                {/* Content Actions */}
                <div className="flex justify-end gap-2.5 pt-4 border-t border-border-soft">
                  <button
                    onClick={() => handleSave()}
                    className="px-4 py-2.5 text-caption font-bold rounded-md text-navy hover:bg-surface bg-white border border-border transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {savedStatus ? <Check className="w-3.5 h-3.5 text-yellow" /> : <Save className="w-3.5 h-3.5" />}
                    {savedStatus ? '저장됨' : '임시저장'}
                  </button>
                  <button
                    onClick={() => handleCopy(channelText + '\n\n' + generatedPost.hashtags, 'gen')}
                    className="px-4 py-2.5 text-caption font-bold rounded-md text-white bg-orange hover:bg-orange/90 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === 'gen' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === 'gen' ? '복사 완료' : '전체 복사'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center text-yellow mb-4">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <p className="text-navy font-bold text-body-sm">왼쪽의 기획 내용을 채우고 버튼을 누르세요.</p>
                <p className="text-muted text-caption mt-1 leading-normal">인스타그램, 네이버 소식글이 매장의 이력을 바탕으로 동시 기획됩니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Saved Drafts History List */}
        <div className="bg-white rounded-xl border border-border-soft p-6 space-y-4">
          <h4 className="font-bold text-navy text-caption tracking-tight">저장된 기획 초안 이력 ({savedDrafts.length})</h4>
          {savedDrafts.length === 0 ? (
            <p className="text-muted text-caption text-center py-8">임시저장된 홍보 글이 아직 없습니다.</p>
          ) : (
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {savedDrafts.map((draft) => (
                <div key={draft.id} className="p-3.5 bg-surface hover:bg-border-soft rounded-md border border-border-soft transition-all flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white text-navy border border-border-soft">
                        {draft.channel === 'instagram' ? '인스타그램' : draft.channel === 'naver' ? '네이버' : '카카오'}
                      </span>
                      <span className="text-[9px] text-muted font-mono font-bold">
                        {new Date(draft.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-caption text-navy line-clamp-2 leading-relaxed whitespace-pre-wrap font-medium">
                      {draft.content}
                    </p>
                    {draft.hashtags && <p className="text-micro font-mono font-bold text-orange truncate">{draft.hashtags}</p>}
                  </div>
                  <button
                    onClick={() => handleCopy(draft.content + '\n' + draft.hashtags, draft.id)}
                    className="p-2 text-muted hover:text-navy bg-white border border-border rounded-md transition-all shrink-0 cursor-pointer"
                    title="초안 복사"
                  >
                    {copiedId === draft.id ? <Check className="w-3.5 h-3.5 text-yellow" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
