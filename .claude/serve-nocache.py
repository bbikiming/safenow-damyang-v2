"""검수·시연용 정적 서버 — 캐시 무효화 헤더를 붙여 stale CSS/JS 방지.

python http.server 기본 핸들러는 Cache-Control 을 보내지 않아,
브라우저가 style.css·layout.js 를 옛 버전으로 계속 재사용하는 문제가 있다.
시연 중 "수정했는데 화면이 안 바뀐다" 사고를 막기 위한 개발 전용 서버.

    python3 .claude/serve-nocache.py        # 기본 8785 포트, 프로젝트 루트 서빙
"""
import http.server
import os
import socketserver

import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8785"))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):  # 조용히
        pass


socketserver.TCPServer.allow_reuse_address = True

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"no-cache static server on http://localhost:{PORT}")
        httpd.serve_forever()
