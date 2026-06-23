/* =========================================================================
 * 전자문서 표준 폼 7종 스키마 + 문서→폼 매핑 (기획 v1 §1.1 — 컨펌 완료)
 *   F1 계획서 / F2 실시결과 / F3 회의록 / F4 교육결과 / F5 점검표 / F6 평가서 / F7 조치보고
 *   서명 체계는 제외(제안요청서 미요구) — 확정 단계에서 온나라 결재 요청으로 갈음.
 * ========================================================================= */
(function () {
    'use strict';

    /* 필드 type: text | textarea | date | select | number | file | checklist | scorelist */
    const FORMS = {
        F1: { name: '계획서', fields: [
            { k: 'period',  label: '대상 연도·기간', type: 'select', options: ['2026년 연간', '2026년 상반기', '2026년 하반기', '2026년 2분기', '2026년 6월'] },
            { k: 'goal',    label: '목표', type: 'textarea', ph: '이 계획으로 달성할 목표를 입력하세요' },
            { k: 'detail',  label: '세부 추진내용', type: 'textarea', ph: '추진 항목·방법·일정을 입력하세요' },
            { k: 'owner',   label: '담당부서·담당자', type: 'text', ph: '예: 재난안전과 김중대' },
            { k: 'attach',  label: '관련 자료 첨부', type: 'file' },
        ]},
        F2: { name: '실시결과', fields: [
            { k: 'date',    label: '실시일', type: 'date' },
            { k: 'target',  label: '대상·참여', type: 'text', ph: '예: 전 부서 / 종사자 612명' },
            { k: 'summary', label: '결과 요약', type: 'textarea', ph: '실시 내용과 결과를 입력하세요' },
            { k: 'metric',  label: '정량 실적', type: 'text', ph: '예: 실시 4회 · 참여율 92%' },
            { k: 'attach',  label: '증빙 첨부', type: 'file' },
        ]},
        F3: { name: '회의록', fields: [
            { k: 'date',     label: '일시', type: 'date' },
            { k: 'place',    label: '장소', type: 'text', ph: '예: 군청 2층 회의실' },
            { k: 'members',  label: '참석자', type: 'textarea', ph: '조직도에서 선택 — 예: 박과장(재난안전과), 이대표(근로자대표) 외 7명' },
            { k: 'agenda',   label: '안건', type: 'textarea' },
            { k: 'resolved', label: '의결사항', type: 'textarea', ph: '의결·미의결 사항을 구분해 입력하세요' },
            { k: 'attach',   label: '회의 자료 첨부', type: 'file' },
        ]},
        F4: { name: '교육결과', fields: [
            { k: 'course',     label: '교육 과정', type: 'select', options: [] /* 카탈로그 주입 */ },
            { k: 'date',       label: '교육 일시', type: 'date' },
            { k: 'place',      label: '장소', type: 'text' },
            { k: 'instructor', label: '강사', type: 'text' },
            { k: 'planned',    label: '대상 인원', type: 'number' },
            { k: 'attended',   label: '출석 인원', type: 'number' },
            { k: 'summary',    label: '교육 내용 요약', type: 'textarea' },
            { k: 'attach',     label: '교안·출석부 첨부', type: 'file' },
        ]},
        F5: { name: '점검표', fields: [
            { k: 'date',  label: '점검일', type: 'date' },
            { k: 'owner', label: '점검자', type: 'orgpicker' },  /* 조직도 트리에서 선택 */
            { k: 'items', label: '점검 항목', type: 'checklist' },  /* O/X/해당없음 + 비고, X→개선조치 */
            { k: 'attach', label: '증빙 첨부', type: 'file' },
        ]},
        F6: { name: '평가서', fields: [
            { k: 'date',    label: '평가일', type: 'date' },
            { k: 'subject', label: '평가 대상', type: 'text', ph: '예: 안전보건관리책임자 박과장 / ○○건설' },
            { k: 'items',   label: '평가 항목', type: 'scorelist' },  /* 항목·점수·판정 */
            { k: 'opinion', label: '종합 의견', type: 'textarea' },
        ]},
        F7: { name: '조치보고', fields: [
            { k: 'source',  label: '발생 원인·근거', type: 'text', readonly: true },
            { k: 'action',  label: '조치 내용', type: 'textarea', ph: '조치 계획 또는 완료 내용을 입력하세요' },
            { k: 'due',     label: '조치 기한', type: 'date' },
            { k: 'owner',   label: '조치 담당', type: 'text' },
            { k: 'checker', label: '확인자', type: 'text', ph: '조치 완료를 확인할 부서장·담당' },
            { k: 'attach',  label: '증빙 첨부 (사진 등)', type: 'file' },
        ]},
    };

    /* 문서명 휴리스틱 → 폼 매핑 (전자문서 59건 + 이행문서 전반에 적용) */
    function formForDoc(d) {
        const n = d.name || '';
        if (/위원회|협의체|회의/.test(n)) return 'F3';
        if (/교육/.test(n) && /(결과|이수|실적)/.test(n)) return 'F4';
        if (/교육/.test(n)) return 'F1';
        if (/점검/.test(n)) return 'F5';
        if (/평가|평과/.test(n)) return 'F6';
        if (/조치|중지/.test(n) || d.pdca === 'A') return 'F7';
        if (/계획|방침|규정|절차/.test(n) || d.pdca === 'P') return 'F1';
        return 'F2';
    }

    /* 교육 과정 카탈로그 11종 (엑셀 37건 → 과정 유형 매핑, 산안법 §29·§32 기준) */
    const EDU_CATALOG = [
        { id: 'reg-office',  name: '정기교육 (사무직)',            cycle: '반기', hours: '매반기 6시간', target: '사무직 근로자' },
        { id: 'reg-field',   name: '정기교육 (판매직 외)',          cycle: '반기', hours: '매반기 12시간', target: '현장·기능직 근로자' },
        { id: 'hire',        name: '채용 시 교육',                  cycle: '발생시', hours: '8시간 (일용직 1시간)', target: '신규 채용자' },
        { id: 'change',      name: '작업내용 변경 시 교육',         cycle: '발생시', hours: '2시간 이상', target: '작업 변경 근로자' },
        { id: 'special',     name: '특별교육 (유해·위험작업)',      cycle: '발생시', hours: '16시간 (일용직 2시간)', target: '밀폐공간·고소작업 등 39개 작업' },
        { id: 'mgr-reg',     name: '관리감독자 정기교육',           cycle: '반기', hours: '연간 16시간', target: '관리감독자 38명' },
        { id: 'mgr-etc',     name: '관리감독자 채용·변경·특별',     cycle: '발생시', hours: '과정별 상이', target: '관리감독자' },
        { id: 'duty-safety', name: '안전관리자 직무교육',           cycle: '수시', hours: '신규 34시간·보수 24시간', target: '안전관리자' },
        { id: 'duty-health', name: '보건관리자 직무교육',           cycle: '수시', hours: '신규 34시간·보수 24시간', target: '보건관리자' },
        { id: 'sp-worker',   name: '특수형태근로종사자 교육',       cycle: '발생시', hours: '최초 2시간', target: '특고 종사자' },
        { id: 'const-basic', name: '건설업 기초안전보건교육',       cycle: '발생시', hours: '4시간 (이수 확인)', target: '건설 일용근로자' },
    ];
    FORMS.F4.fields[0].options = EDU_CATALOG.map(c => c.name);

    /* 점검표 기본 항목 세트 (F5 — 메뉴 컨텍스트별) */
    const CHECKLIST_PRESETS = {
        /* SFR-005: 항목별 결과유형(O/X·텍스트)·영역·관련 근거를 객체로 — edoc.js가 유형별 입력 UI 분기 */
        policy: [
            { area: '목표·KPI',   item: 'KPI 목표값 대비 달성 여부',            type: 'O/X',   basis: '중대재해처벌법 시행령 제4조제1호' },
            { area: '목표·KPI',   item: '미달 KPI 원인 분석 수행',              type: '텍스트', basis: '중대재해처벌법 시행령 제4조제1호' },
            { area: '조직·인력',  item: '안전관리자 법정 인원 충족',            type: 'O/X',   basis: '산업안전보건법 제17조·제18조' },
            { area: '위험성평가', item: '정기 위험성평가 시행률',              type: 'O/X',   basis: '산업안전보건법 제36조' },
            { area: '도급·협력',  item: '도급업체 평가 적격률',                type: 'O/X',   basis: '중대재해처벌법 시행령 제4조제9호' },
            { area: '의견청취',   item: '종사자 의견청취 정기 실시',            type: 'O/X',   basis: '중대재해처벌법 시행령 제4조제7호' },
            { area: '법령·개정',  item: '법령 개정사항의 방침 반영 내용',        type: '텍스트', basis: '중대재해처벌법 시행령 제4조제1호' },
        ],
        edu: ['연간 교육 계획이 수립되었는가', '과정별 법정 시간을 충족했는가', '미이수자 보강 교육을 실시했는가', '교육 결과를 기록·보존하는가'],
        contract: ['수급인 안전보건 수준을 평가했는가', '안전보건 협의체를 운영하는가', '작업장 순회 점검을 실시하는가', '수급인 근로자 교육을 확인했는가'],
        comply: ['§4-1 안전보건 목표·경영방침 수립', '§4-2 전담조직 설치', '§4-3 유해·위험요인 확인·개선 절차', '§4-4 예산 편성·집행', '§4-5 안전보건관리책임자등 평가·관리', '§4-7 종사자 의견청취 절차'],
        default: ['항목 1', '항목 2', '항목 3'],
    };

    /* 평가표 기본 항목 (F6) */
    const SCORE_PRESETS = {
        org: ['안전보건 업무 수행 충실도', '소관 부서 재해예방 활동', '예산·인력 운용의 적정성'],
        contract: ['안전보건관리체계 구축 수준', '최근 3년 재해 발생 이력', '안전보건교육 실시 여부', '비상대응 체계'],
        default: ['평가 항목 1', '평가 항목 2'],
    };

    /* 관련 법령 상세 사전 — 점검표 근거 태그 클릭 시 조·항·호·내용 표시 */
    const LAW_DICT = {
        '중대재해처벌법 시행령 제4조제1호': { law: '중대재해처벌법 시행령', art: '제4조', clause: '제1호', title: '안전보건관리체계의 구축 및 그 이행에 관한 조치', text: '사업 또는 사업장의 안전·보건에 관한 목표와 경영방침을 설정할 것.' },
        '중대재해처벌법 시행령 제4조제7호': { law: '중대재해처벌법 시행령', art: '제4조', clause: '제7호', title: '안전보건관리체계의 구축 및 그 이행에 관한 조치', text: '사업장의 종사자 의견을 듣는 절차를 마련하고, 그 절차에 따라 의견을 들어 재해 예방에 필요하다고 인정하는 경우 개선방안을 마련하여 이행하는지를 반기 1회 이상 점검한 후 필요한 조치를 할 것.' },
        '중대재해처벌법 시행령 제4조제9호': { law: '중대재해처벌법 시행령', art: '제4조', clause: '제9호', title: '안전보건관리체계의 구축 및 그 이행에 관한 조치', text: '제3자에게 도급·용역·위탁 등을 하는 경우, 종사자의 안전·보건을 확보하기 위해 ① 도급 등을 받는 자의 산업재해 예방 조치 능력·기술에 관한 평가기준·절차, ② 안전·보건을 위한 관리비용·업무수행 기간에 관한 기준을 마련하고, 그 이행 여부를 반기 1회 이상 점검할 것.' },
        '산업안전보건법 제17조·제18조': { law: '산업안전보건법', art: '제17조 · 제18조', clause: '', title: '안전관리자 · 보건관리자', text: '제17조(안전관리자)·제18조(보건관리자): 사업주는 사업장에 안전관리자·보건관리자를 두어 안전·보건에 관한 기술적 사항을 관리하게 하여야 한다. (업종·규모별 선임 인원은 시행령 별표에서 정한다.)' },
        '산업안전보건법 제36조': { law: '산업안전보건법', art: '제36조', clause: '', title: '위험성평가의 실시', text: '사업주는 유해·위험요인을 찾아내어 부상·질병으로 이어질 수 있는 위험성의 크기를 추정·결정하고, 그 결과에 따라 위험성을 줄이기 위한 조치를 하여야 하며, 그 결과를 기록·보존하여야 한다.' },
        '산업안전보건법 제14조': { law: '산업안전보건법', art: '제14조', clause: '', title: '이사회 보고 및 승인 등', text: '상시근로자 500명 이상을 사용하는 회사 등의 대표이사는 매년 안전 및 보건에 관한 계획을 수립하여 이사회에 보고하고 승인을 받아야 한다.' },
        '산업안전보건법 제15조': { law: '산업안전보건법', art: '제15조', clause: '', title: '안전보건관리책임자', text: '사업주는 사업장을 실질적으로 총괄·관리하는 사람에게 안전보건관리책임자로서 산업재해 예방계획 수립 등 안전·보건에 관한 업무를 총괄·관리하도록 하여야 한다.' },
        '산업안전보건법 제24조': { law: '산업안전보건법', art: '제24조', clause: '', title: '산업안전보건위원회', text: '사업주는 사업장의 안전·보건에 관한 중요 사항을 심의·의결하기 위하여 근로자와 사용자가 같은 수로 구성되는 산업안전보건위원회를 설치·운영하여야 한다.' },
    };

    window.EDOC_T = { FORMS, formForDoc, EDU_CATALOG, CHECKLIST_PRESETS, SCORE_PRESETS, LAW_DICT };
})();
