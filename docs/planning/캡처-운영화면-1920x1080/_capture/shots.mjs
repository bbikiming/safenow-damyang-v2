// C01~C11 캡처 시나리오 — 예시 데이터는 캡처 직전에만 넣는다(프로토타입 시드 무변경).
const B = 'http://localhost:8785/';
const as = role => `localStorage.setItem('dy-skin','ops'); localStorage.setItem('dy-role-sim-v1','${role}'); localStorage.setItem('dy-help-seen:index','1');`;

const OCC_SEED = `
  const R = DYRSK; R.reset();
  const add = o => R.addOccasional(Object.assign({ year: 2026 }, o));
  const done = (occ, date, txt) => R.occImprovements(occ.id).forEach(m => { m.status = 'DONE'; m.completed_date = date; m.action_content = txt; m.signature = { by: '담당자', at: date }; m.confirm = { state: 'OK', by: '박안전', at: date, reason: '', round: 1 }; });
  const a = add({ deptId: 'facility', reason: 'REPAIR', date: '2026-07-08', desc: '국민체육센터 지붕 방수 보수공사 착수 전 고소작업 위험성 재평가', files: [{ name: '지붕보수_작업계획서.pdf' }],
    hazards: [{ name: '지붕 단부 작업 중 추락', action: '안전난간 설치 및 안전대 부착설비 확보', due: '2026-07-31' }] });
  const b = add({ deptId: 'construct', reason: 'BUILDING', date: '2026-06-29', desc: '농촌도로 확포장 구간 가설 교량 설치 · 거더 인양 작업', files: [{ name: '가설교량_시공계획서.pdf' }, { name: '현장사진.zip' }],
    hazards: [{ name: '거더 인양 중 낙하·협착', action: '인양 작업반경 출입통제 및 신호수 배치', due: '2026-07-20' }, { name: '교각 상부 작업 중 추락', action: '작업발판·안전난간 설치', due: '2026-07-20' }] });
  const c = add({ deptId: 'town_damyang', reason: 'METHOD', date: '2026-06-02', desc: '가로수 전지작업을 고소작업차 방식으로 변경', files: [{ name: '전지작업_작업절차서.hwpx' }],
    hazards: [{ name: '고소작업차 전도·협착', action: '아웃트리거 설치 확인 및 작업 전 점검표 운영', due: '2026-06-30' }] });
  const d = add({ deptId: 'health', reason: 'OTHER', date: '2026-04-22', desc: '방문보건 차량 운행 노선 확대에 따른 교통사고 위험 재평가', files: [{ name: '운행노선_변경계획.pdf' }],
    hazards: [{ name: '장거리 운행 중 교통사고', action: '운행 전 차량 점검 및 2인 1조 운행', due: '2026-05-31' }] });
  done(c, '2026-06-24', '고소작업차 작업 전 점검표 운영 개시'); done(d, '2026-05-20', '차량 점검표 비치 및 2인 1조 운행');
  const m = R.occImprovements(b.id)[0]; m.status = 'DONE'; m.completed_date = '2026-07-06'; m.action_content = '출입통제 펜스·신호수 배치 완료';
  R.setOccReviewFile(b.id, b.id + '_안전관리자검토_서명본.pdf', '한국안전기술원 이안전', '2026-07-03');
  R.setOccReviewFile(c.id, c.id + '_안전관리자검토_서명본.pdf', '한국안전기술원 이안전', '2026-06-12');
  R.setOccReviewFile(d.id, d.id + '_안전관리자검토_서명본.pdf', '한국안전기술원 이안전', '2026-04-28');
  return R.occasionals(2026).length;`;

