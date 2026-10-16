/* =========================================================================
 * DYXLSX — 엑셀(.xlsx) 첫 시트 읽기 (2026-10-15 신설)
 * -------------------------------------------------------------------------
 * 빌드·라이브러리 없는 프로토타입이라 엑셀을 읽을 수단이 없었다. 그래서 «엑셀 일괄
 * 등록»은 지금까지 파일을 받는 척만 하거나 예시 행을 넣었다. 처음으로 **실제 파일의
 * 값**을 써야 하는 자리(도급관리 — e호조 계약대장 반입)가 생겨 최소 읽기를 만든다.
 *
 * xlsx 는 zip 안의 XML 이다. 브라우저 내장 DecompressionStream('deflate-raw') 로
 * 압축을 풀고 DOMParser 로 첫 시트와 공유 문자열만 읽는다. 서식·수식·병합은 읽지
 * 않는다 — 값만 필요하다.
 *
 *   DYXLSX.read(file | ArrayBuffer) → Promise<{ sheet, rows }>
 *     rows : 문자열 2차원 배열(열 A=0). 빈 칸은 ''. 숫자는 엑셀이 저장한 문자열 그대로
 *            («4.41531E9») — 해석은 소비처가 한다(무엇이 금액·날짜인지는 소비처만 안다).
 *   DYXLSX.serialDate(v) → 엑셀 날짜 일련번호를 'YYYY-MM-DD' 로(아니면 '')
 *
 * 읽지 못하면 reject 하고 이유를 사람이 읽을 말로 준다 — 조용히 0건을 돌려주면
 * «파일에 계약이 없다»로 읽힌다.
 * ========================================================================= */
(function (global) {
    'use strict';

    function u16(d, o) { return d.getUint16(o, true); }
    function u32(d, o) { return d.getUint32(o, true); }

    /* zip 중앙 디렉터리 → { 파일명: {method, size, offset} } */
    function entries(buf) {
        const d = new DataView(buf);
        let eocd = -1;
        for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
            if (u32(d, i) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('엑셀(xlsx) 형식이 아닙니다 — 압축 구조를 찾지 못했습니다');
        const count = u16(d, eocd + 10);
        let p = u32(d, eocd + 16);
        const out = {};
        const dec = new TextDecoder('utf-8');
        for (let k = 0; k < count; k++) {
            if (u32(d, p) !== 0x02014b50) break;
            const method = u16(d, p + 10), csize = u32(d, p + 20);
            const nlen = u16(d, p + 28), xlen = u16(d, p + 30), clen = u16(d, p + 32);
            const local = u32(d, p + 42);
            const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
            out[name] = { method: method, size: csize, local: local };
            p += 46 + nlen + xlen + clen;
        }
        return out;
    }

    async function inflate(bytes) {
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('이 브라우저는 엑셀 압축 풀기를 지원하지 않습니다 — 최신 크롬·엣지·사파리에서 다시 올려 주세요');
        }
        const ds = new DecompressionStream('deflate-raw');
        const stream = new Blob([bytes]).stream().pipeThrough(ds);
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function readEntry(buf, ent) {
        const d = new DataView(buf);
        const p = ent.local;
        if (u32(d, p) !== 0x04034b50) throw new Error('엑셀 파일 일부가 손상됐습니다');
        const start = p + 30 + u16(d, p + 26) + u16(d, p + 28);
        const raw = new Uint8Array(buf, start, ent.size);
        const bytes = ent.method === 0 ? raw : ent.method === 8 ? await inflate(raw) : null;
        if (!bytes) throw new Error('지원하지 않는 압축 방식입니다');
        return new TextDecoder('utf-8').decode(bytes);
    }

    function xml(text) { return new DOMParser().parseFromString(text, 'application/xml'); }
    function all(doc, tag) { return Array.prototype.slice.call(doc.getElementsByTagNameNS('*', tag)); }
    function colIndex(ref) {
        const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1;
        let n = 0; for (let i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
        return n - 1;
    }

    async function read(src) {
        const buf = src instanceof ArrayBuffer ? src : await src.arrayBuffer();
        const ents = entries(buf);
        /* 첫 시트 경로는 workbook.xml 의 첫 <sheet> → rels 의 Target 으로 찾는다.
           sheet1.xml 로 박아 두면 시트를 지우고 다시 만든 파일에서 엉뚱한 시트를 읽는다. */
        let sheetPath = '', sheetName = '';
        if (ents['xl/workbook.xml'] && ents['xl/_rels/workbook.xml.rels']) {
            const wb = xml(await readEntry(buf, ents['xl/workbook.xml']));
            const first = all(wb, 'sheet')[0];
            if (first) {
                sheetName = first.getAttribute('name') || '';
                const rid = first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
                const rels = xml(await readEntry(buf, ents['xl/_rels/workbook.xml.rels']));
                const rel = all(rels, 'Relationship').find(r => r.getAttribute('Id') === rid);
                if (rel) {
                    const t = rel.getAttribute('Target') || '';
                    sheetPath = t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
                }
            }
        }
        if (!ents[sheetPath]) sheetPath = Object.keys(ents).filter(k => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort()[0] || '';
        if (!sheetPath) throw new Error('엑셀에서 시트를 찾지 못했습니다');

        const shared = [];
        if (ents['xl/sharedStrings.xml']) {
            const ss = xml(await readEntry(buf, ents['xl/sharedStrings.xml']));
            all(ss, 'si').forEach(si => shared.push(all(si, 't').map(t => t.textContent).join('')));
        }
        const sheet = xml(await readEntry(buf, ents[sheetPath]));
        const rows = [];
        all(sheet, 'row').forEach(r => {
            const line = [];
            all(r, 'c').forEach(c => {
                const i = colIndex(c.getAttribute('r'));
                if (i < 0) return;
                const t = c.getAttribute('t');
                const v = all(c, 'v')[0];
                let val = '';
                if (t === 's') val = v ? (shared[+v.textContent] || '') : '';
                else if (t === 'inlineStr') val = all(c, 't').map(x => x.textContent).join('');
                else val = v ? v.textContent : '';
                line[i] = val;
            });
            for (let i = 0; i < line.length; i++) if (line[i] == null) line[i] = '';
            rows.push(line);
        });
        return { sheet: sheetName, rows: rows };
    }

    /* 엑셀 날짜 일련번호(1900 체계) → 'YYYY-MM-DD'. 1900-02-29 버그 보정은 1900-03-01 이후만 맞다 —
       계약 자료에 그 이전 날짜는 없다. */
    function serialDate(v) {
        const n = Number(v);
        if (!isFinite(n) || n < 20000 || n > 80000) return '';
        const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
        return d.toISOString().slice(0, 10);
    }

    global.DYXLSX = { read: read, serialDate: serialDate };
})(window);
