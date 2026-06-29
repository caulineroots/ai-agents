import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { createSession } from '@/lib/dashboard/session';

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.caulineroots.com';

function redirectWithError(erro: string) {
  return NextResponse.redirect(new URL(`/login?erro=${erro}`, BASE));
}

export async function GET(request: NextRequest) {
  console.log('[magic-login] inicio. BASE_URL:', BASE);

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
  console.log('[magic-login] retornando HTML que seta cookie via JS e redireciona para:', dashboardUrl);

  // Railway stripa Set-Cookie mesmo em respostas 200.
  // O JS seta o cookie diretamente no browser (sem HttpOnly, seguro pois HMAC valida).
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Autenticando...</title></head>
<body>
<p>Autenticando, aguarde...</p>
<script>
(function() {
  var val = ${JSON.stringify(sessionValue)};
  var maxAge = ${maxAge};
  var url = ${JSON.stringify(dashboardUrl)};
  document.cookie = "dash_session=" + val + "; Path=/; Secure; SameSite=Lax; Max-Age=" + maxAge;
  console.log("cookie set, redirecionando...");
  window.location.replace(url);
})();
</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
