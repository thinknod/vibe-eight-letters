// api/reading.js : AI 사주 풀이 서버 함수
// Vercel이 api 폴더의 파일을 서버 함수로 돌려요. 주소는 POST /api/reading
// 라이브러리 없이 Node 기본 fetch만 써요(package.json, npm install 필요 없음).
//
// 환경 변수 (Vercel > Settings > Environment Variables, 바꾼 뒤에는 꼭 Redeploy)
//   OPENAI_API_KEY    필수. 없으면 503을 돌려주고 화면은 기본 풀이로 돌아가요
//   OPENAI_MODEL      선택. 기본 gpt-5.6-luna
//   OPENAI_REASONING  선택. 기본 low
//   ALLOWED_ORIGINS   선택. 쉼표로 여러 개. 넣으면 그 주소에서 온 요청만 받아요 (예: https://eight-letters.vercel.app)
//   DAILY_LIMIT       선택. 서버 하루 호출 상한, 기본 1000
//   HOURLY_PER_IP     선택. 한 사람 시간당 상한, 기본 20
//
// 지키는 것
//   - 받는 것은 계산된 글자(간지, 오행 개수, 십성, 오늘 일진)뿐. 생년월일, 이름, 자유 입력 글은 받지 않아요
//   - 형식이 다르면 OpenAI를 부르지 않고 400
//   - 같은 사주, 같은 날은 메모리에 24시간 저장해 다시 부르지 않아요
//   - 받은 풀이에 금지어가 있으면 한 번 다시 쓰게 하고, 그래도 있으면 502(화면은 기본 풀이)
//   - 로그에는 토큰 수와 걸린 시간만. 사주 내용은 남기지 않아요
'use strict';

const MODEL = () => process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const PILLAR = new RegExp('^[' + STEMS + '][' + BRANCHES + ']$');
const TEN_GODS = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인', '일간'];
const EL = ['목', '화', '토', '금', '수'];
const STEM_KO = '갑을병정무기경신임계';
const BRANCH_KO = '자축인묘진사오미신유술해';
const STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
const DAY_IMAGE = ['곧게 자라는 큰 나무', '바람에 휘는 풀과 꽃', '한낮의 해', '밤을 밝히는 등불', '너른 산', '씨앗을 품은 밭', '다듬기 전의 원석', '빛나는 보석', '흐르는 큰 강', '이슬과 빗물'];
const SECTION_KEYS = ['nature', 'balance', 'work', 'people', 'today'];
const SECTION_TITLES = { nature: '타고난 결', balance: '오행의 균형', work: '일하는 방식', people: '사람 사이', today: '오늘의 흐름' };

// 받은 글에 있으면 안 되는 표현 (불안, 단정, 건강과 생사, 금전 손실 예언)
const BANNED = /죽음|죽는다|죽게|사망|요절|단명|사고를 당|사고가 나|사고 날|교통사고|질병|병에 걸|암에 걸|수술|이혼|파혼|파산|망한다|망할|저주|액운|흉살|대흉|불길하|재앙|살이 끼|귀신|부적|굿을|운명이다|운명입니다|운명이에요|팔자가 사납|팔자가 세|평생 외로|결혼을 못|결혼 못|자식이 없|돈을 잃|빚을 지/;

// ---------- 저장과 제한 (서버리스 인스턴스마다 따로 세는 근사치) ----------
const cache = new Map();      // key -> { at, reading }
const hits = new Map();       // ip -> [timestamps]
let day = '', dayCount = 0;
const DAY_MS = 864e5, HOUR_MS = 36e5;

function todayKST() { return new Date(Date.now() + 9 * HOUR_MS).toISOString().slice(0, 10); }
function overLimit(ip) {
  const now = Date.now(), perIp = Number(process.env.HOURLY_PER_IP || 20), daily = Number(process.env.DAILY_LIMIT || 1000);
  if (day !== todayKST()) { day = todayKST(); dayCount = 0; }
  if (dayCount >= daily) return '오늘 풀이가 많이 몰려 잠시 쉬어요. 내일 다시 와 주세요';
  const list = (hits.get(ip) || []).filter(t => now - t < HOUR_MS);
  if (list.length >= perIp) return '조금 뒤에 다시 해 주세요';
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return '';
}

// ---------- 입력 검증 ----------
function validate(b) {
  if (!b || typeof b !== 'object') return null;
  const p = b.pillars;
  if (!Array.isArray(p) || p.length !== 4) return null;
  for (let i = 0; i < 4; i++) { if (i === 3 && p[i] === null) continue; if (typeof p[i] !== 'string' || !PILLAR.test(p[i])) return null; }
  const c = b.counts;
  if (!Array.isArray(c) || c.length !== 5 || !c.every(n => Number.isInteger(n) && n >= 0 && n <= 8)) return null;
  const sum = c.reduce((a, n) => a + n, 0);
  if (sum !== (p[3] ? 8 : 6)) return null;
  const g = b.tenGods;
  if (!Array.isArray(g) || g.length !== 8 || !g.every(x => x === null || TEN_GODS.includes(x))) return null;
  if (typeof b.today !== 'string' || !PILLAR.test(b.today)) return null;
  return { pillars: p, counts: c, tenGods: g, today: b.today };
}

