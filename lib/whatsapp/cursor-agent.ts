import { Agent, CursorAgentError } from '@cursor/sdk';

const GITHUB_REMOTE = process.env.CURSOR_GITHUB_REMOTE ?? '';
const GITHUB_BRANCH = process.env.CURSOR_GITHUB_BRANCH ?? 'main';

/**
 * Executa um agente Cursor no modo cloud para editar o código do repositório.
 * Roda de forma assíncrona — não bloqueia o webhook.
 *
 * @param prompt  Instrução de edição em linguagem natural
 * @param notify  Callback para enviar mensagens de progresso/resultado via WhatsApp
 */
export async function executarCursorAgent(
  prompt: string,
  notify: (msg: string) => Promise<void>,
): Promise<void> {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    await notify('❌ CURSOR_API_KEY não configurada. Configure a variável de ambiente no Railway.');
    return;
  }

  if (!GITHUB_REMOTE) {
    await notify('❌ CURSOR_GITHUB_REMOTE não configurada. Configure a variável de ambiente no Railway.');
    return;
  }

  const promptCompleto = `Contexto: você está trabalhando no repositório AI-Agents — um sistema de automação em Next.js 15 (TypeScript, Tailwind CSS, Supabase). O sistema tem um dashboard, agente de WhatsApp e pipelines de orçamento.

Tarefa solicitada via WhatsApp: ${prompt}

Instruções:
- Edite APENAS o necessário para atender a tarefa
- Mantenha o padrão de código existente (TypeScript strict, Tailwind, sem comentários óbvios)
- Faça commit com mensagem descritiva em português após concluir
- Se a tarefa for ambígua ou perigosa, explique o motivo e não edite nada`;

  try {
    await notify('⚙️ Agente Cursor iniciado no modo cloud. Vou avisar quando terminar...');

    console.log('[cursor-agent] iniciando agente cloud para prompt:', prompt.slice(0, 100));

    const result = await Agent.prompt(promptCompleto, {
      apiKey,
      model: { id: 'composer-2.5' },
      cloud: {
        repos: [{ remote: GITHUB_REMOTE, branch: GITHUB_BRANCH }],
        autoCreatePR: false,
      },
    });

    console.log('[cursor-agent] resultado:', result.status, result.id);

    if (result.status === 'finished') {
      await notify(
        `✅ Edição concluída! Railway vai fazer o deploy automaticamente em 1-2 minutos.\n\n_Run ID: ${result.id}_`,
      );
    } else if (result.status === 'error') {
      await notify(
        `⚠️ O agente terminou com erro. Verifique o Cursor Dashboard.\n\n_Run ID: ${result.id}_`,
      );
    } else {
      await notify(`⚠️ Status inesperado: ${result.status}\n\n_Run ID: ${result.id}_`);
    }
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error('[cursor-agent] startup error:', err.message, 'retryable:', err.isRetryable);
      await notify(
        `❌ Erro ao iniciar o agente Cursor: ${err.message}\n${err.isRetryable ? '(pode tentar de novo)' : ''}`,
      );
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cursor-agent] erro inesperado:', msg);
      await notify(`❌ Erro inesperado no agente Cursor: ${msg.slice(0, 300)}`);
    }
  }
}
