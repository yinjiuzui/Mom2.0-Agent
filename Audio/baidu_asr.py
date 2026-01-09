from aip import AipSpeech
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BaiduASR:
    def __init__(self, app_id, api_key, secret_key):
        self.app_id = app_id
        self.api_key = api_key
        self.secret_key = secret_key
        self.client = AipSpeech(app_id, api_key, secret_key)
        
    def set_timeout(self, connection_timeout=5000, socket_timeout=5000):
        self.client.setConnectionTimeoutInMillis(connection_timeout)
        self.client.setSocketTimeoutInMillis(socket_timeout)
    
    def asr(self, audio_data, format='pcm', rate=16000, dev_pid=1537, cuid=None):
        options = {'dev_pid': dev_pid}
        if cuid:
            options['cuid'] = cuid
        
        try:
            result = self.client.asr(audio_data, format, rate, options)
            
            if result.get('err_no') == 0:
                logger.info(f"识别成功: {result.get('result', [])}")
                return {
                    'success': True,
                    'text': result.get('result', [''])[0] if result.get('result') else '',
                    'all_results': result.get('result', []),
                    'sn': result.get('sn'),
                    'corpus_no': result.get('corpus_no')
                }
            else:
                logger.error(f"识别失败: {result.get('err_msg')} (错误码: {result.get('err_no')})")
                return {
                    'success': False,
                    'error_code': result.get('err_no'),
                    'error_msg': result.get('err_msg'),
                    'text': ''
                }
        except Exception as e:
            logger.error(f"ASR异常: {str(e)}")
            return {
                'success': False,
                'error_code': -1,
                'error_msg': str(e),
                'text': ''
            }
    
    def asr_from_file(self, file_path, format='pcm', rate=16000, dev_pid=1537):
        try:
            with open(file_path, 'rb') as f:
                audio_data = f.read()
            return self.asr(audio_data, format, rate, dev_pid)
        except Exception as e:
            logger.error(f"读取文件失败: {str(e)}")
            return {
                'success': False,
                'error_code': -1,
                'error_msg': f'文件读取失败: {str(e)}',
                'text': ''
            }


APP_ID = 'YOUR-ID'
API_KEY = 'YOUR-API-KEY'
SECRET_KEY = 'YOUR-SECRET_KEY'

_asr_instance = None

def get_asr_instance():
    global _asr_instance
    if _asr_instance is None:
        _asr_instance = BaiduASR(APP_ID, API_KEY, SECRET_KEY)
    return _asr_instance

def asr(audio_data, format='pcm', rate=16000, dev_pid=1537, cuid=None):
    instance = get_asr_instance()
    return instance.asr(audio_data, format, rate, dev_pid, cuid)

def asr_from_file(file_path, format='pcm', rate=16000, dev_pid=1537):
    instance = get_asr_instance()
    return instance.asr_from_file(file_path, format, rate, dev_pid)


if __name__ == '__main__':
    print("百度ASR实时音频处理接口测试")
    print("=" * 50)
    
    asr_client = BaiduASR(APP_ID, API_KEY, SECRET_KEY)
    
    test_audio_file = 'test_audio.pcm'
    
    print(f"\n测试文件识别: {test_audio_file}")
    result = asr_client.asr_from_file(test_audio_file, format='pcm', rate=16000, dev_pid=1537)
    
    if result['success']:
        print(f"识别结果: {result['text']}")
        print(f"所有候选: {result['all_results']}")
    else:
        print(f"识别失败: {result['error_msg']} (错误码: {result['error_code']})")
    
    print("\n使用快捷函数:")
    result2 = asr_from_file(test_audio_file)
    print(f"结果: {result2}")
