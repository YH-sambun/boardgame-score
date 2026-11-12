# 🎲 보드게임 점수판

가족 보드게임 점수 계산 + 전적 누적 웹앱. 지금은 **스컬킹**, **루미큐브**, **요트다이스**, **참새작**이 들어 있고, 다른 게임은 `js/games/` 에 모듈을 추가하면 됩니다.

- 빌드 도구 없음 (순수 HTML/JS) → GitHub Pages에 그대로 올리면 동작
- `js/firebase-config.js` 가 비어 있으면 **이 기기(localStorage)에만 저장**, 채우면 **Firestore** 에 저장되어 모든 기기에서 공유
- Google로 로그인한 누구나 사용 가능, 기록은 계정별로 따로 저장 (남의 기록은 볼 수 없음)
- 참가자에 Google 이메일을 연결하면 그 사람 계정에서도 함께 한 게임을 보고 점수 입력 가능 (삭제는 만든 사람만)
- 홈 화면에 추가하면 앱처럼 전체화면으로 실행 (PWA)

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
6. **Firestore → 규칙** 탭에 `firestore.rules` 내용을 붙여넣고 게시

## 데이터 구조 (Firestore)
- `users/{uid}/players/{id}`: `{ name, email, createdAt }` — 내 참가자 목록
- `users/{uid}/meta/settings`: `{ statsResetAt: { [gameId]: ms } }` — 전적 초기화 시점
- `sessions/{id}`: `{ gameId, ownerUid, ownerName, viewerEmails, players:[{id,name,email}], playerIds, settings, data, totals, status:'playing'|'finished', createdAt, updatedAt, finishedAt }`
  - `viewerEmails` 에 든 계정은 읽기/점수 수정 가능, 삭제·공유대상 변경은 `ownerUid` 만
  - 스컬킹 `data`: `{ rounds:[{ bids:[], wins:[], bonus:[] }], current }`, `settings`: `{ startRound, endRound }`
  - 예전 위치(`users/{uid}/sessions`)의 기록은 로그인 시 자동으로 옮겨집니다.
   - 루미큐브 `data`: `{ rounds:[{ winner, left:[] }], current }` (`winner`: 승자 자리 번호, `left`: 각자 남은 타일 합)
  - 요트다이스 `data`: `{ scores:{ ones:[], twos:[], …, yacht:[] } }` (칸별로 참가자 순서 배열, 빈 칸은 null)
  - 참새작 `data`: `{ hands:[{ result:'win'|'draw'|null, winner, how:'ron'|'tsumo', from, sets:['shun'|'kou',…], dora, red, tanyao, chanta, yakuman, manual }], current }`

전적(1등 횟수, 승률, 평균 점수, 최고 점수, 평균 등수)은 완료된 `sessions` 로부터 계산합니다.

## 배포할 때
`./bump-version.sh` 를 실행하면 파일 버전 번호가 바뀌어 브라우저가 옛 파일을 쓰지 않습니다.

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

## 루미큐브 점수 규칙 (공식 룰북 기준)
| 상황 | 점수 |
|---|---|
| 진 사람 | −(받침대에 남은 타일 숫자 합), 조커는 30 |
| 이긴 사람(먼저 다 내려놓음) | 진 사람들 남은 합의 총합만큼 + |
| 더미가 바닥나 아무도 못 끝냄 | 남은 합이 가장 적은 사람이 승자, 승자는 Σ(상대 남은 합 − 자기 남은 합) |

한 판 점수의 합은 항상 0이고, 판수는 자유롭게 늘려 가며 누적 합계로 순위를 정합니다. 남은 타일은 숫자 버튼(1~13, 조커)으로 하나씩 눌러 더할 수 있습니다.

## 요트다이스 점수 규칙 (12칸)
| 칸 | 점수 |
|---|---|
| 1 ~ 6 | 해당 눈의 합 |
| 보너스 | 1~6 합계가 63점 이상이면 +35 |
| 초이스 | 주사위 5개 합 |
| 포카드 | 같은 눈 4개 이상일 때 5개 합 |
| 풀하우스 | 3개+2개일 때 5개 합 |
| 스몰 스트레이트 | 4개 연속이면 15 |
| 라지 스트레이트 | 5개 연속이면 30 |
| 요트 | 5개 모두 같으면 50 |

조건을 못 맞춘 칸에 기록하면 0점. 칸을 누르면 그 칸에 나올 수 있는 점수만 버튼으로 나옵니다.

## 참새작 점수 규칙 (すずめ雀 기준)
손패 6장으로 몸통(순자·커쯔) 2개를 만들면 화료. 시작 점수 40점, 동·남·서·북 4바퀴(부친은 매 판 다음 사람에게).

| 항목 | 점수 |
|---|---|
| 순자 / 커쯔 | 1 / 2 |
| 도라, 적패(빨간 삭수·중) | 1장당 1 |
| 탕야오(2~8만) / 찬타(두 몸통 모두 1·9·발·중 포함) | +1 / +2 |
| 올그린(2·3·4·6·8·발만) / 친야오(1·9·발·중만) / 슈퍼레드(전부 빨강) | +10 / +15 / +20 |
| 부친이 화료 | +2 (5점 조건에는 미포함) |

- 5점 이상이어야 화료 가능
- 론: 버린 사람이 전액 지불 / 쯔모: 나머지가 똑같이 나눠 지불(올림)
- 유국: 점수 이동 없음
- 집에서 쓰는 규칙이 다르면 판마다 '직접 입력'에 점수를 넣으면 됩니다.
