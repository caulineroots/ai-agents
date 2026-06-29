import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getSessionPhone } from '@/lib/dashboard/session';

function getPhone(request: NextRequest): string | null {
  const fromHeader = request.headers.get('x-session-phone');
  if (fromHeader) return fromHeader;
  return getSessionPhone(request.cookies.get('dash_session')?.value);
}

function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const phone = getPhone(request);
  if (!phone) return unauthorized();

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
    .eq('phone', phone)
    .order('send_at', { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  const phone = getPhone(request);
  if (!phone) return unauthorized();

  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  }

  // Garante que só deleta lembretes do próprio phone
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('phone', phone);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
