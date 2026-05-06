#!/usr/bin/env python3
"""
Google Cloud Text-to-Speech API 설정 및 실행 방법:

1. 필수 라이브러리 설치:
   pip install google-cloud-texttospeech

2. Google Cloud 프로젝트 및 서비스 계정 키 설정:
   - Google Cloud Console에서 'Cloud Text-to-Speech API'를 검색하여 '사용'을 클릭합니다.
   - IAM 및 관리자 > 서비스 계정으로 이동하여 새 서비스 계정을 생성합니다.
   - 생성한 서비스 계정의 '키' 탭에서 새 키 만들기(JSON 형식)를 선택하여 다운로드합니다.

3. 환경 변수 설정:
   - 다운로드한 JSON 키 파일의 절대 경로를 환경 변수에 설정해야 API를 사용할 수 있습니다.
   - Mac/Linux:
     export GOOGLE_APPLICATION_CREDENTIALS="/경로/파일명.json"
   - Windows:
     set GOOGLE_APPLICATION_CREDENTIALS="C:\경로\파일명.json"
"""

import argparse
import os
import time
from pathlib import Path
import json

# gRPC DNS 오류 해결을 위한 환경 변수 설정
os.environ["GRPC_DNS_RESOLVER"] = "native"

# 프로젝트 루트 경로 계산
ROOT = Path(__file__).resolve().parents[1]
LESSONS_DIR = ROOT / "src" / "data" / "lessons"
BASE_OUTPUT_DIR = ROOT / "public" / "audio"

def synthesize_with_retry(client, text, output_file_path):
    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(language_code="ne-NP", ssml_gender=texttospeech.SsmlVoiceGender.FEMALE)
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
            with open(output_file_path, "wb") as out:
                out.write(response.audio_content)
                print(f"     [저장 완료]: {output_file_path}")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"     [오류 발생] '{text}' 재시도 대기 중 ({attempt + 1}/{max_retries})...")
                time.sleep(2)
            else:
                print(f"     [최종 오류 발생] '{text}': {e}")
    
    time.sleep(0.2)

