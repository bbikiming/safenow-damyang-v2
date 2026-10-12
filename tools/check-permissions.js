#!/usr/bin/env node
/* =========================================================================
 * 권한 정합 검사 — 코드(js/adm-perm.js)와 정본 문서(_공통_권한정의.md)를 대조한다.
 *
 *   실행: node tools/check-permissions.js
 *
 * [왜 필요한가]
 * 문서 §5 는 「결재 이력은 재난안전과로 한정한다」고 확정해 두었는데 코드 시드는
 * 전 등급 보기였다. 둘이 갈린 것을 아무도 몰랐고, 갈렸다는 사실 자체가 조용했다 —
 * 문법 오류도 콘솔 경고도 나지 않기 때문이다. 이 검사가 그 침묵을 깬다.
 *
 * [무엇을 보는가]
 *   1. 프로필 키가 실재 메뉴인가            (죽은 키 = 아무 동작 없는 지정)
 *   2. 프로필·지정이 참조하는 등급·부서·사람이 실재하는가
 *   3. 미설정 메뉴가 시스템 관리 밖에 있는가 (= 아무도 못 보는 업무 화면)
 *   4. 시스템 관리자가 전 메뉴에 닿는가
 *   5. 수정 ⇒ 보기 가 전 사용자 × 전 메뉴에서 성립하는가
 *   6. 문서 §4-3 배정표와 코드의 배정이 같은가
 *   7. 문서 §3 등급표와 코드의 등급이 같은가
 * ========================================================================= */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ── 브라우저 없이 adm-perm.js 를 띄운다 ── */
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
global.sessionStorage = global.localStorage;
global.window = global;
global.document = {
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
    body: { appendChild() {}, classList: { add() {}, remove() {} } },
};
/* node 22 의 navigator 는 getter 전용이라 대입이 던진다 — 없을 때만 정의한다 */
if (!global.navigator) { try { global.navigator = { userAgent: 'node' }; } catch (e) {} }
global.matchMedia = () => ({ matches: false, addEventListener() {} });

const L = R('js/layout.js');
const i = L.indexOf('const NAV = ['), j = L.indexOf('\n    ];', i);
global.DYLayout = { NAV: vm.runInThisContext('(' + L.slice(i + 'const NAV = '.length, j + '\n    ]'.length) + ')') };
global.DYROLE = { OWNER_DEPT: 'safety' };
vm.runInThisContext(R('js/common.js'), { filename: 'common.js' });
vm.runInThisContext(R('js/adm-perm.js'), { filename: 'adm-perm.js' });
const A = global.DYADM;

let fail = 0;
const ok  = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); fail++; };

const menus = A.middleMenus();
const byId = Object.fromEntries(menus.map(m => [m.id, m]));
const roleIds = new Set(A.roles().map(r => r.id));

console.log('권한 정합 검사 — 메뉴 ' + menus.length + '개 · 등급 ' + A.roles().length + '개 · 인원 ' + A.PEOPLE.length + '명\n');

/* 1. 프로필 키가 실재 메뉴인가 */
const deadKeys = Object.keys(A.MENU_PROFILE).filter(k => !byId[k]);
deadKeys.length
    ? bad('메뉴 정의에 없는 프로필 키: ' + deadKeys.join(', ') + ' — 아무 동작도 하지 않으면서 "개별 권한이 있다"고 읽힌다')
    : ok('프로필 키 전건 실재');