const RSK2026_SEED = `
  DYRSK.reset();
  const K = Object.keys(sessionStorage).find(k => k.startsWith('damyangRsk'));
  const d = JSON.parse(sessionStorage.getItem(K));
  const NM = { safety: '재난안전과', env: '환경과', water: '물순환사업소', facility: '공공시설사업소', town_damyang: '담양읍' };
  const dept = (id, insp, st, repAt, by, due) => ({ deptId: id, inspectDate: insp, surveyFile: '', status: st, reportFile: NM[id] + '_설문조사표_작성본.hwpx', reportAt: repAt, reportBy: NM[id] + ' · ' + by, deliveredAt: '2026-05-27', dueDate: due, hazards: [] });
  let seq = 300;
  const imp = (dept, name, cat, action, owner, due, st, cfm, at) => ({
    id: 'IMP-' + (++seq), source_type: 'risk_assessment', assessment_id: 'RA-2026-01', dept_id: dept, target_id: '', process_id: '',
    hazard: { name, category: cat, cause: '', basis: '' }, hazard_risk_factor: name, description: action, action,
    assigned_to: NM[dept] + ' · 주무관 / ' + owner, due, due_date: due, before_photo: false, after_photo: false, before_photos: [], after_photos: [],
    action_content: st === 'DONE' ? action + ' 완료' : '', completed_date: st === 'DONE' ? at : '', signature: st === 'DONE' ? { by: owner, at } : null,
    status: st, reassessed: false, created: '2026-05-27',
    confirm: cfm ? { state: cfm, by: cfm === 'OK' ? '박안전' : '', at: cfm === 'OK' ? at : '', reason: '', round: 1 } : undefined,
    history: [{ type: 'NOTIFY', at: '2026-05-27 10:00', by: '재난안전과', memo: '개선조치 전달 (기한 ' + due + ')' }] });
  const imps = [
    imp('safety', '청사 비상계단 적치물로 인한 대피 지연', '물리적', '비상계단 적치물 제거 및 상시 점검표 비치', '박안전', '2026-06-30', 'DONE', 'OK', '2026-06-18'),
    imp('safety', '재난상황실 전원 배선 노출', '전기', '노출 배선 몰드 처리 및 누전차단기 점검', '박안전', '2026-07-24', 'IN_PROGRESS'),
    imp('env', '재활용 선별장 컨베이어 끼임', '기계적', '컨베이어 비상정지 스위치 추가 설치', '정환경', '2026-07-10', 'DONE', 'WAIT', '2026-07-08'),
    imp('env', '음식물 처리시설 황화수소 노출', '화학적', '가스농도 측정기 비치 및 환기설비 보강', '정환경', '2026-08-14', 'IN_PROGRESS'),
    imp('env', '수거차량 후진 시 작업자 충돌', '물리적', '후방카메라·경보장치 설치', '정환경', '2026-08-14', 'IN_PROGRESS'),
    imp('water', '정수장 약품 투입실 염소가스 누출', '화학적', '누출 감지기 교체 및 방독마스크 비치', '하정수', '2026-06-30', 'DONE', 'OK', '2026-06-27'),
    imp('water', '하수처리장 맨홀 밀폐공간 질식', '화학적', '밀폐공간 작업허가제 운영 및 산소농도 측정기 비치', '하정수', '2026-07-10', 'IN_PROGRESS'),
    imp('water', '펌프장 회전체 방호덮개 미설치', '기계적', '회전축 방호덮개 설치', '하정수', '2026-07-31', 'IN_PROGRESS'),
    imp('facility', '체육관 고소 조명 교체 중 추락', '물리적', '고소작업대 도입 및 안전대 지급', '이시설', '2026-06-30', 'DONE', 'OK', '2026-06-20'),
    imp('facility', '수영장 기계실 바닥 미끄럼', '물리적', '미끄럼방지 매트 설치', '이시설', '2026-06-30', 'DONE', 'OK', '2026-06-22'),
    imp('town_damyang', '하천 제초작업 중 예초기 비산물', '기계적', '보안면·정강이 보호대 지급 및 작업반경 통제', '김읍', '2026-08-31', 'IN_PROGRESS')
  ];
  d.improvements = d.improvements.concat(imps);
  d.assessments.push({ id: 'RA-2026-01', year: 2026, type: 'REGULAR', status: 'IN_PROGRESS', title: '2026년 정기 위험성평가', createdAt: '2026-04-01',
    targetId: 'f_jns', scope: 'ALL', method: '4x4', team: [], worker_participation: false, change_reason: '', changed_processes: [], completed_at: '', approval: '',
    files: { surveyAll: '2026_정기평가_유해위험요인설문조사표.hwpx', report: '2026_정기위험성평가_결과보고서(용역).pdf' },
    review: { stage: 'DELIVERED', extractedAt: '2026-05-22', parsedDepts: {} },
    depts: [dept('safety', '2026-05-06', 'BEFORE', '2026-05-11', '박안전', '2026-07-24'), dept('env', '2026-05-07', 'BEFORE', '2026-05-12', '정환경', '2026-08-14'),
            dept('water', '2026-05-08', 'BEFORE', '2026-05-13', '하정수', '2026-07-31'), dept('facility', '2026-05-12', 'DONE', '2026-05-15', '이시설', '2026-06-30'),
            dept('town_damyang', '2026-05-13', 'BEFORE', '2026-05-18', '김읍', '2026-08-31')],
    history: [{ type: 'CREATE', at: '2026-04-01', by: '재난안전과 박안전', memo: '2026 정기평가 생성 · 5개 부서 선정' },
              { type: 'DELIVER', at: '2026-05-27', by: '재난안전과 박안전', memo: '전 부서 개선조치 전달 (총 11건)' }] });
  sessionStorage.setItem(K, JSON.stringify(d));
  return d.assessments.length;`;

