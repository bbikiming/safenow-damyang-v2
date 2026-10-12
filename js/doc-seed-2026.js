/* =========================================================================
 * 2026년 시연 시드 — 이행 실적 (DYDOC2026)
 *   ※ 생성물 — 손으로 고치지 말 것. 규칙을 고치고 재생성한다.
 *      생성기: tools/build-doc-seed-2026.py
 *      입력:   js/doc-taxonomy-data.js · js/doc-history-data.js (둘 다 생성물)
 *
 *   [이것이 무엇인가] 2026년 이행 실적은 아직 일어나지 않은 일이라 담양군에서
 *   받을 수 없다. 그런데 문서 0건으로 두면 전 단계가 전부 미이행으로 떠서
 *   «시스템이 비었다»로 읽힌다. 그래서 규칙으로 만든 **시연 시드**다.
 *     · 2025 에 실적이 있던 단계만 후보 — 작년에 한 적 없는 일을 올해 했다고
 *       하지 않는다.
 *     · 도래한 회차를 넘지 않는다 — 미래 실적을 만들지 않는다.
 *     · dataMode:'demo' · origin:'seed26' 으로 원장·사용자 등록분과 구분된다.
 *   실서비스에서는 이 파일을 로드하지 않는다(빈 배열과 같다).
 *
 *   DOCS[] : DYDOCS 문서 축의 네 번째 출처. 2025 문서 제목을 이어받고 연도만 바꾼다.
 *   ST{}   : 업무단계 진행상태 폴백. st2025 와 같은 자리에서 같은 방식으로 쓰인다.
 *            (문서 수로 판정하는 «이행상태»와 다른 축이다 — 합치지 말 것.)
 * ========================================================================= */
