/**
 * risk-checklist-data.js
 * 체크리스트 위험성평가 시드 데이터
 *
 * 레퍼런스: KOSHA KRAS 산업안전포털 체크리스트 위험성평가 화면
 *           (https://portal.kosha.or.kr/kras/implement/real/sub6)
 * 적용 PRD: PRD_01_overview_ia.md (SFR-015), PRD-위험성평가-v0.1.md (§5.2 체크리스트법)
 *
 * 4종 출처 :
 *   STANDARD  — 표준모델 (KOSHA 정형 체크리스트, 카테고리별)
 *   NEAR_MISS — 아차사고 (니어미스) 기반
 *   SIF       — 사망사고 고위험요인 (risk-sif-data.js 연동)
 *   CUSTOM    — 직접 추가
 */
window.RskChecklistData = {

    // ─── 카테고리 ───
    categories: {
        heat:     { name: '폭염 작업',          icon: '🌡️', desc: '온열질환 예방' },
        cold:     { name: '한랭 작업',          icon: '❄️', desc: '저체온증 예방' },
        fall:     { name: '추락·떨어짐',         icon: '⬇️', desc: '고소작업·개구부' },
        electric: { name: '감전·전기',           icon: '⚡', desc: '활선·정전작업' },
        chemical: { name: '화학물질',           icon: '🧪', desc: 'MSDS·누출 대응' },
        confined: { name: '밀폐공간',           icon: '🚪', desc: '산소결핍·유해가스' },
        fire:     { name: '화재·폭발',           icon: '🔥', desc: '인화성·점화원' },
        lift:     { name: '중량물·인양',         icon: '🏗️', desc: '크레인·줄걸이' },
        dust:     { name: '분진·소음',           icon: '💨', desc: '호흡기·청력' },
        vehicle:  { name: '차량·중장비',         icon: '🚜', desc: '굴착기·도로작업' }
    },

    // ─── ① 표준모델 체크리스트 (KOSHA 표준) ───
    // 이미지 캡처된 폭염 10건 + 6개 카테고리 보강
    standardItems: [
        // ─ 폭염 작업 10건 (이미지 그대로) ─
        { id: 'STD-HEAT-001', category: 'heat', content: '시원하고 깨끗한 물을 충분히 제공하고 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제566조 (체온 상승 억제)' },
        { id: 'STD-HEAT-002', category: 'heat', content: '실내·옥외작업 시 (이동식)에어컨, 산업용 선풍기 등을 비치하였는가?', legal_ref: '산업안전보건기준에 관한 규칙 제567조 (휴식시간 부여)' },
        { id: 'STD-HEAT-003', category: 'heat', content: '작업시간대 조정 등 폭염 집중 시간대 작업을 회피하고 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제566조' },
        { id: 'STD-HEAT-004', category: 'heat', content: '작업장소와 가까운 곳에 휴게시설(쉼터)이 마련되어 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제567조' },
        { id: 'STD-HEAT-005', category: 'heat', content: '체감온도 31도 이상 폭염작업 시 적절한 휴식을 부여하고 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제566조' },
        { id: 'STD-HEAT-006', category: 'heat', content: '체감온도 33도 이상 폭염작업 시 2시간 간격 휴식·작업중지 검토 절차가 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제566조' },
        { id: 'STD-HEAT-007', category: 'heat', content: '냉각의류, 냉각조끼 등 개인 보냉장구를 지급하고 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제562조' },
        { id: 'STD-HEAT-008', category: 'heat', content: '온열질환자·의심자가 의식이 없는 경우 응급조치 매뉴얼이 마련되어 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제566조' },
        { id: 'STD-HEAT-009', category: 'heat', content: '의식이 있는 경우 응급조치 후 증상 개선 시까지 작업복귀 보류 절차가 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제566조' },
        { id: 'STD-HEAT-010', category: 'heat', content: '작업장소의 체감온도를 알 수 있는 온습도계가 비치되어 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제562조' },

        // ─ 추락·떨어짐 8건 ─
        { id: 'STD-FALL-001', category: 'fall', content: '높이 2m 이상 작업 시 안전난간·작업발판이 설치되어 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제13조 (안전난간)' },
        { id: 'STD-FALL-002', category: 'fall', content: '안전대 부착설비 설치 및 안전대 착용을 의무화하고 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제32조 (보호구의 지급)' },
        { id: 'STD-FALL-003', category: 'fall', content: '추락방호망이 설치되어 있고 인장강도 시험을 통과하였는가?', legal_ref: '산업안전보건기준에 관한 규칙 제14조 (낙하물 방지)' },
        { id: 'STD-FALL-004', category: 'fall', content: '개구부·단부에 덮개 또는 안전난간이 설치되어 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제43조 (개구부 등의 방호조치)' },
        { id: 'STD-FALL-005', category: 'fall', content: '사다리 작업 시 3.5m 미만 A형 사다리만 사용, 2인 1조로 작업하는가?', legal_ref: 'KOSHA Guide C-22-2020 (이동식 사다리 안전작업 지침)' },
        { id: 'STD-FALL-006', category: 'fall', content: '고소작업대 작업 시 안전난간이 설치되어 있고 안전대를 부착하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제186조 (고소작업대)' },
        { id: 'STD-FALL-007', category: 'fall', content: '비계 조립·해체 작업 시 비계기능사 자격자가 입회하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제57조 (비계의 조립 등)' },
        { id: 'STD-FALL-008', category: 'fall', content: '지붕 작업 시 채광판·슬레이트 위 보행을 금지하고 안전통로를 설치하였는가?', legal_ref: '산업안전보건기준에 관한 규칙 제44조 (지붕 작업)' },

        // ─ 감전·전기 6건 ─
        { id: 'STD-ELEC-001', category: 'electric', content: '전기설비 작업 전 정전조치 및 검전기로 무전압 확인을 실시하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제319조 (정전전로에서의 전기작업)' },
        { id: 'STD-ELEC-002', category: 'electric', content: 'LOTO(Lock Out / Tag Out) 절차를 시행하고 있는가?', legal_ref: 'KOSHA Guide E-141-2020 (전기 LOTO 안전지침)' },
        { id: 'STD-ELEC-003', category: 'electric', content: '활선 작업 시 절연장갑·절연화·절연모를 착용하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제323조 (절연용 보호구의 사용)' },
        { id: 'STD-ELEC-004', category: 'electric', content: '배전반·분전반에 시건장치 및 위험표지가 설치되어 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제301조 (전기기계기구의 적정성)' },
        { id: 'STD-ELEC-005', category: 'electric', content: '누전차단기가 적정 용량으로 설치되어 있고 월 1회 점검하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제304조 (누전차단기의 시설)' },
        { id: 'STD-ELEC-006', category: 'electric', content: '전기작업은 2인 1조로 수행하고 감시자를 배치하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제320조 (정전전로 인근에서의 전기작업)' },

        // ─ 화학물질 5건 ─
        { id: 'STD-CHEM-001', category: 'chemical', content: '취급 화학물질 MSDS가 비치되어 있고 작업자가 열람 가능한가?', legal_ref: '산업안전보건법 제114조 (물질안전보건자료의 게시 및 비치)' },
        { id: 'STD-CHEM-002', category: 'chemical', content: '화학물질 누출 감지기·환기설비가 상시 가동되고 정기 점검되는가?', legal_ref: '산업안전보건기준에 관한 규칙 제422조 (관리대상 유해물질)' },
        { id: 'STD-CHEM-003', category: 'chemical', content: '방독마스크·내화학복 등 적정 보호구를 지급하고 착용 교육을 하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제32조' },
        { id: 'STD-CHEM-004', category: 'chemical', content: '비상 샤워·세안 설비가 설치되어 있고 동선이 확보되어 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제427조 (세안설비 등)' },
        { id: 'STD-CHEM-005', category: 'chemical', content: '누출 시 비상대응 매뉴얼이 비치되어 있고 분기 1회 훈련을 실시하는가?', legal_ref: '화학물질관리법 제23조 (화학사고예방관리계획서)' },

        // ─ 밀폐공간 5건 ─
        { id: 'STD-CONF-001', category: 'confined', content: '밀폐공간 진입 전 산소·유해가스 농도를 측정하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제619조 (밀폐공간 작업 전 확인)' },
        { id: 'STD-CONF-002', category: 'confined', content: '밀폐공간 작업허가서를 발급하고 보관하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제619조의2 (밀폐공간 작업 프로그램)' },
        { id: 'STD-CONF-003', category: 'confined', content: '환기설비를 작업 전·작업 중 상시 가동하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제620조 (환기)' },
        { id: 'STD-CONF-004', category: 'confined', content: '송기마스크 또는 공기호흡기를 착용하고 외부 감시자를 배치하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제624조 (감시인의 배치)' },
        { id: 'STD-CONF-005', category: 'confined', content: '안전대·구명로프를 외부와 연결하여 비상 시 인양 가능한가?', legal_ref: '산업안전보건기준에 관한 규칙 제625조 (대피용 기구의 비치)' },

        // ─ 화재·폭발 4건 ─
        { id: 'STD-FIRE-001', category: 'fire', content: '인화성 물질 보관 장소에 점화원 차단·환기 설비가 갖춰져 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제232조 (폭발 또는 화재 등의 예방)' },
        { id: 'STD-FIRE-002', category: 'fire', content: '용접·용단 작업 시 화기작업 허가서를 발급하고 화재 감시인을 배치하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제241조 (화재위험작업 시의 준수사항)' },
        { id: 'STD-FIRE-003', category: 'fire', content: '소화기·옥내소화전 위치가 표시되어 있고 월 1회 점검하는가?', legal_ref: '소방시설 설치 및 관리에 관한 법률 제16조' },
        { id: 'STD-FIRE-004', category: 'fire', content: '비상대피로가 확보되어 있고 비상유도등이 정상 작동하는가?', legal_ref: '소방시설 설치 및 관리에 관한 법률 제15조' },

        // ─ 중량물·인양 4건 ─
        { id: 'STD-LIFT-001', category: 'lift', content: '인양 작업 시 줄걸이 안전하중·각도를 사전 점검하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제170조 (와이어로프 등의 사용금지)' },
        { id: 'STD-LIFT-002', category: 'lift', content: '인양 작업 시 작업반경 내 출입을 통제하고 신호수를 배치하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제146조 (크레인의 안전조치)' },
        { id: 'STD-LIFT-003', category: 'lift', content: '이동식 크레인 운전자가 자격증을 소지하고 있는가?', legal_ref: '국가기술자격법 제10조 (자격취득자의 의무)' },
        { id: 'STD-LIFT-004', category: 'lift', content: '중량물 적재 시 정격하중을 확인하고 결박 상태를 점검하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제387조 (적재화물의 낙하 등의 위험방지)' },

        // ─ 분진·소음 3건 ─
        { id: 'STD-DUST-001', category: 'dust', content: '분진 발생 작업장에 국소배기장치가 설치되어 있고 풍속을 점검하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제607조 (국소배기장치의 설치)' },
        { id: 'STD-DUST-002', category: 'dust', content: '소음 작업장(85dB↑)에서 청력보호구를 지급하고 청력검사를 실시하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제515조 (소음 작업의 정의)' },
        { id: 'STD-DUST-003', category: 'dust', content: '방진마스크 KCS 인증 제품을 지급하고 교환 주기를 관리하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제32조' },

        // ─ 차량·중장비 4건 ─
        { id: 'STD-VEHI-001', category: 'vehicle', content: '도로 작업 시 안전표지·교통신호수를 배치하고 우회로를 안내하는가?', legal_ref: '도로교통법 제66조 (고장 등의 조치)' },
        { id: 'STD-VEHI-002', category: 'vehicle', content: '굴착기·중장비 작업 시 작업반경 내 출입을 통제하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제200조 (차량계 건설기계의 안전조치)' },
        { id: 'STD-VEHI-003', category: 'vehicle', content: '관용차 운행 전 일일 점검(타이어·제동·등화)을 실시하는가?', legal_ref: '자동차관리법 제43조 (자동차의 점검 및 정비)' },
        { id: 'STD-VEHI-004', category: 'vehicle', content: '야간 작업 시 LED 안내등·반사조끼를 착용하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제8조 (조도)' },

        // ─ 한랭 작업 3건 ─
        { id: 'STD-COLD-001', category: 'cold', content: '한랭 환경(-12℃ 이하) 작업 시 방한복·방한장갑·방한모를 지급하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제571조 (한랭 작업 보호구)' },
        { id: 'STD-COLD-002', category: 'cold', content: '한랭 작업 시 적정 휴식과 보온 음료를 제공하는가?', legal_ref: '산업안전보건기준에 관한 규칙 제572조 (한랭 작업 휴식)' },
        { id: 'STD-COLD-003', category: 'cold', content: '동상·저체온증 증상 인지 및 응급조치 매뉴얼이 비치되어 있는가?', legal_ref: '산업안전보건기준에 관한 규칙 제573조' }
    ],

    // ─── ② 아차사고(니어미스) 기반 체크리스트 ───
    nearMissItems: [
        { id: 'NM-2025-001', category: 'fall',     content: '청사 옥상 점검 중 안전난간 부식 발견 — 추락 위험 잠재', legal_ref: '담양군 내부 아차사고 보고 NM-2025-001 (2025.08)', incident_date: '2025-08-12' },
        { id: 'NM-2025-002', category: 'electric', content: '배전반 점검 중 절연장갑 미착용 적발 — 감전 위험 잠재', legal_ref: '담양군 내부 아차사고 보고 NM-2025-002 (2025.09)', incident_date: '2025-09-03' },
        { id: 'NM-2025-003', category: 'vehicle',  content: '도로 보수 작업 중 안전표지 없이 차량 진입 — 충돌 위험 잠재', legal_ref: '담양군 내부 아차사고 보고 NM-2025-003 (2025.10)', incident_date: '2025-10-21' },
        { id: 'NM-2026-001', category: 'chemical', content: '정수장 약품 누출 — 비상샤워 작동 지연(약 30초)', legal_ref: '담양군 내부 아차사고 보고 NM-2026-001 (2026.02)', incident_date: '2026-02-15' },
        { id: 'NM-2026-002', category: 'confined', content: '약품탱크 청소 중 환기 불충분으로 작업자 어지러움 호소', legal_ref: '담양군 내부 아차사고 보고 NM-2026-002 (2026.03)', incident_date: '2026-03-08' }
    ],

    /**
     * 카테고리 필터링
     */
    getStandardByCategory: function(category) {
        if (!category || category === 'all') return this.standardItems;
        return this.standardItems.filter(function(i) { return i.category === category; });
    },

    /**
     * 카테고리별 표준 항목 건수
     */
    countByCategory: function() {
        var counts = {};
        var self = this;
        Object.keys(this.categories).forEach(function(k) {
            counts[k] = self.standardItems.filter(function(i) { return i.category === k; }).length;
        });
        return counts;
    },

    /**
     * 검색
     */
    search: function(query, source) {
        var q = (query || '').toLowerCase();
        var pool = source === 'NEAR_MISS' ? this.nearMissItems :
                   source === 'SIF'       ? (window.RskSifData ? window.RskSifData.scenarios : []) :
                                            this.standardItems;
        if (!q) return pool;
        return pool.filter(function(i) {
            var text = (i.content || i.risk_factor || '') + ' ' + (i.legal_ref || '') + ' ' + (i.incident_summary || '');
            return text.toLowerCase().indexOf(q) >= 0;
        });
    }
};
