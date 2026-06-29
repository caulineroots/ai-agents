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

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') ?? '200');

  let query = supabase
    .from('vault_documents')
    .select('*')
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
  if (!checkAuth(request)) return unauthorized();

  const body = await request.json();
  const { type, title, content, metadata } = body;

  if (!type || !title) {
    return NextResponse.json({ error: 'type e title são obrigatórios' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('vault_documents')
    .insert({ type, title, content: content ?? null, metadata: metadata ?? {} })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
