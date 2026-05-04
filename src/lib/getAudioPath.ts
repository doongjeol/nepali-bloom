export type AudioItemKind = "vocab" | "dial";

export function getVocabAudioPath(lessonId: number | string, index: number): string {
  // 단어 순서(index + 1)를 무조건 2자리 숫자로 맞춥니다. (예: 1 -> "01", 2 -> "02")
  const paddedIndex = String(index + 1).padStart(2, "0");
  return `/audio/per_lesson/lesson${lessonId}_${paddedIndex}.mp3`;
}

export function getDialogueAudioPath(
  lessonId: number | string,
  dialogueIndex: number,
  lineIndex: number,
): string {
  // 대화문도 비슷한 평면 구조일 것이라 가정하여 경로를 수정합니다. (예: /audio/per_lesson/lesson1_dial_0_0.mp3)
  return `/audio/per_lesson/lesson${lessonId}_dial_${dialogueIndex}_${lineIndex}.mp3`;
}

export function getAudioPath(params:
  | { kind: "vocab"; lessonId: number | string; index: number }
  | { kind: "dial"; lessonId: number | string; dialogueIndex: number; lineIndex: number }
): string {
  if (params.kind === "vocab") return getVocabAudioPath(params.lessonId, params.index);
  return getDialogueAudioPath(params.lessonId, params.dialogueIndex, params.lineIndex);
}
