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
                colors: {
                    primary: {
                        50:  '#DFF1E9',
                        100: '#DFF1E9',
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
