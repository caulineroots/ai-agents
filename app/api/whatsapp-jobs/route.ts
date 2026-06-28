import { supabase } from '@/lib/supabase/client';

export const runtime = 'nodejs';

export async function GET() {
  const { data, error } = await supabase
    .from('whatsapp_jobs')
    .select('id, phone, status, pdf_filename, folha, resultado, error_msg, created_at, updated_at')
    .eq('seen', false)
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ jobs: data ?? [] });
}

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'id obrigatório' }, { status: 400 });
  }

  const { error } = await supabase
    .from('whatsapp_jobs')
    .update({ seen: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
