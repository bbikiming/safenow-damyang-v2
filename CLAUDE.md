# 담양군 중대재해 통합관리 시스템 — 프로토타입 v2

빌드/프레임워크 없는 정적 HTML + 전역 스크립트(IIFE) 프로토타입. 각 화면은 `*.html`, 로직은 `js/*.js`(전역 `DYV2`·`EDOC`·`DYREG`·`DYSETLIST` 네임스페이스), 스타일은 `css/style.css`(공통) + `css/v2.css`(v2 토큰·컴포넌트).

## 문서 위치 — 루트에 문서를 늘리지 말 것

프로젝트 루트의 `.md` 는 **`CLAUDE.md`(작업 규칙)와 `README.md`(개요) 2개뿐**이다. 그 외 문서는 전부 `docs/` 아래에 두고, 목록은 [`docs/README.md`](docs/README.md)가 관리한다.

| 위치 | 용도 |
|---|---|
| `docs/planning/` | **현행** 기획·PRD·검수 문서 — 새 기획 문서는 여기 |
| `docs/screen-definitions/` | 화면 정의서(SoT) + `_build-data.py` 생성 스크립트 |
| `docs/archive/` | 대체·완료된 문서와 과거 검증 기록(`audit/`) — 새 작업의 근거로 삼지 말 것 |
| `docs/` 루트 | RFP 기능요구사항 정리 · `DESIGN-TOKENS.md` |

문서를 옮기거나 새로 만들면 `docs/README.md` 표에 한 줄을 함께 갱신한다. 구현이 기획을 대체하면 **삭제하지 말고 `archive/`로 옮기고 대체 사유를 표에 적는다**(왜 지금 구조가 되었는지 추적 가능해야 한다).

---

## UI 규칙

### 1. 단일 모달 규칙 — 한 시점에 모달은 반드시 1개 (MUST)

화면에 떠 있는 모달/다이얼로그 오버레이는 **항상 1개**다. 모달 위에 또 다른 모달을 띄우는 적층(stacked modal)은 **금지**한다.

**근거** — 적층 모달은 (a) 닫기·ESC·백드롭 클릭의 대상이 모호해지고, (b) 포커스 트랩이 깨지며, (c) 부모 모달이 가려져 맥락을 잃고, (d) 오버레이가 잔류(orphan)하기 쉽다.

**올바른 패턴 — 모달 안 인라인 패널**
부가 선택(조직도에서 담당자 선택 등)이 필요하면 **새 모달을 띄우지 말고**, 현재 모달 본문 안에 자체 스크롤 영역을 가진 인라인 패널로 넣는다.
- 인라인 조직도 트리는 공용 클래스 `.org-inline` / `.org-inline-search` / `.org-inline-body`(`css/v2.css`)를 재사용한다.
  - 상시 노출형: `js/doc-register.js`의 `ownerBlock()` + `wireOwnerTree()` (담당자 트리를 `#reg-orgtree` 패널로 임베드).
  - 토글형(버튼으로 펼침): `js/edoc.js`의 `EDOC.openOrgTree(targetId)` — 입력을 `.orgpick-field`로 감싸고 그 안에 트리를 펼친다. (전자문서 점검자·경영방침 점검자 공용)
- 모달 안 '추가' 폼은 `PG._stackOpen()`(`js/menu.js`)처럼 모달 본문에 `.stack-inline` 패널로 붙인다(`#v2-modal .modal-body`에 append).
- 펼침 상세(법령 ⓘ 등)는 `EDOC.lawInfo(btnEl, basis)`처럼 해당 행 아래 `.lawinfo-inline`으로 펼친다.
- 단계가 많은 입력은 마법사 스텝(`doc-register.js`의 STEP 1~4)처럼 **같은 모달 안에서 본문을 교체**한다.

