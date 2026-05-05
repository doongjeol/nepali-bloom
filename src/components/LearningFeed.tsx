import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { getVocabAudioPath, getDialogueAudioPath } from "@/lib/getAudioPath";
import { Heart, MessageCircle, Bookmark, Play, Volume2, ChevronUp } from "lucide-react";

import feedBg1 from "@/assets/feed-bg-1.jpg";
import feedBg2 from "@/assets/feed-bg-2.jpg";
import feedBg3 from "@/assets/feed-bg-3.jpg";
import feedBg4 from "@/assets/feed-bg-4.jpg";
import feedBg5 from "@/assets/feed-bg-5.jpg";
import feedBg6 from "@/assets/feed-bg-6.jpg";

const feedImages = [feedBg1, feedBg2, feedBg3, feedBg4, feedBg5, feedBg6];

interface VocabItem {
  nepali: string;
  romanized: string;
  korean: string;
}

interface DialogueLine {
  speaker: string;
  nepali: string;
  romanized: string;
  korean: string;
}

interface GrammarItem {
  text: string;
}

interface FeedPost {
  id: string;
  type: "vocab" | "dialogue" | "grammar";
  lessonId: number;
  lessonTitle: string;
  image: string;
  vocab?: VocabItem;
  dialogueLines?: DialogueLine[];
  dialogueTitle?: string;
  dialogueIndex?: number;
  grammar?: string;
}

interface StoryItem {
  id: string;
  type: "word" | "grammar";
  label: string;
  char: string;
  content: {
    nepali: string;
    romanized: string;
    korean: string;
  };
  lessonId: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateFeedData(lessons: any[]): { posts: FeedPost[]; stories: StoryItem[] } {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const rng = seededRandom(seed);

  const posts: FeedPost[] = [];
  const stories: StoryItem[] = [];

  for (const lesson of lessons) {
    if (!lesson) continue;
    const lid = lesson.id as number;
    const title = lesson.titleKo as string;

    // vocab posts
    const vocabArr = (lesson.vocabulary || []) as VocabItem[];
    for (const v of vocabArr) {
      posts.push({
        id: `v-${lid}-${v.romanized}`,
        type: "vocab",
        lessonId: lid,
        lessonTitle: title,
        image: feedImages[Math.floor(rng() * feedImages.length)]!,
        vocab: v,
      });
    }

    // dialogue posts
    const dialogues = (lesson.dialogues || []) as { title: string; lines: DialogueLine[] }[];
    dialogues.forEach((d, dIdx) => {
      if (d.lines.length >= 2) {
        posts.push({
          id: `d-${lid}-${dIdx}`,
          type: "dialogue",
          lessonId: lid,
          lessonTitle: title,
          image: feedImages[Math.floor(rng() * feedImages.length)]!,
          dialogueLines: d.lines.slice(0, 4),
          dialogueTitle: d.title,
          dialogueIndex: dIdx,
        });
      }
    });

    // grammar posts
    const grammars = (lesson.grammar || []) as string[];
    grammars.forEach((g, gIdx) => {
      posts.push({
        id: `g-${lid}-${gIdx}`,
        type: "grammar",
        lessonId: lid,
        lessonTitle: title,
        image: feedImages[Math.floor(rng() * feedImages.length)]!,
        grammar: g,
      });
    });

    // stories from vocab
    vocabArr.slice(0, 3).forEach((v, i) => {
      stories.push({
        id: `sw-${lid}-${i}`,
        type: "word",
        label: v.nepali.slice(0, 3),
        char: v.nepali.charAt(0),
        content: { nepali: v.nepali, romanized: v.romanized, korean: v.korean },
        lessonId: lid,
      });
    });

    // stories from grammar
    grammars.slice(0, 1).forEach((g, i) => {
      stories.push({
        id: `sg-${lid}-${i}`,
        type: "grammar",
        label: `문법 ${lid}`,
        char: "📝",
        content: { nepali: g.slice(0, 30), romanized: "", korean: g },
        lessonId: lid,
      });
    });
  }

  // shuffle posts with seed
  for (let i = posts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [posts[i], posts[j]] = [posts[j]!, posts[i]!];
  }

  return { posts: posts.slice(0, 30), stories: stories.slice(0, 20) };
}

// =================== Heart animation overlay ===================

function HeartBurst({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <Heart
        className="animate-[heartBurst_0.8s_ease-out_forwards] fill-red-500 text-red-500"
        size={80}
      />
    </div>
  );
}

// =================== Story bubble ===================

function StoryBubble({
  story,
  onClick,
  viewed,
}: {
  story: StoryItem;
  onClick: () => void;
  viewed: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 min-w-[68px]"
    >
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all",
          viewed
            ? "border-muted-foreground/30"
            : "border-transparent bg-gradient-to-br from-[#d4a373] via-[#b28471] to-[#556b2f] p-[2px]"
        )}
      >
        <div className="flex h-full w-full items-center justify-center rounded-full bg-card text-2xl"
          style={{ fontFamily: story.type === "word" ? "var(--font-nepali)" : undefined }}
        >
          {story.type === "word" ? story.char : story.char}
        </div>
      </div>
      <span className="max-w-[64px] truncate text-[10px] text-muted-foreground">
        {story.type === "word" ? "오늘의 단어" : story.label}
      </span>
    </button>
  );
}

