#!/usr/bin/env python3
"""
네팔어 발음(pronunciation_00.json) 오디오 일괄 생성 스크립트

실행 방법:
python tools/generate_pronunciation_audio.py
"""

import json
import os
import time
import argparse
from pathlib import Path

# gRPC DNS 오류 해결을 위한 환경 변수 설정
os.environ["GRPC_DNS_RESOLVER"] = "native"

from google.cloud import texttospeech

# 프로젝트 루트 및 입출력 경로 설정
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JSON_PATH = ROOT / "src" / "data" / "lessons" / "pronunciation_00.json"
PUBLIC_DIR = ROOT / "public"

def generate_pronunciation_audio(*, json_path: Path, dry_run: bool = False):
    # JSON 파일 확인
    if not json_path.exists():
        print(f"오류: {json_path} 파일을 찾을 수 없습니다.")
        # 경로가 다를 경우를 대비한 힌트
        print("파일 위치가 다르다면 스크립트 상단의 JSON_PATH 경로를 알맞게 수정해 주세요.")
        return

    # 출력 디렉토리는 개별 파일 경로별로 생성합니다.

    # 2. 데이터 읽기
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 데이터 구조가 객체인지 배열인지 확인 후 리스트 추출
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict) and any(k in data for k in ("vowels", "consonants", "special_characters")):
        items = [
            *data.get("vowels", []),
            *data.get("consonants", []),
            *data.get("special_characters", []),
        ]
    else:
        items = data.get("pronunciation", data.get("vocabulary", [])) if isinstance(data, dict) else []
    total = len(items)

    print(f"총 {total}개의 발음 오디오 변환 작업을 시작합니다.\n")

    if dry_run or total == 0:
        return

    # 1. Google Cloud TTS 클라이언트 초기화
    try:
        client = texttospeech.TextToSpeechClient()
    except Exception as e:
        print("Google Cloud TTS 클라이언트 초기화에 실패했습니다. GOOGLE_APPLICATION_CREDENTIALS를 확인해 주세요.")
        print(f"상세 오류: {e}")
        return

    for idx, item in enumerate(items, 1):
        char = item.get("char")
        audio_filename = item.get("audio")
        romanized = item.get("romanized", "")

        if not char or not audio_filename:
            continue

        # 파일명에 .mp3가 포함되어 있지 않다면 추가
        if not audio_filename.endswith(".mp3"):
            audio_filename += ".mp3"

        # JSON의 audio는 보통 "/audio/..." 형태이므로 public/ 아래로 매핑 (안전하게 모두 소문자로 저장)
        audio_rel = Path(str(audio_filename).lower().lstrip("/"))
        output_file_path = PUBLIC_DIR / audio_rel
        output_file_path.parent.mkdir(parents=True, exist_ok=True)
        log_name = f"{char}({romanized})" if romanized else char

        # 3. 효율성 처리: 이미 파일이 존재하면 Skip
        if output_file_path.exists():
            print(f"[{idx}/{total}] {log_name} 건너뜀 (이미 존재)")
            continue

        synthesis_input = texttospeech.SynthesisInput(text=char)
        voice = texttospeech.VoiceSelectionParams(language_code="ne-NP", ssml_gender=texttospeech.SsmlVoiceGender.FEMALE)
        audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
                with open(output_file_path, "wb") as out:
                    out.write(response.audio_content)
                print(f"[{idx}/{total}] {log_name} 생성 완료")
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(2)
                else:
                    print(f"[{idx}/{total}] {log_name} 최종 오류 발생: {e}")
        
        time.sleep(0.2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--json",
        type=str,
        default=str(DEFAULT_JSON_PATH),
        help="발음 JSON 경로 (기본값: src/data/pronunciation_00.json)",
    )
    parser.add_argument("--dry-run", action="store_true", help="오디오 생성 없이 대상 항목만 집계")
    args = parser.parse_args()
    generate_pronunciation_audio(json_path=Path(args.json), dry_run=args.dry_run)
