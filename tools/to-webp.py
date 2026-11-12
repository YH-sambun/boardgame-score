"""ComfyUI 결과(PNG)를 앱에 넣을 WebP로 줄여 저장합니다.
사용법 (Pillow 필요: pip install pillow):
  python tools/to-webp.py icon  <입력.png> img/games/skullking.webp   # 256x256 아이콘
  python tools/to-webp.py bg    <입력.png> img/bg/home-pc.webp         # 가로 최대 1920
  python tools/to-webp.py bgm   <입력.png> img/bg/home-phone.webp      # 세로 배경, 가로 최대 1080
  python tools/to-webp.py art   <입력.png> img/art/popup.webp          # 팝업·카드 그림, 가로 최대 960
"""
import sys, os
from PIL import Image

PRESETS = {  # (최대 가로, 최대 세로, 품질)
    "icon": (256, 256, 82),
    "bg":   (1920, 1920, 72),
    "bgm":  (1080, 1920, 72),
    "art":  (960, 960, 78),
}

def main():
    if len(sys.argv) != 4 or sys.argv[1] not in PRESETS:
        print(__doc__); sys.exit(1)
    kind, src, dst = sys.argv[1:]
    mw, mh, q = PRESETS[kind]
    im = Image.open(src)
    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    if kind == "icon":  # 가운데 정사각으로 자른 뒤 축소
        s = min(im.size); l = (im.width - s) // 2; t = (im.height - s) // 2
        im = im.crop((l, t, l + s, t + s))
    im.thumbnail((mw, mh), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    im.save(dst, "WEBP", quality=q, method=6)
    print(f"{dst}: {im.width}x{im.height}, {os.path.getsize(dst)//1024} KB")

if __name__ == "__main__":
    main()
