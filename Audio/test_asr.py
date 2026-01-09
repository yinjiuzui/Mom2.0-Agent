import wave
import numpy as np
from baidu_asr import asr

def create_test_audio():
    duration = 1
    sample_rate = 16000
    frequency = 440.0
    
    samples = np.arange(duration * sample_rate)
    audio = np.sin(2 * np.pi * frequency * samples / sample_rate)
    audio = (audio * 32767).astype(np.int16)
    
    filename = 'test_audio.wav'
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio.tobytes())
    
    return filename, audio.tobytes()

if __name__ == '__main__':
    print("测试百度ASR接口")
    print("=" * 50)
    
    print("\n生成测试音频...")
    filename, audio_bytes = create_test_audio()
    print(f"音频文件: {filename}")
    print(f"音频数据大小: {len(audio_bytes)} bytes")
    
    print("\n测试ASR识别...")
    result = asr(audio_bytes, format='pcm', rate=16000, dev_pid=1537)
    
    print("\n识别结果:")
    print(f"成功: {result['success']}")
    if result['success']:
        print(f"识别文本: {result['text']}")
        print(f"所有候选: {result['all_results']}")
    else:
        print(f"错误码: {result['error_code']}")
        print(f"错误信息: {result['error_msg']}")
