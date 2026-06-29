import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getSessionPhone } from '@/lib/dashboard/session';

function getPhone(request: NextRequest): string | null {
  // Middleware injeta o phone como header interno
  const fromHeader = request.headers.get('x-session-phone');
  if (fromHeader) return fromHeader;
  // Fallback direto pelo cookie (para chamadas sem middleware, ex: fetch server-side)
  return getSessionPhone(request.cookies.get('dash_session')?.value);
}

function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const phone = getPhone(request);
  if (!phone) return unauthorized();

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') ?? '200');

  let query = supabase
    .from('vault_documents')
    .select('*')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) query = query.eq('type', type);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const phone = getPhone(request);
  if (!phone) return unauthorized();

  const body = await request.json();
  const { type, title, content, metadata } = body;

  if (!type || !title) {
    return NextResponse.json({ error: 'type e title são obrigatórios' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('vault_documents')
    .insert({ phone, type, title, content: content ?? null, metadata: metadata ?? {} })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