window.DYDOC2026 = {
  META: {
  "year": 2026,
  "today": "2026-07-16",
  "rule": "2025 실적 보유 단계 중 주기별 채택률로 선정(해시 순서) · 도래 회차 이내",
  "adopt": {
    "YEAR": 0.26,
    "HALF": 0.52,
    "QUARTER": 0.56,
    "MONTH": 0.58,
    "EVENT": 0.26,
    "WEEK": 0.0
  },
  "stagesSeeded": 23,
  "docs": 29,
  "expect": {
    "충족": 13,
    "진행중": 10,
    "지연": 11,
    "미이행": 54
  }
},
  ST: {
  "OSH-08-03": "in_progress",
  "OSH-04-01": "complete",
  "OSH-04-02": "in_progress",
  "IND-04-02": "in_progress",
  "CIT-01-05": "in_progress",
  "CIT-01-04": "complete",
  "CIT-01-07": "in_progress",
  "CIT-01-06": "in_progress",
  "IND-08-01": "in_progress",
  "CIT-01-02": "in_progress",
  "IND-08-04": "complete",
  "IND-05-05": "in_progress",
  "CIT-03-01": "in_progress",
  "IND-10-01": "complete",
  "IND-10-02": "in_progress",
  "IND-10-03": "in_progress",
  "OSH-01-02": "complete",
  "IND-07-01": "complete",
  "OSH-03-02": "in_progress",
  "IND-04-01": "in_progress",
  "CIT-01-01": "in_progress",
  "MGT-01-01": "in_progress",
  "MGT-01-02": "in_progress"
},
  DOCS: [
    {"id": "SEED26-0001", "seedOf": "DOC-2025-000945", "title": "2026 담양군 중대재해 예방 종합계획(안)", "sr": "", "dept": "재난안전과", "dir": "out", "date": "2026-07-12", "stageIds": ["OSH-08-03"], "cycle": "정기주기 없음", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0002", "seedOf": "DOC-2025-053469", "title": "근로자 안전사고 발생시 보고(산업재해조사표) 철저", "sr": "담양군 재난안전과", "dept": "농업기술센터미래농업연구단", "dir": "internal", "date": "2026-03-30", "stageIds": ["OSH-04-01"], "cycle": "정기주기 없음", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0003", "seedOf": "DOC-2025-053725", "title": "일시사역 근로자 산업재해 조사표 송부", "sr": "담양군농업기술센터 농촌지원과", "dept": "농업기술센터미래농업연구단", "dir": "internal", "date": "2026-05-12", "stageIds": ["OSH-04-02"], "cycle": "정기주기 없음", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0004", "seedOf": "DOC-2025-005587", "title": "[소규모] 폭염예방물품 (농업용모자) 구입", "sr": "", "dept": "재난안전과", "dir": "out", "date": "2026-04-13", "stageIds": ["IND-04-02"], "cycle": "정기주기 없음", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0005", "seedOf": "DOC-2025-000931", "title": "2026 담양군 중대재해 예방 종합계획(안)", "sr": "", "dept": "재난안전과", "dir": "out", "date": "2026-06-03", "stageIds": ["CIT-01-05"], "cycle": "정기주기 없음", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0006", "seedOf": "DOC-2025-000930", "title": "2026 담양군 중대재해 예방 종합계획(안)", "sr": "", "dept": "재난안전과", "dir": "out", "date": "2026-06-28", "stageIds": ["CIT-01-04"], "cycle": "정기주기 없음", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0007", "seedOf": "DOC-2025-000933", "title": "2026 담양군 중대재해 예방 종합계획(안)", "sr": "", "dept": "재난안전과", "dir": "out", "date": "2026-04-14", "stageIds": ["CIT-01-07"], "cycle": "정기주기 없음", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0008", "seedOf": "DOC-2025-000932", "title": "2026 담양군 중대재해 예방 종합계획(안)", "sr": "", "dept": "재난안전과", "dir": "out", "date": "2026-05-09", "stageIds": ["CIT-01-06"], "cycle": "정기주기 없음", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0009", "seedOf": "DOC-2025-041059", "title": "담양군 매립장 유지관리 중대재해 발생대비 매뉴얼 수립", "sr": "", "dept": "환경과", "dir": "out", "date": "2026-04-16", "stageIds": ["IND-08-01"], "cycle": "정기주기 없음", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0010", "seedOf": "DOC-2025-004368", "title": "2026년 상반기 중대재해 이행점검 실시결과 제출", "sr": "담양군의회 의회사무과", "dept": "재난안전과", "dir": "internal", "date": "2026-03-23", "stageIds": ["CIT-01-02"], "cycle": "반기 1회", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0011", "seedOf": "DOC-2025-004290", "title": "2026년 상반기 중대(산업)재해 이행점검 실시 결과 제출", "sr": "물순환사업소", "dept": "재난안전과", "dir": "internal", "date": "2026-05-14", "stageIds": ["IND-08-04"], "cycle": "반기 1회 이상", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0012", "seedOf": "DOC-2025-004477", "title": "2026년 상반기 중대(산업)재해 이행점검 실시 결과 제출", "sr": "담양군 기획예산실", "dept": "재난안전과", "dir": "internal", "date": "2026-03-24", "stageIds": ["IND-05-05"], "cycle": "반기 1회 이상", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0013", "seedOf": "DOC-2025-045074", "title": "2026년 상반기 저수조 청소 및 수질검사, 건축물 관리자 법정 교육 안내", "sr": "담양군 물순환사업소", "dept": "공공시설사업소", "dir": "internal", "date": "2026-04-10", "stageIds": ["CIT-03-01"], "cycle": "반기 1회 이상", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0014", "seedOf": "DOC-2025-000942", "title": "2026 담양군 중대재해 예방 종합계획(안)", "sr": "", "dept": "재난안전과", "dir": "out", "date": "2026-04-16", "stageIds": ["IND-10-01"], "cycle": "반기 1회", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0015", "seedOf": "DOC-2025-052015", "title": "2026년 공익직불제 화학비료 사용기준 준수 이행점검 결과 보고('26.1.1~'26. 8.31.)", "sr": "전라남도농업기술원장(기술보급과장)", "dept": "농업기술센터기술보급과", "dir": "out", "date": "2026-06-28", "stageIds": ["IND-10-02"], "cycle": "반기 1회", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0016", "seedOf": "DOC-2025-009934", "title": "2026년 하반기 중대(시민)재해 예방을 위한 안전·보건확보 의무이행 점검 결과", "sr": "", "dept": "재난안전과", "dir": "out", "date": "2026-03-23", "stageIds": ["IND-10-03"], "cycle": "반기 1회", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0017", "seedOf": "DOC-2025-029437", "title": "보건관리자 근무환경 현장 순회 점검에 따른 조치사항 안내", "sr": "담양군 재난안전과", "dept": "산림정원과", "dir": "internal", "date": "2026-01-22", "stageIds": ["OSH-01-02"], "cycle": "월 1회", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0018", "seedOf": "DOC-2025-029680", "title": "보건관리자 근무환경 현장 순회점검에 따른 조치 결과 제출", "sr": "재난안전과장", "dept": "산림정원과", "dir": "out", "date": "2026-02-16", "stageIds": ["OSH-01-02"], "cycle": "월 1회", "src": "onnara", "st": "결재완료", "round": 2},
    {"id": "SEED26-0019", "seedOf": "DOC-2025-031286", "title": "산업안전보건법에 따른 보건관리 점검 협조 요청", "sr": "담양군 재난안전과", "dept": "산림정원과", "dir": "internal", "date": "2026-03-27", "stageIds": ["OSH-01-02"], "cycle": "월 1회", "src": "onnara", "st": "결재완료", "round": 3},
    {"id": "SEED26-0020", "seedOf": "DOC-2025-031410", "title": "산업안전보건법에 따른 보건관리 현장 점검 조치사항 안내", "sr": "담양군 재난안전과", "dept": "산림정원과", "dir": "internal", "date": "2026-04-27", "stageIds": ["OSH-01-02"], "cycle": "월 1회", "src": "onnara", "st": "결재완료", "round": 4},
    {"id": "SEED26-0021", "seedOf": "DOC-2025-031429", "title": "산업안전보건법에 따른 보건관리 현장 점검 조치결과 제출", "sr": "재난안전과장", "dept": "산림정원과", "dir": "out", "date": "2026-05-13", "stageIds": ["OSH-01-02"], "cycle": "월 1회", "src": "onnara", "st": "결재완료", "round": 5},
    {"id": "SEED26-0022", "seedOf": "DOC-2025-053421", "title": "2026년 하반기 중대(산업)재해 의무이행 점검 실시 결과 제출 2차 안내", "sr": "담양군 재난안전과", "dept": "참여소통실", "dir": "internal", "date": "2026-03-25", "stageIds": ["IND-07-01"], "cycle": "분기 1회", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0023", "seedOf": "DOC-2025-053429", "title": "2026년 하반기 중대(산업)재해 의무이행 점검 실시결과 제출", "sr": "재난안전과장", "dept": "참여소통실", "dir": "out", "date": "2026-06-27", "stageIds": ["IND-07-01"], "cycle": "분기 1회", "src": "onnara", "st": "결재완료", "round": 2},
    {"id": "SEED26-0024", "seedOf": "DOC-2025-028322", "title": "2026년 하반기 현업근로자 안전보건교육 실시 안내 및 교육결과 제출", "sr": "담양군 재난안전과", "dept": "문화체육과", "dir": "internal", "date": "2026-02-23", "stageIds": ["OSH-03-02"], "cycle": "분기 1회", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0025", "seedOf": "DOC-2025-028359", "title": "한국가사문학관 2026년 11월 두번째 안전보건교육일지, 작업자세별 스트레칭", "sr": "", "dept": "문화체육과", "dir": "out", "date": "2026-05-08", "stageIds": ["OSH-03-02"], "cycle": "분기 1회", "src": "onnara", "st": "결재완료", "round": 2},
    {"id": "SEED26-0026", "seedOf": "DOC-2025-001111", "title": "중대재해 예방을 위한 안전보건 예산 수립 요청", "sr": "전라남도 안전정책과", "dept": "재난안전과", "dir": "in", "date": "2026-05-08", "stageIds": ["IND-04-01"], "cycle": "연 1회", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0027", "seedOf": "DOC-2025-050778", "title": "2026 담양군 중대(산업·시민)재해 예방 안전계획 수립 결과 제출", "sr": "담양군수(재난안전과장)", "dept": "농업기술센터농촌지원과", "dir": "out", "date": "2026-06-21", "stageIds": ["CIT-01-01"], "cycle": "연 1회", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0028", "seedOf": "DOC-2025-000943", "title": "2026 담양군 중대재해 예방 종합계획(안)", "sr": "", "dept": "재난안전과", "dir": "out", "date": "2026-04-28", "stageIds": ["MGT-01-01"], "cycle": "연 1회", "src": "onnara", "st": "결재완료", "round": 1},
    {"id": "SEED26-0029", "seedOf": "DOC-2025-001375", "title": "2026 담양군 중대(산업·시민)재해 예방 안전계획 수립 결과 제출 회신", "sr": "가사문학면", "dept": "재난안전과", "dir": "internal", "date": "2026-04-03", "stageIds": ["MGT-01-02"], "cycle": "연 1회", "src": "onnara", "st": "결재완료", "round": 1}
  ]
};
