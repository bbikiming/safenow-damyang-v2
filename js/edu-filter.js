/* =====================================================================
   edu-filter.js · 안전보건교육 공용 필터 바 (EDUFILTER)
   ---------------------------------------------------------------------
   전 edu 화면(정기·채용시·기타·이수현황·명단)의 목록 상단 조회 조건을
   같은 모양·같은 동작으로 렌더한다. 화면마다 필터 UI 를 새로 짜지 않는다.

   구성 — [검색어] [셀렉트…] [체크] ……… [결과 건수] [필터 초기화] [액션]
     · 셀렉트는 조회 조건이므로 <select> 유지 (등록 폼의 부서 선택만 ORGPICK, CLAUDE.md §3)
     · '필터 초기화'는 적용 중인 조건 개수를 배지로 보여주고, 0건이면 비활성

   사용:
     EDUFILTER.bar([
       { type:'search', id:'er-q', value:S.q, placeholder:'교육명·강사·장소', on:"EDUR.setF('q', this.value)" },
       { type:'select', id:'er-st', value:S.st, label:'상태', options:[['','상태 전체'],['OPEN','신청 접수 중']], on:"EDUR.setF('st', this.value)" },
       { type:'check',  id:'er-x',  value:S.x, label:'미달자만', on:"EDUR.setF('x', this.checked?1:'')" },
     ], { count:list.length, unit:'건', reset:'EDUR.resetF()', actions:'<button …>' })

   ※ 검색어 입력 중에도 목록을 다시 그려야 하므로, 재렌더는 반드시
     EDUFILTER.rerender(render) 로 감싼다 — 포커스·캐럿 위치를 복원한다.
   전역: EDUFILTER.*  (js/common.js 뒤, 화면 모듈 앞에 로드)
   ===================================================================== */
(function (global) {
    'use strict';
    function V() { return global.DYV2; }
    function esc(s) { return V().esc(String(s == null ? '' : s)); }

    /* options: [['value','label'], …] 또는 ['label', …] */
    function optionsHtml(options, value) {
        return (options || []).map(function (o) {
            var v = Array.isArray(o) ? o[0] : o;
            var l = Array.isArray(o) ? o[1] : o;
            return '<option value="' + esc(v) + '"' + (String(value == null ? '' : value) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
        }).join('');
    }

    function fieldHtml(f) {
        if (!f) return '';
        if (f.type === 'search') {
            return '<input type="search" class="form-input edu-f-search" id="' + esc(f.id) + '"' +
                ' value="' + esc(f.value || '') + '" placeholder="' + esc(f.placeholder || '검색') + '"' +
                ' aria-label="' + esc(f.placeholder || '검색') + '" oninput="' + f.on + '">';
        }
        if (f.type === 'select') {
            return '<select class="form-select" id="' + esc(f.id) + '" aria-label="' + esc(f.label || '조회 조건') + '"' +
                ' onchange="' + f.on + '">' + optionsHtml(f.options, f.value) + '</select>';
        }
        if (f.type === 'check') {
            return '<label class="edu-short-ck"><input type="checkbox" id="' + esc(f.id) + '"' +
                (f.value ? ' checked' : '') + ' onchange="' + f.on + '"> ' + esc(f.label || '') + '</label>';
        }
        return '';
    }

    /* 적용 중인 조건 개수 — '전체'(빈 값)는 세지 않는다 */
    function activeCount(fields) {
        return (fields || []).filter(function (f) {
            if (!f) return false;
            if (f.type === 'check') return !!f.value;
            return f.value !== '' && f.value != null;
        }).length;
    }

    function bar(fields, opts) {
        opts = opts || {};
        var n = activeCount(fields);
        return '<div class="edu-toolbar edu-filterbar">' +
            '<div class="edu-filterbar-fields">' + (fields || []).map(fieldHtml).join('') + '</div>' +
            '<div class="edu-filterbar-tail">' +
                (opts.count != null ? '<span class="edu-count">' + opts.count + (opts.unit || '건') + '</span>' : '') +
                (opts.reset
                    ? '<button type="button" class="btn btn-outline btn-sm"' + (n ? '' : ' disabled') +
                      ' onclick="' + opts.reset + '">필터 초기화' + (n ? ' (' + n + ')' : '') + '</button>'
                    : '') +
                (opts.actions || '') +
            '</div>' +
        '</div>';
    }

    /* 재렌더 래퍼 — 검색어를 타이핑하는 도중 mount 를 통째로 다시 그려도
     * 포커스와 캐럿 위치가 유지되도록 복원한다. */
    function rerender(fn) {
        var a = document.activeElement;
        var id = a && a.id;
        var pos = null;
        try { pos = a && a.selectionStart; } catch (e) { pos = null; }
        fn();
        if (!id) return;
        var el = document.getElementById(id);
        if (!el) return;
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
        if (pos != null && el.setSelectionRange) {
            try { el.setSelectionRange(pos, pos); } catch (e) {}
        }
    }

    /* 데이터에 실제로 존재하는 연도만 옵션으로 (빈 연도 노출 방지) */
    function yearOptions(dates, allLabel) {
        var seen = {};
        (dates || []).forEach(function (d) { if (d && String(d).length >= 4) seen[String(d).slice(0, 4)] = true; });
        return [['', allLabel || '연도 전체']].concat(
            Object.keys(seen).sort().reverse().map(function (y) { return [y, y + '년']; })
        );
    }

    /* 1~12월 고정 옵션 */
    function monthOptions(allLabel) {
        var out = [['', allLabel || '월 전체']];
        for (var m = 1; m <= 12; m++) {
            var v = (m < 10 ? '0' : '') + m;
            out.push([v, m + '월']);
        }
        return out;
    }

    /* 검색 매칭 — 여러 필드를 합쳐 부분일치(대소문자 무시) */
    function match(q, parts) {
        q = String(q || '').trim().toLowerCase();
        if (!q) return true;
        return (parts || []).filter(Boolean).join(' ').toLowerCase().indexOf(q) !== -1;
    }

    global.EDUFILTER = {
        bar: bar, rerender: rerender,
        yearOptions: yearOptions, monthOptions: monthOptions,
        optionsHtml: optionsHtml, match: match,
    };
})(window);
