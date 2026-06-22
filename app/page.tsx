import Link from 'next/link';

export default function LandingPage() {
  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
        background: '#f5f3f0',
        overflow: 'hidden',
      }}
    >
      {/* Phase 2: animated background component slots in here */}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 640 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 20,
            background: '#fce7f3',
            color: '#be185d',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 28,
          }}
        >
          ✦ AI-powered job application assistant
        </div>

        <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05, margin: 0, color: '#1c1b19', letterSpacing: '-0.02em' }}>
          Land your next role,
          <br />
          <span style={{ color: '#ec4899' }}>one smart application</span> at a time.
        </h1>

        <p style={{ fontSize: 18, lineHeight: 1.6, color: '#6b6862', margin: '24px auto 36px', maxWidth: 520 }}>
          ApplyIQ tracks every application, scores your fit against each job, and uses AI to sharpen
          your resume and cover letters — so you apply smarter, not harder.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/register"
            style={{
              padding: '14px 28px',
              borderRadius: 9,
              background: '#ec4899',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              textDecoration: 'none',
            }}
          >
            Get started free
          </Link>
          <Link
            href="/login"
            style={{
              padding: '14px 28px',
              borderRadius: 9,
              background: '#fff',
              color: '#1c1b19',
              fontWeight: 700,
              fontSize: 16,
              textDecoration: 'none',
              border: '1px solid #e5e1da',
            }}
          >
            Sign in
          </Link>
        </div>

        <p style={{ fontSize: 13, color: '#9b968e', marginTop: 20 }}>
          14-day free trial · No charge until your trial ends · Cancel anytime
        </p>
      </div>
    </main>
  );
}
