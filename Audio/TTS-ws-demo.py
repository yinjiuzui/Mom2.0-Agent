#coding=utf8
import asyncio
import websockets
import json
from enum import Enum
import time


class BaiduTTSErrorCode(Enum):
    """
    百度 TTS 错误码枚举
    """
    SUCCESS = (0, "成功")
    PARAMETER_MISSING = (216101, "参数缺失")
    TEXT_TOO_LONG = (216103, "文本过长，请控制在1000字以内")
    TEXT_PENDING_TOO_LONG = (216419, "当前待处理文本过长，请稍后发送")
    SPEED_OUT_OF_RANGE = (216100, "语速参数错误，请输入0-15的整数")
    PITCH_OUT_OF_RANGE = (216100, "音调参数错误，请输入0-15的整数")
    VOLUME_OUT_OF_RANGE = (216100, "音量参数错误，请输入0-9或0-15的整数")
    AUDIO_FORMAT_ERROR = (216100, "音频格式错误，支持 3:mp3, 4:pcm-16k, 5:pcm-8k, 6:wav")
    AUTH_FAILED = (401, "鉴权失败")
    FORBIDDEN = (403, "无访问权限，接口功能未开通")
    NOT_FOUND = (404, "输入的 URL 错误")
    TOO_MANY_REQUESTS = (429, "触发限流")
    INTERNAL_SERVER_ERROR = (500, "服务器内部错误")
    BACKEND_CONNECTION_FAILED = (502, "后端服务连接失败")

    @classmethod
    def get_message(cls, code):
        """
        根据错误码获取错误信息
        :param code: 错误码
        :return: 错误信息
        """
        for error in cls:
            if error.value[0] == code:
                return error.value[1]
        return "未知错误码"


