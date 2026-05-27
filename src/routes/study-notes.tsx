import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/study-notes")({
  head: () => ({
    meta: [{ title: "학습 노트" }],
  }),
  component: StudyNotesRoute,
});

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

function MarkdownPreview({ value }: { value: string }) {
  return (
    <div className="notebook">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || "_(미리보기)_"}</ReactMarkdown>
    </div>
  );
}

function StudyNotesRoute() {
  const [clientId] = React.useState(() => getOrCreateClientId());
  const [notes, setNotes] = React.useState<StudyNote[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = React.useState(false);
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
      setIsAddOpen(false);
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
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Header />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 pb-32 pt-6 sm:pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">학습 노트</h1>
            <p className="mt-1 text-sm text-muted-foreground">Markdown으로 작성하고, 나만의 복습 자료를 만들어 보세요.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsAddOpen((v) => !v)} disabled={!isSupabaseConfigured || saving}>
              노트 추가하기
            </Button>
            <Button variant="outline" onClick={() => void refresh()} disabled={!isSupabaseConfigured || saving || loading}>
              새로고침
            </Button>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <Card className="border bg-card shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base sm:text-lg">Supabase 설정 필요</CardTitle>
              <p className="text-sm text-muted-foreground">
                `.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 추가해 주세요.
              </p>
            </CardHeader>
          </Card>
        )}

        {isSupabaseConfigured && isAddOpen && (
          <Card className="border bg-card shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base sm:text-lg">새 노트</CardTitle>
              <p className="text-sm text-muted-foreground">내용은 Markdown으로 입력할 수 있어요.</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="제목 (선택)" disabled={saving} />

              <Tabs defaultValue="write">
                <TabsList>
                  <TabsTrigger value="write">작성</TabsTrigger>
                  <TabsTrigger value="preview">미리보기</TabsTrigger>
                </TabsList>
                <TabsContent value="write" className="mt-2">
                  <Textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder={"예)\n- 오늘 배운 표현\n- 헷갈렸던 발음\n\n**Tip:** 내일 다시 복습하기"}
                    className="min-h-[180px]"
                    disabled={saving}
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-2 rounded-md border bg-background p-3">
                  <MarkdownPreview value={newContent} />
                </TabsContent>
              </Tabs>

              <div className="flex items-center gap-2">
                <Button onClick={onCreate} disabled={saving}>
                  추가
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddOpen(false);
                    setNewTitle("");
                    setNewContent("");
                  }}
                  disabled={saving}
                >
                  닫기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isSupabaseConfigured && errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

        {isSupabaseConfigured && (
          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            ) : notes.length === 0 ? (
              <Card className="border bg-card shadow-sm">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-base sm:text-lg">노트가 없어요</CardTitle>
                  <p className="text-sm text-muted-foreground">오른쪽 상단의 “노트 추가하기”로 첫 노트를 작성해 보세요.</p>
                </CardHeader>
              </Card>
            ) : (
              notes.map((note) => {
                const isEditing = editingId === note.id;
                return (
                  <Card key={note.id} className="border bg-card shadow-sm">
                    <CardHeader className="space-y-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base sm:text-lg">
                            {note.title?.trim() ? note.title : "제목 없음"}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">{formatShortDate(note.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
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
                              <Button size="sm" variant="destructive" onClick={() => void onDelete(note.id)} disabled={saving}>
                                삭제
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isEditing ? (
                        <div className="grid gap-3">
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            placeholder="제목 (선택)"
                            disabled={saving}
                          />
                          <Tabs defaultValue="write">
                            <TabsList>
                              <TabsTrigger value="write">작성</TabsTrigger>
                              <TabsTrigger value="preview">미리보기</TabsTrigger>
                            </TabsList>
                            <TabsContent value="write" className="mt-2">
                              <Textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                className="min-h-[180px]"
                                disabled={saving}
                              />
                            </TabsContent>
                            <TabsContent value="preview" className="mt-2 rounded-md border bg-background p-3">
                              <MarkdownPreview value={editingContent} />
                            </TabsContent>
                          </Tabs>
                        </div>
                      ) : (
                        <div className="rounded-md border bg-background p-3">
                          <MarkdownPreview value={note.content} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
