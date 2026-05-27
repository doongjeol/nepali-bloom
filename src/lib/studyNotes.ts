import {
  createStudyNoteServer,
  deleteStudyNoteServer,
  listStudyNotesServer,
  setStudyNotesClientIdServer,
  updateStudyNoteServer,
} from "@/lib/studyNotesServerFns";

export type StudyNote = {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string;
  title: string | null;
  content: string;
};

const CLIENT_ID_STORAGE_KEY = "nepali_bloom_client_id";

export function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;
  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `cid_${Date.now()}`;
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
  return created;
}

export function setClientId(value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, value);
}

export async function setStudyNotesClientId(clientId: string): Promise<string> {
  const normalized = clientId.trim();
  if (!normalized) throw new Error("Client id is required.");
  const res = await setStudyNotesClientIdServer({ data: { clientId: normalized } });
  const next = (res as { clientId: string } | undefined)?.clientId ?? normalized;
  setClientId(next);
  return next;
}

export async function listStudyNotes(clientId: string): Promise<StudyNote[]> {
  const data = await listStudyNotesServer({ data: { clientId } });
  return (data ?? []) as StudyNote[];
}

export async function createStudyNote(input: {
  clientId: string;
  title?: string;
  content: string;
}): Promise<StudyNote> {
  const created = await createStudyNoteServer({
    data: { clientId: input.clientId, title: input.title, content: input.content },
  });
  return created as StudyNote;
}

export async function updateStudyNote(input: {
  id: string;
  title?: string;
  content: string;
}): Promise<StudyNote> {
  const clientId = getOrCreateClientId();
  const updated = await updateStudyNoteServer({
    data: { clientId, id: input.id, title: input.title, content: input.content },
  });
  return updated as StudyNote;
}

export async function deleteStudyNote(id: string): Promise<void> {
  const clientId = getOrCreateClientId();
  await deleteStudyNoteServer({ data: { clientId, id } });
}