class BaiduTTSWebSocketSDK:
    def __init__(self, authorization, per="4146", base_url="wss://aip.baidubce.com/ws/2.0/speech/publiccloudspeech/v1/tts"):
        """
        初始化 SDK 实例
        :param access_token: 鉴权令牌
        :param per: 发音人参数，默认值为 4146
        :param base_url: WebSocket 服务的基础 URL
        """
        self.authorization = authorization
        self.per = per
        self.base_url = base_url
        self.url = f"{self.base_url}?access_token={self.authorization}&per={self.per}"
        self.websocket = None

    async def connect(self):
        """
        建立 WebSocket 连接
        """
        try:
            self.websocket = await websockets.connect(self.url)
            print("WebSocket 连接已建立")
        except Exception as e:
            print("WebSocket 连接失败:", e)
            self.websocket = None
            raise

    async def send_start_request(self, spd=5, pit=5, vol=5, audio_ctrl="{\"sampling_rate\":16000}", aue=3):
        """
        发送开始合成请求
        :param spd: 语速，默认值为 5
        :param pit: 音调，默认值为 5
        :param vol: 音量，默认值为 5
        :param audio_ctrl: 采样率控制，默认值为 {"sampling_rate":16000}
        :param aue: 音频格式，默认值为 3 (mp3)
        """
        start_payload = {
            "type": "system.start",
            "payload": {
                "spd": spd,
                "pit": pit,
                "vol": vol,
                "audio_ctrl": audio_ctrl,
                "aue": aue
            }
        }
        try:
            await self.websocket.send(json.dumps(start_payload))
            print("发送开始合成请求:", start_payload)
            response = await self.websocket.recv()
            response_data = json.loads(response)
            print("收到服务端响应:", response_data)

            # 检查错误码
            code = response_data.get("code", -1)
            if code != 0:
                error_message = BaiduTTSErrorCode.get_message(code)
                raise Exception(f"错误码: {code}, 错误信息: {error_message}")

            return response_data
        except Exception as e:
            print("发送开始合成请求失败:", e)
            raise

    async def send_text_request(self, text):
        """
        发送文本合成请求
        :param text: 需要合成的文本
        """
        text_payload = {
            "type": "text",
            "payload": {
                "text": text
            }
        }
        try:
            await self.websocket.send(json.dumps(text_payload))
            print("发送文本合成请求:", text_payload)
        except Exception as e:
            print("发送文本合成请求失败:", e)
            raise

    async def receive_audio(self, output_file="output_file", timeout=5):
        """
        接收音频数据并保存到文件
        :param output_file: 保存音频的文件名，默认值为 output.mp3
        :param timeout: 接收音频数据的超时时间（秒），默认值为 10 秒
        """
        try:
            with open(output_file, "wb") as f:
                start_time = 0
                while True:
                    try:
                        # 设置超时时间
                        response = await asyncio.wait_for(self.websocket.recv(), timeout=timeout)
                    except asyncio.TimeoutError:
                        if (time.time() - start_time) >= timeout:
                            return
                        raise Exception("接收音频数据超时")

                    start_time = time.time()
                    if isinstance(response, bytes):
                        print("收到音频数据 (二进制)")
                        f.write(response)
                    else:
                        response_json = json.loads(response)
                        print("收到服务端响应:", response_json)
                        if response_json.get("type") == "system.error":
                            code = response_json.get("code", -1)
                            error_message = BaiduTTSErrorCode.get_message(code)
                            raise Exception(f"错误码: {code}, 错误信息: {error_message}")
                        elif response_json.get("type") == "system.finished":
                            print("音频接收完成")
                            break
        except Exception as e:
            print("接收音频数据失败:", e)
            raise

    async def send_finish_request(self):
        """
        发送结束合成请求
        """
        finish_payload = {
            "type": "system.finish",
        }
        try:
            await self.websocket.send(json.dumps(finish_payload))
            print("发送结束合成请求:", finish_payload)
            response = await self.websocket.recv()
            
            if isinstance(response, bytes):
                print("收到音频数据 (二进制)，跳过并继续等待结束响应")
                response = await self.websocket.recv()
            
            response_data = json.loads(response)
            print("收到结束响应:", response_data)

            # 检查错误码
            code = response_data.get("code", -1)
            if code != 0:
                error_message = BaiduTTSErrorCode.get_message(code)
                raise Exception(f"错误码: {code}, 错误信息: {error_message}")

            return response_data
        except Exception as e:
            print("发送结束合成请求失败:", e)
            raise

    async def close_connection(self):
        """
        关闭 WebSocket 连接
        """
        try:
            if self.websocket is not None:
                await self.websocket.close()
                print("WebSocket 连接已关闭")
        except Exception as e:
            print("关闭 WebSocket 连接失败:", e)

    async def synthesize(self, text, output_file="output_file", spd=5, pit=5, vol=5, audio_ctrl="", aue=3):
        """
        完整的语音合成流程：连接 -> 开始合成 -> 发送文本 -> 接收音频 -> 结束合成 -> 关闭连接
        :param text: 需要合成的文本
        :param output_file: 保存音频的文件名
        :param spd: 语速
        :param pit: 音调
        :param vol: 音量
        :param audio_ctrl: 采样率控制
        :param aue: 音频格式
        """
        try:
            await self.connect()
            await self.send_start_request(spd=spd, pit=pit, vol=vol, audio_ctrl=audio_ctrl, aue=aue)
            await self.send_text_request(text)
            
            finish_payload = {"type": "system.finish"}
            await self.websocket.send(json.dumps(finish_payload))
            print("发送结束合成请求:", finish_payload)
            
            await self.receive_audio(output_file=output_file)
        finally:
            await self.close_connection()


# 示例：使用 SDK
if __name__ == "__main__":
    Authorization = "RzB1cd4kTsjJjtoybBXvfo0h" # iam API_KEY或TOKEN二选一
    PER = 4192   # 替换为你的发音人参数
    sdk = BaiduTTSWebSocketSDK(authorization=Authorization, per=PER, base_url="wss://aip.baidubce.com/ws/2.0/speech/publiccloudspeech/v1/tts")

    async def main():
        text = "欢迎体验百度流式文本在线合成。"  # 替换为需要合成的文本
        output_file = "output.mp3"  # 保存音频的文件名
        await sdk.synthesize(text, output_file=output_file)

    asyncio.run(main())
