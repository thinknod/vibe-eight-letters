/* saju.js : 사주 여덟 글자 계산 (라이브러리 없이, 브라우저 안에서만)
 *
 * 무엇을 계산하나
 *   - 절기: 태양의 겉보기 황경(VSOP87 주요 항, Meeus, Astronomical Algorithms 25, 32장)
 *   - 합삭(새달): Meeus 49장
 *   - 한국 음력: 합삭이 든 날(한국 시간)이 초하루, 동지가 든 달이 11월, 중기가 없는 첫 달이 윤달
 *   - 네 기둥: 년주는 입춘, 월주는 절입, 일주와 시주는 태어난 곳의 평균 태양시(서울 약 -32분)
 *
 * 범위와 한계 (화면에도 안내)
 *   - 1900~2050년. 절기 시각은 공개 값과 1분 안팎으로 맞는다. 절입 시각 10분 앞뒤에 태어났다면 안내를 띄운다
 *   - 서머타임은 자동으로 빼지 않는다(해당 시기면 안내만)
 *   - 23시 이후(야자시)는 그날 일주를 유지하고, 시주 천간은 다음 날 기준
 *
 * 이 파일은 고칠 일이 거의 없다. 글과 색은 data.js에서 바꾼다.
 * 맞는지 확인: check.html을 열면 알려진 날짜 수십 개와 대조한 결과가 나온다.
 */
