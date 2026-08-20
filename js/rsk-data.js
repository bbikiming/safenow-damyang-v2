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
     * r10 — 2026-07-30 회의 반영: 부서별 보고서(dept.reportFile) · 수시평가 실시 사유 6종(고시 §15②) ·
     *       안전관리자 검토파일(occ.reviewFile) · 개선조치 완료일·전자서명 추가. 시드 변경 시 버전 범프. */
    var SKEY = 'damyangRskV2r12';   /* r12 — 개선조치 시드에 시설물 3상태 연결(지정 6·해당 없음 3·미지정 1) */

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
            seqAsmt: 5, seqImp: 210, seqOcc: 2,

            /* 정기 위험성평가: 연도별 1건 원칙, 부서별 조치 상태·기한 관리
             * 2026: 시연 시작점 — **미등록 상태** (사용자가 마법사로 직접 생성해 라이브 시연)
             * 2025: 전 부서 조치완료 · 승인 완료 (참고용) */
            assessments: [
                {
                    id: 'RA-2025-01', year: 2025, type: 'REGULAR', status: 'COMPLETED',
                    title: '2025년 정기 위험성평가', createdAt: '2025-04-01',
                    targetId: 'f_jns', scope: 'ALL', method: '4x4', team: [], worker_participation: false,
                    change_reason: '', changed_processes: [], completed_at: '2025-11-20', approval: '승인',
                    files: { surveyAll: '2025_정기평가_유해위험요인설문조사표.hwpx', report: '2025_정기평가_보고서.hwpx' },
                    review: { stage: 'DELIVERED', extractedAt: '2025-05-15', parsedDepts: {} },
                    depts: [
                        { deptId: 'safety', inspectDate: '2025-05-08', surveyFile: '', status: 'DONE',
                          reportFile: '재난안전과_설문조사표_작성본.hwpx', reportAt: '2025-05-12', reportBy: '재난안전과 · 박안전',
                          deliveredAt: '2025-05-20', dueDate: '2025-07-31', hazards: [] },
                        { deptId: 'env',    inspectDate: '2025-05-10', surveyFile: '', status: 'DONE',
                          reportFile: '환경과_설문조사표_작성본.hwpx', reportAt: '2025-05-13', reportBy: '환경과 · 정환경',
                          deliveredAt: '2025-05-20', dueDate: '2025-08-15', hazards: [] },
                        { deptId: 'water',  inspectDate: '2025-05-14', surveyFile: '', status: 'DONE',
                          reportFile: '물순환사업소_설문조사표_작성본.hwpx', reportAt: '2025-05-16', reportBy: '물순환사업소 · 하정수',
                          deliveredAt: '2025-05-25', dueDate: '2025-09-30', hazards: [] }
                    ],
                    history: [
                        { type: 'CREATE',    at: '2025-04-01', by: '재난안전과 홍길동', memo: '2025 정기평가 생성 · 3개 부서 선정' },
                        { type: 'DELIVER',   at: '2025-05-20', by: '재난안전과 홍길동', memo: '전 부서 개선조치 전달 (총 8건)' },
                        { type: 'CONFIRM',   at: '2025-10-05', by: '박안전', memo: '전 부서 조치 완료 확인 (8건)' },
                        { type: 'DISPATCH',  at: '2025-11-10', by: '박안전', memo: '공문 온나라 상신 — 2025년 정기 위험성평가 개선조치 완료 확인 결과 통보 (재난안전과-2025-412)' },
                        { type: 'RECEIVE',   at: '2025-11-18', by: '온나라', memo: '결재 회신 — 결재완료' },
                        { type: 'COMPLETE',  at: '2025-11-20', by: '재난안전과 홍길동', memo: '전 부서 조치완료 · 보고서 승인' }
                    ]
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

            /* 개선조치 —
             *  · **2025 = 완성된 사례**(시연 첫 화면의 '이미 끝난 모습'). 전달 → 완료(증빙·서명)
             *    → 주관부서 확인(confirm.state OK) → 공문 상신·결재완료 까지 다 채워 둔다.
             *    2026 을 라이브로 만드는 시연이 중간에 막혀도 **주무관이 완성형을 조작 없이 볼 수 있어야** 한다.
             *  · **2026 = 비어 있음**(마법사로 직접 생성해 라이브 시연) — 이 의도는 유지한다.
             *  · 증빙 썸네일은 코드 안 data-URI(96~160px, 각 1~2KB)다. 실제 파일 저장소가 없는
             *    프로토타입에서 '전·후 대조'를 보여주는 유일한 방법이고, 용량은 전체 14KB 수준이다. */
            improvements: [
                {
                    id: 'IMP-201', source_type: 'risk_assessment', assessment_id: 'RA-2025-01', dept_id: 'safety',
                    target_id: '', process_id: '', occ_id: '',
                    hazard: { name: '옥상 점검통로 안전난간 미설치', category: '물리적', cause: '난간 미설치 구간 30m', basis: '', facilNo: 'AR1968-0000226', facilNm: '담양군청(본관동)' },
                    hazard_risk_factor: '옥상 점검통로 안전난간 미설치',
                    description: '점검통로 전 구간 안전난간(H=1.2m) 설치 및 추락주의 표지 부착', action: '점검통로 전 구간 안전난간(H=1.2m) 설치 및 추락주의 표지 부착',
                    assigned_to: '재난안전과 · 안전관리 주무관 / 박안전', due: '2025-07-31', due_date: '2025-07-31',
                    before_photo: '옥상난간_개선전.jpg', after_photo: '옥상난간_개선후.jpg',
                    before_photos: [{ name: '옥상난간_개선전.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.b1 }], after_photos: [{ name: '옥상난간_개선후.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.a1 }],
                    action_content: '점검통로 전 구간 안전난간(H=1.2m) 설치 및 추락주의 표지 부착 완료', completed_date: '2025-07-18',
                    signature: { by: '박안전', at: '2025-07-18' },
                    status: 'DONE', reassessed: true, created: '2025-05-20',
                    /* 주관부서 확인까지 끝난 완성 사례 — 공문 상신의 전제 */
                    confirm: { state: 'OK', by: '박안전', at: '2025-08-01', reason: '', round: 1 },
                    history: [
                        { type: 'NOTIFY',  at: '2025-05-20 10:00', by: '재난안전과', memo: '개선조치 전달 (기한 2025-07-31)' },
                        { type: 'STATUS',  at: '2025-07-18 16:20', by: '박안전', memo: '완료 처리 · 완료일 2025-07-18 · 전자서명 박안전' },
                        { type: 'CONFIRM', at: '2025-08-01 09:40', by: '박안전', memo: '조치 완료 확인' }
                    ]
                },
                {
                    id: 'IMP-202', source_type: 'risk_assessment', assessment_id: 'RA-2025-01', dept_id: 'safety',
                    target_id: '', process_id: '', occ_id: '',
                    hazard: { name: '비상발전기실 소화기 미비치', category: '화학적', cause: '소화기 노후·수량 부족', basis: '', facilNo: 'AR1968-0000226', facilNm: '담양군청(본관동)' },
                    hazard_risk_factor: '비상발전기실 소화기 미비치',
                    description: 'ABC분말소화기 4대 교체 비치 및 점검표 부착', action: 'ABC분말소화기 4대 교체 비치 및 점검표 부착',
                    assigned_to: '재난안전과 · 안전관리담당 / 박담당', due: '2025-07-31', due_date: '2025-07-31',
                    before_photo: false, after_photo: '발전기실_개선후.jpg',
                    before_photos: [], after_photos: [{ name: '발전기실_개선후.jpg', size: 152000, type: 'image/jpeg' }],
                    action_content: 'ABC분말소화기 4대 교체 비치 및 점검표 부착 완료', completed_date: '2025-07-22',
                    signature: { by: '박담당', at: '2025-07-22' },
                    status: 'DONE', reassessed: true, created: '2025-05-20',
                    /* 주관부서 확인까지 끝난 완성 사례 — 공문 상신의 전제 */
                    confirm: { state: 'OK', by: '박안전', at: '2025-08-01', reason: '', round: 1 },
                    history: [
                        { type: 'NOTIFY',  at: '2025-05-20 10:00', by: '재난안전과', memo: '개선조치 전달 (기한 2025-07-31)' },
                        { type: 'STATUS',  at: '2025-07-22 16:20', by: '박담당', memo: '완료 처리 · 완료일 2025-07-22 · 전자서명 박담당' },
                        { type: 'CONFIRM', at: '2025-08-01 09:40', by: '박안전', memo: '조치 완료 확인' }
                    ]
                },
                {
                    id: 'IMP-203', source_type: 'risk_assessment', assessment_id: 'RA-2025-01', dept_id: 'env',
                    target_id: '', process_id: '', occ_id: '',
                    hazard: { name: '폐기물 적치장 붕괴 위험', category: '물리적', cause: '적치 높이 기준 초과', basis: '' },
                    hazard_risk_factor: '폐기물 적치장 붕괴 위험',
                    description: '적치 높이 제한선 도색 및 방호벽 설치, 주 1회 점검 지정', action: '적치 높이 제한선 도색 및 방호벽 설치, 주 1회 점검 지정',
                    assigned_to: '환경과 · 유해·위험요인 담당 주무관 / 정환경', due: '2025-08-15', due_date: '2025-08-15',
                    before_photo: '적치장_개선전.jpg', after_photo: '적치장_개선후.jpg',
                    before_photos: [{ name: '적치장_개선전.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.b4 }], after_photos: [{ name: '적치장_개선후.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.a4 }],
                    action_content: '적치 높이 제한선 도색 및 방호벽 설치, 주 1회 점검 지정 완료', completed_date: '2025-08-05',
                    signature: { by: '정환경', at: '2025-08-05' },
                    status: 'DONE', reassessed: true, created: '2025-05-20',
                    /* 주관부서 확인까지 끝난 완성 사례 — 공문 상신의 전제 */
                    confirm: { state: 'OK', by: '박안전', at: '2025-08-20', reason: '', round: 1 },
                    history: [
                        { type: 'NOTIFY',  at: '2025-05-20 10:00', by: '재난안전과', memo: '개선조치 전달 (기한 2025-08-15)' },
                        { type: 'STATUS',  at: '2025-08-05 16:20', by: '정환경', memo: '완료 처리 · 완료일 2025-08-05 · 전자서명 정환경' },
                        { type: 'CONFIRM', at: '2025-08-20 09:40', by: '박안전', memo: '조치 완료 확인' }
                    ]
                },
                {
                    id: 'IMP-204', source_type: 'risk_assessment', assessment_id: 'RA-2025-01', dept_id: 'env',
                    target_id: '', process_id: '', occ_id: '',
                    hazard: { name: '자원순환팀 파쇄기 방호덮개 파손', category: '기계적', cause: '덮개 균열·고정볼트 이완', basis: '', facilNa: true },
                    hazard_risk_factor: '자원순환팀 파쇄기 방호덮개 파손',
                    description: '방호덮개 교체 및 비상정지 스위치 동작 점검', action: '방호덮개 교체 및 비상정지 스위치 동작 점검',
                    assigned_to: '환경과 · 주무관 / 정수빈', due: '2025-08-15', due_date: '2025-08-15',
                    before_photo: false, after_photo: '파쇄기_개선후.jpg',
                    before_photos: [], after_photos: [{ name: '파쇄기_개선후.jpg', size: 152000, type: 'image/jpeg' }],
                    action_content: '방호덮개 교체 및 비상정지 스위치 동작 점검 완료', completed_date: '2025-08-11',
                    signature: { by: '정수빈', at: '2025-08-11' },
                    status: 'DONE', reassessed: true, created: '2025-05-20',
                    /* 주관부서 확인까지 끝난 완성 사례 — 공문 상신의 전제 */
                    confirm: { state: 'OK', by: '박안전', at: '2025-08-20', reason: '', round: 1 },
                    history: [
                        { type: 'NOTIFY',  at: '2025-05-20 10:00', by: '재난안전과', memo: '개선조치 전달 (기한 2025-08-15)' },
                        { type: 'STATUS',  at: '2025-08-11 16:20', by: '정수빈', memo: '완료 처리 · 완료일 2025-08-11 · 전자서명 정수빈' },
                        { type: 'CONFIRM', at: '2025-08-20 09:40', by: '박안전', memo: '조치 완료 확인' }
                    ]
                },
                {
                    id: 'IMP-205', source_type: 'risk_assessment', assessment_id: 'RA-2025-01', dept_id: 'water',
                    target_id: '', process_id: '', occ_id: '',
                    hazard: { name: '정수장 약품투입실 환기 불량', category: '화학적', cause: '국소배기장치 용량 부족', basis: '', facilNo: 'WS1996-0000011', facilNm: '신계정수장' },
                    hazard_risk_factor: '정수장 약품투입실 환기 불량',
                    description: '국소배기장치 2대 증설 및 MSDS 게시, 보호구 비치', action: '국소배기장치 2대 증설 및 MSDS 게시, 보호구 비치',
                    assigned_to: '물순환사업소 · 주무관 / 하정수', due: '2025-09-30', due_date: '2025-09-30',
                    before_photo: '약품실_개선전.jpg', after_photo: '약품실_개선후.jpg',
                    before_photos: [{ name: '약품실_개선전.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.b2 }], after_photos: [{ name: '약품실_개선후.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.a2 }],
                    action_content: '국소배기장치 2대 증설 및 MSDS 게시, 보호구 비치 완료', completed_date: '2025-09-12',
                    signature: { by: '하정수', at: '2025-09-12' },
                    status: 'DONE', reassessed: true, created: '2025-05-20',
                    /* 주관부서 확인까지 끝난 완성 사례 — 공문 상신의 전제 */
                    confirm: { state: 'OK', by: '박안전', at: '2025-10-05', reason: '', round: 1 },
                    history: [
                        { type: 'NOTIFY',  at: '2025-05-20 10:00', by: '재난안전과', memo: '개선조치 전달 (기한 2025-09-30)' },
                        { type: 'STATUS',  at: '2025-09-12 16:20', by: '하정수', memo: '완료 처리 · 완료일 2025-09-12 · 전자서명 하정수' },
                        { type: 'CONFIRM', at: '2025-10-05 09:40', by: '박안전', memo: '조치 완료 확인' }
                    ]
                },
                {
                    id: 'IMP-206', source_type: 'risk_assessment', assessment_id: 'RA-2025-01', dept_id: 'water',
                    target_id: '', process_id: '', occ_id: '',
                    hazard: { name: '침전지 개구부 추락 위험', category: '물리적', cause: '개구부 덮개·난간 미설치', basis: '', facilNo: 'WS1996-0000011', facilNm: '신계정수장' },
                    hazard_risk_factor: '침전지 개구부 추락 위험',
                    description: '개구부 안전덮개 6개소 설치 및 추락주의 표지 부착', action: '개구부 안전덮개 6개소 설치 및 추락주의 표지 부착',
                    assigned_to: '물순환사업소 · 주무관 / 하정수', due: '2025-09-30', due_date: '2025-09-30',
                    before_photo: '개구부_개선전.jpg', after_photo: '개구부_개선후.jpg',
                    before_photos: [{ name: '개구부_개선전.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.b1 }], after_photos: [{ name: '개구부_개선후.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.a1 }],
                    action_content: '개구부 안전덮개 6개소 설치 및 추락주의 표지 부착 완료', completed_date: '2025-09-18',
                    signature: { by: '하정수', at: '2025-09-18' },
                    status: 'DONE', reassessed: true, created: '2025-05-20',
                    /* 주관부서 확인까지 끝난 완성 사례 — 공문 상신의 전제 */
                    confirm: { state: 'OK', by: '박안전', at: '2025-10-05', reason: '', round: 1 },
                    history: [
                        { type: 'NOTIFY',  at: '2025-05-20 10:00', by: '재난안전과', memo: '개선조치 전달 (기한 2025-09-30)' },
                        { type: 'STATUS',  at: '2025-09-18 16:20', by: '하정수', memo: '완료 처리 · 완료일 2025-09-18 · 전자서명 하정수' },
                        { type: 'CONFIRM', at: '2025-10-05 09:40', by: '박안전', memo: '조치 완료 확인' }
                    ]
                },
                {
                    id: 'IMP-207', source_type: 'risk_assessment', assessment_id: 'RA-2025-01', dept_id: 'water',
                    target_id: '', process_id: '', occ_id: '',
                    hazard: { name: '전기 분전반 시건장치 미설치', category: '전기적', cause: '분전반 개방 상태 방치', basis: '', facilNo: 'ST1999-0000017', facilNm: '담양하수종말처리장' },
                    hazard_risk_factor: '전기 분전반 시건장치 미설치',
                    description: '분전반 6면 시건장치 설치 및 활선 경고표지 부착', action: '분전반 6면 시건장치 설치 및 활선 경고표지 부착',
                    assigned_to: '물순환사업소 · 주무관 / 오수질', due: '2025-09-30', due_date: '2025-09-30',
                    before_photo: '분전반_개선전.jpg', after_photo: '분전반_개선후.jpg',
                    before_photos: [{ name: '분전반_개선전.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.b3 }], after_photos: [{ name: '분전반_개선후.jpg', size: 184320, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.a3 }],
                    action_content: '분전반 6면 시건장치 설치 및 활선 경고표지 부착 완료', completed_date: '2025-09-25',
                    signature: { by: '오수질', at: '2025-09-25' },
                    status: 'DONE', reassessed: true, created: '2025-05-20',
                    /* 주관부서 확인까지 끝난 완성 사례 — 공문 상신의 전제 */
                    confirm: { state: 'OK', by: '박안전', at: '2025-10-05', reason: '', round: 1 },
                    history: [
                        { type: 'NOTIFY',  at: '2025-05-20 10:00', by: '재난안전과', memo: '개선조치 전달 (기한 2025-09-30)' },
                        { type: 'STATUS',  at: '2025-09-25 16:20', by: '오수질', memo: '완료 처리 · 완료일 2025-09-25 · 전자서명 오수질' },
                        { type: 'CONFIRM', at: '2025-10-05 09:40', by: '박안전', memo: '조치 완료 확인' }
                    ]
                },
                {
                    id: 'IMP-208', source_type: 'risk_assessment', assessment_id: 'RA-2025-01', dept_id: 'water',
                    target_id: '', process_id: '', occ_id: '',
                    hazard: { name: '슬러지 이송 컨베이어 비상정지 미작동', category: '기계적', cause: '비상정지 스위치 접점 불량', basis: '', facilNa: true },
                    hazard_risk_factor: '슬러지 이송 컨베이어 비상정지 미작동',
                    description: '비상정지 스위치 전량 교체 및 월 1회 작동 점검 지정', action: '비상정지 스위치 전량 교체 및 월 1회 작동 점검 지정',
                    assigned_to: '물순환사업소 · 시설 담당 / 서담당', due: '2025-09-30', due_date: '2025-09-30',
                    before_photo: false, after_photo: '컨베이어_개선후.jpg',
                    before_photos: [], after_photos: [{ name: '컨베이어_개선후.jpg', size: 152000, type: 'image/jpeg' }],
                    action_content: '비상정지 스위치 전량 교체 및 월 1회 작동 점검 지정 완료', completed_date: '2025-09-29',
                    signature: { by: '서담당', at: '2025-09-29' },
                    status: 'DONE', reassessed: true, created: '2025-05-20',
                    /* 주관부서 확인까지 끝난 완성 사례 — 공문 상신의 전제 */
                    confirm: { state: 'OK', by: '박안전', at: '2025-10-05', reason: '', round: 1 },
                    history: [
                        { type: 'NOTIFY',  at: '2025-05-20 10:00', by: '재난안전과', memo: '개선조치 전달 (기한 2025-09-30)' },
                        { type: 'STATUS',  at: '2025-09-29 16:20', by: '서담당', memo: '완료 처리 · 완료일 2025-09-29 · 전자서명 서담당' },
                        { type: 'CONFIRM', at: '2025-10-05 09:40', by: '박안전', memo: '조치 완료 확인' }
                    ]
                }
                ,
                {
                    id: 'IMP-209', source_type: 'occasional', assessment_id: '', dept_id: 'water',
                    target_id: '', process_id: '', occ_id: 'OCC-2026-01',
                    hazard: { name: '밸브실 고압 배관 파손 시 수증기 분출', category: '물리적', cause: '노후 밸브·차폐 부재', basis: '', facilNo: 'WS2008-0000016', facilNm: '담양지방상수도' },
                    hazard_risk_factor: '밸브실 고압 배관 파손 시 수증기 분출',
                    description: '노후 밸브 3개소 교체 및 작업 전 차단 절차 게시, 보호구 비치',
                    action: '노후 밸브 3개소 교체 및 작업 전 차단 절차 게시, 보호구 비치',
                    assigned_to: '물순환사업소 · 시설 담당 / 서담당', due: '2026-06-30', due_date: '2026-06-30',
                    before_photo: '밸브실_개선전.jpg', after_photo: '밸브실_개선후.jpg',
                    before_photos: [{ name: '밸브실_개선전.jpg', size: 176000, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.b2 }],
                    after_photos: [{ name: '밸브실_개선후.jpg', size: 168000, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.a2 }],
                    action_content: '노후 밸브 3개소 교체 완료, 차단 절차 게시 및 보호구 비치',
                    completed_date: '2026-06-24',
                    signature: { by: '서담당', at: '2026-06-24' },
                    status: 'DONE', reassessed: true, created: '2026-05-21',
                    confirm: { state: 'OK', by: '박안전', at: '2026-06-27', reason: '', round: 1 },
                    history: [
                        { type: 'NOTIFY',  at: '2026-05-21 11:10', by: '물순환사업소', memo: '수시평가(OCC-2026-01) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-06-30)' },
                        { type: 'STATUS',  at: '2026-06-24 15:40', by: '서담당', memo: '완료 처리 · 완료일 2026-06-24 · 전자서명 서담당' },
                        { type: 'CONFIRM', at: '2026-06-27 09:20', by: '박안전', memo: '조치 완료 확인' }
                    ]
                },
                {
                    id: 'IMP-210', source_type: 'occasional', assessment_id: '', dept_id: 'env',
                    target_id: '', process_id: '', occ_id: 'OCC-2026-02',
                    hazard: { name: '신규 압축기 회전부 끼임 위험', category: '기계적', cause: '방호덮개 미설치 상태 반입', basis: '', facilNa: true },
                    hazard_risk_factor: '신규 압축기 회전부 끼임 위험',
                    description: '방호덮개 설치 및 비상정지 스위치 설치, 취급자 특별교육 실시',
                    action: '방호덮개 설치 및 비상정지 스위치 설치, 취급자 특별교육 실시',
                    assigned_to: '환경과 · 주무관 / 정수빈', due: '2026-08-31', due_date: '2026-08-31',
                    before_photo: '압축기_개선전.jpg', after_photo: false,
                    before_photos: [{ name: '압축기_개선전.jpg', size: 181000, type: 'image/jpeg', w: 1600, h: 1200, thumb: T.b3 }],
                    after_photos: [],
                    action_content: '', completed_date: '', signature: null,
                    status: 'IN_PROGRESS', reassessed: false, created: '2026-06-16',
                    history: [
                        { type: 'NOTIFY', at: '2026-06-16 14:00', by: '환경과', memo: '수시평가(OCC-2026-02) 실시 결과 — 위험성 감소대책 등록 (조치기한 2026-08-31)' }
                    ]
                }
            ],

            /* 공문(온나라 이관) — 2025 완성 사례 1건.
             * 초기 화면에서 [문서 보기]로 표준 공문 서식을 조작 없이 열어볼 수 있게 한다. */
            seqDoc: 1,
            docs: [
                {
                    sid: 'RD-1', kind: 'assessment', target: 'A|RA-2025-01', aid: 'RA-2025-01', deptId: '',
                    no: '재난안전과-2025-412', docType: '외부발송',
                    title: '2025년 정기 위험성평가 개선조치 완료 확인 결과 통보',
                    to: '수신자 참조(재난안전과장, 환경과장, 물순환사업소장)',
                    body: '1. 관련: 산업안전보건법 제36조에 따른 2025년 정기 위험성평가 실시 계획(재난안전과-2025-118, 2025. 4. 1.)\n\n' +
                          '2. 위 호와 관련하여 2025년 정기 위험성평가에 따라 각 부서에 전달한 개선조치의 이행 결과를 확인하였기에 아래와 같이 통보합니다.\n\n' +
                          '  가. 대상 부서: 3개 부서(재난안전과, 환경과, 물순환사업소)\n\n' +
                          '  나. 개선조치: 8건(전 건 조치 완료 및 확인)\n\n' +
                          '  다. 확인 방법: 개선 전·후 사진 및 담당자 전자서명 대조\n\n' +
                          '3. 아울러 각 부서에서는 조치 완료 사항이 지속 유지될 수 있도록 관리하여 주시기 바랍니다.',
                    basis: ['osh-36'],
                    attach: [{ label: '부서별 개선조치 확인 결과표', auto: true },
                             { label: '개선 전·후 증빙 사진철', auto: true }],
                    files: [],
                    line: [{ dept: '재난안전과', role: '중대재해팀장', name: '김중대' },
                           { dept: '재난안전과', role: '재난안전과장', name: '홍길동' }],
                    status: '결재완료', at: '2025-11-10 14:20', by: '박안전',
                    log: [
                        { at: '2025-11-10 14:20', st: '결재중',   by: '박안전', memo: '온나라 상신' },
                        { at: '2025-11-18 10:05', st: '결재완료', by: '온나라', memo: '' }
                    ]
                }
            ],

            /* 수시 위험성평가 (사유별 등록·검토) */
            occasionals: [
                {
                    id: 'OCC-2026-01', year: 2026, deptId: 'water', reason: 'ACCIDENT',
                    date: '2026-05-20', desc: '정수장 밸브실 작업 중 밸브 파손으로 수증기 분출 · 경상 1명',
                    files: [{ name: '재해_현장_사진.zip' }, { name: '경위서.hwpx' }],
                    status: 'REVIEWED', reviewedAt: '2026-05-25', hazardCount: 1,
                    /* 검토 완료의 근거는 안전관리자가 서명한 파일이다 (외부 용역이라 전자결재 불가) */
                    reviewFile: 'OCC-2026-01_안전관리자검토_서명본.pdf', reviewer: '한국안전기술원 이안전',
                    history: [
                        { type: 'REGISTER', at: '2026-05-21', by: '물순환사업소 서담당',   memo: '수시평가 등록 (사유: 중대산업사고 또는 산업재해 발생)' },
                        { type: 'STATUS',   at: '2026-05-21', by: '물순환사업소 서담당',   memo: '위험성 감소대책 1건 등록 — 개선조치로 전환' },
                        { type: 'REVIEW',   at: '2026-05-25', by: '한국안전기술원 이안전', memo: '안전관리자 검토파일 등록 · OCC-2026-01_안전관리자검토_서명본.pdf → 검토 완료' }
                    ]
                },
                {
                    id: 'OCC-2026-02', year: 2026, deptId: 'env', reason: 'EQUIP_CHANGE',
                    date: '2026-06-15', desc: '자원순환팀 신규 압축기 도입 · 위험성 재평가 필요',
                    files: [{ name: '설비사양서.pdf' }],
                    status: 'REGISTERED', hazardCount: 1,
                    history: [
                        { type: 'REGISTER', at: '2026-06-16', by: '환경과 정수빈', memo: '수시평가 등록 (사유: 기계·설비·원재료 신규 도입·변경)' },
                        { type: 'STATUS',   at: '2026-06-16', by: '환경과 정수빈', memo: '위험성 감소대책 1건 등록 — 개선조치로 전환' }
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
    function reset() { db = seed(); save(); return db; }

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
        var a = {
            id: 'RA-' + o.year + '-' + String(10 + d.seqAsmt).slice(-2),
            year: o.year, type: 'REGULAR', status: 'IN_PROGRESS',
            title: o.year + '년 정기 위험성평가', createdAt: today(),
            targetId: '', scope: 'ALL', method: '4x4', team: [], worker_participation: false,
            change_reason: '', changed_processes: [], completed_at: '', approval: '',
            files: { surveyAll: o.surveyAll || '', report: '' },
            review: { stage: 'NONE', extractedAt: '', parsedDepts: {} },
            depts: deptPayload,
            history: [
                { type: 'CREATE', at: today(), by: '재난안전과',
                  memo: '정기평가 생성 · ' + deptCount + '개 부서 선정' },
                /* 설문조사표는 생성 이후 목록에서 첨부하므로, 생성 시 통보는 점검예정일까지다 */
                { type: 'NOTIFY', at: today(), by: '재난안전과',
                  memo: deptCount + '개 부서에 점검예정일 통보' }
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
        pushHistory(aid, { type: 'FILE', by: '재난안전과',
            memo: fileName ? '공통 유해위험요인 설문조사표 첨부 · ' + fileName : '공통 유해위험요인 설문조사표 삭제' });
        save(); return a;
    }
    function setDeptSurvey(aid, deptId, fileName) {
        var a = assessmentOf(aid); if (!a) return null;
        var dp = (a.depts || []).filter(function (x) { return x.deptId === deptId; })[0];
        if (!dp) return null;
        dp.surveyFile = fileName || '';
        pushHistory(aid, { type: 'FILE', by: '재난안전과',
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
        dp.reportBy = fileName ? (by || '재난안전과') : '';
        pushHistory(aid, { type: 'FILE', by: by || '재난안전과',
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
        pushHistory(aid, { type: 'FILE', by: '재난안전과',
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
            dp.status = (c.total === 0 || c.done === c.total) ? 'DONE' : 'BEFORE';
        });
        var actionable = a.depts.filter(function (dp) {
            return deptImpCount(aid, dp.deptId).total > 0;
        });
        var allDone = actionable.length > 0 && actionable.every(function (dp) { return dp.status === 'DONE'; });
        if (allDone) {
            a.status = 'COMPLETED';
            a.completed_at = today();
            a.history = a.history || [];
            a.history.push({ type: 'COMPLETE', at: nowTs(), by: '시스템', memo: '전 부서 조치완료 · 평가 자동 완료' });
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
    function uploadReport(aid, fileName) {
        var a = assessmentOf(aid); if (!a) return null;
        a.files = a.files || {}; a.files.report = fileName || (a.year + '_정기평가_보고서.hwpx');
        /* 부서별 빈 작성표를 연다 — 자동 추출 없음 */
        var parsed = {};
        (a.depts || []).forEach(function (dp) { parsed[dp.deptId] = []; });
        a.review = { stage: 'REVIEW', extractedAt: nowTs(), parsedDepts: parsed };
        a.history = a.history || [];
        a.history.push({ type: 'STATUS', at: nowTs(), by: '재난안전과',
            memo: '보고서 첨부 · 부서별 개선조치 작성 시작 (' + (a.depts || []).length + '개 부서)' });
        save();
        return { deptCount: (a.depts || []).length, totalCount: 0 };
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
                pushHistory(aid, { type: 'REVIEW', by: '재난안전과',
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
                var hist = [{ type: 'NOTIFY', at: nowTs(), by: '재난안전과',
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
        pushHistory(aid, { type: 'DELIVER', by: '재난안전과', memo: deliverMemo });
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
        m.confirm = { state: CFM_OK, by: by || '재난안전과', at: today(), reason: '', round: prev.round || 1 };
        m.history = m.history || [];
        m.history.push({ type: 'CONFIRM', at: nowTs(), by: by || '재난안전과',
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
        m.confirm = { state: CFM_RETURN, by: by || '재난안전과', at: today(), reason: r, round: prev.round || 1 };
        m.history = m.history || [];
        m.history.push({ type: 'RETURN', at: nowTs(), by: by || '재난안전과', memo: '조치 확인 반려 — ' + r });
        save(); return m;
    }
    /* 확인 취소 — 상신 전에만. 잠금 판정은 화면(DYRSKDOC.lockOf)이 하고 여기선 상태만 되돌린다. */
    function cancelConfirm(id, by) {
        var m = improvementOf(id); if (!m) return { error: '개선조치를 찾을 수 없습니다.' };
        var prev = confirmOf(m);
        m.confirm = { state: CFM_WAIT, by: '', at: '', reason: '', round: prev.round || 1 };
        m.history = m.history || [];
        m.history.push({ type: 'REOPEN', at: nowTs(), by: by || '재난안전과', memo: '확인 취소 — 확인 대기로 되돌림' });
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
        return c.total > 0 && c.done === c.total && c.ok === c.total;
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
            line: (o.line || []).slice(),
            status: o.status || '결재중', at: o.at || nowTs(), by: o.by || '',
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
     * 실시 사유 6종은 **사업장 위험성평가에 관한 지침(고시) 제15조제2항**이 정한 법정 트리거다.
     * 임의로 만든 분류가 아니라 조문 각 호를 그대로 옮긴 것이므로, 고치려면 조문을 먼저 열어본다
     * (DYLAW 'rae-15' — CLAUDE.md §10 검증 6문 #1·#5).
     *
     * 발주처 요구(2026-07-30): "제일 중요한 거는 법 규정이 첫 번째가 들어가야지 눌렀을 때
     *   그 해당 사항을 들어가야지만이 수시 평가 등록을 할 수가 있어요. … 그 목록을 먼저
     *   만들어줘야지 수시 평가를 등록을 하는데" → 사유를 고르는 것이 등록의 진입점이다.
     * ACCIDENT·EQUIP_CHANGE·OTHER 키는 기존 저장 데이터와 이어지도록 그대로 둔다. */
    var OCC_REASONS = {
        BUILDING:     { no: 1, label: '건설물 설치·이전·변경·해체',        tone: 'warning',
                        desc: '사업장 건설물을 새로 세우거나 옮기거나 바꾸거나 헐 때' },
        EQUIP_CHANGE: { no: 2, label: '기계·설비·원재료 신규 도입·변경',    tone: 'warning',
                        desc: '기계·기구, 설비, 원재료 등을 새로 들이거나 바꿀 때' },
        REPAIR:       { no: 3, label: '건설물·기계·설비 정비 또는 보수',    tone: 'info',
                        desc: '정비·보수 작업 시. 다만 주기적·반복 작업으로 이미 평가한 경우는 제외' },
        METHOD:       { no: 4, label: '작업방법·작업절차 신규 도입·변경',   tone: 'info',
                        desc: '작업 방법이나 절차를 새로 도입하거나 바꿀 때' },
        ACCIDENT:     { no: 5, label: '중대산업사고 또는 산업재해 발생',    tone: 'danger',
                        desc: '휴업 이상의 요양을 요하는 재해. 재해발생 작업은 작업 재개 전에 실시해야 한다' },
        OTHER:        { no: 6, label: '그 밖에 필요하다고 판단한 경우',      tone: 'neutral',
                        desc: '위 5가지에 해당하지 않지만 추가 위험요인이 생겼다고 판단할 때' }
    };
    var OCC_BASIS = 'rae-15';   /* 위 6종의 근거 조문 (DYLAW) */
    /* 수시평가 작성 양식 — 발주처: "수시 HWP x로 하면 되나요? 네 x로 해 주세요"
     * 양식 안에 안전관리자 확인·서명란이 포함된다("안전 관리자 서명하는 란을 추가로 만들어야"). */
    var OCC_FORM_FILE = '수시_위험성평가_작성양식.hwpx';
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
        if (arr.indexOf(new Date().getFullYear()) === -1) arr.push(2026);
        return arr.sort(function (a, b) { return b - a; });
    }
    function addOccasional(o) {
        var d = load(); d.seqOcc++;
        var it = {
            id: 'OCC-' + o.year + '-' + String(10 + d.seqOcc).slice(-2),
            year: o.year, deptId: o.deptId, reason: o.reason,
            date: o.date, desc: o.desc || '',
            files: o.files || [], status: 'REGISTERED',
            /* 재해 발생(고시 §15② 5호) 전용 — 5호만 "작업을 재개하기 전에" 라는 단서가 붙어
               재개 예정일이 곧 법정 기한이 된다. 다른 사유에는 비어 있다. */
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
        /* 수시평가는 '실시했다'로 끝나지 않는다 — 고시 §15②의 트리거로 실시한 평가도
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
        it.reviewFile = fileName || '';
        it.reviewer = fileName ? (reviewer || '') : '';
        if (fileName) {
            it.status = 'REVIEWED'; it.reviewedAt = reviewedAt || today();
            it.history.push({ type: 'REVIEW', at: nowTs(), by: reviewer || '안전관리자',
                memo: '안전관리자 검토파일 등록 · ' + fileName + ' → 검토 완료' });
        } else {
            it.status = 'REGISTERED'; it.reviewedAt = '';
            it.history.push({ type: 'REVIEW', at: nowTs(), by: '재난안전과', memo: '검토파일 삭제 · 검토 완료 해제' });
        }
        save(); return it;
    }
    function reviewOccasional(id, by) {
        var it = occasionalOf(id); if (!it) return;
        it.status = 'REVIEWED'; it.reviewedAt = today();
        it.history.push({ type: 'REVIEW', at: nowTs(), by: by || '재난안전과', memo: '검토 완료' });
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
        OCC_BASIS: OCC_BASIS, OCC_FORM_FILE: OCC_FORM_FILE, setOccReviewFile: setOccReviewFile,
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
