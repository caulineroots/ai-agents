import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { createSession } from '@/lib/dashboard/session';

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.caulineroots.com';

function redirectWithError(erro: string) {
  return NextResponse.redirect(new URL(`/login?erro=${erro}`, BASE));
}

// WhatsApp e outras plataformas fazem GET no link para gerar preview,
// consumindo o token antes do usuario clicar. Detectamos e ignoramos.
function isLinkPreviewBot(request: NextRequest): boolean {
  const ua = (request.headers.get('user-agent') ?? '').toLowerCase();
  const botPatterns = ['whatsapp', 'facebookexternalhit', 'twitterbot', 'telegrambot',
    'slackbot', 'linkedinbot', 'bot', 'crawler', 'spider', 'preview', 'curl', 'wget'];
  const isBot = botPatterns.some((p) => ua.includes(p));
  console.log('[magic-login] user-agent:', ua.slice(0, 80), '| isBot:', isBot);
  return isBot;
}

export async function GET(request: NextRequest) {
  console.log('[magic-login] inicio. BASE_URL:', BASE);

  // Prefetch de preview — retorna pagina generica SEM consumir o token
  if (isLinkPreviewBot(request)) {
    console.log('[magic-login] bot detectado, ignorando sem consumir token');
    return new NextResponse('<html><head><title>Dashboard - Cauline</title></head><body>Dashboard</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const token = request.nextUrl.searchParams.get('token');
  console.log('[magic-login] token recebido:', token ? `${token.slice(0, 8)}...` : 'NENHUM');

  if (!token) return redirectWithError('token_invalido');

  const { data, error } = await supabase
    .from('dashboard_tokens')
    .select('phone, used, expires_at')
    .eq('token', token)
    .single();

  console.log('[magic-login] supabase data:', JSON.stringify(data));
  console.log('[magic-login] supabase error:', error?.message ?? 'nenhum');

  if (error || !data) return redirectWithError('token_invalido');
  if (data.used) return redirectWithError('token_usado');
  if (new Date(data.expires_at as string) < new Date()) return redirectWithError('token_expirado');

  console.log('[magic-login] token valido para phone:', data.phone);
  await supabase.from('dashboard_tokens').update({ used: true }).eq('token', token);

  const sessionValue = await createSession(data.phone as string);
  const maxAge = 7 * 24 * 60 * 60;
  const dashboardUrl = `${BASE}/dashboard`;

  console.log('[magic-login] session criada, length:', sessionValue.length);
  console.log('[magic-login] retornando HTML com cookie via JS + redirect para:', dashboardUrl);

  // Set-Cookie e stripado pelo proxy Railway em respostas 3xx e possivelmente 2xx.
  // O JS seta o cookie diretamente no browser e so entao redireciona.
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Entrando no Dashboard...</title>
</head>
<body>
  <p style="font-family:sans-serif;text-align:center;margin-top:40px">Autenticando, aguarde...</p>
  <script>
    (function() {
      try {
        var val = ${JSON.stringify(sessionValue)};
        var maxAge = ${maxAge};
        var url = ${JSON.stringify(dashboardUrl)};
        document.cookie = "dash_session=" + val + "; Path=/; SameSite=Lax; Max-Age=" + maxAge + "; Secure";
        // Confirma que o cookie foi setado
        var ok = document.cookie.indexOf("dash_session=") >= 0;
        console.log("[magic-login-js] cookie setado:", ok, "cookies:", document.cookie.length, "chars");
        if (!ok) {
          document.body.innerHTML = "<p style='font-family:sans-serif;color:red;text-align:center'>Erro ao autenticar (cookie bloqueado). Tente acessar o link no browser do celular, nao pelo WhatsApp.</p>";
          return;
        }
        window.location.replace(url);
      } catch(e) {
        console.error("[magic-login-js] erro:", e);
        window.location.replace(url);
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
