import asyncio
import os
import sys
import importlib.util

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from baidu_auth import get_access_token

spec = importlib.util.spec_from_file_location("TTS_ws_demo", os.path.join(os.path.dirname(__file__), "TTS-ws-demo.py"))
TTS_ws_demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(TTS_ws_demo)
BaiduTTSWebSocketSDK = TTS_ws_demo.BaiduTTSWebSocketSDK


async def generate_child_voice():
    """生成童声MP3：妈咪你辛苦了"""
    
    text = "妈咪你辛苦了，已经工作很久了，需要休息一下吧"
    output_file = "妈咪你辛苦了_童声.mp3"
    output_path = os.path.join(os.path.dirname(__file__), 'outputs', output_file)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    access_token = get_access_token()
    tts_sdk = BaiduTTSWebSocketSDK(
        authorization=access_token,
        per=6561  # 童声发音人
    )
    
    print(f"正在生成童声MP3...")
    print(f"文本: {text}")
    print(f"发音人: 6561 (童声)")
    
    await tts_sdk.synthesize(
        text=text,
        output_file=output_path,
        spd=5,   # 语速：正常
        pit=5,   # 音调：正常
        vol=5,   # 音量：正常
        aue=3    # MP3格式
    )
    
    print(f"✓ 生成成功！")
    print(f"文件保存在: {output_path}")
    
    return output_path


if __name__ == "__main__":
    asyncio.run(generate_child_voice())
