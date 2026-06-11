import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
  },
  serverExternalPackages: ["better-sqlite3"],
  images: { unoptimized: true },
  async redirects() {
    return [
      // Niche URL renames, old slugs redirect to new numbered format
      { source: '/offer/terapeuta', destination: '/offer/terapeuta-1', permanent: true },
      { source: '/offer/terapeuta/:path*', destination: '/offer/terapeuta-1/:path*', permanent: true },
      { source: '/offer/clinica-estetica', destination: '/offer/clinica-estetica-1', permanent: true },
      { source: '/offer/clinica-estetica/:path*', destination: '/offer/clinica-estetica-1/:path*', permanent: true },
      { source: '/offer/medico', destination: '/offer/medico-1', permanent: true },
      { source: '/offer/medico/:path*', destination: '/offer/medico-1/:path*', permanent: true },
      { source: '/offer/prestador-de-servico', destination: '/offer/prestador-de-servico-1', permanent: true },
      { source: '/offer/prestador-de-servico/:path*', destination: '/offer/prestador-de-servico-1/:path*', permanent: true },
      { source: '/offer/corretor-de-imoveis', destination: '/offer/corretor-de-imoveis-1', permanent: true },
      { source: '/offer/corretor-de-imoveis/:path*', destination: '/offer/corretor-de-imoveis-1/:path*', permanent: true },
      { source: '/offer/dentista', destination: '/offer/dentista-1', permanent: true },
      { source: '/offer/dentista/:path*', destination: '/offer/dentista-1/:path*', permanent: true },
      {
        source: '/',
        destination: '/offer/video',
        permanent: false,
        has: [{ type: 'host', value: 'oferta.caulineroots.com' }],
      },
      {
        source: '/video',
        destination: '/offer/video',
        permanent: false,
        has: [{ type: 'host', value: 'oferta.caulineroots.com' }],
      },
      {
        source: '/texto-video',
        destination: '/offer/texto-video',
        permanent: false,
        has: [{ type: 'host', value: 'oferta.caulineroots.com' }],
      },
      {
        source: '/resultado',
        destination: '/offer/resultado',
        permanent: false,
        has: [{ type: 'host', value: 'oferta.caulineroots.com' }],
      },
      {
        source: '/:path*',
        destination: 'https://oferta.caulineroots.com/video',
        permanent: false,
        has: [{ type: 'host', value: 'caulineroots.com' }],
      },
    ];
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // HSTS only in production. Sending this locally causes ERR_SSL_PROTOCOL_ERROR
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
