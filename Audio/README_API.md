# 实时语音服务器 API 文档

## RealtimeVoiceServer 类

完整的实时语音交互服务器，支持自定义配置。

### 初始化参数

```python
from realtime_voice_server import RealtimeVoiceServer

server = RealtimeVoiceServer(
    host="localhost",           # WebSocket服务器地址
    port=8765,                  # WebSocket服务器端口
    system_instruction="...",   # LLM系统提示词
    tts_per=4192,              # TTS发音人编号
    llm_model='gemini-3-flash-preview',  # LLM模型名称
    tts_speed=5,               # TTS语速 (0-15)
    tts_pitch=5,               # TTS音调 (0-15)
    tts_volume=5,              # TTS音量 (0-9)
    asr_dev_pid=1537           # ASR识别模型
)
```

### 参数说明

#### 基础配置
- **host** (str): WebSocket服务器绑定地址，默认 `"localhost"`
- **port** (int): WebSocket服务器端口，默认 `8765`

#### LLM配置
- **system_instruction** (str): 系统提示词，定义AI助手的角色和行为
  - 默认: `"你是一个友好的语音助手，请用简洁、自然的方式回答用户的问题。"`
  - 可自定义为任何角色，如客服、导游、老师等

- **llm_model** (str): 使用的LLM模型
  - 默认: `'gemini-3-flash-preview'`
  - 支持所有router支持的模型

#### TTS配置
- **tts_per** (int): 百度TTS发音人编号，默认 `4192`
  - `4146`: 度小美（女声）
  - `4192`: 度小宇（男声）
  - `4158`: 度逍遥（男声）
  - `4147`: 度小娇（女声）
  - 更多发音人请查看百度TTS文档

- **tts_speed** (int): 语速，范围 `0-15`，默认 `5`
  - 0: 最慢
  - 5: 正常
  - 15: 最快

- **tts_pitch** (int): 音调，范围 `0-15`，默认 `5`
  - 0: 最低
  - 5: 正常
  - 15: 最高

- **tts_volume** (int): 音量，范围 `0-9` 或 `0-15`，默认 `5`
  - 0: 最小
  - 5: 正常
  - 9/15: 最大

#### ASR配置
- **asr_dev_pid** (int): 百度ASR识别模型，默认 `1537`
  - `1537`: 普通话（有标点）
  - `1737`: 英语（无标点）
  - `1637`: 粤语（有标点）
  - `1837`: 四川话（有标点）

### 方法

#### run()
启动服务器（阻塞）

```python
server.run()
```

#### async start()
异步启动服务器

```python
import asyncio
await server.start()
```

## 使用示例

### 示例1：默认配置

```python
from realtime_voice_server import RealtimeVoiceServer

server = RealtimeVoiceServer()
server.run()
```

### 示例2：客服助手

```python
server = RealtimeVoiceServer(
    system_instruction="你是一个专业的客服助手，负责解答用户关于产品的问题。回答要礼貌、专业、简洁。",
    tts_per=4146,  # 使用女声
    tts_speed=6,   # 稍快语速
    tts_volume=7   # 音量稍大
)
server.run()
```

### 示例3：英语教师

```python
server = RealtimeVoiceServer(
    system_instruction="You are an English teacher. Help users improve their English. Speak clearly and give helpful feedback.",
    tts_per=4158,
    tts_speed=4,      # 语速稍慢，便于学习
    asr_dev_pid=1737, # 英语识别
    llm_model='gpt-4'
)
server.run()
```

### 示例4：心理咨询

```python
server = RealtimeVoiceServer(
    system_instruction="""你是一个温暖的心理咨询师助手。
    - 用温和、理解的语气交流
    - 倾听并给予情感支持
    - 回复简短，不超过100字""",
    tts_per=4147,     # 温柔女声
    tts_speed=4,      # 语速较慢
    tts_pitch=4,      # 音调稍低
    tts_volume=5
)
server.run()
```

### 示例5：粤语助手

```python
server = RealtimeVoiceServer(
    system_instruction="你是一个讲粤语的助手，用粤语习惯回答问题。",
    asr_dev_pid=1637,  # 粤语识别
    tts_per=4192
)
server.run()
```

## RealtimeVoiceHandler 类

音频处理核心类，每个WebSocket连接会创建一个实例。

### 初始化参数

与 `RealtimeVoiceServer` 相同（除了 host 和 port）。

### 方法

#### async process_audio(audio_data)
处理音频数据

**参数:**
- `audio_data` (str): Base64编码的PCM音频数据

**返回:**
```python
{
    'error': False,
    'user_text': '识别的用户输入',
    'response_text': 'LLM生成的回复',
    'audio': 'Base64编码的MP3音频'
}
```

或错误时：
```python
{
    'error': True,
    'message': '错误描述'
}
```

## 集成HTTP服务器

如果需要同时启动HTTP和WebSocket服务：

```python
import http.server
import socketserver
import threading
import os

def start_http():
    os.chdir('templates')
    with socketserver.TCPServer(("", 8000), http.server.SimpleHTTPRequestHandler) as httpd:
        httpd.serve_forever()

# HTTP服务器线程
http_thread = threading.Thread(target=start_http, daemon=True)
http_thread.start()

# WebSocket服务器
from realtime_voice_server import RealtimeVoiceServer
server = RealtimeVoiceServer(
    system_instruction="自定义提示词",
    tts_per=4192
)
server.run()
```

## 注意事项

1. **API密钥配置**: 确保 `baidu_asr.py` 和 `baidu_auth.py` 中的密钥已正确配置
2. **端口占用**: 确保指定的端口未被占用
3. **音频格式**: 前端必须发送16kHz PCM格式的音频数据
4. **Token过期**: access_token会自动刷新，无需手动管理
5. **并发处理**: 每个WebSocket连接独立处理，支持多客户端同时连接

## 故障排查

### 连接失败
- 检查服务器是否正常启动
- 确认端口号正确
- 查看防火墙设置

### ASR识别失败
- 检查API密钥是否正确
- 确认音频格式为16kHz PCM
- 查看 `asr_dev_pid` 是否与语言匹配

### TTS合成失败
- 确认access_token有效
- 检查网络连接
- 查看TTS参数是否在有效范围内