// =================== Story modal overlay ===================

function StoryModal({
  story,
  onClose,
}: {
  story: StoryItem;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 5000;
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / duration, 1));
      if (elapsed < duration) raf = requestAnimationFrame(tick);
      else onClose();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" onClick={onClose}>
      {/* progress bar */}
      <div className="absolute left-4 right-4 top-12 h-[3px] rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white transition-none" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="text-center px-8" onClick={(e) => e.stopPropagation()}>
        <p className="text-5xl font-extrabold text-white mb-4" style={{ fontFamily: "var(--font-nepali)" }}>
          {story.content.nepali}
        </p>
        {story.content.romanized && (
          <p className="text-lg text-white/70 italic mb-2">{story.content.romanized}</p>
        )}
        <p className="text-xl text-white/90">{story.content.korean}</p>
        <p className="mt-6 text-sm text-white/40">제{story.lessonId}과</p>
      </div>
    </div>
  );
}

// =================== Post card ===================

function FeedPostCard({
  post,
  audioPlayer,
}: {
  post: FeedPost;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
}) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [memo, setMemo] = useState("");
  const [showBurst, setShowBurst] = useState(false);
  const lastTap = useRef(0);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setLiked(true);
      setShowBurst(true);
    }
    lastTap.current = now;
  }, []);

  const handleLike = useCallback(() => {
    setLiked((p) => {
      if (!p) setShowBurst(true);
      return !p;
    });
  }, []);

  return (
    <article className="border-b border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#d4a373] to-[#b28471] text-sm font-bold text-white">
          {post.lessonId}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{post.lessonTitle}</p>
          <p className="text-xs text-muted-foreground">
            {post.type === "vocab" ? "단어 학습" : post.type === "dialogue" ? "대화문" : "문법 포인트"}
          </p>
        </div>
        {post.type === "vocab" && (
          <button
            type="button"
            onClick={() => audioPlayer.play(`feed-${post.id}`, getVocabAudioPath(post.lessonId, post.vocab!.romanized), { silentError: true })}
            className="rounded-full p-2 text-muted-foreground hover:text-foreground active:scale-90 transition-all"
          >
            <Volume2 size={18} />
          </button>
        )}
      </div>

      {/* Image + content overlay */}
      <div className="relative" onClick={handleDoubleTap}>
        <img
          src={post.image}
          alt=""
          loading="lazy"
          className="aspect-square w-full object-cover"
          width={1080}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Text overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          {post.type === "vocab" && post.vocab && (
            <div>
              <p className="text-4xl font-extrabold text-white drop-shadow-lg" style={{ fontFamily: "var(--font-nepali)" }}>
                {post.vocab.nepali}
              </p>
              <p className="mt-1 text-lg text-white/80 italic">{post.vocab.romanized}</p>
              <p className="mt-1 text-base text-white/90">{post.vocab.korean}</p>
            </div>
          )}
          {post.type === "dialogue" && post.dialogueLines && (
            <div className="space-y-2">
              {post.dialogueLines.map((line, i) => (
                <div key={i} className={cn("flex gap-2 items-start", line.speaker === "B" && "pl-6")}>
                  <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold text-white">{line.speaker}</span>
                  <div>
                    <p className="text-base font-semibold text-white" style={{ fontFamily: "var(--font-nepali)" }}>{line.nepali}</p>
                    <p className="text-xs text-white/60">{line.korean}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {post.type === "grammar" && post.grammar && (
            <p className="text-base leading-relaxed text-white">{post.grammar}</p>
          )}
        </div>

        {showBurst && <HeartBurst onDone={() => setShowBurst(false)} />}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-4 px-4 py-3">
        <button type="button" onClick={handleLike} className="active:scale-[1.3] transition-transform">
          <Heart size={24} className={cn("transition-colors", liked ? "fill-red-500 text-red-500" : "text-foreground")} />
        </button>
        <button type="button" onClick={() => setShowMemo((p) => !p)} className="active:scale-[1.3] transition-transform">
          <MessageCircle size={24} className="text-foreground" />
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => setBookmarked((p) => !p)} className="active:scale-[1.3] transition-transform">
          <Bookmark size={24} className={cn("transition-colors", bookmarked ? "fill-foreground text-foreground" : "text-foreground")} />
        </button>
      </div>

      {/* Like count */}
      <div className="px-4 pb-1">
        <p className="text-sm font-semibold text-foreground">
          {liked ? "암기 완료 ✓" : "더블 탭하여 암기 완료"}
        </p>
      </div>

      {/* Memo area */}
      {showMemo && (
        <div className="px-4 pb-3">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모를 작성하세요..."
            className="w-full rounded-xl border bg-secondary/50 p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            rows={2}
          />
        </div>
      )}

      <div className="h-1" />
    </article>
  );
}

// =================== Reels Mode ===================

function ReelsMode({
  posts,
  onClose,
}: {
  posts: FeedPost[];
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioPlayer = useAudioPlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const vocabPosts = useMemo(() => posts.filter((p) => p.type === "vocab" || p.type === "dialogue"), [posts]);
  const current = vocabPosts[currentIndex];

  useEffect(() => {
    if (!current) return;
    if (current.type === "vocab" && current.vocab) {
      audioPlayer.play(`reel-${current.id}`, getVocabAudioPath(current.lessonId, current.vocab.romanized), { silentError: true });
    } else if (current.type === "dialogue" && current.dialogueLines?.[0]) {
      audioPlayer.play(`reel-${current.id}`, getDialogueAudioPath(current.lessonId, current.dialogueIndex ?? 0, 0), { silentError: true });
    }
  }, [currentIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((p) => Math.min(p + 1, vocabPosts.length - 1));
  }, [vocabPosts.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((p) => Math.max(p - 1, 0));
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]!.clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartY.current - e.changedTouches[0]!.clientY;
    if (diff > 50) goNext();
    else if (diff < -50) goPrev();
  }, [goNext, goPrev]);

  if (!current) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[90] bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background image */}
      <img
        src={current.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute left-4 top-12 z-10 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm"
      >
        ✕ 닫기
      </button>

      {/* Progress dots */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5">
        {vocabPosts.slice(0, 15).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all",
              i === currentIndex ? "bg-white scale-150" : "bg-white/30"
            )}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
        {current.type === "vocab" && current.vocab && (
          <>
            <p className="text-6xl font-extrabold text-white mb-4" style={{ fontFamily: "var(--font-nepali)" }}>
              {current.vocab.nepali}
            </p>
            <p className="text-2xl text-white/70 italic mb-2">{current.vocab.romanized}</p>
            <p className="text-xl text-white/90">{current.vocab.korean}</p>
          </>
        )}
        {current.type === "dialogue" && current.dialogueLines && (
          <div className="space-y-4 w-full max-w-sm">
            {current.dialogueLines.map((line, i) => (
              <div key={i} className={cn("text-left", line.speaker === "B" && "pl-8")}>
                <span className="text-xs font-bold text-white/50">{line.speaker}</span>
                <p className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-nepali)" }}>{line.nepali}</p>
                <p className="text-sm text-white/60">{line.korean}</p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-sm text-white/40">{current.lessonTitle}</p>
      </div>

      {/* Swipe hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center text-white/40 animate-bounce">
        <ChevronUp size={24} />
        <span className="text-xs">스와이프하여 다음</span>
      </div>

      {/* Side actions */}
      <div className="absolute bottom-24 right-4 flex flex-col gap-6 items-center">
        <button type="button" className="flex flex-col items-center gap-1" onClick={() => {
          if (current.type === "vocab" && current.vocab) {
            audioPlayer.play(`reel-${current.id}`, getVocabAudioPath(current.lessonId, current.vocab.romanized), { silentError: true });
          }
        }}>
          <div className="rounded-full bg-white/10 p-3 backdrop-blur-sm">
            <Play size={20} className="text-white" />
          </div>
          <span className="text-[10px] text-white/60">재생</span>
        </button>
        <button type="button" className="flex flex-col items-center gap-1">
          <div className="rounded-full bg-white/10 p-3 backdrop-blur-sm">
            <Heart size={20} className="text-white" />
          </div>
          <span className="text-[10px] text-white/60">암기</span>
        </button>
        <button type="button" className="flex flex-col items-center gap-1">
          <div className="rounded-full bg-white/10 p-3 backdrop-blur-sm">
            <Bookmark size={20} className="text-white" />
          </div>
          <span className="text-[10px] text-white/60">저장</span>
        </button>
      </div>
    </div>
  );
}

// =================== Main component ===================

export function LearningFeed({ lessons }: { lessons: any[] }) {
  const audioPlayer = useAudioPlayer();
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set());
  const [showReels, setShowReels] = useState(false);

  const { posts, stories } = useMemo(() => generateFeedData(lessons), [lessons]);

  const handleStoryClick = useCallback((story: StoryItem) => {
    setActiveStory(story);
    setViewedStories((prev) => new Set([...prev, story.id]));
  }, []);

  return (
    <>
      <div className="mx-auto max-w-lg bg-background min-h-screen">
        {/* Stories row */}
        <div className="border-b border-border bg-card px-3 py-3">
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {/* Reels button */}
            <button
              type="button"
              onClick={() => setShowReels(true)}
              className="flex flex-col items-center gap-1 min-w-[68px]"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#d4a373] bg-gradient-to-br from-[#d4a373]/20 to-[#b28471]/20">
                <Play size={24} className="text-[#d4a373]" />
              </div>
              <span className="text-[10px] font-semibold text-[#d4a373]">릴스</span>
            </button>

            {stories.map((story) => (
              <StoryBubble
                key={story.id}
                story={story}
                onClick={() => handleStoryClick(story)}
                viewed={viewedStories.has(story.id)}
              />
            ))}
          </div>
        </div>

        {/* Feed posts */}
        <div>
          {posts.map((post) => (
            <FeedPostCard key={post.id} post={post} audioPlayer={audioPlayer} />
          ))}
        </div>

        {/* Bottom spacer for tab bar */}
        <div className="h-20" />
      </div>

      {/* Story overlay */}
      {activeStory && (
        <StoryModal story={activeStory} onClose={() => setActiveStory(null)} />
      )}

      {/* Reels overlay */}
      {showReels && (
        <ReelsMode posts={posts} onClose={() => setShowReels(false)} />
      )}
    </>
  );
}
