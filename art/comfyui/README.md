# ComfyUI로 앱 일러스트·배경 만들기

대상 PC: RTX 5070 Ti (VRAM 16GB), 시스템 RAM 36GB

## 워크플로우 파일 (ComfyUI 창에 끌어다 놓으면 열림)

| 파일 | 종류 | 용도 | 생성 크기 |
|---|---|---|---|
| `01_sdxl_background.json` | text-to-image (2단계) | 배경, 팝업·카드 그림 | 1344x768 → 2016x1152 |
| `02_sdxl_game_icon.json` | text-to-image | 게임 아이콘 | 1024x1024 |
| `03_sdxl_photo_to_illust.json` | image-to-image | 내 사진 → 같은 그림체 일러스트 | 1344x768 |
| `04_flux_dev_fp8.json` | text-to-image | 고품질 버전 (느리지만 디테일·손 묘사 좋음) | 1344x768 |

모두 ComfyUI 기본 노드만 써서 Custom Node 설치가 필요 없습니다.
불러오는 방법: ComfyUI 화면에 JSON 파일을 끌어다 놓거나, 메뉴 Workflow → Open.

## 1. 설치 (Windows)

1. **ComfyUI Desktop** (https://www.comfy.org/download) 또는 **Portable** (https://github.com/comfyanonymous/ComfyUI/releases)을 받습니다.
   5070 Ti(Blackwell)는 **CUDA 12.8 이상으로 빌드된 PyTorch**가 필요합니다. 최신 Desktop·Portable 판은 이미 포함되어 있습니다.
2. 실행 후 첫 화면이 뜨는지 확인합니다. 혹시 `no kernel image is available` 같은 오류가 나면 PyTorch가 오래된 것이므로,
   Portable 폴더에서 아래로 교체합니다.
   ```
   python_embeded\python.exe -m pip install --upgrade torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
   python_embeded\python.exe -c "import torch;print(torch.__version__, torch.version.cuda, torch.cuda.get_device_name())"
   ```
   마지막 줄에 `12.8`(이상)과 `RTX 5070 Ti`가 나오면 정상입니다.
3. NVIDIA 드라이버도 최신(570 이상)으로 둡니다.

## 2. 모델 받기 (`ComfyUI/models/checkpoints/` 에 넣기)

| 모델 | 파일 | 크기 | 쓰는 워크플로우 | 라이선스 |
|---|---|---|---|---|
| SDXL base 1.0 | `sd_xl_base_1.0.safetensors` — https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0 | 약 6.9GB | 01, 02, 03 | OpenRAIL++ (결과물 자유 사용) |
| Flux.1 dev fp8 | `flux1-dev-fp8.safetensors` — https://huggingface.co/Comfy-Org/flux1-dev | 약 17GB | 04 | FLUX.1-dev 비상업 라이선스 (모델은 비상업, 생성 이미지는 사용 가능하다고 명시) |

- 16GB VRAM이면 SDXL은 여유 있게, Flux fp8은 RAM으로 일부 내려 쓰면서 돌아갑니다(36GB RAM이면 충분).
- 다른 SDXL 그림체 체크포인트(Civitai 등)를 쓰려면 파일만 같은 폴더에 넣고 `Load Checkpoint` 노드에서 바꾸면 됩니다. 라이선스는 모델마다 다르니 확인하세요.
- 앱을 나중에 유료로 낼 계획이 있으면 SDXL 쪽을 기본으로 쓰는 게 안전합니다.

## 3. 사용 순서

1. 워크플로우를 열고 **긍정 프롬프트의 앞부분(장면 설명)만** 바꿉니다. 뒤에 붙은 스타일 문구는 그대로 두어야 모든 그림이 같은 그림체가 됩니다.
2. `Queue`(실행) → `ComfyUI/output/bg`, `icon`, `photo`, `flux` 폴더에 PNG가 저장됩니다.
3. 마음에 드는 시드가 나오면 KSampler의 `control after generate`를 `fixed`로 바꾸고 프롬프트만 조금씩 고칩니다.
4. 여러 장 뽑아 고르려면 `크기` 노드의 batch_size를 4로 (SDXL 1차 1344x768 x4는 16GB에서 문제없음).

### 권장 설정 요약

| | SDXL | Flux dev |
|---|---|---|
| steps | 30 (2차 20) | 20~28 |
| cfg | 5~7 | **1.0** (FluxGuidance 2.5~3.5로 조절) |
| sampler / scheduler | dpmpp_2m / karras | euler / simple |
| 2차(hires) denoise | 0.4~0.5 | — |
| 사진→그림 denoise | 0.45(사진에 가깝게) ~ 0.65(그림에 가깝게) | — |

## 4. 그림체 통일용 프롬프트

모든 프롬프트 끝에 붙는 공통 스타일 (워크플로우에 이미 들어 있음):

```
hand-painted gouache illustration, flat muted palette, deep navy and charcoal tones with warm terracotta accents,
visible paper grain, soft uneven brush edges, limited 5-color palette, quiet mood, editorial board game art
```

앱 다크 테마 색(배경 `#141a22`, 강조 `#e0694f`)에 맞춘 남색·차콜 + 테라코타 조합입니다.
"AI 같은" 매끈한 느낌을 줄이려고 종이 질감·붓 자국·제한된 색 수를 넣고, 아래 부정 프롬프트로 광택·3D·보케를 막습니다.

```
3d render, cgi, glossy, plastic, hyperrealistic, photo, airbrushed, smooth gradient skin, bokeh, lens flare,
neon glow, oversaturated, hdr, text, letters, watermark, logo, signature, frame, border, blurry, jpeg artifacts,
extra fingers, deformed hands
```

다른 그림체를 원하면 첫 구절만 바꿔 보세요: `linocut print`(판화), `risograph print, two-color`(리소), `ink and watercolor`(수채).

### 장면 예시 (앞부분에 넣을 문장)

- 홈 배경: `wide empty tabletop seen from above, old wooden table, dice and cards at the edges, large calm empty area in the center, dim lamplight`
- 게임 아이콘 (스컬킹): `single pirate skull with a tricorn hat, centered emblem, simple solid dark background, bold silhouette, readable at small size`
- 게임 아이콘 (요트다이스): `five ivory dice in a small leather cup, centered emblem, simple solid dark background, bold silhouette`
- 게임 아이콘 (참새작): `a small sparrow perched on mahjong tiles, centered emblem, simple solid dark background`
- 승리 팝업: `golden trophy on a wooden table with confetti, small centered object, lots of empty dark space around it`
- 빈 기록 화면: `an empty chair at a game table, board game box closed, quiet evening`

아이콘은 화면에서 최대 64px로 보이므로 **주제는 하나, 배경은 단색, 굵은 실루엣**이 중요합니다.
배경은 글자가 위에 올라가므로 **가운데를 비우고 어둡게** 요청하세요.

## 5. 앱에 넣기 (WebP로 압축)

```
pip install pillow
python tools/to-webp.py icon ComfyUI/output/icon/icon_00001_.png img/games/skullking.webp
python tools/to-webp.py bg   ComfyUI/output/bg/bg_00001_.png     img/bg/home-pc.webp
python tools/to-webp.py bgm  ComfyUI/output/bg/bg_00002_.png     img/bg/home-phone.webp
python tools/to-webp.py art  ComfyUI/output/flux/flux_00001_.png img/art/win.webp
```

| 프리셋 | 최종 크기 | 품질 | 예상 용량 |
|---|---|---|---|
| icon | 256x256 | 82 | 10~30KB |
| bg | 가로 1920 이하 | 72 | 100~250KB |
| bgm | 가로 1080 이하 (세로 배경) | 72 | 100~250KB |
| art | 960 이하 | 78 | 40~120KB |

게임 아이콘은 이미 앱이 지원합니다. `js/games/index.js`의 `GAME_META`에서 해당 게임 줄에 `img: 'skullking.webp'`만 추가하면
이모지 대신 그림이 나옵니다. 배경·팝업 그림은 CSS/화면 코드 수정이 필요하니 그림을 고른 뒤 요청하세요.
