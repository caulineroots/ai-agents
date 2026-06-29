'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const errosMensagens: Record<string, string> = {
  token_invalido: 'Link inválido ou não encontrado.',
  token_usado: 'Este link já foi utilizado. Solicite um novo pelo WhatsApp.',
  token_expirado: 'Este link expirou (válido por 15 minutos). Solicite um novo pelo WhatsApp.',
};

function LoginContent() {
  const params = useSearchParams();
  const erro = params.get('erro');
  const mensagemErro = erro ? (errosMensagens[erro] ?? 'Erro ao acessar o painel.') : null;

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-stone-100">Acesso ao Painel</h1>
          <p className="text-stone-400 text-sm">
            O acesso é feito via link enviado pelo WhatsApp.
          </p>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 space-y-4">
          <div className="text-4xl">📱</div>
          <p className="text-stone-300 text-sm leading-relaxed">
            Envie uma mensagem para o assistente no WhatsApp dizendo{' '}
            <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-stone-100 text-xs">
              painel
            </span>{' '}
            ou{' '}
            <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-stone-100 text-xs">
              dashboard
            </span>{' '}
            e você receberá um link de acesso exclusivo válido por 15 minutos.
          </p>
        </div>

        {mensagemErro && (
          <div className="bg-red-950/50 border border-red-900 rounded-lg p-4">
            <p className="text-red-400 text-sm">{mensagemErro}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
