/* =========================================================================
 * Tailwind CDN 공통 설정 — 담양군 중대재해예방 시스템
 *
 * 모든 페이지에서 Tailwind CDN(<script src="https://cdn.tailwindcss.com">) 직후
 * 본 파일을 로드. primary 컬러는 시안 그린(--main 계열)으로 매핑.
 *
 *   <script src="https://cdn.tailwindcss.com"></script>
 *   <script src="./js/tailwind-config.js"></script>
 * ========================================================================= */
(function () {
    'use strict';
    if (typeof window.tailwind === 'undefined') return;
    window.tailwind.config = {
        theme: {
            extend: {
                /* 값은 css/style.css :root 브랜드 토큰과 동기화 — 여기서 새 색을 만들지 않는다.
                 * primary.N ↔ --brand-N, sidebar ↔ --page-bg. 토큰 변경 시 이 표도 함께 고칠 것. */
                colors: {
                    primary: {
                        50:  '#F1FAF5',   /* --brand-50 */
                        100: '#DFF1E9',   /* --brand-100 */
                        500: '#5FB897',
                        600: '#2D9270',
                        700: '#24785C',
                        900: '#0F3D2E',
                    },
                    sidebar: '#F2F4F3',
                }
            }
        }
    };
})();
