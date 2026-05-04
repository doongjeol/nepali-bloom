import { useState } from "react";
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
      <div className={cn("mt-3 flex flex-1 flex-col transition-opacity duration-300", !revealed ? "opacity-0" : "opacity-100")}>
        <p className="mb-1.5 text-sm font-bold text-primary">{item.phonetic}</p>
        {item.description && (
          <p className="break-keep text-sm leading-relaxed text-muted-foreground">
            {parseFormattedText(item.description)}
          </p>
        )}
      </div>
    </button>
  );
}

export function PronunciationStudy() {
  const audioPlayer = useAudioPlayer();
  const [showAll, setShowAll] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());

  const vowels = (data as any).vowels as PronunciationItem[];
  const consonants = (data as any).consonants as PronunciationItem[];
  const special = (data as any).special_characters as PronunciationItem[];
  const lessonNote = (data as any).lesson_note as string;

  const currentPlayingId = audioPlayer.currentItemId;

  const renderGrid = (items: PronunciationItem[]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {items.map((item) => {
        const id = makeId(item);
        const revealed = showAll || revealedIds.has(id);
        const playing = currentPlayingId === `pron-${id}`;
        return (
          <PronCard
            key={id}
            item={item}
            revealed={revealed}
            playing={playing}
            onClick={() => {
              void audioPlayer.play(`pron-${id}`, getPronunciationAudioPath(item.audio));
              setRevealedIds((prev) => {
                const next = new Set(prev);
                next.add(id);
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
            onClick={() => setShowAll((v) => !v)}
            className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-accent active:scale-[0.99] transition-all"
          >
            {showAll ? "정답 숨기기" : "정답 보기"}
          </button>
      </div>

      <Section title={categoryLabel.vowels}>{renderGrid(vowels)}</Section>
      <Section title={categoryLabel.consonants}>{renderGrid(consonants)}</Section>
      {special.length > 0 && <Section title={categoryLabel.special_characters}>{renderGrid(special)}</Section>}
    </div>
  );
}
