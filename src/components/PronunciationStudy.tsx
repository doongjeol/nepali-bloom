import { useMemo, useState } from "react";
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
  playing,
  selected,
  onClick,
}: {
  item: PronunciationItem;
  playing: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[7.5rem] w-full flex-col rounded-2xl border bg-card p-4 text-left shadow-sm transition-all",
        "hover:shadow-md active:scale-[0.98]",
        playing && "ring-2 ring-[#B28471]/40 border-[#B28471]/50",
        selected && "border-[#B28471]/60 ring-1 ring-[#B28471]/30",
      )}
    >
      {/* 항상 표시: 문자 & 로마자 */}
      <div className="flex items-center justify-between">
        <span className="text-4xl font-extrabold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
          {item.char}
        </span>
        <span className="rounded-md bg-secondary/80 px-2 py-1 text-sm font-semibold text-secondary-foreground">
          {item.romanized}
        </span>
      </div>
    </button>
  );
}

export function PronunciationStudy() {
  const audioPlayer = useAudioPlayer();
  const vowels = (data as any).vowels as PronunciationItem[];
  const consonants = (data as any).consonants as PronunciationItem[];
  const special = (data as any).special_characters as PronunciationItem[];
  const lessonNote = (data as any).lesson_note as string;

  const allItems = useMemo(() => [...vowels, ...consonants, ...special], [consonants, special, vowels]);

  const [mainTab, setMainTab] = useState<"study" | "guide">("study");
  const [selectedCharId, setSelectedCharId] = useState<string>(() => makeId(allItems[0]!));
  const [phoneticVisible, setPhoneticVisible] = useState(false);

  const currentPlayingId = audioPlayer.currentItemId;

  const selectedItem = allItems.find((x) => makeId(x) === selectedCharId) ?? allItems[0] ?? null;

  const renderGrid = (items: PronunciationItem[]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {items.map((item) => {
        const id = makeId(item);
        const playing = currentPlayingId === `pron-${id}`;
        const selected = selectedCharId === id;
        return (
          <PronCard
            key={id}
            item={item}
            playing={playing}
            selected={selected}
            onClick={() => {
              void audioPlayer.play(`pron-${id}`, getPronunciationAudioPath(item.audio));
              setSelectedCharId(id);
              setPhoneticVisible(false);
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 메인 탭 (상단 고정) */}
      <div className="sticky top-0 z-10 -mx-4 bg-background/80 px-4 pb-3 pt-2 backdrop-blur sm:-mx-0 sm:px-0">
        <div className="rounded-2xl border bg-card p-1 shadow-sm">
          <div className="flex">
            <button
              type="button"
              onClick={() => setMainTab("study")}
              className={cn(
                "flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                mainTab === "study" ? "bg-[#B28471] text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              발음 카드 학습
            </button>
            <button
              type="button"
              onClick={() => setMainTab("guide")}
              className={cn(
                "flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                mainTab === "guide" ? "bg-[#B28471] text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              전체 추가 설명 리스트
            </button>
          </div>
        </div>
      </div>

      {/* 최상단 학습 가이드 박스 */}
      {lessonNote && (
        <div className="mb-6 rounded-2xl border border-[#DCCFC4] bg-[#FDF2F0]/80 p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-bold text-[#7A4F3B]">💡 발음 학습 가이드</h2>
          <p className="break-keep text-sm leading-relaxed text-[#3A2B22]/80">
            {parseFormattedText(lessonNote)}
          </p>
        </div>
      )}

      {mainTab === "study" ? (
        <div className="space-y-4">
          {/* 중앙 단일 카드 */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">선택한 발음</p>
                <p
                  className="mt-2 text-6xl font-extrabold leading-none text-foreground sm:text-7xl"
                  style={{ fontFamily: "var(--font-nepali)" }}
                >
                  {selectedItem?.char ?? "—"}
                </p>
                <p className="mt-4 text-base font-semibold text-foreground">{selectedItem?.romanized ?? ""}</p>
                <p
                  className={cn(
                    "mt-2 text-sm font-bold text-primary transition-opacity",
                    phoneticVisible ? "opacity-100" : "opacity-0",
                  )}
                >
                  {selectedItem?.phonetic ?? ""}
                </p>
                <p className="mt-4 text-[11px] text-muted-foreground">
                  카드를 눌러 한국어 발음을 {phoneticVisible ? "숨기기" : "보기"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!selectedItem) return;
                  void audioPlayer.play(`pron-${makeId(selectedItem)}`, getPronunciationAudioPath(selectedItem.audio), {
                    silentError: true,
                  });
                }}
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-sm transition-all hover:bg-accent active:scale-[0.98]"
                aria-label="발음 음성 재생"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPhoneticVisible((v) => !v)}
              className="mt-4 w-full rounded-2xl border bg-muted/20 p-4 text-left shadow-sm transition-all hover:bg-muted/30 active:scale-[0.99]"
            >
              <span className="text-xs font-semibold text-muted-foreground">카드 터치 영역</span>
              <div className="mt-2 text-sm text-muted-foreground">
                로마자는 항상 보이고, 한국어 발음은 카드 클릭 시에만 보여요.
              </div>
            </button>
          </div>

          {/* 선택 리스트 */}
          <Section title={categoryLabel.vowels}>{renderGrid(vowels)}</Section>
          <Section title={categoryLabel.consonants}>{renderGrid(consonants)}</Section>
          {special.length > 0 && <Section title={categoryLabel.special_characters}>{renderGrid(special)}</Section>}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="min-h-[18rem]">
            <div className="space-y-0">
              {allItems.map((item, idx) => (
                <div
                  key={makeId(item)}
                  className={cn("py-5", idx !== allItems.length - 1 && "border-b border-border/60")}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                        {item.char}
                      </span>
                      <span className="ml-2 text-sm font-semibold text-[#B28471]">{item.romanized}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void audioPlayer.play(`pron-guide-${makeId(item)}`, getPronunciationAudioPath(item.audio), {
                          silentError: true,
                        })
                      }
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-sm transition-all hover:bg-accent active:scale-[0.98]"
                      aria-label="발음 음성 재생"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                    <div>
                      <div className="text-xs font-semibold text-foreground">가이드</div>
                      <div className="mt-1 leading-relaxed">{item.book_guide ?? "가이드가 없습니다."}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">예시</div>
                      {(item.book_examples?.length ?? 0) > 0 ? (
                        <ul className="mt-2 space-y-1.5">
                          {item.book_examples!.map((ex, exIdx) => (
                            <li key={`${ex.nepali}-${exIdx}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="font-semibold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                                {ex.nepali}
                              </span>
                              <span className="text-xs italic text-muted-foreground">({ex.romanized})</span>
                              <span>- {ex.meaning}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-1">예시가 없습니다.</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
