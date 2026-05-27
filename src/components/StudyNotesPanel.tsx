import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  createStudyNote,
  deleteStudyNote,
  getOrCreateClientId,
  listStudyNotes,
  updateStudyNote,
  type StudyNote,
} from "@/lib/studyNotes";

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(date);
}

export function StudyNotesPanel() {
  const [clientId] = React.useState(() => getOrCreateClientId());
  const [notes, setNotes] = React.useState<StudyNote[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [newTitle, setNewTitle] = React.useState("");
  const [newContent, setNewContent] = React.useState("");

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState("");
  const [editingContent, setEditingContent] = React.useState("");

  const refresh = React.useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const next = await listStudyNotes(clientId);
      setNotes(next);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load notes.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate() {
    if (!isSupabaseConfigured) return;
    const content = newContent.trim();
    if (!content) {
      toast.error("노트 내용을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const created = await createStudyNote({ clientId, title: newTitle, content });
      setNotes((prev) => [created, ...prev]);
      setNewTitle("");
      setNewContent("");
      toast.success("노트를 추가했어요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "노트 추가에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(note: StudyNote) {
    setEditingId(note.id);
    setEditingTitle(note.title ?? "");
    setEditingContent(note.content);
  }

  async function onSaveEdit() {
    if (!isSupabaseConfigured) return;
    if (!editingId) return;
    const content = editingContent.trim();
    if (!content) {
      toast.error("노트 내용을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateStudyNote({ id: editingId, title: editingTitle, content });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setEditingId(null);
      toast.success("노트를 저장했어요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "노트 저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!isSupabaseConfigured) return;
    setSaving(true);
    try {
      await deleteStudyNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (editingId === id) setEditingId(null);
      toast.success("노트를 삭제했어요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "노트 삭제에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base sm:text-lg">학습 노트</CardTitle>
        <p className="text-sm text-muted-foreground">오늘 배운 내용을 짧게 적어두면 복습이 쉬워요.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSupabaseConfigured && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            Supabase 설정이 필요해요. `.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 추가한 뒤 다시 실행해
            주세요.
          </div>
        )}

        {isSupabaseConfigured && (
          <div className="grid gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="제목 (선택)"
              disabled={saving}
            />
            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="예) 오늘은 인사 표현과 숫자 읽기를 배웠다…"
              className="min-h-[92px]"
              disabled={saving}
            />
            <div className="flex items-center gap-2">
              <Button onClick={onCreate} disabled={saving}>
                노트 추가
              </Button>
              <Button variant="outline" onClick={() => void refresh()} disabled={saving || loading}>
                새로고침
              </Button>
              {loading && <span className="text-xs text-muted-foreground">불러오는 중…</span>}
            </div>
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          </div>
        )}

        {isSupabaseConfigured && (
          <div className="space-y-3">
            {notes.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground">아직 노트가 없어요. 첫 노트를 추가해 보세요.</p>
            ) : (
              notes.map((note) => {
                const isEditing = editingId === note.id;
                return (
                  <div key={note.id} className="rounded-xl border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {note.title?.trim() ? note.title : "제목 없음"}
                          </p>
                          <span className="text-xs text-muted-foreground">{formatShortDate(note.created_at)}</span>
                        </div>
                        {!isEditing && <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{note.content}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={onSaveEdit} disabled={saving}>
                              저장
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
                              취소
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => startEdit(note)} disabled={saving}>
                              수정
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void onDelete(note.id)}
                              disabled={saving}
                            >
                              삭제
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-3 grid gap-2">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          placeholder="제목 (선택)"
                          disabled={saving}
                        />
                        <Textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="min-h-[92px]"
                          disabled={saving}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

