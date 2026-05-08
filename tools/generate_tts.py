#!/usr/bin/env python3
"""
Google Cloud Text-to-Speech로 네팔어(mp3) 음성 파일을 생성합니다.

출력 위치(프론트에서 사용하는 규칙):
- 단어: public/audio/lesson_{N}/{romanized}.mp3
- 단어 예문(네팔어만): public/audio/lesson_{N}/{romanized}_example.mp3
- 대화문 라인: public/audio/lesson_{N}/dial_{dIdx}_{lIdx}.mp3
- 예문 탭(examples): public/audio/lesson_{N}/example_{eIdx}.mp3

준비:
  pip install google-cloud-texttospeech
  (Windows) set GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\service-account.json"
"""

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Optional

os.environ["GRPC_DNS_RESOLVER"] = "native"

ROOT = Path(__file__).resolve().parents[1]
LESSONS_DIR = ROOT / "src" / "data" / "lessons"
BASE_OUTPUT_DIR = ROOT / "public" / "audio"

_INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\\\|?*]')


def safe_filename(name: str) -> str:
    s = (name or "").strip().replace("..", ".")
    return _INVALID_FILENAME_CHARS.sub("_", s)


def get_vocab_example_nepali(item: dict) -> Optional[str]:
    ex = item.get("example")
    if not ex:
        return None
    if isinstance(ex, str):
        t = ex.strip()
        return t if t else None
    if isinstance(ex, dict):
        t = ex.get("nepali")
        if isinstance(t, str):
            t = t.strip()
            return t if t else None
    return None


def synthesize_with_retry(client, text: str, output_file_path: Path, *, language_code: str = "ne-NP", gender=None):
    synthesis_input = texttospeech.SynthesisInput(text=text)
    
    if gender is None:
        gender = texttospeech.SsmlVoiceGender.FEMALE
        
    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code,
        ssml_gender=gender,
    )
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
            output_file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file_path, "wb") as out:
                out.write(response.audio_content)
            print(f"     [완료] {output_file_path}")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"     [오류] '{text}' 재시도({attempt + 1}/{max_retries})...")
                time.sleep(2)
            else:
                print(f"     [실패] '{text}': {e}")

    time.sleep(0.2)