**공유 헬퍼만 사용**
- 모달 열기/닫기는 반드시 `DYV2.openModal(title, bodyHtml, footHtml)` / `DYV2.closeModal()`만 사용한다. `openModal`은 진입 시 `closeModal()`을 호출해 기존 레이어를 먼저 제거하므로, 이 경로만 쓰면 단일 모달 불변식이 자동 유지된다.
- `closeModal()`은 본 모달(`#v2-modal`)과 함께 부수 오버레이(`org-tree-overlay`·`stack-overlay` 등)도 제거한다.
- 직접 `document.createElement('div'); ...appendChild` 로 오버레이를 만들지 않는다.

**적층 오버레이 → 인라인 전환 완료 (2026-06-24)**
아래는 모두 별도 오버레이를 제거하고 인라인 패널로 전환됨. 신규 작업 시 같은(적층) 패턴을 다시 만들지 말 것.
- `js/edoc.js` `openOrgTree()` — 점검자 선택: 입력 아래 `.org-inline` 토글 패널.
- `js/edoc.js` `lawInfo()` — 관련 법령 상세: 점검 항목 아래 `.lawinfo-inline` 펼침.
- `js/menu.js` `PG._stackOpen()` — 관리 모달 추가 폼: 모달 본문 안 `.stack-inline` 패널.

### 2. 첨부파일 업로드 안내 — 단일 출처

지원 형식·용량·개수 제약은 `DYV2.FILE_LIMITS`(`js/common.js`)에 단일 정의하고, 업로드 영역 하단 안내 문구는 `DYV2.fileHint()`로 렌더한다. 새 업로드 UI를 만들면 문구를 직접 쓰지 말고 `DYV2.fileHint()`를 재사용한다. (현재: 지원 형식 HWP·HWPX·PDF·DOC(X)·XLS(X)·PPT(X)·JPG·PNG·ZIP, 파일당 최대 20MB, 최대 10개.)

**드롭존은 `DYV2.uploadDrop()`로만 렌더 (MUST)** — `.upload-drop`은 `cursor:pointer`·hover 강조로 "클릭하여 업로드" 어포던스를 약속하므로, 없는 동작을 시각적으로 약속하는 무핸들러 드롭존(`<div class="upload-drop">…</div>` 직접 작성)은 **금지**한다. 대신 접근성 렌더러 `DYV2.uploadDrop(labelHtml, onAct, opts)`(`js/common.js`)를 재사용한다. 이 헬퍼는 `role="button"`·`tabindex="0"`과 클릭·Enter·Space 활성화(`DYV2.dropKey`)를 배선하고, `opts.hint === true`면 `fileHint()`를 함께 렌더하며 `aria-describedby`로 제약 문구를 연결한다(WCAG 2.1.1/4.1.2/2.4.7, 포커스 링은 `css/v2.css`의 `.upload-drop:focus-visible`).
- `onAct`: 활성화 시 실행할 인라인 JS 표현식(기존 `onclick` 관례대로 작은따옴표 문자열). 생략 시 프로토타입 토스트. **실제 등록/제출은 모달 하단 `[등록]`·`[제출]` 버튼이 담당**하고, 드롭존은 파일 선택 어포던스만 응답한다.
- 예외 — 실제 파일 `input`을 배선한 드롭존(`js/facil.js` `#fac-drop`)과 정적 HTML 마크업(`base-bulk.html`)은 헬퍼 대신 같은 속성(`role`·`tabindex`·`onkeydown="DYV2.dropKey(event)"`)을 직접 부여해 실제 배선을 보존한다.

### 3. 조직도 데이터 — 단일 출처

조직도 데이터는 `DYV2.ORG`(`js/common.js`)에 단일 정의한다. 화면별 조직도는 `DYV2.orgFlat()` 등 파생 뷰만 사용하고 자체 조직도 데이터를 만들지 않는다.
- 스키마: 노드 `{ id, name, type('root'|'post'|'bureau'|'dept'|'team'|'office'|'town'), members:[{uid, name, role, team?}], children:[...] }`. 권한 시드가 uid 를 참조하므로 **uid 는 변경 금지**.
- 파생 헬퍼: `DYV2.orgFlat(opts)`(EDOC 호환 평면 투영 `[{dept, members:[[role,name]]}]`) · `DYV2.orgDepts()`(부서형 노드 `[{id, name, count}]`) · `DYV2.deptNames()` · `DYV2.orgNode(id)` · `DYV2.orgCount(id, includeSub)` · `DYV2.orgTotal()` · `DYV2.orgWalk(fn)`.
  - `orgFlat()`은 EDOC 호환을 위해 **id 를 버리고 부서명만** 투영한다. 부서를 `deptId`로 저장하는 도메인(위험성평가)은 `orgDepts()`를 쓴다.

