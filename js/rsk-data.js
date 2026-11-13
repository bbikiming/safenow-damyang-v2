/* =====================================================================
   rsk-data.js · 위험성평가 도메인 데이터·세션 스토어 (DYRSK)
   ---------------------------------------------------------------------
   재설계 v1 (2026-07-14, docs/planning/기획-위험성평가-재설계-v1.md) 반영.
   · 정기평가(regular): 연도 단위, 부서별 점검일자·설문조사표·조치기한·상태.
   · 수시평가(occasional): 사유별 등록·검토 흐름.
   · 개선조치(improvement): 부서 단위 조치, 평가·부서와 링크.
   부서는 DYV2.ORG deptId 를 참조 (자체 조직 데이터 금지).
   레거시(rsk-proc·rsk-exec·rsk-imp-detail·rsk-kosha) 호환을 위해 processes·
   estimations·hazard_risk_factor·due_date·assessmentProcesses 등은 잔류.
   전역: DYRSK.*  (js/rsk-kosha.js · js/common.js 뒤에 로드)
   ===================================================================== */
(function (global) {
    'use strict';

    var K = function () { return global.DYRSK.KOSHA; };
    /* v1.1 §6.3 (2026-07-16): 스키마에 review·reportParseMock 추가 · improvements 초기 비움
     *   · r3 (검수 화면 정리): 행별 confirmed·due 필드 제거, 조치기한은 부서 단위 모달에서만.
     *   · r5 (§6.4 정정): "대상자 = 대상 부서" — 직원 단위 targets 필드/시드 되돌림.
     *   · r6 (라이브 시연 모드): 2026 시드 제거 → 미등록 상태에서 마법사로 직접 생성.
     *     reportParseMock 을 연도 키로 전환하여 신규 생성 ID(RA-2026-16 등)도 매치.
     *   · r7 (0건 부서 처리): deliverFromReview에서 지적사항 없는 부서는 DONE로 처리·이력 기록,
     *     refreshAssessmentStatus는 개선건 있는 부서 기준으로 완료 판정.
     * → 이전 세션 캐시와 충돌하지 않도록 스토리지 키 버전 갱신. */
    /* r8 — 근거 오기 정정(기준규칙 §310 → §319). 시드가 바뀌었으므로 캐시를 무효화한다.
     * r9 — 유해위험요인 스키마에 basis(DYLAW 조문 키) 추가 · 검수 행 → 개선조치까지 전파. */
    /* r11 — 개선조치 증빙 사진 객체(before_photos/after_photos) 승계.
     * r10 — 2026-07-30 회의 반영: 부서별 보고서(dept.reportFile) · 수시평가 실시 사유 6종(고시 §15② 1~5호 + ③, 2026-11-04 전부개정 기준) ·
     *       안전관리자 검토파일(occ.reviewFile) · 개선조치 완료일·전자서명 추가. 시드 변경 시 버전 범프. */
    /* r13 (2026-11-13) — 운영 기록형 예시 자료: 2024·2025 정기평가 8단계 완료 기록 · 수시 2025 4건/2026 10건 ·
     *       개선조치 34건(진행 7 · 기한 경과 2). 2026 정기평가는 등록하지 않는다. r12 — 시설물 3상태 연결. */
    var SKEY = 'damyangRskV2r16';   /* r15 (2026-11-13) — D-1·D-3·D-4·D-6: 종결·추가 요청·생성 뒤 고치기·근로자 공유 · 예시 데이터에 참여 근로자·근로자 공유 */

    /* ================= 스토어 ================= */
    var db = null;

    /* 이력·알림 문면에 붙일 근거 문구 — 근거가 없으면 아무것도 붙이지 않는다 */
    function basisMemo(basis) {
        try {
            if (!basis || !global.DYLAW) return '';
            var key = global.DYLAW.resolveBasis(basis);
            if (!key) return '';
            return ' · 근거 ' + global.DYLAW.shortRef(key) + ' ' + global.DYLAW.basisTitle(key, { short: true });
        } catch (e) { return ''; }
    }

    /* 부서(=DYV2.ORG deptId) 예시 자료 */
    function deptName(deptId) {
        try {
            var n = global.DYV2 && global.DYV2.orgNode ? global.DYV2.orgNode(deptId) : null;
            return n ? n.name : deptId;
        } catch (e) { return deptId; }
    }
    /* 정기평가·수시평가 대상 후보 부서 (dept/office/town 노드) */
    function deptCandidates() {
        var out = [];
        try {
            if (!global.DYV2 || !global.DYV2.orgWalk) return out;
            global.DYV2.orgWalk(function (n) {
                if (n.type === 'dept' || n.type === 'office' || n.type === 'town') {
                    out.push({ id: n.id, name: n.name });
                }
            });
        } catch (e) {}
        return out;
    }

    /* 예시 자료용 증빙 썸네일 (data-URI · 160x120 JPEG, 각 1~2KB).
     * 실제 파일 저장소가 없는 프로토타입에서 개선 전·후 '대조'를 보여주는 유일한 방법이다.
     * b* = 개선 전(주황 계열) · a* = 개선 후(녹색 계열). 전체 14KB. */
    var T = {
        a1: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmc0ZpuaM1geUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozTGOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozQUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmkzXVR6RaNdOhssojSC3+dh9rUQyMH6+qoeMD5sU7FKNzls0Zrq4tIsDBbyTWkqzScXMEYJ+zDsSS425HOWyKz4baze1s4jbDzZ7Gedpt7bgyGUrgZx/yzAPFOw+RmJmjNb1zDaW1tcXElqLh1FkFEkj4G+As3Qg8kfh+lWpdGtYZrqKO0M8MaXZacu2Ynj8zYvBx0VTyOd3pRYORnL5ozSZozSJFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAG5qSC4kt3LxNtYoyE4zwylSPyJqHNGaCh2aM03NGaBDs1Zj1C5jtzAjqI9pXOxdwB6gNjIB9Ae59aqZozQMdmjNNzRmgQ7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA3NGabmjNModmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAbmjNJmjNAxc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBc0ZpM0ZoAXNGaTNGaAFzRmkzRmgBuaM0UUxhmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFABmjNFFAH/9k=',
        a2: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmc0ZpuaM1geUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozTGOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozQUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmkzXW/YbaKP7PJaiOybVLZPOLsBPFiT5s57jnIx19qdi1G5yeaM10Fvoxi09HubJ2vCZykD7gZdvlADAIPAZ245OKg1WNY9HhC2awFLyVXIYsUOyMhSc49eDz8vrnJYOVmNmjNJmjNBIuaM0maM0ALmjNJmjNAC5ozSZozQAuaM0maM0ALmjNJmjNAC5ozSZozQAuaM0maM0ANzRmm5ozQMdmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAbmjNNzRmmUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmkzRmgYuaM0maM0ALmjNJmjNAC5ozSZozQAuaM0maM0ALmjNJmjNAC5ozSZozQAuaM0maM0ALmjNJmjNAC5ozSZozQA3NGaKKYwzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigD/2Q==',
        a3: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmc0ZpuaM1geUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozTGOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozQUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmkzXVw6NbysimwCJ9khmjlLv+/kKKzJ15zljgYPGMjNOxSjc5XNGa6G/tLLT1vZDZCQo9qESRnUJ5kTOwwGz1HcnHrU17pFhaxXirFNIIzOPNC8RsjsFUtuAHRTgqSd3Hs7D5GcxmjNX9dBF5CSDhrS2IPr+5QfzBrPzSE1YXNGaTNGaBC5ozSZozQAuaM0maM0ALmjNJmjNAC5ozSZozQAuaM0maM0ALmjNJmjNADc1JPcSXDh5W3MEVAcY4VQoH5AVDmjNBQ7NGabmjNAh2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAbmjNNzRmmUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmkzRmgYuaM0maM0ALmjNJmjNAC5ozSZozQAuaM0maM0ALmjNJmjNAC5ozSZozQAuaM0maM0ALmjNJmjNAC5ozSZozQA3NGaKKYwzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigD//2Q==',
        a4: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmc0ZpuaM1geUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozTGOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmm5ozQUOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0ANzRmkzXTvpeniBphEOE+2Bd5x5JXATr/AM9MLnrzTsUo3OZzRmutk0S1iaEGxZpD5qbV3srbfLw+AQzD525XHY4wDlz6bavb2+6y8x4UMapAGl3/AL6UMch1zjC8/wC30xjDsVyM5DNGalvVjjvJ0gz5SyMEyQTtzxyOD+FQ5pEC5ozSZozQAuaM0maM0ALmjNJmjNAC5ozSZozQAuaM0maM0ALmjNJmjNAC5ozSZozQA3NGabmjNAx2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgB2aM03NGaAHZozTc0ZoAdmjNNzRmgBuaM03NGaZQ7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA7NGabmjNADs0ZpuaM0AOzRmm5ozQA3NGaTNGaBi5ozSZozQAuaM0maM0ALmjNJmjNAC5ozSZozQAuaM0maM0ALmjNJmjNAC5ozSZozQAuaM0maM0ALmjNJmjNADc0ZoopjDNGaKKADNGaKKADNGaKKADNGaKKADNGaKKADNGaKKADNGaKKADNGaKKADNGaKKAP/9k=',
        b1: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDNzRmmZozXz9j6C4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYm4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYi4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmunj0q1a5dDZ5VWkFv87f6Uoidg3X1VOmB82K1jC5nKaic3mjNdNHpdiYIJJbWRZZP+PiFAT9nHYklxtyOfmyKoQ29o9taRm3HmzWU87S72yGQy7cDOP4ADxT9myfaIyM0ZrZuIrW3t553thO6izCh5HwN8JZuhB5I/CrUuk20MtzElqZoo0uiZyzZidN+1eDjoqnnrmj2bD2iOczRmmZozUWNLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLjM1JBcSQOXibaxVkJxnhgVI/ImoM0Zq7EXH5ozTM0ZosFx+aspqFxHbmBXATBX7i7gD1AbGQD6Z7mqeaM0APzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLjM0ZpmaM1dibj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLjM0ZpmaM1diLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLjM0ZooqiQzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigAzRmiigD//2Q==',
        b2: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDNzRmmZozXz9j6C4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYm4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYi4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmuq+x28SeRJbCOzbUrdPNLtiePEnzZz3HORjr7VrGNzOU+U5jNGa27fSDFYo9xZu12TMUgbcDJt8oAYBzwGc8cnFQ6mippMQW0WErdyq+GLFPkjO0nOPXjr8v1ycjSFzpsys0ZpmaM1Ni7j80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYi4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYm4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYi4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaKKokM0ZoooAM0ZoooAM0ZoooAM0ZoooAM0ZoooAM0ZoooAM0ZoooAM0ZoooAM0ZoooA/9k=',
        b3: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDNzRmmZozXz9j6C4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYm4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYi4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmuni0mCQopsdqfZYZY5C7/vnKKzL15zljgc8YyM1rGFzOU1Hc5vNGa3L61s7BbyQ2YkKPbBEkZ1Cb4mZhgNnqO54qW80qxtorsLHLIIzOPNA4jZWYKpbcAOinG0k7uPZ+zZPtEc9mjNXNayLuIkHBtbcg+v7pBVDNS1Z2LTurj80ZpmaM0rDuPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguMzUk9xJO4eVtzBVQHGOFAUD8gKgzRmrsRcfmjNMzRmiwXH5ozTM0ZosFx+aM0zNGaLBcfmjNMzRmiwXH5ozTM0ZosFx+aM0zNGaLBcfmjNMzRmiwXH5ozTM0ZosFx+aM0zNGaLBcZmjNMzRmrsTcfmjNMzRmiwXH5ozTM0ZosFx+aM0zNGaLBcfmjNMzRmiwXH5ozTM0ZosFx+aM0zNGaLBcfmjNMzRmiwXH5ozTM0ZosFx+aM0zNGaLBcZmjNMzRmrsRcfmjNMzRmiwXH5ozTM0ZosFx+aM0zNGaLBcfmjNMzRmiwXH5ozTM0ZosFx+aM0zNGaLBcfmjNMzRmiwXH5ozTM0ZosFx+aM0zNGaLBcZmjNFFUSGaM0UUAGaM0UUAGaM0UUAGaM0UUAGaM0UUAGaM0UUAGaM0UUAGaM0UUAGaM0UUAf/Z',
        b4: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDNzRmmZozXz9j6C4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYm4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmjNXYi4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4zNGaZmukfTrEQtKIuifawN5x5JXATr/fwM9ea1UbmblY57NGa6d9HtomiBsmZz5ibV3srbfLw2AQzD5m5XHY4wKc+n2z28G608x4kMapCGk3/vpAxyGXOMLz/t9MYxXsmR7VHLZozT7wRx3c6Q58pZGCZIJxnjkcVDms7Glx+aM0zNGaLDuPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguMzRmmZozV2IuPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguMzRmmZozV2JuPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguMzRmmZozV2IuPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguPzRmmZozRYLj80ZpmaM0WC4/NGaZmjNFguMzRmiiqJDNGaKKADNGaKKADNGaKKADNGaKKADNGaKKADNGaKKADNGaKKADNGaKKADNGaKKAP//Z'
    };

    function seed() {
        return {
            /* --- 레거시(작업공정·4×4 화면) --- */
            seqProc: 2, seqHrf: 20,
            processes: [
                {
                    id: 'PRC-001', targetId: 'f_jns', name: '약품 투입', desc: '염소·응집제 투입 · 약품탱크 취급',
                    evaluator: '물순환사업소 · 시설 담당 / 서담당', source: 'STD', revision_no: 1, seq: 1,
                    equip: ['cl2_bombe', 'pac_pump', 'chem_tank'], hf: ['cl2', 'pac', 'conf'],
                    hrf: [
                        { id: 'h1', name: '유해물질 누출에 의한 중독·질식', category: '화학적', basis: '산업안전보건기준규칙 §420 관리대상 유해물질', source: 'STD', legal_status: 'MAPPED' },
                        { id: 'h2', name: '밀폐공간 진입 중 산소결핍·질식', category: '작업특성', basis: '산업안전보건기준규칙 §619 밀폐공간 작업허가', source: 'STD', legal_status: 'MAPPED' }
                    ]
                },
                {
                    id: 'PRC-002', targetId: 'f_jns', name: '설비 정비', desc: '펌프·배관·밸브 정비 · 밀폐공간 진입',
                    evaluator: '물순환사업소 · 물순환사업소장 / 오순환', source: 'STD', revision_no: 1, seq: 2,
                    equip: ['pump_motor', 'valve_pit'], hf: ['elec', 'rot', 'conf'],
                    hrf: [
                        { id: 'h3', name: '활선 근접작업 감전', category: '전기', basis: '산업안전보건기준규칙 §319 정전작업', source: 'STD', legal_status: 'MAPPED' },
                        { id: 'h4', name: '회전체 접촉 끼임', category: '기계적', basis: '산업안전보건기준규칙 §87 원동기·회전축 방호', source: 'STD', legal_status: 'MAPPED' }
                    ]
                }
            ],
            estimations: {
                'RA-2026-01|PRC-001': { done: true, method: '4x4', rows: [
                    { hrfId: 'h1', name: '유해물질 누출에 의한 중독·질식', freq: 2, severity: 3 },
                    { hrfId: 'h2', name: '밀폐공간 진입 중 산소결핍·질식', freq: 2, severity: 2 }
                ] }
            },

            /* --- 재설계 v1 스키마 --- */
            seqAsmt: 5, seqImp: 210, seqOcc: 0,

            /* 정기 위험성평가: 연도별 1건 원칙 — 2024·2025 는 8단계를 모두 마친 기록이다
             * (설문 요청 공문 → 부서 제출 → 용역 보고서·기한 → 조치 요청 공문 → 부서 입력 완료 → 조치·확인 → 결과 공문 결재완료).
             * 2026 은 **등록하지 않는다** — 재난안전과 담당자가 [＋ 정기평가 생성]으로 직접 시작한다. */
            assessments: [
                {
                    id: "RA-2025-01",
                    year: 2025,
                    type: "REGULAR",
                    status: "COMPLETED",
                    title: "2025년 정기 위험성평가",
                    createdAt: "2025-03-27",
                    surveyDue: "2025-04-25",
                    targetId: "",
                    scope: "ALL",
                    method: "4x4",
                    team: [],
                    worker_participation: false,
                    change_reason: "",
                    changed_processes: [],
                    completed_at: "2025-09-29",
                    approval: "승인",
                    files: { surveyAll: "2025_유해위험요인_설문조사표.hwpx", report: "2025_정기 위험성평가_용역 통합 보고서.pdf" },
                    review: { stage: "DELIVERED", extractedAt: "2025-05-15 15:30", parsedDepts: {} },
                    surveyReq: {
                        at: "2025-04-01",
                        by: "재난안전과 박안전",
                        docs: [
                            { sid: "재난안전과-2025-118-0", no: "재난안전과-2025-118", at: "2025-04-01", status: "결재완료", docType: "외부발송", title: "2025년 정기 위험성평가 유해위험요인 설문조사표 제출 요청", to: "수신자 참조", body: "1. 2025년 정기 위험성평가를 위하여 유해위험요인 설문조사표를 붙임과 같이 보내오니, 부서별로 작성하여 기한 내 제출하여 주시기 바랍니다.\n  가. 대상: 붙임 별지의 5개 부서\n  나. 제출 기한: 2025-04-25\n  다. 제출 방법: 중대재해 통합관리시스템 › 내 할일 › 위험성평가 [설문조사표 제출]에서 양식을 내려받아 작성한 뒤 제출", attach: [{ label: "2025_유해위험요인_설문조사표.hwpx", meta: "설문조사표 양식", on: true }], annex: true, basis: ["osh-36"], line: [], lineText: "", by: "박안전", byUid: "u_jjt2", dept: "재난안전과", deptIds: ["safety", "env", "water", "facility", "construct"], sample: true }
                        ]
                    },
                    actionReq: {
                        at: "2025-05-20",
                        by: "재난안전과 박안전",
                        depts: ["safety", "env", "water", "facility"],
                        docs: [
                            { sid: "재난안전과-2025-176-0", no: "재난안전과-2025-176", at: "2025-05-20", status: "결재완료", docType: "외부발송", title: "2025년 정기 위험성평가 결과 개선조치 이행 요청", to: "수신자 참조", body: "1. 2025년 정기 위험성평가 용역 결과 개선이 필요한 유해위험요인이 확인되어, 붙임 보고서를 확인하시고 부서별 개선조치를 이행하여 주시기 바랍니다.\n  가. 대상: 붙임 별지의 4개 부서(부서별 조치기한은 별지 참고)\n  나. 입력: 중대재해 통합관리시스템 › 위험성평가 › 정기 위험성평가에서 보고서를 내려받아 우리 부서 유해위험요인과 조치 내용을 직접 입력\n  다. 완료: 조치를 마친 뒤 개선 후 사진을 올려 완료 처리 — 기한 안에 마치지 못하면 사유를 적어 기한 연장", attach: [{ label: "2025_정기 위험성평가_용역 통합 보고서.pdf", meta: "용역 통합 보고서", on: true }], annex: true, basis: ["osh-36"], line: [], lineText: "", by: "박안전", byUid: "u_jjt2", dept: "재난안전과", deptIds: ["safety", "env", "water", "facility"], sample: true }
                        ]
                    },
                    depts: [
                        { deptId: "safety", inspectDate: "2025-04-14", surveyFile: "", reportFile: "재난안전과_2025_설문조사표_작성본.hwpx", reportAt: "2025-04-11", reportBy: "재난안전과 · 박안전", status: "DONE", deliveredAt: "2025-05-20", dueDate: "2025-07-31", hazards: [{ name: "옥상 점검통로 안전난간 미설치", category: "물리적", cause: "난간 미설치 구간 30m", basis: "oshs-43", action: "점검통로 전 구간 안전난간(H=1.2m) 설치 및 추락주의 표지 부착", facilNo: "AR1968-0000226", facilNm: "담양군청(본관동)", facilNa: false }, { name: "비상발전기실 소화기 미비치", category: "화학적", cause: "소화기 노후·수량 부족", basis: "", action: "ABC분말소화기 4대 교체 비치 및 점검표 부착", facilNo: "AR1968-0000226", facilNm: "담양군청(본관동)", facilNa: false }], request: { at: "2025-05-20", by: "재난안전과 박안전", no: "재난안전과-2025-176" }, noFindings: false, inputDone: { at: "2025-05-22", by: "박안전", reason: "", count: 2, workers: [{ uid: "u_jjt2", name: "박안전", role: "안전관리 주무관" }, { uid: "u_jjt3", name: "김안전", role: "안전관리자" }], workersNote: "" } },
                        { deptId: "env", inspectDate: "2025-04-16", surveyFile: "", reportFile: "환경과_2025_설문조사표_작성본.hwpx", reportAt: "2025-04-15", reportBy: "환경과 · 정환경", status: "DONE", deliveredAt: "2025-05-20", dueDate: "2025-08-14", hazards: [{ name: "폐기물 적치장 붕괴 위험", category: "물리적", cause: "적치 높이 기준 초과", basis: "", action: "적치 높이 제한선 도색 및 방호벽 설치, 주 1회 점검 지정", facilNo: "", facilNm: "", facilNa: false }, { name: "자원순환팀 파쇄기 방호덮개 파손", category: "기계적", cause: "덮개 균열·고정볼트 이완", basis: "oshs-87", action: "방호덮개 교체 및 비상정지 스위치 동작 점검", facilNo: "", facilNm: "", facilNa: true }], request: { at: "2025-05-20", by: "재난안전과 박안전", no: "재난안전과-2025-176" }, noFindings: false, inputDone: { at: "2025-05-23", by: "정환경", reason: "", count: 2, workers: [{ uid: "u_env2", name: "정환경", role: "유해·위험요인 담당 주무관" }, { uid: "u_env4", name: "김지도", role: "주무관" }, { uid: "u_env5", name: "정수빈", role: "주무관" }], workersNote: "" } },
                        { deptId: "water", inspectDate: "2025-04-21", surveyFile: "", reportFile: "물순환사업소_2025_설문조사표_작성본.hwpx", reportAt: "2025-04-18", reportBy: "물순환사업소 · 하정수", status: "DONE", deliveredAt: "2025-05-20", dueDate: "2025-09-30", hazards: [{ name: "정수장 약품투입실 환기 불량", category: "화학적", cause: "국소배기장치 용량 부족", basis: "oshs-607", action: "국소배기장치 2대 증설 및 MSDS 게시, 보호구 비치", facilNo: "WS1996-0000011", facilNm: "신계정수장", facilNa: false }, { name: "침전지 개구부 추락 위험", category: "물리적", cause: "개구부 덮개·난간 미설치", basis: "oshs-43", action: "개구부 안전덮개 6개소 설치 및 추락주의 표지 부착", facilNo: "WS1996-0000011", facilNm: "신계정수장", facilNa: false }, { name: "전기 분전반 시건장치 미설치", category: "전기적", cause: "분전반 개방 상태 방치", basis: "", action: "분전반 6면 시건장치 설치 및 활선 경고표지 부착", facilNo: "ST1999-0000017", facilNm: "담양하수종말처리장", facilNa: false }, { name: "슬러지 이송 컨베이어 비상정지 미작동", category: "기계적", cause: "비상정지 스위치 접점 불량", basis: "", action: "비상정지 스위치 전량 교체 및 월 1회 작동 점검 지정", facilNo: "", facilNm: "", facilNa: false }], request: { at: "2025-05-20", by: "재난안전과 박안전", no: "재난안전과-2025-176" }, noFindings: false, inputDone: { at: "2025-05-26", by: "하정수", reason: "", count: 4, workers: [{ uid: "u_wat3", name: "하정수", role: "주무관" }, { uid: "u_wat6", name: "서한별", role: "주무관" }, { uid: "u_wat4", name: "오수질", role: "주무관" }], workersNote: "" } },
                        { deptId: "facility", inspectDate: "2025-04-23", surveyFile: "", reportFile: "공공시설사업소_2025_설문조사표_작성본.hwpx", reportAt: "2025-04-22", reportBy: "공공시설사업소 · 한담당", status: "DONE", deliveredAt: "2025-05-20", dueDate: "2025-08-29", hazards: [{ name: "체육관 천장 조명 교체 작업 중 추락", category: "고소작업", cause: "이동식 비계 안전난간 미설치", basis: "", action: "이동식 비계 안전난간·아웃트리거 설치 후 작업, 2인 1조 작업 지정", facilNo: "AR2008-0003610", facilNm: "담양종합체육관", facilNa: false }, { name: "환경시설팀 펌프실 회전체 노출", category: "기계적", cause: "커플링 방호덮개 탈락", basis: "oshs-87", action: "펌프 커플링 방호덮개 재설치 및 점검표에 덮개 상태 항목 추가", facilNo: "", facilNm: "", facilNa: true }], request: { at: "2025-05-20", by: "재난안전과 박안전", no: "재난안전과-2025-176" }, noFindings: false, inputDone: { at: "2025-05-27", by: "한담당", reason: "", count: 2, workers: [{ uid: "u_fac2", name: "한담당", role: "시설안전 담당" }, { uid: "u_fac3", name: "한운영", role: "주무관" }, { uid: "u_fac4", name: "민설비", role: "주무관" }], workersNote: "" } },
                        { deptId: "construct", inspectDate: "2025-04-24", surveyFile: "", reportFile: "건설과_2025_설문조사표_작성본.hwpx", reportAt: "2025-04-24", reportBy: "건설과 · 박현장", status: "DONE", deliveredAt: "2025-05-20", dueDate: "", hazards: [], request: null, noFindings: true, inputDone: null }
                    ],
                    history: [
                        { type: "CREATE", at: "2025-03-27 09:30", by: "박안전", memo: "정기평가 생성 · 5개 부서 선정 · 설문 제출 기한 2025-04-25" },
                        { type: "FILE", at: "2025-03-27 14:00", by: "박안전", memo: "설문조사표 양식 첨부 (공통) · 2025_유해위험요인_설문조사표.hwpx" },
                        { type: "NOTIFY", at: "2025-04-01 10:00", by: "박안전", memo: "5개 부서에 설문조사표 요청 공문 발송 (제출 기한 2025-04-25) · 연계 번호 재난안전과-2025-118" },
                        { type: "STATUS", at: "2025-05-15 15:30", by: "박안전", memo: "보고서 첨부 · 조치기한 설정 (부서별)" },
                        { type: "REVIEW", at: "2025-05-20 10:00", by: "재난안전과 박안전", memo: "건설과 — 지적사항 없음(조치 요청 대상 아님)" },
                        { type: "DELIVER", at: "2025-05-20 10:05", by: "재난안전과 박안전", memo: "4개 부서에 조치 요청 공문 발송 · 지적사항 없는 1개 부서 완료 · 연계 번호 재난안전과-2025-176" },
                        { type: "STATUS", at: "2025-05-22 14:20", by: "박안전", memo: "재난안전과 조치 입력 완료 · 2건 · 참여 근로자 2명" },
                        { type: "STATUS", at: "2025-05-23 10:30", by: "정환경", memo: "환경과 조치 입력 완료 · 2건 · 참여 근로자 3명" },
                        { type: "STATUS", at: "2025-05-26 16:00", by: "하정수", memo: "물순환사업소 조치 입력 완료 · 4건 · 참여 근로자 3명" },
                        { type: "STATUS", at: "2025-05-27 11:15", by: "한담당", memo: "공공시설사업소 조치 입력 완료 · 2건 · 참여 근로자 3명" },
                        { type: "COMPLETE", at: "2025-09-29 15:30", by: "시스템", memo: "전 부서 조치 완료 — 완료 확인을 마치면 평가 완료" },
                        { type: "CONFIRM", at: "2025-10-02 10:30", by: "박안전", memo: "전 부서 조치 완료 확인 (10건)" },
                        { type: "DISPATCH", at: "2025-11-10 14:20", by: "박안전", memo: "공문 온나라 상신 — 2025년 정기 위험성평가 개선조치 완료 확인 결과 통보 (연계 번호 재난안전과-2025-412)" },
                        { type: "RECEIVE", at: "2025-11-18 10:05", by: "온나라", memo: "결재 회신 — 결재완료 (생산등록번호 재난안전과-4127 · 결재일 2025-11-18)" },
                        { type: "SHARE", at: "2025-11-24 16:10", by: "재난안전과 박안전", memo: "근로자 공유 · 2025-11-24 · 사업장 게시 · 증빙 2025_정기위험성평가_결과공유_게시사진.pdf" }
                    ],
                    /* 근로자 공유(시행규칙 §37의3 2호, 2026-11-13 결정 D-6) — 예시 자료 */
                    workerShare: { at: "2025-11-24", method: "사업장 게시", memo: "청사·사업소 게시판에 결과 요약(유해·위험요인 · 위험성 수준 · 개선대책과 이행 결과) 게시", file: "2025_정기위험성평가_결과공유_게시사진.pdf", by: "재난안전과 박안전", recordedAt: "2025-11-24 16:10" }
                },
                {
                    id: "RA-2024-01",
                    year: 2024,
                    type: "REGULAR",
                    status: "COMPLETED",
                    title: "2024년 정기 위험성평가",
                    createdAt: "2024-03-20",
                    surveyDue: "2024-04-19",
                    targetId: "",
                    scope: "ALL",
                    method: "4x4",
                    team: [],
                    worker_participation: false,
                    change_reason: "",
                    changed_processes: [],
                    completed_at: "2024-08-20",
                    approval: "승인",
                    files: { surveyAll: "2024_유해위험요인_설문조사표.hwpx", report: "2024_정기 위험성평가_용역 통합 보고서.pdf" },
                    review: { stage: "DELIVERED", extractedAt: "2024-05-13 15:30", parsedDepts: {} },
                    surveyReq: {
                        at: "2024-03-25",
                        by: "재난안전과 박안전",
                        docs: [
                            { sid: "재난안전과-2024-097-0", no: "재난안전과-2024-097", at: "2024-03-25", status: "결재완료", docType: "외부발송", title: "2024년 정기 위험성평가 유해위험요인 설문조사표 제출 요청", to: "수신자 참조", body: "1. 2024년 정기 위험성평가를 위하여 유해위험요인 설문조사표를 붙임과 같이 보내오니, 부서별로 작성하여 기한 내 제출하여 주시기 바랍니다.\n  가. 대상: 붙임 별지의 4개 부서\n  나. 제출 기한: 2024-04-19\n  다. 제출 방법: 중대재해 통합관리시스템 › 내 할일 › 위험성평가 [설문조사표 제출]에서 양식을 내려받아 작성한 뒤 제출", attach: [{ label: "2024_유해위험요인_설문조사표.hwpx", meta: "설문조사표 양식", on: true }], annex: true, basis: ["osh-36"], line: [], lineText: "", by: "박안전", byUid: "u_jjt2", dept: "재난안전과", deptIds: ["env", "water", "safety", "construct"], sample: true }
                        ]
                    },
                    actionReq: {
                        at: "2024-05-17",
                        by: "재난안전과 박안전",
                        depts: ["env", "water", "construct"],
                        docs: [
                            { sid: "재난안전과-2024-163-0", no: "재난안전과-2024-163", at: "2024-05-17", status: "결재완료", docType: "외부발송", title: "2024년 정기 위험성평가 결과 개선조치 이행 요청", to: "수신자 참조", body: "1. 2024년 정기 위험성평가 용역 결과 개선이 필요한 유해위험요인이 확인되어, 붙임 보고서를 확인하시고 부서별 개선조치를 이행하여 주시기 바랍니다.\n  가. 대상: 붙임 별지의 3개 부서(부서별 조치기한은 별지 참고)\n  나. 입력: 중대재해 통합관리시스템 › 위험성평가 › 정기 위험성평가에서 보고서를 내려받아 우리 부서 유해위험요인과 조치 내용을 직접 입력\n  다. 완료: 조치를 마친 뒤 개선 후 사진을 올려 완료 처리 — 기한 안에 마치지 못하면 사유를 적어 기한 연장", attach: [{ label: "2024_정기 위험성평가_용역 통합 보고서.pdf", meta: "용역 통합 보고서", on: true }], annex: true, basis: ["osh-36"], line: [], lineText: "", by: "박안전", byUid: "u_jjt2", dept: "재난안전과", deptIds: ["env", "water", "construct"], sample: true }
                        ]
                    },
                    depts: [
                        { deptId: "env", inspectDate: "2024-04-08", surveyFile: "", reportFile: "환경과_2024_설문조사표_작성본.hwpx", reportAt: "2024-04-05", reportBy: "환경과 · 정환경", status: "DONE", deliveredAt: "2024-05-17", dueDate: "2024-07-31", hazards: [{ name: "재활용선별장 컨베이어 하부 청소 중 끼임", category: "기계적", cause: "하부 방호울 미설치", basis: "oshs-87", action: "컨베이어 하부 방호울 설치 및 청소 시 전원 차단·표지 부착 절차 게시", facilNo: "", facilNm: "", facilNa: true }, { name: "수집차량 적재함 승하차 시 추락", category: "물리적", cause: "발판·손잡이 미설치", basis: "", action: "수집차량 6대 적재함 발판·손잡이 설치", facilNo: "", facilNm: "", facilNa: false }], request: { at: "2024-05-17", by: "재난안전과 박안전", no: "재난안전과-2024-163" }, noFindings: false, inputDone: { at: "2024-05-21", by: "정환경", reason: "", count: 2, workers: [{ uid: "u_env2", name: "정환경", role: "유해·위험요인 담당 주무관" }, { uid: "u_env4", name: "김지도", role: "주무관" }, { uid: "u_env5", name: "정수빈", role: "주무관" }], workersNote: "" } },
                        { deptId: "water", inspectDate: "2024-04-10", surveyFile: "", reportFile: "물순환사업소_2024_설문조사표_작성본.hwpx", reportAt: "2024-04-09", reportBy: "물순환사업소 · 하정수", status: "DONE", deliveredAt: "2024-05-17", dueDate: "2024-08-30", hazards: [{ name: "여과지 점검 개구부 추락", category: "물리적", cause: "개구부 덮개 미고정", basis: "oshs-43", action: "여과지 점검 개구부 4개소 잠금형 덮개 교체 및 추락주의 표지 부착", facilNo: "WS1996-0000011", facilNm: "신계정수장", facilNa: false }, { name: "수질분석실 시약 증기 흡입", category: "화학적", cause: "시약장 배기 미흡", basis: "oshs-607", action: "시약장 국소배기장치 설치 및 MSDS 비치·교육", facilNo: "ST1999-0000017", facilNm: "담양하수종말처리장", facilNa: false }], request: { at: "2024-05-17", by: "재난안전과 박안전", no: "재난안전과-2024-163" }, noFindings: false, inputDone: { at: "2024-05-22", by: "하정수", reason: "", count: 2, workers: [{ uid: "u_wat3", name: "하정수", role: "주무관" }, { uid: "u_wat6", name: "서한별", role: "주무관" }, { uid: "u_wat4", name: "오수질", role: "주무관" }], workersNote: "" } },
                        { deptId: "safety", inspectDate: "2024-04-15", surveyFile: "", reportFile: "재난안전과_2024_설문조사표_작성본.hwpx", reportAt: "2024-04-12", reportBy: "재난안전과 · 박안전", status: "DONE", deliveredAt: "2024-05-17", dueDate: "", hazards: [], request: null, noFindings: true, inputDone: null },
                        { deptId: "construct", inspectDate: "2024-04-18", surveyFile: "", reportFile: "건설과_2024_설문조사표_작성본.hwpx", reportAt: "2024-04-17", reportBy: "건설과 · 박현장", status: "DONE", deliveredAt: "2024-05-17", dueDate: "2024-07-31", hazards: [{ name: "도로 보수 현장 차량 충돌", category: "작업특성", cause: "신호수 미배치", basis: "", action: "도로 보수 작업 시 신호수 배치 및 교통통제 계획서 작성 의무화", facilNo: "", facilNm: "", facilNa: false }, { name: "예초 작업 중 비산물 상해", category: "기계적", cause: "보호구 착용 미흡", basis: "oshs-32", action: "예초 작업자 보안면·각반 지급 및 착용 점검", facilNo: "", facilNm: "", facilNa: false }], request: { at: "2024-05-17", by: "재난안전과 박안전", no: "재난안전과-2024-163" }, noFindings: false, inputDone: { at: "2024-05-24", by: "박현장", reason: "", count: 2, workers: [{ uid: "u_con2", name: "박현장", role: "현장안전 담당 주무관" }, { uid: "u_con3", name: "김도현", role: "주무관" }, { uid: "u_con5", name: "이준호", role: "주무관" }], workersNote: "" } }
                    ],
                    history: [
                        { type: "CREATE", at: "2024-03-20 09:30", by: "박안전", memo: "정기평가 생성 · 4개 부서 선정 · 설문 제출 기한 2024-04-19" },
                        { type: "FILE", at: "2024-03-20 14:00", by: "박안전", memo: "설문조사표 양식 첨부 (공통) · 2024_유해위험요인_설문조사표.hwpx" },
                        { type: "NOTIFY", at: "2024-03-25 10:00", by: "박안전", memo: "4개 부서에 설문조사표 요청 공문 발송 (제출 기한 2024-04-19) · 연계 번호 재난안전과-2024-097" },
                        { type: "STATUS", at: "2024-05-13 15:30", by: "박안전", memo: "보고서 첨부 · 조치기한 설정 (부서별)" },
                        { type: "REVIEW", at: "2024-05-17 10:00", by: "재난안전과 박안전", memo: "재난안전과 — 지적사항 없음(조치 요청 대상 아님)" },
                        { type: "DELIVER", at: "2024-05-17 10:05", by: "재난안전과 박안전", memo: "3개 부서에 조치 요청 공문 발송 · 지적사항 없는 1개 부서 완료 · 연계 번호 재난안전과-2024-163" },
                        { type: "STATUS", at: "2024-05-21 15:10", by: "정환경", memo: "환경과 조치 입력 완료 · 2건 · 참여 근로자 3명" },
                        { type: "STATUS", at: "2024-05-22 11:40", by: "하정수", memo: "물순환사업소 조치 입력 완료 · 2건 · 참여 근로자 3명" },
                        { type: "STATUS", at: "2024-05-24 10:05", by: "박현장", memo: "건설과 조치 입력 완료 · 2건 · 참여 근로자 3명" },
                        { type: "COMPLETE", at: "2024-08-20 17:20", by: "시스템", memo: "전 부서 조치 완료 — 완료 확인을 마치면 평가 완료" },
                        { type: "CONFIRM", at: "2024-08-27 10:30", by: "박안전", memo: "전 부서 조치 완료 확인 (6건)" },
                        { type: "DISPATCH", at: "2024-10-14 15:00", by: "박안전", memo: "공문 온나라 상신 — 2024년 정기 위험성평가 개선조치 완료 확인 결과 통보 (연계 번호 재난안전과-2024-371)" },
                        { type: "RECEIVE", at: "2024-10-21 11:20", by: "온나라", memo: "결재 회신 — 결재완료 (생산등록번호 재난안전과-3561 · 결재일 2024-10-21)" },
                        { type: "SHARE", at: "2024-10-28 15:00", by: "재난안전과 박안전", memo: "근로자 공유 · 2024-10-25 · 안전보건교육 · 증빙 2024_정기위험성평가_결과공유_교육일지.pdf" }
                    ],
                    workerShare: { at: "2024-10-25", method: "안전보건교육", memo: "하반기 정기교육 시간에 부서별 결과와 개선 이행 결과 안내", file: "2024_정기위험성평가_결과공유_교육일지.pdf", by: "재난안전과 박안전", recordedAt: "2024-10-28 15:00" }
                }
            ],

            /* 보고서(hwpx) 파싱 목업 — 부서별 유해위험요인·개선조치사항 추출 결과.
             * 실제로는 hwpx 파서가 반환할 결과. 검수 화면(rsk-list)의 데모 소스.
             * 키: year → { deptId → [{name, category, cause, action}] }
             *   ─ 2026 assessment는 시연 중 마법사로 생성되므로 ID가 유동적이라 연도 키로 조회. */
            reportParseMock: {
                2026: {
                    /* basis = DYLAW 조문 키(js/law-map.js). 조문이 명확히 특정되는 항목에만 넣고,
                     * 특정되지 않으면 빈 값으로 두어 검수 화면에서 '법령 매핑 대기'로 남긴다.
                     * (근거를 짐작으로 채우면 시스템이 틀린 법조문을 주장하게 된다.) */
                    safety: [
                        { name: '중대재해팀 사무실 소화설비 미점검',    category: '기타',       cause: '점검 주기 미준수',        action: '월 1회 소화기 압력·유효기한 점검 체계 수립', basis: '' },
                        { name: '옥상 옥외기 점검 시 추락 위험',        category: '고소작업',   cause: '안전난간·안전대 미비',    action: '옥상 안전난간 보강 및 작업 시 안전대 부착 의무화', basis: 'oshs-43' }
                    ],
                    env: [
                        { name: '폐기물 상하차 시 지게차 협착 위험',    category: '기계적',     cause: '유도자 부재',              action: '유도자 배치·후진 경보기 설치', basis: 'oshs-171' },
                        { name: '수집 차량 도로 진출입 접촉사고',       category: '작업특성',   cause: '시야 확보 불량',           action: '반사경 설치 및 진출입 통제 인원 배치', basis: 'oshs-172' },
                        { name: '자원순환팀 신규 압축기 협착',          category: '기계적',     cause: '안전문 인터록 미설치',    action: '압축기 안전문 인터록 설치 및 작업표준서 재정비', basis: 'oshs-87' }
                    ],
                    water: [
                        { name: '약품 투입실 염소 누출 위험',           category: '화학적',     cause: '누출감지기 노후화',        action: '누출감지기 교체 · 비상세안설비 점검 주기 단축', basis: 'oshs-420' },
                        { name: '밀폐공간(밸브실) 산소결핍',            category: '작업특성',   cause: '환기 미확보',              action: '작업허가제 도입 및 산소농도계 상시 비치', basis: 'oshs-619' },
                        { name: '정수팀 약품 이송 배관 파손 위험',      category: '화학적',     cause: '배관 부식 상태 미점검',    action: '배관 두께 측정 정기 점검(연 2회) 실시', basis: '' }
                    ],
                    facility: [
                        { name: '환경시설팀 지붕 방수공사 시 추락',     category: '고소작업',   cause: '작업발판 부실',            action: '표준 작업발판 설치 후 작업 · 안전대 필수 착용', basis: 'oshs-43' },
                        { name: '시설운영팀 전동공구 감전',             category: '전기',       cause: '누전차단기 미설치',        action: '작업구역 이동식 누전차단기 배치', basis: '' }
                    ],
                    construct: [
                        { name: '도로관리팀 절단기 작업 시 절창',       category: '기계적',     cause: '보호구 착용 미흡',         action: '방호장갑 · 보안면 지급 및 착용 점검', basis: 'oshs-32' },
                        { name: '시설관리팀 도로 야간작업 교통사고',    category: '작업특성',   cause: '반사조끼·경광등 미비',    action: '야간작업 반사조끼·경광등 지급 · 신호수 배치', basis: '' }
                    ]
                }
            },

            /* 개선조치 — 2024·2025 정기평가분은 전 건 완료·확인. 수시평가분은 2025~2026 에 걸쳐 있고
             * 최근 건(2026-08 이후)이 진행 중이다 — 기한 경과 2건(IMP-224·IMP-226)·담당자 미지정 1건(IMP-232).
             * 증빙 썸네일은 코드 안 data-URI(160×120, 각 1~2KB)다. */
            improvements: [
                {
                    id: "IMP-101",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2024-01",
                    dept_id: "env",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "재활용선별장 컨베이어 하부 청소 중 끼임", category: "기계적", cause: "하부 방호울 미설치", basis: "oshs-87", facilNa: true },
                    hazard_risk_factor: "재활용선별장 컨베이어 하부 청소 중 끼임",
                    description: "컨베이어 하부 방호울 설치 및 청소 시 전원 차단·표지 부착 절차 게시",
                    action: "컨베이어 하부 방호울 설치 및 청소 시 전원 차단·표지 부착 절차 게시",
                    assigned_to: "환경과 · 주무관 / 정수빈",
                    due: "2024-07-31",
                    due_date: "2024-07-31",
                    before_photo: "선별장컨베이어_개선전.jpg",
                    after_photo: "선별장컨베이어_개선후.jpg",
                    before_photos: [
                        { name: "선별장컨베이어_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b2 }
                    ],
                    after_photos: [
                        { name: "선별장컨베이어_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a2 }
                    ],
                    action_content: "컨베이어 하부 방호울 설치 및 전원 차단·표지 부착 절차 게시 완료",
                    completed_date: "2024-07-12",
                    signature: { by: "정수빈", at: "2024-07-12" },
                    status: "DONE",
                    reassessed: true,
                    created: "2024-05-21",
                    confirm: { state: "OK", by: "박안전", at: "2024-07-19", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2024-05-21 15:10", by: "정환경", memo: "부서 작성 · 입력 완료 (기한 2024-07-31)" },
                        { type: "STATUS", at: "2024-07-12 16:30", by: "정수빈", memo: "완료 처리 · 완료일 2024-07-12 · 개선 후 사진 선별장컨베이어_개선후.jpg · 전자서명 정수빈" },
                        { type: "CONFIRM", at: "2024-07-19 10:20", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-102",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2024-01",
                    dept_id: "env",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "수집차량 적재함 승하차 시 추락", category: "물리적", cause: "발판·손잡이 미설치", basis: "" },
                    hazard_risk_factor: "수집차량 적재함 승하차 시 추락",
                    description: "수집차량 6대 적재함 발판·손잡이 설치",
                    action: "수집차량 6대 적재함 발판·손잡이 설치",
                    assigned_to: "환경과 · 주무관 / 김지도",
                    due: "2024-07-31",
                    due_date: "2024-07-31",
                    before_photo: false,
                    after_photo: "수집차량_개선후.jpg",
                    before_photos: [],
                    after_photos: [
                        { name: "수집차량_개선후.jpg", size: 152000, type: "image/jpeg" }
                    ],
                    action_content: "수집차량 6대 적재함 발판·손잡이 설치 완료",
                    completed_date: "2024-07-25",
                    signature: { by: "김지도", at: "2024-07-25" },
                    status: "DONE",
                    reassessed: true,
                    created: "2024-05-21",
                    confirm: { state: "OK", by: "박안전", at: "2024-08-01", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2024-05-21 15:10", by: "정환경", memo: "부서 작성 · 입력 완료 (기한 2024-07-31)" },
                        { type: "STATUS", at: "2024-07-25 14:00", by: "김지도", memo: "완료 처리 · 완료일 2024-07-25 · 개선 후 사진 수집차량_개선후.jpg · 전자서명 김지도" },
                        { type: "CONFIRM", at: "2024-08-01 09:30", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-103",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2024-01",
                    dept_id: "water",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "여과지 점검 개구부 추락", category: "물리적", cause: "개구부 덮개 미고정", basis: "oshs-43", facilNo: "WS1996-0000011", facilNm: "신계정수장" },
                    hazard_risk_factor: "여과지 점검 개구부 추락",
                    description: "여과지 점검 개구부 4개소 잠금형 덮개 교체 및 추락주의 표지 부착",
                    action: "여과지 점검 개구부 4개소 잠금형 덮개 교체 및 추락주의 표지 부착",
                    assigned_to: "물순환사업소 · 주무관 / 하정수",
                    due: "2024-08-30",
                    due_date: "2024-08-30",
                    before_photo: "여과지개구부_개선전.jpg",
                    after_photo: "여과지개구부_개선후.jpg",
                    before_photos: [
                        { name: "여과지개구부_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b4 }
                    ],
                    after_photos: [
                        { name: "여과지개구부_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a4 }
                    ],
                    action_content: "여과지 점검 개구부 4개소 잠금형 덮개 교체 및 표지 부착 완료",
                    completed_date: "2024-08-08",
                    signature: { by: "하정수", at: "2024-08-08" },
                    status: "DONE",
                    reassessed: true,
                    created: "2024-05-22",
                    confirm: { state: "OK", by: "박안전", at: "2024-08-16", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2024-05-22 11:40", by: "하정수", memo: "부서 작성 · 입력 완료 (기한 2024-08-30)" },
                        { type: "STATUS", at: "2024-08-08 15:20", by: "하정수", memo: "완료 처리 · 완료일 2024-08-08 · 개선 후 사진 여과지개구부_개선후.jpg · 전자서명 하정수" },
                        { type: "CONFIRM", at: "2024-08-16 10:00", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-104",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2024-01",
                    dept_id: "water",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "수질분석실 시약 증기 흡입", category: "화학적", cause: "시약장 배기 미흡", basis: "oshs-607", facilNo: "ST1999-0000017", facilNm: "담양하수종말처리장" },
                    hazard_risk_factor: "수질분석실 시약 증기 흡입",
                    description: "시약장 국소배기장치 설치 및 MSDS 비치·교육",
                    action: "시약장 국소배기장치 설치 및 MSDS 비치·교육",
                    assigned_to: "물순환사업소 · 주무관 / 오수질",
                    due: "2024-08-30",
                    due_date: "2024-08-30",
                    before_photo: "시약장_개선전.jpg",
                    after_photo: "시약장_개선후.jpg",
                    before_photos: [
                        { name: "시약장_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b1 }
                    ],
                    after_photos: [
                        { name: "시약장_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a1 }
                    ],
                    action_content: "시약장 국소배기장치 설치 및 MSDS 비치·취급자 교육 완료",
                    completed_date: "2024-08-20",
                    signature: { by: "오수질", at: "2024-08-20" },
                    status: "DONE",
                    reassessed: true,
                    created: "2024-05-22",
                    confirm: { state: "OK", by: "박안전", at: "2024-08-27", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2024-05-22 11:40", by: "하정수", memo: "부서 작성 · 입력 완료 (기한 2024-08-30)" },
                        { type: "STATUS", at: "2024-08-20 17:00", by: "오수질", memo: "완료 처리 · 완료일 2024-08-20 · 개선 후 사진 시약장_개선후.jpg · 전자서명 오수질" },
                        { type: "CONFIRM", at: "2024-08-27 14:10", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-105",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2024-01",
                    dept_id: "construct",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "도로 보수 현장 차량 충돌", category: "작업특성", cause: "신호수 미배치", basis: "" },
                    hazard_risk_factor: "도로 보수 현장 차량 충돌",
                    description: "도로 보수 작업 시 신호수 배치 및 교통통제 계획서 작성 의무화",
                    action: "도로 보수 작업 시 신호수 배치 및 교통통제 계획서 작성 의무화",
                    assigned_to: "건설과 · 현장안전 담당 주무관 / 박현장",
                    due: "2024-07-31",
                    due_date: "2024-07-31",
                    before_photo: false,
                    after_photo: "도로보수_개선후.jpg",
                    before_photos: [],
                    after_photos: [
                        { name: "도로보수_개선후.jpg", size: 152000, type: "image/jpeg" }
                    ],
                    action_content: "신호수 배치 기준 마련 및 교통통제 계획서 양식 배포 완료",
                    completed_date: "2024-07-19",
                    signature: { by: "박현장", at: "2024-07-19" },
                    status: "DONE",
                    reassessed: true,
                    created: "2024-05-24",
                    confirm: { state: "OK", by: "박안전", at: "2024-07-26", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2024-05-24 10:05", by: "박현장", memo: "부서 작성 · 입력 완료 (기한 2024-07-31)" },
                        { type: "STATUS", at: "2024-07-19 11:30", by: "박현장", memo: "완료 처리 · 완료일 2024-07-19 · 개선 후 사진 도로보수_개선후.jpg · 전자서명 박현장" },
                        { type: "CONFIRM", at: "2024-07-26 09:50", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-106",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2024-01",
                    dept_id: "construct",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "예초 작업 중 비산물 상해", category: "기계적", cause: "보호구 착용 미흡", basis: "oshs-32" },
                    hazard_risk_factor: "예초 작업 중 비산물 상해",
                    description: "예초 작업자 보안면·각반 지급 및 착용 점검",
                    action: "예초 작업자 보안면·각반 지급 및 착용 점검",
                    assigned_to: "건설과 · 주무관 / 이준호",
                    due: "2024-07-31",
                    due_date: "2024-07-31",
                    before_photo: "예초작업_개선전.jpg",
                    after_photo: "예초작업_개선후.jpg",
                    before_photos: [
                        { name: "예초작업_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b3 }
                    ],
                    after_photos: [
                        { name: "예초작업_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a3 }
                    ],
                    action_content: "예초 작업자 12명 보안면·각반 지급 및 착용 점검 완료",
                    completed_date: "2024-07-29",
                    signature: { by: "이준호", at: "2024-07-29" },
                    status: "DONE",
                    reassessed: true,
                    created: "2024-05-24",
                    confirm: { state: "OK", by: "박안전", at: "2024-08-05", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2024-05-24 10:05", by: "박현장", memo: "부서 작성 · 입력 완료 (기한 2024-07-31)" },
                        { type: "STATUS", at: "2024-07-29 16:00", by: "이준호", memo: "완료 처리 · 완료일 2024-07-29 · 개선 후 사진 예초작업_개선후.jpg · 전자서명 이준호" },
                        { type: "CONFIRM", at: "2024-08-05 10:30", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-211",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "water",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2025-01",
                    hazard: { name: "염소투입기 교체 후 배관 접속부 누출", category: "화학적", cause: "신규 설비 누출감지기 미연동", basis: "oshs-420", facilNo: "WS1996-0000011", facilNm: "신계정수장" },
                    hazard_risk_factor: "염소투입기 교체 후 배관 접속부 누출",
                    description: "누출감지기 신규 설비 연동 및 비상 세안설비 위치 조정",
                    action: "누출감지기 신규 설비 연동 및 비상 세안설비 위치 조정",
                    assigned_to: "물순환사업소 · 시설 담당 / 서담당",
                    due: "2025-03-31",
                    due_date: "2025-03-31",
                    before_photo: "염소투입기_개선전.jpg",
                    after_photo: "염소투입기_개선후.jpg",
                    before_photos: [
                        { name: "염소투입기_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b2 }
                    ],
                    after_photos: [
                        { name: "염소투입기_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a2 }
                    ],
                    action_content: "누출감지기 연동 및 비상 세안설비 위치 조정 완료",
                    completed_date: "2025-03-21",
                    signature: { by: "서담당", at: "2025-03-21" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-02-19",
                    history: [
                        { type: "NOTIFY", at: "2025-02-19 10:30", by: "물순환사업소", memo: "수시평가(OCC-2025-01) 실시 결과 — 위험성 감소대책 등록 (조치기한 2025-03-31)" },
                        { type: "STATUS", at: "2025-03-21 15:00", by: "서담당", memo: "완료 처리 · 완료일 2025-03-21 · 개선 후 사진 염소투입기_개선후.jpg · 전자서명 서담당" },
                        { type: "CONFIRM", at: "2025-03-26 09:30", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-201",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2025-01",
                    dept_id: "safety",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "옥상 점검통로 안전난간 미설치", category: "물리적", cause: "난간 미설치 구간 30m", basis: "oshs-43", facilNo: "AR1968-0000226", facilNm: "담양군청(본관동)" },
                    hazard_risk_factor: "옥상 점검통로 안전난간 미설치",
                    description: "점검통로 전 구간 안전난간(H=1.2m) 설치 및 추락주의 표지 부착",
                    action: "점검통로 전 구간 안전난간(H=1.2m) 설치 및 추락주의 표지 부착",
                    assigned_to: "재난안전과 · 안전관리자 / 김안전",
                    due: "2025-07-31",
                    due_date: "2025-07-31",
                    before_photo: "옥상난간_개선전.jpg",
                    after_photo: "옥상난간_개선후.jpg",
                    before_photos: [
                        { name: "옥상난간_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b4 }
                    ],
                    after_photos: [
                        { name: "옥상난간_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a4 }
                    ],
                    action_content: "점검통로 전 구간 안전난간(H=1.2m) 설치 및 추락주의 표지 부착 완료",
                    completed_date: "2025-07-18",
                    signature: { by: "김안전", at: "2025-07-18" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-05-22",
                    confirm: { state: "OK", by: "박안전", at: "2025-08-01", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2025-05-22 14:20", by: "박안전", memo: "부서 작성 · 입력 완료 (기한 2025-07-31)" },
                        { type: "STATUS", at: "2025-07-18 16:20", by: "김안전", memo: "완료 처리 · 완료일 2025-07-18 · 개선 후 사진 옥상난간_개선후.jpg · 전자서명 김안전" },
                        { type: "CONFIRM", at: "2025-08-01 09:40", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-202",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2025-01",
                    dept_id: "safety",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "비상발전기실 소화기 미비치", category: "화학적", cause: "소화기 노후·수량 부족", basis: "", facilNo: "AR1968-0000226", facilNm: "담양군청(본관동)" },
                    hazard_risk_factor: "비상발전기실 소화기 미비치",
                    description: "ABC분말소화기 4대 교체 비치 및 점검표 부착",
                    action: "ABC분말소화기 4대 교체 비치 및 점검표 부착",
                    assigned_to: "재난안전과 · 안전관리담당 / 박담당",
                    due: "2025-07-31",
                    due_date: "2025-07-31",
                    before_photo: false,
                    after_photo: "발전기실_개선후.jpg",
                    before_photos: [],
                    after_photos: [
                        { name: "발전기실_개선후.jpg", size: 152000, type: "image/jpeg" }
                    ],
                    action_content: "ABC분말소화기 4대 교체 비치 및 점검표 부착 완료",
                    completed_date: "2025-07-22",
                    signature: { by: "박담당", at: "2025-07-22" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-05-22",
                    confirm: { state: "OK", by: "박안전", at: "2025-08-01", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2025-05-22 14:20", by: "박안전", memo: "부서 작성 · 입력 완료 (기한 2025-07-31)" },
                        { type: "STATUS", at: "2025-07-22 16:20", by: "박담당", memo: "완료 처리 · 완료일 2025-07-22 · 개선 후 사진 발전기실_개선후.jpg · 전자서명 박담당" },
                        { type: "CONFIRM", at: "2025-08-01 09:45", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-203",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2025-01",
                    dept_id: "env",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "폐기물 적치장 붕괴 위험", category: "물리적", cause: "적치 높이 기준 초과", basis: "" },
                    hazard_risk_factor: "폐기물 적치장 붕괴 위험",
                    description: "적치 높이 제한선 도색 및 방호벽 설치, 주 1회 점검 지정",
                    action: "적치 높이 제한선 도색 및 방호벽 설치, 주 1회 점검 지정",
                    assigned_to: "환경과 · 유해·위험요인 담당 주무관 / 정환경",
                    due: "2025-08-14",
                    due_date: "2025-08-14",
                    before_photo: "적치장_개선전.jpg",
                    after_photo: "적치장_개선후.jpg",
                    before_photos: [
                        { name: "적치장_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b2 }
                    ],
                    after_photos: [
                        { name: "적치장_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a2 }
                    ],
                    action_content: "적치 높이 제한선 도색 및 방호벽 설치, 주 1회 점검 지정 완료",
                    completed_date: "2025-08-05",
                    signature: { by: "정환경", at: "2025-08-05" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-05-23",
                    confirm: { state: "OK", by: "박안전", at: "2025-08-20", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2025-05-23 10:30", by: "정환경", memo: "부서 작성 · 입력 완료 (기한 2025-08-14)" },
                        { type: "STATUS", at: "2025-08-05 16:20", by: "정환경", memo: "완료 처리 · 완료일 2025-08-05 · 개선 후 사진 적치장_개선후.jpg · 전자서명 정환경" },
                        { type: "CONFIRM", at: "2025-08-20 09:40", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-204",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2025-01",
                    dept_id: "env",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "자원순환팀 파쇄기 방호덮개 파손", category: "기계적", cause: "덮개 균열·고정볼트 이완", basis: "oshs-87", facilNa: true },
                    hazard_risk_factor: "자원순환팀 파쇄기 방호덮개 파손",
                    description: "방호덮개 교체 및 비상정지 스위치 동작 점검",
                    action: "방호덮개 교체 및 비상정지 스위치 동작 점검",
                    assigned_to: "환경과 · 주무관 / 정수빈",
                    due: "2025-08-14",
                    due_date: "2025-08-14",
                    before_photo: false,
                    after_photo: "파쇄기_개선후.jpg",
                    before_photos: [],
                    after_photos: [
                        { name: "파쇄기_개선후.jpg", size: 152000, type: "image/jpeg" }
                    ],
                    action_content: "방호덮개 교체 및 비상정지 스위치 동작 점검 완료",
                    completed_date: "2025-08-11",
                    signature: { by: "정수빈", at: "2025-08-11" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-05-23",
                    confirm: { state: "OK", by: "박안전", at: "2025-08-20", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2025-05-23 10:30", by: "정환경", memo: "부서 작성 · 입력 완료 (기한 2025-08-14)" },
                        { type: "STATUS", at: "2025-08-11 16:20", by: "정수빈", memo: "완료 처리 · 완료일 2025-08-11 · 개선 후 사진 파쇄기_개선후.jpg · 전자서명 정수빈" },
                        { type: "CONFIRM", at: "2025-08-20 09:50", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-205",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2025-01",
                    dept_id: "water",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "정수장 약품투입실 환기 불량", category: "화학적", cause: "국소배기장치 용량 부족", basis: "oshs-607", facilNo: "WS1996-0000011", facilNm: "신계정수장" },
                    hazard_risk_factor: "정수장 약품투입실 환기 불량",
                    description: "국소배기장치 2대 증설 및 MSDS 게시, 보호구 비치",
                    action: "국소배기장치 2대 증설 및 MSDS 게시, 보호구 비치",
                    assigned_to: "물순환사업소 · 주무관 / 하정수",
                    due: "2025-09-30",
                    due_date: "2025-09-30",
                    before_photo: "약품실_개선전.jpg",
                    after_photo: "약품실_개선후.jpg",
                    before_photos: [
                        { name: "약품실_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b4 }
                    ],
                    after_photos: [
                        { name: "약품실_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a4 }
                    ],
                    action_content: "국소배기장치 2대 증설 및 MSDS 게시, 보호구 비치 완료",
                    completed_date: "2025-09-12",
                    signature: { by: "하정수", at: "2025-09-12" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-05-26",
                    confirm: { state: "OK", by: "박안전", at: "2025-10-02", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2025-05-26 16:00", by: "하정수", memo: "부서 작성 · 입력 완료 (기한 2025-09-30)" },
                        { type: "STATUS", at: "2025-09-12 16:20", by: "하정수", memo: "완료 처리 · 완료일 2025-09-12 · 개선 후 사진 약품실_개선후.jpg · 전자서명 하정수" },
                        { type: "CONFIRM", at: "2025-10-02 09:40", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-206",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2025-01",
                    dept_id: "water",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "침전지 개구부 추락 위험", category: "물리적", cause: "개구부 덮개·난간 미설치", basis: "oshs-43", facilNo: "WS1996-0000011", facilNm: "신계정수장" },
                    hazard_risk_factor: "침전지 개구부 추락 위험",
                    description: "개구부 안전덮개 6개소 설치 및 추락주의 표지 부착",
                    action: "개구부 안전덮개 6개소 설치 및 추락주의 표지 부착",
                    assigned_to: "물순환사업소 · 주무관 / 하정수",
                    due: "2025-09-30",
                    due_date: "2025-09-30",
                    before_photo: "개구부_개선전.jpg",
                    after_photo: "개구부_개선후.jpg",
                    before_photos: [
                        { name: "개구부_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b1 }
                    ],
                    after_photos: [
                        { name: "개구부_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a1 }
                    ],
                    action_content: "개구부 안전덮개 6개소 설치 및 추락주의 표지 부착 완료",
                    completed_date: "2025-09-18",
                    signature: { by: "하정수", at: "2025-09-18" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-05-26",
                    confirm: { state: "OK", by: "박안전", at: "2025-10-02", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2025-05-26 16:00", by: "하정수", memo: "부서 작성 · 입력 완료 (기한 2025-09-30)" },
                        { type: "STATUS", at: "2025-09-18 16:20", by: "하정수", memo: "완료 처리 · 완료일 2025-09-18 · 개선 후 사진 개구부_개선후.jpg · 전자서명 하정수" },
                        { type: "CONFIRM", at: "2025-10-02 09:45", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-207",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2025-01",
                    dept_id: "water",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "전기 분전반 시건장치 미설치", category: "전기적", cause: "분전반 개방 상태 방치", basis: "", facilNo: "ST1999-0000017", facilNm: "담양하수종말처리장" },
                    hazard_risk_factor: "전기 분전반 시건장치 미설치",
                    description: "분전반 6면 시건장치 설치 및 활선 경고표지 부착",
                    action: "분전반 6면 시건장치 설치 및 활선 경고표지 부착",
                    assigned_to: "물순환사업소 · 주무관 / 오수질",
                    due: "2025-09-30",
                    due_date: "2025-09-30",
                    before_photo: "분전반_개선전.jpg",
                    after_photo: "분전반_개선후.jpg",
                    before_photos: [
                        { name: "분전반_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b2 }
                    ],
                    after_photos: [
                        { name: "분전반_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a2 }
                    ],
                    action_content: "분전반 6면 시건장치 설치 및 활선 경고표지 부착 완료",
                    completed_date: "2025-09-29",
                    signature: { by: "오수질", at: "2025-09-29" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-05-26",
                    confirm: { state: "OK", by: "박안전", at: "2025-10-02", reason: "", round: 2 },
                    history: [
                        { type: "REGISTER", at: "2025-05-26 16:00", by: "하정수", memo: "부서 작성 · 입력 완료 (기한 2025-09-30)" },
                        { type: "STATUS", at: "2025-09-19 16:20", by: "오수질", memo: "완료 처리 · 완료일 2025-09-19 · 개선 후 사진 분전반_개선후.jpg · 전자서명 오수질" },
                        { type: "RETURN", at: "2025-09-24 10:10", by: "박안전", memo: "조치 확인 반려 — 분전반 2면의 시건장치 설치 사진이 없습니다 — 6면 전부 확인되도록 사진을 다시 올려 주세요" },
                        { type: "STATUS", at: "2025-09-29 15:30", by: "오수질", memo: "완료 처리 · 완료일 2025-09-29 · 개선 후 사진 분전반_개선후.jpg · 전자서명 오수질" },
                        { type: "CONFIRM", at: "2025-10-02 10:00", by: "박안전", memo: "조치 완료 확인 (2회차 제출)" }
                    ]
                },
                {
                    id: "IMP-208",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2025-01",
                    dept_id: "water",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "슬러지 이송 컨베이어 비상정지 미작동", category: "기계적", cause: "비상정지 스위치 접점 불량", basis: "" },
                    hazard_risk_factor: "슬러지 이송 컨베이어 비상정지 미작동",
                    description: "비상정지 스위치 전량 교체 및 월 1회 작동 점검 지정",
                    action: "비상정지 스위치 전량 교체 및 월 1회 작동 점검 지정",
                    assigned_to: "물순환사업소 · 시설 담당 / 서담당",
                    due: "2025-09-30",
                    due_date: "2025-09-30",
                    before_photo: false,
                    after_photo: "컨베이어_개선후.jpg",
                    before_photos: [],
                    after_photos: [
                        { name: "컨베이어_개선후.jpg", size: 152000, type: "image/jpeg" }
                    ],
                    action_content: "비상정지 스위치 전량 교체 및 월 1회 작동 점검 지정 완료",
                    completed_date: "2025-09-26",
                    signature: { by: "서담당", at: "2025-09-26" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-05-26",
                    confirm: { state: "OK", by: "박안전", at: "2025-10-02", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2025-05-26 16:00", by: "하정수", memo: "부서 작성 · 입력 완료 (기한 2025-09-30)" },
                        { type: "STATUS", at: "2025-09-26 16:20", by: "서담당", memo: "완료 처리 · 완료일 2025-09-26 · 개선 후 사진 컨베이어_개선후.jpg · 전자서명 서담당" },
                        { type: "CONFIRM", at: "2025-10-02 10:05", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-215",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2025-01",
                    dept_id: "facility",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "체육관 천장 조명 교체 작업 중 추락", category: "고소작업", cause: "이동식 비계 안전난간 미설치", basis: "", facilNo: "AR2008-0003610", facilNm: "담양종합체육관" },
                    hazard_risk_factor: "체육관 천장 조명 교체 작업 중 추락",
                    description: "이동식 비계 안전난간·아웃트리거 설치 후 작업, 2인 1조 작업 지정",
                    action: "이동식 비계 안전난간·아웃트리거 설치 후 작업, 2인 1조 작업 지정",
                    assigned_to: "공공시설사업소 · 주무관 / 한운영",
                    due: "2025-08-29",
                    due_date: "2025-08-29",
                    before_photo: "체육관비계_개선전.jpg",
                    after_photo: "체육관비계_개선후.jpg",
                    before_photos: [
                        { name: "체육관비계_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b4 }
                    ],
                    after_photos: [
                        { name: "체육관비계_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a4 }
                    ],
                    action_content: "이동식 비계 안전난간·아웃트리거 보강 및 2인 1조 작업 지정 완료",
                    completed_date: "2025-08-21",
                    signature: { by: "한운영", at: "2025-08-21" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-05-27",
                    confirm: { state: "OK", by: "박안전", at: "2025-09-02", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2025-05-27 11:15", by: "한담당", memo: "부서 작성 · 입력 완료 (기한 2025-08-29)" },
                        { type: "STATUS", at: "2025-08-21 15:40", by: "한운영", memo: "완료 처리 · 완료일 2025-08-21 · 개선 후 사진 체육관비계_개선후.jpg · 전자서명 한운영" },
                        { type: "CONFIRM", at: "2025-09-02 10:10", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-216",
                    source_type: "risk_assessment",
                    assessment_id: "RA-2025-01",
                    dept_id: "facility",
                    target_id: "",
                    process_id: "",
                    occ_id: "",
                    hazard: { name: "환경시설팀 펌프실 회전체 노출", category: "기계적", cause: "커플링 방호덮개 탈락", basis: "oshs-87", facilNa: true },
                    hazard_risk_factor: "환경시설팀 펌프실 회전체 노출",
                    description: "펌프 커플링 방호덮개 재설치 및 점검표에 덮개 상태 항목 추가",
                    action: "펌프 커플링 방호덮개 재설치 및 점검표에 덮개 상태 항목 추가",
                    assigned_to: "공공시설사업소 · 주무관 / 민설비",
                    due: "2025-08-29",
                    due_date: "2025-08-29",
                    before_photo: "펌프실_개선전.jpg",
                    after_photo: "펌프실_개선후.jpg",
                    before_photos: [
                        { name: "펌프실_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b1 }
                    ],
                    after_photos: [
                        { name: "펌프실_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a1 }
                    ],
                    action_content: "펌프 커플링 방호덮개 재설치 및 점검표 항목 추가 완료",
                    completed_date: "2025-08-27",
                    signature: { by: "민설비", at: "2025-08-27" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-05-27",
                    confirm: { state: "OK", by: "박안전", at: "2025-09-02", reason: "", round: 1 },
                    history: [
                        { type: "REGISTER", at: "2025-05-27 11:15", by: "한담당", memo: "부서 작성 · 입력 완료 (기한 2025-08-29)" },
                        { type: "STATUS", at: "2025-08-27 14:30", by: "민설비", memo: "완료 처리 · 완료일 2025-08-27 · 개선 후 사진 펌프실_개선후.jpg · 전자서명 민설비" },
                        { type: "CONFIRM", at: "2025-09-02 10:15", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-212",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "construct",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2025-02",
                    hazard: { name: "콘크리트 절단기 칼날 접촉 절창", category: "기계적", cause: "칼날 덮개 탈락 상태 사용", basis: "oshs-32" },
                    hazard_risk_factor: "콘크리트 절단기 칼날 접촉 절창",
                    description: "절단기 칼날 덮개 교체, 방호장갑·보안면 지급 및 작업 전 점검표 운영",
                    action: "절단기 칼날 덮개 교체, 방호장갑·보안면 지급 및 작업 전 점검표 운영",
                    assigned_to: "건설과 · 주무관 / 김도현",
                    due: "2025-06-30",
                    due_date: "2025-06-30",
                    before_photo: "절단기_개선전.jpg",
                    after_photo: "절단기_개선후.jpg",
                    before_photos: [
                        { name: "절단기_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b3 }
                    ],
                    after_photos: [
                        { name: "절단기_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a3 }
                    ],
                    action_content: "절단기 3대 칼날 덮개 교체 및 보호구 지급, 작업 전 점검표 운영 개시",
                    completed_date: "2025-06-20",
                    signature: { by: "김도현", at: "2025-06-20" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-06-10",
                    history: [
                        { type: "NOTIFY", at: "2025-06-10 14:00", by: "건설과", memo: "수시평가(OCC-2025-02) 실시 결과 — 위험성 감소대책 등록 (조치기한 2025-06-30)" },
                        { type: "STATUS", at: "2025-06-20 11:20", by: "김도현", memo: "완료 처리 · 완료일 2025-06-20 · 개선 후 사진 절단기_개선후.jpg · 전자서명 김도현" },
                        { type: "CONFIRM", at: "2025-06-25 10:00", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-213",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "facility",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2025-03",
                    hazard: { name: "고압세척기 사용 중 미끄러짐·감전", category: "전기적", cause: "습윤 바닥 · 누전차단기 없는 콘센트 사용", basis: "oshs-304", facilNo: "AR2002-0000563", facilNm: "담양문화회관" },
                    hazard_risk_factor: "고압세척기 사용 중 미끄러짐·감전",
                    description: "이동식 누전차단기 배치 및 미끄럼 방지 장화 지급",
                    action: "이동식 누전차단기 배치 및 미끄럼 방지 장화 지급",
                    assigned_to: "공공시설사업소 · 주무관 / 한운영",
                    due: "2025-09-30",
                    due_date: "2025-09-30",
                    before_photo: "고압세척_개선전.jpg",
                    after_photo: "고압세척_개선후.jpg",
                    before_photos: [
                        { name: "고압세척_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b4 }
                    ],
                    after_photos: [
                        { name: "고압세척_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a4 }
                    ],
                    action_content: "이동식 누전차단기 2대 배치 및 미끄럼 방지 장화 지급 완료",
                    completed_date: "2025-09-23",
                    signature: { by: "한운영", at: "2025-09-23" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-09-04",
                    history: [
                        { type: "NOTIFY", at: "2025-09-04 09:40", by: "공공시설사업소", memo: "수시평가(OCC-2025-03) 실시 결과 — 위험성 감소대책 등록 (조치기한 2025-09-30)" },
                        { type: "STATUS", at: "2025-09-23 16:10", by: "한운영", memo: "완료 처리 · 완료일 2025-09-23 · 개선 후 사진 고압세척_개선후.jpg · 전자서명 한운영" },
                        { type: "CONFIRM", at: "2025-09-26 10:30", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-214",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "env",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2025-04",
                    hazard: { name: "침출수 이송펌프 보수 중 질식", category: "작업특성", cause: "집수정 내부 환기 미확보", basis: "oshs-619" },
                    hazard_risk_factor: "침출수 이송펌프 보수 중 질식",
                    description: "집수정 진입 작업허가제 운영 및 산소·유해가스 농도 측정기 비치",
                    action: "집수정 진입 작업허가제 운영 및 산소·유해가스 농도 측정기 비치",
                    assigned_to: "환경과 · 유해·위험요인 담당 주무관 / 정환경",
                    due: "2026-01-16",
                    due_date: "2026-01-16",
                    before_photo: "집수정_개선전.jpg",
                    after_photo: "집수정_개선후.jpg",
                    before_photos: [
                        { name: "집수정_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b1 }
                    ],
                    after_photos: [
                        { name: "집수정_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a1 }
                    ],
                    action_content: "집수정 작업허가서 양식 운영 개시 및 복합가스 측정기 2대 비치 완료",
                    completed_date: "2026-01-09",
                    signature: { by: "정환경", at: "2026-01-09" },
                    status: "DONE",
                    reassessed: true,
                    created: "2025-12-03",
                    history: [
                        { type: "NOTIFY", at: "2025-12-03 11:00", by: "환경과", memo: "수시평가(OCC-2025-04) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-01-16)" },
                        { type: "STATUS", at: "2026-01-09 15:20", by: "정환경", memo: "완료 처리 · 완료일 2026-01-09 · 개선 후 사진 집수정_개선후.jpg · 전자서명 정환경" },
                        { type: "CONFIRM", at: "2026-01-14 09:40", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-221",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "construct",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-01",
                    hazard: { name: "제설기 부착 덤프 후진 중 협착", category: "작업특성", cause: "후방 시야 확보 불량 · 유도자 없음", basis: "" },
                    hazard_risk_factor: "제설기 부착 덤프 후진 중 협착",
                    description: "제설 덤프 4대 후방카메라·후진경보기 설치 및 상차장 유도자 지정",
                    action: "제설 덤프 4대 후방카메라·후진경보기 설치 및 상차장 유도자 지정",
                    assigned_to: "건설과 · 주무관 / 이준호",
                    due: "2026-02-27",
                    due_date: "2026-02-27",
                    before_photo: "제설덤프_개선전.jpg",
                    after_photo: "제설덤프_개선후.jpg",
                    before_photos: [
                        { name: "제설덤프_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b2 }
                    ],
                    after_photos: [
                        { name: "제설덤프_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a2 }
                    ],
                    action_content: "후방카메라·후진경보기 4대 설치 및 상차장 유도자 지정 완료",
                    completed_date: "2026-02-13",
                    signature: { by: "이준호", at: "2026-02-13" },
                    status: "DONE",
                    reassessed: true,
                    created: "2026-01-23",
                    history: [
                        { type: "NOTIFY", at: "2026-01-23 09:30", by: "건설과", memo: "수시평가(OCC-2026-01) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-02-27)" },
                        { type: "STATUS", at: "2026-02-13 14:40", by: "이준호", memo: "완료 처리 · 완료일 2026-02-13 · 개선 후 사진 제설덤프_개선후.jpg · 전자서명 이준호" },
                        { type: "CONFIRM", at: "2026-02-20 10:00", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-210",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "env",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-02",
                    hazard: { name: "신규 압축기 회전부 끼임 위험", category: "기계적", cause: "방호덮개 미설치 상태 반입", basis: "oshs-87", facilNa: true },
                    hazard_risk_factor: "신규 압축기 회전부 끼임 위험",
                    description: "방호덮개 설치 및 비상정지 스위치 설치, 취급자 특별교육 실시",
                    action: "방호덮개 설치 및 비상정지 스위치 설치, 취급자 특별교육 실시",
                    assigned_to: "환경과 · 주무관 / 정수빈",
                    due: "2026-04-30",
                    due_date: "2026-04-30",
                    before_photo: "압축기_개선전.jpg",
                    after_photo: "압축기_개선후.jpg",
                    before_photos: [
                        { name: "압축기_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b3 }
                    ],
                    after_photos: [
                        { name: "압축기_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a3 }
                    ],
                    action_content: "방호덮개·비상정지 스위치 설치 및 취급자 3명 특별교육 실시 완료",
                    completed_date: "2026-04-17",
                    signature: { by: "정수빈", at: "2026-04-17" },
                    status: "DONE",
                    reassessed: true,
                    created: "2026-03-11",
                    history: [
                        { type: "NOTIFY", at: "2026-03-11 14:00", by: "환경과", memo: "수시평가(OCC-2026-02) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-04-30)" },
                        { type: "STATUS", at: "2026-04-17 15:30", by: "정수빈", memo: "완료 처리 · 완료일 2026-04-17 · 개선 후 사진 압축기_개선후.jpg · 전자서명 정수빈" },
                        { type: "CONFIRM", at: "2026-04-22 09:40", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-222",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "facility",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-03",
                    hazard: { name: "지붕 방수 보수 작업 중 추락", category: "고소작업", cause: "지붕 단부 안전난간 없음", basis: "oshs-43", facilNo: "AR2002-0000559", facilNm: "담양군여성문화회관" },
                    hazard_risk_factor: "지붕 방수 보수 작업 중 추락",
                    description: "지붕 단부 임시 안전난간 설치 및 안전대 부착설비 설치 후 작업",
                    action: "지붕 단부 임시 안전난간 설치 및 안전대 부착설비 설치 후 작업",
                    assigned_to: "공공시설사업소 · 주무관 / 민설비",
                    due: "2026-05-15",
                    due_date: "2026-05-15",
                    before_photo: "지붕방수_개선전.jpg",
                    after_photo: "지붕방수_개선후.jpg",
                    before_photos: [
                        { name: "지붕방수_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b4 }
                    ],
                    after_photos: [
                        { name: "지붕방수_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a4 }
                    ],
                    action_content: "임시 안전난간·안전대 부착설비 설치 후 방수 보수 완료",
                    completed_date: "2026-05-08",
                    signature: { by: "민설비", at: "2026-05-08" },
                    status: "DONE",
                    reassessed: true,
                    created: "2026-04-15",
                    history: [
                        { type: "NOTIFY", at: "2026-04-15 10:20", by: "공공시설사업소", memo: "수시평가(OCC-2026-03) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-05-15)" },
                        { type: "STATUS", at: "2026-05-08 16:00", by: "민설비", memo: "완료 처리 · 완료일 2026-05-08 · 개선 후 사진 지붕방수_개선후.jpg · 전자서명 민설비" },
                        { type: "CONFIRM", at: "2026-05-13 10:10", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-209",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "water",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-04",
                    hazard: { name: "밸브실 고압 배관 파손 시 수증기 분출", category: "물리적", cause: "노후 밸브·차폐 부재", basis: "", facilNo: "WS2008-0000016", facilNm: "담양지방상수도" },
                    hazard_risk_factor: "밸브실 고압 배관 파손 시 수증기 분출",
                    description: "노후 밸브 3개소 교체 및 작업 전 차단 절차 게시, 보호구 비치",
                    action: "노후 밸브 3개소 교체 및 작업 전 차단 절차 게시, 보호구 비치",
                    assigned_to: "물순환사업소 · 시설 담당 / 서담당",
                    due: "2026-06-30",
                    due_date: "2026-06-30",
                    before_photo: "밸브실_개선전.jpg",
                    after_photo: "밸브실_개선후.jpg",
                    before_photos: [
                        { name: "밸브실_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b1 }
                    ],
                    after_photos: [
                        { name: "밸브실_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a1 }
                    ],
                    action_content: "노후 밸브 3개소 교체 완료, 차단 절차 게시 및 보호구 비치",
                    completed_date: "2026-06-24",
                    signature: { by: "서담당", at: "2026-06-24" },
                    status: "DONE",
                    reassessed: true,
                    created: "2026-05-21",
                    history: [
                        { type: "NOTIFY", at: "2026-05-21 11:10", by: "물순환사업소", memo: "수시평가(OCC-2026-04) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-06-30)" },
                        { type: "STATUS", at: "2026-06-24 15:40", by: "서담당", memo: "완료 처리 · 완료일 2026-06-24 · 개선 후 사진 밸브실_개선후.jpg · 전자서명 서담당" },
                        { type: "CONFIRM", at: "2026-06-27 09:20", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-223",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "construct",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-05",
                    hazard: { name: "자재창고 신축 후 상부 적재물 낙하", category: "물리적", cause: "랙 상단 낙하방지망 없음", basis: "oshs-14" },
                    hazard_risk_factor: "자재창고 신축 후 상부 적재물 낙하",
                    description: "랙 상단 낙하방지망 설치 및 중량물 하단 적재 기준 게시",
                    action: "랙 상단 낙하방지망 설치 및 중량물 하단 적재 기준 게시",
                    assigned_to: "건설과 · 주무관 / 박서준",
                    due: "2026-08-31",
                    due_date: "2026-08-31",
                    before_photo: "자재창고_개선전.jpg",
                    after_photo: "자재창고_개선후.jpg",
                    before_photos: [
                        { name: "자재창고_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b2 }
                    ],
                    after_photos: [
                        { name: "자재창고_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a2 }
                    ],
                    action_content: "랙 상단 낙하방지망 설치 및 적재 기준 게시 완료",
                    completed_date: "2026-08-19",
                    signature: { by: "박서준", at: "2026-08-19" },
                    status: "DONE",
                    reassessed: true,
                    created: "2026-07-09",
                    history: [
                        { type: "NOTIFY", at: "2026-07-09 15:00", by: "건설과", memo: "수시평가(OCC-2026-05) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-08-31)" },
                        { type: "STATUS", at: "2026-08-19 11:00", by: "박서준", memo: "완료 처리 · 완료일 2026-08-19 · 개선 후 사진 자재창고_개선후.jpg · 전자서명 박서준" },
                        { type: "CONFIRM", at: "2026-08-25 10:20", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-224",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "construct",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-05",
                    hazard: { name: "자재창고 적재 랙 전도", category: "물리적", cause: "랙 바닥 앵커 미고정", basis: "" },
                    hazard_risk_factor: "자재창고 적재 랙 전도",
                    description: "적재 랙 12조 바닥 앵커 고정 및 최대 적재하중 표지 부착",
                    action: "적재 랙 12조 바닥 앵커 고정 및 최대 적재하중 표지 부착",
                    assigned_to: "건설과 · 주무관 / 박서준",
                    due: "2026-10-30",
                    due_date: "2026-10-30",
                    before_photo: "적재랙_개선전.jpg",
                    after_photo: false,
                    before_photos: [
                        { name: "적재랙_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b3 }
                    ],
                    after_photos: [],
                    action_content: "",
                    completed_date: "",
                    signature: null,
                    status: "IN_PROGRESS",
                    reassessed: false,
                    created: "2026-07-09",
                    history: [
                        { type: "NOTIFY", at: "2026-07-09 15:00", by: "건설과", memo: "수시평가(OCC-2026-05) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-09-30)" },
                        { type: "AMEND", at: "2026-09-25 10:40", by: "박서준", memo: "기한 2026-09-30 → 2026-10-30 — 사유: 앵커 볼트 자재 납품 지연" },
                        { type: "REMIND", at: "2026-11-04 09:10", by: "재난안전과 박안전", memo: "기한초과 재촉 (기한 2026-10-30)" }
                    ]
                },
                {
                    id: "IMP-225",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "water",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-06",
                    hazard: { name: "반응조 산기관 교체 중 산소결핍", category: "작업특성", cause: "반응조 내부 환기·측정 절차 없음", basis: "oshs-619", facilNo: "ST1999-0000017", facilNm: "담양하수종말처리장" },
                    hazard_risk_factor: "반응조 산기관 교체 중 산소결핍",
                    description: "밀폐공간 작업허가제 적용, 송풍기·산소농도 측정기 비치 후 작업",
                    action: "밀폐공간 작업허가제 적용, 송풍기·산소농도 측정기 비치 후 작업",
                    assigned_to: "물순환사업소 · 주무관 / 오수질",
                    due: "2026-09-30",
                    due_date: "2026-09-30",
                    before_photo: "반응조_개선전.jpg",
                    after_photo: "반응조_개선후.jpg",
                    before_photos: [
                        { name: "반응조_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b4 }
                    ],
                    after_photos: [
                        { name: "반응조_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a4 }
                    ],
                    action_content: "밀폐공간 작업허가서 운영 및 송풍기·산소농도 측정기 비치 완료",
                    completed_date: "2026-09-15",
                    signature: { by: "오수질", at: "2026-09-15" },
                    status: "DONE",
                    reassessed: true,
                    created: "2026-08-27",
                    history: [
                        { type: "NOTIFY", at: "2026-08-27 10:00", by: "물순환사업소", memo: "수시평가(OCC-2026-06) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-09-30)" },
                        { type: "STATUS", at: "2026-09-15 14:30", by: "오수질", memo: "완료 처리 · 완료일 2026-09-15 · 개선 후 사진 반응조_개선후.jpg · 전자서명 오수질" },
                        { type: "CONFIRM", at: "2026-09-21 09:50", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-226",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "water",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-06",
                    hazard: { name: "반응조 상부 점검발판 추락", category: "물리적", cause: "점검발판 난간 부식·높이 미달", basis: "oshs-43", facilNo: "ST1999-0000017", facilNm: "담양하수종말처리장" },
                    hazard_risk_factor: "반응조 상부 점검발판 추락",
                    description: "반응조 상부 점검발판 난간 교체(H=1.2m) 및 발끝막이판 설치",
                    action: "반응조 상부 점검발판 난간 교체(H=1.2m) 및 발끝막이판 설치",
                    assigned_to: "물순환사업소 · 주무관 / 오수질",
                    due: "2026-11-10",
                    due_date: "2026-11-10",
                    before_photo: "점검발판_개선전.jpg",
                    after_photo: false,
                    before_photos: [
                        { name: "점검발판_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b1 }
                    ],
                    after_photos: [],
                    action_content: "",
                    completed_date: "",
                    signature: null,
                    status: "IN_PROGRESS",
                    reassessed: false,
                    created: "2026-08-27",
                    history: [
                        { type: "NOTIFY", at: "2026-08-27 10:00", by: "물순환사업소", memo: "수시평가(OCC-2026-06) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-11-10)" }
                    ]
                },
                {
                    id: "IMP-227",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "safety",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-07",
                    hazard: { name: "비상발전기 교체 후 배기관 화상", category: "물리적", cause: "배기관 단열재·접근 방지 펜스 없음", basis: "", facilNo: "AR1997-0003452", facilNm: "담양군청(문화행복동)" },
                    hazard_risk_factor: "비상발전기 교체 후 배기관 화상",
                    description: "배기관 단열 피복 시공 및 접근 방지 펜스·고온주의 표지 설치",
                    action: "배기관 단열 피복 시공 및 접근 방지 펜스·고온주의 표지 설치",
                    assigned_to: "재난안전과 · 안전관리자 / 김안전",
                    due: "2026-11-20",
                    due_date: "2026-11-20",
                    before_photo: "발전기배기관_개선전.jpg",
                    after_photo: false,
                    before_photos: [
                        { name: "발전기배기관_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b2 }
                    ],
                    after_photos: [],
                    action_content: "",
                    completed_date: "",
                    signature: null,
                    status: "IN_PROGRESS",
                    reassessed: false,
                    created: "2026-09-23",
                    history: [
                        { type: "NOTIFY", at: "2026-09-23 16:20", by: "재난안전과", memo: "수시평가(OCC-2026-07) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-11-20)" }
                    ]
                },
                {
                    id: "IMP-228",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "env",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-08",
                    hazard: { name: "선별장 컨베이어 이물 제거 중 끼임", category: "기계적", cause: "운전 중 손으로 이물 제거 · 정지 수단 멀리 있음", basis: "oshs-87", facilNa: true },
                    hazard_risk_factor: "선별장 컨베이어 이물 제거 중 끼임",
                    description: "작업 전 전원 차단·잠금(LOTO) 절차서 게시 및 이물 제거 전용 공구 비치",
                    action: "작업 전 전원 차단·잠금(LOTO) 절차서 게시 및 이물 제거 전용 공구 비치",
                    assigned_to: "환경과 · 주무관 / 정수빈",
                    due: "2026-11-06",
                    due_date: "2026-11-06",
                    before_photo: "선별장LOTO_개선전.jpg",
                    after_photo: "선별장LOTO_개선후.jpg",
                    before_photos: [
                        { name: "선별장LOTO_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b3 }
                    ],
                    after_photos: [
                        { name: "선별장LOTO_개선후.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.a3 }
                    ],
                    action_content: "LOTO 절차서 게시 및 전용 공구 비치, 선별 작업자 교육 완료",
                    completed_date: "2026-11-03",
                    signature: { by: "정수빈", at: "2026-11-03" },
                    status: "DONE",
                    reassessed: true,
                    created: "2026-10-16",
                    history: [
                        { type: "NOTIFY", at: "2026-10-16 10:40", by: "환경과", memo: "수시평가(OCC-2026-08) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-11-06)" },
                        { type: "STATUS", at: "2026-11-03 15:10", by: "정수빈", memo: "완료 처리 · 완료일 2026-11-03 · 개선 후 사진 선별장LOTO_개선후.jpg · 전자서명 정수빈" },
                        { type: "CONFIRM", at: "2026-11-06 10:30", by: "박안전", memo: "조치 완료 확인" }
                    ]
                },
                {
                    id: "IMP-229",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "env",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-08",
                    hazard: { name: "선별장 컨베이어 비상정지 수단 부족", category: "기계적", cause: "비상정지 버튼 2개소뿐(작업 위치에서 6m)", basis: "", facilNa: true },
                    hazard_risk_factor: "선별장 컨베이어 비상정지 수단 부족",
                    description: "컨베이어 전 구간 비상정지 로프스위치 설치",
                    action: "컨베이어 전 구간 비상정지 로프스위치 설치",
                    assigned_to: "환경과 · 주무관 / 정수빈",
                    due: "2026-11-30",
                    due_date: "2026-11-30",
                    before_photo: "로프스위치_개선전.jpg",
                    after_photo: false,
                    before_photos: [
                        { name: "로프스위치_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b4 }
                    ],
                    after_photos: [],
                    action_content: "",
                    completed_date: "",
                    signature: null,
                    status: "IN_PROGRESS",
                    reassessed: false,
                    created: "2026-10-16",
                    history: [
                        { type: "NOTIFY", at: "2026-10-16 10:40", by: "환경과", memo: "수시평가(OCC-2026-08) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-11-30)" }
                    ]
                },
                {
                    id: "IMP-230",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "env",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-09",
                    hazard: { name: "야간 수집작업 중 차량 접촉", category: "작업특성", cause: "야간 시인성 확보 수단 없음", basis: "" },
                    hazard_risk_factor: "야간 수집작업 중 차량 접촉",
                    description: "야간 수집 작업자 반사조끼·경광봉 지급 및 차량 후방 작업등 설치",
                    action: "야간 수집 작업자 반사조끼·경광봉 지급 및 차량 후방 작업등 설치",
                    assigned_to: "환경과 · 주무관 / 김지도",
                    due: "2026-12-10",
                    due_date: "2026-12-10",
                    before_photo: "야간수집_개선전.jpg",
                    after_photo: false,
                    before_photos: [
                        { name: "야간수집_개선전.jpg", size: 184320, type: "image/jpeg", w: 1600, h: 1200, thumb: T.b1 }
                    ],
                    after_photos: [],
                    action_content: "",
                    completed_date: "",
                    signature: null,
                    status: "IN_PROGRESS",
                    reassessed: false,
                    created: "2026-11-06",
                    history: [
                        { type: "NOTIFY", at: "2026-11-06 14:30", by: "환경과", memo: "수시평가(OCC-2026-09) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-12-10)" }
                    ]
                },
                {
                    id: "IMP-231",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "env",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-09",
                    hazard: { name: "야간 수집 경로 노면 결빙 미끄러짐", category: "작업특성", cause: "야간 작업계획서에 노면 확인 절차 없음", basis: "" },
                    hazard_risk_factor: "야간 수집 경로 노면 결빙 미끄러짐",
                    description: "야간 작업계획서에 노면 상태 확인·작업중지 기준 반영 및 미끄럼 방지 안전화 지급",
                    action: "야간 작업계획서에 노면 상태 확인·작업중지 기준 반영 및 미끄럼 방지 안전화 지급",
                    assigned_to: "환경과 · 유해·위험요인 담당 주무관 / 정환경",
                    due: "2026-12-31",
                    due_date: "2026-12-31",
                    before_photo: false,
                    after_photo: false,
                    before_photos: [],
                    after_photos: [],
                    action_content: "",
                    completed_date: "",
                    signature: null,
                    status: "IN_PROGRESS",
                    reassessed: false,
                    created: "2026-11-06",
                    history: [
                        { type: "NOTIFY", at: "2026-11-06 14:30", by: "환경과", memo: "수시평가(OCC-2026-09) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-12-31)" }
                    ]
                },
                {
                    id: "IMP-232",
                    source_type: "occasional",
                    assessment_id: "",
                    dept_id: "facility",
                    target_id: "",
                    process_id: "",
                    occ_id: "OCC-2026-10",
                    hazard: { name: "고소작업대 신규 도입 — 작업대 전도·끼임", category: "고소작업", cause: "전도방지 아웃트리거 설치 기준·조작자 지정 없음", basis: "", facilNo: "AR2008-0003610", facilNm: "담양종합체육관" },
                    hazard_risk_factor: "고소작업대 신규 도입 — 작업대 전도·끼임",
                    description: "고소작업대 조작자 지정·교육 및 아웃트리거 설치 기준서 게시",
                    action: "고소작업대 조작자 지정·교육 및 아웃트리거 설치 기준서 게시",
                    assigned_to: "",
                    due: "2026-12-18",
                    due_date: "2026-12-18",
                    before_photo: false,
                    after_photo: false,
                    before_photos: [],
                    after_photos: [],
                    action_content: "",
                    completed_date: "",
                    signature: null,
                    status: "IN_PROGRESS",
                    reassessed: false,
                    created: "2026-11-11",
                    history: [
                        { type: "NOTIFY", at: "2026-11-11 11:00", by: "공공시설사업소", memo: "수시평가(OCC-2026-10) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-12-18)" }
                    ]
                }
            ],

            /* 공문(온나라 이관) — 정기평가 결과 공문 2건(2024·2025, 결재완료). */
            seqDoc: 2,
            docs: [
                {
                    sid: "RD-1",
                    kind: "assessment",
                    target: "A|RA-2025-01",
                    aid: "RA-2025-01",
                    deptId: "",
                    no: "재난안전과-4127",
                    docType: "외부발송",
                    title: "2025년 정기 위험성평가 개선조치 완료 확인 결과 통보",
                    to: "수신자 참조(재난안전과장, 환경과장, 물순환사업소장, 공공시설사업소장)",
                    body: "1. 관련: 산업안전보건법 제36조에 따른 2025년 정기 위험성평가 결과 개선조치 이행 요청(재난안전과-2025-176)\n\n2. 위 호와 관련하여 2025년 정기 위험성평가에 따라 각 부서에 요청한 개선조치의 이행 결과를 확인하였기에 아래와 같이 통보합니다.\n\n  가. 대상 부서: 5개 부서(조치 요청 4개 부서: 재난안전과, 환경과, 물순환사업소, 공공시설사업소)\n\n  나. 개선조치: 10건(전 건 조치 완료 및 확인)\n\n  다. 확인 방법: 개선 전·후 사진 및 담당자 전자서명 대조\n\n3. 아울러 각 부서에서는 조치 완료 사항이 지속 유지될 수 있도록 관리하여 주시기 바랍니다.",
                    basis: ["osh-36"],
                    attach: [
                        { label: "부서별 개선조치 확인 결과표", auto: true },
                        { label: "개선 전·후 증빙 사진철", auto: true }
                    ],
                    files: [],
                    line: [
                        { uid: "u_jjt1", dept: "재난안전과", role: "중대재해팀장", name: "김중대" },
                        { uid: "u_safe1", dept: "재난안전과", role: "재난안전과장", name: "홍길동" }
                    ],
                    status: "결재완료",
                    at: "2025-11-10 14:20",
                    by: "박안전",
                    byUid: "u_jjt2",
                    sample: true,
                    log: [
                        { at: "2025-11-10 14:20", st: "결재중", by: "박안전", memo: "온나라 상신" },
                        { at: "2025-11-18 10:05", st: "결재완료", by: "온나라", memo: "생산등록번호 재난안전과-4127 · 결재일 2025-11-18" }
                    ]
                },
                {
                    sid: "RD-2",
                    kind: "assessment",
                    target: "A|RA-2024-01",
                    aid: "RA-2024-01",
                    deptId: "",
                    no: "재난안전과-3561",
                    docType: "외부발송",
                    title: "2024년 정기 위험성평가 개선조치 완료 확인 결과 통보",
                    to: "수신자 참조(환경과장, 물순환사업소장, 건설과장)",
                    body: "1. 관련: 산업안전보건법 제36조에 따른 2024년 정기 위험성평가 결과 개선조치 이행 요청(재난안전과-2024-163)\n\n2. 위 호와 관련하여 2024년 정기 위험성평가에 따라 각 부서에 요청한 개선조치의 이행 결과를 확인하였기에 아래와 같이 통보합니다.\n\n  가. 대상 부서: 4개 부서(조치 요청 3개 부서: 환경과, 물순환사업소, 건설과)\n\n  나. 개선조치: 6건(전 건 조치 완료 및 확인)\n\n  다. 확인 방법: 개선 전·후 사진 및 담당자 전자서명 대조\n\n3. 아울러 각 부서에서는 조치 완료 사항이 지속 유지될 수 있도록 관리하여 주시기 바랍니다.",
                    basis: ["osh-36"],
                    attach: [
                        { label: "부서별 개선조치 확인 결과표", auto: true },
                        { label: "개선 전·후 증빙 사진철", auto: true }
                    ],
                    files: [],
                    line: [
                        { uid: "u_jjt1", dept: "재난안전과", role: "중대재해팀장", name: "김중대" },
                        { uid: "u_safe1", dept: "재난안전과", role: "재난안전과장", name: "홍길동" }
                    ],
                    status: "결재완료",
                    at: "2024-10-14 15:00",
                    by: "박안전",
                    byUid: "u_jjt2",
                    sample: true,
                    log: [
                        { at: "2024-10-14 15:00", st: "결재중", by: "박안전", memo: "온나라 상신" },
                        { at: "2024-10-21 11:20", st: "결재완료", by: "온나라", memo: "생산등록번호 재난안전과-3561 · 결재일 2024-10-21" }
                    ]
                }
            ],

            /* 수시 위험성평가 (사유별 등록·검토) — 2025 4건 · 2026 10건. 최근 2건(11월)은 안전관리자 검토 전이다. */
            occasionals: [
                {
                    id: "OCC-2025-01",
                    year: 2025,
                    deptId: "water",
                    reason: "EQUIP_CHANGE",
                    date: "2025-02-18",
                    desc: "신계정수장 염소투입기 교체 · 신규 설비 위험성 평가",
                    files: [
                        { name: "염소투입기_사양서.pdf" },
                        { name: "설치_배치도.pdf" }
                    ],
                    status: "REVIEWED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "염소투입기 교체 후 배관 접속부 누출", cause: "신규 설비 누출감지기 미연동", action: "누출감지기 신규 설비 연동 및 비상 세안설비 위치 조정", owner: "물순환사업소 · 시설 담당 / 서담당", facilNo: "WS1996-0000011", facilNm: "신계정수장", facilNa: false, due: "2025-03-31" }
                    ],
                    hazardCount: 1,
                    reviewedAt: "2025-02-27",
                    reviewFile: "OCC-2025-01_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2025-02-19 10:30", by: "물순환사업소 서담당", memo: "수시평가 등록 (사유: 기계·설비·원재료 신규 도입·변경)" },
                        { type: "STATUS", at: "2025-02-19 10:30", by: "물순환사업소 서담당", memo: "위험성 감소대책 1건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2025-03-04 11:00", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2025-01_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2025-02",
                    year: 2025,
                    deptId: "construct",
                    reason: "ACCIDENT",
                    date: "2025-06-09",
                    desc: "도로 보수 중 콘크리트 절단기 칼날 접촉 · 손등 열상 경상 1명",
                    files: [
                        { name: "재해_현장_사진.jpg" },
                        { name: "경위서.hwpx" }
                    ],
                    status: "REVIEWED",
                    accident: "2025-06-09 14시경 군도 5호선 보수 현장에서 콘크리트 절단 작업 중 칼날 덮개가 탈락한 절단기에 손등을 베임(병원 치료 후 귀가) · 절단 작업 중지",
                    resumeDate: "2025-06-16",
                    hazards: [
                        { name: "콘크리트 절단기 칼날 접촉 절창", cause: "칼날 덮개 탈락 상태 사용", action: "절단기 칼날 덮개 교체, 방호장갑·보안면 지급 및 작업 전 점검표 운영", owner: "건설과 · 주무관 / 김도현", facilNo: "", facilNm: "", facilNa: false, due: "2025-06-30" }
                    ],
                    hazardCount: 1,
                    reviewedAt: "2025-06-13",
                    reviewFile: "OCC-2025-02_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2025-06-10 14:00", by: "건설과 김도현", memo: "수시평가 등록 (사유: 중대산업사고 또는 산업재해 발생)" },
                        { type: "STATUS", at: "2025-06-10 14:00", by: "건설과 김도현", memo: "위험성 감소대책 1건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2025-06-16 09:30", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2025-02_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2025-03",
                    year: 2025,
                    deptId: "facility",
                    reason: "METHOD",
                    date: "2025-09-03",
                    desc: "공공시설 외벽·바닥 청소에 고압세척기 사용 도입",
                    files: [
                        { name: "작업절차서_고압세척.hwpx" }
                    ],
                    status: "REVIEWED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "고압세척기 사용 중 미끄러짐·감전", cause: "습윤 바닥 · 누전차단기 없는 콘센트 사용", action: "이동식 누전차단기 배치 및 미끄럼 방지 장화 지급", owner: "공공시설사업소 · 주무관 / 한운영", facilNo: "AR2002-0000563", facilNm: "담양문화회관", facilNa: false, due: "2025-09-30" }
                    ],
                    hazardCount: 1,
                    reviewedAt: "2025-09-12",
                    reviewFile: "OCC-2025-03_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2025-09-04 09:40", by: "공공시설사업소 한운영", memo: "수시평가 등록 (사유: 작업방법·작업절차 신규 도입·변경)" },
                        { type: "STATUS", at: "2025-09-04 09:40", by: "공공시설사업소 한운영", memo: "위험성 감소대책 1건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2025-09-15 14:20", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2025-03_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2025-04",
                    year: 2025,
                    deptId: "env",
                    reason: "REPAIR",
                    date: "2025-12-02",
                    desc: "위생매립장 침출수 이송펌프 보수 · 집수정 진입 작업",
                    files: [
                        { name: "보수_작업계획서.hwpx" }
                    ],
                    status: "REVIEWED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "침출수 이송펌프 보수 중 질식", cause: "집수정 내부 환기 미확보", action: "집수정 진입 작업허가제 운영 및 산소·유해가스 농도 측정기 비치", owner: "환경과 · 유해·위험요인 담당 주무관 / 정환경", facilNo: "", facilNm: "", facilNa: false, due: "2026-01-16" }
                    ],
                    hazardCount: 1,
                    reviewedAt: "2025-12-10",
                    reviewFile: "OCC-2025-04_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2025-12-03 11:00", by: "환경과 정환경", memo: "수시평가 등록 (사유: 건설물·기계·설비 정비 또는 보수)" },
                        { type: "STATUS", at: "2025-12-03 11:00", by: "환경과 정환경", memo: "위험성 감소대책 1건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2025-12-12 10:00", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2025-04_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2026-01",
                    year: 2026,
                    deptId: "construct",
                    reason: "METHOD",
                    date: "2026-01-22",
                    desc: "제설작업 방식 변경 — 제설기 부착 덤프 운용·상차장 작업 절차 도입",
                    files: [
                        { name: "제설작업_절차서.hwpx" }
                    ],
                    status: "REVIEWED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "제설기 부착 덤프 후진 중 협착", cause: "후방 시야 확보 불량 · 유도자 없음", action: "제설 덤프 4대 후방카메라·후진경보기 설치 및 상차장 유도자 지정", owner: "건설과 · 주무관 / 이준호", facilNo: "", facilNm: "", facilNa: false, due: "2026-02-27" }
                    ],
                    hazardCount: 1,
                    reviewedAt: "2026-01-30",
                    reviewFile: "OCC-2026-01_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2026-01-23 09:30", by: "건설과 이준호", memo: "수시평가 등록 (사유: 작업방법·작업절차 신규 도입·변경)" },
                        { type: "STATUS", at: "2026-01-23 09:30", by: "건설과 이준호", memo: "위험성 감소대책 1건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2026-02-02 10:10", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2026-01_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2026-02",
                    year: 2026,
                    deptId: "env",
                    reason: "EQUIP_CHANGE",
                    date: "2026-03-10",
                    desc: "자원순환팀 신규 압축기 도입 · 위험성 재평가 필요",
                    files: [
                        { name: "설비사양서.pdf" }
                    ],
                    status: "REVIEWED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "신규 압축기 회전부 끼임 위험", cause: "방호덮개 미설치 상태 반입", action: "방호덮개 설치 및 비상정지 스위치 설치, 취급자 특별교육 실시", owner: "환경과 · 주무관 / 정수빈", facilNo: "", facilNm: "", facilNa: true, due: "2026-04-30" }
                    ],
                    hazardCount: 1,
                    reviewedAt: "2026-03-20",
                    reviewFile: "OCC-2026-02_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2026-03-11 14:00", by: "환경과 정수빈", memo: "수시평가 등록 (사유: 기계·설비·원재료 신규 도입·변경)" },
                        { type: "STATUS", at: "2026-03-11 14:00", by: "환경과 정수빈", memo: "위험성 감소대책 1건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2026-03-23 11:30", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2026-02_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2026-03",
                    year: 2026,
                    deptId: "facility",
                    reason: "REPAIR",
                    date: "2026-04-14",
                    desc: "담양군여성문화회관 지붕 방수 보수 공사",
                    files: [
                        { name: "보수_작업계획서.hwpx" },
                        { name: "현장_사진.jpg" }
                    ],
                    status: "REVIEWED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "지붕 방수 보수 작업 중 추락", cause: "지붕 단부 안전난간 없음", action: "지붕 단부 임시 안전난간 설치 및 안전대 부착설비 설치 후 작업", owner: "공공시설사업소 · 주무관 / 민설비", facilNo: "AR2002-0000559", facilNm: "담양군여성문화회관", facilNa: false, due: "2026-05-15" }
                    ],
                    hazardCount: 1,
                    reviewedAt: "2026-04-24",
                    reviewFile: "OCC-2026-03_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2026-04-15 10:20", by: "공공시설사업소 민설비", memo: "수시평가 등록 (사유: 건설물·기계·설비 정비 또는 보수)" },
                        { type: "STATUS", at: "2026-04-15 10:20", by: "공공시설사업소 민설비", memo: "위험성 감소대책 1건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2026-04-27 15:00", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2026-03_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2026-04",
                    year: 2026,
                    deptId: "water",
                    reason: "ACCIDENT",
                    date: "2026-05-20",
                    desc: "정수장 밸브실 작업 중 밸브 파손으로 수증기 분출 · 경상 1명",
                    files: [
                        { name: "재해_현장_사진.jpg" },
                        { name: "경위서.hwpx" }
                    ],
                    status: "REVIEWED",
                    accident: "2026-05-20 10시경 담양지방상수도 밸브실에서 노후 밸브 조작 중 밸브 몸체 파손 · 수증기 분출로 작업자 1명 팔 화상(경상) · 밸브실 작업 중지",
                    resumeDate: "2026-05-27",
                    hazards: [
                        { name: "밸브실 고압 배관 파손 시 수증기 분출", cause: "노후 밸브·차폐 부재", action: "노후 밸브 3개소 교체 및 작업 전 차단 절차 게시, 보호구 비치", owner: "물순환사업소 · 시설 담당 / 서담당", facilNo: "WS2008-0000016", facilNm: "담양지방상수도", facilNa: false, due: "2026-06-30" }
                    ],
                    hazardCount: 1,
                    reviewedAt: "2026-05-25",
                    reviewFile: "OCC-2026-04_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2026-05-21 11:10", by: "물순환사업소 서담당", memo: "수시평가 등록 (사유: 중대산업사고 또는 산업재해 발생)" },
                        { type: "STATUS", at: "2026-05-21 11:10", by: "물순환사업소 서담당", memo: "위험성 감소대책 1건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2026-05-26 09:40", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2026-04_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2026-05",
                    year: 2026,
                    deptId: "construct",
                    reason: "BUILDING",
                    date: "2026-07-08",
                    desc: "도로관리팀 자재창고 신축 · 적재 랙 설치",
                    files: [
                        { name: "창고_배치도.pdf" }
                    ],
                    status: "REVIEWED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "자재창고 신축 후 상부 적재물 낙하", cause: "랙 상단 낙하방지망 없음", action: "랙 상단 낙하방지망 설치 및 중량물 하단 적재 기준 게시", owner: "건설과 · 주무관 / 박서준", facilNo: "", facilNm: "", facilNa: false, due: "2026-08-31" },
                        { name: "자재창고 적재 랙 전도", cause: "랙 바닥 앵커 미고정", action: "적재 랙 12조 바닥 앵커 고정 및 최대 적재하중 표지 부착", owner: "건설과 · 주무관 / 박서준", facilNo: "", facilNm: "", facilNa: false, due: "2026-09-30" }
                    ],
                    hazardCount: 2,
                    reviewedAt: "2026-07-17",
                    reviewFile: "OCC-2026-05_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2026-07-09 15:00", by: "건설과 박서준", memo: "수시평가 등록 (사유: 건설물 설치·이전·변경·해체)" },
                        { type: "STATUS", at: "2026-07-09 15:00", by: "건설과 박서준", memo: "위험성 감소대책 2건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2026-07-20 10:30", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2026-05_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2026-06",
                    year: 2026,
                    deptId: "water",
                    reason: "REPAIR",
                    date: "2026-08-26",
                    desc: "담양하수종말처리장 반응조 산기관 교체 · 반응조 내부 진입",
                    files: [
                        { name: "산기관_교체_작업계획서.hwpx" }
                    ],
                    status: "REVIEWED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "반응조 산기관 교체 중 산소결핍", cause: "반응조 내부 환기·측정 절차 없음", action: "밀폐공간 작업허가제 적용, 송풍기·산소농도 측정기 비치 후 작업", owner: "물순환사업소 · 주무관 / 오수질", facilNo: "ST1999-0000017", facilNm: "담양하수종말처리장", facilNa: false, due: "2026-09-30" },
                        { name: "반응조 상부 점검발판 추락", cause: "점검발판 난간 부식·높이 미달", action: "반응조 상부 점검발판 난간 교체(H=1.2m) 및 발끝막이판 설치", owner: "물순환사업소 · 주무관 / 오수질", facilNo: "ST1999-0000017", facilNm: "담양하수종말처리장", facilNa: false, due: "2026-11-10" }
                    ],
                    hazardCount: 2,
                    reviewedAt: "2026-09-04",
                    reviewFile: "OCC-2026-06_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2026-08-27 10:00", by: "물순환사업소 오수질", memo: "수시평가 등록 (사유: 건설물·기계·설비 정비 또는 보수)" },
                        { type: "STATUS", at: "2026-08-27 10:00", by: "물순환사업소 오수질", memo: "위험성 감소대책 2건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2026-09-07 14:00", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2026-06_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2026-07",
                    year: 2026,
                    deptId: "safety",
                    reason: "EQUIP_CHANGE",
                    date: "2026-09-22",
                    desc: "군청 문화행복동 비상발전기 교체 · 배기관 경로 변경",
                    files: [
                        { name: "발전기_사양서.pdf" }
                    ],
                    status: "REVIEWED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "비상발전기 교체 후 배기관 화상", cause: "배기관 단열재·접근 방지 펜스 없음", action: "배기관 단열 피복 시공 및 접근 방지 펜스·고온주의 표지 설치", owner: "재난안전과 · 안전관리자 / 김안전", facilNo: "AR1997-0003452", facilNm: "담양군청(문화행복동)", facilNa: false, due: "2026-11-20" }
                    ],
                    hazardCount: 1,
                    reviewedAt: "2026-10-02",
                    reviewFile: "OCC-2026-07_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2026-09-23 16:20", by: "재난안전과 김안전", memo: "수시평가 등록 (사유: 기계·설비·원재료 신규 도입·변경)" },
                        { type: "STATUS", at: "2026-09-23 16:20", by: "재난안전과 김안전", memo: "위험성 감소대책 1건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2026-10-05 11:00", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2026-07_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2026-08",
                    year: 2026,
                    deptId: "env",
                    reason: "ACCIDENT",
                    date: "2026-10-15",
                    desc: "재활용선별장 컨베이어 이물 제거 중 손가락 끼임 · 경상 1명",
                    files: [
                        { name: "재해_현장_사진.jpg" },
                        { name: "경위서.hwpx" }
                    ],
                    status: "REVIEWED",
                    accident: "2026-10-15 15시경 재활용선별장에서 운전 중인 컨베이어의 이물을 손으로 제거하다 오른손 검지 끼임(골절 없음, 통원 치료) · 해당 라인 운전 중지",
                    resumeDate: "2026-10-27",
                    hazards: [
                        { name: "선별장 컨베이어 이물 제거 중 끼임", cause: "운전 중 손으로 이물 제거 · 정지 수단 멀리 있음", action: "작업 전 전원 차단·잠금(LOTO) 절차서 게시 및 이물 제거 전용 공구 비치", owner: "환경과 · 주무관 / 정수빈", facilNo: "", facilNm: "", facilNa: true, due: "2026-11-06" },
                        { name: "선별장 컨베이어 비상정지 수단 부족", cause: "비상정지 버튼 2개소뿐(작업 위치에서 6m)", action: "컨베이어 전 구간 비상정지 로프스위치 설치", owner: "환경과 · 주무관 / 정수빈", facilNo: "", facilNm: "", facilNa: true, due: "2026-11-30" }
                    ],
                    hazardCount: 2,
                    reviewedAt: "2026-10-23",
                    reviewFile: "OCC-2026-08_안전관리자검토_서명본.pdf",
                    reviewer: "한국안전기술원 안전관리자",
                    history: [
                        { type: "REGISTER", at: "2026-10-16 10:40", by: "환경과 정수빈", memo: "수시평가 등록 (사유: 중대산업사고 또는 산업재해 발생)" },
                        { type: "STATUS", at: "2026-10-16 10:40", by: "환경과 정수빈", memo: "위험성 감소대책 2건 등록 — 개선조치로 전환" },
                        { type: "REVIEW", at: "2026-10-26 09:30", by: "한국안전기술원 안전관리자", memo: "안전관리자 검토파일 등록 · OCC-2026-08_안전관리자검토_서명본.pdf → 검토 완료" }
                    ]
                },
                {
                    id: "OCC-2026-09",
                    year: 2026,
                    deptId: "env",
                    reason: "METHOD",
                    date: "2026-11-05",
                    desc: "생활폐기물 야간 수집(22시~05시) 도입 · 작업 절차 신규",
                    files: [
                        { name: "야간수집_작업계획서.hwpx" }
                    ],
                    status: "REGISTERED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "야간 수집작업 중 차량 접촉", cause: "야간 시인성 확보 수단 없음", action: "야간 수집 작업자 반사조끼·경광봉 지급 및 차량 후방 작업등 설치", owner: "환경과 · 주무관 / 김지도", facilNo: "", facilNm: "", facilNa: false, due: "2026-12-10" },
                        { name: "야간 수집 경로 노면 결빙 미끄러짐", cause: "야간 작업계획서에 노면 확인 절차 없음", action: "야간 작업계획서에 노면 상태 확인·작업중지 기준 반영 및 미끄럼 방지 안전화 지급", owner: "환경과 · 유해·위험요인 담당 주무관 / 정환경", facilNo: "", facilNm: "", facilNa: false, due: "2026-12-31" }
                    ],
                    hazardCount: 2,
                    reviewFile: "",
                    reviewer: "",
                    history: [
                        { type: "REGISTER", at: "2026-11-06 14:30", by: "환경과 정환경", memo: "수시평가 등록 (사유: 작업방법·작업절차 신규 도입·변경)" },
                        { type: "STATUS", at: "2026-11-06 14:30", by: "환경과 정환경", memo: "위험성 감소대책 2건 등록 — 개선조치로 전환" }
                    ]
                },
                {
                    id: "OCC-2026-10",
                    year: 2026,
                    deptId: "facility",
                    reason: "EQUIP_CHANGE",
                    date: "2026-11-10",
                    desc: "담양종합체육관 시설관리용 고소작업대 신규 도입",
                    files: [
                        { name: "고소작업대_사양서.pdf" }
                    ],
                    status: "REGISTERED",
                    accident: "",
                    resumeDate: "",
                    hazards: [
                        { name: "고소작업대 신규 도입 — 작업대 전도·끼임", cause: "전도방지 아웃트리거 설치 기준·조작자 지정 없음", action: "고소작업대 조작자 지정·교육 및 아웃트리거 설치 기준서 게시", owner: "", facilNo: "AR2008-0003610", facilNm: "담양종합체육관", facilNa: false, due: "2026-12-18" }
                    ],
                    hazardCount: 1,
                    reviewFile: "",
                    reviewer: "",
                    history: [
                        { type: "REGISTER", at: "2026-11-11 11:00", by: "공공시설사업소 한운영", memo: "수시평가 등록 (사유: 기계·설비·원재료 신규 도입·변경)" },
                        { type: "STATUS", at: "2026-11-11 11:00", by: "공공시설사업소 한운영", memo: "위험성 감소대책 1건 등록 — 개선조치로 전환" }
                    ]
                }
            ]
        };
    }

    function load() {
        if (db) return db;
        try {
            var raw = global.sessionStorage.getItem(SKEY);
            db = raw ? JSON.parse(raw) : seed();
        } catch (e) { db = seed(); }
        return db;
    }
    /* 증빙 사진(썸네일)이 들어오면서 저장 용량이 한계에 닿을 수 있다. 조용히 삼키면
       시연 중 데이터가 사라진 이유를 알 수 없으므로 실패를 화면에 알린다. */
    function save() {
        try { global.sessionStorage.setItem(SKEY, JSON.stringify(db)); }
        catch (e) {
            if (global.DYV2 && DYV2.toast) DYV2.toast('저장 공간이 가득 차 반영되지 않았습니다 — 사진 일부를 삭제해 주세요.');
        }
    }
    function reset() {
        db = seed(); save();
        /* 실습에서 올린 파일·위험성평가 알림도 함께 지운다 — 남겨 두면 없어진 평가를 가리키는
           알림이 알림함에 남는다. 알림 저장소(DYLayout)의 위험성평가 항목만 걷는다. */
        MEMF = {};
        try { global.sessionStorage.removeItem(FILEKEY); } catch (e) {}
        try {
            var NK = 'dy-ntf-dyn-v1';
            var all = JSON.parse(global.sessionStorage.getItem(NK) || '[]');
            global.sessionStorage.setItem(NK, JSON.stringify(all.filter(function (n) { return n.cat !== 'risk'; })));
        } catch (e) {}
        return db;
    }

    /* ================= 레거시 공정(processes) — 유지 ================= */
    function processes(targetId) {
        var d = load();
        return d.processes.filter(function (p) { return !targetId || p.targetId === targetId; })
            .sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
    }
    function processOf(id) { var d = load(); for (var i = 0; i < d.processes.length; i++) if (d.processes[i].id === id) return d.processes[i]; return null; }
    function addProcess(o) {
        var d = load(); d.seqProc++;
        var p = { id: 'PRC-' + String(1000 + d.seqProc).slice(-3), targetId: o.targetId, name: o.name, desc: o.desc || '',
            evaluator: o.evaluator || '', source: o.source || 'MANUAL', revision_no: 1, seq: o.seq || (processes(o.targetId).length + 1),
            equip: o.equip || [], hf: o.hf || [], hrf: o.hrf || [] };
        d.processes.push(p); save(); return p;
    }
    function saveProcess(p) { save(); return p; }
    function deleteProcess(id) { var d = load(); d.processes = d.processes.filter(function (p) { return p.id !== id; }); save(); }
    function nextHrfId() { var d = load(); d.seqHrf++; return 'h' + d.seqHrf; }
    function autoMapHRF(targetId, procName, equipIds, hfIds) {
        var ko = K(), ids = {};
        ko.lookupProcess(targetId, procName).forEach(function (id) { ids[id] = true; });
        (equipIds || []).forEach(function (eq) { (ko.LOOKUP_EQUIP[eq] || []).forEach(function (id) { ids[id] = true; }); });
        (hfIds || []).forEach(function (hf) { ko.lookupFactor(hf).forEach(function (id) { ids[id] = true; }); });
        return Object.keys(ids).map(function (id) {
            var s = ko.stdHrf(id);
            return { name: s.name, category: s.category, basis: s.basis, source: 'STD', legal_status: 'PENDING' };
        });
    }

    /* ================= 위험성평가 (정기) ================= */
    function assessments(year) {
        var d = load();
        return d.assessments.filter(function (a) { return a.type === 'REGULAR' && (!year || a.year === year); })
            .sort(function (a, b) { return b.year - a.year || (a.id < b.id ? 1 : -1); });
    }
    function assessmentOf(id) { var d = load(); for (var i = 0; i < d.assessments.length; i++) if (d.assessments[i].id === id) return d.assessments[i]; return null; }
    function assessmentYears() {
        var d = load(), s = {};
        d.assessments.forEach(function (a) { s[a.year] = true; });
        return Object.keys(s).map(Number).sort(function (a, b) { return b - a; });
    }
    /* 새 정기평가 생성 (마법사 결과 반영)
     *   o.depts:[{deptId, inspectDate, surveyFile}]  — "대상자 = 대상 부서" (v1.1 §6.4) */
    function addRegular(o) {
        var d = load(); d.seqAsmt++;
        var deptPayload = (o.depts || []).map(function (x) {
            return {
                deptId: x.deptId, inspectDate: x.inspectDate || '',
                surveyFile: x.surveyFile || '',
                reportFile: '',   /* 부서별 보고서 (2026-07-30 회의) — 아래 setDeptReport 참고 */
                status: 'BEFORE', deliveredAt: '', dueDate: '', hazards: []
            };
        });
        var deptCount = deptPayload.length;
        /* 설문 제출 기한(2026-11-11 2차 교육 반영안 ②) — 점검일(용역 방문일)과 다른 값이다.
           점검일은 부서에 알리는 일정이고, 설문 기한은 부서가 작성본을 내야 하는 마감이다. */
        var surveyDue = o.surveyDue || '';
        var a = {
            id: 'RA-' + o.year + '-' + String(10 + d.seqAsmt).slice(-2),
            year: o.year, type: 'REGULAR', status: 'IN_PROGRESS',
            title: o.year + '년 정기 위험성평가', createdAt: today(), surveyDue: surveyDue,
            targetId: '', scope: 'ALL', method: '4x4', team: [], worker_participation: false,
            change_reason: '', changed_processes: [], completed_at: '', approval: '',
            files: { surveyAll: o.surveyAll || '', report: '' },
            review: { stage: 'NONE', extractedAt: '', parsedDepts: {} },
            depts: deptPayload,
            history: [
                /* 생성만으로는 부서에 아무것도 가지 않는다 — 부서 요청은 설문조사표 요청 공문을
                   온나라로 보내는 순간이다(sendSurveyRequest). 종전 «생성 = 점검예정일 통보»는
                   공문 없이 알림만 가는 순서라 2차 교육 반영안과 맞지 않았다. */
                { type: 'CREATE', at: nowTs(), by: actorNow(),
                  memo: '정기평가 생성 · ' + deptCount + '개 부서 선정' + (surveyDue ? ' · 설문 제출 기한 ' + surveyDue : '') }
            ]
        };
        d.assessments.push(a); save(); return a;
    }
    function saveAssessment() { save(); }

    /* ===== 유해위험요인 설문조사표 첨부 (등록 이후 목록에서 첨부) =====
     * 생성 마법사에서 설문조사표 단계를 뺐으므로, 설문조사표는 평가가 만들어진 뒤
     * 목록에서 공통본(surveyAll) 또는 부서별본(dept.surveyFile)으로 붙인다.
     * 부서별본이 있으면 그것이 공통본을 대신한다(표시 규칙은 deptRow 참조). */
    function setSurveyAll(aid, fileName) {
        var a = assessmentOf(aid); if (!a) return null;
        a.files = a.files || {};
        a.files.surveyAll = fileName || '';
        pushHistory(aid, { type: 'FILE', by: actorNow(),
            memo: fileName ? '공통 유해위험요인 설문조사표 첨부 · ' + fileName : '공통 유해위험요인 설문조사표 삭제' });
        save(); return a;
    }
    function setDeptSurvey(aid, deptId, fileName) {
        var a = assessmentOf(aid); if (!a) return null;
        var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0];
        if (!dp) return null;
        dp.surveyFile = fileName || '';
        pushHistory(aid, { type: 'FILE', by: actorNow(),
            memo: deptName(deptId) + (fileName ? ' 부서 설문조사표 첨부 · ' + fileName : ' 부서 설문조사표 삭제(공통본 적용)') });
        save(); return dp;
    }
    /* ===== 부서 설문조사표 제출본 (필드명 reportFile · 2026-07-30 회의 확정) =====
     * ⚠ 이 필드가 담는 것은 **부서가 작성해 낸 설문조사표 작성본**이다. 용역업체 보고서는
     * 통합본 하나(`a.files.report`)뿐이고 부서별 보고서라는 것은 없다 — 화면 라벨을
     * '부서 보고서'로 쓰지 말 것(2026-08-14 정정, rsk-list.js deptFilesBar 주석 참고).
     * 아래 회의 기록은 이 필드가 처음 생긴 배경이다.
     * 용역업체 보고서는 **부서별로 쪼개진 한글 파일**로 오고, 그것을 합친 통합 PDF 가 따로 있다.
     * 회의 결론은 통합본 1건을 올려 시스템이 부서별로 자동 분배하는 방식이 아니라,
     * **처음부터 부서별로 나눠 올리는 것**이다 —
     *   참석자3 "애초에 부서별로 다 나눠가지고 한 번에 싹 올려야" →
     *   참석자1 "차라리 그게 나을 것 같죠? 그냥 그렇게 할게요 … 차라리 전체 파일 한 것보다"
     * 대상 부서는 앞 단계에서 **점검일(방문일)을 지정한 부서 목록을 그대로** 잇는다(발주처 389행).
     * 부서 사용자는 자기 부서 보고서만 열람한다 — 통합본 자동 분배(문서 파싱)는 기각된 안이다. */
    /* by — 누가 올렸는지. 부서 담당자가 자기 화면(내 할일)에서 제출하는 경로가 생겨서
       '재난안전과'로 못박아 두면 이력이 사실과 달라진다. */
    function setDeptReport(aid, deptId, fileName, by) {
        var a = assessmentOf(aid); if (!a) return null;
        var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0];
        if (!dp) return null;
        dp.reportFile = fileName || '';
        dp.reportAt = fileName ? today() : '';
        dp.reportBy = fileName ? (by || actorNow()) : '';
        pushHistory(aid, { type: 'FILE', by: by || actorNow(),
            memo: deptName(deptId) + (fileName ? ' 설문조사표 작성본 제출 · ' + fileName : ' 설문조사표 제출본 삭제') });
        save(); return dp;
    }
    /* 부서별 보고서 첨부 진행률 */
    function deptReportProgress(a) {
        var depts = (a && a.depts) || [];
        var done = depts.filter(function (dp) { return !!dp.reportFile; }).length;
        return { done: done, total: depts.length };
    }

    /* ===== 보고서 파일 첨부·교체 (개선 건수 확인 단계) =====
     * 검수·전달로 개선조치가 이미 추출·확정된 뒤(DELIVERED)에도 보고서(최종본·보완본)를
     * 첨부·교체할 수 있게 한다. uploadReport 와 달리 재파싱하지 않아 개선 건수·조치 내역은 보존된다. */
    function setReportFile(aid, fileName) {
        var a = assessmentOf(aid); if (!a) return null;
        a.files = a.files || {};
        a.files.report = fileName || '';
        pushHistory(aid, { type: 'FILE', by: actorNow(),
            memo: fileName ? '보고서 첨부·교체 · ' + fileName + ' (개선 건수·조치 내역 유지)' : '보고서 삭제' });
        save(); return a;
    }
    /* 설문조사표 첨부 진행률 — 부서별본 또는 공통본이 걸린 부서 수 */
    function surveyProgress(aid) {
        var a = assessmentOf(aid); if (!a) return { done: 0, total: 0, all: '' };
        var all = (a.files && a.files.surveyAll) || '';
        var depts = a.depts || [];
        var done = depts.filter(function (dp) { return dp.surveyFile || all; }).length;
        return { done: done, total: depts.length, all: all };
    }

    /* 오늘 기준 — DYV2.today() 단일 출처 (시연일 변경은 common.js DEMO_TODAY 한 줄) */
    function today() {
        if (global.DYV2 && global.DYV2.today) return global.DYV2.today();
        var t = new Date(); var mm = t.getMonth() + 1, dd = t.getDate();
        return t.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
    }
    /* 날짜는 기준일(DYV2.today) · 시각만 실제 시계 (§11)
       종전에는 날짜까지 실제 시각이라, 공문 상신일시가 2026-08-05 로 찍히는데
       같은 화면의 완료일·기한은 2026-07-16 기준이라 나란히 어긋나 보였다.
       이력의 '순서'에 필요한 건 시각이고, 날짜는 기준일을 따라야 한다. */
    function nowTs() {
        var t = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return today() + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
    }
    /* 이력에 남길 처리자 — 접속한 사람(부서 + 이름). 종전에는 '재난안전과' 를 박아 두어
       누가 생성·첨부했는지 이력에서 알 수 없었다. 접속 정보가 없을 때만 부서명으로 남긴다. */
    function actorNow() {
        var p = global.DYROLE && global.DYROLE.current ? global.DYROLE.current() : null;
        return p && p.name ? ((p.deptName ? p.deptName + ' ' : '') + p.name) : '재난안전과';
    }
    /* 알림 — 헤더 알림함(DYLayout.ntfPush). 받는 사람이 할 일이 있을 때만 보낸다(SCR-ADMIN-002 §4-1). */
    var OWNER = 'safety';
    function notify(o) {
        if (!global.DYLayout || !global.DYLayout.ntfPush) return;
        try { global.DYLayout.ntfPush(Object.assign({ cat: 'risk', catLabel: '위험성평가' }, o)); } catch (e) {}
    }
    /* 조치 담당자 라벨(«부서 · 역할 / 이름»)에서 사람 uid 를 되찾는다 — 그 부서 사람 중 이름이 같은 한 사람만.
       동명이인이거나 못 찾으면 null(부서 담당자 단위로 보낸다 — 이름으로 엉뚱한 사람에게 보내지 않는다). */
    function ownerUid(m) {
        var label = String((m && m.assigned_to) || ''); if (!label) return null;
        var nm = label.split('/').pop().trim();
        var ms = (global.DYV2 && global.DYV2.orgMembers ? global.DYV2.orgMembers(m.dept_id) : []).filter(function (x) { return x.name === nm; });
        return ms.length === 1 ? ms[0].uid : null;
    }
    /* ===== 이 세션에 올린 파일 — 내려받기 (양식 받기 실습) =====
       실제 파일 보관은 첨부 저장 연계 몫이다. 시연·실습 확인용으로 작은 파일(1MB 이하)만
       이 브라우저 세션에 담아 두고, 없으면 받은 척하지 않는다(이행점검 DEPTCHK 와 같은 방식). */
    var FILEKEY = 'dy-rsk-files-v1', MEMF = {};
    function fileStore() { try { return JSON.parse(global.sessionStorage.getItem(FILEKEY) || '{}'); } catch (e) { return {}; } }
    function stashFile(name, file) {
        if (!name || !file) return false;
        MEMF[name] = file;
        if (file.size > 1024 * 1024 || !global.FileReader) return true;
        var r = new FileReader();
        r.onload = function () {
            var st = fileStore(); st[name] = r.result;
            try { global.sessionStorage.setItem(FILEKEY, JSON.stringify(st)); } catch (e) {}
        };
        r.readAsDataURL(file);
        return true;
    }
    /* 조치기한 재촉 알림 — 받는 사람은 조치 담당자, 담당자를 찾지 못하면 그 부서 담당자(SCR-ADMIN-002 §4-1).
       정기·수시 두 화면의 [재촉]이 같은 알림을 낸다. 담당자가 없을 때의 «부서 담당자»는
       DYADM.deptContacts 순서(부서 안전보건 담당자 → 부서장 → 없음)다(2026-11-13 답신 1-2·5장).
       종전에는 부서 실무자 등급 전체로 보내 다른 독촉과 받는 사람이 갈렸다. DYADM 이 없는 화면만 종전대로. */
    function remindNotify(m, by) {
        if (!m) return;
        var uid = ownerUid(m);
        var aa = m.assessment_id ? (assessmentOf(m.assessment_id) || {}) : null;
        var to = uid ? { toUids: [uid] } : { toDept: m.dept_id, toTier: ['staff'] };
        if (!uid && global.DYADM && global.DYADM.deptContacts) {
            var cu = inputRemindTo(m.dept_id).uids;
            if (!cu.length) return;   /* 담당자·부서장 미등록 — 받는 사람 없음(화면이 그 사실을 밝힌다) */
            to = { toUids: cu };
        }
        notify(Object.assign(to, {
            basis: 'osh-36',
            title: '위험성평가 조치기한 재촉 — ' + ((m.hazard && m.hazard.name) || '') +
                ' (기한 ' + (m.due || m.due_date || '-') + (by ? ' · ' + by : '') + ')',
            href: aa ? 'rsk-list.html?year=' + (aa.year || '') + '&dept=' + m.dept_id : 'rsk-occ.html',
            work: 'my-work.html?cat=improve' }));
    }
    function hasFile(name) { return !!(name && (MEMF[name] || fileStore()[name])); }
    function downloadFile(name) {
        if (!name) return false;
        var url = MEMF[name] ? URL.createObjectURL(MEMF[name]) : fileStore()[name];
        if (!url) return false;
        var a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        return true;
    }

    /* 평가 전체 진행률 (개선조치 완료건/총 개선조치건) */
    function assessmentProgress(aid) {
        var ms = improvementsFor(aid);
        var done = ms.filter(function (m) { return m.status === 'DONE'; }).length;
        return { total: ms.length, done: done, pct: ms.length ? Math.round(done / ms.length * 100) : 0 };
    }
    /* 부서 단위 개선건수 N/M */
    function deptImpCount(aid, deptId) {
        var ms = improvementsFor(aid).filter(function (m) { return m.dept_id === deptId; });
        var done = ms.filter(function (m) { return m.status === 'DONE'; }).length;
        return { total: ms.length, done: done };
    }
    /* 전 부서 조치완료 시 평가 상태 자동 완료
     * 부서 status 규칙:
     *   - 전달 전(deliveredAt 없음) → BEFORE
     *   - 전달됨·개선건 0건(지적사항 없음) → DONE (deliverFromReview에서 이미 설정, 재확인)
     *   - 전달됨·전 개선조치 완료 → DONE
     *   - 전달됨·남은 미완료 있음 → BEFORE
     * 완료 판정: 개선건이 있는 부서(actionable) 기준으로만 판단.
     *   → 지적사항 없는 부서(c.total===0)는 완료 판정·집계에서 제외. */
    function refreshAssessmentStatus(aid) {
        var a = assessmentOf(aid); if (!a) return;
        if (a.status === 'COMPLETED') return;
        if (!a.depts || !a.depts.length) return;
        a.depts.forEach(function (dp) {
            var c = deptImpCount(aid, dp.deptId);
            if (!dp.deliveredAt) { dp.status = 'BEFORE'; return; }
            /* 조치 요청을 받은 부서는 «입력 완료» 전까지 끝나지 않는다 — 입력 0건이 «아직 안 씀»일 수 있다 */
            if (dp.request && !dp.inputDone) { dp.status = 'BEFORE'; return; }
            dp.status = (c.total === 0 || c.done === c.total) ? 'DONE' : 'BEFORE';
        });
        var actionable = a.depts.filter(function (dp) {
            return deptImpCount(aid, dp.deptId).total > 0;
        });
        var pendingInput = a.depts.some(function (dp) { return dp.request && !dp.inputDone; });
        /* 개선조치가 0건인 평가도 끝나야 한다(2026-11-13 결정 D-1) — 재난안전과가 «조치 대상 없음»으로
           종결했거나(closeNoAction), 요청받은 부서가 모두 0건으로 입력 완료한 경우다. 종전에는 개선조치가
           1건 이상이어야 완료돼, 조치할 것이 없는 평가는 끝낼 길이 없었다. 전 부서가 조치 요청 단계를
           지났을 때(deliveredAt)만 0건 완료로 본다 — 보고서 전 평가가 0건이라 끝나면 안 된다. */
        var allDelivered = a.depts.every(function (dp) { return !!dp.deliveredAt; });
        var allDone = !pendingInput && (actionable.length > 0 || allDelivered) &&
            actionable.every(function (dp) { return dp.status === 'DONE'; });
        if (allDone) {
            a.status = 'COMPLETED';
            a.completed_at = today();
            a.history = a.history || [];
            a.history.push({ type: 'COMPLETE', at: nowTs(), by: '시스템', memo: actionable.length
                ? '전 부서 조치 완료 — 완료 확인을 마치면 평가 완료'
                : (a.noAction ? '조치 대상 없음 — 평가 종결' : '요청받은 부서가 모두 조치할 것 없음으로 입력 완료 — 조치 대상 없음으로 평가 완료') });
        }
        save();
    }

    /* 이력 append */
    function pushHistory(aid, entry) {
        var a = assessmentOf(aid); if (!a) return;
        a.history = a.history || [];
        a.history.push({ type: entry.type, at: entry.at || nowTs(), by: entry.by || '', memo: entry.memo || '' });
        save();
    }

    /* ================= 부서별 개선조치 작성 (2026-07-30 회의로 전면 변경) =================
     * 종전에는 보고서를 올리면 **시스템이 파싱해 항목을 화면에 펼치는** 방식이었다.
     * 발주처가 그 화면을 보고 직접 없애라고 했다:
     *   "이거 정말 마음에 들고 예쁜데 **페이지가 많아 버리면 답도 없어져요**"                (녹취 218)
     *   "지금 파일 입력을 넣은 거잖아요 … 그러지 말고 **이거 없애버리고** 보고서를 직접
     *    들어가게끔 버튼을 눌러주세요. 차라리 눌러가지고 그 사람이 한글 파일 나올 거 아니에요?" (220~221)
     *   "이렇게 내용을 하지만은 **복잡하니까** 그냥 파일로 첨부돼 있는 걸 눌러서 지들이
     *    작성해서 조치할 수 있는 버튼까지"                                                  (233)
     *   "**이런 거 아예 없이** 부서만 딱 있고 부서를 클릭했을 때"                            (292)
     * 대신 무엇을 하느냐도 정해졌다 — **담당자가 부서별로 직접 적는다**:
     *   참석자3 "조치해야 할 부서가 너희 부서다라고 지적해 주는 것까지는 니가 해야 되는 거"  (237)
     *   참석자1 "예 맞습니다. **보고서를 여기에다 적는 거는 제가 합니다**"                    (240)
     *   참석자4 "개선 조치 사항을 각각의 입력하게 만들고 **추가 추가해 가지고 만들게** 하고"  (355)
     * 그래서 파싱을 걷어내고, 부서별로 빈 목록에서 [＋행 추가]로 작성하는 방식만 남긴다.
     * 보고서 원문은 부서 행의 [부서 보고서]에서 열어 보며 참고한다.
     * ※ reportParseMock 시드는 삭제하지 않고 남겨 둔다 — 되살리기 위해서가 아니라,
     *   기존 세션 데이터와의 호환·이력 추적을 위해서다. 다시 파싱에 쓰지 말 것. */
    /* ===== 보고서 + 조치기한 (2026-11-11 2차 교육 반영안 ⑤) =====
     * 보고서를 올리면서 **조치기한을 함께** 정한다(일괄 + 부서별). 종전에는 보고서를 올리면
     * 재난안전과 작성표가 열리고 기한은 작성이 끝난 뒤에 정해, 부서가 기한을 모른 채 일했다.
     * 작성표는 조치 요청 뒤에 열린다 — 유해위험요인·조치 내용은 **부서가 보고서를 보고 직접** 적는다
     * (setInputDone → commitDeptRows). 재난안전과는 어느 부서에 개선이 필요한지만 골라 공문으로 요청한다.
     * stage: NONE(보고서 전) → REVIEW(보고서·기한 등록, 요청 전) → DELIVERED(조치 요청 공문 보냄). */
    function uploadReport(aid, fileName, dues) {
        var a = assessmentOf(aid); if (!a) return null;
        /* 순서 ③④ → ⑤ — 설문조사표 요청 공문 전에는 받지 않는다. 화면이 버튼을 잠가도 전역 호출로 뚫리지 않게 */
        if (!surveyRequested(a)) return { error: '설문조사표 요청 공문을 보낸 뒤에 보고서를 첨부합니다.' };
        dues = dues || {};
        /* 조치기한은 부서에 주는 기한이다 — 지난 날짜면 요청받는 순간 기한 경과다(화면과 같은 판정) */
        var t0 = today();
        var past = (a.depts || []).some(function (dp) {
            var v = (dues.deptDues && dues.deptDues[dp.deptId]) || dues.bulkDue || '';
            return !!v && v < t0;
        });
        if (past) return { error: '조치기한은 오늘(' + t0 + ') 이후로 정합니다.' };
        a.files = a.files || {}; a.files.report = fileName || (a.year + '_정기평가_보고서.hwpx');
        (a.depts || []).forEach(function (dp) {
            dp.dueDate = (dues.deptDues && dues.deptDues[dp.deptId]) || dues.bulkDue || dp.dueDate || '';
        });
        a.review = { stage: 'REVIEW', extractedAt: nowTs(), parsedDepts: {} };
        a.history = a.history || [];
        a.history.push({ type: 'STATUS', at: nowTs(), by: actorNow(),
            memo: '보고서 첨부 · 조치기한 설정 (' + (dues.bulkDue ? '일괄 ' + dues.bulkDue : '부서별') + ')' });
        save();
        return { deptCount: (a.depts || []).length };
    }
    /* 요청 전(REVIEW)에만 부서별 기한을 고친다 — 요청 뒤에는 개선조치마다 연장으로 바꾼다 */
    function setDeptDue(aid, deptId, due) {
        var a = assessmentOf(aid); if (!a || !a.review || a.review.stage !== 'REVIEW') return null;
        var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0];
        if (!dp) return null;
        if (due && due < today()) return null;   /* 지난 날짜 기한은 받지 않는다(uploadReport 와 같은 판정) */
        dp.dueDate = due || '';
        save(); return dp;
    }

    /* ===== 설문조사표 요청 공문 (반영안 ③) =====
     * 양식을 붙이는 것과 부서에 요청하는 것은 다른 행위다 — 양식을 고쳐 올릴 때마다 부서에
     * 알림이 가면 안 된다. 요청은 **공문을 온나라로 보내는 순간** 한 번이고, 보낸 뒤에는
     * 양식을 바꾸지 않는다(바꾸려면 새 평가 · 이력이 갈린다). */
    function surveyRequested(a) { return !!(a && a.surveyReq && a.surveyReq.at); }
    /* 설문 제출 기한이 지났는데 아직 안 낸 부서 — 보고서 등록 전이면 **그대로 받는다**(2026-11-13 답신 2-5).
       기한은 막는 값이 아니라 «기한 지남» 표시에만 쓴다. 기한 임박·초과 알림은 만들지 않는다. */
    function surveyLate(a, dp) {
        if (!a || !dp || dp.reportFile || !a.surveyDue || !surveyRequested(a)) return false;
        if (a.status === 'COMPLETED' || ((a.review && a.review.stage) || 'NONE') !== 'NONE') return false;
        return a.surveyDue < today();
    }
    function sendSurveyRequest(aid, doc, by) {
        var a = assessmentOf(aid); if (!a) return null;
        a.surveyReq = { at: today(), by: by || actorNow(), docs: (a.surveyReq && a.surveyReq.docs || []).concat(doc ? [doc] : []) };
        pushHistory(aid, { type: 'NOTIFY', by: by || actorNow(),
            memo: (a.depts || []).length + '개 부서에 설문조사표 요청 공문 발송' + (a.surveyDue ? ' (제출 기한 ' + a.surveyDue + ')' : '') +
                (doc && doc.no ? ' · 연계 번호 ' + doc.no : '') });
        save(); return a;
    }

    /* ===== 부서별 조치 요청 공문 (반영안 ⑥) =====
     * 고른 부서에만 요청이 가고, 고르지 않은 부서는 «지적사항 없음»으로 그 자리에서 닫힌다 —
     * 사람이 «요청 안 함»을 고른 것이 곧 판정이다(종전 deliverFromReview 의 0건 부서 처리와 같은 결과).
     * 개선조치는 여기서 만들지 않는다 — 부서가 작성표를 쓰고 [입력 완료]할 때 생긴다(commitDeptRows). */
    function requestAction(aid, deptIds, doc, by) {
        var a = assessmentOf(aid); if (!a || !a.review || a.review.stage !== 'REVIEW') return null;
        var sel = {}; (deptIds || []).forEach(function (id) { sel[id] = true; });
        var asked = 0, none = 0;
        (a.depts || []).forEach(function (dp) {
            dp.deliveredAt = today();
            if (sel[dp.deptId]) {
                dp.request = { at: today(), by: by || actorNow(), no: (doc && doc.no) || '' };
                dp.noFindings = false; dp.inputDone = null; dp.status = 'BEFORE';
                asked++;
            } else {
                dp.request = null; dp.noFindings = true; dp.status = 'DONE'; dp.dueDate = '';
                pushHistory(aid, { type: 'REVIEW', by: by || actorNow(), memo: deptName(dp.deptId) + ' — 지적사항 없음(조치 요청 대상 아님)' });
                none++;
            }
        });
        a.review.stage = 'DELIVERED';
        a.actionReq = { at: today(), by: by || actorNow(), depts: Object.keys(sel), docs: (a.actionReq && a.actionReq.docs || []).concat(doc ? [doc] : []) };
        pushHistory(aid, { type: 'DELIVER', by: by || actorNow(),
            memo: asked + '개 부서에 조치 요청 공문 발송' + (none ? ' · 지적사항 없는 ' + none + '개 부서 완료' : '') +
                (doc && doc.no ? ' · 연계 번호 ' + doc.no : '') });
        refreshAssessmentStatus(aid);
        return { asked: asked, none: none };
    }
    function deptOf(a, deptId) { return ((a && a.depts) || []).filter(function (x) { return x.deptId === deptId; })[0] || null; }
    /* 이 부서가 지금 유해위험요인을 입력할 수 있는가 — 요청을 받았고 «입력 완료» 전 */
    function inputOpen(aid, deptId) {
        var a = assessmentOf(aid), dp = deptOf(a, deptId);
        return !!(a && a.status !== 'COMPLETED' && dp && dp.request && !dp.inputDone);
    }
    /* ===== 부서 직접 작성 (반영안 ⑦) — 기존 작성표를 그 부서가 쓴다 =====
     * 작성표(부서 블록 + [＋ 행 추가])는 그대로다. 바뀐 것은 **언제·누가**뿐이다 — 조치 요청을
     * 받은 뒤 그 부서 담당자가 적고, [입력 완료]를 누르는 순간 그 부서의 유효 행이 개선조치가 된다
     * (종전 전 부서 일괄 «전달»을 부서 단위로 쪼갠 것). 행 채택 조건·승계 필드는 deliverFromReview 와 같다. */
    function validDeptRows(a, deptId) {
        var pd = (a && a.review && a.review.parsedDepts) || {};
        return (pd[deptId] || []).filter(function (r) { return !r.deleted && (r.name || '').trim() && (r.action || '').trim(); });
    }
    function commitDeptRows(aid, deptId, by) {
        var a = assessmentOf(aid), dp = deptOf(a, deptId); if (!dp) return 0;
        var rows = validDeptRows(a, deptId), deptNm = deptName(deptId), due = dp.dueDate || '';
        dp.hazards = rows.map(function (r) { return { name: r.name.trim(), category: r.category || '', cause: r.cause || '', basis: r.basis || '', action: r.action.trim(), facilNo: r.facilNo || '', facilNm: r.facilNm || '', facilNa: !!r.facilNa }; });
        rows.forEach(function (r) {
            var beforeF = (r.beforePhotos || []).slice(), afterF = (r.afterPhotos || []).slice();
            var before = beforeF.map(function (f) { return f.name; }), after = afterF.map(function (f) { return f.name; });
            var alreadyDone = !!r.done && after.length > 0;
            var hist = [{ type: 'REGISTER', at: nowTs(), by: by || (deptNm + ' 담당자'), memo: '부서 작성 · 입력 완료 (기한 ' + (due || '미지정') + ')' + basisMemo(r.basis) }];
            if (alreadyDone) hist.push({ type: 'STATUS', at: nowTs(), by: r.owner || (deptNm + ' 담당자'), memo: '작성 단계에서 조치 완료로 확인됨 · 개선 후 사진 ' + after.length + '건' });
            addImprovement({
                source_type: 'risk_assessment', assessment_id: aid, dept_id: deptId,
                hazard: { name: r.name.trim(), category: r.category || '', cause: r.cause || '', basis: r.basis || '',
                          facilNo: r.facilNo || '', facilNm: r.facilNm || '', facilNa: !!r.facilNa },
                description: r.action.trim(), action: r.action.trim(), due: due, due_date: due,
                assigned_to: r.owner || '',
                before_photo: before.length ? before.join(', ') : false, after_photo: after.length ? after.join(', ') : false,
                before_photos: beforeF, after_photos: afterF,
                completed_date: alreadyDone ? (r.doneAt || today()) : '',
                signature: alreadyDone ? { by: r.owner || (deptNm + ' 담당자'), at: r.doneAt || today() } : null,
                status: alreadyDone ? 'DONE' : 'IN_PROGRESS', reassessed: alreadyDone, created: today(), history: hist
            });
        });
        return rows.length;
    }
    /* 입력 완료 — 행이 0건이면 «아직 안 씀»과 «쓸 게 없음»을 가를 수 없어 부서가 알린다.
       0건으로 끝내려면 사유가 필요하다(이행점검 «해당없음은 사유 없이 저장하지 않는다»와 같은 근거). */
    /* workers — 그 부서에서 위험성평가에 참여한 근로자 [{uid, name, role}] (2026-11-13 결정 D-6).
       시행규칙 §37의4①2호가 기록에 «참여한 근로자 및 근로자대표»를 넣으라고 한다. 순회점검·설문에
       참여한 사람이 늘 있으므로 0건 입력 완료에도 1명 이상 받는다. workersNote — 조직도에 없는
       참여자(근로자대표·공무직 등)를 적는 칸(선택). */
    function setInputDone(aid, deptId, by, reason, workers, workersNote) {
        var a = assessmentOf(aid), dp = deptOf(a, deptId);
        if (!inputOpen(aid, deptId)) return { error: '입력 중인 부서가 아닙니다.' };
        var n = validDeptRows(a, deptId).length;
        var r = String(reason || '').trim();
        if (!n && !r) return { error: '작성한 유해위험요인이 없습니다 — 조치할 것이 없으면 사유를 적으세요.' };
        var ws = (workers || []).filter(function (w) { return w && (w.uid || w.name); })
            .map(function (w) { return { uid: w.uid || '', name: w.name || '', role: w.role || '' }; });
        if (!ws.length) return { error: '위험성평가에 참여한 근로자를 1명 이상 고르세요.' };
        commitDeptRows(aid, deptId, by);
        notifyRowOwners(a, deptId);
        dp.inputDone = { at: today(), by: by || '', reason: n ? '' : r, count: n, workers: ws, workersNote: String(workersNote || '').trim() };
        if (!n) dp.noFindings = true;
        pushHistory(aid, { type: 'STATUS', by: by || deptName(deptId),
            memo: deptName(deptId) + ' 조치 입력 완료 · ' + (n ? n + '건' : '조치 대상 없음 — ' + r) + ' · 참여 근로자 ' + ws.length + '명' });
        refreshAssessmentStatus(aid);
        return dp;
    }
    /* 작성표 행 담당자 알림 — 입력 완료 순간 한 번(2026-11-13 답신 2-1). 작성 중에 행에 담당자를 적어도
       보내지 않는다 — 그때는 개선조치가 아직 없어, 받은 사람이 열 건이 없다. 입력 완료로 생긴 개선조치 중
       담당자가 있는 건마다 그 사람에게 «개선조치 담당자 지정»을 보낸다(본인 지정은 제외). 담당자 라벨로
       사람을 찾지 못하면(동명이인 등) 보내지 않는다 — 이름으로 엉뚱한 사람에게 보내지 않는다(ownerUid).
       입력 완료를 취소했다가 다시 완료하면 개선조치가 새로 생기므로 그때 다시 보낸다. */
    function notifyRowOwners(a, deptId) {
        var me = global.DYROLE && global.DYROLE.current ? (global.DYROLE.current() || {}).uid : '';
        improvementsFor(a.id, deptId).forEach(function (m) {
            var uid = ownerUid(m);
            if (!uid || uid === me) return;
            notify({ toUids: [uid], basis: 'osh-36',
                title: a.year + '년 정기 위험성평가 — 개선조치 담당자 지정: ' + ((m.hazard && m.hazard.name) || '') +
                    ' (조치기한 ' + (m.due || m.due_date || '-') + ')',
                href: 'rsk-list.html?year=' + a.year + '&dept=' + deptId, work: 'my-work.html?cat=improve' });
        });
    }
    function undoInputDone(aid, deptId, by) {
        var a = assessmentOf(aid), dp = deptOf(a, deptId);
        if (!a || !dp || !dp.inputDone || a.status === 'COMPLETED') return { error: '되돌릴 입력 완료가 없습니다.' };
        /* 되돌리면 그 부서 개선조치를 거두고 작성표로 돌아간다 — 완료 처리한 건이 있으면 되돌리지 않는다
           (사진·서명이 붙은 기록을 지우게 된다). 작성표 행은 지우지 않았으므로 그대로 다시 열린다. */
        var ms = improvementsFor(aid, deptId);
        if (ms.some(function (m) { return m.status === 'DONE'; })) return { error: '완료 처리한 개선조치가 있어 되돌릴 수 없습니다.' };
        var d0 = load(); d0.improvements = d0.improvements.filter(function (m) { return !(m.assessment_id === aid && m.dept_id === deptId); });
        dp.inputDone = null; dp.noFindings = false; dp.status = 'BEFORE';
        pushHistory(aid, { type: 'REOPEN', by: by || deptName(deptId), memo: deptName(deptId) + ' 조치 입력 완료 취소 — 다시 입력 중' });
        refreshAssessmentStatus(aid);
        return dp;
    }
    /* 부서 줄 상태 — 화면 네 곳(부서 표·조회 표·내 부서 진행·내 할일)이 같은 말을 하게 한다.
       조치 요청 전 / 조치전(입력 0건) / 조치중 / 반려 / 완료 / 지적사항 없음 */
    function deptStage(a, dp) {
        if (!a || !dp) return '';
        if (dp.noFindings && !improvementsFor(a.id, dp.deptId).length) return '지적사항 없음';
        if (!dp.deliveredAt) return '조치 요청 전';
        var ms = improvementsFor(a.id, dp.deptId);
        if (ms.some(function (m) { return confirmState(m) === CFM_RETURN; })) return '반려';
        var legacy = !dp.request;   /* 옛 흐름(작성표 전달)으로 끝난 평가 */
        if (!ms.length) return legacy ? '지적사항 없음' : (validDeptRows(a, dp.deptId).length ? '조치중' : '조치전');
        var allDone = ms.every(function (m) { return m.status === 'DONE'; });
        var allOk = ms.every(function (m) { return confirmState(m) === CFM_OK; });
        if (allDone && allOk && (legacy || dp.inputDone)) return '완료';
        return '조치중';
    }

    /* ================= 2026-11-13 결정 (개발 전달 §5 D-1·D-2·D-3·D-4·D-6) ================= */

    /* ===== D-1 평가 종결 — 조치 대상 없음 =====
     * 보고서상 개선이 필요한 부서가 한 곳도 없으면 조치 요청 공문(1곳 이상)을 보낼 수 없어 평가를
     * 끝낼 길이 없었다. 재난안전과가 사유를 적고 종결하면 전 부서가 «지적사항 없음»으로 닫히고
     * 평가가 끝난다(개선조치 0건 — 확인할 것이 없다). 부서에는 할 일·알림을 보내지 않는다.
     * 결과 공문은 «조치 대상 없음» 보고로 낸다(docReady). 종결은 되돌리지 않는다. */
    function closeNoAction(aid, reason, by) {
        var a = assessmentOf(aid);
        if (!a || a.status === 'COMPLETED') return { error: '진행 중인 평가가 아닙니다.' };
        if (!a.review || a.review.stage !== 'REVIEW') return { error: '평가 종결은 보고서를 등록한 뒤 · 조치 요청 공문을 보내기 전에 합니다.' };
        var r = String(reason || '').trim();
        if (!r) return { error: '종결 사유를 적으세요.' };
        by = by || actorNow();
        (a.depts || []).forEach(function (dp) {
            dp.deliveredAt = today(); dp.request = null; dp.noFindings = true; dp.status = 'DONE'; dp.dueDate = '';
        });
        a.review.stage = 'DELIVERED';
        a.noAction = { at: today(), by: by, reason: r };
        pushHistory(aid, { type: 'REVIEW', by: by,
            memo: (a.depts || []).length + '개 부서 모두 지적사항 없음 — 조치 요청 없이 평가 종결 (사유: ' + r + ')' });
        refreshAssessmentStatus(aid);
        return a;
    }

    /* ===== D-2 입력 미완료 재촉 =====
     * 작성(입력 완료) 기한은 따로 두지 않는다 — 조치기한이 곧 작성 마감이다. 대신 조치 요청을 받고
     * 아직 [입력 완료]를 누르지 않은 부서를 재촉한다. 받는 사람은 그 부서 담당자(DYADM.deptContacts —
     * 부서 안전보건 담당자 → 부서장 → 없음 · 2026-11-13 답신 1-2). 발신자는 실제 접속자(by). 권한 판정은 화면이 한다
     * (DYROLE.canRemind — 이 계층은 역할을 보지 않는다, confirmImprovement 와 같은 분담). */
    function inputRemindTo(deptId) {
        var c = (global.DYADM && global.DYADM.deptContacts) ? global.DYADM.deptContacts(deptId) : null;
        var text = (global.DYADM && global.DYADM.contactText) ? global.DYADM.contactText(deptId) : '부서 담당자';
        return { uids: c ? (c.people || []).map(function (p) { return p.uid; }).filter(Boolean) : [], text: text, none: !!c && c.kind === 'none' };
    }
    function remindInput(aid, deptId, by) {
        var a = assessmentOf(aid), dp = deptOf(a, deptId);
        if (!a || !dp || !inputOpen(aid, deptId)) return { error: '입력 중인 부서가 아닙니다 — 입력 완료 전 부서만 재촉합니다.' };
        by = by || actorNow();
        var to = inputRemindTo(deptId);
        dp.inputReminds = (dp.inputReminds || []).concat([{ at: nowTs(), by: by, to: to.text }]);
        if (to.uids.length) notify({ toUids: to.uids, basis: 'osh-36',
            title: a.year + '년 정기 위험성평가 조치 입력 재촉 — 우리 부서 개선조치를 작성표에 적고 [입력 완료]를 눌러 주세요(조치기한 ' + (dp.dueDate || '-') + ' · ' + by + ')',
            href: 'rsk-list.html?year=' + a.year + '&dept=' + deptId, work: 'my-work.html?cat=risk' });
        pushHistory(aid, { type: 'REMIND', by: by,
            memo: deptName(deptId) + ' 조치 입력 재촉 (조치기한 ' + (dp.dueDate || '-') + ') · 받는 사람 ' + to.text });
        save();
        return { count: dp.inputReminds.length, to: to.text, none: to.none };
    }

    /* ===== D-3 추가 조치 요청 공문 =====
     * 조치 요청 뒤 빠뜨린 부서를 알게 되면, «지적사항 없음»으로 닫힌(요청을 받지 않은) 부서에 한해
     * **평가당 한 번** 더 요청한다. 같은 공문 모양(RSKREQ)이고 보내는 순간 그 부서가 «조치전»이 되어
     * ⑥ 과 똑같이 할 일·알림이 생긴다. 결과 공문을 보낸 뒤에는 하지 않는다(그 공문의 결과표가 어긋난다).
     * 평가가 이미 끝난 상태(저장 COMPLETED)면 다시 진행으로 돌린다 — 새로 요청받은 부서가 할 일이 있다. */
    function moreCandidates(a) {
        return ((a && a.depts) || []).filter(function (dp) { return !!dp.deliveredAt && !dp.request && !!dp.noFindings; });
    }
    function moreOpen(a) {
        if (!a) return { ok: false, why: '' };
        if (!a.actionReq || !a.actionReq.at) return { ok: false, why: '추가 조치 요청은 조치 요청 공문을 보낸 뒤에 합니다.' };
        if (a.actionReq.more) return { ok: false, why: '추가 조치 요청은 평가당 한 번만 보냅니다.' };
        if (latestDoc('A|' + a.id)) return { ok: false, why: '결과 공문을 보낸 뒤에는 추가로 요청하지 않습니다.' };
        if (!moreCandidates(a).length) return { ok: false, why: '«지적사항 없음»으로 닫힌 부서가 없습니다.' };
        return { ok: true };
    }
    function requestMore(aid, deptIds, dues, doc, by) {
        var a = assessmentOf(aid);
        var g = moreOpen(a); if (!g.ok) return { error: g.why };
        var cand = {}; moreCandidates(a).forEach(function (dp) { cand[dp.deptId] = true; });
        var ids = (deptIds || []).filter(function (id) { return cand[id]; });
        if (!ids.length) return { error: '추가로 요청할 부서를 1곳 이상 고르세요.' };
        dues = dues || {};
        var t0 = today();
        var bad = ids.filter(function (id) { return !dues[id] || dues[id] < t0; });
        if (bad.length) return { error: '조치기한은 오늘(' + t0 + ') 이후로 정합니다 — 기한이 없거나 지난 부서 ' + bad.length + '곳' };
        by = by || actorNow();
        ids.forEach(function (id) {
            var dp = deptOf(a, id);
            dp.request = { at: today(), by: by, no: (doc && doc.no) || '', more: true };
            dp.noFindings = false; dp.inputDone = null; dp.status = 'BEFORE'; dp.dueDate = dues[id];
        });
        a.actionReq.more = { at: today(), by: by, depts: ids.slice(), docs: doc ? [doc] : [] };
        if (a.status === 'COMPLETED') {
            a.status = 'IN_PROGRESS'; a.completed_at = '';
            pushHistory(aid, { type: 'STATUS', by: by, memo: '추가 조치 요청으로 평가를 다시 진행합니다' });
        }
        pushHistory(aid, { type: 'DELIVER', by: by,
            memo: ids.length + '개 부서에 추가 조치 요청 공문 발송 (' + ids.map(deptName).join(', ') + ')' +
                (doc && doc.no ? ' · 연계 번호 ' + doc.no : '') });
        refreshAssessmentStatus(aid);
        return { asked: ids.length };
    }

    /* ===== D-4 생성 뒤 고치기·지우기 =====
     * 설문조사표 요청 공문을 보내기 **전**에는 부서에 간 것이 없으므로 대상 부서·점검일·설문 기한을
     * 고치고 평가를 지울 수 있다. 보낸 뒤에는 막는다(부서가 받은 공문 별지와 어긋난다). */
    function infoEditable(a) {
        return !!a && a.status !== 'COMPLETED' && !surveyRequested(a) && ((a.review && a.review.stage) || 'NONE') === 'NONE';
    }
    var INFO_LOCKED = '설문조사표 요청 공문을 보낸 뒤에는 평가 정보를 고치거나 지울 수 없습니다.';
    function updateRegular(aid, o) {
        var a = assessmentOf(aid);
        if (!infoEditable(a)) return { error: INFO_LOCKED };
        o = o || {};
        var list = (o.depts || []).filter(function (x) { return x && x.deptId; });
        if (!list.length) return { error: '1개 이상 부서를 선택하세요.' };
        var due = o.surveyDue || '';
        if (!due) return { error: '설문조사표 제출 기한을 정하세요.' };
        /* 바꾼 값만 검사한다 — 생성 뒤 날짜가 지나 옛 기한이 «지난 날짜»가 돼도 다른 수정을 막지 않는다(§1-7) */
        if (due !== a.surveyDue && due < today()) return { error: '설문조사표 제출 기한은 오늘(' + today() + ') 이후로 정합니다.' };
        var miss = list.filter(function (x) { return !x.inspectDate; }).length;
        if (miss) return { error: '점검일자가 비어있는 부서가 있습니다 (' + miss + '개).' };
        var old = {}; (a.depts || []).forEach(function (dp) { old[dp.deptId] = dp; });
        var added = 0, moved = 0, kept = {};
        a.depts = list.map(function (x) {
            var dp = old[x.deptId];
            kept[x.deptId] = true;
            if (dp) { if (dp.inspectDate !== x.inspectDate) moved++; dp.inspectDate = x.inspectDate; return dp; }
            added++;
            return { deptId: x.deptId, inspectDate: x.inspectDate, surveyFile: '', reportFile: '',
                     status: 'BEFORE', deliveredAt: '', dueDate: '', hazards: [] };
        });
        var dropped = Object.keys(old).filter(function (id) { return !kept[id]; }).length;
        var dueChanged = due !== a.surveyDue;
        var parts = ['대상 부서 ' + a.depts.length + '개' + ((added || dropped) ? '(추가 ' + added + ' · 제외 ' + dropped + ')' : '')];
        if (moved) parts.push('점검일 변경 ' + moved + '곳');
        if (dueChanged) parts.push('설문 제출 기한 ' + (a.surveyDue || '-') + ' → ' + due);
        a.surveyDue = due;
        pushHistory(aid, { type: 'AMEND', by: o.by || actorNow(), memo: '평가 정보 수정 · ' + parts.join(' · ') });
        save();
        return a;
    }
    function removeRegular(aid) {
        var a = assessmentOf(aid);
        if (!infoEditable(a)) return { error: INFO_LOCKED };
        var d = load();
        d.assessments = d.assessments.filter(function (x) { return x.id !== aid; });
        d.improvements = d.improvements.filter(function (m) { return m.assessment_id !== aid; });
        if (d.docs) d.docs = d.docs.filter(function (x) { return x.aid !== aid; });
        save();
        return { ok: true, year: a.year };
    }

    /* ===== D-6 근로자 공유 (시행규칙 §37의3 2호) =====
     * 평가가 끝나면(완료 확인까지) 재난안전과가 결과(유해·위험요인 · 위험성 수준 결정 결과 · 개선대책
     * 수립 내용과 이행 결과)를 근로자에게 알린 기록을 남긴다 — 공유일(오늘 이전) · 방법 · 증빙 파일.
     * 공유 자체(게시·교육·회의)는 이 시스템 밖에서 한다. 이 기록이 §37의4①3호 기록 항목이 된다. */
    /* 공유 방법은 「사업장 위험성평가에 관한 지침」 §17①(rae-17) 1~7호 그대로다 — 화면 목록을 따로 짓지 않는다(2026-11-13).
     * «그 밖에 입증 가능한 명시적인 방법»은 어떻게 알렸는지 내용을 함께 받는다. */
    var SHARE_OTHER = '그 밖에 입증 가능한 명시적인 방법';
    var SHARE_METHODS = ['안전보건교육', '설명회 개최', '사업장 게시', '문서 전달', '작업 전 안전점검회의 등 정기적인 회의', '전자적인 방법을 통한 전달', SHARE_OTHER];
    function shareOpen(a) {
        if (!a || a.status !== 'COMPLETED') return { ok: false, why: '평가가 끝난 뒤에 근로자 공유를 기록합니다.' };
        var c = confirmCount(a.id);
        if (c.wait || c.returned) return { ok: false, why: '완료 확인이 끝난 뒤에 근로자 공유를 기록합니다.' };
        return { ok: true };
    }
    function shareWorkers(aid, o) {
        var a = assessmentOf(aid);
        var g = shareOpen(a); if (!g.ok) return { error: g.why };
        o = o || {};
        if (!o.date) return { error: '공유일을 정하세요.' };
        if (o.date > today()) return { error: '공유일은 오늘(' + today() + ') 이전이어야 합니다 — 이미 알린 날을 적습니다.' };
        if (!o.method || SHARE_METHODS.indexOf(o.method) < 0) return { error: '공유 방법을 고르세요.' };
        if (o.method === SHARE_OTHER && !String(o.memo || '').trim()) return { error: '그 밖의 방법이면 어떻게 알렸는지 적으세요.' };
        if (!o.file) return { error: '증빙 파일(게시 사진·교육일지·회의록 등)을 올리세요.' };
        var by = o.by || actorNow(), prev = a.workerShare;
        a.workerShare = { at: o.date, method: o.method, memo: String(o.memo || '').trim(), file: o.file, by: by, recordedAt: nowTs() };
        pushHistory(aid, { type: 'SHARE', by: by,
            memo: (prev ? '근로자 공유 기록 고침 · ' : '근로자 공유 · ') + o.date + ' · ' + o.method + ' · 증빙 ' + o.file });
        save();
        return a;
    }
    function clearReport(aid) {
        var a = assessmentOf(aid); if (!a) return;
        if (a.files) a.files.report = '';
        a.review = { stage: 'NONE', extractedAt: '', parsedDepts: {} };
        save();
    }
    /* 검수 화면 편집 헬퍼 — 내용만 수정·삭제·추가 */
    function reviewSet(aid, deptId, idx, key, val) {
        var a = assessmentOf(aid); if (!a || !a.review) return;
        var rows = (a.review.parsedDepts || {})[deptId] || [];
        if (!rows[idx]) return;
        rows[idx][key] = val;
        save();
    }
    function reviewDel(aid, deptId, idx) {
        var a = assessmentOf(aid); if (!a || !a.review) return;
        var rows = (a.review.parsedDepts || {})[deptId] || [];
        rows.splice(idx, 1);
        save();
    }
    function reviewAdd(aid, deptId) {
        var a = assessmentOf(aid); if (!a || !a.review) return;
        a.review.parsedDepts = a.review.parsedDepts || {};
        a.review.parsedDepts[deptId] = a.review.parsedDepts[deptId] || [];
        /* 행 스키마 — 2026-07-30 회의로 담당자·개선 전/후 사진·완료 체크가 행 단위로 들어왔다.
         *   발주처 "지들이 확인해 가지고 여기다가 개선 사진 첨부하고 … 담당자 담당자 조치 요구일
         *          완료일 적고 완료 확인은 서명으로"(녹취 294)
         *   참석자4 "개선 조치 사항을 각각의 입력하게 만들고 추가 추가해 가지고 만들게 하고
         *          증빙 사진 넣게 만들고 … 체크리스트 마지막에 완료 여부 체크"(녹취 355)
         * 근거: 산안법 §36①(개선대책 수립·이행) · §36⑤(결과 기록·보존) · 중처법 시행령 §4 3호. */
        a.review.parsedDepts[deptId].push({
            name: '', category: '', cause: '', action: '', basis: '', deleted: false,
            owner: '', beforePhotos: [], afterPhotos: [], done: false, doneAt: ''
        });
        save();
    }
    /* 검토완료 → 조치기한 적용 → improvements 전달 (부서별 자동 배분)
     *   조치기한은 부서 단위(deptDues[deptId] 또는 bulkDue)로만 결정. 행별 due 는 사용하지 않는다.
     *   개선건 0건 부서는 "지적사항 없음(조치 대상 제외)"로 처리:
     *     deliveredAt = today, status = DONE, hazards = [], history에 REVIEW 기록. */
    function deliverFromReview(aid, opts) {
        opts = opts || {};
        var a = assessmentOf(aid); if (!a || !a.review) return null;
        var bulkDue = opts.bulkDue || '';
        var deptDues = opts.deptDues || {};
        var pd = a.review.parsedDepts || {};
        var total = 0, deptsTouched = 0, deptsExcluded = 0;
        (a.depts || []).forEach(function (dp) {
            var deptId = dp.deptId;
            var rows = ((pd[deptId] || [])).filter(function (r) { return !r.deleted && (r.name || '').trim() && (r.action || '').trim(); });
            var deptNm = deptName(deptId);
            if (!rows.length) {
                /* 0건 부서 — 지적사항 없음으로 조치 대상 제외, DONE 처리 */
                dp.hazards = [];
                dp.dueDate = '';
                dp.deliveredAt = today();
                dp.status = 'DONE';
                pushHistory(aid, { type: 'REVIEW', by: actorNow(),
                    memo: deptNm + ' — 지적사항 없음(조치 대상 제외)' });
                deptsExcluded++;
                return;
            }
            var deptDue = deptDues[deptId] || bulkDue;
            if (!deptDue) return;
            /* 시설물(facilNo)은 검수 행에서 개선조치까지 그대로 승계한다 — 여기서 버리면
             * 시설물 상세(FMS 대장)에서 "이 시설물에 무슨 조치를 했나"를 되짚을 수 없다.
             * 이름(facilNm)은 표시용이고 잇는 키는 시설물번호다(동명 시설물·개명 대비). */
            dp.hazards = rows.map(function (r) { return { name: r.name.trim(), category: r.category || '', cause: r.cause || '', basis: r.basis || '', action: r.action.trim(), facilNo: r.facilNo || '', facilNm: r.facilNm || '', facilNa: !!r.facilNa }; });
            dp.dueDate = deptDue;
            dp.deliveredAt = today();
            dp.status = 'BEFORE';
            rows.forEach(function (r) {
                /* 작성 단계에서 이미 채운 담당자·사진·완료를 그대로 승계한다.
                 * 여기서 버리면 담당자가 표에 적어 둔 내용이 전달과 동시에 사라진다. */
                var beforeF = (r.beforePhotos || []).slice();
                var afterF = (r.afterPhotos || []).slice();
                var before = beforeF.map(function (f) { return f.name; });
                var after = afterF.map(function (f) { return f.name; });
                var alreadyDone = !!r.done && after.length > 0;
                var hist = [{ type: 'NOTIFY', at: nowTs(), by: actorNow(),
                    memo: '개선조치 전달 (기한 ' + deptDue + ')' + basisMemo(r.basis) }];
                if (alreadyDone) {
                    hist.push({ type: 'STATUS', at: nowTs(), by: r.owner || (deptNm + ' 담당자'),
                        memo: '작성 단계에서 조치 완료로 확인됨 · 개선 후 사진 ' + after.length + '건' });
                }
                addImprovement({
                    source_type: 'risk_assessment',
                    assessment_id: aid, dept_id: deptId,
                    hazard: { name: r.name.trim(), category: r.category || '', cause: r.cause || '', basis: r.basis || '',
                              facilNo: r.facilNo || '', facilNm: r.facilNm || '', facilNa: !!r.facilNa },
                    description: r.action.trim(), action: r.action.trim(),
                    due: deptDue, due_date: deptDue,
                    /* 미지정은 **비워서 내려보낸다** — 담당자는 그 부서가 정한다
                       (발주처 2026-08-06). '○○과 담당자' 라는 총칭을 넣으면 부서가
                       정한 것처럼 보여, 정작 누가 할지 정하는 단계가 사라진다. */
                    assigned_to: r.owner || '',
                    /* 사진이 없으면 false 다 — 종전 기본값 true 는 올린 적 없는 사진을
                       '있음'으로 기록해, 상세에서 '미리보기 없음'으로 둔갑했다. */
                    before_photo: before.length ? before.join(', ') : false,
                    after_photo: after.length ? after.join(', ') : false,
                    /* 파일명만 넘기면 상세에서 사진을 다시 볼 수 없다 — 썸네일을 가진
                       객체 그대로 승계한다(개선 전·후 대조가 이 화면의 존재 이유다). */
                    before_photos: beforeF, after_photos: afterF,
                    completed_date: alreadyDone ? (r.doneAt || today()) : '',
                    signature: alreadyDone ? { by: r.owner || (deptNm + ' 담당자'), at: r.doneAt || today() } : null,
                    status: alreadyDone ? 'DONE' : 'IN_PROGRESS',
                    reassessed: alreadyDone, created: today(),
                    /* 전달 문면에 근거를 함께 실어야 부서 담당자가 "왜 하는지"를 그 자리에서 안다 */
                    history: hist
                });
                total++;
            });
            deptsTouched++;
        });
        a.review.stage = 'DELIVERED';
        var deliverMemo = deptsTouched + '개 부서에 개선조치 ' + total + '건 자동 전달 (일괄 기한 ' + (bulkDue || '개별') + ')';
        if (deptsExcluded) deliverMemo += ' · 지적사항 없는 ' + deptsExcluded + '개 부서는 조치 대상 제외';
        pushHistory(aid, { type: 'DELIVER', by: actorNow(), memo: deliverMemo });
        refreshAssessmentStatus(aid);
        return { total: total, deptsTouched: deptsTouched, deptsExcluded: deptsExcluded };
    }

    /* ================= 개선조치 (부서·평가 링크) ================= */
    function improvements() { return load().improvements; }
    /* 개선조치가 가리키는 시설물 표시 라벨 — 화면 4곳(개선조치 목록·상세·카드·내 할일)이
     * 각자 hazard 를 파헤치지 않도록 한 곳에서 만든다. 이름이 비면 시설물번호로 떨어진다
     * (이름은 표시용이고 잇는 키는 번호다).
     *
     * **세 상태를 두 글자로 구분한다** — 지정이면 시설물명, '해당 없음'이면 그 말 그대로,
     * 미지정이면 빈 문자열이다. 소비처 4곳이 모두 `label ? 줄 표시 : 줄 없음` 이라
     * 여기서 구분하면 화면을 고칠 필요가 없다. 빈 문자열을 '해당 없음'으로 읽지 않는 것이
     * 요점이다 — 앞은 **아직 아무도 안 본 것**이고 뒤는 **확인이 끝난 것**이라,
     * 담당자가 되돌아가 확인해야 하는지 여부가 갈린다. */
    function facilLabel(m) {
        var h = m && m.hazard; if (!h) return '';
        if (h.facilNo) {
            /* **이름은 대장(정본)에서 매번 찾는다.** 저장된 facilNm 은 그때 복사해 둔
             * 스냅샷이라, FMS 가 시설물을 개명해 보내면 대장은 새 이름인데 개선조치만
             * 옛 이름으로 남는다 — 잇는 키(facilNo)는 멀쩡해서 역조회는 되는데 **보이는
             * 이름만 조용히 갈리므로** 담당자가 현장에서 그 이름의 시설물을 못 찾는다.
             * 스냅샷은 지우지 않고 **폴백**으로 남긴다 — 폐지된 시설물은 대장에서 빠질 수
             * 있고, 그때 이름조차 없으면 지난 이력이 '번호만 남은 줄'이 된다. */
            var cur = global.DYFACIL && global.DYFACIL.label ? (global.DYFACIL.label(h.facilNo) || '').trim() : '';
            return cur || (h.facilNm || '').trim() || h.facilNo;
        }
        return h.facilNa ? '해당 없음' : '';
    }
    function improvementOf(id) { var d = load(); for (var i = 0; i < d.improvements.length; i++) if (d.improvements[i].id === id) return d.improvements[i]; return null; }
    function improvementsFor(aid, deptId) {
        return improvements().filter(function (m) {
            if (m.assessment_id !== aid) return false;
            if (deptId && m.dept_id !== deptId) return false;
            return true;
        });
    }
    function nextImpId() {
        var d = load(); d.seqImp++;
        return 'IMP-' + String(300 + d.seqImp);
    }
    /* 개선조치 생성 */
    function addImprovement(o) {
        var d = load(); d.seqImp++;
        var m = {
            id: 'IMP-' + String(300 + d.seqImp),
            source_type: o.source_type || 'manual',
            assessment_id: o.assessment_id || '',
            dept_id: o.dept_id || '',
            occ_id: o.occ_id || '',
            target_id: o.target_id || '', process_id: o.process_id || '',
            /* basis(법령 근거 조문 키)는 여기서 유실되면 화면에 근거를 못 그린다 — 반드시 보존.
             * facilNo(FMS 시설물번호)도 같다 — 여기서 떨어뜨리면 검수 행에서 지정한 시설물이
             * 개선조치까지 못 오고, 시설물 대장에서 "이 시설물에 무슨 조치를 했나"가 영영 빈다.
             * 이 객체는 화이트리스트라 필드를 늘릴 때 여기도 함께 늘려야 한다. */
            hazard: o.hazard ? {
                name: o.hazard.name || '', category: o.hazard.category || '',
                cause: o.hazard.cause || '', basis: o.hazard.basis || '',
                facilNo: o.hazard.facilNo || '', facilNm: o.hazard.facilNm || '',
                /* 시설물 축은 세 상태다 — 지정 / 해당 없음(확인함) / 미지정(아직 안 봄).
                   facilNa 를 여기서 떨어뜨리면 앞 단계에서 이미 끝낸 판단이 사라져,
                   개선조치 담당자가 같은 확인을 다시 하게 된다. */
                facilNa: !!o.hazard.facilNa
            } : { name: '', category: '', cause: '', basis: '', facilNo: '', facilNm: '', facilNa: false },
            hazard_risk_factor: (o.hazard && o.hazard.name) || o.hazard_risk_factor || '',
            description: o.description || (o.hazard && o.hazard.action) || '',
            action: o.action || o.description || '',
            assigned_to: o.assigned_to || '', due: o.due || o.due_date || '', due_date: o.due_date || o.due || '',
            /* 사진·완료일·서명은 **넘어온 값을 그대로 보존**한다.
             * 종전에는 after_photo 를 무조건 false 로, 완료일·서명을 아예 버렸다. 그래서 작성 단계에서
             * 담당자가 붙인 개선 전·후 사진과 완료 확인이 전달과 동시에 사라졌다(2026-07-30 회의로
             * 행 단위 증빙이 생기면서 드러난 문제). 증빙이 사라지면 완료를 소명할 수 없다. */
            before_photo: o.before_photo || false,
            after_photo: o.after_photo || false,
            before_photos: o.before_photos || [],
            after_photos: o.after_photos || [],
            action_content: o.action_content || '',
            completed_date: o.completed_date || '',
            signature: o.signature || null,
            status: o.status || 'PENDING', reassessed: !!o.reassessed, created: o.created || today(),
            history: o.history || []
        };
        d.improvements.push(m); save();
        try {
            if (global.EDOC && global.EDOC.addImprovement) {
                global.EDOC.addImprovement({
                    title: m.description, sourceMenu: '위험성평가',
                    sourceDoc: (assessmentOf(m.assessment_id) || {}).title || '정기 위험성평가',
                    due: m.due || m.due_date
                });
            }
        } catch (e) {}
        return m;
    }
    function saveImprovement() { save(); }
    /* 조치 완료 처리 */
    /* 개선조치 완료 처리 (2026-07-30 회의 반영)
     *   발주처: "담당자 조치 요구일 완료일 적고 완료 확인은 서명으로 이렇게 쓸 수 있게끔 전자로"
     *           "가장 중요한 건 지금 개선 전 개선 후가 없어요. 이 개선 후를 사진을 올리기만 하면 돼요"
     *   → 조치 요구일 = due_date(전달 시 배분된 조치기한), 완료일 = completed_date,
     *      개선 후 사진 = after_photo(파일명), 완료 확인 = signature{by,at}(전자서명).
     *   호출 형태 2가지를 모두 받는다 — 구 (id, '조치내용', '작성자') / 신 (id, {action, by, completedDate, afterPhoto, signedBy}). */
    /* 완료 요건 — 화면이 아니라 **여기서** 막는다.
     * 개선 후 사진이 없으면 완료로 넘기지 않는다. 화면마다 검증을 두면 어느 한 경로(내 할일 등)가
     * 빠져나가고, 그러면 증빙이 없는데 데이터에는 '사진 있음'으로 기록되어 이행점검에서 막은
     * '해당없음 회피'와 같은 종류의 거짓 기록이 된다.
     *   발주처: "이 개선 후를 사진을 올리기만 하면 돼요 … 사진 첨부해서 이렇게 하면은
     *            이게 법적으로 한 거예요"(녹취 222·224)
     * 반환: 성공 시 개선조치, 요건 미충족 시 { error: '사유' } */
    function completionError(o) {
        if (!o.afterPhoto) return '개선 후 사진을 첨부해야 완료할 수 있습니다.';
        if (!String(o.action || '').trim()) return '조치 내용을 입력하세요.';
        if (!String(o.signedBy || o.by || '').trim()) return '완료 확인 서명(이름)을 입력하세요.';
        return '';
    }
    /* 담당자·기한 변경 (docs/planning/확정-미결사항… §8)
       "지정·변경 = 주관부서 담당자만 · 모든 변경은 이력에 남긴다"
       **사유 없이는 바꿀 수 없다.** 기한이 조용히 밀리면 그 기한은 관리 수단이 아니게 된다.
       화면 권한 판정은 호출부(RSKLIST.canManage)가 하고 여기서는 값과 이력만 다룬다. */
    function amendImprovement(id, patch, reason, by) {
        var d = load();
        var m = (d.improvements || []).filter(function (x) { return x.id === id; })[0];
        if (!m) return null;
        if (!String(reason || '').trim()) return null;   /* 사유 필수 */
        var log = [];
        if (patch.assigned_to !== undefined && patch.assigned_to !== m.assigned_to) {
            log.push('담당자 ' + (m.assigned_to || '미지정') + ' → ' + (patch.assigned_to || '미지정'));
            m.assigned_to = patch.assigned_to;
        }
        if (patch.due !== undefined && patch.due !== m.due) {
            log.push('기한 ' + (m.due || '미지정') + ' → ' + (patch.due || '미지정'));
            m.due = patch.due; m.due_date = patch.due;
        }
        if (!log.length) return m;                       /* 바뀐 것이 없으면 이력도 남기지 않는다 */
        m.history = m.history || [];
        m.history.push({ type: 'AMEND', at: nowTs(), by: by || '', memo: log.join(' · ') + ' — 사유: ' + String(reason).trim() });
        save(); return m;
    }

    function completeImprovement(id, actionContent, by) {
        var m = improvementOf(id); if (!m) return null;
        var o = (actionContent && typeof actionContent === 'object')
            ? actionContent
            : { action: actionContent, by: by };
        var err = completionError(o);
        if (err) return { error: err };
        var who = o.by || '부서 담당자';
        m.action_content = o.action || m.action_content;
        m.after_photo = o.afterPhoto;
        if (o.afterPhotos && o.afterPhotos.length) m.after_photos = o.afterPhotos.slice();
        /* 개선 전 사진은 **선택**이라 없으면 기존 값을 지우지 않는다 —
           검수 단계에서 주관부서가 미리 붙여 둔 '전' 사진을 덮어쓰면 안 된다. */
        if (o.beforePhotos && o.beforePhotos.length) {
            m.before_photos = o.beforePhotos.slice();
            m.before_photo = o.beforePhotos[0].name || true;
        }
        m.completed_date = o.completedDate || today();
        /* 전자서명 — 체크박스가 아니라 '누가 언제 확인했는지'가 남아야 증빙이 된다 */
        m.signature = { by: o.signedBy || who, at: m.completed_date };
        m.status = 'DONE'; m.reassessed = true;
        /* 재제출 — 반려된 건을 다시 완료하면 확인은 처음부터 다시 받는다(회차 누적) */
        var prevC = confirmOf(m);
        m.confirm = { state: CFM_WAIT, by: '', at: '', reason: '',
                      round: (prevC.state === CFM_RETURN ? (prevC.round || 1) + 1 : (prevC.round || 1)) };
        m.history = m.history || [];
        m.history.push({ type: 'STATUS', at: nowTs(), by: who,
            memo: '완료 처리 · 완료일 ' + m.completed_date +
                (typeof m.after_photo === 'string' ? ' · 개선 후 사진 ' + m.after_photo : '') +
                ' · 전자서명 ' + m.signature.by });
        save();
        if (m.assessment_id) refreshAssessmentStatus(m.assessment_id);
        /* 정기평가 조치는 주관부서가 확인해야 끝난다 — 완료·재제출 즉시 «완료 확인 요청»(SCR-ADMIN-002 §4-1).
           수시평가는 확인 주체가 외부 용역 안전관리자라 보내지 않는다. */
        if (m.assessment_id && m.source_type !== 'occasional') {
            var aa = assessmentOf(m.assessment_id) || {};
            var rd = m.confirm.round || 1;
            notify({ toDept: OWNER, toTier: ['staff'], basis: 'osh-36',
                title: (aa.year ? aa.year + '년 정기 위험성평가 — ' : '') + deptName(m.dept_id) + ' 개선조치 완료 확인 요청 — ' +
                    ((m.hazard && m.hazard.name) || '') + (rd > 1 ? ' (재제출 ' + rd + '회차)' : ''),
                href: 'rsk-list.html?year=' + (aa.year || '') + '&confirm=1', work: 'my-work.html' });
        }
        return m;
    }
    /* ================= 조치 완료 확인 (2026-07-31 신설) =================
     * 부서가 완료를 누르면 아무도 확인하지 않고 평가까지 끝나던 구멍을 메운다.
     *
     * **status 를 건드리지 않는다.** `status === 'DONE'` 이분법으로 세는 곳이 8군데
     * (deptImpCount·assessmentProgress·IMPCARD·rsk-imp 필터·dashboard·my-work 2곳·rsk-my)
     * 라, 여기에 값을 하나 더 넣거나 완료를 확인 이후로 미루면 8곳이 동시에 어긋난다.
     * 그래서 확인은 improvement.confirm 이라는 **별도 축**이고, 반려해도 status 는
     * DONE 그대로 둔다(refreshAssessmentStatus 가 COMPLETED 를 되돌리지 못하는 제약도 회피).
     *
     * 실질 제재는 두 가지다 — (1) 전 건 확인 완료 전에는 공문 기안이 막힌다,
     * (2) 담당자 화면(내 할일·IMPCARD)에 반려 사유와 회차가 상시 뜬다.
     *
     * confirm 이 undefined 인 옛 데이터는 WAIT 로 파생되므로 SKEY 범프가 필요 없다. */
    var CFM_WAIT = 'WAIT', CFM_OK = 'OK', CFM_RETURN = 'RETURNED';
    function confirmOf(m) {
        var c = m && m.confirm;
        if (!c || !c.state) return { state: CFM_WAIT, by: '', at: '', reason: '', round: 1 };
        return c;
    }
    /* 확인 대상인가 — 완료된 건만 확인할 수 있다 */
    function confirmable(m) { return !!m && m.status === 'DONE'; }
    function confirmState(m) { return confirmable(m) ? confirmOf(m).state : ''; }
    function isConfirmed(m) { return confirmState(m) === CFM_OK; }
    function isReturned(m) { return confirmState(m) === CFM_RETURN; }

    function confirmImprovement(id, by) {
        var m = improvementOf(id); if (!m) return { error: '개선조치를 찾을 수 없습니다.' };
        if (!confirmable(m)) return { error: '완료된 개선조치만 확인할 수 있습니다.' };
        var prev = confirmOf(m);
        m.confirm = { state: CFM_OK, by: by || actorNow(), at: today(), reason: '', round: prev.round || 1 };
        m.history = m.history || [];
        m.history.push({ type: 'CONFIRM', at: nowTs(), by: by || actorNow(),
            memo: '조치 완료 확인' + ((prev.round || 1) > 1 ? ' (' + prev.round + '회차 제출)' : '') });
        save(); return m;
    }
    function returnImprovement(id, by, reason) {
        var m = improvementOf(id); if (!m) return { error: '개선조치를 찾을 수 없습니다.' };
        if (!confirmable(m)) return { error: '완료된 개선조치만 반려할 수 있습니다.' };
        var r = String(reason || '').trim();
        /* 사유 없는 반려는 담당자가 무엇을 고쳐야 할지 알 수 없어 반려가 작동하지 않는다 */
        if (!r) return { error: '반려 사유를 입력하세요 — 담당자가 무엇을 다시 해야 하는지 알아야 합니다.' };
        var prev = confirmOf(m);
        m.confirm = { state: CFM_RETURN, by: by || actorNow(), at: today(), reason: r, round: prev.round || 1 };
        m.history = m.history || [];
        m.history.push({ type: 'RETURN', at: nowTs(), by: by || actorNow(), memo: '조치 확인 반려 — ' + r });
        save();
        /* 반려는 그 조치 담당자에게 사유와 함께 — 담당자를 찾지 못하면(미지정·동명이인) 그 부서 담당자에게 */
        var ra = assessmentOf(m.assessment_id) || {};
        var uid = ownerUid(m);
        notify(Object.assign(uid ? { toUids: [uid] } : { toDept: m.dept_id, toTier: ['staff'] }, {
            basis: 'osh-36',
            title: (ra.year ? ra.year + '년 정기 위험성평가 — ' : '') + '개선조치 확인 반려 — ' +
                ((m.hazard && m.hazard.name) || '') + ' (사유: ' + r + ')',
            href: 'rsk-list.html?year=' + (ra.year || '') + '&dept=' + m.dept_id, work: 'my-work.html?cat=improve' }));
        return m;
    }
    /* 확인 취소 — 상신 전에만. 잠금 판정은 화면(DYRSKDOC.lockOf)이 하고 여기선 상태만 되돌린다. */
    function cancelConfirm(id, by) {
        var m = improvementOf(id); if (!m) return { error: '개선조치를 찾을 수 없습니다.' };
        var prev = confirmOf(m);
        m.confirm = { state: CFM_WAIT, by: '', at: '', reason: '', round: prev.round || 1 };
        m.history = m.history || [];
        m.history.push({ type: 'REOPEN', at: nowTs(), by: by || actorNow(), memo: '확인 취소 — 확인 대기로 되돌림' });
        save(); return m;
    }
    /* 담당자가 **다시 손대야 하는가** — 화면이 '할 일'로 취급할지의 단일 판정.
     * 반려 건은 status 가 DONE 이지만 담당자가 재제출해야 하므로 여기서 true 다.
     * ※ 집계(deptImpCount·assessmentProgress·refreshAssessmentStatus)는 이 함수를 쓰지 않는다 —
     *   완료율은 status 기준 그대로 두고, **할 일 노출**만 이 축을 본다. */
    function needsAction(m) {
        if (!m) return false;
        return m.status !== 'DONE' || confirmState(m) === CFM_RETURN;
    }

    /* 평가/부서 단위 확인 집계 — 공문 기안 가능 여부의 단일 판정 지점 */
    function confirmCount(aid, deptId) {
        var ms = improvementsFor(aid, deptId);
        var c = { total: ms.length, done: 0, wait: 0, ok: 0, returned: 0 };
        ms.forEach(function (m) {
            if (m.status !== 'DONE') return;
            c.done++;
            var s = confirmState(m);
            if (s === CFM_OK) c.ok++;
            else if (s === CFM_RETURN) c.returned++;
            else c.wait++;
        });
        return c;
    }
    /* 공문 기안 가능 — 개선조치가 1건 이상이고 전 건이 완료·확인까지 끝났을 때 */
    function docReady(aid) {
        var c = confirmCount(aid);
        var a = assessmentOf(aid);
        /* 조치 요청을 받은 부서가 모두 «입력 완료»를 알려야 한다 — 입력 중인 부서가 있으면
           확인을 다 마쳐도 결과 공문에 그 부서 조치가 빠진다 */
        var waiting = !!a && (a.depts || []).some(function (dp) { return dp.request && !dp.inputDone; });
        if (waiting) return false;
        if (c.total > 0) return c.done === c.total && c.ok === c.total;
        /* 개선조치 0건으로 끝난 평가(조치 대상 없음 — 종결 또는 전 부서 0건 입력 완료)도 결과 공문을
           «조치 대상 없음» 보고로 낸다(2026-11-13 결정 D-1). 확인할 건이 없으므로 끝났으면 기안할 수 있다. */
        return !!a && a.status === 'COMPLETED';
    }
    /* 개선조치 0건으로 끝난 평가인가 — 결과 공문 안내·«지금 할 일» 문구가 같은 판정을 쓴다 */
    function noActionClosed(a) {
        return !!a && a.status === 'COMPLETED' && !improvementsFor(a.id).length;
    }

    /* ================= 공문(온나라 이관) 스토어 =================
     * 결재 축은 평가와 1:1 이 아니다(재상신 누적 · 대상이 평가일 수도 부서일 수도).
     * assessment 안의 필드로 넣으면 스키마가 곧 어긋나므로 키드 배열로 둔다.
     * 새 sessionStorage 키를 늘리지 않는다 — DYRSK.reset() 이 공문까지 함께 처리한다. */
    function docs() { var d = load(); if (!d.docs) { d.docs = []; d.seqDoc = 0; } return d.docs; }
    function docsFor(target) {
        return docs().filter(function (x) { return x.target === target; });
    }
    function latestDoc(target) {
        var a = docsFor(target);
        return a.length ? a[a.length - 1] : null;
    }
    function pushDoc(o) {
        var d = load();
        if (!d.docs) { d.docs = []; d.seqDoc = 0; }
        d.seqDoc++;
        var doc = {
            sid: 'RD-' + d.seqDoc,
            kind: o.kind || 'assessment', target: o.target || '',
            aid: o.aid || '', deptId: o.deptId || '',
            no: o.no || '', title: o.title || '', to: o.to || '', body: o.body || '',
            docType: o.docType || '내부결재',
            basis: (o.basis || []).slice(), attach: (o.attach || []).slice(),
            line: (o.line || []).slice(), sample: !!o.sample,
            status: o.status || '결재중', at: o.at || nowTs(), by: o.by || '',
            /* 기안자 **계정 식별자** — 온나라 결재선은 기안자를 포함한 계정 배열이다.
               화이트리스트라 여기 없으면 조용히 버려진다(2026-08-27 실측). */
            byUid: o.byUid || '',
            log: [{ at: nowTs(), st: o.status || '결재중', by: o.by || '', memo: '온나라 상신' }]
        };
        d.docs.push(doc); save(); return doc;
    }
    /* 결재 결과 '수신' — 시스템이 스스로 결재하지 않는다. 최신 건만 상태가 바뀐다(이력 변조 방지). */
    function receiveDoc(sid, status, memo) {
        var arr = docs();
        var doc = arr.filter(function (x) { return x.sid === sid; })[0];
        if (!doc) return { error: '문서를 찾을 수 없습니다.' };
        if (latestDoc(doc.target) !== doc) return { error: '재상신되어 최신 건이 아닙니다 — 상태를 바꿀 수 없습니다.' };
        doc.status = status;
        doc.log.push({ at: nowTs(), st: status, by: '온나라', memo: memo || '' });
        if (doc.aid) pushHistory(doc.aid, { type: 'RECEIVE', by: '온나라',
            memo: '결재 회신 — ' + status + (memo ? ' (' + memo + ')' : '') });
        save(); return doc;
    }

    function markReassessed(id) { var m = improvementOf(id); if (m) { m.reassessed = true; save(); } return m; }
    /* 이력 append (개선조치 단위) */
    function pushImpHistory(id, entry) {
        var m = improvementOf(id); if (!m) return;
        m.history = m.history || [];
        m.history.push({ type: entry.type, at: entry.at || nowTs(), by: entry.by || '', memo: entry.memo || '' });
        save();
    }
    /* 기한초과 여부 — 기준일은 today() 단일 출처.
     * (종전에는 '2026-07-14' 를 따로 박아 둬 대시보드·내 할일과 하루씩 어긋났다.) */
    function isOverdue(m) {
        if (!m || m.status === 'DONE' || !(m.due || m.due_date)) return false;
        var t = new Date(today()), d = new Date(m.due || m.due_date);
        return d < t;
    }

    /* ================= 수시 위험성평가 =================
     * 실시 사유 6종은 **사업장 위험성평가에 관한 지침(고시) 제15조**(2026-11-04 전부개정)가 정한
     * 법정 트리거다 — ②항 1~5호(추가적인 유해·위험 요인의 사유) 다섯과 ③항(중대산업사고 또는
     * 산업재해의 원인이 되는 유해·위험 요인) 하나. 개정 전 ② 5호 «재해 발생»은 ③으로 옮겨졌고,
     * 실시 시점은 사유와 무관하게 ① «관련 작업을 시작하기 전까지»다.
     * 임의로 만든 분류가 아니라 조문을 그대로 옮긴 것이므로, 고치려면 조문을 먼저 열어본다
     * (DYLAW 'rae-15' — CLAUDE.md §10 검증 6문 #1·#5). no 는 고르는 창의 순번일 뿐 호 번호가 아니다.
     *
     * 발주처 요구(2026-07-30): "제일 중요한 거는 법 규정이 첫 번째가 들어가야지 눌렀을 때
     *   그 해당 사항을 들어가야지만이 수시 평가 등록을 할 수가 있어요. … 그 목록을 먼저
     *   만들어줘야지 수시 평가를 등록을 하는데" → 사유를 고르는 것이 등록의 진입점이다.
     * ACCIDENT·EQUIP_CHANGE·OTHER 키는 기존 저장 데이터와 이어지도록 그대로 둔다. */
    var OCC_REASONS = {
        /* ② 1호 */
        BUILDING:     { no: 1, label: '건설물 설치·이전·변경·해체',        tone: 'warning',
                        desc: '사업장 건설물을 새로 세우거나 옮기거나 바꾸거나 헐 때' },
        /* ② 2호 */
        EQUIP_CHANGE: { no: 2, label: '기계·설비·원재료 신규 도입·변경',    tone: 'warning',
                        desc: '기계·기구, 설비, 원재료 등을 새로 들이거나 바꿀 때' },
        /* ② 3호 */
        REPAIR:       { no: 3, label: '건설물·기계·설비 정비 또는 보수',    tone: 'info',
                        desc: '정비·보수 작업 시. 다만 주기적·반복 작업으로 이미 평가한 경우는 제외' },
        /* ② 4호 */
        METHOD:       { no: 4, label: '작업방법·작업절차 신규 도입·변경',   tone: 'info',
                        desc: '작업 방법이나 절차를 새로 도입하거나 바꿀 때' },
        /* ③ — 개정 전 ② 5호(«작업을 재개하기 전에» 단서)가 ③ 으로 옮겨졌다. 중대재해면 전체 유해·위험 요인의
           기존 평가 유효성도 근로자를 참여시켜 다시 점검한다(③ 단서) */
        ACCIDENT:     { no: 5, label: '중대산업사고 또는 산업재해 발생',    tone: 'danger',
                        desc: '중대산업사고나 산업재해의 원인이 되는 유해·위험요인을 평가한다. 중대재해면 전체 유해·위험요인의 기존 평가 결과도 근로자와 함께 다시 점검한다' },
        /* ② 5호 */
        OTHER:        { no: 6, label: '그 밖에 필요하다고 판단한 경우',      tone: 'neutral',
                        desc: '위 5가지에 해당하지 않지만 추가 위험요인이 생겼다고 판단할 때' }
    };
    var OCC_BASIS = 'rae-15';   /* 위 6종의 근거 조문 (DYLAW) */
    /* 수시평가 작성 양식 — 발주처: "수시 HWP x로 하면 되나요? 네 x로 해 주세요"
     * 양식 안에 안전관리자 확인·서명란이 포함된다("안전 관리자 서명하는 란을 추가로 만들어야"). */
    var OCC_FORM_FILE = '수시_위험성평가_작성양식.hwpx';
    /* 양식 파일이 실제로 등록됐는가 — 아직 없다(운영 T31, 2026-11-04). false 인 동안 수시평가 화면은
       양식 내려받기 버튼과 등록 창의 «작성 양식» 칸을 내지 않는다. 파일을 받으면 true 로 켠다. */
    var OCC_FORM_READY = false;
    function occasionals(year) {
        var d = load();
        return d.occasionals.filter(function (o) { return !year || o.year === year; })
            .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    }
    function occasionalOf(id) { var d = load(); for (var i = 0; i < d.occasionals.length; i++) if (d.occasionals[i].id === id) return d.occasionals[i]; return null; }
    function occasionalYears() {
        var d = load(), s = {};
        d.occasionals.forEach(function (o) { s[o.year] = true; });
        var arr = Object.keys(s).map(Number);
        var cy = +String(today()).slice(0, 4);   /* 기준일 단일 출처(§11) — 실제 시계를 보지 않는다 */
        if (arr.indexOf(cy) === -1) arr.push(cy);
        return arr.sort(function (a, b) { return b - a; });
    }
    function addOccasional(o) {
        /* 부서에 주는 기한은 오늘 이후(정기평가와 같은 판정) — 지난 날짜로 등록하면 등록 즉시 기한 초과가 된다 */
        if (o.due && o.due < today()) return { error: '조치기한은 오늘(' + today() + ') 이후로 정합니다.' };
        var d = load(); d.seqOcc++;
        var it = {
            id: 'OCC-' + o.year + '-' + String(10 + d.seqOcc).slice(-2),
            year: o.year, deptId: o.deptId, reason: o.reason,
            date: o.date, desc: o.desc || '',
            files: o.files || [], status: 'REGISTERED',
            /* 재해 발생(고시 §15③) 전용 — 수시평가는 ① «관련 작업을 시작하기 전까지» 실시하므로
               멈춘 작업을 다시 시작하는 날(재개 예정일)이 이 건의 기한이 된다. 다른 사유에는 비어 있다. */
            accident: o.accident || '', resumeDate: o.resumeDate || '',
            /* 부서 담당자가 이 자리에서 적은 유해위험요인.
             * **원본을 평가 기록에 남긴다** — 종전에는 건수(hazardCount)만 남기고 행을
             * 통째로 버렸다. 그러면 그 수시평가가 무엇을 평가했는지가 평가 기록에 없고,
             * 개선조치를 회수하면 근거가 함께 사라진다(산안법 §36⑤ 기록·보존).
             * 요인·대책이 한쪽만 적힌 행도 적은 그대로 남긴다 — 개선조치로만 안 넘어간다. */
            hazards: (o.hazards || []).map(function (h) {
                return {
                    name: (h.name || '').trim(), cause: h.cause || '',
                    action: (h.action || '').trim(), owner: h.owner || '',
                    facilNo: h.facilNo || '', facilNm: h.facilNm || '', facilNa: !!h.facilNa,
                    due: h.due || ''
                };
            }),
            hazardCount: 0,
            /* 안전관리자 검토 — 아래 setOccReviewFile 참고 */
            reviewFile: '', reviewer: '',
            history: [{ type: 'REGISTER', at: nowTs(), by: deptName(o.deptId), memo: '수시평가 등록 (사유: ' + (OCC_REASONS[o.reason] || {}).label + ')' }]
        };
        d.occasionals.push(it); save();
        /* 수시평가는 '실시했다'로 끝나지 않는다 — 고시 §15②·③의 트리거로 실시한 평가도
         * 위험성 감소대책을 수립·실행해야 완결된다(산안법 §36①). 등록 폼에서 적은
         * 유해위험요인을 그 자리에서 개선조치로 만들어, 부서 담당자가 자기 화면
         * (내 할일)에서 완료까지 끝낼 수 있게 한다. */
        var hz = (o.hazards || []).filter(function (h) {
            return String(h.name || '').trim() && String(h.action || '').trim();
        });
        hz.forEach(function (h) {
            var bp = (h.beforePhotos || []).slice();
            addImprovement({
                source_type: 'occasional',
                occ_id: it.id, dept_id: o.deptId,
                /* 시설물은 정기 검수 행과 같이 개선조치까지 승계한다 — 여기서 떨어뜨리면
                   수시평가로 만든 조치만 시설물 대장에서 되짚을 수 없게 된다. */
                hazard: { name: h.name.trim(), category: h.category || '', cause: h.cause || '', basis: '',
                          facilNo: h.facilNo || '', facilNm: h.facilNm || '', facilNa: !!h.facilNa },
                description: h.action.trim(), action: h.action.trim(),
                due: h.due || o.due || '', due_date: h.due || o.due || '',
                /* 미지정은 **비워서 내려보낸다** — 정기(§deliverFromReview)와 같은 규칙이다.
                   '○○과 담당자' 총칭을 넣으면 그 부서가 정한 것처럼 보여, 정작 누가 할지
                   정하는 단계가 사라진다(발주처 2026-08-06). */
                assigned_to: h.owner || '',
                before_photo: bp.length ? bp.map(function (f) { return f.name; }).join(', ') : false,
                before_photos: bp, after_photos: [],
                status: 'IN_PROGRESS', created: today(),
                history: [{ type: 'NOTIFY', at: nowTs(), by: deptName(o.deptId),
                    memo: '수시평가(' + it.id + ') 실시 결과 — 위험성 감소대책 등록' +
                        (h.due ? ' (조치기한 ' + h.due + ')' : '') }]
            });
        });
        it.hazardCount = hz.length;
        if (hz.length) {
            it.history.push({ type: 'STATUS', at: nowTs(), by: deptName(o.deptId),
                memo: '위험성 감소대책 ' + hz.length + '건 등록 — 개선조치로 전환' });
        }
        save();
        return it;
    }
    /* 이 수시평가에서 나온 개선조치 (진행률 표시·링크용) */
    function occImprovements(occId) {
        return improvements().filter(function (m) { return m.occ_id === occId; });
    }
    function occImpCount(occId) {
        var ms = occImprovements(occId);
        return { total: ms.length, done: ms.filter(function (m) { return m.status === 'DONE'; }).length };
    }
    /* ===== 안전관리자 검토 (2026-07-30 회의 확정) =====
     * 담양군은 상시근로자 300명 미만이라 안전관리자를 고용하지 못하고 **외부 용역**에 맡긴다.
     * 외부인이 이 시스템에 로그인해 검토 완료를 누르는 경로는 인증 수단 자체가 없어 만들 수 없다
     *   (참석자4: "외부 사람이 접근하는 … 사용자에 대한 인증을 하게 하는 방법이 없어요").
     * 그래서 **안전관리자가 서명한 파일을 담당자가 올리면 그 시점이 검토 완료**다
     *   (참석자2: "안전 관리자 검토로 하고 파일 첨부 버튼을 하고 파일이 첨부되면은 검토 완료").
     * 상태를 여러 단계로 쪼개지 않는다 — 회의에서 합의된 판정 규칙은 '파일 = 완료' 하나뿐이다. */
    /* reviewedAt 은 **안전관리자가 검토한 날**이지 우리가 파일을 올린 날이 아니다.
     * 외부 용역이 검토를 마친 뒤 며칠 지나 첨부하는 것이 실제 업무라, 업로드일로
     * 자동 기록하면 법정 기록으로서 날짜가 틀린다. 입력받되 비면 등록일로 떨어진다. */
    function setOccReviewFile(id, fileName, reviewer, reviewedAt) {
        var it = occasionalOf(id); if (!it) return null;
        /* 검토일은 검토를 마친 날 — 앞날로 적으면 하지 않은 검토를 했다고 남는다 */
        if (fileName && reviewedAt && reviewedAt > today()) return { error: '검토일은 오늘(' + today() + ') 이전 날짜로 적습니다.' };
        it.reviewFile = fileName || '';
        it.reviewer = fileName ? (reviewer || '') : '';
        if (fileName) {
            it.status = 'REVIEWED'; it.reviewedAt = reviewedAt || today();
            it.history.push({ type: 'REVIEW', at: nowTs(), by: reviewer || '안전관리자',
                memo: '안전관리자 검토파일 등록 · ' + fileName + ' → 검토 완료' });
        } else {
            it.status = 'REGISTERED'; it.reviewedAt = '';
            it.history.push({ type: 'REVIEW', at: nowTs(), by: actorNow(), memo: '검토파일 삭제 · 검토 완료 해제' });
        }
        save(); return it;
    }
    function reviewOccasional(id, by) {
        var it = occasionalOf(id); if (!it) return;
        it.status = 'REVIEWED'; it.reviewedAt = today();
        it.history.push({ type: 'REVIEW', at: nowTs(), by: by || actorNow(), memo: '검토 완료' });
        save(); return it;
    }

    /* ================= 메타 ================= */
    var SRC_META = {
        risk_assessment: { label: '위험성평가',   tone: 'info'    },
        occasional:      { label: '수시평가',     tone: 'purple'  },
        inspection:      { label: '안전점검',     tone: 'purple'  },
        opinion:         { label: '의견청취',     tone: 'warning' },
        policy_check:    { label: '경영방침 점검', tone: 'info'    },
        incident:        { label: '사고(재발방지)', tone: 'danger' },
        manual:          { label: '수동',         tone: 'neutral' }
    };
    var STATUS_META = {
        PENDING:     { label: '예정',   tone: 'neutral' },
        IN_PROGRESS: { label: '진행중', tone: 'warning' },
        DONE:        { label: '완료',   tone: 'success' }
    };

    /* ---- 레거시(rsk-detail 구·rsk-exec) 호환 스텁 ---- */
    function estKey(aid, pid) { return aid + '|' + pid; }
    function estimation(aid, pid) { var d = load(); return d.estimations[estKey(aid, pid)] || null; }
    function saveEstimation(aid, pid, obj) { var d = load(); d.estimations[estKey(aid, pid)] = obj; save(); }
    function setEstDone(aid, pid, done) {
        var d = load(), k = estKey(aid, pid);
        if (!d.estimations[k]) d.estimations[k] = { done: false, method: '4x4', rows: [] };
        d.estimations[k].done = done; save();
    }
    function procEstStatus(aid, pid) {
        var e = estimation(aid, pid);
        if (!e) return 'TODO';
        if (e.done) return 'DONE';
        return (e.rows && e.rows.some(function (r) { return r.freq && r.severity; })) ? 'DOING' : 'TODO';
    }
    var METHODS = {
        '4x4':      { label: '빈도·강도(4×4)', fMax: 4, sMax: 4 },
        '3step':    { label: '3단계 판단법',    fMax: 3, sMax: 3 },
        'checklist':{ label: '체크리스트법',    fMax: 1, sMax: 1 }
    };
    function methodLabel(m) { return (METHODS[m] || METHODS['4x4']).label; }
    function gradeOf(method, freq, severity) {
        if (!freq || !severity) return { score: 0, grade: '', label: '-', acceptable: null };
        if (method === 'checklist') {
            var ok = freq === 1;
            return { score: ok ? 1 : 9, grade: ok ? 'low' : 'high', label: ok ? '적합(허용)' : '부적합(허용초과)', acceptable: ok };
        }
        var score = freq * severity;
        var g, label;
        var max = method === '3step' ? 9 : 16;
        var ratio = score / max;
        if (ratio >= 0.75) { g = 'critical'; label = '매우높음'; }
        else if (ratio >= 0.5) { g = 'high'; label = '높음'; }
        else if (ratio >= 0.3) { g = 'medium'; label = '보통'; }
        else if (ratio > 0.12) { g = 'low'; label = '낮음'; }
        else { g = 'minimal'; label = '매우낮음'; }
        var acceptable = (g === 'minimal' || g === 'low' || g === 'medium');
        return { score: score, grade: g, label: label, acceptable: acceptable };
    }
    function acceptableOf(method, freq, severity) { return gradeOf(method, freq, severity).acceptable === true; }
    function assessmentProcesses(a) {
        var all = processes(a && a.targetId ? a.targetId : null);
        if (a && a.type === 'OCCASIONAL' && a.scope === 'CHANGES_ONLY' && a.changed_processes && a.changed_processes.length) {
            return all.filter(function (p) { return a.changed_processes.indexOf(p.id) !== -1; });
        }
        return all;
    }
    function measuresOf(aid) {
        return improvements().filter(function (m) { return m.source_type === 'risk_assessment' && m.assessment_id === aid; });
    }
    function completionGate(aid) {
        var ms = measuresOf(aid);
        var doneMeasures = ms.filter(function (m) { return m.status === 'DONE'; });
        var evalDone = true; /* 재설계 후 공정 평가 개념 폐지 */
        var measureDone = ms.length === 0 || doneMeasures.length === ms.length;
        return {
            eval: { ok: evalDone, done: ms.length, total: ms.length },
            measure: { ok: measureDone, done: doneMeasures.length, total: ms.length },
            reassess: { ok: true, done: doneMeasures.length, total: ms.length },
            pass: evalDone && measureDone
        };
    }
    function addAssessment(o) { /* 레거시: 정기 생성 위임 */ return addRegular({ year: o.year, depts: [], surveyAll: '' }); }

    global.DYRSK = global.DYRSK || {};
    var api = {
        /* 스토어 */
        reset: reset, load: load, save: save, today: today, nowTs: nowTs,
        /* 부서 */
        deptName: deptName, deptCandidates: deptCandidates,
        /* 정기 평가 */
        /* 예시 증빙 썸네일 — 무대에서 OS 파일 대화상자를 여는 걸 피하기 위해
           단계별 안내가 이 이미지를 '개선 후 사진'으로 넣는다. 실사용 경로(실제 파일
           선택)는 그대로 남는다 — 증빙 요건을 낮추는 것이 아니라 시연 수단이다. */
        demoShot: function (kind) { return T[(kind === 'before' ? 'b' : 'a') + '2']; },
        /* 이 세션에 올린 파일 내려받기 (양식 받기 실습) */
        stashFile: stashFile, hasFile: hasFile, downloadFile: downloadFile, remindNotify: remindNotify,
        assessments: assessments, assessmentOf: assessmentOf, assessmentYears: assessmentYears,
        addRegular: addRegular, addAssessment: addAssessment, saveAssessment: saveAssessment,
        assessmentProgress: assessmentProgress, deptImpCount: deptImpCount,
        refreshAssessmentStatus: refreshAssessmentStatus, pushHistory: pushHistory,
        /* 유해위험요인 설문조사표 — 등록 이후 목록에서 첨부 (생성 마법사 STEP 아님) */
        setSurveyAll: setSurveyAll, setDeptSurvey: setDeptSurvey, surveyProgress: surveyProgress,
        setReportFile: setReportFile,
        setDeptReport: setDeptReport, deptReportProgress: deptReportProgress,
        /* 보고서 파싱·검수 (검수 단계에서는 내용만 편집, 기한은 다음 단계 모달에서 부서 단위 지정) */
        uploadReport: uploadReport, clearReport: clearReport,
        reviewSet: reviewSet, reviewDel: reviewDel, reviewAdd: reviewAdd,
        deliverFromReview: deliverFromReview,
        /* 2026-11-11 흐름 전환 — 설문 요청 공문 · 보고서+기한 · 조치 요청 공문 · 부서 직접 입력 */
        setDeptDue: setDeptDue, surveyRequested: surveyRequested, surveyLate: surveyLate, sendSurveyRequest: sendSurveyRequest,
        requestAction: requestAction, inputOpen: inputOpen, validDeptRows: validDeptRows,
        setInputDone: setInputDone, undoInputDone: undoInputDone,
        deptStage: deptStage,
        /* 2026-11-13 결정 — D-1 종결 · D-2 입력 재촉 · D-3 추가 요청 · D-4 생성 뒤 고치기 · D-6 근로자 공유 */
        closeNoAction: closeNoAction, noActionClosed: noActionClosed,
        remindInput: remindInput, inputRemindTo: inputRemindTo,
        moreCandidates: moreCandidates, moreOpen: moreOpen, requestMore: requestMore,
        infoEditable: infoEditable, updateRegular: updateRegular, removeRegular: removeRegular,
        SHARE_METHODS: SHARE_METHODS, shareOpen: shareOpen, shareWorkers: shareWorkers,
        /* 개선조치 */
        improvements: improvements, improvementOf: improvementOf, improvementsFor: improvementsFor,
        facilLabel: facilLabel,
        addImprovement: addImprovement, saveImprovement: saveImprovement,
        completeImprovement: completeImprovement, amendImprovement: amendImprovement, completionError: completionError, markReassessed: markReassessed,
        pushImpHistory: pushImpHistory, isOverdue: isOverdue, nextImpId: nextImpId,
        /* 수시 평가 */
        occasionals: occasionals, occasionalOf: occasionalOf, occasionalYears: occasionalYears,
        /* 조치 완료 확인 (별도 축 — status 무변경) */
        confirmOf: confirmOf, confirmState: confirmState, isConfirmed: isConfirmed, isReturned: isReturned,
        needsAction: needsAction,
        confirmImprovement: confirmImprovement, returnImprovement: returnImprovement,
        cancelConfirm: cancelConfirm, confirmCount: confirmCount, docReady: docReady,
        /* 공문(온나라 이관) */
        docs: docs, docsFor: docsFor, latestDoc: latestDoc, pushDoc: pushDoc, receiveDoc: receiveDoc,
        addOccasional: addOccasional, occImprovements: occImprovements, occImpCount: occImpCount, reviewOccasional: reviewOccasional, OCC_REASONS: OCC_REASONS,
        OCC_BASIS: OCC_BASIS, OCC_FORM_FILE: OCC_FORM_FILE, OCC_FORM_READY: OCC_FORM_READY, setOccReviewFile: setOccReviewFile,
        /* 메타 */
        SRC_META: SRC_META, STATUS_META: STATUS_META,
        /* 레거시 호환 */
        processes: processes, processOf: processOf, addProcess: addProcess, saveProcess: saveProcess,
        deleteProcess: deleteProcess, nextHrfId: nextHrfId, autoMapHRF: autoMapHRF,
        assessmentProcesses: assessmentProcesses, measuresOf: measuresOf, completionGate: completionGate,
        estimation: estimation, saveEstimation: saveEstimation, setEstDone: setEstDone, procEstStatus: procEstStatus,
        METHODS: METHODS, methodLabel: methodLabel, gradeOf: gradeOf, acceptableOf: acceptableOf
    };
    Object.keys(api).forEach(function (k) { global.DYRSK[k] = api[k]; });
})(window);
