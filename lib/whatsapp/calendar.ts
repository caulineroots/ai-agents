/**
 * Google Calendar — OAuth2 + criação de eventos.
 * Tokens armazenados na tabela calendar_tokens do Supabase.
 *
 * Setup:
 * 1. Crie credenciais OAuth2 no Google Cloud Console (tipo "Web application")
 * 2. Adicione como redirect URI: https://seu-dominio.com/api/whatsapp/calendar-auth
 * 3. Preencha GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env.local
 * 4. (Opcional) GOOGLE_CALENDAR_ID — padrão: "primary"
 */

import { google } from 'googleapis';
import { supabase } from '@/lib/supabase/client';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_CALENDAR_REDIRECT_URI ??
  `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/whatsapp/calendar-auth`;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? 'primary';
const OWNER_PHONE = process.env.OWNER_PHONE ?? '';

function getOAuth2Client() {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// ─── URL de autorização ───────────────────────────────────────────────────────

export function getAuthUrl(): string | null {
  const auth = getOAuth2Client();
  if (!auth) return null;
  return auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  });
}

// ─── Troca código por tokens e salva no Supabase ──────────────────────────────

export async function handleCalendarCallback(code: string): Promise<boolean> {
  const auth = getOAuth2Client();
  if (!auth) return false;

  try {
    const { tokens } = await auth.getToken(code);
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    const { error } = await supabase.from('calendar_tokens').upsert(
      {
        owner_phone: OWNER_PHONE || 'default',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_phone' },
    );

    return !error;
  } catch (err) {
    console.error('[calendar] erro ao trocar código:', err);
    return false;
  }
}

// ─── Carrega cliente autenticado com refresh automático ──────────────────────

async function getAuthenticatedClient() {
  const auth = getOAuth2Client();
  if (!auth) return null;

  const { data, error } = await supabase
    .from('calendar_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('owner_phone', OWNER_PHONE || 'default')
    .single();

  if (error || !data) return null;

  auth.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expires_at ? new Date(data.expires_at).getTime() : undefined,
  });

  // Refresh automático se expirado
  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    try {
      const { credentials } = await auth.refreshAccessToken();
      await supabase
        .from('calendar_tokens')
        .update({
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('owner_phone', OWNER_PHONE || 'default');
      auth.setCredentials(credentials);
    } catch {
      return null;
    }
  }

  return auth;
}

// ─── Criar evento no Google Calendar ─────────────────────────────────────────

export async function criarEventoCalendar(
  titulo: string,
  data: string,            // "YYYY-MM-DD"
  descricao = '',
): Promise<string | null> {
  try {
    const auth = await getAuthenticatedClient();
    if (!auth) return null;

    const calendar = google.calendar({ version: 'v3', auth });

    const event = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: titulo,
        description: descricao || undefined,
        start: { date: data },
        end: { date: data },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 9 * 60 }, // 9h da manhã
          ],
        },
      },
    });

    return event.data.id ?? null;
  } catch (err) {
    console.error('[calendar] erro ao criar evento:', err);
    return null;
  }
}

// ─── Verificar se calendar está conectado ────────────────────────────────────

export async function calendarConectado(): Promise<boolean> {
  if (!CLIENT_ID || !CLIENT_SECRET) return false;
  const { data } = await supabase
    .from('calendar_tokens')
    .select('id')
    .eq('owner_phone', OWNER_PHONE || 'default')
    .single();
  return !!data;
}
