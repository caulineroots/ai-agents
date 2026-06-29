import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}

function checkAuth(request: NextRequest) {
  const session = request.cookies.get('dash_session');
  const password = process.env.DASHBOARD_PASSWORD ?? 'cauline2026';
  return session?.value === password;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorized();

  const { data, error } = await supabase
    .from('reminders')
    .select(`
      id,
      send_at,
      offset_label,
      sent,
      sent_at,
      created_at,
      vault_document_id,
      vault_documents ( id, title, type )
    `)
    .order('send_at', { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) return unauthorized();

  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  }

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
