# 담양군 중대재해 통합관리 시스템 — 프로토타입 v2

빌드/프레임워크 없는 정적 HTML + 전역 스크립트(IIFE) 프로토타입. 각 화면은 `*.html`, 로직은 `js/*.js`(전역 `DYV2`·`EDOC`·`DYREG`·`DYSETLIST` 네임스페이스), 스타일은 `css/style.css`(공통) + `css/v2.css`(v2 토큰·컴포넌트).

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

### 3. 조직도 데이터 — 단일 출처

조직도 데이터는 `DYV2.ORG`(`js/common.js`)에 단일 정의한다. 화면별 조직도는 `DYV2.orgFlat()` 등 파생 뷰만 사용하고 자체 조직도 데이터를 만들지 않는다.
- 스키마: 노드 `{ id, name, type('root'|'post'|'bureau'|'dept'|'team'|'office'|'town'), members:[{uid, name, role, team?}], children:[...] }`. 권한 시드가 uid 를 참조하므로 **uid 는 변경 금지**.
- 파생 헬퍼: `DYV2.orgFlat(opts)`(EDOC 호환 평면 투영 `[{dept, members:[[role,name]]}]`) · `DYV2.orgNode(id)` · `DYV2.orgCount(id, includeSub)` · `DYV2.orgTotal()` · `DYV2.orgWalk(fn)`.
- 소비처: `EDOC.ORG_TREE`(= `orgFlat()` 파생 → 경영방침·의견청취·회의록·업무 등록 담당자·예산 기관) · 메뉴/권한/사용자 관리(`DYADM.ORG = DYV2.ORG` 참조) · 인력평가 평가자 선택(evl-eval.html `PICK_TREE` 파생) · 조직 화면(m=org) 요약 카드.
- `common.js` 는 `edoc.js`·`adm-perm.js` 보다 먼저 로드되어야 한다(전 페이지 검증됨).

### 4. 업무 목록(세트 테이블) 컬럼 헤더

`js/setlist.js`의 세트 단위 테이블(`setCard`·`unassignedCard`)은 `SL_HEAD`(`<thead>`)를 포함해 컬럼(PDCA 단계·문서명·담당자·담당부서·수정일·상태·관리)을 항상 표기한다. `docRow`의 7열과 1:1로 정렬되어야 한다.
