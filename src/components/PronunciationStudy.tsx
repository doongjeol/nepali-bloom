import { useState } from "react";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { getPronunciationAudioPath } from "@/lib/getAudioPath";
import data from "@/data/lessons/pronunciation_00.json";

type PronunciationItem = {
  char: string;
  romanized: string;
  phonetic: string;
  audio: string;
  description?: string;
  book_guide?: string;
  book_examples?: Array<{ nepali: string; romanized: string; meaning: string }>;
};

type CategoryKey = "vowels" | "consonants" | "special_characters";

const categoryLabel: Record<CategoryKey, string> = {
  vowels: "모음",
  consonants: "자음",
  special_characters: "특수 문자",
};

function makeId(item: PronunciationItem) {
  return `${item.char}__${item.romanized}`;
}

// JSON 내의 **강조 텍스트**를 포인트 색상으로 변환해주는 유틸리티
function parseFormattedText(text: string) {
  if (!text) return null;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-bold text-[#8A5A2B] dark:text-[#D4A373]">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function PronCard({
  item,
  revealed,
  playing,
  onClick,
}: {
  item: PronunciationItem;
  revealed: boolean;
  playing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[9rem] w-full flex-col rounded-2xl border bg-card p-4 text-left shadow-sm transition-all",
        "hover:shadow-md active:scale-[0.98]",
        playing && "ring-2 ring-[#B28471]/40 border-[#B28471]/50",
      )}
    >
      {/* 항상 표시: 문자 & 로마자 */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
        <span className="text-4xl font-extrabold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
          {item.char}
        </span>
        <span className="rounded-md bg-secondary/80 px-2 py-1 text-sm font-semibold text-secondary-foreground">
          {item.romanized}
        </span>
      </div>
      {/* 클릭 시 표시: 발음 & 상세 설명 (Fade-in) */}
      <div
        className={cn(
          "mt-3 flex flex-1 flex-col transition-opacity duration-300",
          !revealed ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
      >
        <p className="mb-1.5 text-sm font-bold text-primary">{item.phonetic}</p>
        {item.description && (
          <p className="break-keep text-sm leading-relaxed text-muted-foreground">{parseFormattedText(item.description)}</p>
        )}
      </div>
    </button>
  );
}

export function PronunciationStudy() {
  const audioPlayer = useAudioPlayer();
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"card" | "description">("card");

  const vowels = (data as any).vowels as PronunciationItem[];
  const consonants = (data as any).consonants as PronunciationItem[];
  const special = (data as any).special_characters as PronunciationItem[];
  const lessonNote = (data as any).lesson_note as string;

  const currentPlayingId = audioPlayer.currentItemId;

  const allItems = [...vowels, ...consonants, ...special];
  const selectedItem = expandedId ? allItems.find((x) => makeId(x) === expandedId) ?? null : null;

  const renderGrid = (items: PronunciationItem[]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {items.map((item) => {
        const id = makeId(item);
        const revealed = showAll || expandedId === id;
        const playing = currentPlayingId === `pron-${id}`;
        return (
          <PronCard
            key={id}
            item={item}
            revealed={revealed}
            playing={playing}
            onClick={() => {
              void audioPlayer.play(`pron-${id}`, getPronunciationAudioPath(item.audio));
              setExpandedId((prev) => {
                const next = prev === id ? null : id;
                if (next) setDetailTab("card");
                return next;
              });
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 최상단 학습 가이드 박스 */}
      {lessonNote && (
        <div className="mb-6 rounded-2xl border border-[#DCCFC4] bg-[#FDF2F0]/80 p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-bold text-[#7A4F3B]">💡 발음 학습 가이드</h2>
          <p className="break-keep text-sm leading-relaxed text-[#3A2B22]/80">
            {parseFormattedText(lessonNote)}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() =>
            setShowAll((v) => {
              const next = !v;
              if (next) setExpandedId(null);
              return next;
            })
          }
          className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-accent active:scale-[0.99] transition-all"
        >
          {showAll ? "설명 숨기기" : "설명 보기"}
        </button>
      </div>

      {!showAll && selectedItem && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">선택한 발음</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {selectedItem.char} · {selectedItem.romanized}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpandedId(null)}
              className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-accent active:scale-[0.99] transition-all"
            >
              닫기
            </button>
          </div>

          <div className="mt-4 flex rounded-xl border bg-muted/20 p-1">
            <button
              type="button"
              onClick={() => setDetailTab("card")}
              className={cn(
                "flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all",
                detailTab === "card"
                  ? "bg-background text-foreground shadow-sm border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              발음 카드
            </button>
            <button
              type="button"
              onClick={() => setDetailTab("description")}
              className={cn(
                "flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all",
                detailTab === "description"
                  ? "bg-background text-foreground shadow-sm border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              추가 설명
            </button>
          </div>

          {detailTab === "card" ? (
            <div key="tab-card" className="mt-4 animate-in fade-in duration-200">
              <div className="rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="text-5xl font-extrabold leading-none text-foreground sm:text-6xl"
                      style={{ fontFamily: "var(--font-nepali)" }}
                    >
                      {selectedItem.char}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-foreground">{selectedItem.romanized}</p>
                    <p className="mt-1 text-sm font-bold text-primary">{selectedItem.phonetic}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void audioPlayer.play(
                        `pron-${makeId(selectedItem)}`,
                        getPronunciationAudioPath(selectedItem.audio),
                        { silentError: true },
                      )
                    }
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-sm transition-all hover:bg-accent active:scale-[0.98]"
                    aria-label="발음 음성 재생"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div key="tab-description" className="mt-4 animate-in fade-in duration-200">
              {selectedItem.description ? (
                <div className="rounded-2xl border bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
                  {parseFormattedText(selectedItem.description)}
                </div>
              ) : (
                <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  추가 설명이 준비되지 않았습니다.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Section title={categoryLabel.vowels}>{renderGrid(vowels)}</Section>
      <Section title={categoryLabel.consonants}>{renderGrid(consonants)}</Section>
      {special.length > 0 && <Section title={categoryLabel.special_characters}>{renderGrid(special)}</Section>}
    </div>
  );
}
