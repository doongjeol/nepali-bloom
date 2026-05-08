# 🎧 네팔어 원어민 음성 정제 가이드 (Lesson 1~40)

이 문서는 1시간 분량의 원어민 발음 MP3 파일을 레슨별/문장별로 분리하여 앱에 적용하는 표준 워크플로우를 정리한 문서입니다.

---

## 📂 폴더 구조 및 준비물
*   **작업 경로**: `D:\workspace\nepali-bloom`
*   **음원 보관**: `tools/audio_raw/` (레슨별로 자른 원본 보관)
*   **스크립트**: `tools/split_lesson_audio.py`, `tools/reindex_audio.py`
*   **최종 경로**: `public/audio/lesson_{x}/`

---

## 1단계: 레슨별 구간 추출 (FFmpeg)
통 MP3 파일에서 해당 레슨의 시작과 끝 지점을 찾아 잘라냅니다.
*   **명령어**:
    ```bash
    # 예: Lesson 1 구간 (0초 ~ 3분 6초) 추출
    ffmpeg -i "Basic Course in Spoken Nepali-1.mp3" -ss 00:00:00 -to 00:03:06 -c copy lesson1_raw.mp3
    ```

## 2단계: 1차 자동 분리 실행 (Python)
잘라낸 레슨 파일을 문장 단위로 쪼갭니다. `split_lesson_audio.py`
*   **PyCharm Parameters**:
    ```text
    --input audio_raw/lesson1_raw.mp3 --output raw/lesson1_split_done --start-index 0 --pad 1 --silence-only --min-silence-len 500 --silence-thresh -38 --keep-silence 150 --ffmpeg "C:\Users\kimdain\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe" --ffprobe "C:\Users\kimdain\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffprobe.exe"
    ```
*   **조정 팁**:
    *   문장이 중간에 잘림 ➔ `--min-silence-len`을 **700**으로 상향
    *   두 문장이 합쳐짐 ➔ `--min-silence-len`을 **400**으로 하향

## 3단계: 파일 전수 검사 및 분류
`public/audio/lesson1` 폴더의 파일을 들어보며 분류합니다.
1.  **안내 멘트**: 파일명을 수정하여 마커로 활용 (예: `dial_0_0_lesson1.mp3`, `dial_0_14_part2.mp3`)
2.  **정상 문장**: 그대로 유지
3.  **미분할 문장 (합침)**: `audio_raw/to_split/` 폴더로 이동

## 4단계: 합쳐진 파일 재분할 (2차 가공)
`to_split`에 모인 파일들을 더 정밀하게(예민하게) 다시 쪼갭니다.
*   **PyCharm Parameters**:
    ```text
    --input audio_raw/to_split --output audio_raw/split_done --silence-only --min-silence-len 300 --silence-thresh -38 --keep-silence 100 --ffmpeg "..." --ffprobe "..."
    ```
    *   **주의**: `--lesson` 파라미터를 비워야 원본 파일명이 유지되어 덮어쓰기를 방지함.

## 5단계: 최종 수동 보정 (Audacity)
스크립트로 해결되지 않는(약 20~30개) 파일은 수동으로 처리합니다.
*   **방법**: Audacity에서 파일 오픈 ➔ 문장 구간 드래그 ➔ `File > Export > Export Selected Audio` 저장
*   **파일명**: `dial_0_x_fixed.mp3` 등 자유롭게 지정 (순서만 기억할 것)

## 6단계: 통합 리인덱싱 (Part 1/2 폴더 기반 자동화)

정제된 파일들을 `part1`과 `part2` 폴더로 나누어 이동시킨 후, 각 폴더의 성격에 맞는 인덱스(`dial_0_x`, `dial_1_x`)를 일괄 부여하는 단계입니다.

### 📂 작업 전 폴더 구조
작업 대상 파일들을 아래와 같이 미리 분류해두어야 합니다.
*   `public/audio/lesson1/part1/` -> Part 1에 해당하는 대화 파일들 모음
*   `public/audio/lesson1/part2/` -> Part 2에 해당하는 대화 파일들 모음
    *(주의: 안내 멘트 파일은 이 폴더에서 제외하거나 삭제하세요)*
## 7단계: 앱 적용 및 경로 이동
최종 완성된 파일을 프로젝트 에셋 폴더로 옮깁니다.
*   **이동 경로**: `D:\workspace\nepali-bloom\public\audio\lesson_{x}`
*   **최종 확인**: 앱 실행 후 대화 텍스트와 원어민 음성이 일치하는지 확인.

---

### 💡 나에게 보내는 조언
- 네팔어 특유의 억양 때문에 **500ms(0.5초)** 무음 감지가 가장 적당한 시작점임.
- 막히면 Audacity로 직접 자르는 게 파라미터 튜닝보다 빠를 때가 많음.