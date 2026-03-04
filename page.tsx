'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundImage: 'url(/brand-assets/Patterns/Wormhole.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: "'Barlow', sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dark overlay so text pops over the wormhole */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          zIndex: 0,
        }}
      />

      {/* MAIN CONTENT */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexGrow: 1,
          width: '100%',
          padding: '60px 24px 0',
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <div
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'translateY(0)' : 'translateY(-20px)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
            marginBottom: '52px',
          }}
        >
          <img
            src="/brand-assets/Lockup/Translucent.png"
            alt="Ritual"
            style={{
              width: 'clamp(200px, 30vw, 400px)',
              height: 'auto',
              display: 'block',
              margin: '0 auto',
              filter: 'drop-shadow(0 0 40px rgba(64,255,175,0.35))',
            }}
          />
        </div>

        {/* Heading */}
        <div
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s',
            marginBottom: '24px',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              margin: 0,
              textShadow: '0 2px 40px rgba(0,0,0,0.8)',
            }}
          >
            The state of AI is flawed.
          </h1>
        </div>

        {/* Sub-heading */}
        <div
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s ease 0.35s, transform 0.8s ease 0.35s',
            marginBottom: '64px',
            maxWidth: '680px',
          }}
        >
          <p
            style={{
              fontSize: 'clamp(1.05rem, 2.2vw, 1.45rem)',
              fontWeight: 500,
              color: '#40FFAF',
              lineHeight: 1.6,
              margin: 0,
              textShadow: '0 0 30px rgba(64,255,175,0.4)',
            }}
          >
            Ritual is the solution.{' '}
            <span style={{ color: '#E7E7E7', fontWeight: 400 }}>
              It Brings AI to Every Protocol and App with Just a Few Lines of Code.
            </span>
          </p>
        </div>

        {/* CTA Buttons */}
        <div
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s ease 0.5s, transform 0.8s ease 0.5s',
            display: 'flex',
            gap: '24px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Link href="/quiz" style={{ textDecoration: 'none' }}>
            <button
              style={{
                padding: '20px 56px',
                fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                fontWeight: 800,
                fontFamily: "'Barlow', sans-serif",
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#000000',
                background: 'linear-gradient(135deg, #40FFAF 0%, #077345 100%)',
                border: 'none',
                borderRadius: '14px',
                cursor: 'pointer',
                boxShadow: '0 0 40px rgba(64,255,175,0.45), 0 8px 24px rgba(0,0,0,0.4)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px) scale(1.03)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 60px rgba(64,255,175,0.6), 0 12px 32px rgba(0,0,0,0.5)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0) scale(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(64,255,175,0.45), 0 8px 24px rgba(0,0,0,0.4)';
              }}
            >
              Start Quiz
            </button>
          </Link>

          <Link href="/game" style={{ textDecoration: 'none' }}>
            <button
              style={{
                padding: '20px 56px',
                fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                fontWeight: 800,
                fontFamily: "'Barlow', sans-serif",
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
                background: 'linear-gradient(135deg, #8840FF 0%, #E554E8 100%)',
                border: 'none',
                borderRadius: '14px',
                cursor: 'pointer',
                boxShadow: '0 0 40px rgba(136,64,255,0.45), 0 8px 24px rgba(0,0,0,0.4)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px) scale(1.03)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 60px rgba(136,64,255,0.6), 0 12px 32px rgba(0,0,0,0.5)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0) scale(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(136,64,255,0.45), 0 8px 24px rgba(0,0,0,0.4)';
              }}
            >
              Play Game
            </button>
          </Link>
        </div>
      </div>

      {/* FOOTER LINKS */}
      <footer
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          padding: '32px 24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 'clamp(16px, 4vw, 48px)',
          flexWrap: 'wrap',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.8s ease 0.7s',
        }}
      >
        {[
          { label: 'ritual.net', href: 'https://ritual.net/' },
          { label: 'ritualfoundation.org', href: 'https://www.ritualfoundation.org/' },
          { label: '@ritualnet', href: 'https://x.com/ritualnet' },
          { label: '@ritualfnd', href: 'https://x.com/ritualfnd' },
        ].map(link => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'rgba(255,255,255,0.55)',
              textDecoration: 'none',
              fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
              fontWeight: 500,
              fontFamily: "'Barlow', sans-serif",
              letterSpacing: '0.02em',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.color = '#40FFAF';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.55)';
            }}
          >
            {link.label}
          </a>
        ))}
      </footer>
    </main>
  );
}