**부서·담당자 선택 UI 는 `ORGPICK`(`js/org-pick.js`)으로만 렌더 (MUST)** — 새 부서 `<select>` 드롭다운을 만들지 말고 공용 인라인 조직도(`.org-inline` + `.otr-*`, 검색 + 240px 스크롤)를 재사용한다. 전 화면이 같은 트리 GUI를 공유해야 한다. `js/common.js` 뒤에 로드.
- `ORGPICK.toggle(fieldId, mode, '전역함수경로')` — 입력 필드(`.orgpick-field` 래퍼) 아래 펼치는 토글형. 고르면 패널이 닫힌다.
  - `'dept'` → `fn(부서명)`. 부서를 **이름**으로 저장하는 도메인(작업환경측정·건강검진).
  - `'deptId'` → `fn(id, name)`. 부서를 **id**로 저장하는 도메인(위험성평가 — 수시평가 등록).
  - `'member'` → `fn('부서 · 역할 / 이름')`.
  - ※ dept/deptId 두 모드는 저장 스키마가 실제로 갈려 있어 공존한다. 합치려면 스키마부터 통일할 것.
- `ORGPICK.deptsPanel(panelId, opts)` — **부서 다중 선택 · 상시 노출형**(트리가 본문 자체인 마법사 STEP 용, `js/rsk-list.js` 정기평가 생성 STEP1). `opts`: `selectedPath`(선택맵 반환 전역함수) · `onToggle` · `countId` · `allckId`.
  - `onToggle`에서 **전체 재렌더(`openModal`) 금지** — 패널을 다시 그리면 검색어·스크롤이 날아간다. 선택 개수·전체선택 indeterminate 동기화는 ORGPICK이 인플레이스로 처리하고, 선택맵을 바깥에서 통째로 바꾼 뒤(전체선택 등)에만 `ORGPICK.refreshDepts(panelId)`를 호출한다.
- 예외 — 부서 **필터** 드롭다운(목록 상단 조회 조건)은 등록이 아니므로 `<select>` 유지.
- 소비처: `EDOC.ORG_TREE`(= `orgFlat()` 파생 → 경영방침·의견청취·회의록·업무 등록 담당자·예산 기관) · 메뉴/권한/사용자 관리(`DYADM.ORG = DYV2.ORG` 참조) · 인력평가 평가자 선택(evl-eval.html `PICK_TREE` 파생) · 조직 화면(m=org) 요약 카드.
- `common.js` 는 `edoc.js`·`adm-perm.js` 보다 먼저 로드되어야 한다(전 페이지 검증됨).

### 4. 안전보건교육 — 별도 GNB 그룹 · 7메뉴 + 상세 1 (재설계 v1 적용, 2026-07-20)

안전보건교육은 **독립 GNB 그룹 `edu`**(`js/layout.js`)이고, SNB 3뎁스 구조다 — 현업근로자(정기 `edu-reg` · 채용시 `edu-hire` · 기타 `edu-etc`) · 관리감독자(정기 `edu-sup` · 기타 `edu-sup-etc`) · 직속(이수현황 `edu-status` · 근로자 명단 관리 `edu-workers`). 근거: `docs/planning/기획-안전보건교육-재설계-v1.md` — safe-damyang-v2 스냅샷의 UI/UX·메뉴 구조를 이식(2026-07-20). **구 "단일 화면 3탭" 확정(보완안 §7, 2026-07-19)은 이 이식으로 대체됨** — 다시 3탭으로 합치지 말 것.

