/* =====================================================================
   evl-data.js · 인력평가 항목 마스터 단일 출처 (DYEVL)
   ---------------------------------------------------------------------
   안전보건관리책임자(산안법 §15)·관리감독자(§16) 업무수행 평가항목과
   '평가항목별 세부평가기준'을 한 곳에서 정의한다(CLAUDE.md §3 단일 출처).
   · 평가화면(evl-eval.html)·설정화면(evl-settings.html)이 공유 참조.
   · 설정에서 편집 → sessionStorage 영속 → 다음 평가 로드 시 반영.
   · 채점은 3등급(양호/보통/미흡) 모델 — 배점(가중치)은 쓰지 않는다.
   전역: DYEVL.*  (layout.js 뒤, 각 화면 인라인 스크립트 앞에 로드)
   ===================================================================== */
(function (global) {
    'use strict';

    var SKEY = 'damyangEvlV1';

    /* 표준 항목·세부평가기준 (RFP: 평가항목별 세부평가기준 적용) */
    var SEED = {
        RESPONSIBLE: [
            { id: 'R1', title: '사업장 산재 예방 계획 수립', criteria: '연간 산업재해 예방계획 수립·결재 완료 · 목표·실행과제·일정의 구체성 · 전 부서 공유' },
            { id: 'R2', title: '안전보건관리규정의 작성 및 변경', criteria: '법 개정·조직 변경을 반영한 규정 최신화 · 근로자 의견수렴 · 게시·주지' },
            { id: 'R3', title: '안전보건교육 이행, 작업환경측정 등 작업환경의 점검 및 개선', criteria: '법정 안전보건교육 이수율 · 작업환경측정 이행률 · 개선 필요 조치 완료율 (작업환경측정 메뉴 자동 연계)' },
            { id: 'R4', title: '종사자의 건강진단 등 건강관리', criteria: '일반·특수건강진단 수검률 · 유소견자 사후관리 이행률 (건강검진 메뉴 자동 연계)' },
            { id: 'R5', title: '산업재해 원인조사 및 재발방지 대책 수립', criteria: '재해 발생 시 원인조사 실시 · 재발방지대책 수립·이행 · 유사재해 예방 반영' },
            { id: 'R6', title: '산업재해에 관한 통계의 기록 및 유지관리', criteria: '재해·아차사고 통계의 기록·유지 · 정기 분석·보고 · 지표 관리' },
            { id: 'R7', title: '안전장치 및 보호구 구입 시 적격품 여부 확인', criteria: '안전인증·안전검사 적격품 확인 · 검수 절차 이행 · 부적격품 반입 0건' },
            { id: 'R8', title: '위험성평가 실시 등', criteria: '정기·수시 위험성평가 실시율 · 근로자 참여 · 감소대책(개선조치) 이행률 (위험성평가 메뉴 연계)' }
        ],
        SUPERVISOR: [
            { id: 'S1', title: '종사자 안전보건에 관한 사항 확인', criteria: '담당 작업 종사자의 안전보건 상태 일상 확인 · TBM(작업 전 안전점검회의) 실시' },
            { id: 'S2', title: '사업장 내 기계기구 또는 설비의 안전보건 점검 및 이상 유무 확인', criteria: '담당 기계·기구·설비 일상점검 기록 · 이상 발견 시 조치' },
            { id: 'S3', title: '보호장치 및 방호장치 점검 및 착용·사용 교육·지도', criteria: '방호장치 점검 · 보호구 착용 지도·점검 · 미착용 시정' },
            { id: 'S4', title: '산업재해에 관한 보고, 안전보건관리자 등 지도·조언에 대한 이행', criteria: '재해·아차사고 즉시 보고 · 안전보건관리자 등의 지도·조언 이행' },
            { id: 'S5', title: '유해위험요인의 파악 및 개선조치 여부 확인', criteria: '담당 공정 유해위험요인 파악 · 개선조치 요청·확인' }
        ]
    };

    var db = null;
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function load() {
        if (db) return db;
        try { var raw = global.sessionStorage.getItem(SKEY); db = raw ? JSON.parse(raw) : clone(SEED); }
        catch (e) { db = clone(SEED); }
        if (!db.RESPONSIBLE || !db.SUPERVISOR) db = clone(SEED);
        return db;
    }
    function save() { try { global.sessionStorage.setItem(SKEY, JSON.stringify(db)); } catch (e) {} }

    function items(role) { return load()[role] || []; }
    function titles(role) { return items(role).map(function (x) { return x.title; }); }
    function criteria(role) { return items(role).map(function (x) { return x.criteria; }); }
    function updateItem(role, idx, patch) {
        var it = items(role)[idx]; if (!it) return null;
        if (patch.title != null) it.title = patch.title;
        if (patch.criteria != null) it.criteria = patch.criteria;
        save(); return it;
    }
    function addItem(role, o) {
        var arr = items(role);
        arr.push({ id: role.charAt(0) + (arr.length + 1), title: (o && o.title) || '', criteria: (o && o.criteria) || '' });
        save(); return arr[arr.length - 1];
    }
    function reset() { db = clone(SEED); save(); return db; }

    global.DYEVL = {
        items: items, titles: titles, criteria: criteria,
        updateItem: updateItem, addItem: addItem, reset: reset,
        ROLE_LABEL: { RESPONSIBLE: '안전보건관리책임자', SUPERVISOR: '관리감독자' }
    };
})(window);
