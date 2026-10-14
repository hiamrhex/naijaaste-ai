import { useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

const getRecognizer = () => {
  const SR = typeof globalThis !== 'undefined'
    && (globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);
  return SR || null;
};

export function VoiceButton({ onTranscript, onError }) {
  const [state, setState] = useState('idle'); // idle|listening|unsupported
  const recRef = useRef(null);

  const supported = getRecognizer() !== null;

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    recRef.current = null;
    setState('idle');
  };

  const start = () => {
    const SR = getRecognizer();
    if (!SR) {
      setState('unsupported');
      onError?.('voice-unsupported');
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'en-NG';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = e.results?.[0]?.[0]?.transcript || '';
        stop();
        if (text.trim()) onTranscript(text.trim());
        else onError?.('voice-empty');
      };
      rec.onerror = () => {
        stop();
        onError?.('voice-failed');
      };
      rec.onend = () => setState((s) => (s === 'listening' ? 'idle' : s));
      recRef.current = rec;
      rec.start();
      setState('listening');
    } catch {
      setState('idle');
      onError?.('voice-failed');
    }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => (state === 'listening' ? stop() : start())}
      title={state === 'listening' ? 'Stop listening' : 'Speak instead of typing'}
      aria-label={state === 'listening' ? 'Stop listening' : 'Speak instead of typing'}
      aria-pressed={state === 'listening'}
      style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: state === 'listening' ? 'rgba(239,68,68,0.12)' : 'var(--bg-card-hover)',
        border: state === 'listening' ? '1px solid rgba(239,68,68,0.4)' : '1px solid transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {state === 'listening'
        ? <MicOff size={15} color="#F87171" />
        : <Mic size={15} color="var(--text-hint)" />}
    </button>
  );
}