- 파일 구성: 화면 HTML 8개(`edu-reg/hire/etc/sup/sup-etc/status/workers/reg-detail.html`) + 모듈 6개(`js/edu-reg.js` EDUR · `edu-reg-detail.js` EDURD · `edu-hire.js` EDUH · `edu-etc.js` EDUE · `edu-status.js` EDUS · `edu-workers.js` EDUW) + `js/edu-data.js`(전역 `DYEDU`, 데이터 단일 출처) + `js/edu-filter.js`(전역 `EDUFILTER`, 공용 필터 바) + `js/edu-approval.js`(전역 `EDUAPV`, 온나라 결재 상신) + `js/edu-tour.js`(전역 `EDUTOUR`, 시연 투어). 공용 스타일은 `css/v2.css`의 `edu-*` 블록 — **별도 `edu.css` 파일 없음**(재생성 금지).
- 로드 순서: `layout.js → common.js → org-pick.js → edu-data.js → edu-filter.js → 화면 모듈 → edu-approval.js → edu-tour.js`.
- **온나라 결재 상신은 `EDUAPV`(`js/edu-approval.js`)로만** — 화면마다 결재 버튼·문서를 새로 짜지 않는다. 근거: `docs/planning/기획-안전보건교육-온나라결재상신-v1.md`(v1.1). **상신 트리거 3종**:
  - **총괄(Type 1)** — 목록 화면 init 후 `EDUAPV.boot({ view })`(우측 최상단 `[총괄 결재 상신]` 자동 주입 `.page-head-action`). 한 팝업 3탭(`kind`·`person`·`all`, 대상 연도·부서 조회 조건).
  - **교육별(Type 2)** — 교육 카드/상세의 결재 상태 칩(`EDUAPV.courseControl(id)`) · 상세 화면은 `boot({ mode:'course' })`(버튼 `[이 교육 결재 상신]`). `openCourse(id)` → 그 교육 1건 실시 결과 문서.
  - **개인별(Type 3)** — 이수현황 대상자별 상세 행의 결재 칩(`EDUAPV.personControl(wid)`). `openPerson(wid)` → 그 사람 1명 이수 확인서.
  - **목록 결재 상태**(미상신·결재중·결재완료·반려)는 위 두 컨트롤로 노출한다. 미상신=액션 버튼, 이후=상태 칩(클릭 시 상태 팝업 — 시연용 결재완료/반려 회신·재상신). 화면 모듈은 init 에서 `EDUAPV.registerRefresh(render)`로 자동 갱신을 등록한다. 상태 어휘 tone 은 `DYV2.STATUS_TONE`(공용) 단일 출처.
  - 문서는 `DYV2.openModal(..., { variant:'wide' })` 위에 **표준 `.pdf-paper` + `.pdf-doc` modifier**로 그리고, 표는 `.table-figma` + `.table-doc` modifier를 쓴다(새 계열 신설 금지 §7). 자작 오버레이·자작 표 계열을 만들지 말 것.
  - 문서 수치는 전부 `DYEDU` 파생이다 — 결재용 별도 시드를 만들면 화면과 결재문서가 조용히 어긋난다. 상태 스토어·결재선만 `sessionStorage['dy-edu-approval-v2']`·`['dy-edu-apprline-v1']`에 둔다.
  - **결재선을 코드에 고정하지 말 것** — 결재권자는 안전보건 법령이 아니라 **지자체 위임전결규칙** 소관이라 조직 개편·규칙 개정으로 바뀐다. 기본값(기안자 부서의 팀장 → 부서장)만 `DYV2.ORG`에서 직위명으로 파생하고, 변경은 `ORGPICK`(`member` 모드) 인라인 조직도로만 받는다(새 select 금지). 기안문 결재란 칸 수·직위·이름은 이 결재선을 그대로 따른다.
