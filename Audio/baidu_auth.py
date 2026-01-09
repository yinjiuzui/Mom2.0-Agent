import requests
import json
import time

class BaiduAuth:
    def __init__(self, api_key, secret_key):
        self.api_key = api_key
        self.secret_key = secret_key
        self.token_url = "https://aip.baidubce.com/oauth/2.0/token"
        self.access_token = None
        self.token_expires_at = 0
    
    def get_access_token(self, force_refresh=False):
        if not force_refresh and self.access_token and time.time() < self.token_expires_at:
            return self.access_token
        
        params = {
            'grant_type': 'client_credentials',
            'client_id': self.api_key,
            'client_secret': self.secret_key
        }
        
        try:
            response = requests.post(self.token_url, params=params)
            result = response.json()
            
            if 'access_token' in result:
                self.access_token = result['access_token']
                expires_in = result.get('expires_in', 2592000)
                self.token_expires_at = time.time() + expires_in - 300
                
                print(f"获取access_token成功，有效期: {expires_in}秒")
                return self.access_token
            else:
                error_msg = result.get('error_description', result.get('error', '未知错误'))
                raise Exception(f"获取access_token失败: {error_msg}")
                
        except Exception as e:
            print(f"获取access_token异常: {e}")
            raise


API_KEY = 'RzB1cd4kTsjJjtoybBXvfo0h'
SECRET_KEY = 'YDaZP16qr1jPkq8GoE3xDs758c9xlasI'

_auth_instance = None

def get_auth_instance():
    global _auth_instance
    if _auth_instance is None:
        _auth_instance = BaiduAuth(API_KEY, SECRET_KEY)
    return _auth_instance

def get_access_token(force_refresh=False):
    instance = get_auth_instance()
    return instance.get_access_token(force_refresh)


if __name__ == '__main__':
    print("测试获取百度access_token")
    print("=" * 50)
    
    try:
        token = get_access_token()
        print(f"\nAccess Token: {token}")
        print(f"Token长度: {len(token)}")
        
        print("\n再次获取（使用缓存）:")
        token2 = get_access_token()
        print(f"相同: {token == token2}")
        
    except Exception as e:
        print(f"错误: {e}")
