import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SalvageScore — AI auction analysis for US & UK buyers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#0A0B0E',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px 96px',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Amber glow */}
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            right: -200,
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(217,119,6,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Logo wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              background: '#D97706',
              width: 10,
              height: 10,
              borderRadius: '50%',
            }}
          />
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 14,
              fontWeight: 600,
              color: '#9BA3C2',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            SalvageScore
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: '#F0EDE8',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            marginBottom: 24,
            maxWidth: 900,
          }}
        >
          Should you buy it?
        </div>

        {/* Subline */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 22,
            color: '#6B7280',
            lineHeight: 1.6,
            maxWidth: 760,
            marginBottom: 56,
          }}
        >
          AI damage analysis, full cost breakdown, and go/no-go verdict in 90 seconds. For UK and US auction buyers.
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: 12 }}>
          {['UK Cat N/S', 'UK Importer', 'US Domestic', 'Free'].map((label) => (
            <div
              key={label}
              style={{
                fontFamily: 'monospace',
                fontSize: 14,
                color: label === 'Free' ? '#D97706' : '#9BA3C2',
                border: `1px solid ${label === 'Free' ? 'rgba(217,119,6,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8,
                padding: '8px 16px',
                background: label === 'Free' ? 'rgba(217,119,6,0.08)' : 'rgba(255,255,255,0.03)',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            right: 96,
            fontFamily: 'monospace',
            fontSize: 14,
            color: '#3A3D4E',
            letterSpacing: '0.05em',
          }}
        >
          salvagescore.com
        </div>
      </div>
    ),
    { ...size }
  );
}
