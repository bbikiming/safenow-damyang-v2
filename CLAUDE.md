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

**드롭존은 `DYV2.uploadDrop()`로만 렌더 (MUST)** — `.upload-drop`은 `cursor:pointer`·hover 강조로 "클릭하여 업로드" 어포던스를 약속하므로, 없는 동작을 시각적으로 약속하는 무핸들러 드롭존(`<div class="upload-drop">…</div>` 직접 작성)은 **금지**한다. 대신 접근성 렌더러 `DYV2.uploadDrop(labelHtml, onAct, opts)`(`js/common.js`)를 재사용한다. 이 헬퍼는 `role="button"`·`tabindex="0"`과 클릭·Enter·Space 활성화(`DYV2.dropKey`)를 배선하고, `opts.hint === true`면 `fileHint()`를 함께 렌더하며 `aria-describedby`로 제약 문구를 연결한다(WCAG 2.1.1/4.1.2/2.4.7, 포커스 링은 `css/v2.css`의 `.upload-drop:focus-visible`).
- `onAct`: 활성화 시 실행할 인라인 JS 표현식(기존 `onclick` 관례대로 작은따옴표 문자열). 생략 시 프로토타입 토스트. **실제 등록/제출은 모달 하단 `[등록]`·`[제출]` 버튼이 담당**하고, 드롭존은 파일 선택 어포던스만 응답한다.
- 예외 — 실제 파일 `input`을 배선한 드롭존(`js/facil.js` `#fac-drop`)과 정적 HTML 마크업(`base-bulk.html`)은 헬퍼 대신 같은 속성(`role`·`tabindex`·`onkeydown="DYV2.dropKey(event)"`)을 직접 부여해 실제 배선을 보존한다.

### 3. 조직도 데이터 — 단일 출처

조직도 데이터는 `DYV2.ORG`(`js/common.js`)에 단일 정의한다. 화면별 조직도는 `DYV2.orgFlat()` 등 파생 뷰만 사용하고 자체 조직도 데이터를 만들지 않는다.
- 스키마: 노드 `{ id, name, type('root'|'post'|'bureau'|'dept'|'team'|'office'|'town'), members:[{uid, name, role, team?}], children:[...] }`. 권한 시드가 uid 를 참조하므로 **uid 는 변경 금지**.
- 파생 헬퍼: `DYV2.orgFlat(opts)`(EDOC 호환 평면 투영 `[{dept, members:[[role,name]]}]`) · `DYV2.orgNode(id)` · `DYV2.orgCount(id, includeSub)` · `DYV2.orgTotal()` · `DYV2.orgWalk(fn)`.
- 소비처: `EDOC.ORG_TREE`(= `orgFlat()` 파생 → 경영방침·의견청취·회의록·업무 등록 담당자·예산 기관) · 메뉴/권한/사용자 관리(`DYADM.ORG = DYV2.ORG` 참조) · 인력평가 평가자 선택(evl-eval.html `PICK_TREE` 파생) · 조직 화면(m=org) 요약 카드.
- `common.js` 는 `edoc.js`·`adm-perm.js` 보다 먼저 로드되어야 한다(전 페이지 검증됨).

### 4. 업무 목록(세트 테이블) 컬럼 헤더

`js/setlist.js`의 세트 단위 테이블(`setCard`·`unassignedCard`)은 `SL_HEAD`(`<thead>`)를 포함해 컬럼(PDCA 단계·문서명·담당자·담당부서·수정일·상태·관리)을 항상 표기한다. `docRow`의 7열과 1:1로 정렬되어야 한다.

### 5. 디자인 토큰 — 원시값 금지 (MUST)

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
- 예외 — `onepager-docflow.html`·`screen-definitions.html`은 레이아웃 시스템 밖 독립 문서라 치환 대상이 아니다. 포크 클론(`safe-damyang-v2/`)도 본 저장소 규칙의 대상이 아니다.
- 검사: `grep -nE '#[0-9a-fA-F]{3,6}|font-size: *[0-9]|z-index: *[0-9]' css/v2.css css/edu.css` 잔존 0.

### 6. 표준 컴포넌트 클래스 — 계열 신설 금지

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

### 7. 브레이크포인트 — 4단계 표준

`xl 1280 / lg 1024 / md 768 / sm 560` **4개 값만** 사용한다. 그 밖의 폭(1599·1279·1100·900·860·767·720·640·479 등)으로 미디어쿼리를 새로 만들지 않는다.

- CSS: `@media (max-width: 1023px)`처럼 표준값−1 을 쓴다(토큰 `--bp-*`는 문서·참조용 — `@media`는 `var()`를 지원하지 않는다).
- JS: `matchMedia` 리터럴 금지. `DYV2.BP`(`{xl:1280, lg:1024, md:768, sm:560}`) 또는 `DYV2.below('lg')`를 쓴다.
- 셸(햄버거+드로어) 전환은 `lg`(1023px 이하) 기준이며, 컴포넌트도 같은 시점에 접혀야 한다.

### 8. 신규 화면 체크리스트

새 화면·컴포넌트를 추가하기 전 아래를 만족시킨다.

1. 색·폰트·반경·z-index 에 원시값 0 (§5).
2. 배지·select·테이블·빈상태·탭·토스트·모달은 표준 클래스/헬퍼 사용, 새 계열 신설 없음 (§6).
3. 조직도는 `DYV2.ORG` 파생만, 업로드는 `DYV2.uploadDrop()`/`DYV2.fileHint()` (§2·§3).
4. 모달은 `DYV2.openModal` 1개만, 적층 없음 (§1).
5. **375px에서 확인** — 가로 스크롤 없음(표는 스크롤 래퍼 안), 겹침·과밀 없음, 미디어쿼리는 4단계 표준값만 (§7).
6. 본문·배지 최소 폰트 **12px**(장식 글리프 `▸▾` 등은 예외), 주요 터치 타깃 44px.
