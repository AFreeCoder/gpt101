'use client';

import { useEffect, useRef } from 'react';

interface UpgradeChannelProps {
  embedUrl: string;
  title: string;
}

export function UpgradeChannel({ embedUrl, title }: UpgradeChannelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const setHeight = () => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const header = document.getElementById('header');
      const footer = document.querySelector('footer');
      const headerH = header?.offsetHeight || 0;
      const footerH = footer?.offsetHeight || 0;
      const available = Math.max(window.innerHeight - headerH - footerH, 0);
      iframe.style.height = `${Math.max(available, 900)}px`;
    };

    setHeight();
    window.addEventListener('resize', setHeight);
    return () => window.removeEventListener('resize', setHeight);
  }, []);

  return (
    <main className="bg-white">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title}
        className="block w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer"
        allowFullScreen
      />
    </main>
  );
}
