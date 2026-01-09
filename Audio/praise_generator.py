import asyncio
import json
import sys
import os
import base64
import uuid
import importlib.util

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from llm_req import Agent
from baidu_auth import get_access_token

spec = importlib.util.spec_from_file_location("TTS_ws_demo", os.path.join(os.path.dirname(__file__), "TTS-ws-demo.py"))
TTS_ws_demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(TTS_ws_demo)
BaiduTTSWebSocketSDK = TTS_ws_demo.BaiduTTSWebSocketSDK


class HusbandPraiseGenerator:
    """
    用于生成老公角色夸奖语音的类
    当用户完成备忘录任务时，生成温馨的夸奖内容并转换为语音
    """
    
    def __init__(self, tts_per=4192, llm_model='gemini-3-flash-preview', 
                 tts_speed=5, tts_pitch=5, tts_volume=5):
        """
        初始化夸奖生成器
        
        Args:
            tts_per: TTS发音人选择 (4192为女声度小美, 1为度小宇男声)
            llm_model: LLM模型选择
            tts_speed: 语速 (0-15, 5为正常)
            tts_pitch: 音调 (0-15, 5为正常)
            tts_volume: 音量 (0-15, 5为正常)
        """
        self.llm_agent = Agent()
        self.llm_model = llm_model
        self.tts_speed = tts_speed
        self.tts_pitch = tts_pitch
        self.tts_volume = tts_volume
        
        self.system_instruction = """你是一个温柔体贴的老公，负责夸奖完成任务的妻子。
请用温暖、真诚、充满爱意的语气夸奖她，让她感受到你的关心和鼓励。
夸奖要具体、真诚，不要太夸张，要像真实的老公那样说话。
每次夸奖控制在2-3句话，简洁有力，充满爱意。
可以使用一些昵称如"宝贝"、"老婆"、"亲爱的"等，但不要每句都用。"""
        
        access_token = get_access_token()
        self.tts_sdk = BaiduTTSWebSocketSDK(
            authorization=access_token, 
            per=tts_per
        )
    
    async def generate_praise(self, task_description):
        """
        根据任务描述生成夸奖内容和语音
        
        Args:
            task_description: 完成的任务描述，例如 "完成了今天的工作报告"
            
        Returns:
            dict: {
                'error': bool,
                'task': str,           # 任务描述
                'praise_text': str,    # 生成的夸奖文本
                'audio': str,          # base64编码的音频数据
                'audio_file': str      # 保存的音频文件路径（可选）
            }
        """
        try:
            prompt = f"我完成了：{task_description}。请夸夸我~"
            
            print(f"任务: {task_description}")
            
            llm_response = self.llm_agent.router(
                prompt=prompt,
                model=self.llm_model,
                systemInstruction=self.system_instruction,
                stream_output=False
            )
            
            praise_text = llm_response if isinstance(llm_response, str) else str(llm_response)
            print(f"生成夸奖: {praise_text}")
            
            output_file = f"praise_audio_{uuid.uuid4().hex}.mp3"
            output_path = os.path.join(os.path.dirname(__file__), 'outputs', output_file)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            await self.tts_sdk.synthesize(
                text=praise_text,
                output_file=output_path,
                spd=self.tts_speed,
                pit=self.tts_pitch,
                vol=self.tts_volume,
                aue=3
            )
            
            with open(output_path, 'rb') as f:
                audio_content = f.read()
            
            audio_base64 = base64.b64encode(audio_content).decode('utf-8')
            
            return {
                'error': False,
                'task': task_description,
                'praise_text': praise_text,
                'audio': audio_base64,
                'audio_file': output_path
            }
            
        except Exception as e:
            print(f"生成夸奖错误: {e}")
            import traceback
            traceback.print_exc()
            return {
                'error': True,
                'message': str(e)
            }
    
    def generate_praise_sync(self, task_description):
        """
        同步方式生成夸奖（内部使用asyncio运行异步方法）
        
        Args:
            task_description: 完成的任务描述
            
        Returns:
            dict: 同 generate_praise 的返回值
        """
        return asyncio.run(self.generate_praise(task_description))
    
    async def generate_praise_text_only(self, task_description):
        """
        只生成夸奖文本，不生成语音（更快）
        
        Args:
            task_description: 完成的任务描述
            
        Returns:
            dict: {
                'error': bool,
                'task': str,
                'praise_text': str
            }
        """
        try:
            prompt = f"我完成了：{task_description}。请夸夸我~"
            
            llm_response = self.llm_agent.router(
                prompt=prompt,
                model=self.llm_model,
                systemInstruction=self.system_instruction,
                stream_output=False
            )
            
            praise_text = llm_response if isinstance(llm_response, str) else str(llm_response)
            
            return {
                'error': False,
                'task': task_description,
                'praise_text': praise_text
            }
            
        except Exception as e:
            return {
                'error': True,
                'message': str(e)
            }
    
    def generate_praise_text_only_sync(self, task_description):
        """
        同步方式只生成夸奖文本
        
        Args:
            task_description: 完成的任务描述
            
        Returns:
            dict: 同 generate_praise_text_only 的返回值
        """
        return asyncio.run(self.generate_praise_text_only(task_description))


async def demo():
    """使用示例"""
    generator = HusbandPraiseGenerator(
        tts_per=1,  # 1为男声，更符合老公角色
        llm_model='gemini-3-flash-preview',
        tts_speed=5,
        tts_pitch=5,
        tts_volume=5
    )
    
    tasks = [
        "完成了今天的工作报告",
        "整理好了房间",
        "做完了所有的家务",
        "完成了健身计划"
    ]
    
    for task in tasks:
        print(f"\n{'='*50}")
        result = await generator.generate_praise(task)
        
        if not result['error']:
            print(f"任务: {result['task']}")
            print(f"夸奖: {result['praise_text']}")
            print(f"音频已保存: {result['audio_file']}")
        else:
            print(f"错误: {result['message']}")
        
        await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(demo())
