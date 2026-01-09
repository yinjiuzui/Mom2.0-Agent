import http.server
import socketserver
import os
import threading
import asyncio
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def start_http_server():
    os.chdir(os.path.join(os.path.dirname(__file__), 'templates'))
    PORT = 8000
    Handler = http.server.SimpleHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"HTTP服务器启动: http://localhost:{PORT}/realtime_voice.html")
        httpd.serve_forever()

def start_websocket_server():
    from realtime_voice_server import RealtimeVoiceServer
    server = RealtimeVoiceServer(
        host="localhost",
        port=8765,
        system_instruction="你是一个友好的语音助手，请用简洁、自然的方式回答用户的问题。",
        tts_per=4192,
        llm_model='gemini-3-flash-preview'
    )
    server.run()

if __name__ == "__main__":
    print("=" * 60)
    print("启动实时语音助手服务")
    print("=" * 60)
    
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()
    
    print("\n请在浏览器中访问: http://localhost:8000/realtime_voice.html\n")
    
    try:
        start_websocket_server()
    except KeyboardInterrupt:
        print("\n服务器已停止")
