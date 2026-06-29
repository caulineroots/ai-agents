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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(request)) return unauthorized();

  const { id } = await params;

  const { data, error } = await supabase
    .from('vault_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(request)) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const { title, content, metadata } = body;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (metadata !== undefined) updates.metadata = metadata;

  const { data, error } = await supabase
    .from('vault_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(request)) return unauthorized();

  const { id } = await params;

  const { error } = await supabase
    .from('vault_documents')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
