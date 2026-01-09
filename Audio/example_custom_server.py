from realtime_voice_server import RealtimeVoiceServer

if __name__ == "__main__":
    server = RealtimeVoiceServer(
        host="localhost",
        port=8765,
        system_instruction="""你是一个专业的心理咨询师助手。
你需要：
1. 用温和、理解的语气与用户交流
2. 倾听用户的问题，给予情感支持
3. 提供专业但易懂的建议
4. 回复要简短，不超过100字""",
        tts_per=4146,
        tts_speed=5,
        tts_pitch=5,
        tts_volume=7,
        llm_model='gemini-3-flash-preview',
        asr_dev_pid=1537
    )
    
    print("=" * 60)
    print("自定义语音助手服务器配置示例")
    print("=" * 60)
    print(f"角色: 心理咨询师助手")
    print(f"发音人: {4146}")
    print(f"音量: 7")
    print("=" * 60)
    
    server.run()
