import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { useBookmarks } from "@/hooks/useBookmarks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDialogueAudioPath, getVocabAudioPath } from "@/lib/getAudioPath";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Bookmark, Pause, Play, Volume2 } from "lucide-react";
import { type BookmarkItem } from "@/lib/bookmarks";

export const Route = createFileRoute("/study/bookmarks")({
  head: () => ({
    meta: [
      { title: "북마크 복습 - 네팔어 학습" },
      { name: "description", content: "북마크한 단어/대화문만 모아 복습" },
    ],
  }),
  component: BookmarksPage,
});

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getBookmarkAudio(item: BookmarkItem) {
  const itemId = `bm-${item.id}`;
  const src =
    item.kind === "vocab"
      ? getVocabAudioPath(item.lessonId, item.romanized ?? "")
      : typeof item.dIdx === "number" && typeof item.lIdx === "number"
        ? getDialogueAudioPath(item.lessonId, item.dIdx, item.lIdx)
        : null;
  const canPlay = Boolean(src && (item.kind !== "vocab" || (item.romanized ?? "").length > 0));
  return { itemId, src, canPlay };
}

function BookmarksPage() {
  const audioPlayer = useAudioPlayer();
  const bookmarks = useBookmarks();

  const [kind, setKind] = useState<"all" | "vocab" | "dialogue">("all");
  const [mode, setMode] = useState<"list" | "quiz">("list");

  const filtered = useMemo(() => {
    if (kind === "all") return bookmarks.list;
    return bookmarks.list.filter((b) => b.kind === kind);
  }, [bookmarks.list, kind]);

  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<(boolean | null)[]>([]);

  const total = mode === "quiz" ? order.length : filtered.length;
  const current = mode === "quiz" ? filtered[order[idx] ?? 0] : null;
  const isQuizFinished =
    mode === "quiz" && total > 0 && answered.length === total && answered.every((v) => v !== null);
  const wrongCount = isQuizFinished ? answered.filter((v) => v === false).length : 0;

  const startQuiz = () => {
    const indices = shuffle(filtered.map((_, i) => i));
    setOrder(indices);
    setIdx(0);
    setRevealed(false);
    setScore(0);
    setAnswered(Array(indices.length).fill(null));
    setMode("quiz");
  };

  const startQuizWithOrder = (nextOrder: number[]) => {
    setOrder(nextOrder);
    setIdx(0);
    setRevealed(false);
    setScore(0);
    setAnswered(Array(nextOrder.length).fill(null));
    setMode("quiz");
  };

  const exitQuiz = () => {
    setMode("list");
    setOrder([]);
    setIdx(0);
    setRevealed(false);
    setScore(0);
    setAnswered([]);
  };

  const retryWrongOnly = () => {
    if (!isQuizFinished) return;
    const wrongOrder = order.filter((_, pos) => answered[pos] === false);
    if (wrongOrder.length === 0) return;
    startQuizWithOrder(wrongOrder);
  };

  const mark = (isCorrect: boolean) => {
    if (isCorrect && current) {
      const { itemId, src, canPlay } = getBookmarkAudio(current);
      if (canPlay && src) {
        void audioPlayer.play(itemId, src, { silentError: true });
      }
    }
    setAnswered((prev) => {
      const next = prev.length === order.length ? [...prev] : Array(order.length).fill(null);
      const prevVal = next[idx] ?? null;
      next[idx] = isCorrect;
      if (prevVal !== true && isCorrect) setScore((s) => s + 1);
      if (prevVal === true && !isCorrect) setScore((s) => Math.max(0, s - 1));
      return next;
    });
    setRevealed(false);
    if (idx + 1 >= order.length) return;
    setIdx((c) => c + 1);
  };

  const goPrev = () => {
    if (idx <= 0) return;
    setIdx((c) => c - 1);
    setRevealed(false);
  };

  const goNext = () => {
    if (idx + 1 >= order.length) return;
    setIdx((c) => c + 1);
    setRevealed(false);
  };

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <div className="mb-6">
          <Link to="/" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 홈
          </Link>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">북마크 복습</h1>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {filtered.length}개
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            레슨 단어장/대화문에서 저장한 항목만 모아 복습해요.
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-xl bg-secondary p-1">
            <button
              type="button"
              onClick={() => setKind("all")}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm",
                kind === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setKind("vocab")}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm",
                kind === "vocab" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              단어
            </button>
            <button
              type="button"
              onClick={() => setKind("dialogue")}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm",
                kind === "dialogue" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              대화문
            </button>
          </div>

          {mode === "list" ? (
            <Button onClick={startQuiz} disabled={filtered.length === 0} className="rounded-xl">
              퀴즈로 복습
            </Button>
          ) : isQuizFinished ? (
            <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-sm">
              <div className="text-center">
                <div className="text-sm font-semibold text-muted-foreground">결과</div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-foreground">
                  {score} / {total}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">오답 {wrongCount}개</div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  onClick={retryWrongOnly}
                  disabled={wrongCount === 0}
                  className="h-12 rounded-2xl bg-[#6B7A5A] text-white hover:bg-[#5E6C4F]"
                >
                  틀린 것만 다시하기
                </Button>
                <Button variant="secondary" onClick={startQuiz} className="h-12 rounded-2xl">
                  전체 다시하기
                </Button>
              </div>

              <div className="mt-3 flex justify-center">
                <Button variant="outline" onClick={exitQuiz} className="rounded-xl">
                  목록으로
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={exitQuiz} className="rounded-xl">
              목록으로
            </Button>
          )}
        </div>

        {mode === "quiz" ? (
          total === 0 || !current ? (
            <div className="rounded-2xl border bg-card p-8 sm:p-12 text-center shadow-sm">
              <p className="text-sm sm:text-base text-muted-foreground">북마크한 항목이 없습니다.</p>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {idx + 1} / {total}
                </span>
                <span className="rounded-full bg-warm/50 px-2.5 py-1 text-xs sm:text-sm font-medium text-warm-foreground">
                  점수: {score}
                </span>
              </div>

              <div className="mb-4 rounded-2xl border bg-muted/30 p-4 sm:p-5 text-center">
                <div className="text-xs font-semibold text-muted-foreground">문제</div>
                <div className="mt-2 text-xl sm:text-2xl font-bold text-foreground break-keep">
                  {current.korean}
                </div>
                {current.kind === "dialogue" && current.speaker ? (
                  <div className="mt-2 text-xs text-muted-foreground">Speaker {current.speaker}</div>
                ) : null}
              </div>

              {revealed ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-muted-foreground">정답</div>
                        <div className="mt-1 text-2xl sm:text-3xl font-black text-foreground break-keep" style={{ fontFamily: "var(--font-nepali)" }}>
                          {current.nepali}
                        </div>
                        {current.romanized ? (
                          <div className="mt-1 text-sm italic text-muted-foreground">{current.romanized}</div>
                        ) : null}
                      </div>
                      {(() => {
                        const { itemId, src, canPlay } = getBookmarkAudio(current);
                        const isPlaying = audioPlayer.currentItemId === itemId && audioPlayer.isPlaying;
                        if (!canPlay) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => src && void audioPlayer.play(itemId, src, { silentError: true })}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white text-[#6B7A5A] shadow-sm transition-all hover:bg-[#6B7A5A]/10 active:scale-95"
                            aria-label="음성 재생"
                          >
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => mark(true)} className="h-12 rounded-2xl bg-[#6B7A5A] text-white hover:bg-[#5E6C4F]">
                      맞혔어요
                    </Button>
                    <Button onClick={() => mark(false)} variant="secondary" className="h-12 rounded-2xl">
                      틀렸어요
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={goPrev} disabled={idx === 0} className="h-11 rounded-2xl">
                      이전
                    </Button>
                    <Button variant="secondary" onClick={goNext} disabled={idx + 1 >= total} className="h-11 rounded-2xl">
                      다음
                    </Button>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => bookmarks.toggle(current)}
                      className="rounded-xl gap-2"
                    >
                      <Bookmark className="h-4 w-4 fill-current" />
                      북마크 해제
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground text-center">
                    네팔어를 떠올린 뒤 정답을 확인하세요.
                  </div>
                  <Button onClick={() => setRevealed(true)} className="h-14 w-full rounded-3xl bg-[#7A5C45] text-base font-bold text-white shadow-md hover:bg-[#6A4D3A] active:scale-[0.99]">
                    정답 확인
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={goPrev} disabled={idx === 0} className="h-10 rounded-2xl">
                      이전
                    </Button>
                    <Button variant="secondary" onClick={goNext} disabled={idx + 1 >= total} className="h-10 rounded-2xl">
                      다음
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 sm:p-12 text-center shadow-sm">
            <p className="text-sm sm:text-base text-muted-foreground">북마크한 항목이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {filtered.map((b) => {
              const { itemId, src, canPlay } = getBookmarkAudio(b);
              const isPlaying = audioPlayer.currentItemId === itemId && audioPlayer.isPlaying;
              return (
                <div key={b.id} className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-muted-foreground">
                        {b.kind === "vocab" ? `레슨 ${b.lessonId} · 단어` : `레슨 ${b.lessonId} · 대화문`}
                      </div>
                      <div className="mt-1 text-base font-semibold text-foreground break-keep">{b.korean}</div>
                      <div className="mt-1 text-sm text-foreground break-keep" style={{ fontFamily: "var(--font-nepali)" }}>
                        {b.nepali}
                      </div>
                      {b.romanized ? <div className="mt-0.5 text-xs italic text-muted-foreground">{b.romanized}</div> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {canPlay && src ? (
                        <button
                          type="button"
                          onClick={() => src && void audioPlayer.play(itemId, src, { silentError: true })}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-accent active:scale-95 transition-all"
                          aria-label="음성 재생"
                        >
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => bookmarks.toggle(b)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
                        aria-label="북마크 해제"
                      >
                        <Bookmark className="h-4 w-4 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
