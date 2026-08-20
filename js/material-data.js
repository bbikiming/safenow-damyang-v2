/* =====================================================================
   material-data.js · 원료·제조물 대장 단일 출처 (DYMATERIAL)
   ---------------------------------------------------------------------
   관리대상 현황의 원료·제조물 탭이 대장 자체다. 화면마다 별도 명단을
   만들지 않으며 등록·정정·사용중지는 이 데이터 한 곳에 기록한다.
   이 버전에서는 sessionStorage로 편집 상태를 유지한다.
   ===================================================================== */
(function (global) {
    'use strict';

    var SKEY = 'damyangMaterialsV1';
    var SEED = [
        { id: 'M01', name: '수처리 약품 (PAC)', kind: '원료', depts: ['물순환사업소'], safetyDocState: '보유', msdsName: '물질안전보건자료.pdf', msdsReason: '', note: '정수 처리용', active: true },
        { id: 'M02', name: '차아염소산나트륨', kind: '원료', depts: ['물순환사업소'], safetyDocState: '보유', msdsName: '물질안전보건자료.pdf', msdsReason: '', note: '정수·하수 처리용', active: true },
        { id: 'M03', name: '제설제 (염화칼슘)', kind: '원료', depts: ['건설과'], safetyDocState: '미보유', msdsName: '', msdsReason: '', note: '도로 제설용', active: true },
        { id: 'M04', name: '공공급식 조리식품', kind: '제조물', depts: ['행정과'], safetyDocState: '해당 없음', msdsName: '', msdsReason: '화학물질 물질안전보건자료 적용 대상이 아닌 조리식품', note: '구내식당 제공', active: true }
    ];
    var db = null;

    function clone(v) { return JSON.parse(JSON.stringify(v)); }
    function norm(v) { return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toLowerCase(); }
    function load() {
        if (db) return db;
        try {
            var raw = global.sessionStorage.getItem(SKEY);
            db = raw ? JSON.parse(raw) : { list: clone(SEED), seq: SEED.length };
        } catch (e) { db = { list: clone(SEED), seq: SEED.length }; }
        if (!db || !Array.isArray(db.list)) db = { list: clone(SEED), seq: SEED.length };
        db.list.forEach(function (r) {
            if (!Array.isArray(r.depts)) r.depts = r.depts ? [r.depts] : [];
            if (r.active == null) r.active = true;
            if (r.msdsName == null) r.msdsName = '';
            if (!r.safetyDocState) r.safetyDocState = r.msdsName ? '보유' : '미보유';
            if (r.msdsReason == null) r.msdsReason = '';
            if (r.note == null) r.note = '';
        });
        return db;
    }
    function save() { try { global.sessionStorage.setItem(SKEY, JSON.stringify(db)); } catch (e) {} }
    function list(includeInactive) { return load().list.filter(function (r) { return includeInactive || r.active !== false; }); }
    function itemOf(id) { return load().list.filter(function (r) { return r.id === id; })[0] || null; }
    function duplicateOf(name, exceptId) {
        var key = norm(name);
        return load().list.filter(function (r) { return r.id !== exceptId && norm(r.name) === key; })[0] || null;
    }
    function add(data) {
        var d = load(); d.seq += 1;
        var rec = { id: 'M' + (100 + d.seq), name: data.name, kind: data.kind, depts: clone(data.depts || []),
            safetyDocState: data.safetyDocState, msdsName: data.msdsName || '', msdsReason: data.msdsReason || '',
            note: data.note || '', active: true, inactiveReason: '' };
        d.list.push(rec); save(); return rec;
    }
    function update(id, data) {
        var rec = itemOf(id); if (!rec) return null;
        ['name', 'kind', 'safetyDocState', 'msdsName', 'msdsReason', 'note'].forEach(function (k) { if (data[k] != null) rec[k] = data[k]; });
        if (data.depts) rec.depts = clone(data.depts);
        save(); return rec;
    }
    function setActive(id, active, reason) {
        var rec = itemOf(id); if (!rec) return null;
        rec.active = !!active;
        rec.inactiveReason = active ? '' : String(reason || '').trim();
        save(); return rec;
    }
    function reset() { db = { list: clone(SEED), seq: SEED.length }; save(); }

    global.DYMATERIAL = { list: list, itemOf: itemOf, duplicateOf: duplicateOf, add: add, update: update, setActive: setActive, reset: reset };
})(window);
