import os
import re

# 1. 기준이 되는 루트 폴더 경로
base_path = r"public/audio/lesson1"
parts = ["part1", "part2"]  # 순회할 폴더 이름


def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]


for i, part_name in enumerate(parts):
    folder_path = os.path.join(base_path, part_name)

    if not os.path.exists(folder_path):
        print(f"경고: {folder_path} 폴더가 없습니다. 건너뜁니다.")
        continue

    # 파일 목록 가져오기 및 자연어 정렬
    files = [f for f in os.listdir(folder_path) if f.endswith(".mp3")]
    files.sort(key=natural_sort_key)

    print(f"\n--- [{part_name}] {len(files)}개 파일 재정렬 시작 ---")

    # 1단계: 임시 이름으로 변경 (이름 충돌 방지)
    temp_files = []
    for idx, filename in enumerate(files):
        old_path = os.path.join(folder_path, filename)
        temp_name = f"temp_{idx:03d}_{filename}"
        os.rename(old_path, os.path.join(folder_path, temp_name))
        temp_files.append(temp_name)

    # 2단계: 최종 이름 변경 (dial_{i}_{idx}.mp3)
    temp_files.sort(key=natural_sort_key)
    for idx, temp_name in enumerate(temp_files):
        old_path = os.path.join(folder_path, temp_name)
        new_name = f"dial_{i}_{idx}.mp3"
        new_path = os.path.join(folder_path, new_name)

        if os.path.exists(new_path):
            os.remove(new_path)

        os.rename(old_path, new_path)
        print(f"정렬 완료: {temp_name} -> {new_name}")

print("\n✨ 모든 파트의 리인덱싱이 완료되었습니다!")