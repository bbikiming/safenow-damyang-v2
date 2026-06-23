/**
 * risk-sif-data.js
 * SIF(산업재해 고위험요인) 시나리오 mock 데이터
 *
 * 출처: KOSHA "3-1. 산업재해 고위험요인(SIF) 정보 4,432건" 엑셀에서
 *       담양군 11개 추진 부서(시설관리·공공시설·도로교통·환경 등)에
 *       적용 가능한 시나리오를 추려 큐레이션.
 *
 * 데이터 구조: 본 PRD v0.1 §10 risk_scenarios 테이블 스펙과 일치.
 * 프로토타입에서는 20건만 시드. 실 운영 시 4,432건 전체 임포트.
 */

window.RskSifData = {

    /**
     * 20건 큐레이션된 SIF 시나리오.
     * 담양군 시설 관리·소규모 공사·차량 운영 영역에 적합한 케이스만 선별.
     */
    scenarios: [
        // ─── 사다리·고소작업 (시설 점검·등기구 교체에서 가장 흔함) ───
        {
            id: 'SIF-2015-10-51-001',
            industry_type: 'ETC',
            work_category: '시설관리·고소작업',
            causing_object: '사다리',
            high_risk_situation: '사다리를 이용한 점검·작업',
            risk_factor: 'A형 사다리에서 작업 중 균형 상실로 머리부터 추락',
            incident_summary: '2015년 10월 OO교육시설에서 후문 캐노피(2.4m) CCTV 방향 조정 작업 후 이동식 A형 사다리로 내려오던 중 추락 사망',
            countermeasures: [
                '3.5m 미만 작업 시 A자형 사다리만 사용하고 2인 1조로 작업',
                '아웃트리거 설치 및 사다리 받침대 점검',
                '추락 시 머리 보호를 위한 안전모 착용',
                '사다리 작업 전 안전점검 체크리스트 작성'
            ],
            severity_hint: 5,
            tags: ['추락', '사다리', '고소작업'],
            applicable_dept: ['공공시설사업소 ★', '건설과 ★', '환경과']
        },
        {
            id: 'SIF-2016-03-21-018',
            industry_type: 'CONSTRUCTION',
            work_category: '시설 점검·고소작업',
            causing_object: '고소작업대',
            high_risk_situation: '고소작업대 사용 중 추락·전도',
            risk_factor: '고소작업대 작업 중 안전난간 미설치 상태로 추락',
            incident_summary: '2016년 3월 OO빌딩 배수실 배수탱크 상부에서 체크밸브 이물질 제거 작업 중 약 2.6m 아래 바닥으로 추락 사망',
            countermeasures: [
                '안전난간이 설치된 작업발판 설치·사용',
                '고소작업대 사용 또는 3.5m 미만은 A형 사다리 2인 1조',
                '안전대 부착설비 설치 후 안전대 착용'
            ],
            severity_hint: 5,
            tags: ['추락', '고소작업대', '시설점검'],
            applicable_dept: ['공공시설사업소 ★', '환경과', '물순환사업소 ★']
        },
        {
            id: 'SIF-2017-09-21-001',
            industry_type: 'CONSTRUCTION',
            work_category: '비계·가설',
            causing_object: '비계',
            high_risk_situation: '비계 위 작업 중 추락',
            risk_factor: '강관비계 안전난간 미설치 상태 작업 중 추락',
            incident_summary: '시설 외벽 보수 작업 중 비계 작업발판 단부에서 안전난간 없이 작업하다 4m 아래 추락 사망',
            countermeasures: [
                '비계 상부 작업발판 안전난간 설치 (상부 90cm, 중간 45cm)',
                '비계 조립·해체는 비계기능사 자격자 입회',
                '추락방호망 설치',
                '안전대 부착설비 및 안전대 착용'
            ],
            severity_hint: 5,
            tags: ['추락', '비계', '외벽보수'],
            applicable_dept: ['공공시설사업소 ★', '건설과 ★']
        },

        // ─── 옥상·지붕 작업 ───
        {
            id: 'SIF-2018-05-21-008',
            industry_type: 'CONSTRUCTION',
            work_category: '옥상·지붕 작업',
            causing_object: '지붕(채광판/슬레이트)',
            high_risk_situation: '지붕 점검·보수 중 채광판 파손 추락',
            risk_factor: '슬레이트 지붕 보행 중 채광판 파손되며 추락',
            incident_summary: '학교 강당 지붕 보수 작업 중 채광판을 밟아 약 6m 아래로 추락 사망',
            countermeasures: [
                '지붕 단부·채광판 위 보행 금지 표시',
                '안전대 부착설비(생명줄) 설치 후 안전대 착용',
                '지붕 작업용 발판 또는 보행로 설치',
                '채광판 상부에 추락방호망 설치'
            ],
            severity_hint: 5,
            tags: ['추락', '지붕', '채광판'],
            applicable_dept: ['공공시설사업소 ★', '교육지원과', '문화관광과']
        },

        // ─── 전기설비 ───
        {
            id: 'SIF-2019-08-31-001',
            industry_type: 'ETC',
            work_category: '전기설비 유지보수',
            causing_object: '전기충전부(충전전로)',
            high_risk_situation: '활선 상태 전기설비 점검 작업',
            risk_factor: '정전작업 없이 충전전로 인근 작업 중 접촉 감전',
            incident_summary: '시설 전기실에서 변압기 점검 작업 중 정전 미실시 상태에서 충전부 접촉 감전 사망',
            countermeasures: [
                '정전작업 후 검전기로 전기 점검 및 단락접지 실시',
                '활선작업용 기구·장치 사용 및 절연용 보호구 착용',
                '전기작업 전 LOTO(Lock Out / Tag Out) 절차 시행',
                '전기안전 자격자만 작업 수행'
            ],
            severity_hint: 5,
            tags: ['감전', '전기설비', 'LOTO'],
            applicable_dept: ['공공시설사업소 ★', '물순환사업소 ★', '환경과']
        },
        {
            id: 'SIF-2020-04-51-003',
            industry_type: 'ETC',
            work_category: '전기설비 점검',
            causing_object: '누전차단기·배전반',
            high_risk_situation: '배전반 정비 중 감전',
            risk_factor: '배전반 활선 상태에서 누전차단기 교체 작업 중 감전',
            incident_summary: '청사 지하 전기실에서 배전반 누전차단기 교체 작업 중 활선 접촉 사망',
            countermeasures: [
                '배전반 작업 전 주차단기 차단 및 LOTO 시행',
                '검전기로 무전압 확인 후 작업',
                '절연용 보호구(절연장갑·절연화·헬멧) 착용',
                '2인 1조 작업 및 감시자 배치'
            ],
            severity_hint: 5,
            tags: ['감전', '배전반', 'LOTO'],
            applicable_dept: ['공공시설사업소 ★', '물순환사업소 ★']
        },

        // ─── 화학물질·정수장 ───
        {
            id: 'SIF-2021-06-22-005',
            industry_type: 'MANUFACTURING',
            work_category: '화학물질 취급',
            causing_object: '염소 가스',
            high_risk_situation: '정수장 염소 투입 작업 중 누출',
            risk_factor: '염소 봄베 교체 작업 중 가스 누출로 흡입',
            incident_summary: '정수장 염소 소독 시설에서 봄베 교체 중 가스 누출로 작업자 1명 사망, 2명 중상',
            countermeasures: [
                '염소 누출 감지기 상시 가동·정기 점검',
                '봄베 교체 시 방독마스크(전면형·산성가스용) 착용',
                '2인 1조 작업 및 환기설비 가동 확인',
                '비상 샤워·세안 설비 설치 및 동선 확보',
                '누출 시 비상대응 매뉴얼 숙지 및 분기별 훈련'
            ],
            severity_hint: 5,
            tags: ['화학물질', '염소', '가스누출', '정수장'],
            applicable_dept: ['물순환사업소 ★']
        },
        {
            id: 'SIF-2019-11-22-001',
            industry_type: 'MANUFACTURING',
            work_category: '화학물질 취급',
            causing_object: '약품 저장탱크',
            high_risk_situation: '약품 탱크 청소·정비 작업',
            risk_factor: '밀폐공간 진입 시 산소결핍·유해가스 흡입',
            incident_summary: '정수장 약품 저장탱크 내부 청소 중 산소결핍으로 작업자 질식 사망',
            countermeasures: [
                '밀폐공간 작업 전 산소·유해가스 농도 측정',
                '환기설비 가동 (작업 전·중)',
                '송기마스크 또는 공기호흡기 착용',
                '외부 감시자 배치 및 안전대·구명로프 연결',
                '밀폐공간 작업허가서 발급 의무화'
            ],
            severity_hint: 5,
            tags: ['밀폐공간', '질식', '약품탱크'],
            applicable_dept: ['물순환사업소 ★', '환경과']
        },

        // ─── 보일러·가스 ───
        {
            id: 'SIF-2017-12-11-005',
            industry_type: 'MANUFACTURING',
            work_category: '난방·가스설비',
            causing_object: '가스보일러',
            high_risk_situation: '보일러실 점검 중 가스 누출·폭발',
            risk_factor: '가스 누출 감지 미흡으로 폭발 사고',
            incident_summary: '시설 지하 보일러실에서 가스 누출 후 점화 시 폭발, 작업자 1명 사망',
            countermeasures: [
                '가스 누출 감지기 추가 설치 및 월 1회 점검',
                '보일러실 환기설비 상시 가동',
                '보일러 점검 시 가스 차단 확인 후 작업',
                '비상 차단밸브 위치 명시 및 정기 작동 시험'
            ],
            severity_hint: 5,
            tags: ['가스', '폭발', '보일러'],
            applicable_dept: ['공공시설사업소 ★', '교육지원과']
        },

        // ─── 도로·포장 공사 ───
        {
            id: 'SIF-2019-08-21-012',
            industry_type: 'CONSTRUCTION',
            work_category: '도로 보수·포장',
            causing_object: '아스팔트 절단기',
            high_risk_situation: '도로 포트홀 보수 작업 중 차량 충돌',
            risk_factor: '도로 작업 중 일반 차량 진입으로 작업자 충돌',
            incident_summary: '국도 포트홀 보수 작업 중 우회로 안내 미흡으로 일반 차량이 작업구간 진입, 작업자 사망',
            countermeasures: [
                '도로 작업 시 안전표지·교통신호수 배치 의무화',
                '우회로 안내판 설치 및 라바콘 충분히 배치',
                '야간 작업 시 LED 안내등·반사조끼 착용',
                '경찰서·도로교통공단과 사전 협의 및 통행 제한'
            ],
            severity_hint: 5,
            tags: ['차량충돌', '도로작업', '교통'],
            applicable_dept: ['건설과 ★', '안전총괄과']
        },
        {
            id: 'SIF-2020-07-21-008',
            industry_type: 'CONSTRUCTION',
            work_category: '토공사·굴착',
            causing_object: '굴착기',
            high_risk_situation: '굴착기 작업 중 인양물 낙하',
            risk_factor: '굴착기 붐에 인양물을 매단 채 회전 중 낙하',
            incident_summary: '하수도 공사에서 굴착기로 자재 인양 중 줄걸이 파손되어 자재 낙하, 하부 작업자 사망',
            countermeasures: [
                '중량물 인양 시 슬링로프 각도 안전하중 확인',
                '양중용 달기구 변형 여부 사전점검',
                '자재 인양에 적합한 크레인·양중기 사용',
                '인양 작업 시 작업반경 내 출입 통제'
            ],
            severity_hint: 5,
            tags: ['낙하물', '굴착기', '인양'],
            applicable_dept: ['건설과 ★', '공공시설사업소 ★']
        },

        // ─── 차량·중장비 운영 ───
        {
            id: 'SIF-2018-12-51-024',
            industry_type: 'ETC',
            work_category: '차량 적재·하역',
            causing_object: '화물 트럭',
            high_risk_situation: '중량물 상하차 작업 중 낙하',
            risk_factor: '과적·체결 불량으로 적재물이 작업자에게 낙하',
            incident_summary: '폐 전신주 등 중량물 운반 중 적재함 파손되어 중량물 낙하, 하부 작업자 사망',
            countermeasures: [
                '차량 정격하중 확인하여 적합한 차량 선정',
                '적재물 결박 상태 점검 후 운행',
                '하차 시 작업반경 내 출입 통제 및 유도자 배치',
                '안전모·안전화 착용 의무'
            ],
            severity_hint: 5,
            tags: ['낙하물', '차량', '하역'],
            applicable_dept: ['건설과 ★', '환경과', '안전총괄과']
        },
        {
            id: 'SIF-2017-04-21-009',
            industry_type: 'CONSTRUCTION',
            work_category: '중장비 운영',
            causing_object: '이동식 크레인',
            high_risk_situation: '크레인 인양 중 보조붐 낙하',
            risk_factor: '보조붐 확장 시 연결핀 미체결 상태에서 측면 핀 해제',
            incident_summary: '집진설비 설치 공사에서 이동식 크레인 보조붐 확장 중 핀 미체결 상태로 보조붐 낙하, 작업자 사망',
            countermeasures: [
                '보조붐 확장 시 메인붐 끝단과 보조붐 연결핀 체결 철저',
                '작업 전 특별안전보건교육 실시',
                '크레인 작업 매뉴얼 준수 및 자격자 운전',
                '인양 작업 시 신호수·유도자 배치'
            ],
            severity_hint: 5,
            tags: ['낙하물', '크레인', '인양'],
            applicable_dept: ['건설과 ★', '공공시설사업소 ★']
        },

        // ─── 청소·정비 작업 (비정형) ───
        {
            id: 'SIF-2016-04-11-001',
            industry_type: 'ETC',
            work_category: '시설관리·정비',
            causing_object: '리프트(일반작업용)',
            high_risk_situation: '비정형 작업 중 끼임',
            risk_factor: '설비 미정지 상태에서 정비·청소 작업 중 끼임',
            incident_summary: '창고 리프트 작동 중 운반구에 떨어진 물건을 잡으려다 하강하는 운반구 상부와 건물 단면 사이 끼임 사망',
            countermeasures: [
                '설비 가동 중 이물질 제거 등 비정형 작업 사전 분석',
                'LOTO(Lock Out / Tag Out) 절차 시행',
                '정비·보수 작업 전 설비 정지 및 전원 차단',
                '관리감독자 확인 의무 부여'
            ],
            severity_hint: 5,
            tags: ['끼임', 'LOTO', '비정형'],
            applicable_dept: ['공공시설사업소 ★', '문화관광과']
        },
        {
            id: 'SIF-2016-04-11-002',
            industry_type: 'ETC',
            work_category: '시설관리·정비',
            causing_object: '에스컬레이터',
            high_risk_situation: '에스컬레이터 정비 작업 중 끼임',
            risk_factor: '에스컬레이터 정지 미확인 상태 정비 중 끼임',
            incident_summary: '에스컬레이터 핸드레일 고장 수리 작업 중 기계실 내부 고정부와 발판 사이 끼임 사망',
            countermeasures: [
                '에스컬레이터·승강기 점검 시 전원 차단 및 LOTO',
                '검사필증 확인 후 작업',
                '2인 1조 작업 및 외부 감시자 배치',
                '점검 중 표시판 설치 및 출입 통제'
            ],
            severity_hint: 5,
            tags: ['끼임', '승강기', 'LOTO'],
            applicable_dept: ['공공시설사업소 ★', '문화관광과']
        },

        // ─── 청사·체육시설 일반 ───
        {
            id: 'SIF-2022-03-51-001',
            industry_type: 'ETC',
            work_category: '청사·시설관리',
            causing_object: '미끄러운 바닥',
            high_risk_situation: '우천·결빙 시 보행자 미끄러짐',
            risk_factor: '우천·결빙으로 청사 출입구 바닥 미끄러져 전도',
            incident_summary: '시설 출입구에서 우천 시 미끄러져 머리 부딪힘 부상',
            countermeasures: [
                '우천·결빙 예보 시 미끄럼방지 매트 비치',
                '안내판 게시 및 야간 조명 보강',
                '출입구 바닥 미끄럼방지 코팅·요철 처리',
                '주기적 청소 및 결빙 제거 작업'
            ],
            severity_hint: 2,
            tags: ['미끄러짐', '전도', '청사'],
            applicable_dept: ['공공시설사업소 ★', '교육지원과', '문화관광과']
        },
        {
            id: 'SIF-2021-08-22-003',
            industry_type: 'ETC',
            work_category: '체육시설 운영',
            causing_object: '체육시설 설비',
            high_risk_situation: '체육관 농구골대·관중석 안전사고',
            risk_factor: '체육관 시설 고정 불량으로 전도',
            incident_summary: '학교 체육관 농구골대 고정 불량으로 사용 중 전도, 학생 부상',
            countermeasures: [
                '체육시설 정기 안전점검 (분기 1회)',
                '고정·체결 상태 확인 및 결속 보강',
                '하중 시험 후 사용 허가',
                '시설 사용자 교육 및 안전수칙 게시'
            ],
            severity_hint: 3,
            tags: ['전도', '체육시설', '시설안전'],
            applicable_dept: ['공공시설사업소 ★', '교육지원과', '문화관광과']
        },

        // ─── 정비·보수 + 회전체 ───
        {
            id: 'SIF-2017-11-22-009',
            industry_type: 'MANUFACTURING',
            work_category: '기계·설비 정비',
            causing_object: '회전체(펌프·송풍기)',
            high_risk_situation: '회전 설비 정비 작업 중 끼임',
            risk_factor: '설비 가동 중 정비 작업으로 회전체 끼임',
            incident_summary: '정수장 펌프 정비 작업 중 회전체에 손이 끼여 절단 사망',
            countermeasures: [
                '회전체 방호덮개 설치 또는 접근금지 울타리',
                '정비 시 설비 정지 + LOTO 시행',
                '방호장치 기능 유지 정기 점검',
                '안전작업허가서 발급 의무화'
            ],
            severity_hint: 5,
            tags: ['끼임', '회전체', '펌프', 'LOTO'],
            applicable_dept: ['물순환사업소 ★', '환경과']
        },

        // ─── 환경시설 ───
        {
            id: 'SIF-2020-09-22-014',
            industry_type: 'MANUFACTURING',
            work_category: '환경시설 운영',
            causing_object: '폐기물 처리설비',
            high_risk_situation: '폐기물 처리장 작업 중 가스 흡입',
            risk_factor: '폐기물 처리 시 발생 유해가스 흡입',
            incident_summary: '환경자원시설 폐기물 저장조 청소 중 유해가스 흡입으로 작업자 1명 사망',
            countermeasures: [
                '저장조·맨홀 진입 전 가스농도 측정',
                '환기설비 가동 및 방독마스크 착용',
                '밀폐공간 작업허가서 발급',
                '외부 감시자 배치 및 비상연락망 확보'
            ],
            severity_hint: 5,
            tags: ['밀폐공간', '유해가스', '환경시설'],
            applicable_dept: ['환경과', '물순환사업소 ★']
        },

        // ─── 행사·축제 운영 (지자체 특화) ───
        {
            id: 'SIF-2023-05-51-002',
            industry_type: 'ETC',
            work_category: '행사·축제 운영',
            causing_object: '가설 무대·구조물',
            high_risk_situation: '축제 가설 구조물 붕괴',
            risk_factor: '가설 무대 구조 결함으로 붕괴',
            incident_summary: '지역 축제에서 가설 무대 구조 결함으로 무대 일부 붕괴, 관람객·출연자 부상',
            countermeasures: [
                '가설 구조물 설치 전 구조 안전 검토 (구조기술사 검토서)',
                '시공 완료 후 안전 점검 및 하중 시험',
                '풍하중·인원 밀집도 고려한 설계',
                '행사 중 상시 점검자 배치'
            ],
            severity_hint: 4,
            tags: ['구조물', '붕괴', '행사', '축제'],
            applicable_dept: ['문화관광과', '안전총괄과', '공공시설사업소 ★']
        }
    ],

    /**
     * 관리대상 type / 부서에 따른 추천 알고리즘 (룰베이스 단순 구현).
     * Phase 1: 부서 매칭 + 시설 type 매칭만으로 시작.
     * 추후 시맨틱 검색·임베딩으로 고도화.
     */
    recommend: function(opts) {
        opts = opts || {};
        var targetType = opts.targetType || 'all';   // 시설/사업/업무
        var dept = opts.dept || '';                   // 부서명
        var tags = opts.tags || [];                   // 키워드 태그

        var scored = this.scenarios.map(function(s) {
            var score = 0;
            // 부서 매칭 (+3)
            if (dept && s.applicable_dept.indexOf(dept) >= 0) score += 3;
            // type 매칭 (+1)
            if (targetType === '시설' && s.industry_type === 'ETC') score += 1;
            if (targetType === '사업' && s.industry_type === 'CONSTRUCTION') score += 2;
            // 태그 매칭 (+1 each)
            tags.forEach(function(t) {
                if (s.tags.indexOf(t) >= 0) score += 1;
            });
            // 심각도 가중치
            score += (s.severity_hint || 0) * 0.3;
            return Object.assign({}, s, { _score: score });
        });

        scored.sort(function(a, b) { return b._score - a._score; });
        return scored;
    },

    /**
     * 키워드 검색
     */
    search: function(query) {
        if (!query) return this.scenarios;
        var q = query.toLowerCase();
        return this.scenarios.filter(function(s) {
            return (s.risk_factor + ' ' + s.incident_summary + ' ' + s.causing_object + ' ' + s.tags.join(' ')).toLowerCase().indexOf(q) >= 0;
        });
    },

    /**
     * ID로 단건 조회
     */
    getById: function(id) {
        return this.scenarios.filter(function(s) { return s.id === id; })[0] || null;
    }
};
