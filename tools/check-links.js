#!/usr/bin/env node
/* =========================================================================
 * 링크 정합 검사 — 화면 사이 이동이 논리적으로 성립하는지 본다.
 *
 *   실행: node tools/check-links.js
 *
 * [왜 필요한가]
 * 메뉴를 접거나 화면을 은퇴시키면 **그 화면을 가리키던 링크가 남는다.** 링크는
 * 깨지지 않는다 — 파일이 살아 있으니 열린다. 그래서 조용하다. 사용자만
 * "이전 버전 화면" 배너를 마주하고 «그럼 왜 나를 여기로 보냈지» 하게 된다.
 * 2026-08-31 점검에서 실제로 통계·기준문서함·경영방침·프리셋 양식 관리·문서 상세가
 * 그러고 있었다.
 *
 * [무엇을 보는가]
 *   1. 링크 대상 파일이 실재하는가
 *   2. 살아 있는 화면이 은퇴 화면으로 보내는가        ← 이번 사고
 *   3. 링크 문구에 없어진 대메뉴 이름이 남았는가
 *   4. 폐기된 조회 파라미터를 아직 쓰는가
 *   5. 메뉴에도 없고 어디서도 링크하지 않는 화면이 있는가
 *
 * [은퇴 화면을 목록에 적는 자리]
 * RETIRED 는 «메뉴에서 뺐지만 파일은 살아 있는 화면»이다. 새로 은퇴시키면 여기에
 * 적는다 — 적지 않으면 2번 검사가 그 화면을 못 본다.
 * ========================================================================= */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* 메뉴 정의 */
const L = R('js/layout.js');
const a = L.indexOf('const NAV = ['), b = L.indexOf('\n    ];', a);
const NAV = vm.runInThisContext('(' + L.slice(a + 'const NAV = '.length, b + '\n    ]'.length) + ')');
const navItems = [];
NAV.forEach(g => g.items.forEach(it => navItems.push({ ...it, group: g.label, gid: g.id })));

/* 메뉴에서 뺐지만 파일은 살아 있는 화면 */
const RETIRED = new Set(['docs-preset.html', 'docs-exec.html', 'work-admin.html', 'work-dept.html']);
/* 없어진 대메뉴 이름 — 링크 문구에 남으면 사용자가 찾을 수 없는 곳을 찾는다 */
const DEAD_MENU_TEXT = ['업무문서 >', '업무문서 &gt;', '시설물 안전관리', '예산관리 >', '(구)업무관리'];
/* 폐기된 조회 파라미터 */
const DEAD_PARAM = ['ver=v2'];
/* 도달 불가가 «의도된» 화면 — 리다이렉트 스텁·소비처 없는 화면·은퇴 화면 */
const REACH_OK = new Set([
    'admin-law-map.html',   /* 법령 관리 매핑 탭 리다이렉트 스텁 — 외부 북마크 호환 */
    'edu.html',             /* 이수현황 리다이렉트 스텁 */
    'rsk-my.html',          /* 소비처 없는 화면(CLAUDE.md §6) */
    ...RETIRED,             /* 은퇴 화면 — 주소로만 여는 것이 확정된 상태다 */
]);
/* 링크가 아니라 «돌아갈 곳 허용 목록»인 파일 — 은퇴 화면이 들어 있는 것이 정상이다
   (그 화면에서 왔으면 그 화면으로 돌아가야 한다) */
const BACK_ALLOWLIST = new Set(['js/doc-upload.js']);
/* 데이터·매핑 파일 — 링크가 아니다 */
const DATA_FILES = new Set(['js/screen-defs-data.js', 'js/doc-history-data.js', 'js/law-map.js',
    'js/doc-taxonomy-data.js', 'js/doc-seed-2026.js', 'js/cmp-dept-docs.js', 'js/law-admin-seed.js',
    'js/law-plain.js', 'js/law-sync-seed.js', 'js/policy-open.js', 'js/help-center.js']);

const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
const files = [...htmlFiles, ...jsFiles.filter(f => !DATA_FILES.has(f))];

