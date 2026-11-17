# 여덟 글자

태어난 날과 시를 넣으면 사주 여덟 글자, 오행의 균형, 십성, 오늘의 기운을 계산하고, AI가 다섯 갈래로 풀어 줘요. 생년월일은 브라우저 안에서만 계산하고, AI에게는 계산된 글자만 보내요.

![링크 미리보기 그림](og.png)

빌드 도구 없는 정적 웹에 서버 함수 하나(`api/reading.js`)가 붙어 있어요. 이 폴더를 그대로 GitHub에 올리고 Vercel로 배포하면 PC와 휴대폰 어디서나 열리고, 환경 변수에 OpenAI 키를 넣으면 AI 풀이가 켜져요. 키가 없으면 미리 써 둔 기본 풀이로 돌아가요.

## 폴더

```
index.html  style.css  app.js  data.js  saju.js  check.html  check-cases.js  og.png  favicon.svg
api/reading.js   AI 풀이 서버 함수 (OpenAI, 라이브러리 없음)
vercel.json      서버 함수 제한 시간 30초
.env.example     환경 변수 예시 (.env.local은 GitHub와 zip에 들어가지 않아요)
README.md     지금 읽는 설명서
CLAUDE.md     AI 도구(Claude Code 등)에게 줄 맥락. AGENTS.md도 같은 내용을 가리켜요
docs/         plan.md(기획서), design.png(디자인 시안), ai-plan.md(AI 풀이 운영 기준), ai-samples.md(실제 풀이 12개)
```

| 파일 | 하는 일 |
|---|---|
| index.html | 화면 뼈대, 탭 제목, 링크 미리보기(og) 태그 |
| style.css | 모양. 색과 글꼴은 맨 위 `:root`에 모여 있어요 |
| app.js | 동작 |
| data.js | **고쳐 보는 곳.** 글, 목록, 색 |
| og.png | 카카오톡, 슬랙에 링크를 보낼 때 나오는 그림(1200x630) |
| saju.js | 만세력 계산(절기, 음력, 네 기둥, 십성). 고칠 일이 거의 없어요 |
| api/reading.js | AI 풀이. 입력 검증, 호출 제한, 저장, 표현 점검까지 들어 있어요 |

## 1. 내 컴퓨터에서 열어 보기

- `index.html`을 더블클릭하면 브라우저에서 열려요. 핵심 기능은 이것만으로 다 돼요
- 휴대폰 화면은 크롬 개발자 도구(F12)에서 휴대폰 모양 아이콘을 눌러 확인해요
- 공유하기 버튼처럼 https 주소에서만 되는 기능은 배포한 뒤에 확인해요

## 2. 고쳐 보기 (data.js)

| 바꾸고 싶은 것 | 고칠 곳 |
|---|---|
| 나(일간) 한 줄 | `DAY_MASTERS` 열 개의 제목과 설명을 내 말투로 바꿔요 |
| 오늘의 기운 문장 | `TODAY`의 다섯 문장을 바꿔요 |
| 오행 색 | `ELEMENTS`의 color. 흰 글자가 잘 보이는 진한 색으로 |
| 태어난 곳 | `PLACES`에 지역과 경도를 더해요 |

저장하고 브라우저를 새로 고치면 바로 보여요. 따옴표와 쉼표를 지우면 화면이 비어요. 그럴 땐 개발자 도구 콘솔의 빨간 줄을 보면 몇 번째 줄인지 나와요.

## 3. GitHub에 올리기

1. GitHub에서 New repository, 이름은 `eight-letters`처럼 영어로, Public으로 만들어요
2. 빈 레포 화면의 "uploading an existing file"을 눌러요
3. **압축을 푼 이 폴더 안의 파일과 폴더를 모두** 끌어다 놓아요. zip 파일째 올리면 안 돼요. `index.html`이 레포 맨 위에 있어야 해요
4. Commit changes

## 4. Vercel로 배포하기

1. vercel.com에 GitHub 계정으로 로그인
2. Add New > Project > 방금 만든 레포 Import
3. Framework Preset은 "Other" 그대로, 다른 칸은 비워 두고 Deploy
4. 1분쯤 뒤 나온 주소(`○○.vercel.app`)를 휴대폰으로 열어요

## 5. AI 풀이 켜기 (환경 변수)

