# -*- coding: utf-8 -*-
"""
Super Mom 工作台后端服务器
整合语音识别、LLM对话、TTS合成功能
"""

import asyncio
import websockets
import json
import base64
import os
import sys
from pathlib import Path
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
import threading

# 添加路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Audio'))

from Audio.realtime_voice_server import RealtimeVoiceHandler
from Audio.baidu_asr import asr
from supermom_config import (
    VOICE_SETTINGS, 
    SYSTEM_PROMPTS, 
    POMODORO_AUDIO_PATH,
    POMODORO_REPEAT_TIMES,
    LLM_MODEL,
    WEBSOCKET_HOST,
    WEBSOCKET_PORT,
    HTTP_HOST,
    HTTP_PORT
)

# ===========================
# Flask HTTP Server
# ===========================

app = Flask(__name__, static_folder='supermom_frontend/build', static_url_path='')
CORS(app)

@app.route('/')
def serve_frontend():
    """提供前端页面"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/pomodoro-audio', methods=['GET'])
def get_pomodoro_audio():
    """返回番茄钟完成音频的base64编码"""
    try:
        audio_path = os.path.join(os.path.dirname(__file__), POMODORO_AUDIO_PATH)
        
        if not os.path.exists(audio_path):
            return jsonify({
                'error': True,
                'message': f'音频文件不存在: {audio_path}'
            }), 404
        
        with open(audio_path, 'rb') as f:
            audio_data = f.read()
        
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        return jsonify({
            'error': False,
            'audio': audio_base64,
            'repeat_times': POMODORO_REPEAT_TIMES,
            'format': 'mp3'
        })
    
    except Exception as e:
        return jsonify({
            'error': True,
            'message': str(e)
        }), 500

@app.route('/api/asr', methods=['POST'])
def speech_to_text():
    """语音转文字接口 - 用于贴心备忘录"""
    print("\n" + "="*60)
    print("[ASR] 收到语音识别请求")
    try:
        data = request.json
        audio_base64 = data.get('audio')
        
        if not audio_base64:
            print("[ASR] 错误: 缺少音频数据")
            return jsonify({
                'error': True,
                'message': '缺少音频数据'
            }), 400
        
        print(f"[ASR] 音频数据长度: {len(audio_base64)} 字符")
        
        # 解码音频
        audio_data = base64.b64decode(audio_base64)
        print(f"[ASR] 解码后音频大小: {len(audio_data)} 字节")
        
        # 调用百度ASR
        print("[ASR] 调用百度ASR识别...")
        result = asr(
            audio_data,
            format='pcm',
            rate=16000,
            dev_pid=VOICE_SETTINGS['husband_praise']['asr_dev_pid']
        )
        
        print(f"[ASR] 识别结果: {result}")
        
        if result.get('success'):
            text = result.get('text', '')
            print(f"[ASR] 识别成功: {text}")
            print("="*60 + "\n")
            return jsonify({
                'error': False,
                'text': text,
                'all_results': result.get('all_results', [])
            })
        else:
            error_msg = result.get('error_msg', '识别失败')
            print(f"[ASR] 识别失败: {error_msg}")
            print("="*60 + "\n")
            return jsonify({
                'error': True,
                'message': error_msg
            }), 400
    
    except Exception as e:
        print(f"[ASR] 异常: {str(e)}")
        import traceback
        traceback.print_exc()
        print("="*60 + "\n")
        return jsonify({
            'error': True,
            'message': str(e)
        }), 500

# ===========================
# WebSocket Server for Voice Chat
# ===========================

class SuperMomVoiceServer:
    def __init__(self):
        self.handlers = {}
        self._init_handlers()
    
    def _init_handlers(self):
        """初始化不同功能的语音处理器"""
        # 安心话匣处理器
        self.handlers['emotional_support'] = RealtimeVoiceHandler(
            system_instruction=SYSTEM_PROMPTS['emotional_support'],
            tts_per=VOICE_SETTINGS['emotional_support']['tts_per'],
            llm_model=LLM_MODEL,
            tts_speed=VOICE_SETTINGS['emotional_support']['tts_speed'],
            tts_pitch=VOICE_SETTINGS['emotional_support']['tts_pitch'],
            tts_volume=VOICE_SETTINGS['emotional_support']['tts_volume'],
            asr_dev_pid=VOICE_SETTINGS['emotional_support']['asr_dev_pid']
        )
        
        # 产后食记处理器
        self.handlers['nutrition_advisor'] = RealtimeVoiceHandler(
            system_instruction=SYSTEM_PROMPTS['nutrition_advisor'],
            tts_per=VOICE_SETTINGS['nutrition_advisor']['tts_per'],
            llm_model=LLM_MODEL,
            tts_speed=VOICE_SETTINGS['nutrition_advisor']['tts_speed'],
            tts_pitch=VOICE_SETTINGS['nutrition_advisor']['tts_pitch'],
            tts_volume=VOICE_SETTINGS['nutrition_advisor']['tts_volume'],
            asr_dev_pid=VOICE_SETTINGS['nutrition_advisor']['asr_dev_pid']
        )
        
        # 贴心备忘录 - 丈夫夸奖处理器
        self.handlers['husband_praise'] = RealtimeVoiceHandler(
            system_instruction=SYSTEM_PROMPTS['husband_praise'],
            tts_per=VOICE_SETTINGS['husband_praise']['tts_per'],
            llm_model=LLM_MODEL,
            tts_speed=VOICE_SETTINGS['husband_praise']['tts_speed'],
            tts_pitch=VOICE_SETTINGS['husband_praise']['tts_pitch'],
            tts_volume=VOICE_SETTINGS['husband_praise']['tts_volume'],
            asr_dev_pid=VOICE_SETTINGS['husband_praise']['asr_dev_pid']
        )
    
    async def handle_client(self, websocket):
        """处理WebSocket客户端连接"""
        client_id = id(websocket)
        print(f"[WebSocket] 客户端连接: {client_id}")
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    msg_type = data.get('type')
                    
                    if msg_type == 'voice_chat':
                        # 语音对话 - 安心话匣 或 产后食记
                        await self._handle_voice_chat(websocket, data)
                    
                    elif msg_type == 'memo_complete':
                        # 备忘录完成 - 丈夫夸奖
                        await self._handle_memo_complete(websocket, data)
                    
                    elif msg_type == 'text_chat':
                        # 纯文本对话
                        await self._handle_text_chat(websocket, data)
                    
                    else:
                        await websocket.send(json.dumps({
                            'error': True,
                            'message': f'未知消息类型: {msg_type}'
                        }))
                
                except json.JSONDecodeError as e:
                    await websocket.send(json.dumps({
                        'error': True,
                        'message': f'JSON解析错误: {str(e)}'
                    }))
                
                except Exception as e:
                    print(f"[WebSocket] 处理错误: {e}")
                    import traceback
                    traceback.print_exc()
                    await websocket.send(json.dumps({
                        'error': True,
                        'message': str(e)
                    }))
        
        except websockets.exceptions.ConnectionClosed:
            print(f"[WebSocket] 客户端断开: {client_id}")
        except Exception as e:
            print(f"[WebSocket] 连接错误: {e}")
    
    async def _handle_voice_chat(self, websocket, data):
        """处理语音对话（安心话匣/产后食记）- 分步响应"""
        chat_type = data.get('chat_type')  # 'emotional_support' or 'nutrition_advisor'
        audio_base64 = data.get('audio')
        
        if chat_type not in self.handlers:
            await websocket.send(json.dumps({
                'error': True,
                'message': f'未知对话类型: {chat_type}'
            }))
            return
        
        handler = self.handlers[chat_type]
        
        # 分步处理：先ASR，再LLM+TTS
        try:
            # Step 1: ASR识别
            print(f"[{chat_type}] 开始ASR识别...")
            pcm_data = base64.b64decode(audio_base64)
            
            from Audio.baidu_asr import asr
            asr_result = asr(
                pcm_data, 
                format='pcm', 
                rate=16000, 
                dev_pid=handler.asr_dev_pid
            )
            
            if not asr_result.get('success'):
                await websocket.send(json.dumps({
                    'type': 'voice_response',
                    'error': True,
                    'message': f"语音识别失败: {asr_result.get('error_msg', '未知错误')}"
                }))
                return
            
            user_text = asr_result.get('text', '')
            print(f"[{chat_type}] 识别成功: {user_text}")
            
            # 立即发送用户识别文本
            user_msg = {
                'type': 'user_text_recognized',
                'chat_type': chat_type,
                'user_text': user_text
            }
            print(f"[{chat_type}] >>> 发送识别文本消息: {user_msg}")
            await websocket.send(json.dumps(user_msg))
            print(f"[{chat_type}] >>> 识别文本消息已发送")
            
            # Step 2: LLM生成回复
            print(f"[{chat_type}] 调用LLM生成回复...")
            llm_response = handler.llm_agent.router(
                prompt=user_text,
                model=handler.llm_model,
                systemInstruction=handler.system_instruction,
                stream_output=False
            )
            
            response_text = llm_response if isinstance(llm_response, str) else str(llm_response)
            print(f"[{chat_type}] LLM回复: {response_text}")
            
            # Step 3: TTS合成语音
            print(f"[{chat_type}] TTS合成语音...")
            audio_content = await handler.synthesize_to_memory(
                text=response_text,
                spd=handler.tts_speed,
                pit=handler.tts_pitch,
                vol=handler.tts_volume,
                aue=3
            )
            
            audio_base64_reply = base64.b64encode(audio_content).decode('utf-8')
            
            # 发送AI回复
            await websocket.send(json.dumps({
                'type': 'voice_response',
                'chat_type': chat_type,
                'error': False,
                'user_text': user_text,
                'response_text': response_text,
                'audio': audio_base64_reply
            }))
            
        except Exception as e:
            print(f"[{chat_type}] 处理错误: {e}")
            import traceback
            traceback.print_exc()
            await websocket.send(json.dumps({
                'type': 'voice_response',
                'error': True,
                'message': str(e)
            }))
    
    async def _handle_text_chat(self, websocket, data):
        """处理纯文本对话"""
        chat_type = data.get('chat_type')
        user_text = data.get('text', '')
        
        if chat_type not in self.handlers:
            await websocket.send(json.dumps({
                'error': True,
                'message': f'未知对话类型: {chat_type}'
            }))
            return
        
        try:
            handler = self.handlers[chat_type]
            
            # 直接调用LLM
            llm_response = handler.llm_agent.router(
                prompt=user_text,
                model=handler.llm_model,
                systemInstruction=handler.system_instruction,
                stream_output=False
            )
            
            response_text = llm_response if isinstance(llm_response, str) else str(llm_response)
            
            # 生成语音
            audio_content = await handler.synthesize_to_memory(
                text=response_text,
                spd=handler.tts_speed,
                pit=handler.tts_pitch,
                vol=handler.tts_volume,
                aue=3
            )
            
            audio_base64 = base64.b64encode(audio_content).decode('utf-8')
            
            await websocket.send(json.dumps({
                'type': 'text_response',
                'chat_type': chat_type,
                'error': False,
                'user_text': user_text,
                'response_text': response_text,
                'audio': audio_base64
            }))
        
        except Exception as e:
            print(f"[TextChat] 错误: {e}")
            import traceback
            traceback.print_exc()
            await websocket.send(json.dumps({
                'type': 'text_response',
                'error': True,
                'message': str(e)
            }))
    
    async def _handle_memo_complete(self, websocket, data):
        """处理备忘录完成 - 生成丈夫夸奖语音"""
        memo_text = data.get('memo_text', '')
        
        try:
            handler = self.handlers['husband_praise']
            
            # 构造夸奖提示词
            prompt = f"我老婆刚刚完成了「{memo_text}」这个任务，请夸奖她。"
            
            # 获取LLM回复
            llm_response = handler.llm_agent.router(
                prompt=prompt,
                model=handler.llm_model,
                systemInstruction=handler.system_instruction,
                stream_output=False
            )
            
            response_text = llm_response if isinstance(llm_response, str) else str(llm_response)
            print(f"[MemoComplete] 夸奖文本: {response_text}")
            
            # 生成语音
            audio_content = await handler.synthesize_to_memory(
                text=response_text,
                spd=handler.tts_speed,
                pit=handler.tts_pitch,
                vol=handler.tts_volume,
                aue=3
            )
            
            audio_base64 = base64.b64encode(audio_content).decode('utf-8')
            
            await websocket.send(json.dumps({
                'type': 'memo_praise',
                'error': False,
                'praise_text': response_text,
                'audio': audio_base64
            }))
        
        except Exception as e:
            print(f"[MemoComplete] 错误: {e}")
            import traceback
            traceback.print_exc()
            await websocket.send(json.dumps({
                'type': 'memo_praise',
                'error': True,
                'message': str(e)
            }))
    
    async def start(self):
        """启动WebSocket服务器"""
        print(f"[WebSocket] 服务启动: ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT}")
        async with websockets.serve(self.handle_client, WEBSOCKET_HOST, WEBSOCKET_PORT):
            await asyncio.Future()
    
    def run(self):
        """运行WebSocket服务器"""
        asyncio.run(self.start())

# ===========================
# Main Entry
# ===========================

def start_http_server():
    """启动HTTP服务器"""
    print(f"[HTTP] 服务启动: http://{HTTP_HOST}:{HTTP_PORT}")
    app.run(host=HTTP_HOST, port=HTTP_PORT, debug=False, use_reloader=False)

def start_websocket_server():
    """启动WebSocket服务器"""
    server = SuperMomVoiceServer()
    server.run()

if __name__ == "__main__":
    print("=" * 70)
    print("🌟 Super Mom 工作台服务启动中...")
    print("=" * 70)
    print()
    
    # 在独立线程中启动HTTP服务器
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()
    
    print(f"✅ HTTP服务器: http://{HTTP_HOST}:{HTTP_PORT}")
    print(f"✅ WebSocket服务器: ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT}")
    print()
    print("=" * 70)
    print()
    
    try:
        # 主线程运行WebSocket服务器
        start_websocket_server()
    except KeyboardInterrupt:
        print("\n\n服务器已停止")
