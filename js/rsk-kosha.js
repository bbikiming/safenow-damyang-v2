/* =====================================================================
   rsk-kosha.js · 위험성평가 표준 마스터 (KOSHA 유해위험요인 모음집 · 대표 선별)
   ---------------------------------------------------------------------
   레퍼런스(위험성평가 통합명세 v1 · PRC01-L v2.2)의 "병렬 합집합" 자동매핑 원천.
   공정 · 설비 · 유해인자가 '각각' 유해위험요인(HRF)을 끌어오고 그 합집합이 최종.
   (설비→유해인자 자동 연결은 원본에 없음 — 셋을 독립 룩업)
   법령근거는 KOSHA 원본에 없어 자동매핑 항목도 기본 legal_status='PENDING'.
   전역: DYRSK.KOSHA  (js/rsk-data.js 보다 먼저 로드)
   ===================================================================== */
(function (global) {
    'use strict';

    /* 관리대상(사업장 속성 = 업종) — proc-copy TARGETS 계승 */
    var TARGETS = [
        { id: 'f_jns',  name: '신계 정수장',        dept: '물순환사업소',   industry: '상수도업' },
        { id: 'f_sew',  name: '담양 공공하수처리장', dept: '물순환사업소',   industry: '하수도업' },
        { id: 'f_gym',  name: '담양종합체육관',      dept: '공공시설사업소', industry: '시설관리업' },
        { id: 'f_hall', name: '군청 본관 청사',      dept: '공공시설사업소', industry: '시설관리업' },
        { id: 'f_road', name: '담양읍 도로시설',     dept: '건설과',        industry: '도로관리업' }
    ];

    /* 유해인자 분류(카테고리) */
    var CATS = ['기계적', '화학적', '작업특성', '전기', '고소작업', '보건', '기타'];

    /* 설비 마스터 — group: 표시 분류 */
    var EQUIP = {
        cl2_bombe:        { name: '염소 봄베·투입기',            group: '기계·기구' },
        leak_sensor:      { name: '누출 감지기',                 group: '안전장치' },
        pac_pump:         { name: 'PAC 정량펌프',                group: '기계·기구' },
        chem_tank:        { name: '약품 저장탱크',               group: '장소·설비' },
        emergency_shower: { name: '비상 샤워·세안 설비',          group: '안전장치' },
        pump_motor:       { name: '취수·송수 펌프(전동기)',       group: '기계·기구' },
        valve_pit:        { name: '지하 밸브실',                 group: '장소·설비' },
        crane_hoist:      { name: '정비용 체인블록·호이스트',      group: '기계·기구' },
        roof_work:        { name: '옥상·고소 작업대',            group: '장소·설비' },
        elec_panel:       { name: '수배전반(고압)',              group: '기계·기구' },
        ladder:           { name: '이동식 사다리',               group: '기계·기구' },
        road_cutter:      { name: '도로 절단기(커터)',           group: '기계·기구' },
        paver_roller:     { name: '아스팔트 피니셔·롤러',         group: '기계·기구' },
        traffic_control:  { name: '교통통제 시설(라바콘·표지판)',  group: '안전장치' }
    };

    /* 유해인자 마스터 — category: 자동매핑용 분류 */
    var HF = {
        cl2:     { name: '염소(Cl₂) 가스',        category: '화학적' },
        pac:     { name: 'PAC(부식성 약품)',      category: '화학적' },
        naocl:   { name: '차아염소산나트륨',       category: '화학적' },
        gas:     { name: '유해가스(H₂S·CH₄)',     category: '화학적' },
        conf:    { name: '밀폐공간(산소결핍)',     category: '작업특성' },
        slip:    { name: '전도·미끄러짐',         category: '작업특성' },
        elec:    { name: '감전(활선)',            category: '전기' },
        fall:    { name: '고소·추락',             category: '고소작업' },
        rot:     { name: '회전체·끼임',           category: '기계적' },
        heavy:   { name: '중량물·협착',           category: '기계적' },
        traffic: { name: '차량·중장비 통행',       category: '기계적' },
        noise:   { name: '소음',                  category: '보건' },
        dust:    { name: '분진(아스팔트 비산)',    category: '보건' }
    };

    /* 표준 유해위험요인 (HRF) — id·명칭·분류·법령근거 */
    var STD_HRF = [
        { id: 's1',  name: '유해물질 누출에 의한 중독·질식', category: '화학적',   basis: '산업안전보건기준규칙 §420 관리대상 유해물질' },
        { id: 's2',  name: '화학물질 접촉 화상·부식',        category: '화학적',   basis: '산업안전보건기준규칙 §451 보호구' },
        { id: 's3',  name: '밀폐공간 진입 중 산소결핍·질식',  category: '작업특성', basis: '산업안전보건기준규칙 §619 밀폐공간 작업허가' },
        { id: 's4',  name: '바닥 전도·미끄러짐',             category: '작업특성', basis: '자체 점검 기준(주 1회 바닥 점검)' },
        { id: 's5',  name: '활선 근접작업 감전',             category: '전기',     basis: '산업안전보건기준규칙 §310 정전작업' },
        { id: 's6',  name: '아크 플래시 화상',               category: '전기',     basis: 'KOSHA GUIDE E-64' },
        { id: 's7',  name: '개구부·단부 추락',               category: '고소작업', basis: '산업안전보건기준규칙 §43 개구부 방호' },
        { id: 's8',  name: '안전대 미착용 고소작업',          category: '고소작업', basis: '산업안전보건기준규칙 §32 보호구' },
        { id: 's9',  name: '회전체 접촉 끼임',               category: '기계적',   basis: '산업안전보건기준규칙 §87 원동기·회전축 방호' },
        { id: 's10', name: '중량물 낙하·협착',               category: '기계적',   basis: '산업안전보건기준규칙 §132 낙하물 방지' },
        { id: 's11', name: '차량 후진·통행 협착·충돌',        category: '기계적',   basis: '산업안전보건기준규칙 §171·§172 유도자 배치' },
        { id: 's12', name: '소음성 난청(85dB 초과)',         category: '보건',     basis: '산업안전보건기준규칙 §512 소음' },
        { id: 's13', name: '분진 흡입 질환',                 category: '보건',     basis: '산업안전보건기준규칙 §607 분진작업' }
    ];

    /* 표준 공정 (업종·관리대상별) — std: 공정이 직접 끌어오는 표준 HRF */
    var STD_PROC = {
        f_jns:  [{ name: '약품 투입', desc: '염소·응집제 투입 · 약품탱크 취급', std: ['s1', 's3'], equip: ['cl2_bombe', 'pac_pump', 'chem_tank'], hf: ['cl2', 'pac', 'conf'] },
                 { name: '설비 정비', desc: '펌프·배관·밸브 정비 · 밀폐공간 진입', std: ['s5', 's9'], equip: ['pump_motor', 'valve_pit'], hf: ['elec', 'rot', 'conf'] }],
        f_sew:  [{ name: '수처리 설비 운전·정비', desc: '송풍기·펌프 · 지하 피트 점검', std: ['s3', 's5'], equip: ['pump_motor', 'valve_pit'], hf: ['gas', 'conf', 'elec'] },
                 { name: '슬러지 처리', desc: '탈수·이송 설비 취급', std: ['s9', 's12'], equip: ['pump_motor', 'crane_hoist'], hf: ['rot', 'noise'] }],
        f_gym:  [{ name: '건물 시설 점검·보수', desc: '옥상·전기·고소작업', std: ['s7', 's5'], equip: ['roof_work', 'elec_panel'], hf: ['fall', 'elec'] },
                 { name: '환경 정비', desc: '청소·소독 · 사다리 작업', std: ['s4', 's8'], equip: ['ladder'], hf: ['slip', 'fall'] }],
        f_hall: [{ name: '청사 전기설비 점검', desc: '수배전반 점검 · 활선 근접', std: ['s5', 's6'], equip: ['elec_panel'], hf: ['elec'] }],
        f_road: [{ name: '도로 보수', desc: '포트홀·포장 보수 · 차량·중장비 작업', std: ['s11', 's13'], equip: ['road_cutter', 'paver_roller', 'traffic_control'], hf: ['traffic', 'dust'] },
                 { name: '교통 시설물 정비', desc: '표지판·신호기 · 고소작업', std: ['s7', 's11'], equip: ['roof_work', 'traffic_control'], hf: ['fall', 'traffic'] }]
    };

    /* 병렬 합집합 룩업 — 설비 축(설비 id → 표준 HRF id[]) */
    var LOOKUP_EQUIP = {
        cl2_bombe: ['s1', 's2'], leak_sensor: [], pac_pump: ['s2'], chem_tank: ['s1', 's2'],
        emergency_shower: [], pump_motor: ['s9', 's5'], valve_pit: ['s3'], crane_hoist: ['s10'],
        roof_work: ['s7', 's8'], elec_panel: ['s5', 's6'], ladder: ['s8', 's4'],
        road_cutter: ['s9', 's13'], paver_roller: ['s11', 's13'], traffic_control: ['s11']
    };

    function stdHrf(id) { for (var i = 0; i < STD_HRF.length; i++) if (STD_HRF[i].id === id) return STD_HRF[i]; return null; }

    /* 유해인자 축(유해인자 id → 표준 HRF id[]) — 카테고리 매칭 파생 */
    function lookupFactor(hfId) {
        var f = HF[hfId]; if (!f) return [];
        return STD_HRF.filter(function (s) { return s.category === f.category; }).map(function (s) { return s.id; });
    }
    /* 공정 축(공정명 → 표준 HRF id[]) */
    function lookupProcess(targetId, procName) {
        var list = STD_PROC[targetId] || [];
        for (var i = 0; i < list.length; i++) if (list[i].name === procName) return (list[i].std || []).slice();
        return [];
    }

    global.DYRSK = global.DYRSK || {};
    global.DYRSK.KOSHA = {
        TARGETS: TARGETS, CATS: CATS, EQUIP: EQUIP, HF: HF, STD_HRF: STD_HRF, STD_PROC: STD_PROC,
        LOOKUP_EQUIP: LOOKUP_EQUIP,
        stdHrf: stdHrf, lookupFactor: lookupFactor, lookupProcess: lookupProcess,
        equipName: function (id) { return EQUIP[id] ? EQUIP[id].name : id; },
        hfName: function (id) { return HF[id] ? HF[id].name : id; },
        hfCat: function (id) { return HF[id] ? HF[id].category : ''; },
        targetOf: function (id) { for (var i = 0; i < TARGETS.length; i++) if (TARGETS[i].id === id) return TARGETS[i]; return null; }
    };
})(window);
