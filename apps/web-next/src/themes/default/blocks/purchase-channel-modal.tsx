'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

import { sendOutboundClick } from '@/shared/lib/gtag';

interface PurchaseChannel {
  id: number;
  label: string;
  url: string;
  description: string;
  color?: string;
}

interface PurchaseChannelModalProps {
  channels: PurchaseChannel[];
  isOpen: boolean;
  onClose: () => void;
}

export function PurchaseChannelModal({
  channels,
  isOpen,
  onClose,
}: PurchaseChannelModalProps) {
  const [infoChannel, setInfoChannel] = useState<PurchaseChannel | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (infoChannel) {
          setInfoChannel(null);
        } else {
          onClose();
        }
      }
    },
    [infoChannel, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleChannelClick = (channel: PurchaseChannel) => {
    if (channel.url) {
      sendOutboundClick(channel.url, channel.label || '购买渠道');
      window.open(channel.url, '_blank', 'noopener,noreferrer');
    } else {
      setInfoChannel(channel);
    }
  };

  return (
    <>
      {/* 主弹窗 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">选择充值渠道</h3>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => handleChannelClick(channel)}
                className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
              >
                <div className="font-medium text-gray-800">{channel.label}</div>
                {channel.description && (
                  <div className="mt-1 text-xs text-gray-500">
                    {channel.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 信息弹窗（无 URL 渠道） */}
      {infoChannel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setInfoChannel(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h3 className="mb-3 text-lg font-bold text-gray-800">
              {infoChannel.label}
            </h3>
            <p className="mb-4 text-gray-600">{infoChannel.description}</p>
            <button
              onClick={() => setInfoChannel(null)}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
}
