import React, { useState } from 'react';
import { Message, ChurnStage } from '../types';
import { CHURN_COLOR, CHURN_LABEL } from '../lib/churn';
import { MessageSquare, Send, Trash2, Edit3, Calendar, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  onSend: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (msg: Message) => void;
  onRegenerate: (id: string) => void;
}

export default function MessageList({ messages, onSend, onDelete, onEdit, onRegenerate }: MessageListProps) {
  const [activeTab, setActiveTab] = useState<'draft' | 'sent'>('draft');

  const filteredMessages = messages.filter((msg) => msg.status === activeTab);

  return (
    <div className="bg-white rounded-xl border border-border-soft overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border-soft bg-surface">
        <button
          onClick={() => setActiveTab('draft')}
          className={`flex-1 py-4 text-center text-body-sm font-semibold border-b-2 transition-all ${
            activeTab === 'draft'
              ? 'border-orange text-navy'
              : 'border-transparent text-muted hover:text-navy'
          }`}
        >
          발송 대기 초안 ({messages.filter((m) => m.status === 'draft').length})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 py-4 text-center text-body-sm font-semibold border-b-2 transition-all ${
            activeTab === 'sent'
              ? 'border-orange text-navy'
              : 'border-transparent text-muted hover:text-navy'
          }`}
        >
          발송 완료 내역 ({messages.filter((m) => m.status === 'sent').length})
        </button>
      </div>

      {/* Message Items List */}
      <div className="divide-y divide-border-soft p-2">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare className="w-12 h-12 text-yellow mb-3" />
            <p className="text-navy font-medium">
              {activeTab === 'draft' ? '발송 대기 중인 초안이 없습니다.' : '발송 완료된 메시지 내역이 없습니다.'}
            </p>
            <p className="text-muted text-caption mt-1">
              {activeTab === 'draft' ? '새 초안 생성 패널에서 AI 초안을 생성해 보세요.' : '대기 중인 초안의 [발송] 버튼을 누르면 발송이 완료됩니다.'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            return (
              <div key={msg.id} className="p-4 sm:p-5 space-y-4 hover:bg-surface rounded-lg transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-navy">{msg.customer_name || '미등록'}</span>
                    <span className="text-caption text-muted font-mono">{msg.phone_masked}</span>
                    <span className={`px-2 py-0.5 rounded text-micro font-semibold ${CHURN_COLOR[msg.churn_stage]}`}>
                      {CHURN_LABEL[msg.churn_stage]}
                    </span>
                    {msg.message_type === 'near_completion' && (
                      <span className="px-2 py-0.5 rounded text-micro font-semibold bg-yellow text-navy">
                        🎁 완주 임박
                      </span>
                    )}
                    {!msg.marketing_consent && (
                      <span className="px-1.5 py-0.5 rounded text-micro font-medium bg-surface text-muted border border-border-soft">
                        마케팅 미동의
                      </span>
                    )}
                  </div>

                  {/* Date Badge */}
                  <div className="flex items-center gap-1.5 text-caption text-muted">
                    <Calendar className="w-3.5 h-3.5 text-yellow" />
                    <span>
                      {msg.status === 'sent' && msg.sent_at
                        ? `${new Date(msg.sent_at).toLocaleDateString('ko-KR')} 발송`
                        : `${new Date(msg.created_at).toLocaleDateString('ko-KR')} 생성`}
                    </span>
                  </div>
                </div>

                {/* 30-Day Warning Banner */}
                {msg.status === 'draft' && msg.last_sent_within_30d && (
                  <div className="flex items-start gap-2 bg-surface rounded-lg p-3 text-caption text-navy border border-border-soft">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow" />
                    <div>
                      <strong>중복 발송 경고:</strong> 이 고객은 최근 30일 이내에 메시지를 수신한 이력이 있습니다. 잦은 발송은 피로감을 주어 마케팅 미동의 또는 수신 거부로 이어질 수 있으니 신중히 결정해 주세요.
                    </div>
                  </div>
                )}

                {/* Content Box */}
                <div className="bg-surface rounded-lg p-4 text-body-sm text-navy font-normal leading-relaxed whitespace-pre-wrap border border-border-soft">
                  {msg.content}
                </div>

                {/* Actions */}
                {msg.status === 'draft' && (
                  <div className="flex justify-end gap-2.5 pt-1">
                    <button
                      onClick={() => onDelete(msg.id)}
                      className="px-3.5 py-2 text-caption font-medium rounded-md text-muted hover:text-navy hover:bg-surface transition-all border border-border flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      삭제
                    </button>
                    <button
                      onClick={() => onRegenerate(msg.id)}
                      className="px-3.5 py-2 text-caption font-medium rounded-md text-muted hover:text-navy hover:bg-surface transition-all border border-border flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-yellow" />
                      재생성
                    </button>
                    <button
                      onClick={() => onEdit(msg)}
                      className="px-3.5 py-2 text-caption font-medium rounded-md text-navy hover:bg-surface bg-white border border-border transition-all flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-yellow" />
                      내용 편집
                    </button>

                    <div className="relative group">
                      <button
                        disabled={!msg.marketing_consent}
                        onClick={() => onSend(msg.id)}
                        className={`px-4 py-2 text-caption font-semibold rounded-md text-white transition-all flex items-center gap-1.5 ${
                          msg.marketing_consent
                            ? 'bg-orange hover:bg-orange/90 cursor-pointer'
                            : 'bg-border-strong cursor-not-allowed text-muted'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        메시지 발송
                      </button>
                      {!msg.marketing_consent && (
                        <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-navy text-white text-micro rounded shadow-lg z-50 text-center leading-normal">
                          마케팅 미동의 고객은 마케팅 메시지를 발송할 수 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