1. OpenAI 대시보드(platform.openai.com)에서 API 키를 만들어요. **Limits에서 월 예산을 꼭 정해 두세요**
2. Vercel 프로젝트 > Settings > Environment Variables에 `OPENAI_API_KEY` 이름으로 키를 넣어요
3. 선택: `ALLOWED_ORIGINS`에 내 주소(예: `https://eight-letters.vercel.app`)를 넣으면 다른 사이트에서 이 서버 함수를 못 불러요
4. **Deployments > 맨 위 배포 > Redeploy.** 환경 변수는 다시 배포해야 반영돼요 (가장 많이 막히는 곳)
5. 사이트에서 여덟 글자를 보고 "AI 풀이 보기"를 눌러요. 10초 안팎이면 나와요

AI 풀이까지 보려면 Vercel에 배포한 뒤 Settings > Environment Variables에 `OPENAI_API_KEY`를 넣고 Redeploy 하는 것이 가장 쉬워요. 키가 없어도 기본 풀이는 나와요.

| 환경 변수 | 기본값 | 뜻 |
|---|---|---|
| OPENAI_API_KEY | 없음 | 필수 |
| OPENAI_MODEL | gpt-5.6-luna | 가성비 모델. 바꾸면 다시 배포 |
| OPENAI_REASONING | low | 생각 깊이 |
| ALLOWED_ORIGINS | 없음 | 쉼표로 여러 주소 |
| DAILY_LIMIT | 1000 | 서버 하루 호출 상한 |
| HOURLY_PER_IP | 20 | 한 사람 시간당 상한 |

비용: 한 번에 1.7원 안팎(gpt-5.6-luna, 2026-11-08 시험 12회 평균). 같은 사주는 같은 날 다시 부르지 않아요(이 기기와 서버에 저장).

## 6. 배포한 뒤

- GitHub에서 `data.js`를 열고 연필 아이콘으로 한 줄 바꿔 Commit하면, Vercel이 알아서 다시 배포해요. 1분 뒤 주소를 새로 고쳐 보세요
- `index.html`의 `og:image`를 `https://내주소/og.png`처럼 전체 주소로 바꾸면 링크 미리보기가 확실하게 나와요. 카카오톡 "나와의 채팅"에 주소를 보내 확인해요. 그림을 바꿨는데 옛 그림이 나오면 `og.png?v=2`처럼 뒤에 숫자를 붙여요

## 확인 목록

- [ ] 양력 1996년 8월 21일 진시를 넣으면 丙子 丙申 庚寅 庚辰이 나온다 (오른쪽부터 년, 월, 일, 시)
- [ ] 음력 1996년 7월 8일, 정확한 시각 09:28을 넣어도 같은 결과가 나온다
- [ ] "시간을 몰라요"를 고르면 시주가 "모름"으로 나온다
- [ ] PC는 입력을 바꾸는 즉시 오른쪽 결과가 바뀐다
- [ ] "카드로 저장"으로 이미지가 나오고, 카드에 생년월일이 없다
- [ ] `check.html`을 열면 "틀림 0"
- [ ] 키를 넣고 다시 배포한 뒤 "AI 풀이 보기"를 누르면 다섯 칸 풀이가 나온다. 새로 고쳐도 같은 풀이가 바로 보인다(저장)
- [ ] 키를 빼고 다시 배포하면 "AI 풀이가 아직 연결되지 않았어요"와 기본 풀이가 나온다
- [ ] 개발자 도구 > 네트워크에서 `api/reading`으로 가는 내용에 생년월일이 없다
- [ ] 휴대폰(세로)과 PC(가로 넓은 화면) 모두 가로로 넘치는 곳이 없다

## 주의

- 재미와 참고용이에요. 문장에 단정이나 불안을 주는 말(운명, 질병, 사고, 이별)을 넣지 않아요
- `saju.js`는 계산 파일이라 고칠 일이 거의 없어요. 고쳤다면 `check.html`로 꼭 확인해요
- AI 풀이 문장은 AI가 써요. 서버가 금지어(죽음, 사고, 질병, 이혼, 파산, 운명 단정 등)와 문체를 한 번 더 걸러요. 걸리면 다시 쓰게 하고, 그래도 걸리면 기본 풀이로
- 키는 Vercel 환경 변수에만. 코드, GitHub, 채팅에 붙여 넣지 않아요. 수업이 끝나면 키를 지우거나 OpenAI에서 예산 한도를 낮춰 두세요
- 생년월일과 입력은 이 브라우저(localStorage)에만 남아요. 바깥으로 나가는 요청은 글꼴과, AI 풀이를 누를 때 내 서버 함수로 가는 계산된 글자뿐이에요