- **관리감독자 2화면은 별도 코드가 아니다** — `EDUR/EDUE.init(mount, { supMode: true })` 플래그 재사용(`edu-sup.html`·`edu-sup-etc.html`). 관리감독자용 파일을 새로 만들지 말 것.
- `edu.html`은 `edu-status.html`(대표 진입) 리다이렉트 스텁(쿼리 보존). 기존 링크는 무수정 동작.
- **`js/edu-data.js`는 삭제·덮어쓰기 금지** — `js/my-work.js`가 `global.DYEDU`로 참조하고, 현재본이 소스 스냅샷의 상위집합(v1r4, 독촉 시드 3건 포함)이다. 시드 변경 시 `SKEY` 버전 범프.
- **시연 투어(EDUTOUR)는 발표용 핵심 자산 — 제거 금지.** 4단계(집합교육 등록 → 부서 신청·서명 업로드 → 교육 종료 처리 → 이수현황 반영)를 실제 화면을 건너다니며 구동하는 크로스 페이지 투어다. 단계 상태는 sessionStorage(`dy-edu-tour-v1`), 모듈이 저장 성공 시 `EDUTOUR.onEvent('created'|'applied'|'closed')` 호출로 자동 진행하고 모달에는 `.edu-tour-inline` 시연 포인트가 자동 주입된다. **각 edu 화면은 모듈 init 후 `EDUTOUR.boot()`를 반드시 호출**(시연 바+패널 렌더). 시연 데이터 복원·초기화는 `DYEDU.reset()`.
- 표준 준수 이식: 탭 `.sub-tabs` · 표 `.table-figma`(+`.table-compact`·`.table-nowrap`·`tr.row-short` modifier) · 배지 `chip-status`(+`.chip-sm`)+`DYV2.toneOf` · 빈상태 `.v2-empty` · 게이지 `.progress` · 등록 폼 부서 선택 `ORGPICK('deptId')`(목록 상단 필터는 `<select>` 유지). 모달 상호작용 재렌더 전 `capture*()`로 입력값 보존.
- **목록 필터는 `EDUFILTER`(`js/edu-filter.js`)로만 렌더 (MUST)** — 화면마다 필터 UI 를 새로 짜지 않는다. `EDUFILTER.bar(fields, opts)` 가 [검색어][셀렉트…][체크] … [결과 건수][필터 초기화][액션] 한 줄을 만들고, `opts.reset` 은 적용 중인 조건 개수를 배지로 보여준다(0건이면 비활성). 보조: `yearOptions(dates)`(데이터에 실재하는 연도만) · `monthOptions()` · `match(q, parts)`(다중 필드 부분일치).
  - **검색어가 있는 화면의 재렌더는 반드시 `EDUFILTER.rerender(render)`로 감싼다** — mount 를 통째로 다시 그리는 이 코드베이스 관례상, 감싸지 않으면 타이핑 도중 포커스·캐럿이 날아간다.
  - 화면별 조건: 정기(검색·상태·연도·월·[자체]부서) · 채용시(검색·부서·고용형태·채용연도·[이수탭]이수구분) · 기타(검색·분류·부서·연도) · 이수현황(요약: 검색·완료율구간 / 상세: 검색·부서·구분·고용형태·이수상태) · 명단(검색·부서·구분·고용형태·출처·채용연도).
- **교육 시간은 회차(sessions)에서만 파생한다 (MUST)** — 등록 폼은 `일자 + 시작~종료 시각`의 회차 탭(최대 5일)이고, 교육 시간 입력란은 없다. 합계는 `DYEDU.sumSessionHours()`(0.1h 단위) 단일 출처이며, 저장 시 `date`·`time`·`endTime` 은 1회차, `hours` 는 합계로 파생한다(기존 화면·집계 호환). 시간을 바꾸는 수정은 반드시 `DYEDU.syncCourseRecordHours()` 로 이미 쌓인 이수기록까지 함께 갱신한다 — 안 맞추면 교육 카드의 'Nh'와 이수현황의 '인정 Nh'가 조용히 어긋난다. 표시는 `courseDateTime()`(다회차면 '외 N일')·`courseSessions()` 를 쓰고 화면에서 직접 시각을 빼지 않는다.
- **이수현황 필터는 모집단 기준을 요약·상세가 공유한다** — 구분·고용형태·채용연도·출처는 `inPopulation()` 한 곳에서 판정하고, 부서별 요약의 완료율도 같은 조건으로 다시 집계한다(`DYEDU.deptSummary(date, filterFn)`). 필터를 건 화면에는 집계 모집단 배지(`.edu-pop-note`)를 함께 노출해 전체 수치로 오독되지 않게 한다.
- **CRUD 는 회수 경로까지 갖춘다 (MUST)** — 등록만 있고 지울 수단이 없으면 시연을 반복할수록 데이터가 쌓여 발표가 망가진다. 교육은 `수정`·`삭제`(EDUR/EDUE), 신청은 `신청 취소`(EDURD), 채용시 이수는 `이수 취소`(EDUH)를 제공한다.
  - 데이터 회수는 `DYEDU.removeCourse(id)`(교육+신청+이수기록 연쇄) · `DYEDU.removeEnroll(courseId, deptId)`(신청+해당 부서 이수기록)만 사용하고, 확인 모달에 **회수되는 이수시간·건수를 반드시 명시**한다.
  - 수정 모달에서는 **대상자를 바꾸지 않는다** — 이미 붙은 이수기록과 어긋나므로 신청 취소 → 재신청(집합) 또는 삭제 → 재등록(자체·기타) 경로로만 처리한다.
