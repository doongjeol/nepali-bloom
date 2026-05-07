export type AudioItemKind = "vocab" | "dial" | "example";

function formatAudioUrl(path: string) {
  // Do not force lowercase: audio filenames are case-sensitive in many deployments (and even in some dev servers).
  const normalized = encodeURI(path);
  // Ensure public assets respect Vite base path in production builds.
  // If BASE_URL is "/", keep absolute paths as-is.
  const baseUrl = import.meta.env.BASE_URL || "/";
  if (baseUrl !== "/" && normalized.startsWith("/")) {
    return `${baseUrl.replace(/\/$/, "")}${normalized}`;
  }
  return normalized;
}

export function getPronunciationAudioPath(audioPath: string): string {
  return formatAudioUrl(audioPath);
}

export function getVocabAudioPath(lessonId: number | string, romanized: string): string {
  return formatAudioUrl(`/audio/lesson_${lessonId}/${romanized}.mp3`);
}

export function getDialogueAudioPath(
  lessonId: number | string,
  dialogueIndex: number,
  lineIndex: number,
): string {
  return formatAudioUrl(`/audio/lesson_${lessonId}/dial_${dialogueIndex}_${lineIndex}.mp3`);
}

export function getExampleAudioPath(lessonId: number | string, index: number): string {
  return formatAudioUrl(`/audio/lesson_${lessonId}/example_${index}.mp3`);
}

export function getAudioPath(params:
  | { kind: "vocab"; lessonId: number | string; romanized: string }
  | { kind: "dial"; lessonId: number | string; dialogueIndex: number; lineIndex: number }
  | { kind: "example"; lessonId: number | string; index: number }
): string {
  if (params.kind === "vocab") return getVocabAudioPath(params.lessonId, params.romanized);
  if (params.kind === "example") return getExampleAudioPath(params.lessonId, params.index);
  return getDialogueAudioPath(params.lessonId, params.dialogueIndex, params.lineIndex);
}