/* 2. 참조 무결성 */
const refBad = [];
Object.entries(A.PROFILE).forEach(([p, list]) => list.forEach(a => {
    if (a.kind === 'role' && !roleIds.has(a.id)) refBad.push('프로필 ' + p + ' → 없는 등급 ' + a.id);
    if (a.kind === 'dept' && !A.nodeById(a.id))  refBad.push('프로필 ' + p + ' → 없는 부서 ' + a.id);
}));
A.roles().forEach(r => (r.members || []).forEach(m => {
    if (m.kind === 'user' && !A.personByUid(m.id)) refBad.push('등급 ' + r.id + ' → 없는 사람 ' + m.id);
    if (m.kind === 'dept' && !A.nodeById(m.id))    refBad.push('등급 ' + r.id + ' → 없는 부서 ' + m.id);
}));
menus.forEach(m => A.getAssignments(m.id).forEach(a => {
    if (a.kind === 'role' && !roleIds.has(a.id))   refBad.push('메뉴 ' + m.id + ' → 없는 등급 ' + a.id);
    if (a.kind === 'dept' && !A.nodeById(a.id))    refBad.push('메뉴 ' + m.id + ' → 없는 부서 ' + a.id);
    if (a.kind === 'user' && !A.personByUid(a.id)) refBad.push('메뉴 ' + m.id + ' → 없는 사람 ' + a.id);
}));
refBad.length ? bad('참조 오류 ' + refBad.length + '건: ' + refBad.join(' / ')) : ok('등급·부서·사람 참조 전건 실재');

/* 3. 업무 화면이 아무에게도 안 보이는 상태 */
const orphan = menus.filter(m => m.groupId !== 'admin' && A.getAssignments(m.id).length === 0);
orphan.length
    ? bad('시스템 관리 밖 미설정 메뉴: ' + orphan.map(m => m.label).join(', ') + ' — 시스템 관리자만 보인다')
    : ok('미설정 = 시스템 관리 전용');

/* 4. 시스템 관리자 전 메뉴 도달 */
const sysUid = (A.roles().find(r => r.fullAccess) || { members: [] }).members
    .filter(m => m.kind === 'user').map(m => m.id)[0];
if (!sysUid) bad('전체 권한 등급에 구성원이 없다');
else {
    const eff = A.effectiveForUser(sysUid);
    const miss = menus.filter(m => !(eff[m.id].view && eff[m.id].edit));
    miss.length ? bad('시스템 관리자가 못 여는 메뉴: ' + miss.map(m => m.label).join(', '))
                : ok('시스템 관리자 전 메뉴 보기·수정');
}

/* 5. 수정 ⇒ 보기 */
let ev = 0;
A.PEOPLE.forEach(p => { const e = A.effectiveForUser(p.uid); menus.forEach(m => { if (e[m.id].edit && !e[m.id].view) ev++; }); });
ev ? bad('수정 가능한데 보기 불가 ' + ev + '건') : ok('수정 ⇒ 보기 (' + A.PEOPLE.length + '명 × ' + menus.length + '메뉴)');

/* ── 6~7. 문서 대조 ─────────────────────────────────────────────────── */
const DOC = R('docs/screen-definitions/_공통_권한정의.md');

/* 6. §4-3 배정표 ↔ 코드 MENU_PROFILE
      문서는 메뉴를 '이름'으로 적으므로 이름 → 프로필로 뒤집어 대조한다. */
const DOC_PROFILE_NAME = {
    settings: '기준값·연계 설정', ownerView: '주관부서 조회',
    personal: '개인정보', openWrite: '전 직원 등록',
};
const sec = DOC.slice(DOC.indexOf('### 4-3.'), DOC.indexOf('### 4-4.'));
const drift = [];
Object.entries(DOC_PROFILE_NAME).forEach(([key, label]) => {
    const row = sec.split('\n').find(l => l.startsWith('| ' + label + ' |'));
    if (!row) { drift.push('문서 §4-3 에 "' + label + '" 행이 없다'); return; }
    const codeMenus = Object.entries(A.MENU_PROFILE).filter(([, v]) => v === key)
        .map(([k]) => byId[k] && byId[k].label).filter(Boolean);
    codeMenus.forEach(name => {
        if (row.indexOf(name.replace(/\s*\(.*\)$/, '')) < 0) {
            drift.push('"' + name + '" 는 코드에서 ' + label + ' 인데 문서 §4-3 그 행에 없다');
        }
    });
});
drift.length ? bad('문서·코드 배정 불일치: ' + drift.join(' / ')) : ok('문서 §4-3 배정표 ↔ 코드 프로필 일치');

