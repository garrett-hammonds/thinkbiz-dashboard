import type { NextConfig } from "next";

// Baseline security response headers applied to every route.
//
// CSP is intentionally shipped in Report-Only mode first: this app uses inline
// styles (Tailwind) and connects to Supabase / Stripe / Resend, so a strict
// enforcing policy risks breaking the UI until the directives are proven out
// against real traffic. Report-Only lets violations surface (in the browser
// console / a future report endpoint) without blocking anything. Once the
// reports are clean, switch the header name to `Content-Security-Policy`.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

const cspDirectives = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; 'unsafe-inline' is required until
  // a nonce-based setup is in place. 'unsafe-eval' is dev-only for React refresh.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase (REST/realtime/storage) + Stripe. Realtime uses wss.
  `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace(/^https/, 'wss')} https://api.stripe.com`.trim(),
  // Stripe Checkout/Billing portal and Supabase are navigated to, not framed;
  // block anyone framing us.
  "frame-ancestors 'none'",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy-Report-Only', value: cspDirectives },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