const EDOC_SEED = `
  const ds = {}; const at = '2026-07-14 10:20';
  const put = (id, st) => ds[id] = { status: st, fields: {}, history: [{ at, ev: st === '확정' ? '확정 · 온나라 상신' : st === '등록완료' ? '등록' : '임시저장' }] };
  put('EDOC-도급점검-G-4173-2026H2', '확정'); put('EDOC-도급위험성-G-4173-최초', '확정');
  put('EDOC-도급점검-G-4170-2026H2', '등록완료'); put('EDOC-도급위험성-G-4170-최초', '확정');
  put('EDOC-도급점검-G-4169-2026H2', '작성중');
  put('EDOC-도급점검-G-4166-2026H2', '확정'); put('EDOC-도급위험성-G-4166-최초', '확정');
  put('EDOC-도급점검-M-1-2026H2', '확정'); put('EDOC-도급위험성-M-1-최초', '확정');
  put('EDOC-도급점검-M-2-2026H2', '작성중'); put('EDOC-도급위험성-M-2-최초', '확정');
  localStorage.setItem('dy-edoc-v1', JSON.stringify(ds));`;

const FAC_EXT_SEED = `
  const recs = DYFACIL.seedRecs();
  const G = ['B', 'C', 'B', 'D', 'B', 'C', 'A', 'B', 'C', 'B', 'D', 'B', 'C', 'B'];
  const L = ['2026-04-14', '2026-03-28', '2025-11-20', '2025-09-30', '2026-05-08', '2025-08-22', '2026-02-17', '2026-04-02', '2026-01-15', '2025-12-10', '2026-03-05', '2026-05-21', '2025-10-30', '2026-06-03'];
  const U = [18500, 3200, 650, 1200, 900, 4300, 280, 2100, 760, 1500, 5200, 430, 980, 2600];
  recs.slice(0, 14).forEach((r, i) => DYFACIL.saveExt(r.facilNo, { safetyGrade: G[i], lastInspectYmd: L[i], defectYn: 'N', dailyUsers: String(U[i]) }));
  return recs.length;`;

const FAC_HISTORY = `
  const NO = 'WS2008-0000016';
  DYFACIL._detail(NO); await new Promise(r => setTimeout(r, 400));
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  v('ex-grade', 'B'); v('ex-last', '2026-04-14'); v('ex-defyn', 'N'); v('ex-size', '12000'); v('ex-unit', '톤/일'); v('ex-dept', '물순환사업소'); v('ex-users', '18500');
  DYFACIL._saveExt(NO); await new Promise(r => setTimeout(r, 300));
  document.querySelectorAll('.v2-toast, #toast, .toast').forEach(t => t.remove());
  DYFACIL._detail(NO); await new Promise(r => setTimeout(r, 500));
  const g = document.querySelector('.modal-body .fac-grid');
  const rows = [
    ['정기안전점검(상반기)', '2026-03-16 ~ 2026-04-14', 'B', '김정수', '배관 지지대 부식, 밸브실 바닥 균열 일부 — 보수 권고'],
    ['정기안전점검(하반기)', '2025-10-20 ~ 2025-11-18', 'B', '김정수', '취수탑 외벽 백태·누수흔적, 난간 도장 박리'],
    ['정밀안전점검', '2025-05-12 ~ 2025-07-10', 'C', '박현우', '여과지 구조체 균열 다수 — 보수·보강 필요, 6개월 내 재점검'],
    ['정기안전점검(상반기)', '2025-03-10 ~ 2025-04-08', 'B', '김정수', '전기실 케이블 트레이 정리 필요, 경미 균열'],
    ['정기안전점검(하반기)', '2024-10-14 ~ 2024-11-12', 'B', '이성민', '배수지 맨홀 뚜껑 부식, 안전표지 훼손'],
    ['정기안전점검(상반기)', '2024-03-18 ~ 2024-04-16', 'A', '이성민', '특이사항 없음']
  ];
  const tone = { A: 'success', B: 'info', C: 'warning' };
  g.insertAdjacentHTML('afterend',
    '<div class="fac-sec-t" style="margin-top:18px;" id="cap-insp">점검 · 진단 이력 <span class="chip-mini wt-elec">FMS 수신 · 읽기전용</span> <span class="chip-mini wt">' + rows.length + '건</span></div>' +
    '<div style="overflow-x:auto;"><table class="table-figma"><thead><tr><th>점검 종류</th><th>기간</th><th>결과</th><th>책임기술자</th><th>종합의견</th></tr></thead><tbody>' +
    rows.map(r => '<tr><td style="white-space:nowrap;">' + r[0] + '</td><td style="white-space:nowrap;">' + r[1] + '</td><td><span class="chip-status ' + tone[r[2]] + '">' + r[2] + '등급</span></td><td>' + r[3] + '</td><td style="font-size:12px;color:var(--text-gray);">' + r[4] + '</td></tr>').join('') +
    '</tbody></table></div>');
  const body = document.querySelector('.modal-body'); body.scrollTop = document.getElementById('cap-insp').offsetTop - 120;`;

