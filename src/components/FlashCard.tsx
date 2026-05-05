import { useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { getVocabAudioPath } from "@/lib/getAudioPath";
import type { Vocabulary } from "@/data/lesson";

export type StudyWord = {
  id: string; // `${lessonId}:${vocabIndex}`
  lessonId: number;
  vocabIndex: number; // 0-based
  word: Vocabulary;
};

export function FlashCard({
  item,
  className,
}: {
  item: StudyWord;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const audioPlayer = useAudioPlayer();

  const audioSrc = useMemo(() => getVocabAudioPath(item.lessonId, String(item.vocabIndex)), [item.lessonId, item.vocabIndex]);
  const audioItemId = `study-vocab-${item.id}`;

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className="group relative w-full rounded-3xl border bg-card p-0 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
        style={{ perspective: "1000px" }}
      >
        <div
          className={cn(
            "relative h-48 w-full rounded-3xl transition-transform duration-500 [transform-style:preserve-3d]",
            flipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]",
          )}
        >
          {/* Front */}
          <div className="absolute inset-0 rounded-3xl p-5 [backface-visibility:hidden]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Lesson {item.lessonId}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                  {item.word.nepali}
                </p>
                <p className="mt-1 text-sm text-muted-foreground italic">{item.word.romanized}</p>
              </div>
              <button
                type="button"
                aria-label="단어 음성 재생"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background/60 text-foreground shadow-sm transition-colors hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  void audioPlayer.play(audioItemId, audioSrc);
                }}
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
            <p className="absolute bottom-4 left-5 text-xs text-muted-foreground">카드를 눌러 뒤집기</p>
          </div>

          {/* Back */}
          <div className="absolute inset-0 rounded-3xl p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-xs font-medium text-muted-foreground">뜻</p>
            <p className="mt-3 text-xl font-semibold text-foreground">{item.word.korean}</p>
            <p className="mt-2 text-sm text-muted-foreground italic">{item.word.romanized}</p>
            <p className="absolute bottom-4 left-5 text-xs text-muted-foreground">카드를 눌러 앞면으로</p>
          </div>
        </div>
      </button>
    </div>
  );
}

