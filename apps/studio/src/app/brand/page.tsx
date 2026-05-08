/**
 * /brand — Ivaronix brand kit (logo, palette, type ramp, voice, sample
 * surfaces). The source artifact is a self-contained HTML export from
 * the brand-design tool; we serve it from public/brand.html and iframe
 * it here so it integrates into the Studio nav + URL space without
 * fighting the bundler over its embedded fonts.
 */
export const metadata = {
  title: 'Brand kit · Ivaronix',
  description: 'Logo, palette, typography, voice. The canonical visual reference.',
};

export default function BrandPage() {
  return (
    <div style={{ width: '100%', minHeight: 'calc(100vh - 64px)' }}>
      <iframe
        src="/brand.html"
        title="Ivaronix Brand Kit"
        style={{
          width: '100%',
          height: 'calc(100vh - 64px)',
          border: 0,
          display: 'block',
        }}
      />
    </div>
  );
}