const FORM_FILL = `
  DOCUP.open(2026); await new Promise(r => setTimeout(r, 400));
  DOCUP.addFiles([{ name: '2026년 하반기 도급사업 안전보건 점검 결과 보고.pdf', size: 482113, type: 'application/pdf' },
                  { name: '붙임1_도급사업 안전보건 점검표(정수장 내진보강 공사).hwpx', size: 96512, type: '' }]);
  await new Promise(r => setTimeout(r, 300));
  document.getElementById('du-date').value = '2026-07-14';
  DOCUP.setDir('internal'); await new Promise(r => setTimeout(r, 200));
  DOCUP.pickOwner('u_jjt2', '박안전');`;

export default [
  { name: 'C01-메인대시보드', pre: as('mayor'), preUrl: B + 'index.html', url: B + 'index.html',
    after: `const g = document.querySelector('.dy-gnb'); if (![...g.children].some(a => a.textContent.trim() === '시스템 관리')) { const a = g.querySelector('.dy-gnb-item:not(.is-active)').cloneNode(true); a.textContent = '시스템 관리'; g.appendChild(a); }` },
  { name: 'C02-위험성평가목록', pre: as('staff') + OCC_SEED, preUrl: B + 'rsk-occ.html', url: B + 'rsk-occ.html' },
  { name: 'C03-위험성평가평가표(상세)', pre: as('staff') + RSK2026_SEED, preUrl: B + 'rsk-list.html', url: B + 'rsk-list.html',
    after: `
      const leaf = t => [...document.querySelectorAll('main *')].find(e => e.childElementCount === 0 && (e.textContent || '').trim().startsWith(t));
      const hideUp = t => { let x = leaf(t); if (!x) return 'miss ' + t; while (x.parentElement && x.parentElement.offsetHeight < 260 && x.parentElement.tagName !== 'MAIN') x = x.parentElement; x.style.display = 'none'; };
      hideUp('용역업체 보고서'); hideUp('온나라 이관');
      let p = [...document.querySelectorAll('main *')].filter(e => (e.textContent || '').includes('내 부서 진행 상황')).pop();
      while (p && p.offsetHeight < 200) p = p.parentElement;
      window.scrollTo(0, p.getBoundingClientRect().top + scrollY - 132);` },
  { name: 'C04-안전보건교육계획·대상자', pre: as('staff'), preUrl: B + 'index.html', url: B + 'edu-reg-detail.html?id=C-M07' },
  { name: 'C05-안전보건교육이수현황', url: B + 'edu-status.html' },
  { name: 'C05-안전보건교육이수현황(미이수대상)', url: B + 'edu-status.html?status=short' },
  { name: 'C06-도급·용역사업목록', pre: as('staff') + EDOC_SEED, preUrl: B + 'index.html', url: B + 'menu.html?m=contract' },
  { name: 'C07-도급·용역사업별문서목록', url: B + 'menu.html?m=contract',
    after: `const t = document.querySelector('main table'); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 140);` },
  { name: 'C08-시설물목록', pre: FAC_EXT_SEED, preUrl: B + 'fac-list.html', url: B + 'fac-risk.html' },
  { name: 'C09-시설물점검이력(상세)', url: B + 'fac-list.html', after: FAC_HISTORY },
  { name: 'C10-업무문서작성화면', pre: as('staff'), preUrl: B + 'index.html', url: B + 'cmp-docs.html', after: FORM_FILL },
  { name: 'C11-업무문서제출·확인현황', url: B + 'cmp-status.html' }
];
