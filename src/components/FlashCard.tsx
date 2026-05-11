import { useMemo, useState } from "react";
import { Play, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { getExampleAudioPath, getVocabAudioPath } from "@/lib/getAudioPath";
import type { Vocabulary } from "@/data/lesson";

export type StudyWord = {
  id: string; // `${lessonId}:${vocabIndex}`
  lessonId: number;
  vocabIndex: number; // 0-based
  word: Vocabulary;
};

type ExampleLike = { nepali: string; romanized: string; korean: string };

function getExample(word: Vocabulary): ExampleLike | null {
  const maybe = word as unknown as { example?: unknown; exampleKo?: unknown };

  // Supports object-shaped examples used elsewhere in the app.
  if (maybe.example && typeof maybe.example === "object") {
    const ex = maybe.example as Partial<ExampleLike>;
    if (typeof ex.nepali === "string" && typeof ex.korean === "string") {
      return {
        nepali: ex.nepali,
        romanized: typeof ex.romanized === "string" ? ex.romanized : "",
        korean: ex.korean,
      };
    }
  }

  // Supports legacy lesson JSON shape: example/exampleKo as strings.
  if (typeof maybe.example === "string" && maybe.example.trim().length > 0) {
    return {
      nepali: maybe.example,
      romanized: "",
      korean: typeof maybe.exampleKo === "string" ? maybe.exampleKo : "",
    };
  }

  return null;
}

function getExampleAudio(word: Vocabulary, lessonId: number): string | null {
  const maybe = word as unknown as { example_audio?: unknown; exampleAudioIndex?: unknown };

  if (typeof maybe.example_audio === "string" && maybe.example_audio.trim().length > 0) {
    return maybe.example_audio;
  }

  if (typeof maybe.exampleAudioIndex === "number" && Number.isFinite(maybe.exampleAudioIndex)) {
    return getExampleAudioPath(lessonId, maybe.exampleAudioIndex);
  }

  return null;
}

export function FlashCard({ item, className }: { item: StudyWord; className?: string }) {
  const [showMeaning, setShowMeaning] = useState(false);
  const audioPlayer = useAudioPlayer();

  const wordAudioSrc = useMemo(
    () => getVocabAudioPath(item.lessonId, item.word.romanized),
    [item.lessonId, item.word.romanized],
  );
  const wordAudioId = `flash-word-${item.id}`;

  const example = useMemo(() => getExample(item.word), [item.word]);
  const exampleAudioSrc = useMemo(
    () => getExampleAudio(item.word, item.lessonId),
    [item.lessonId, item.word],
  );
  const exampleAudioId = `flash-example-${item.id}`;

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={() => setShowMeaning((v) => !v)}
        className={cn(
          "group relative w-full rounded-3xl border p-0 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0",
          "bg-[#f6f1e6] text-foreground",
        )}
      >
        <div className="relative w-full rounded-3xl">
          <button
            type="button"
            aria-label="단어 오디오 재생"
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white/60 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-white/80"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void audioPlayer.play(wordAudioId, wordAudioSrc, { silentError: true });
            }}
          >
            <Volume2 className="h-4 w-4" />
          </button>

          <div className="grid w-full min-h-[14rem]">
            {/* Default state */}
            <div
              className={cn(
                "col-start-1 row-start-1 flex flex-col justify-center rounded-3xl p-5 pb-10 transition-opacity duration-200 ease-in-out",
                showMeaning ? "opacity-0" : "opacity-100",
              )}
              aria-hidden={showMeaning}
            >
              <div className="my-auto flex flex-col items-center justify-center text-center">
                <p className="text-4xl font-bold text-[#333D29] sm:text-5xl" style={{ fontFamily: "var(--font-nepali)" }}>
                  {item.word.nepali}
                </p>
                <p className="mt-3 max-w-full break-words px-2 pb-0.5 text-base italic leading-relaxed text-[#6B5D4F] sm:text-lg">
                  {item.word.romanized}
                </p>
              </div>
              <p className="absolute bottom-4 left-0 right-0 mx-auto text-center text-[11px] text-muted-foreground/70">
                카드를 클릭하면 뜻이 표시돼요
              </p>
            </div>

            {/* Toggle state */}
            <div
              className={cn(
                "col-start-1 row-start-1 flex flex-col justify-center rounded-3xl p-5 pb-10 transition-opacity duration-200 ease-in-out",
                showMeaning ? "opacity-100" : "opacity-0 pointer-events-none",
              )}
              aria-hidden={!showMeaning}
            >
              <div className="my-auto flex flex-col justify-center">
                <p className="text-center text-xl sm:text-2xl font-bold text-[#333D29] break-keep">
                  {item.word.korean}
                </p>

                {example && (
                  <div className="mt-4">
                  <div className="border-t border-black/10 pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">예문</span>
                      {exampleAudioSrc && (
                        <button
                          type="button"
                          aria-label="예문 오디오 재생"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-foreground transition-colors hover:bg-black/10"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void audioPlayer.play(exampleAudioId, exampleAudioSrc, {
                              silentError: true,
                            });
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p
                      className="text-sm font-bold text-foreground"
                      style={{ fontFamily: "var(--font-nepali)" }}
                    >
                      {example.nepali}
                    </p>
                    {example.korean.trim().length > 0 && (
                      <p className="mt-1.5 text-xs text-foreground/80">{example.korean}</p>
                    )}
                  </div>
                </div>
                )}
              </div>
              {!example && (
                <p className="absolute bottom-4 left-0 right-0 mx-auto text-center text-[11px] text-[#6B5D4F]/80">
                  다시 클릭하면 단어로 돌아가요
                </p>
              )}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
