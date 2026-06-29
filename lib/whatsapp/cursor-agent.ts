/**
 * Agente de edição de código via WhatsApp usando Claude + GitHub API.
 * Não depende do Cursor SDK — usa Anthropic diretamente com tool use.
 *
 * Fluxo: WhatsApp → detecta "cursor:" → Claude lê/edita arquivos via GitHub API
 *        → commita no GitHub → Railway faz deploy automático.
 */

import Anthropic from '@anthropic-ai/sdk';

const GITHUB_OWNER = process.env.GITHUB_OWNER ?? 'caulineroots';
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'ai-agents';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'main';

const MAX_ITERATIONS = 20;

const EXCLUDED_PREFIXES = [
  'node_modules', '.next', '.git', 'package-lock.json',
  '.cursor/projects', 'agent-tools', 'assets',
];

// ─── GitHub API helpers ───────────────────────────────────────────────────────

async function ghApi(method: string, path: string, body?: object): Promise<unknown> {
  const token = process.env.GITHUB_PAT;
  if (!token) throw new Error('GITHUB_PAT não configurado');

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub API ${method} ${path}: ${res.status} ${txt.slice(0, 300)}`);
  }
  return res.json();
}

// ─── Tool implementations ─────────────────────────────────────────────────────

async function toolListFiles(directory?: string): Promise<string> {
  const tree = (await ghApi(
    'GET',
    `/git/trees/${GITHUB_BRANCH}?recursive=1`,
  )) as { tree: Array<{ path: string; type: string }> };

  const files = tree.tree
    .filter((f) => f.type === 'blob')
    .filter((f) => !EXCLUDED_PREFIXES.some((ex) => f.path.startsWith(ex)))
    .filter((f) => (directory ? f.path.startsWith(directory) : true))
    .map((f) => f.path);

  if (files.length === 0) return 'Nenhum arquivo encontrado.';
  return files.join('\n');
}

async function toolReadFile(path: string): Promise<string> {
  const data = (await ghApi('GET', `/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`)) as {
    content: string;
    encoding: string;
  };
  if (data.encoding !== 'base64') return data.content;
  return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
}

async function toolWriteFile(
  path: string,
  content: string,
  commitMessage: string,
): Promise<string> {
  let sha: string | undefined;
  try {
    const existing = (await ghApi(
      'GET',
      `/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`,
    )) as { sha: string };
    sha = existing.sha;
  } catch {
    // Arquivo novo — sem SHA necessário
  }

  const body: Record<string, string> = {
    message: commitMessage,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;

  await ghApi('PUT', `/contents/${encodeURIComponent(path)}`, body);
  return `✓ ${sha ? 'Atualizado' : 'Criado'}: ${path}`;
}

async function toolDeleteFile(path: string, commitMessage: string): Promise<string> {
  const existing = (await ghApi(
    'GET',
    `/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`,
  )) as { sha: string };

  await ghApi('DELETE', `/contents/${encodeURIComponent(path)}`, {
    message: commitMessage,
    sha: existing.sha,
    branch: GITHUB_BRANCH,
  });
  return `✓ Deletado: ${path}`;
}

// ─── Tool definitions para o Claude ──────────────────────────────────────────

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'list_files',
    description:
      'Lista todos os arquivos do repositório (ou de um diretório específico). Use antes de ler arquivos para descobrir o que existe.',
    input_schema: {
      type: 'object' as const,
      properties: {
        directory: {
          type: 'string',
          description:
            'Diretório opcional para filtrar (ex: "app/dashboard", "lib/whatsapp"). Se omitido, lista todos os arquivos.',
        },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Lê o conteúdo de um arquivo do repositório.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Caminho relativo do arquivo (ex: "app/dashboard/page.tsx")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Cria ou atualiza um arquivo no repositório com um commit. Use o conteúdo COMPLETO do arquivo — não parcial.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Caminho relativo do arquivo',
        },
        content: {
          type: 'string',
          description: 'Conteúdo COMPLETO do arquivo (não patches, o arquivo inteiro)',
        },
        commit_message: {
          type: 'string',
          description: 'Mensagem do commit em português, descritiva (ex: "feat: adiciona campo telefone no lead")',
        },
      },
      required: ['path', 'content', 'commit_message'],
    },
  },
  {
    name: 'delete_file',
    description: 'Deleta um arquivo do repositório.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Caminho relativo do arquivo' },
        commit_message: { type: 'string', description: 'Mensagem do commit' },
      },
      required: ['path', 'commit_message'],
    },
  },
];

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um agente de engenharia de software que edita o repositório "ai-agents" diretamente via GitHub API.

**Sobre o projeto:**
- Next.js 15 (App Router), TypeScript strict, Tailwind CSS, Supabase
- Dashboard de gestão com CRM, financeiro, tarefas, projetos, objetivos
- Agente de WhatsApp com brain (intent.ts), vault (vault.ts), cron jobs
- Pipelines de orçamento para marmoraria e marcenaria (Claude vision)
- Deploy contínuo no Railway via push no branch main

**Estrutura chave:**
- app/ → páginas e rotas da API (Next.js App Router)
- lib/whatsapp/ → lógica do agente de WhatsApp
- lib/orcamento/ → pipelines de orçamento
- components/dashboard/ → componentes React do dashboard
- scripts/ → migrações SQL

**Regras obrigatórias:**
1. Leia o arquivo COMPLETO antes de editar — nunca assuma o conteúdo
2. Ao escrever um arquivo, sempre passe o conteúdo COMPLETO (não patches)
3. Mantenha o padrão de código existente: TypeScript strict, sem 'any', sem comentários óbvios
4. Faça commits atômicos e descritivos em português
5. Se a tarefa for ambígua ou arriscada, descreva o problema e pare sem editar
6. Após concluir todas as edições, responda com um resumo claro do que foi feito`;

// ─── Executor de ferramentas ──────────────────────────────────────────────────

async function executarFerramenta(
  name: string,
  input: Record<string, string>,
): Promise<string> {
  try {
    switch (name) {
      case 'list_files':
        return await toolListFiles(input.directory);
      case 'read_file':
        return await toolReadFile(input.path);
      case 'write_file':
        return await toolWriteFile(input.path, input.content, input.commit_message);
      case 'delete_file':
        return await toolDeleteFile(input.path, input.commit_message);
      default:
        return `Ferramenta desconhecida: ${name}`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Erro na ferramenta ${name}: ${msg}`;
  }
}

// ─── Agente principal ─────────────────────────────────────────────────────────

export async function executarCursorAgent(
  instrucao: string,
  notify: (msg: string) => Promise<void>,
): Promise<void> {
  if (!process.env.GITHUB_PAT) {
    await notify('❌ GITHUB_PAT não configurado. Adicione a variável no Railway.');
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    await notify('❌ ANTHROPIC_API_KEY não configurado.');
    return;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log('[cursor-agent] iniciando para instrução:', instrucao.slice(0, 100));

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: instrucao },
  ];

  let arquivosEditados: string[] = [];
  let iteracao = 0;

  try {
    while (iteracao < MAX_ITERATIONS) {
      iteracao++;

      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      // Adiciona resposta ao histórico
      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        // Claude terminou — extrai o resumo final
        const textoFinal = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();

        const arquivosStr =
          arquivosEditados.length > 0
            ? `\n\n*Arquivos editados:*\n${arquivosEditados.map((f) => `• ${f}`).join('\n')}`
            : '';

        await notify(
          `✅ Concluído! Railway vai fazer o deploy em 1-2 min.${arquivosStr}\n\n${textoFinal.slice(0, 600)}`,
        );
        return;
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          const input = block.input as Record<string, string>;
          console.log(`[cursor-agent] tool: ${block.name}`, JSON.stringify(input).slice(0, 100));

          const resultado = await executarFerramenta(block.name, input);

          // Rastreia arquivos editados para o resumo final
          if ((block.name === 'write_file' || block.name === 'delete_file') && input.path) {
            if (!arquivosEditados.includes(input.path)) {
              arquivosEditados.push(input.path);
            }
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultado,
          });
        }

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Stop reason inesperado
      await notify(`⚠️ Agente parou inesperadamente (${response.stop_reason}). Tente novamente.`);
      return;
    }

    await notify(
      `⚠️ Limite de ${MAX_ITERATIONS} iterações atingido. O agente pode não ter concluído. Verifique o repositório.`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cursor-agent] erro:', msg);
    await notify(`❌ Erro no agente: ${msg.slice(0, 300)}`);
  }
}
