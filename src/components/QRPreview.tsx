import React, { useState, useEffect } from 'react';
import { generateQRCode } from '../lib/mock';
import { Download, Link as LinkIcon, Check, Copy, QrCode } from 'lucide-react';

interface QRPreviewProps {
  storeCode: string;
}

// Stamp kiosk lives in the separate customer-facing app deployment, not this dashboard.
const CUSTOMER_APP_BASE_URL = 'https://rebot-app-customer-facing-page.vercel.app';

export default function QRPreview({ storeCode }: QRPreviewProps) {
  const [qrSrc, setQrSrc] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const stampUrl = `${CUSTOMER_APP_BASE_URL}/${storeCode}`;

  useEffect(() => {
    async function loadQR() {
      const src = await generateQRCode(stampUrl);
      setQrSrc(src);
    }
    loadQR();
  }, [stampUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(stampUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrSrc) return;
    const link = document.createElement('a');
    link.href = qrSrc;
    link.download = `rebot_stamp_qr_${storeCode}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-border-soft p-6 space-y-6 shadow-card h-full flex flex-col">
      <div className="flex items-center gap-2 border-b border-border-soft pb-3">
        <QrCode className="w-5 h-5 text-yellow" />
        <h3 className="font-semibold text-navy text-heading-3">매장 비치용 스탬프 적립 QR</h3>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* QR Code image */}
        <div className="p-3 bg-surface rounded-lg border border-border-soft shrink-0">
          {qrSrc ? (
            <img
              src={qrSrc}
              alt="Store Stamp QR Code"
              className="w-40 h-40 object-contain select-none bg-white rounded-md"
            />
          ) : (
            <div className="w-40 h-40 bg-surface animate-pulse rounded-md" />
          )}
        </div>

        {/* Info & links */}
        <div className="min-w-0 w-full space-y-4">
          <div className="space-y-1">
            <h4 className="font-bold text-navy text-body-sm">고객 셀프 적립 QR 코드</h4>
            <p className="text-caption text-muted leading-normal break-words">
              이 QR 코드를 카운터, 테이블 등에 출력하여 비치해 주세요.
              고객이 스마트폰으로 스캔하면 별도 가입 절차 없이 휴대폰 번호 입력만으로 간편하게 스탬프를 적립할 수 있습니다.
            </p>
          </div>

          {/* URL Input Copy */}
          <div className="min-w-0 space-y-1">
            <label className="block text-micro font-bold text-muted uppercase tracking-wide">고객 스탬프 적립 URL</label>
            <div className="flex min-w-0 items-center gap-2">
              <input
                type="text"
                readOnly
                value={stampUrl}
                className="min-w-0 flex-1 text-caption font-mono px-3 py-2 bg-surface text-navy border border-border rounded-md focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="p-2 bg-surface hover:bg-border-soft border border-border rounded-md text-navy transition-all shrink-0"
                title="URL 복사"
              >
                {copied ? <Check className="w-4 h-4 text-yellow" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={!qrSrc}
            className="w-full px-4 py-2.5 bg-orange hover:bg-orange/90 disabled:bg-border-strong text-white rounded-md text-caption font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="text-center">QR 코드 고해상도 이미지 다운로드 (.svg)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
