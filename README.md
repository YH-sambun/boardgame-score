# 🎲 보드게임 점수판

가족 보드게임 점수 계산 + 전적 누적 웹앱. 지금은 **스컬킹**이 들어 있고, 다른 게임은 `js/games/` 에 모듈을 추가하면 됩니다.

- 빌드 도구 없음 (순수 HTML/JS) → GitHub Pages에 그대로 올리면 동작
- `js/firebase-config.js` 가 비어 있으면 **이 기기(localStorage)에만 저장**, 채우면 **Firestore** 에 저장되어 모든 기기에서 공유
- Google 로그인 + 이메일 허용 목록으로 가족만 쓰고 쓰기 가능

## 1. GitHub 저장소 + Pages
1. GitHub에서 새 저장소 생성 (예: `boardgame-score`, Public)
2. 이 폴더의 파일을 전부 올리기 (index.html이 저장소 최상위에 있어야 함)
3. 저장소 **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`** 저장
4. 1~2분 뒤 `https://<아이디>.github.io/boardgame-score/` 접속

## 2. Firebase / Firestore
1. https://console.firebase.google.com → 프로젝트 추가 (애널리틱스 꺼도 됨)
2. **빌드 → Firestore Database → 데이터베이스 만들기** (위치: `asia-northeast3` 서울, 프로덕션 모드)
3. **빌드 → Authentication → 시작하기 → Sign-in method → Google 사용 설정**
4. **Authentication → 설정 → 승인된 도메인** 에 `<아이디>.github.io` 추가
5. **프로젝트 설정(⚙️) → 내 앱 → 웹(</>) 앱 추가** → 나오는 `firebaseConfig` 값을 `js/firebase-config.js` 에 붙여넣기
   (apiKey 는 공개돼도 되는 값입니다. 보안은 아래 규칙이 담당)
6. **Firestore → 규칙** 탭에 `firestore.rules` 내용을 붙여넣고, 허용할 이메일 목록을 수정 후 게시

## 데이터 구조 (Firestore)
- `players/{id}`: `{ name, createdAt }`
- `sessions/{id}`: `{ gameId, players:[{id,name}], playerIds, settings, data, totals, status:'playing'|'finished', createdAt, updatedAt, finishedAt }`
  - 스컬킹 `data`: `{ rounds:[{ bids:[], wins:[], bonus:[] }], current }`

전적(1등 횟수, 승률, 평균 점수, 최고 점수, 평균 등수)은 완료된 `sessions` 로부터 계산합니다.

## 새 게임 추가하기
`js/games/skullking.js` 를 참고해 `{ id, name, emoji, minPlayers, maxPlayers, settingsFields, initData, computeTotals, renderPlay }` 를 내보내는 모듈을 만들고 `js/games/index.js` 의 `GAMES` 에 추가하세요.

## 스컬킹 점수 규칙 (공식 룰북 기준)
| 상황 | 점수 |
|---|---|
| 1 이상 예측 성공 | 예측 × 20 + 보너스 |
| 1 이상 예측 실패 | 차이 × −10 (보너스 없음) |
| 0 예측 성공 | 라운드 × 10 + 보너스 |
| 0 예측 실패 | 라운드 × −10 |

보너스(예측 성공 시만): 색 14 +10, 검정 14 +20, 해적이 잡은 인어 +20, 스컬킹이 잡은 해적 +30, 인어가 잡은 스컬킹 +40, 약탈품 동맹 +20(둘 다 성공 시)