/* 어느 화면이 그 모듈을 로드하는가 — 모듈의 «살아 있음»은 그것을 싣는 화면이 정한다 */
const loadedBy = {};
htmlFiles.forEach(h => (R(h).match(/src="\.\/(js\/[\w\-.]+\.js)"/g) || []).forEach(m => {
    const f = m.match(/js\/[\w\-.]+\.js/)[0];
    (loadedBy[f] = loadedBy[f] || []).push(h);
}));
/* 은퇴 화면에서만 쓰이는 모듈은 그 자체가 은퇴한 것이다 */
const isRetiredSide = (f) => RETIRED.has(f) ||
    (f.startsWith('js/') && (loadedBy[f] || []).length > 0 && (loadedBy[f] || []).every(h => RETIRED.has(h)));

/* 링크 추출 — 주석 줄은 뺀다(설명문의 파일명은 링크가 아니다) */
const links = [];
files.forEach(f => R(f).split('\n').forEach((ln, idx) => {
    const t = ln.trim();
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
    let m; const rx = /['"`]([\w\-]+\.html(?:\?[^'"`\s]*)?)['"`]/g;
    while ((m = rx.exec(ln))) links.push({ from: f, line: idx + 1, target: m[1], ctx: t.slice(0, 240) });
}));

let fail = 0;
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); fail++; };
const at = (l) => l.from + ':' + l.line;

console.log('링크 정합 검사 — 파일 ' + files.length + ' · 링크 ' + links.length + '\n');

/* 1 */
const deadFile = [...new Set(links.map(l => l.target.split('?')[0]))].filter(f => !fs.existsSync(path.join(ROOT, f)));
deadFile.length ? bad('없는 파일로 가는 링크: ' + deadFile.join(', ')) : ok('링크 대상 파일 전건 실재');

/* 2 — 이번 사고의 본체 */
const toRetired = links.filter(l => RETIRED.has(l.target.split('?')[0])
    && !isRetiredSide(l.from) && l.from !== 'js/layout.js' && !BACK_ALLOWLIST.has(l.from));
toRetired.length
    ? bad('살아 있는 화면 → 은퇴 화면 ' + toRetired.length + '건: ' + toRetired.map(at).join(', ')
        + ' — 사용자가 «이전 버전» 화면에 도착한다')
    : ok('살아 있는 화면에서 은퇴 화면으로 보내는 링크 없음');

/* 3 */
const staleLabel = links.filter(l => !isRetiredSide(l.from) && l.from !== 'js/layout.js'
    && DEAD_MENU_TEXT.some(d => l.ctx.includes(d)));
staleLabel.length
    ? bad('없어진 대메뉴 이름이 링크 문구에 남음: ' + staleLabel.map(at).join(', '))
    : ok('링크 문구에 없어진 대메뉴 이름 없음');

/* 4 */
const staleParam = links.filter(l => DEAD_PARAM.some(p => l.target.includes(p)));
staleParam.length
    ? bad('폐기된 조회 파라미터 사용: ' + staleParam.map(at).join(', '))
    : ok('폐기된 조회 파라미터 없음');

/* 5 */
const visible = new Set(navItems.filter(it => !it.hidden).map(it => (it.href || '').split('?')[0]).filter(Boolean));
const inbound = {};
links.forEach(l => { const t = l.target.split('?')[0]; if (t !== l.from && l.from !== 'js/layout.js') (inbound[t] = inbound[t] || new Set()).add(l.from); });
const orphan = htmlFiles.filter(f => !/^(onepager|screen-definitions)/.test(f))
    .filter(f => !visible.has(f) && !(inbound[f] && inbound[f].size) && !REACH_OK.has(f));
orphan.length
    ? bad('메뉴에도 없고 어디서도 링크하지 않는 화면: ' + orphan.join(', ')
        + ' — 의도한 것이면 REACH_OK 에 사유와 함께 적는다')
    : ok('의도치 않은 도달 불가 화면 없음');

console.log(fail ? '\n✖ 위반 ' + fail + '건' : '\n✔ 링크 정합 5종 전건 통과');
process.exit(fail ? 1 : 0);
