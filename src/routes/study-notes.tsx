import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createStudyNote,
  deleteStudyNote,
  getOrCreateClientId,
  setStudyNotesClientId,
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
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function MarkdownPreview({ value }: { value: string }) {
  return (
    <div className="notebook">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || "_(誘몃━蹂닿린)_"}</ReactMarkdown>
    </div>
  );
}

function StudyNotesRoute() {
  const [clientId, setClientId] = React.useState(() => getOrCreateClientId());
  const [notes, setNotes] = React.useState<StudyNote[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [syncKey, setSyncKey] = React.useState(() => clientId);
  const [syncSaving, setSyncSaving] = React.useState(false);
  const [syncOpen, setSyncOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newContent, setNewContent] = React.useState("");

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState("");
  const [editingContent, setEditingContent] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const next = await listStudyNotes(clientId);
      setNotes(next);
      setSelectedId((prev) => prev ?? next[0]?.id ?? null);
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

  React.useEffect(() => {
    setSyncKey(clientId);
  }, [clientId]);

  function generateSyncKey() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `cid_${Date.now()}`;
  }

  async function onSaveSyncKey(): Promise<boolean> {
    const next = syncKey.trim();
    if (!next) {
      toast.error("동기화 키를 입력해 주세요.");
      return false;
    }

    setSyncSaving(true);
    try {
      const saved = await setStudyNotesClientId(next);
      setClientId(saved);
      toast.success("동기화 키를 저장했어요. 이 브라우저의 노트가 해당 키로 연결됩니다.");
      setLoading(true);
      setErrorMessage(null);
      try {
        const nextNotes = await listStudyNotes(saved);
        setNotes(nextNotes);
      } finally {
        setLoading(false);
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "동기화 키 저장에 실패했어요.");
      return false;
    } finally {
      setSyncSaving(false);
    }
  }

  async function onCreate() {
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
    setSelectedId(note.id);
    setEditingId(note.id);
    setEditingTitle(note.title ?? "");
    setEditingContent(note.content);
  }

  async function onSaveEdit() {
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
    setSaving(true);
    try {
      await deleteStudyNote(id);
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        setSelectedId((current) => {
          if (current !== id) return current;
          return next[0]?.id ?? null;
        });
        return next;
      });
      if (editingId === id) setEditingId(null);
      setDeleteConfirmOpen(false);
      toast.success("노트를 삭제했어요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "노트 삭제에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  const selectedNote = React.useMemo(() => {
    if (!selectedId) return null;
    return notes.find((n) => n.id === selectedId) ?? null;
  }, [notes, selectedId]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Header />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 pb-32 pt-6 sm:pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">학습 노트</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Markdown으로 작성하고, 나만의 복습 자료를 만들어 보세요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsAddOpen((v) => !v)} disabled={saving}>
              노트 추가하기
            </Button>
            <Button variant="outline" onClick={() => setSyncOpen(true)} disabled={saving}>
              동기화
            </Button>
            <Button variant="outline" onClick={() => void refresh()} disabled={saving || loading}>
              새로고침
            </Button>
          </div>
        </div>

        <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>노트 동기화</DialogTitle>
              <DialogDescription>
                같은 동기화 키를 입력한 브라우저들끼리 동일한 노트를 공유합니다. (키는 길고 랜덤하게
                생성하는 걸 권장)
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Input
                value={syncKey}
                onChange={(e) => setSyncKey(e.target.value)}
                disabled={syncSaving || saving}
              />
              <p className="text-xs text-muted-foreground">현재 키: {clientId}</p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSyncKey(generateSyncKey())}
                disabled={syncSaving || saving}
              >
                새로 생성
              </Button>
              <Button
                type="button"
                onClick={() =>
                  void (async () => {
                    const ok = await onSaveSyncKey();
                    if (ok) setSyncOpen(false);
                  })()
                }
                disabled={syncSaving || saving}
              >
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isAddOpen && (
          <Card className="border bg-card shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg">새 노트</CardTitle>
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
              </div>
              <p className="text-sm text-muted-foreground">내용은 Markdown으로 입력할 수 있어요.</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
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
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder={
                      "예:\n- 오늘 배운 표현\n- 헷갈렸던 발음\n\n**Tip:** 내일 다시 복습하기"
                    }
                    className="min-h-[400px]"
                    disabled={saving}
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-2">
                  <MarkdownPreview value={newContent} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {errorMessage && (
          <Card className="border bg-card shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base sm:text-lg">학습 노트를 불러올 수 없어요</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cloudflare Workers라면 `Settings → Variables`에서 `SUPABASE_URL`(vars)과
                `SUPABASE_SERVICE_ROLE_KEY`(secret)를 설정했는지 확인해 주세요.
              </p>
              <p className="text-sm text-destructive">{errorMessage}</p>
            </CardHeader>
          </Card>
        )}

        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">불러오는 중…</p>
          ) : notes.length === 0 ? (
            <Card className="border bg-card shadow-sm">
              <CardHeader className="space-y-1">
                <CardTitle className="text-base sm:text-lg">노트가 없어요</CardTitle>
                <p className="text-sm text-muted-foreground">
                  오른쪽 상단의 “노트 추가하기”로 첫 노트를 작성해 보세요.
                </p>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-[320px_1fr]">
              <Card className="border bg-card shadow-sm">
                <CardHeader className="space-y-1 pb-3">
                  <CardTitle className="text-base sm:text-lg">리스트</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    항목을 클릭하면 상세를 볼 수 있어요.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-1">
                  {notes.map((note) => {
                    const isSelected = selectedId === note.id;
                    return (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(note.id);
                          setEditingId(null);
                        }}
                        className={[
                          "w-full rounded-md px-3 py-2 text-left transition-colors",
                          "hover:bg-muted/70",
                          isSelected ? "bg-muted" : "bg-transparent",
                        ].join(" ")}
                      >
                        <div className="truncate text-sm font-medium text-foreground">
                          {note.title?.trim() ? note.title : "제목 없음"}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatShortDate(note.created_at)}
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border bg-card shadow-sm">
                <CardHeader className="space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base sm:text-lg">
                        {selectedNote?.title?.trim()
                          ? selectedNote.title
                          : selectedNote
                            ? "제목 없음"
                            : "상세"}
                      </CardTitle>
                      {selectedNote ? (
                        <p className="text-xs text-muted-foreground">
                          {formatShortDate(selectedNote.created_at)}
                        </p>
                      ) : null}
                    </div>

                    {selectedNote ? (
                      <div className="flex items-center gap-2">
                        {editingId === selectedNote.id ? (
                          <>
                            <Button size="sm" onClick={onSaveEdit} disabled={saving}>
                              저장
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                              disabled={saving}
                            >
                              취소
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(selectedNote)}
                              disabled={saving}
                            >
                              수정
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteConfirmOpen(true)}
                              disabled={saving}
                            >
                              삭제
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent>
                  {!selectedNote ? (
                    <p className="text-sm text-muted-foreground">
                      왼쪽 리스트에서 노트를 선택해 주세요.
                    </p>
                  ) : editingId === selectedNote.id ? (
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
                            className="min-h-[400px]"
                            disabled={saving}
                          />
                        </TabsContent>
                        <TabsContent value="preview" className="mt-2">
                          <MarkdownPreview value={editingContent} />
                        </TabsContent>
                      </Tabs>
                    </div>
                  ) : (
                    <MarkdownPreview value={selectedNote.content} />
                  )}

                  {selectedNote ? (
                    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription>
                            이 작업은 되돌릴 수 없습니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={saving}>취소</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void onDelete(selectedNote.id)}
                            disabled={saving}
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
