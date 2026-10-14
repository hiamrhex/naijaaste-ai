import { X, Share, Download } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { useLanguage } from '../app/useLanguage.js';

export function InstallSheet() {
  const { visible, ios, install, dismiss } = useInstallPrompt();
  const { t } = useLanguage();
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('installTitle')}
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 500,
        padding: '0 16px calc(16px + env(safe-area-inset-bottom))',
      }}
    >
      <div
        className="fade-in"
        style={{
          maxWidth: 520, margin: '0 auto', background: 'var(--bg-card)',
          border: '1px solid rgba(249,115,22,0.4)', borderRadius: 16,
          padding: '18px 18px 16px', boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #F97316, #FB923C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: '#fff',
          }}>
            N
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>
              {t('installTitle')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.55 }}>
              {ios ? t('iosGuide') : t('installBody')}
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            style={{
              background: 'none', border: 'none', color: 'var(--text-hint)',
              cursor: 'pointer', padding: 8, minWidth: 40, minHeight: 40, display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>
        {!ios && (
          <button
            onClick={install}
            style={{
              width: '100%', marginTop: 14, background: 'linear-gradient(120deg, #F97316, #FB923C)',
              border: 'none', borderRadius: 11, padding: '13px 14px', fontSize: 14, fontWeight: 700,
              color: '#fff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48,
            }}
          >
            {t('installCta') === 'Install app' ? <Download size={15} /> : <Share size={15} />}
            {t('installCta')}
          </button>
        )}
        <button
          onClick={dismiss}
          style={{
            width: '100%', marginTop: 8, background: 'none', border: 'none',
            color: 'var(--text-hint)', fontSize: 12.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', padding: 8, minHeight: 40,
          }}
        >
          {t('installLater')}
        </button>
      </div>
    </div>
  );
}