// ---------- 지시문 ----------
const SYSTEM = `너는 사주 명리를 오래 공부한 상담가다. 만세력 계산은 이미 끝났고, 너는 주어진 글자와 관계만 보고 해석한다. 계산을 다시 하거나 글자를 바꾸지 않는다.

말투와 태도
- 모든 문장을 해요체로 끝낸다("~해요", "~이에요", "~예요", "~돼요"). "~습니다", "~입니다"는 한 번도 쓰지 않는다.
- 따뜻하고 차분하게, 읽는 사람이 자기 이야기로 느끼게 구체적으로 쓴다. 가운뎃점(·)과 줄표(—) 대신 쉼표를 쓴다.
- 성향, 균형, 흐름, 쓰임의 말로 쓴다. 좋고 나쁨을 판정하지 않는다. 많은 기운은 장점과 쓰는 법으로, 적거나 없는 기운은 채우면 좋은 것으로 말한다.
- 근거를 드러낸다. "일간이 경금이라", "월지에 신금 비견이 있어", "화가 둘이라"처럼 어떤 글자 때문에 그렇게 읽는지 짧게 밝힌다. 한자는 쓰지 말고 한글 음과 오행으로만 쓴다(예: 경금, 병화, 인목).
- 십성 이름(비견, 식신, 편재, 정관, 편인 등)은 쓸 수 있지만, 처음 나올 때 쉬운 말로 한 번 풀어 준다.

쓰지 않는 것
- 죽음, 사고, 질병, 수술, 이혼, 파산, 액운, 저주, 귀신, 부적 같은 말과 그런 일을 예언하는 문장.
- "~할 운명", "팔자가 세다", "평생 ~하다", "결혼을 못 한다"처럼 단정하거나 겁주는 표현.
- 돈을 벌거나 잃는다는 구체적 예언, 투자와 건강과 법률에 대한 조언.
- 대운, 세운, 올해 운세처럼 주어지지 않은 정보를 지어내는 것.
- 시주가 모름이면 시주를 추측하지 말고, 여섯 글자로 본다고 한 번만 말한다.

분량
- headline: 이 사람을 한 줄로 그리는 제목, 30자 안. 주어진 일간의 상징(예: 밭, 원석)이나 사주에서 가장 두드러진 점을 살린 그림 같은 문장으로. "단단함 속에", "~을 세우는 사람" 같은 뻔한 틀은 피한다.
- summary: 전체 인상 2~3문장.
- sections: 다섯 칸(nature 타고난 결, balance 오행의 균형, work 일하는 방식, people 사람 사이, today 오늘의 흐름), 각 2~4문장.
- today는 오늘 일진과 나(일간)의 관계로 읽는다. 하루의 분위기와 해 보면 좋은 쪽을 말한다.
- action: 오늘 해 볼 작은 행동 하나, 40자 안, 명령형 대신 "~해 보세요".
- keywords: 이 사람을 나타내는 짧은 낱말 셋(각 6자 안).`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['headline', 'summary', 'sections', 'action', 'keywords'],
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    sections: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['key', 'body'], properties: { key: { type: 'string', enum: SECTION_KEYS }, body: { type: 'string' } } },
    },
    action: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
  },
};

function describe(v) {
  const names = ['년주', '월주', '일주', '시주'];
  const lines = v.pillars.map((p, i) => {
    if (!p) return `${names[i]}: 모름`;
    const s = STEMS.indexOf(p[0]), b = BRANCHES.indexOf(p[1]);
    const gs = v.tenGods[i * 2], gb = v.tenGods[i * 2 + 1];
    return `${names[i]}: ${STEM_KO[s]}${BRANCH_KO[b]} (천간 ${STEM_KO[s]}${EL[STEM_EL[s]]} ${gs}, 지지 ${BRANCH_KO[b]} ${gb})`;
  });
  const me = STEMS.indexOf(v.pillars[2][0]);
  const t = STEMS.indexOf(v.today[0]), tb = BRANCHES.indexOf(v.today[1]);
  return [
    '여덟 글자 (만세력 계산 결과)',
    ...lines,
    `나(일간): ${STEM_KO[me]}${EL[STEM_EL[me]]}, 상징은 ${DAY_IMAGE[me]}`,
    `오행 개수: ${EL.map((e, i) => `${e} ${v.counts[i]}`).join(', ')}${v.pillars[3] ? '' : ' (시주를 몰라 여섯 글자)'}`,
    `오늘 일진: ${STEM_KO[t]}${BRANCH_KO[tb]}일 (오늘 천간 ${STEM_KO[t]}${EL[STEM_EL[t]]})`,
    '',
    '이 사주를 풀어 주세요.',
  ].join('\n');
}