- 딥링크: `edu-status.html?dept={deptId}&short=1`(상세뷰+미달 필터, `?status=done|short|over|soon` 도 지원) · `edu-reg-detail.html?id={courseId}`(백링크는 body `data-back-href`).
- `layout.js` `renderSidebar`의 SNB 3뎁스(`item.section`) 로직과 `style.css`의 `.dy-sidebar-section`·`.dy-sidebar-sep`·`.dy-sidebar-item.is-nested`는 **이 그룹이 실사용처**다.
- 잔여 후속: 화면 정의서(`js/screen-defs-data.js`)는 아직 구 3탭 기준 — 정의서 원본 갱신 후 `_build-data.py` 재생성 필요.

### 5. 업무 목록(세트 테이블) 컬럼 헤더

`js/setlist.js`의 세트 단위 테이블(`setCard`·`unassignedCard`)은 `SL_HEAD`(`<thead>`)를 포함해 컬럼(PDCA 단계·문서명·담당자·담당부서·수정일·상태·관리)을 항상 표기한다. `docRow`의 7열과 1:1로 정렬되어야 한다.

### 6. 디자인 토큰 — 원시값 금지 (MUST)

색·폰트 크기·반경·그림자·z-index 는 **`css/style.css` `:root` 토큰만** 사용한다. CSS·JS·HTML 어디서든 원시값(hex·rgba·px 폰트·리터럴 z-index)을 직접 쓰지 않는다.

**근거** — 원시값은 토큰과 같은 값이어도 "단일 출처"가 아니다. 토큰을 고쳐도 따라오지 않아 화면마다 색이 어긋나고, 새 화면이 자기 팔레트를 재발명하는 출발점이 된다.

