import { ImageResponse } from 'next/og'

export const contentType = 'image/png'

function IconMark({ size }: { size: number }) {
  return (
    <div
      style={{
        background: '#4f46e5',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Math.round(size * 0.22),
      }}
    >
      <span
        style={{
          color: 'white',
          fontSize: Math.round(size * 0.65),
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        T
      </span>
    </div>
  )
}

export function generateImageMetadata() {
  return [
    { id: '32',  contentType: 'image/png', size: { width: 32,  height: 32  } },
    { id: '192', contentType: 'image/png', size: { width: 192, height: 192 } },
    { id: '512', contentType: 'image/png', size: { width: 512, height: 512 } },
  ]
}

export default function Icon({ id }: { id: string }) {
  const dim = ({ '32': 32, '192': 192, '512': 512 } as Record<string, number>)[id] ?? 32
  return new ImageResponse(<IconMark size={dim} />, { width: dim, height: dim })
}