// ---------- 받은 풀이 점검 ----------
function clean(r) {
  if (!r || typeof r !== 'object') return null;
  const str = (x, max) => (typeof x === 'string' ? x.trim().replace(/\s*[·ㆍ]\s*/g, ', ').replace(/\s*—\s*/g, ', ').replace(/\s+\n/g, '\n').slice(0, max) : '');
  const byKey = {};
  (Array.isArray(r.sections) ? r.sections : []).forEach(s => { if (s && SECTION_KEYS.includes(s.key) && !byKey[s.key]) byKey[s.key] = str(s.body, 600); });
  const out = {
    headline: str(r.headline, 40),
    summary: str(r.summary, 500),
    sections: SECTION_KEYS.filter(k => byKey[k]).map(k => ({ key: k, title: SECTION_TITLES[k], body: byKey[k] })),
    action: str(r.action, 60),
    keywords: (Array.isArray(r.keywords) ? r.keywords : []).map(k => str(k, 10)).filter(Boolean).slice(0, 3),
  };
  if (!out.headline || !out.summary || out.sections.length < 4 || !out.action) return null;
  return out;
}
function unsafe(r) {
  const all = [r.headline, r.summary, r.action, ...r.keywords, ...r.sections.map(s => s.body)].join('\n');
  const formal = (all.match(/습니다|입니다/g) || []).length;
  return BANNED.test(all) || /[一-鿿]/.test(all) || formal > 1; // 금지어, 한자, 해요체 규칙 위반
}

// ---------- OpenAI 호출 ----------
async function callOpenAI(user, extra) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: MODEL(),
        reasoning_effort: process.env.OPENAI_REASONING || 'low',
        max_completion_tokens: 4000,
        response_format: { type: 'json_schema', json_schema: { name: 'saju_reading', strict: true, schema: SCHEMA } },
        messages: [{ role: 'system', content: SYSTEM + (extra || '') }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) { const e = new Error('openai_' + res.status); e.status = res.status; throw e; }
    const j = await res.json();
    const msg = j.choices && j.choices[0] && j.choices[0].message;
    if (!msg || msg.refusal) throw new Error('refusal');
    return { data: JSON.parse(msg.content || '{}'), usage: j.usage || {} };
  } finally { clearTimeout(timer); }
}
async function withRetry(fn) {
  try { return await fn(); } catch (e) {
    if (e.name === 'AbortError' || e.status === 429 || (e.status >= 500 && e.status < 600)) { await new Promise(r => setTimeout(r, 800)); return fn(); }
    throw e;
  }
}

// ---------- 요청 처리 ----------
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? safeJson(req.body) : req.body; // Vercel은 미리 읽어 둔다
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 4096) return null; }
  return safeJson(raw);
}
function safeJson(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST만 받아요' });
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(req.headers.origin || '')) return send(res, 403, { error: '허용되지 않은 주소예요' });
  if (!process.env.OPENAI_API_KEY) return send(res, 503, { error: 'AI 풀이가 아직 연결되지 않았어요' });
  if (Number(req.headers['content-length'] || 0) > 4096) return send(res, 413, { error: '요청이 너무 커요' });

  const v = validate(await readBody(req));
  if (!v) return send(res, 400, { error: '형식이 맞지 않아요' });

  const key = [v.pillars.join(''), v.today, todayKST(), MODEL()].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY_MS) return send(res, 200, { reading: hit.reading, cached: true });

  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  const limited = overLimit(ip);
  if (limited) return send(res, 429, { error: limited });

  const started = Date.now(), user = describe(v);
  let tokens = { in: 0, out: 0 };
  try {
    let reading = null;
    for (let attempt = 0; attempt < 2 && !reading; attempt++) {
      const extra = attempt ? '\n\n주의: 직전 답이 규칙을 어겼다(금지 표현, 한자, 또는 "~습니다" 문체). 모든 문장을 해요체로, 금지 목록을 지켜서 처음부터 새로 쓴다.' : '';
      const { data, usage } = await withRetry(() => callOpenAI(user, extra));
      tokens.in += usage.prompt_tokens || 0; tokens.out += usage.completion_tokens || 0;
      const r = clean(data);
      if (r && !unsafe(r)) reading = r;
    }
    dayCount++;
    console.log(JSON.stringify({ ev: 'reading', ok: !!reading, ms: Date.now() - started, in: tokens.in, out: tokens.out, model: MODEL() }));
    if (!reading) return send(res, 502, { error: '풀이를 다듬지 못했어요' });
    cache.set(key, { at: Date.now(), reading });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    return send(res, 200, { reading, cached: false });
  } catch (e) {
    console.log(JSON.stringify({ ev: 'reading', ok: false, ms: Date.now() - started, err: e.status || e.name || 'error' }));
    if (e.status === 401) return send(res, 503, { error: 'AI 풀이 키를 확인해 주세요' });
    if (e.status === 429) return send(res, 429, { error: '잠시 뒤에 다시 해 주세요' });
    return send(res, 502, { error: 'AI 풀이를 받지 못했어요' });
  }
}

module.exports = handler;
module.exports._test = { validate, clean, unsafe, describe, SYSTEM, reset() { cache.clear(); hits.clear(); dayCount = 0; } };
