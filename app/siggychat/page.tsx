'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SIGGY_AVATAR = '/avatars/siggy.png';

export default function SiggyChat() {
  const [messages, setMessages]   = useState<Message[]>([
    {
      role: 'assistant',
      content: "So… another mortal wanders into the Forge. 😼 Tell me, visitor… are you an Initiate exploring the temple, an Ascendant seeking knowledge, or a future Ritualist ready to build something magnificent on Ritual Chain? Choose your words carefully. Impress me and I might share secrets of the multiverse…",
    },
  ]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/siggychat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || '…' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'The Forge flickered… something went wrong in the multiverse.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 30% 20%, #1a0533 0%, #0a0010 50%, #000308 100%)',
      fontFamily: "'Barlow', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0 16px 32px',
    }}>

      {/* Ambient particles */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        {[...Array(18)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            borderRadius: '50%',
            width: `${2 + (i % 4)}px`,
            height: `${2 + (i % 4)}px`,
            background: i % 3 === 0 ? '#8840FF' : i % 3 === 1 ? '#40FFAF' : '#E554E8',
            left: `${(i * 37 + 11) % 100}%`,
            top: `${(i * 53 + 7) % 100}%`,
            opacity: 0.25 + (i % 5) * 0.06,
            animation: `float ${4 + (i % 6)}s ease-in-out ${i * 0.4}s infinite alternate`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes float {
          from { transform: translateY(0px) scale(1); }
          to   { transform: translateY(-18px) scale(1.15); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 18px rgba(136,64,255,0.4); }
          50%       { box-shadow: 0 0 36px rgba(136,64,255,0.7), 0 0 60px rgba(229,84,232,0.3); }
        }
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; transform: scaleY(0.6); }
          40%            { opacity: 1;   transform: scaleY(1); }
        }
        .msg-bubble { animation: fadeUp 0.3s ease forwards; }
        .send-btn:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 0 30px rgba(136,64,255,0.7) !important; }
        .send-btn:active { transform: scale(0.97); }
        .input-field:focus { outline: none; border-color: #8840FF !important; box-shadow: 0 0 0 3px rgba(136,64,255,0.2); }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3a1060; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: '720px',
        paddingTop: '32px', paddingBottom: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <button style={{
            padding: '8px 18px', fontSize: '0.8rem', fontWeight: 700,
            fontFamily: "'Barlow', sans-serif", letterSpacing: '0.06em',
            color: '#a78bfa', background: 'rgba(136,64,255,0.12)',
            border: '1px solid rgba(136,64,255,0.3)', borderRadius: '8px',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>← HOME</button>
        </Link>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            margin: 0,
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            fontWeight: 900,
            letterSpacing: '0.04em',
            background: 'linear-gradient(135deg, #E554E8 0%, #8840FF 50%, #40FFAF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>✦ SIGGY CHAT ✦</h1>
          <p style={{
            margin: '4px 0 0', fontSize: '0.75rem', color: '#6b4fa8',
            letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>Guardian of the Ritual Forge</p>
        </div>

        {/* Spacer to balance the back button */}
        <div style={{ width: '80px' }} />
      </div>

      {/* Chat window */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '720px',
        flex: 1,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(10, 0, 24, 0.7)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(136,64,255,0.25)',
        borderRadius: '20px',
        overflow: 'hidden',
        animation: 'pulse-glow 4s ease-in-out infinite',
        minHeight: '60vh',
        maxHeight: 'calc(100vh - 260px)',
      }}>

        {/* Decorative top bar */}
        <div style={{
          height: '3px',
          background: 'linear-gradient(90deg, #8840FF, #E554E8, #40FFAF, #8840FF)',
          backgroundSize: '200% 100%',
        }} />

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '24px 20px',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className="msg-bubble"
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: '10px',
              }}
            >
              {/* Avatar dot */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'assistant'
                  ? 'linear-gradient(135deg, #8840FF, #E554E8)'
                  : 'linear-gradient(135deg, #1a4a3a, #40FFAF)',
                border: msg.role === 'assistant'
                  ? '2px solid rgba(229,84,232,0.5)'
                  : '2px solid rgba(64,255,175,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem',
              }}>
                {msg.role === 'assistant' ? '😼' : '◈'}
              </div>

              {/* Bubble */}
              <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: msg.role === 'assistant'
                  ? '4px 16px 16px 16px'
                  : '16px 4px 16px 16px',
                background: msg.role === 'assistant'
                  ? 'linear-gradient(135deg, rgba(88,32,160,0.4), rgba(136,64,255,0.2))'
                  : 'linear-gradient(135deg, rgba(20,60,40,0.6), rgba(64,255,175,0.1))',
                border: msg.role === 'assistant'
                  ? '1px solid rgba(136,64,255,0.3)'
                  : '1px solid rgba(64,255,175,0.25)',
                color: msg.role === 'assistant' ? '#e2d4ff' : '#b8f5d8',
                fontSize: '0.92rem',
                lineHeight: 1.6,
                letterSpacing: '0.01em',
              }}>
                <div style={{
                  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                  color: msg.role === 'assistant' ? '#a855f7' : '#34d399',
                  marginBottom: '5px', textTransform: 'uppercase',
                }}>
                  {msg.role === 'assistant' ? 'Siggy' : 'You'}
                </div>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="msg-bubble" style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #8840FF, #E554E8)',
                border: '2px solid rgba(229,84,232,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem',
              }}>😼</div>
              <div style={{
                padding: '14px 18px',
                borderRadius: '4px 16px 16px 16px',
                background: 'linear-gradient(135deg, rgba(88,32,160,0.4), rgba(136,64,255,0.2))',
                border: '1px solid rgba(136,64,255,0.3)',
                display: 'flex', gap: '5px', alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: '7px', height: '12px', borderRadius: '3px',
                    background: '#a855f7',
                    animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '720px',
        marginTop: '16px',
        display: 'flex', gap: '10px', alignItems: 'center',
      }}>
        <input
          ref={inputRef}
          className="input-field"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Speak to the Forge, mortal…"
          disabled={loading}
          style={{
            flex: 1,
            padding: '14px 20px',
            fontSize: '0.95rem',
            fontFamily: "'Barlow', sans-serif",
            background: 'rgba(10, 0, 24, 0.8)',
            border: '1px solid rgba(136,64,255,0.3)',
            borderRadius: '12px',
            color: '#e2d4ff',
            backdropFilter: 'blur(16px)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
        />
        <button
          className="send-btn"
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '14px 24px',
            fontSize: '0.85rem',
            fontWeight: 800,
            fontFamily: "'Barlow', sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#fff',
            background: input.trim() && !loading
              ? 'linear-gradient(135deg, #8840FF 0%, #E554E8 100%)'
              : 'rgba(60,30,90,0.5)',
            border: '1px solid rgba(136,64,255,0.4)',
            borderRadius: '12px',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: input.trim() && !loading ? '0 0 20px rgba(136,64,255,0.4)' : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          SEND ✦
        </button>
      </div>

      <p style={{
        position: 'relative', zIndex: 1,
        marginTop: '12px', fontSize: '0.7rem',
        color: 'rgba(107,79,168,0.6)', letterSpacing: '0.1em',
      }}>
        PRESS ENTER TO SEND · POWERED BY THE RITUAL FORGE
      </p>
    </div>
  );
}
