export type AudioItemKind = "vocab" | "dial";

export function getVocabAudioPath(lessonId: number | string, index: number): string {
  return `/audio/per_lesson/lesson${lessonId}/vocab_${index + 1}.mp3`;
}

export function getDialogueAudioPath(
  lessonId: number | string,
  dialogueIndex: number,
  lineIndex: number,
): string {
  return `/audio/per_lesson/lesson${lessonId}/dial_${dialogueIndex}_${lineIndex}.mp3`;
}

export function getAudioPath(params:
  | { kind: "vocab"; lessonId: number | string; index: number }
  | { kind: "dial"; lessonId: number | string; dialogueIndex: number; lineIndex: number }
): string {
  if (params.kind === "vocab") return getVocabAudioPath(params.lessonId, params.index);
  return getDialogueAudioPath(params.lessonId, params.dialogueIndex, params.lineIndex);
}

