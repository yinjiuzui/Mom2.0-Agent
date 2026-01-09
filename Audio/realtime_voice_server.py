import asyncio
import websockets
import json
import sys
import os
import base64
import uuid
import importlib.util
import io

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from llm_req import Agent
from baidu_asr import asr
from baidu_auth import get_access_token

spec = importlib.util.spec_from_file_location("TTS_ws_demo", os.path.join(os.path.dirname(__file__), "TTS-ws-demo.py"))
TTS_ws_demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(TTS_ws_demo)
BaiduTTSWebSocketSDK = TTS_ws_demo.BaiduTTSWebSocketSDK

class RealtimeVoiceHandler:
    def __init__(self, system_instruction=None, tts_per=4192, llm_model='gemini-3-flash-preview', 
                 tts_speed=5, tts_pitch=5, tts_volume=5, asr_dev_pid=1537):
        self.llm_agent = Agent()
        self.system_instruction = system_instruction or "你是一个友好的语音助手，请用简洁、自然的方式回答用户的问题。"
        self.llm_model = llm_model
        self.asr_dev_pid = asr_dev_pid
        self.tts_speed = tts_speed
        self.tts_pitch = tts_pitch
        self.tts_volume = tts_volume
        
        access_token = get_access_token()
        self.tts_sdk = BaiduTTSWebSocketSDK(
            authorization=access_token, 
            per=tts_per
        )
        
    
    async def synthesize_to_memory(self, text, spd=5, pit=5, vol=5, audio_ctrl="", aue=3):
        """TTS合成直接返回音频数据到内存，无需保存文件"""
        audio_buffer = io.BytesIO()
        
        try:
            await self.tts_sdk.connect()
            await self.tts_sdk.send_start_request(spd=spd, pit=pit, vol=vol, audio_ctrl=audio_ctrl, aue=aue)
            await self.tts_sdk.send_text_request(text)
            
            finish_payload = {"type": "system.finish"}
            await self.tts_sdk.websocket.send(json.dumps(finish_payload))
            
            timeout = 10
            while True:
                try:
                    response = await asyncio.wait_for(self.tts_sdk.websocket.recv(), timeout=timeout)
                except asyncio.TimeoutError:
                    print("TTS接收超时")
                    break
                
                if isinstance(response, bytes):
                    audio_buffer.write(response)
                else:
                    response_json = json.loads(response)
                    if response_json.get("type") == "system.error":
                        code = response_json.get("code", -1)
                        raise Exception(f"TTS错误码: {code}")
                    elif response_json.get("type") == "system.finished":
                        print("TTS音频接收完成")
                        break
            
            return audio_buffer.getvalue()
            
        finally:
            await self.tts_sdk.close_connection()
    
    async def process_audio(self, audio_data):
        try:
            pcm_data = base64.b64decode(audio_data)
            print(f"接收到PCM音频数据: {len(pcm_data)} 字节")
            
            asr_result = asr(
                pcm_data, 
                format='pcm', 
                rate=16000, 
                dev_pid=self.asr_dev_pid
            )
            
            if not asr_result.get('success'):
                return {
                    'error': True,
                    'message': f"ASR错误: {asr_result.get('error_msg', '未知错误')}"
                }
            
            user_text = asr_result.get('text', '')
            print(f"识别文本: {user_text}")
            
            llm_response = self.llm_agent.router(
                prompt=user_text,
                model=self.llm_model,
                systemInstruction=self.system_instruction,
                stream_output=False
            )
            
            response_text = llm_response if isinstance(llm_response, str) else str(llm_response)
            print(f"LLM回复: {response_text}")
            
            audio_content = await self.synthesize_to_memory(
                text=response_text,
                spd=self.tts_speed,
                pit=self.tts_pitch,
                vol=self.tts_volume,
                aue=3
            )
            
            audio_base64 = base64.b64encode(audio_content).decode('utf-8')
            
            return {
                'error': False,
                'user_text': user_text,
                'response_text': response_text,
                'audio': audio_base64
            }
            
        except Exception as e:
            print(f"处理错误: {e}")
            import traceback
            traceback.print_exc()
            return {
                'error': True,
                'message': str(e)
            }

class RealtimeVoiceServer:
    def __init__(self, host="localhost", port=8765, **handler_config):
        self.host = host
        self.port = port
        self.handler_config = handler_config
        self.server = None
    
    async def handle_client(self, websocket):
        handler = RealtimeVoiceHandler(**self.handler_config)
        print(f"客户端已连接: {websocket.remote_address}")
    
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    
                    if data.get('type') == 'audio':
                        audio_data = data.get('audio')
                        result = await handler.process_audio(audio_data)
                        await websocket.send(json.dumps(result))
                        
                except json.JSONDecodeError as e:
                    await websocket.send(json.dumps({
                        'error': True,
                        'message': f'JSON解析错误: {str(e)}'
                    }))
                except Exception as e:
                    await websocket.send(json.dumps({
                        'error': True,
                        'message': f'处理错误: {str(e)}'
                    }))
                    
        except websockets.exceptions.ConnectionClosed:
            print(f"客户端断开连接: {websocket.remote_address}")
        except Exception as e:
            print(f"连接错误: {e}")
    
    async def start(self):
        print(f"启动实时语音服务器...")
        print(f"服务器地址: ws://{self.host}:{self.port}")
        
        async with websockets.serve(self.handle_client, self.host, self.port):
            await asyncio.Future()
    
    def run(self):
        asyncio.run(self.start())

if __name__ == "__main__":
    server = RealtimeVoiceServer(
        host="localhost",
        port=8765,
        system_instruction="你是一个友好的语音助手，请用简洁、自然的方式回答用户的问题。",
        tts_per=4192,
        llm_model='gemini-3-flash-preview'
    )
    server.run()
