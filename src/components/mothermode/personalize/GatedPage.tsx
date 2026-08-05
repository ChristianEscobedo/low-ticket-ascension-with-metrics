import React from 'react';

/**
 * The decoy rendered in `gated` mode when no valid ?pp= token is present.
 *
 * The whole point is what this page does NOT do: it reveals nothing about
 * the offer, the price, or the funnel behind it — competitors and scrapers
 * see a polite dead end, while every real recipient's signed link opens the
 * actual page. Keep it generic, branded, and free of offer hints on purpose.
 *
 * Server component (no hooks) so any funnel route can return it directly.
 */
export default function GatedPage({ brand = 'MotherMode' }: { brand?: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5F1EB',
        color: '#1A1816',
        fontFamily: 'Georgia, serif',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#A88B5C',
            marginBottom: '1.25rem',
          }}
        >
          {brand}
        </div>
        <h1
          style={{
            fontSize: 28,
            lineHeight: 1.25,
            fontWeight: 500,
            margin: 0,
          }}
        >
          This page is private.
        </h1>
        <p
          style={{
            marginTop: '1rem',
            fontSize: 15,
            lineHeight: 1.6,
            color: '#6b6257',
          }}
        >
          It was prepared for a specific recipient and only opens from the
          personal link sent to them. If that is you, use the exact link from
          your email.
        </p>
        <div
          style={{
            marginTop: '2rem',
            height: 1,
            background: '#B0A091',
            opacity: 0.4,
          }}
        />
        <p style={{ marginTop: '1.25rem', fontSize: 12, color: '#B0A091' }}>
          Nothing is publicly available here.
        </p>
      </div>
    </div>
  );
}