(function (root) {
  'use strict';

  var STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var STEMS_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  var BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var BRANCHES_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  // 오행: 0 목, 1 화, 2 토, 3 금, 4 수
  var STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
  var BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  var EL_KO = ['목', '화', '토', '금', '수'];

  var RAD = Math.PI / 180;
  function norm360(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function mod(a, n) { return ((a % n) + n) % n; }

  // ---------- 날짜와 율리우스일 ----------
  // 그레고리력 날짜(시각 포함, 분수 일) -> 율리우스일(JD)
  function toJD(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  // JD -> {y, m, d(분수 포함)}
  function fromJD(jd) {
    var z = Math.floor(jd + 0.5), f = jd + 0.5 - z, A = z;
    if (z >= 2299161) { var al = Math.floor((z - 1867216.25) / 36524.25); A = z + 1 + al - Math.floor(al / 4); }
    var B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
    var day = B - D - Math.floor(30.6001 * E) + f, mo = E < 14 ? E - 1 : E - 13, yr = mo > 2 ? C - 4716 : C - 4715;
    return { y: yr, m: mo, d: day };
  }
  // 정수 날짜의 일련번호(JDN). 일진 계산과 날짜 비교에 쓴다
  function jdn(y, m, d) { return Math.floor(toJD(y, m, d) + 0.5); }
  function jdnToDate(n) { var r = fromJD(n); return { y: r.y, m: r.m, d: Math.floor(r.d) }; }

  // 지구 자전 보정(ΔT, 초). 10년 단위 값을 이어 붙인 근사
  var DT = [[1900, -2.7], [1910, 10.4], [1920, 21.2], [1930, 24.0], [1940, 24.3], [1950, 29.1], [1960, 33.1],
    [1970, 40.2], [1980, 50.5], [1990, 56.9], [2000, 63.8], [2010, 66.1], [2020, 69.4], [2030, 72.0], [2050, 78.0]];
  function deltaT(year) {
    if (year <= DT[0][0]) return DT[0][1];
    for (var i = 1; i < DT.length; i++) {
      if (year <= DT[i][0]) { var a = DT[i - 1], b = DT[i]; return a[1] + (b[1] - a[1]) * (year - a[0]) / (b[0] - a[0]); }
    }
    return DT[DT.length - 1][1];
  }
  function jdUTtoTT(jd) { return jd + deltaT(fromJD(jd).y) / 86400; }
  function jdTTtoUT(jd) { return jd - deltaT(fromJD(jd).y) / 86400; }

  // ---------- 태양 황경 ----------
  // VSOP87 지구 황경 주요 항(Meeus, Astronomical Algorithms 32장 표 32.A). [진폭, 위상, 진동수]
  var VL = [
    [[175347046,0,0],[3341656,4.6692568,6283.07585],[34894,4.6261024,12566.1517],[3497,2.7441178,5753.3848849],[3418,2.8288658,3.5231183],[3136,3.6276704,77713.7714681],[2676,4.4180835,7860.4193924],[2343,6.1351621,3930.2096962],[1324,0.7424634,11506.7697698],[1273,2.0370966,529.6909651],[1199,1.1096295,1577.3435424],[990,5.233,5884.927],[902,2.045,26.298],[857,3.508,398.149],[780,1.179,5223.694],[753,2.533,5507.553],[505,4.583,18849.228],[492,4.205,775.523],[357,2.92,0.067],[317,5.849,11790.629],[284,1.899,796.298],[271,0.315,10977.079],[243,0.345,5486.778],[206,4.806,2544.314],[205,1.869,5573.143],[202,2.458,6069.777],[156,0.833,213.299],[132,3.411,2942.463],[126,1.083,20.775],[115,0.645,0.98],[103,0.636,4694.003],[102,0.976,15720.839],[102,4.267,7.114],[99,6.21,2146.17],[98,0.68,155.42],[86,5.98,161000.69],[85,1.3,6275.96],[85,3.67,71430.7],[80,1.81,17260.15],[79,3.04,12036.46],[75,1.76,5088.63],[74,3.5,3154.69],[74,4.68,801.82],[70,0.83,9437.76],[62,3.98,8827.39],[61,1.82,7084.9],[57,2.78,6286.6],[56,4.39,14143.5],[56,3.47,6279.55],[52,0.19,12139.55],[52,1.33,1748.02],[51,0.28,5856.48],[49,0.49,1194.45],[41,5.37,8429.24],[41,2.4,19651.05],[39,6.17,10447.39],[37,6.04,10213.29],[37,2.57,1059.38],[36,1.71,2352.87],[36,1.78,6812.77],[33,0.59,17789.85],[30,0.44,83996.85],[30,2.74,1349.87],[25,3.16,4690.48]],
    [[628331966747,0,0],[206059,2.678235,6283.07585],[4303,2.6351,12566.1517],[425,1.59,3.523],[119,5.796,26.298],[109,2.966,1577.344],[93,2.59,18849.23],[72,1.14,529.69],[68,1.87,398.15],[67,4.41,5507.55],[59,2.89,5223.69],[56,2.17,155.42],[45,0.4,796.3],[36,0.47,775.52],[29,2.65,7.11],[21,5.34,0.98],[19,1.85,5486.78],[19,4.97,213.3],[17,2.99,6275.96],[16,0.03,2544.31],[16,1.43,2146.17],[15,1.21,10977.08],[12,2.83,1748.02],[12,3.26,5088.63],[12,5.27,1194.45],[12,2.08,4694],[11,0.77,553.57],[10,1.3,6286.6],[10,4.24,1349.87],[9,2.7,242.73],[9,5.64,951.72],[8,5.3,2352.87],[6,2.65,9437.76],[6,4.67,4690.48]],
    [[52919,0,0],[8720,1.0721,6283.0758],[309,0.867,12566.152],[27,0.05,3.52],[16,5.19,26.3],[16,3.68,155.42],[10,0.76,18849.23],[9,2.06,77713.77],[7,0.83,775.52],[5,4.66,1577.34],[4,1.03,7.11],[4,3.44,5573.14],[3,5.14,796.3],[3,6.05,5507.55],[3,1.19,242.73],[3,6.12,529.69],[3,0.31,398.15],[3,2.28,553.57],[2,4.38,5223.69],[2,3.75,0.98]],
    [[289,5.844,6283.076],[35,0,0],[17,5.49,12566.15],[3,5.2,155.42],[1,4.72,3.52],[1,5.3,18849.23],[1,5.97,242.73]],
    [[114,3.142,0],[8,4.13,6283.08],[1,3.84,12566.15]],
    [[1,3.14,0]]
  ];
  // 태양의 겉보기 황경(도). jdTT = 역학시 율리우스일
  function sunLongitude(jdTT) {
    var tau = (jdTT - 2451545) / 365250, L = 0, tp = 1;
    for (var n = 0; n < VL.length; n++) {
      var sum = 0, rows = VL[n];
      for (var i = 0; i < rows.length; i++) sum += rows[i][0] * Math.cos(rows[i][1] + rows[i][2] * tau);
      L += sum * tp; tp *= tau;
    }
    var lam = norm360(L / 1e8 / RAD + 180);              // 지구 일심 황경 -> 태양 지심 황경
    var T = tau * 10;
    var om = (125.04452 - 1934.136261 * T) * RAD, Ls = (280.4665 + 36000.7698 * T) * RAD, Lm = (218.3165 + 481267.8813 * T) * RAD;
    var dpsi = -17.2 * Math.sin(om) - 1.32 * Math.sin(2 * Ls) - 0.23 * Math.sin(2 * Lm) + 0.21 * Math.sin(2 * om); // 장동(초)
    return norm360(lam + (-0.09033 + dpsi - 20.4898) / 3600); // FK5 보정, 장동, 광행차
  }
  // 태양 황경이 target(도)이 되는 순간(JD, 세계시). guess 근처에서 찾는다
  function solarTermJD(target, guessUT) {
    var jd = guessUT;
    for (var i = 0; i < 8; i++) {
      var diff = target - sunLongitude(jdUTtoTT(jd));
      diff = mod(diff + 180, 360) - 180;
      jd += diff * 365.2422 / 360;
      if (Math.abs(diff) < 1e-7) break;
    }
    return jd;
  }

  // ---------- 합삭 ----------
  function newMoonTT(k) {
    var T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
    var E = 1 - 0.002516 * T - 0.0000074 * T2;
    var M = (2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3) * RAD;
    var Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * RAD;
    var F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * RAD;
    var Om = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * RAD;
    var s = Math.sin;
    jde += -0.4072 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F)
      + 0.00739 * E * s(Mp - M) - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M)
      - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M)
      - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
      - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M)
      + 0.00004 * s(2 * Mp - 2 * F) + 0.00004 * s(3 * M) + 0.00003 * s(Mp + M - 2 * F)
      + 0.00003 * s(2 * Mp + 2 * F) - 0.00003 * s(Mp + M + 2 * F) + 0.00003 * s(Mp - M + 2 * F)
      - 0.00002 * s(Mp - M - 2 * F) - 0.00002 * s(3 * Mp + M) + 0.00002 * s(4 * Mp);
    var A = [[299.77, 0.107408, 0.000325], [251.88, 0.016321, 0.000165], [251.83, 26.651886, 0.000164],
      [349.42, 36.412478, 0.000126], [84.66, 18.206239, 0.00011], [141.74, 53.303771, 0.000062],
      [207.14, 2.453732, 0.00006], [154.84, 7.30686, 0.000056], [34.52, 27.261239, 0.000047],
      [207.19, 0.121824, 0.000042], [291.34, 1.844379, 0.00004], [161.72, 24.198154, 0.000037],
      [239.56, 25.513099, 0.000035], [331.55, 3.592518, 0.000023]];
    for (var i = 0; i < A.length; i++) {
      var arg = A[i][0] + A[i][1] * k - (i === 0 ? 0.009173 * T2 : 0);
      jde += A[i][2] * s(arg * RAD);
    }
    return jde;
  }

  // ---------- 한국 표준시 ----------
  // 1954-03-21 ~ 1961-08-09, 1908~1911은 UTC+8:30, 나머지는 UTC+9 (시간 단위)
  function koreaOffset(y, m, d) {
    var n = jdn(y, m, d);
    if (n < jdn(1912, 1, 1)) return 8.5;
    if (n >= jdn(1954, 3, 21) && n < jdn(1961, 8, 10)) return 8.5;
    return 9;
  }
  // 세계시 JD -> 한국 날짜의 JDN
  function kstDayOfUT(jdUT) {
    var g = fromJD(jdUT);
    var off = koreaOffset(g.y, g.m, Math.floor(g.d));
    return Math.floor(jdUT + off / 24 + 0.5);
  }

  // ---------- 음력 ----------
  var lunarCache = {};
  // 동지가 든 날(한국 날짜 JDN)
  function winterSolsticeDay(y) {
    return kstDayOfUT(solarTermJD(270, toJD(y, 12, 21)));
  }
  // jdnDay와 같거나 그 전의 합삭이 든 날(JDN)과 k
  function newMoonOnOrBefore(dayN) {
    var g = jdnToDate(dayN);
    var k = Math.floor((g.y + (g.m - 1) / 12 + g.d / 365 - 2000) * 12.3685) + 1;
    for (;;) {
      var nd = kstDayOfUT(jdTTtoUT(newMoonTT(k)));
      if (nd <= dayN) return { k: k, day: nd };
      k -= 1;
    }
  }
  function nmDay(k) { return kstDayOfUT(jdTTtoUT(newMoonTT(k))); }
  // 그 달(초하루 a ~ 다음 초하루 b 전날)에 중기(황경이 30의 배수)가 드는가
  function hasZhongqi(a, b) {
    var lon = sunLongitude(jdUTtoTT(a - 0.5 - 9 / 24));
    var next = Math.ceil(lon / 30 + 1e-9) * 30;
    var t = solarTermJD(norm360(next), a - 0.5 + ((next - lon) * 365.2422 / 360));
    return kstDayOfUT(t) < b;
  }
  // 음력 해 Y의 달 목록: 동지 달(Y-1의 11월)부터 Y의 11월 전까지 + 여유
  function lunarYear(Y) {
    if (lunarCache[Y]) return lunarCache[Y];
    var s1 = newMoonOnOrBefore(winterSolsticeDay(Y - 1)); // 전해 11월 초하루
    var s2 = newMoonOnOrBefore(winterSolsticeDay(Y));     // 올해 11월 초하루
    var n = Math.round((s2.day - s1.day) / 29.53);       // 12 또는 13
    var months = [], leapFound = n === 12, num = 11, kk = s1.k;
    for (var i = 0; i < n; i++) {
      var a = nmDay(kk), b = nmDay(kk + 1), leap = false;
      if (i > 0 && !leapFound && !hasZhongqi(a, b)) { leap = true; leapFound = true; }
      if (i > 0 && !leap) num = num === 12 ? 1 : num + 1;
      months.push({ y: num >= 11 && i < 3 ? Y - 1 : Y, m: num, leap: leap, start: a, days: b - a });
      kk += 1;
    }
    lunarCache[Y] = months;
    return months;
  }
  // 음력 -> 양력. 없는 날이면 null
  function lunarToSolar(y, m, d, leap) {
    var list = lunarYear(y).concat(lunarYear(y + 1));
    for (var i = 0; i < list.length; i++) {
      var mo = list[i];
      if (mo.y === y && mo.m === m && mo.leap === !!leap) {
        if (d < 1 || d > mo.days) return null;
        return jdnToDate(mo.start + d - 1);
      }
    }
    return null;
  }
  // 양력 -> 음력 {y, m, d, leap}
  function solarToLunar(y, m, d) {
    var n = jdn(y, m, d);
    var list = lunarYear(y).concat(lunarYear(y + 1));
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].start <= n) return { y: list[i].y, m: list[i].m, d: n - list[i].start + 1, leap: list[i].leap };
    }
    return null;
  }
  // 그 해에 윤달이 몇 월인지(없으면 0)
  function leapMonthOf(y) {
    var list = lunarYear(y).concat(lunarYear(y + 1));
    for (var i = 0; i < list.length; i++) if (list[i].leap && list[i].y === y) return list[i].m;
    return 0;
  }

  // ---------- 네 기둥 ----------
  function pillar(idx60) { return { stem: idx60 % 10, branch: idx60 % 12, idx: idx60 }; }
  function idxOf(stem, branch) { for (var i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i; return -1; }
  function dayPillarOfDate(y, m, d) { return pillar(mod(jdn(y, m, d) + 49, 60)); }

  // 서머타임 가능 시기(안내용)
  var DST_YEARS = [1948, 1949, 1950, 1951, 1955, 1956, 1957, 1958, 1959, 1960, 1987, 1988];

  /**
   * 사주 계산
   * @param {object} o { y, m, d: 양력 날짜, hour, minute: 시계 시각(모르면 hour = null),
   *                     branch: 시각 대신 고른 시간대(0 자 ~ 11 해, 선택), longitude: 태어난 곳 경도(기본 서울 126.98) }
   * 시간대(branch)로 고르면 자시는 그날 새벽(0~1시)으로 본다
   */
  function compute(o) {
    var lon = o.longitude == null ? 126.98 : o.longitude;
    var known = o.hour != null;
    var byBranch = !known && o.branch != null;
    var hh = known ? o.hour : 12, mm = known ? (o.minute || 0) : 0;
    var off = koreaOffset(o.y, o.m, o.d);
    var jdUT = toJD(o.y, o.m, o.d + (hh + mm / 60 - off) / 24);
    var notes = [];

    // 년주와 월주: 태양 황경
    var lam = sunLongitude(jdUTtoTT(jdUT));
    var yy = o.y;
    if (o.m <= 2 && lam < 315 && lam > 180) yy -= 1;
    var yearP = pillar(mod(yy - 4, 60));
    var mi = Math.floor(mod(lam - 315, 360) / 30); // 0 = 인월
    var mStem = mod((yearP.stem % 5) * 2 + 2 + mi, 10);
    var monthP = pillar(idxOf(mStem, mod(2 + mi, 12)));

    // 절입 시각과 가까우면 안내 (경계 앞뒤 10분, 태양은 하루에 약 1도)
    var edge = mod(lam - 315, 30);
    if (known && (edge < 0.007 || edge > 29.993)) notes.push('절기가 바뀌는 시각 바로 앞뒤에 태어났어요. 월주(또는 년주)가 만세력마다 다를 수 있어요.');

    // 일주와 시주: 평균 태양시
    var local = jdUT + lon / 360; // 경도 15도 = 1시간
    var lg = fromJD(local);
    var ld = Math.floor(lg.d), lh = (lg.d - ld) * 24;
    var dayP = dayPillarOfDate(lg.y, lg.m, ld);
    var hourP = null, solarH = null, solarM = null;
    if (known) {
      solarH = Math.floor(lh); solarM = Math.floor((lh - solarH) * 60 + 1e-6);
      var br = Math.floor((lh + 1) / 2) % 12;
      var baseStem = dayP.stem;
      if (lh >= 23) baseStem = (dayP.stem + 1) % 10; // 야자시: 일주는 그대로, 시 천간은 다음 날 기준
      hourP = pillar(idxOf(mod((baseStem % 5) * 2 + br, 10), br));
      if (lh >= 23) notes.push('밤 11시 이후(야자시)라 그날 일주를 썼어요. 다음 날 일주로 보는 풀이도 있어요.');
    }
    if (byBranch) {
      hourP = pillar(idxOf(mod((dayP.stem % 5) * 2 + o.branch, 10), o.branch));
      if (o.branch === 0) notes.push('자시는 그날 새벽(0~1시)으로 계산했어요. 밤 11시대에 태어났다면 정확한 시각을 넣어 주세요.');
    }
    // 시각을 모르는데 그날 절기가 바뀌면 안내 (그날 0시와 24시의 월이 다르다)
    if (!known) {
      var j0 = toJD(o.y, o.m, o.d - off / 24), l0 = sunLongitude(jdUTtoTT(j0)), l1 = sunLongitude(jdUTtoTT(j0 + 1));
      if (Math.floor(mod(l0 - 315, 360) / 30) !== Math.floor(mod(l1 - 315, 360) / 30)) notes.push('이날은 절기가 바뀌는 날이라, 태어난 시각에 따라 월주가 달라질 수 있어요. 정확한 시각을 넣으면 더 정확해요.');
    }
    if (known && DST_YEARS.indexOf(o.y) >= 0 && o.m >= 5 && o.m <= 10) notes.push(o.y + '년 여름에는 서머타임이 있었어요. 그때 시계가 한 시간 빨랐다면 한 시간 뺀 시각으로 다시 넣어 보세요.');
    if (off === 8.5 && o.y >= 1954) notes.push('1954~1961년에는 표준시가 지금과 30분 달랐어요. 계산에 반영했어요.');
    if (o.y < 1900 || o.y > 2050) notes.push('1900~2050년 밖이라 정확하지 않을 수 있어요.');

    var pillars = [yearP, monthP, dayP, hourP];
    var counts = [0, 0, 0, 0, 0];
    pillars.forEach(function (p) { if (!p) return; counts[STEM_EL[p.stem]]++; counts[BRANCH_EL[p.branch]]++; });

    return {
      year: yearP, month: monthP, day: dayP, hour: hourP,
      counts: counts, dayStem: dayP.stem, dayElement: STEM_EL[dayP.stem],
      solarTime: known ? { h: solarH, m: solarM } : null,
      sunLongitude: lam, notes: notes
    };
  }

  // 나(일간)와 오늘(일진 천간)의 관계: same 같은 기운, iMake 내가 낳음, makesMe 나를 도움, iRule 내가 다스림, rulesMe 나를 다스림
  function relation(myEl, otherEl) {
    var d = mod(otherEl - myEl, 5);
    return ['same', 'iMake', 'iRule', 'rulesMe', 'makesMe'][d];
  }

  // 십성: 나(일간)와 다른 글자의 관계 열 가지. 지지는 본기(가장 큰 기운의 천간)로 본다
  var TEN_GODS = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
  var BRANCH_MAIN = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8]; // 子癸 丑己 寅甲 卯乙 辰戊 巳丙 午丁 未己 申庚 酉辛 戌戊 亥壬
  function tenGod(dayStem, stem) {
    var rel = relation(STEM_EL[dayStem], STEM_EL[stem]), same = dayStem % 2 === stem % 2;
    var base = { same: 0, iMake: 2, iRule: 4, rulesMe: 6, makesMe: 8 }[rel];
    return TEN_GODS[base + (same ? 0 : 1)];
  }
  // 네 기둥의 십성 [년 천간, 년 지지, 월 천간, 월 지지, 일 천간(나), 일 지지, 시 천간, 시 지지]
  function tenGodsOf(r) {
    var out = [];
    [r.year, r.month, r.day, r.hour].forEach(function (p, i) {
      if (!p) { out.push(null, null); return; }
      out.push(i === 2 ? '일간' : tenGod(r.dayStem, p.stem), tenGod(r.dayStem, BRANCH_MAIN[p.branch]));
    });
    return out;
  }

  function label(p) { return p ? STEMS[p.stem] + BRANCHES[p.branch] : ''; }
  function labelKo(p) { return p ? STEMS_KO[p.stem] + BRANCHES_KO[p.branch] : ''; }

  var Saju = {
    STEMS: STEMS, STEMS_KO: STEMS_KO, BRANCHES: BRANCHES, BRANCHES_KO: BRANCHES_KO,
    STEM_EL: STEM_EL, BRANCH_EL: BRANCH_EL, EL_KO: EL_KO,
    compute: compute, relation: relation, dayPillarOfDate: dayPillarOfDate,
    TEN_GODS: TEN_GODS, tenGod: tenGod, tenGodsOf: tenGodsOf,
    lunarToSolar: lunarToSolar, solarToLunar: solarToLunar, leapMonthOf: leapMonthOf,
    solarTermJD: solarTermJD, sunLongitude: sunLongitude, newMoonTT: newMoonTT,
    toJD: toJD, fromJD: fromJD, jdUTtoTT: jdUTtoTT, jdTTtoUT: jdTTtoUT,
    label: label, labelKo: labelKo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Saju;
  else root.Saju = Saju;
})(this);
