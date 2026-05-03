import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import dialogueData from "@/data/dialogues.json";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dialogues")({
  head: () => ({
    meta: [
      { title: "대화문 - 네팔어 학습" },
      { name: "description", content: "실생활 네팔어 대화문을 연습하세요" },
    ],
  }),
  component: DialoguesPage,
});

function DialoguesPage() {
  const [selectedId, setSelectedId] = useState<number>(dialogueData[0].id);
  const [showRomanized, setShowRomanized] = useState(true);

  const dialogue = dialogueData.find((d) => d.id === selectedId)!;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold text-foreground">💬 대화문</h1>

        <div className="mb-6 flex flex-wrap gap-2">
          {dialogueData.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                selectedId === d.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              )}
            >
              {d.title}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {dialogue.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {dialogue.description}
            </p>
          </div>
          <button
            onClick={() => setShowRomanized(!showRomanized)}
            className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
          >
            {showRomanized ? "로마자 숨기기" : "로마자 보기"}
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          {dialogue.lines.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-3",
                line.speaker === "B" && "flex-row-reverse text-right"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  line.speaker === "A"
                    ? "bg-primary text-primary-foreground"
                    : "bg-nepali text-nepali-foreground"
                )}
              >
                {line.speaker}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-5 py-3",
                  line.speaker === "A"
                    ? "rounded-tl-sm bg-warm/40"
                    : "rounded-tr-sm bg-nepali/10"
                )}
              >
                <p
                  className="text-base font-medium text-foreground"
                  style={{ fontFamily: "var(--font-nepali)" }}
                >
                  {line.nepali}
                </p>
                {showRomanized && (
                  <p className="mt-0.5 text-xs text-muted-foreground italic">
                    {line.romanized}
                  </p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  {line.korean}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