/* 7. §3 등급표 ↔ 코드 등급 */
const docRoles = DOC.slice(DOC.indexOf('## 3. 초기 등급'), DOC.indexOf('## 4.'))
    .split('\n').filter(l => l.startsWith('|') && !/^\|\s*(등급|-)/.test(l))
    .map(l => l.split('|')[1].replace(/\*/g, '').trim()).filter(Boolean);
const codeRoles = A.roles().map(r => r.name);
const missDoc = codeRoles.filter(n => !docRoles.some(d => n.indexOf(d) === 0 || d.indexOf(n) === 0));
const missCode = docRoles.filter(d => !codeRoles.some(n => n.indexOf(d) === 0 || d.indexOf(n) === 0));
(missDoc.length || missCode.length)
    ? bad('등급표 불일치 — 문서에 없는 코드 등급: [' + missDoc.join(', ') + '] / 코드에 없는 문서 등급: [' + missCode.join(', ') + ']')
    : ok('문서 §3 등급표 ↔ 코드 등급 일치 (' + codeRoles.length + '개)');

/* 8. §4-2 프로필별 등급 배치 ↔ 코드 PROFILE
      6·7번은 «어느 메뉴가 어느 프로필인가»와 «등급이 몇 개인가»만 봤다. **프로필이
      무엇을 주는가**는 아무도 안 봤고, 실제로 그 축에서 문서와 코드가 갈려 있었다
      (문서는 「주관부서 조회 = 전담부서 보기」인데 코드는 등급이 아니라 부서 지정).
      ※ 로 표시된 칸은 «등급이 아니라 소속으로 걸린다»는 뜻이라 등급 대조에서 제외한다 —
      그 칸의 실제 동작은 바로 아래 «실제로 누가 보게 되는가» 표가 사람으로 풀어 적는다. */
const PROF_LABEL = { common: '업무 기본', openWrite: '전 직원 등록',
    settings: '기준값·연계 설정', ownerView: '주관부서 조회', personal: '개인정보' };
const ROLE_COL = ['mayor', 'exec', 'manager', 'team', 'dept_staff', 'staff'];
const p42 = DOC.slice(DOC.indexOf('### 4-2.'), DOC.indexOf('### 4-3.'));
const grantBad = [];
Object.entries(PROF_LABEL).forEach(([key, label]) => {
    const row = p42.split('\n').find(l => l.replace(/\*/g, '').trim().startsWith('| ' + label + ' |'));
    if (!row) { grantBad.push('문서 §4-2 에 "' + label + '" 행이 없다'); return; }
    const cells = row.split('|').slice(3, 9).map(c => c.replace(/\*/g, '').trim());
    ROLE_COL.forEach((rid, k) => {
        const docVal = cells[k] || '?';
        if (docVal === '※') return;                     /* 소속으로 걸리는 칸 — 등급 대조 대상이 아니다 */
        const asg = (A.PROFILE[key] || []).find(x => x.kind === 'role' && x.id === rid);
        const codeVal = asg ? (asg.edit ? '보기·수정' : '보기') : '—';
        if (codeVal !== docVal) grantBad.push(label + ' / ' + rid + ' — 문서 «' + docVal + '» ≠ 코드 «' + codeVal + '»');
    });
});
grantBad.length
    ? bad('프로필 등급 배치 불일치: ' + grantBad.join(' / '))
    : ok('문서 §4-2 프로필 배치표 ↔ 코드 PROFILE 일치');

console.log(fail ? '\n✖ 위반 ' + fail + '건' : '\n✔ 권한 정합 8종 전건 통과');
process.exit(fail ? 1 : 0);