def generate_vocab_audio(target_lesson=None, start_from=None):
    # 0. Google Cloud TTS는 지연 import (의존성 없을 때도 `--help` 사용 가능)
    global texttospeech
    try:
        from google.cloud import texttospeech as _texttospeech
        texttospeech = _texttospeech
    except Exception as e:
        print("필수 라이브러리 'google-cloud-texttospeech'를 찾을 수 없습니다.")
        print("설치: pip install google-cloud-texttospeech")
        print(f"상세 오류: {e}")
        return

    # 1. Google Cloud TTS 클라이언트 초기화
    try:
        client = texttospeech.TextToSpeechClient()
    except Exception as e:
        print("Google Cloud TTS 클라이언트 초기화에 실패했습니다. GOOGLE_APPLICATION_CREDENTIALS 환경 변수를 확인해 주세요.")
        print(f"상세 오류: {e}")
        return

    # 2. lessons 폴더 확인
    if not LESSONS_DIR.exists():
        print(f"오류: {LESSONS_DIR} 폴더를 찾을 수 없습니다.")
        return

    # 3. lessons 폴더 내의 모든 json 파일 순회
    files = list(LESSONS_DIR.glob("lesson_*.json"))
    
    # 파일명 숫자 기준으로 정렬 (예: lesson_1, lesson_2, ..., lesson_10)
    try:
        files = sorted(files, key=lambda x: int(x.stem.split('_')[1]))
    except ValueError:
        files = sorted(files)

    for input_file in files:
        lesson_name = input_file.stem  # 예: lesson_1
        try:
            lesson_num = int(lesson_name.split('_')[1])
        except (ValueError, IndexError):
            lesson_num = -1

        if target_lesson is not None and lesson_num != target_lesson:
            continue
        if start_from is not None and lesson_num < start_from:
            continue

        output_dir = BASE_OUTPUT_DIR / lesson_name

        # 출력 디렉토리가 없다면 생성
        output_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n[{lesson_name}] 파일 처리 중...")

        with open(input_file, "r", encoding="utf-8") as f:
            lesson_data = json.load(f)

        vocabulary = lesson_data.get("vocabulary", [])
        if not vocabulary:
            print(f"  -> 단어(vocabulary) 리스트가 비어있거나 찾을 수 없습니다.")
            continue

        # 4. 각 단어를 순회하며 음성 파일 생성
        for item in vocabulary:
            nepali_text = item.get("nepali")
            romanized_text = item.get("romanized")

            if not nepali_text or not romanized_text:
                continue

            output_file_path = output_dir / f"{romanized_text}.mp3"
            if output_file_path.exists():
                print(f"  -> 건너뜀 (이미 존재): {output_file_path.name}")
            else:
                print(f"  -> '{nepali_text}' ({romanized_text}) 변환 중...")
                synthesize_with_retry(client, nepali_text, output_file_path)
                
            # 단어에 예문이 있다면 예문 오디오도 함께 생성
            example = item.get("example")
            if example and example.get("nepali"):
                ex_output_file = output_dir / f"{romanized_text}_example.mp3"
                if ex_output_file.exists():
                    print(f"  -> 예문 건너뜀 (이미 존재): {ex_output_file.name}")
                else:
                    print(f"  -> 예문 '{example.get('nepali')}' 변환 중...")
                    synthesize_with_retry(client, example.get("nepali"), ex_output_file)

        # 5. 각 대화문을 순회하며 음성 파일 생성
        dialogues = lesson_data.get("dialogues", [])
        if not dialogues:
            print(f"  -> 대화문(dialogues) 리스트가 비어있거나 찾을 수 없습니다.")
            continue

        for d_idx, dialogue in enumerate(dialogues):
            lines = dialogue.get("lines", [])
            for l_idx, line in enumerate(lines):
                nepali_text = line.get("nepali")

                if not nepali_text:
                    continue

                # 파일명: dial_{대화문인덱스}_{라인인덱스}.mp3
                output_file_path = output_dir / f"dial_{d_idx}_{l_idx}.mp3"
                if output_file_path.exists():
                    print(f"  -> 건너뜀 (이미 존재): {output_file_path.name}")
                    continue

                print(f"  -> 대화문 [{d_idx}-{l_idx}] '{nepali_text}' 변환 중...")

                synthesize_with_retry(client, nepali_text, output_file_path)
        
        # 6. 각 예문을 순회하며 음성 파일 생성
        examples = lesson_data.get("examples", [])
        if not examples:
            print(f"  -> 예문(examples) 리스트가 비어있거나 찾을 수 없습니다.")
            continue

        for e_idx, example in enumerate(examples):
            nepali_text = example.get("nepali")

            if not nepali_text:
                continue

            # 파일명: example_{인덱스}.mp3
            output_file_path = output_dir / f"example_{e_idx}.mp3"
            if output_file_path.exists():
                print(f"  -> 건너뜀 (이미 존재): {output_file_path.name}")
                continue

            print(f"  -> 예문 [{e_idx}] '{nepali_text}' 변환 중...")

            synthesize_with_retry(client, nepali_text, output_file_path)
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Nepali lesson TTS MP3 files (vocabulary/dialogues/examples).")
    parser.add_argument(
        "--lesson",
        type=int,
        help="Generate audio for a single lesson number (e.g. 2 to generate only lesson_2).",
    )
    parser.add_argument(
        "--start-from",
        type=int,
        dest="start_from",
        help="Generate audio starting from this lesson number (e.g. 15 to generate lesson_15+). Ignored when --lesson is set.",
    )
    args = parser.parse_args()

    generate_vocab_audio(target_lesson=args.lesson, start_from=None if args.lesson is not None else args.start_from)


# --start-from 15
# --lesson 10
