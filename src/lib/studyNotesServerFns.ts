import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";

function normalizeClientId(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 128) throw new Error("Client id is too long (max 128 characters).");
  return trimmed;
}

function getServerClientId(fallbackClientId?: string) {
  const existing = getCookie("nb_cid");
  if (existing) return existing;
  const normalizedFallback = normalizeClientId(fallbackClientId);
  const created =
    normalizedFallback && normalizedFallback.length <= 128
      ? normalizedFallback
      : typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `cid_${Date.now()}`;
  setCookie("nb_cid", created, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return created;
}

export const setStudyNotesClientIdServer = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId: string }) => data)
  .handler(async ({ data: input }) => {
    const clientId = normalizeClientId(input.clientId);
    if (!clientId) throw new Error("Client id is required.");

    setCookie("nb_cid", clientId, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });

    return { clientId };
  });

async function getAdminSupabase() {
  const runtimeEnv =
    (typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : undefined) ?? {};

  let cloudflareEnv: Record<string, string | undefined> = {};
  try {
    const mod = (await import("cloudflare:workers")) as unknown as { env?: Record<string, string | undefined> };
    cloudflareEnv = mod.env ?? {};
  } catch {}

  const read = (key: string) => runtimeEnv[key] ?? cloudflareEnv[key];

  const url = read("SUPABASE_URL") ?? read("VITE_SUPABASE_URL");
  const serviceKey = read("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error(
      "서버 Supabase 설정이 없어요. `.env`에 `SUPABASE_URL`(또는 `VITE_SUPABASE_URL`)과 `SUPABASE_SERVICE_ROLE_KEY`를 설정해 주세요."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const listStudyNotesServer = createServerFn({ method: "GET" })
  .inputValidator((data: { clientId?: string } | undefined) => data)
  .handler(async ({ data: input }) => {
  const supabase = await getAdminSupabase();
  const clientId = getServerClientId(input?.clientId);

  const { data: rows, error } = await supabase
    .from("study_notes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return rows ?? [];
});

export const createStudyNoteServer = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId?: string; title?: string; content: string }) => data)
  .handler(async ({ data: input }) => {
    const supabase = await getAdminSupabase();
    const clientId = getServerClientId(input.clientId);

    const { data: created, error } = await supabase
      .from("study_notes")
      .insert({
        client_id: clientId,
        title: input.title?.trim() ? input.title.trim() : null,
        content: input.content.trim(),
      })
      .select("*")
      .single();

    if (error) throw error;
    return created;
  });

export const updateStudyNoteServer = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId?: string; id: string; title?: string; content: string }) => data)
  .handler(async ({ data: input }) => {
    const supabase = await getAdminSupabase();
    const clientId = getServerClientId(input.clientId);

    const { data: updated, error } = await supabase
      .from("study_notes")
      .update({
        title: input.title?.trim() ? input.title.trim() : null,
        content: input.content.trim(),
      })
      .eq("id", input.id)
      .eq("client_id", clientId)
      .select("*")
      .single();

    if (error) throw error;
    return updated;
  });

export const deleteStudyNoteServer = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId?: string; id: string }) => data)
  .handler(async ({ data: input }) => {
    const supabase = await getAdminSupabase();
    const clientId = getServerClientId(input.clientId);

    const { error } = await supabase.from("study_notes").delete().eq("id", input.id).eq("client_id", clientId);
    if (error) throw error;
    return { ok: true };
  });
