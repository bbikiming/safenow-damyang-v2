/* =====================================================================
   site-data.js · 사업장(작업장) 마스터 단일 출처 (DYSITE)
   ---------------------------------------------------------------------
   담양군 내 물리적 사업장(정수장·하수처리시설·자원순환센터·현장 등)을
   한 곳에서 관리한다. 부서(조직도 DYV2.ORG)와 사업장(물리적 작업장)은 별개 축:
   · 부서 = 조직 단위(실·과·사업소·읍·면)  · 사업장 = 유해인자 노출 작업장
   소비처: 시스템 관리 > 사업장 관리(admin-sites) · 작업환경측정 계획 등록(부서→사업장 드롭다운)
   · 백엔드 없는 정적 프로토타입 — sessionStorage 로 편집 상태 유지.
   전역: DYSITE.*  (js/common.js 뒤에 로드 — 부서명은 DYV2.deptNames() 파생)
   ===================================================================== */
(function (global) {
    'use strict';

    var SKEY = 'damyangSitesV1';

    /* 사업장 유형 (드롭다운 단일 정의) */
    var TYPES = ['정수시설', '환경기초시설(하수)', '폐기물처리시설', '체육시설', '건설현장', '공원·관광지', '청사', '기타'];

    /* 담양군 사업장 시드 — dept 는 조직도(DYV2.ORG) 부서명과 일치 */
    var SEED = [
        { id: 'S01', dept: '물순환사업소', name: '담양정수장', type: '정수시설', hazards: '염소·응집제(PAC)·소음·분진', note: '작업환경측정·특수건강진단 대상' },
        { id: 'S02', dept: '물순환사업소', name: '담양하수처리장', type: '환경기초시설(하수)', hazards: '황화수소·분진·소음', note: '밀폐공간 작업 병행' },
        { id: 'S03', dept: '물순환사업소', name: '면단위 마을하수도', type: '환경기초시설(하수)', hazards: '황화수소·악취', note: '순회 점검' },
        { id: 'S04', dept: '공공시설사업소', name: '담양국민체육센터(실내수영장)', type: '체육시설', hazards: '염소가스·습도·소음', note: '기계실 자동염소주입기' },
        { id: 'S05', dept: '공공시설사업소', name: '담양종합운동장', type: '체육시설', hazards: '소음·분진·자외선(옥외)', note: '' },
        { id: 'S06', dept: '공공시설사업소', name: '공영주차장·공영시설', type: '기타', hazards: '배기가스·소음', note: '' },
        { id: 'S07', dept: '환경과', name: '자원순환센터(재활용선별)', type: '폐기물처리시설', hazards: '분진·악취·소음·중금속', note: '' },
        { id: 'S08', dept: '환경과', name: '음식물자원화시설', type: '폐기물처리시설', hazards: '악취·황화수소·분진', note: '' },
        { id: 'S09', dept: '건설과', name: '도로보수 작업현장(직영보수반)', type: '건설현장', hazards: '소음·진동·분진·아스팔트흄', note: '이동형 현장' },
        { id: 'S10', dept: '건설과', name: '하천정비 현장', type: '건설현장', hazards: '소음·진동·분진', note: '' },
        { id: 'S11', dept: '문화체육과', name: '죽녹원 관리사업소', type: '공원·관광지', hazards: '예초기 소음·진동·농약', note: '' },
        { id: 'S12', dept: '문화체육과', name: '관방제림·메타세쿼이아길', type: '공원·관광지', hazards: '전정 소음·진동·자외선', note: '' },
        { id: 'S13', dept: '보건소', name: '담양군보건소', type: '청사', hazards: '소독약품·감염성', note: '방역·소독반' },
        { id: 'S14', dept: '재난안전과', name: '담양군청 본청사', type: '청사', hazards: '일반 사무환경', note: '일반 행정청사 — 측정 비대상(참고)' }
    ];

    var db = null;
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function load() {
        if (db) return db;
        try { var raw = global.sessionStorage.getItem(SKEY); db = raw ? JSON.parse(raw) : { list: clone(SEED), seq: SEED.length }; }
        catch (e) { db = { list: clone(SEED), seq: SEED.length }; }
        if (!db.list) db = { list: clone(SEED), seq: SEED.length };
        return db;
    }
    function save() { try { global.sessionStorage.setItem(SKEY, JSON.stringify(db)); } catch (e) {} }

    function sites() { return load().list; }
    function siteOf(id) { var a = sites(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
    function sitesByDept(dept) { return sites().filter(function (s) { return s.dept === dept; }); }
    function addSite(o) {
        var d = load(); d.seq++; o = o || {};
        var rec = { id: 'S' + (100 + d.seq), dept: o.dept || '', name: o.name || '', type: o.type || TYPES[0],
            hazards: o.hazards || '', note: o.note || '' };
        d.list.push(rec); save(); return rec;
    }
    function updateSite(id, patch) {
        var s = siteOf(id); if (!s) return null;
        ['dept', 'name', 'type', 'hazards', 'note'].forEach(function (k) { if (patch[k] != null) s[k] = patch[k]; });
        save(); return s;
    }
    function removeSite(id) { var d = load(); d.list = d.list.filter(function (s) { return s.id !== id; }); save(); }
    function reset() { db = { list: clone(SEED), seq: SEED.length }; save(); return db; }

    global.DYSITE = {
        TYPES: TYPES, sites: sites, siteOf: siteOf, sitesByDept: sitesByDept,
        addSite: addSite, updateSite: updateSite, removeSite: removeSite, reset: reset
    };
})(window);
