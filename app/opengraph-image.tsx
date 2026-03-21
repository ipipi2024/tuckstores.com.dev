import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'TuckStores'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 96,
            height: 96,
            background: 'white',
            borderRadius: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          <span style={{ color: '#4f46e5', fontSize: 60, fontWeight: 800, lineHeight: 1 }}>
            T
          </span>
        </div>

        {/* Brand name */}
        <div
          style={{
            color: 'white',
            fontSize: 80,
            fontWeight: 800,
            letterSpacing: '-3px',
            lineHeight: 1,
            marginBottom: 16,
          }}
        >
          TuckStores
        </div>

        {/* Tagline */}
        <div
          style={{
            color: 'rgba(199, 210, 254, 0.9)',
            fontSize: 26,
            fontWeight: 400,
          }}
        >
          Point of sale · business management for retail stores
        </div>
      </div>
    ),
    { ...size },
  )
}
