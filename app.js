/* app.js : 여덟 글자 화면 동작
 * 계산은 saju.js(Saju.compute), 글과 색은 data.js. 이 파일은 입력을 읽어 계산을 부르고 화면을 그려요.
 *
 * 흐름: 입력(양력/음력, 날짜, 시간대 또는 정확한 시각, 태어난 곳) -> Saju.compute -> 네 기둥, 오행, 나와 오늘 -> 카드
 * PC(1024px 이상)는 입력을 바꾸는 즉시 오른쪽 결과가 바뀌고, 휴대폰은 '여덟 글자 보기'를 누르면 아래로 내려가요.
 */
(function () {
  'use strict';

  var KEY = 'eight-letters:';
  var $ = function (id) { return document.getElementById(id); };
  var isWide = function () { return window.matchMedia('(min-width: 1024px)').matches; };
  var S = Saju, EL = ELEMENTS;
  var BR_KO = S.BRANCHES_KO;
  var LABELS = ['시', '일 (나)', '월', '년'];

  // ---------- 입력 칸 만들기 ----------
  var thisYear = new Date().getFullYear();
  function opt(v, t, sel) { return '<option value="' + v + '"' + (sel ? ' selected' : '') + '>' + t + '</option>'; }
  function buildSelects() {
    var y = '<option value="">년</option>';
    for (var i = thisYear; i >= 1930; i--) y += opt(i, i + '년');
    $('year').innerHTML = y;
    var m = '<option value="">월</option>';
    for (var j = 1; j <= 12; j++) m += opt(j, j + '월');
    $('month').innerHTML = m;
    fillDays();
    // 시간대 버튼: 시계 시각(서울 기준, 태양시 + 32분)으로 표시
    var h = '';
    for (var b = 0; b < 12; b++) {
      var start = (b * 2 + 23) % 24, end = (b * 2 + 1) % 24;
      h += '<label><input type="radio" name="hour" value="' + b + '"><span>' + BR_KO[b] + '시<small>' + pad(start) + ':30~' + pad(end) + ':30</small></span></label>';
    }
    $('hours').innerHTML = h;
    $('place').innerHTML = PLACES.map(function (p, i) { return opt(i, p.name, i === 0); }).join('');
  }
  // 글자로 쓸 때는 조금 더 진하게 (한지 바탕에서 대비 4.5:1 이상)
  function deep(hex) { var n = parseInt(hex.slice(1), 16), f = 0.82; return 'rgb(' + Math.round((n >> 16) * f) + ',' + Math.round(((n >> 8) & 255) * f) + ',' + Math.round((n & 255) * f) + ')'; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function calType() { return document.querySelector('input[name=cal]:checked').value; }
  function fillDays() {
    var y = +$('year').value, m = +$('month').value, keep = +$('day').value;
    var max = 31;
    if (calType() === 'solar' && y && m) max = new Date(y, m, 0).getDate();
    if (calType() === 'lunar') max = 30;
    var d = '<option value="">일</option>';
    for (var i = 1; i <= max; i++) d += opt(i, i + '일', i === keep);
    $('day').innerHTML = d;
  }
  function updateLeap() {
    var lunar = calType() === 'lunar', y = +$('year').value, m = +$('month').value;
    var lm = lunar && y ? S.leapMonthOf(y) : 0;
    $('leapWrap').hidden = !(lunar && lm && lm === m);
    if (!$('leapWrap').hidden) $('leapInfo').textContent = '(' + y + '년은 윤' + lm + '월이 있어요)';
    else $('leap').checked = false;
  }

  // ---------- 입력 읽기 ----------
  function readInput() {
    var y = +$('year').value, m = +$('month').value, d = +$('day').value;
    if (!y || !m || !d) return { error: '태어난 해, 달, 날을 골라 주세요' };
    var cal = calType(), solar = { y: y, m: m, d: d }, lunar = null;
    if (cal === 'lunar') {
      var leap = $('leap').checked;
      var r = S.lunarToSolar(y, m, d, leap);
      if (!r) return { error: '음력 ' + y + '년 ' + (leap ? '윤' : '') + m + '월에는 ' + d + '일이 없어요' };
      solar = r; lunar = { y: y, m: m, d: d, leap: leap };
    } else {
      lunar = S.solarToLunar(y, m, d);
    }
    var hv = (document.querySelector('input[name=hour]:checked') || {}).value;
    var exact = $('exact').value, place = PLACES[+$('place').value] || PLACES[0];
    var o = { y: solar.y, m: solar.m, d: solar.d, longitude: place.lng };
    if (exact) { var t = exact.split(':'); o.hour = +t[0]; o.minute = +t[1]; }
    else if (hv && hv !== 'unknown') o.branch = +hv;
    return { o: o, cal: cal, solar: solar, lunar: lunar, exact: exact, hv: hv, place: place };
  }

  // ---------- 그리기 ----------
  function josa(word, a, b) { var c = word.charCodeAt(word.length - 1); if (c < 0xac00 || c > 0xd7a3) return a; return (c - 0xac00) % 28 ? a : b; }
  function joinKo(list) { // 목과 화, 화와 금
    return list.reduce(function (acc, w, i) { return i === 0 ? w : acc + josa(acc, '과', '와') + ' ' + w; }, '');
  }
  function tileHtml(p, isStem, me, tg) {
    var idx = isStem ? p.stem : p.branch, el = isStem ? S.STEM_EL[idx] : S.BRANCH_EL[idx];
    var ch = isStem ? S.STEMS[idx] : S.BRANCHES[idx], ko = isStem ? S.STEMS_KO[idx] : BR_KO[idx];
    return '<div class="tile' + (me ? ' is-me' : '') + '" style="background:' + EL[el].color + '"><b lang="zh-Hant">' + ch + '</b><small>' + ko + ', ' + EL[el].name + '</small>' + (tg ? '<span class="tg">' + (tg === '일간' ? '나' : tg) + '</span>' : '') + '</div>';
  }
  var last = null;
  function render(showError) {
    var inp = readInput();
    $('formError').textContent = '';
    if (inp.error) {
      if (showError) $('formError').textContent = inp.error;
      $('empty').hidden = false; $('filled').hidden = true; last = null; return false;
    }
    var r = S.compute(inp.o);
    var cols = [r.hour, r.day, r.month, r.year];
    var tg = S.tenGodsOf(r), tgIdx = [6, 4, 2, 0]; // 화면 순서(시 일 월 년) -> 십성 배열(년 월 일 시) 자리
    $('pillars').innerHTML = cols.map(function (p, i) {
      if (!p) return '<div class="pl"><div class="lab">' + LABELS[i] + '</div><div class="tile blank"><b>모름</b></div><div class="tile blank"><b>모름</b></div></div>';
      return '<div class="pl"><div class="lab">' + LABELS[i] + '</div>' + tileHtml(p, true, i === 1, tg[tgIdx[i]]) + tileHtml(p, false, false, tg[tgIdx[i] + 1]) + '</div>';
    }).join('');

    // 오행
    var total = r.counts.reduce(function (a, b) { return a + b; }, 0), max = Math.max.apply(null, r.counts);
    $('bars').innerHTML = EL.map(function (e, i) {
      return '<div class="bar"><span class="n" style="color:' + deep(e.color) + '">' + e.name + '</span><span class="t"><i style="width:' + (r.counts[i] / 4 * 100) + '%;background:' + e.color + '"></i></span><span class="c">' + r.counts[i] + '</span></div>';
    }).join('');
    var most = EL.filter(function (e, i) { return r.counts[i] === max; }).map(function (e) { return e.name; });
    var none = EL.filter(function (e, i) { return r.counts[i] === 0; }).map(function (e) { return e.name; });
    var mostTxt = joinKo(most);
    $('balanceLine').innerHTML = '<b>' + mostTxt + '</b>' + josa(mostTxt, '이', '가') + ' 가장 많고, ' +
      (none.length ? joinKo(none) + josa(joinKo(none), '이', '가') + ' 비어 있어요.' : '다섯 기운이 모두 있어요.') +
      (total < 8 ? ' (시를 몰라 여섯 글자로 봤어요)' : '');

    // 나와 오늘
    var dm = DAY_MASTERS[r.dayStem];
    $('meTile').outerHTML = '<div class="tile" id="meTile" style="background:' + EL[r.dayElement].color + '"><b lang="zh-Hant">' + S.STEMS[r.dayStem] + '</b><small>' + S.STEMS_KO[r.dayStem] + ', ' + EL[r.dayElement].name + '</small></div>';
    $('meTitle').textContent = dm.title; $('meLine').textContent = dm.line;
    var now = new Date(), tp = S.dayPillarOfDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
    var tEl = S.STEM_EL[tp.stem], rel = S.relation(r.dayElement, tEl), td = TODAY[rel];
    $('todayMeta').textContent = (now.getMonth() + 1) + '월 ' + now.getDate() + '일의 기운, ' + S.STEMS[tp.stem] + S.BRANCHES[tp.branch] + '일 (' + EL[tEl].name + ')';
    $('todayTitle').textContent = td.title; $('todayText').textContent = td.text; $('todayAct').textContent = td.act;
    // 행운의 색 = 나에게 가장 적은 기운의 색
    var minC = Math.min.apply(null, r.counts), weak = r.counts.indexOf(minC);
    $('luckyColor').textContent = EL[weak].lucky; $('luckyColor').style.color = deep(EL[weak].color);

    // 위쪽 한 줄
    var src = inp.cal === 'lunar'
      ? '음력 ' + inp.lunar.y + '년 ' + (inp.lunar.leap ? '윤' : '') + inp.lunar.m + '월 ' + inp.lunar.d + '일 (양력 ' + inp.solar.y + '. ' + inp.solar.m + '. ' + inp.solar.d + '.)'
      : inp.solar.y + '년 ' + inp.solar.m + '월 ' + inp.solar.d + '일' + (inp.lunar ? ' (음력 ' + (inp.lunar.y !== inp.solar.y ? inp.lunar.y + '년 ' : '') + (inp.lunar.leap ? '윤' : '') + inp.lunar.m + '월 ' + inp.lunar.d + '일)' : '');
    var tm = inp.exact ? ', ' + inp.exact + ' (태양시 ' + pad(r.solarTime.h) + ':' + pad(r.solarTime.m) + ')' : (inp.o.branch != null ? ', ' + BR_KO[inp.o.branch] + '시' : ', 시간 모름');
    $('resMeta').textContent = src + tm;
    $('notes').innerHTML = r.notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');

    // 정확한 시각을 넣으면 해당 시간대 버튼을 같이 표시
    if (inp.exact && r.hour) { var radio = document.querySelector('input[name=hour][value="' + r.hour.branch + '"]'); if (radio) radio.checked = true; }

    $('empty').hidden = true; $('filled').hidden = false;
    last = { r: r, dm: dm, td: td, today: now, tp: tp, weak: weak, mostTxt: mostTxt, none: none };
    resetAI();
    saveInput();
    return true;
  }

  // ---------- 입력 기억 (이 기기에만) ----------
  function saveInput() {
    try { localStorage.setItem(KEY + 'input', JSON.stringify({ cal: calType(), y: $('year').value, m: $('month').value, d: $('day').value, leap: $('leap').checked, hour: (document.querySelector('input[name=hour]:checked') || {}).value || '', exact: $('exact').value, place: $('place').value })); } catch (e) { /* 무시 */ }
  }
  function restoreInput() {
    var v = null; try { v = JSON.parse(localStorage.getItem(KEY + 'input')); } catch (e) { /* 무시 */ }
    if (!v) return false;
    document.querySelector('input[name=cal][value="' + v.cal + '"]').checked = true;
    $('year').value = v.y; $('month').value = v.m; fillDays(); $('day').value = v.d; updateLeap(); $('leap').checked = !!v.leap;
    if (v.hour) { var h = document.querySelector('input[name=hour][value="' + v.hour + '"]'); if (h) h.checked = true; }
    $('exact').value = v.exact || ''; $('place').value = v.place || 0;
    return !!(v.y && v.m && v.d);
  }

  // ---------- 카드 (1080x1350) ----------
  function makeCard() {
    var L = last, r = L.r, cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
    var c = cv.getContext('2d'), sans = getComputedStyle(document.body).fontFamily;
    c.fillStyle = '#F6F1E7'; c.fillRect(0, 0, 1080, 1350);
    c.fillStyle = '#685F54'; c.font = '600 36px ' + sans; c.fillText('나의 여덟 글자', 90, 140);
    // 제목: 폭 900에 맞춰 글자 크기를 줄이고, 그래도 넘으면 두 줄로
    var title = aiReading ? aiReading.headline : L.dm.title, size = 72;
    c.fillStyle = '#1F1D1A';
    do { c.font = '800 ' + size + 'px "Nanum Myeongjo", serif'; size -= 4; } while (c.measureText(title).width > 900 && size >= 48);
    if (c.measureText(title).width <= 900) c.fillText(title, 90, 236);
    else {
      c.font = '800 46px "Nanum Myeongjo", serif';
      var words = title.split(' '), a = '', b = '';
      words.forEach(function (w) { if (!b && c.measureText(a ? a + ' ' + w : w).width <= 900) a = a ? a + ' ' + w : w; else b = b ? b + ' ' + w : w; });
      c.fillText(a, 90, 200); c.fillText(b, 90, 258);
    }
    var cols = [r.hour, r.day, r.month, r.year], x0 = 90, w = 207, gap = 24, h = 200;
    cols.forEach(function (p, i) {
      var x = x0 + i * (w + gap);
      c.fillStyle = '#685F54'; c.font = '600 30px ' + sans; c.textAlign = 'center'; c.fillText(LABELS[i].replace(' (나)', ''), x + w / 2, 320);
      [true, false].forEach(function (isStem, k) {
        var y = 350 + k * (h + 20);
        if (!p) { c.fillStyle = '#EDE5D6'; rr(c, x, y, w, h, 24); c.fill(); c.fillStyle = '#685F54'; c.font = '600 40px ' + sans; c.fillText('모름', x + w / 2, y + h / 2 + 14); return; }
        var idx = isStem ? p.stem : p.branch, el = isStem ? S.STEM_EL[idx] : S.BRANCH_EL[idx];
        c.fillStyle = EL[el].color; rr(c, x, y, w, h, 24); c.fill();
        if (i === 1 && isStem) { c.strokeStyle = '#1F1D1A'; c.lineWidth = 8; rr(c, x - 10, y - 10, w + 20, h + 20, 30); c.stroke(); }
        c.fillStyle = '#fff'; c.font = '900 110px "Noto Serif KR", serif'; c.fillText(isStem ? S.STEMS[idx] : S.BRANCHES[idx], x + w / 2, y + 128);
        c.font = '600 30px ' + sans; c.fillText((isStem ? S.STEMS_KO[idx] : BR_KO[idx]) + ', ' + EL[el].name, x + w / 2, y + 176);
      });
    });
    c.textAlign = 'left';
    var total = r.counts.reduce(function (a, b) { return a + b; }, 0), bx = 90, bw = 900;
    r.counts.forEach(function (n, i) { if (!n) return; var ww = bw * n / total - 8; c.fillStyle = EL[i].color; rr(c, bx, 860, ww, 26, 13); c.fill(); bx += ww + 8; });
    c.fillStyle = '#685F54'; c.font = '600 32px ' + sans;
    c.fillText(EL.map(function (e, i) { return e.name + ' ' + r.counts[i]; }).join('   '), 90, 940);
    c.fillStyle = '#1F1D1A'; c.font = '600 40px ' + sans;
    c.fillText((L.today.getMonth() + 1) + '월 ' + L.today.getDate() + '일, ' + L.td.title, 90, 1060);
    c.fillStyle = '#685F54'; c.font = '500 30px ' + sans; c.fillText('재미와 참고용이에요', 90, 1250);
    c.textAlign = 'right'; c.fillText(SITE.title + ', ' + SITE.shareLine, 990, 1250);
    if (location.host) c.fillText(location.host, 990, 1296);
    return cv;
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  var cardBlob = null;
  function openCard() {
    if (!last) return;
    var go = function () {
      var cv = makeCard(); $('cardImg').src = cv.toDataURL('image/png'); $('cardSave').href = $('cardImg').src;
      cv.toBlob(function (b) { cardBlob = b; });
      if ($('cardDlg').showModal) $('cardDlg').showModal();
    };
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('900 110px "Noto Serif KR"', '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥'), document.fonts.load('800 72px "Nanum Myeongjo"', L_TEXT())]).then(go, go); else go();
  }
  function L_TEXT() { return aiReading ? aiReading.headline : last ? last.dm.title : '가'; }

  // ---------- AI 풀이 ----------
  // 서버(api/reading.js)에는 계산된 글자만 보내요: 여덟 글자, 오행 개수, 십성, 오늘 일진. 생년월일과 시각은 보내지 않아요
  // 같은 사주, 같은 날의 풀이는 이 기기(localStorage)에 저장해 두고 다시 부르지 않아요
  var aiTimer = null, aiReq = 0, aiReading = null;
  function aiPayload() {
    var r = last.r;
    return { pillars: [r.year, r.month, r.day, r.hour].map(function (p) { return p ? S.label(p) : null; }), counts: r.counts, tenGods: S.tenGodsOf(r), today: S.label(last.tp) };
  }
  function aiKey(pl) { var d = last.today; return KEY + 'ai:' + pl.pillars.join('') + '|' + pl.today + '|' + d.getFullYear() + (d.getMonth() + 1) + d.getDate(); }
  function aiShow(state) { ['aiIdle', 'aiLoading', 'aiResult', 'aiError'].forEach(function (id) { $(id).hidden = id !== state; }); $('aiCard').setAttribute('aria-busy', String(state === 'aiLoading')); }
  function resetAI() {
    clearInterval(aiTimer); aiReq++; aiReading = null;
    var saved = null; try { saved = JSON.parse(localStorage.getItem(aiKey(aiPayload()))); } catch (e) { /* 무시 */ }
    if (saved && saved.headline) { renderAI(saved); return; }
    aiShow('aiIdle');
  }
  function renderAI(rd) {
    aiReading = rd;
    $('aiHeadline').textContent = rd.headline;
    $('aiSummary').textContent = rd.summary;
    $('aiSections').innerHTML = rd.sections.map(function (x) { return '<div class="ai-sec"><h4>' + esc(x.title) + '</h4><p>' + esc(x.body) + '</p></div>'; }).join('');
    $('aiAction').textContent = rd.action;
    $('aiKeywords').innerHTML = rd.keywords.map(function (k) { return '<span>' + esc(k) + '</span>'; }).join('');
    aiShow('aiResult');
  }
  function fallbackHtml() {
    var L = last;
    var w = EL[L.weak];
    return '<p><b>' + esc(L.dm.title) + '</b>. ' + esc(L.dm.line) + '이에요.</p><p>' + esc(L.mostTxt) + josa(L.mostTxt, '이', '가') + ' 가장 많아 그 기운을 잘 쓰는 사주예요. ' + w.name + ', 곧 ' + esc(w.desc) + '을 조금 채우면 균형이 좋아져요.</p><p>' + esc(L.td.title) + '. ' + esc(L.td.text) + '</p>';
  }
  function aiFail(msg) {
    clearInterval(aiTimer);
    $('aiErrorMsg').textContent = msg;
    $('aiFallback').innerHTML = fallbackHtml();
    aiShow('aiError');
  }
  function askAI() {
    if (!last) return;
    if (!AI.enabled) return aiFail('AI 풀이가 꺼져 있어 기본 풀이를 보여 드려요.');
    if (location.protocol === 'file:') return aiFail('AI 풀이는 배포한 주소나 dev-server로 열었을 때 돼요. 지금은 기본 풀이를 보여 드려요.');
    var pl = aiPayload(), key = aiKey(pl), my = ++aiReq, step = 0;
    aiShow('aiLoading'); $('aiStatus').textContent = AI.loading[0];
    clearInterval(aiTimer); aiTimer = setInterval(function () { step = Math.min(step + 1, AI.loading.length - 1); $('aiStatus').textContent = AI.loading[step]; }, 2200);
    var ctrl = window.AbortController ? new AbortController() : null, killer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 40000);
    fetch(AI.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pl), signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { j.status = res.status; return j; }); })
      .then(function (j) {
        clearTimeout(killer); clearInterval(aiTimer);
        if (my !== aiReq) return; // 그새 입력이 바뀌었으면 버림
        if (j.status === 200 && j.reading) {
          try { localStorage.setItem(key, JSON.stringify(j.reading)); pruneAI(); } catch (e) { /* 저장이 막혀도 보여 줌 */ }
          renderAI(j.reading); return;
        }
        var msg = j.status === 404 ? 'AI 풀이 서버가 아직 없어요(README의 AI 풀이 켜기). 기본 풀이를 보여 드려요.'
          : j.status === 429 ? (j.error || '조금 뒤에 다시 해 주세요') + '. 그동안 기본 풀이를 보여 드려요.'
          : j.status === 503 ? 'AI 풀이가 아직 연결되지 않았어요. 기본 풀이를 보여 드려요.'
          : '지금은 AI 풀이를 불러오지 못했어요. 기본 풀이를 보여 드려요.';
        aiFail(msg);
      })
      .catch(function () { clearTimeout(killer); if (my === aiReq) aiFail('연결이 늦어 AI 풀이를 불러오지 못했어요. 기본 풀이를 보여 드려요.'); });
  }
  function pruneAI() { // 저장한 풀이는 최근 20개만
    var keys = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(KEY + 'ai:') === 0) keys.push(k); }
    keys.sort().slice(0, Math.max(0, keys.length - 20)).forEach(function (k) { localStorage.removeItem(k); });
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function copyAI() {
    if (!aiReading) return;
    var t = aiReading.headline + '\n\n' + aiReading.summary + '\n\n' + aiReading.sections.map(function (x) { return '[' + x.title + '] ' + x.body; }).join('\n\n') + '\n\n오늘 해 볼 한 가지: ' + aiReading.action + '\n\n' + SITE.title + ' ' + location.href.split('?')[0];
    var done = function () { toast('풀이를 복사했어요'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, function () { toast('복사가 막혔어요'); }); else toast('복사는 https 주소에서 돼요');
  }

  // ---------- 이벤트 ----------
  var toastTimer = null;
  function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200); }
  function live() { if (isWide() || !$('filled').hidden) render(false); }
  document.querySelectorAll('input[name=cal]').forEach(function (x) { x.addEventListener('change', function () { fillDays(); updateLeap(); live(); }); });
  ['year', 'month'].forEach(function (id) { $(id).addEventListener('change', function () { fillDays(); updateLeap(); live(); }); });
  ['day', 'place', 'leap'].forEach(function (id) { $(id).addEventListener('change', live); });
  $('hours').addEventListener('change', function () { $('exact').value = ''; live(); });
  $('hourUnknown').addEventListener('change', function () { $('exact').value = ''; live(); });
  $('exact').addEventListener('change', function () { if (!$('exact').value) { var c = document.querySelector('input[name=hour]:checked'); if (c) c.checked = false; } live(); });
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (render(true)) $('result').scrollIntoView({ block: 'start' });
  });
  $('cardBtn').addEventListener('click', openCard);
  $('aiBtn').addEventListener('click', askAI);
  $('aiRetry').addEventListener('click', askAI);
  $('aiCopy').addEventListener('click', copyAI);
  $('cardShare').addEventListener('click', function () {
    var file = cardBlob && new File([cardBlob], 'eight-letters.png', { type: 'image/png' });
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: SITE.title, text: SITE.shareLine }).catch(function () {});
    else { $('cardSave').click(); toast('공유하기가 없는 브라우저라 이미지를 저장했어요'); }
  });
  $('clearBtn').addEventListener('click', function () {
    try { localStorage.removeItem(KEY + 'input'); } catch (e) { /* 무시 */ }
    $('form').reset(); $('exact').value = ''; fillDays(); updateLeap(); render(false);
    window.scrollTo(0, 0); toast('입력을 지웠어요');
  });

  // ---------- 시작 ----------
  document.title = SITE.title + ' | ' + SITE.tagline;
  $('brand').textContent = SITE.title; $('notice').textContent = SITE.notice;
  buildSelects();
  if (restoreInput()) render(false);
  window.EightLetters = { render: render }; // 점검용
})();