def generate_tts(
    *,
    target_lesson: Optional[int] = None,
    start_from: Optional[int] = None,
    vocab_examples_only: bool = False,
    dry_run: bool = False,
    ko_a_male: bool = False,
):
    global texttospeech
    try:
        from google.cloud import texttospeech as _texttospeech

        texttospeech = _texttospeech
    except Exception as e:
        print("필수 라이브러리 'google-cloud-texttospeech'를 찾을 수 없습니다.")
        print("설치: pip install google-cloud-texttospeech")
        print(f"상세 오류: {e}")
        return

    client = None
    if not dry_run:
        try:
            client = texttospeech.TextToSpeechClient()
        except Exception as e:
            print("Google Cloud TTS 클라이언트 초기화에 실패했습니다. GOOGLE_APPLICATION_CREDENTIALS 환경 변수를 확인해 주세요.")
            print(f"상세 오류: {e}")
            return

    if not LESSONS_DIR.exists():
        print(f"오류: lessons 폴더를 찾을 수 없습니다: {LESSONS_DIR}")
        return

    files = list(LESSONS_DIR.glob("lesson_*.json"))
    try:
        files = sorted(files, key=lambda x: int(x.stem.split("_")[1]))
    except Exception:
        files = sorted(files)

    for input_file in files:
        lesson_name = input_file.stem  # lesson_1
        try:
            lesson_num = int(lesson_name.split("_")[1])
        except Exception:
            lesson_num = -1

        if target_lesson is not None and lesson_num != target_lesson:
            continue
        if start_from is not None and lesson_num < start_from:
            continue

        output_dir = BASE_OUTPUT_DIR / lesson_name
        output_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n[{lesson_name}] 처리 중...")

        with open(input_file, "r", encoding="utf-8") as f:
            lesson_data = json.load(f)

        vocabulary = lesson_data.get("vocabulary", []) or []
        for item in vocabulary:
            nepali_text = item.get("nepali")
            romanized_text = item.get("romanized")
            if not nepali_text or not romanized_text:
                continue

            safe_romanized = safe_filename(romanized_text)

            if not vocab_examples_only:
                vocab_out = output_dir / f"{safe_romanized}.mp3"
                if vocab_out.exists():
                    print(f"  -> 단어 스킵(존재): {vocab_out.name}")
                else:
                    print(f"  -> 단어 생성: {romanized_text}")
                    if dry_run:
                        print(f"     [dry-run] {vocab_out}")
                    else:
                        synthesize_with_retry(client, nepali_text, vocab_out)

                # 단어 한국어 뜻 추출 추가
                korean_text = item.get("korean")
                if korean_text:
                    # "own (자신의)" 같은 형태에서 괄호 안의 한글 뜻("자신의")만 추출. 괄호가 없으면 전체 텍스트 사용.
                    match = re.search(r'\(([^)]+)\)', korean_text)
                    clean_korean = match.group(1).strip() if match else korean_text.strip()
                    vocab_ko_out = output_dir / f"{safe_romanized}_ko.mp3"
                    if vocab_ko_out.exists():
                        print(f"  -> 단어(한국어) 스킵(존재): {vocab_ko_out.name}")
                    else:
                        print(f"  -> 단어(한국어) 생성: {safe_romanized}_ko")
                        if dry_run:
                            print(f"     [dry-run] {vocab_ko_out}")
                        else:
                            synthesize_with_retry(client, clean_korean, vocab_ko_out, language_code="ko-KR")

            example_nepali = get_vocab_example_nepali(item)
            if example_nepali:
                ex_out = output_dir / f"{safe_romanized}_example.mp3"
                if ex_out.exists():
                    print(f"  -> 예문 스킵(존재): {ex_out.name}")
                else:
                    print(f"  -> 예문 생성: {romanized_text}_example")
                    if dry_run:
                        print(f"     [dry-run] {ex_out}")
                    else:
                        synthesize_with_retry(client, example_nepali, ex_out)

        if vocab_examples_only:
            continue

        dialogues = lesson_data.get("dialogues", []) or []
        for d_idx, dialogue in enumerate(dialogues):
            lines = dialogue.get("lines", []) or []
            for l_idx, line in enumerate(lines):
                nepali_text = line.get("nepali")
                korean_text = line.get("korean")
                speaker = line.get("speaker")
                
                # 화자가 B이면 남성 목소리, 그 외(A 등)는 여성 목소리로 설정
                nepali_gender = texttospeech.SsmlVoiceGender.MALE if speaker == "B" else texttospeech.SsmlVoiceGender.FEMALE
                
                if ko_a_male:
                    ko_gender = texttospeech.SsmlVoiceGender.MALE if speaker == "A" else texttospeech.SsmlVoiceGender.FEMALE
                else:
                    ko_gender = nepali_gender

                if nepali_text:
                    out = output_dir / f"dial_{d_idx}_{l_idx}.mp3"
                    if out.exists():
                        print(f"  -> 대화문(네팔어) 스킵(존재): {out.name}")
                    else:
                        print(f"  -> 대화문(네팔어) 생성: dial_{d_idx}_{l_idx} (화자: {speaker})")
                        if dry_run:
                            print(f"     [dry-run] {out}")
                        else:
                            synthesize_with_retry(client, nepali_text, out, gender=nepali_gender)

                if korean_text:
                    out_ko = output_dir / f"dial_{d_idx}_{l_idx}_ko.mp3"
                    if out_ko.exists():
                        print(f"  -> 대화문(한국어) 스킵(존재): {out_ko.name}")
                    else:
                        # "[A] ", "[B] "와 같은 화자 표시가 음성으로 읽히지 않도록 제거
                        clean_korean = re.sub(r'^\[.*?\]\s*', '', korean_text)
                        print(f"  -> 대화문(한국어) 생성: dial_{d_idx}_{l_idx}_ko (화자: {speaker})")
                        if dry_run:
                            print(f"     [dry-run] {out_ko}")
                        else:
                            synthesize_with_retry(client, clean_korean, out_ko, language_code="ko-KR", gender=ko_gender)

        examples = lesson_data.get("examples", []) or []
        for e_idx, ex in enumerate(examples):
            nepali_text = ex.get("nepali")
            if not nepali_text:
                continue
            out = output_dir / f"example_{e_idx}.mp3"
            if out.exists():
                continue
            print(f"  -> 예문탭 생성: example_{e_idx}")
            if dry_run:
                print(f"     [dry-run] {out}")
            else:
                synthesize_with_retry(client, nepali_text, out)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Nepali lesson TTS MP3 files (vocabulary/dialogues/examples).")
    parser.add_argument("--lesson", type=int, help="Generate audio for a single lesson number (e.g. 2).")
    parser.add_argument(
        "--start-from",
        type=int,
        dest="start_from",
        help="Generate audio starting from this lesson number (ignored when --lesson is set).",
    )
    parser.add_argument(
        "--vocab-examples-only",
        action="store_true",
        help="Generate only vocabulary example audio (romanized_example.mp3). Skips vocab/dialogues/examples.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be generated, but do not call the TTS API or write files.",
    )
    parser.add_argument(
        "--ko-a-male",
        action="store_true",
        help="Korean TTS: set Speaker A to Male and Speaker B to Female.",
    )
    args = parser.parse_args()

    generate_tts(
        target_lesson=args.lesson,
        start_from=None if args.lesson is not None else args.start_from,
        vocab_examples_only=args.vocab_examples_only,
        dry_run=args.dry_run,
        ko_a_male=args.ko_a_male,
    )

# --lesson 1 --vocab-examples-only
# --lesson 2 --ko-a-male