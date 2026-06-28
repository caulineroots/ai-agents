/**
 * OAuth2 callback do Google Calendar.
 * O Google redireciona aqui após o usuário autorizar.
 * URL: /api/whatsapp/calendar-auth?code=xxx&state=xxx
 */

import { handleCalendarCallback, getAuthUrl } from '@/lib/whatsapp/calendar';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // Página HTML de resposta
  function html(titulo: string, corpo: string, cor = '#22c55e') {
    return new Response(
      `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #09090b; color: #e4e4e7; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 2rem 2.5rem; max-width: 400px; text-align: center; }
    h1 { font-size: 1.25rem; margin-bottom: 0.75rem; color: ${cor}; }
    p { color: #a1a1aa; font-size: 0.95rem; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${titulo}</h1>
    <p>${corpo}</p>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  if (error) {
    return html(
      'Autorização negada',
      `Erro: ${error}. Feche essa janela e tente novamente.`,
      '#ef4444',
    );
  }

  if (!code) {
    // Sem código → redirecionar para autorização
    const authUrl = getAuthUrl();
    if (!authUrl) {
      return html(
        'Google Calendar não configurado',
        'Adicione GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env.local.',
        '#f59e0b',
      );
    }
    return Response.redirect(authUrl, 302);
  }

  const ok = await handleCalendarCallback(code);

  if (!ok) {
    return html(
      'Erro ao conectar',
      'Não foi possível salvar as credenciais. Verifique os logs do servidor.',
      '#ef4444',
    );
  }

  return html(
    'Google Calendar conectado!',
    'Autorização concluída. Pode fechar essa janela. A partir de agora, tarefas com prazo definido criarão eventos automaticamente no seu Google Calendar.',
  );
}
