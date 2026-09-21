import { NextResponse } from 'next/server';
import { safeNextPath } from '@/utils/safeRedirect';

// Where Stripe sends the phone app back to. Checkout and the billing portal
// run in the system browser (never inside the WebView), so when they finish
// the browser lands here and this page hands focus back to the app through
// its custom scheme (thinkbiz://return?to=/dashboard). The app's NativeBridge
// reads `to` and navigates there. Browsers that refuse an automatic scheme
// launch still show a button, and the in-app page refreshes on foreground
// either way, so a paid member is never stuck on the paywall.
const SCHEME = process.env.NEXT_PUBLIC_NATIVE_SCHEME || 'thinkbiz';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = safeNextPath(url.searchParams.get('to'), '/dashboard');
  const appUrl = `${SCHEME}://return?to=${encodeURIComponent(to)}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Back to ThinkBiz</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;background:#f5f6f8;color:#1a1d23;text-align:center;padding:24px;box-sizing:border-box}
  .card{max-width:360px;background:#fff;border:1px solid #e2e5ea;border-radius:16px;padding:32px 24px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(33,189,200,.08)}
  h1{font-size:20px;margin:0 0 8px}p{color:#6b7280;font-size:15px;line-height:1.5;margin:0 0 20px}
  a.btn{display:block;background:#21bdc8;color:#fff;text-decoration:none;font-weight:600;border-radius:10px;padding:14px 24px}
  a.alt{display:inline-block;margin-top:14px;font-size:13px;color:#6b7280}
</style>
</head>
<body>
<main class="card">
  <h1>All done</h1>
  <p>You can head back to the ThinkBiz app now.</p>
  <a class="btn" href="${appUrl}">Open ThinkBiz</a>
  <a class="alt" href="${to}">Stay in the browser instead</a>
</main>
<script>setTimeout(function(){window.location.href=${JSON.stringify(appUrl)};},150);</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