| 종류 | 토큰 | 비고 |
|---|---|---|
| 표면 | `--surface`(#fff) · `--surface-alt`(#fafafa, 표 헤더 등) · `--surface-sunken`(페이지 바닥) | `--surface-alt`를 `--page-bg`로 수렴시키지 않는다 |
| 브랜드·중립·상태 | `--main`/`--brand-*` · `--text-*`/`--gray-*`/`--card-line` · `--status-{tone}-bg/border/fg` | |
| 폰트 | `--fs-12` ~ `--fs-38` · `--fw-*` | 스케일 밖 값은 **최근접 토큰으로 수렴** |
| 반경 | `--radius-xs/sm/md/button/progress/statbox/card/pill/full` | 동상 |
| 그림자·백드롭 | `--shadow-sm/md/lg` · `--overlay-scrim` | |
| 레이어 | `--z-base(1)` · `--z-nav(30)` · `--z-fab(90)` · `--z-drawer(100)` · `--z-overlay(110)` · `--z-modal(120)` · `--z-toast(130)` | 6단계 밖 임의 값 금지. FAB 는 드로어·오버레이보다 **아래** |

- `var(--x, #폴백)`의 폴백값은 반드시 실제 토큰값과 일치시킨다(불일치 폴백은 조용한 색 어긋남의 원인).
- 예외 — `onepager-docflow.html`·`screen-definitions.html`은 레이아웃 시스템 밖 독립 문서라 치환 대상이 아니다.
- 검사: `grep -nE '#[0-9a-fA-F]{3,6}|font-size: *[0-9]|z-index: *[0-9]' css/v2.css` 잔존 0.

### 7. 표준 컴포넌트 클래스 — 계열 신설 금지

동일 요소는 **한 계열로만** 구현한다. 화면 전용 접두어(`sh-`·`edu-`·`evl-`·`rl-` 등)로 같은 요소를 다시 만들지 않고, 변형이 필요하면 표준 클래스의 modifier 로 붙인다.

| 요소 | 표준 | 폐기·별칭 대상 |
|---|---|---|
| 상태 배지 | `chip-status` + `DYV2.toneOf(라벨)` | `chip-mini.st-*` · `sh-st` · `.edu-src` · `.tag` (별칭 후 점진 치환) · `.badge-*`(미사용, 삭제) |
| select | `.form-select` | `.select`(별칭 유지) |
| 테이블 | `.table-figma` | `.sh-table` · `.edu-table` · 화면 로컬 `*-table` |
| 빈 상태 | `.v2-empty` | `.sh-empty` · `.edu-empty` |
| 토스트 | `DYV2.toast` | layout.js·screen-definitions.js 자체 구현 |
| 탭 | `.tabs` / `.tab` | `sh-vtab` · `sh-ptab` · `edu-tab` · `sd-tab` 등 |
| 모달 | `DYV2.openModal` (§1) | 자작 백드롭 `.ev-modal-backdrop` · `.evl-modal-backdrop` |
| 조직도 픽커 | `ORGPICK` / `.org-inline` (§1) | `.evp-*` · `.org-tree-panel` · `.bgt-tree-*` · `.admp-tree` |

**상태 어휘 → tone 은 `DYV2.STATUS_TONE`(`js/common.js`) 단일 출처**다. 화면에서 라벨별 색을 직접 고르지 않고 `DYV2.toneOf(label)`로 tone 을 얻어 `--status-{tone}-*` 토큰을 쓴다. 매핑에 없는 라벨은 `neutral` 로 수렴하므로, 새 어휘는 표에 추가한다.

### 8. 브레이크포인트 — 4단계 표준

`xl 1280 / lg 1024 / md 768 / sm 560` **4개 값만** 사용한다. 그 밖의 폭(1599·1279·1100·900·860·767·720·640·479 등)으로 미디어쿼리를 새로 만들지 않는다.

- CSS: `@media (max-width: 1023px)`처럼 표준값−1 을 쓴다(토큰 `--bp-*`는 문서·참조용 — `@media`는 `var()`를 지원하지 않는다).
- JS: `matchMedia` 리터럴 금지. `DYV2.BP`(`{xl:1280, lg:1024, md:768, sm:560}`) 또는 `DYV2.below('lg')`를 쓴다.
- 셸(햄버거+드로어) 전환은 `lg`(1023px 이하) 기준이며, 컴포넌트도 같은 시점에 접혀야 한다.

### 9. 신규 화면 체크리스트

새 화면·컴포넌트를 추가하기 전 아래를 만족시킨다.

1. 색·폰트·반경·z-index 에 원시값 0 (§5).
2. 배지·select·테이블·빈상태·탭·토스트·모달은 표준 클래스/헬퍼 사용, 새 계열 신설 없음 (§6).
3. 조직도는 `DYV2.ORG` 파생만, 업로드는 `DYV2.uploadDrop()`/`DYV2.fileHint()` (§2·§3).
4. 모달은 `DYV2.openModal` 1개만, 적층 없음 (§1).
5. **375px에서 확인** — 가로 스크롤 없음(표는 스크롤 래퍼 안), 겹침·과밀 없음, 미디어쿼리는 4단계 표준값만 (§7).
6. 본문·배지 최소 폰트 **12px**(장식 글리프 `▸▾` 등은 예외), 주요 터치 타깃 44px.
