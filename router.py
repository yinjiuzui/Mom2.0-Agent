"""
TODO:

1. 清理所有 self.log 和 self.warn 的代码，或改写为 print
2. 执行 python llm_req.py ，确保测试通过

"""

import os
import sys
import time
import random
from functools import wraps
import requests
import base64
import json

# TODO: 思考数据的控制台浅色输出

def exponential_backoff_retry(max_retries=3, base_delay=1, max_delay=60, backoff_factor=2):
    """指数退避重试装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except (requests.exceptions.RequestException,
                        requests.exceptions.Timeout,
                        requests.exceptions.ConnectionError,
                        ConnectionError,
                        TimeoutError) as e:
                    last_exception = e
                    if attempt == max_retries:
                        # 最后一次重试失败，记录错误并返回None
                        self = args[0] if args and hasattr(args[0], 'log') else None
                        if self:
                            print(f"重试{max_retries}次后仍然失败: {e}")
                        break

                    # 计算退避延迟时间，加入随机抖动
                    delay = min(base_delay * (backoff_factor ** attempt), max_delay)
                    jitter = delay * 0.1 * random.random()
                    sleep_time = delay + jitter

                    self = args[0] if args and hasattr(args[0], 'log') else None
                    if self:
                        print(f"第{attempt + 1}次请求失败，{sleep_time:.2f}秒后重试: {e}")

                    time.sleep(sleep_time)
                except Exception as e:
                    # 其他异常不重试
                    last_exception = e
                    break

            return None
        return wrapper
    return decorator

class LLMRouter:
    _providers = {}

    @classmethod
    def register(cls, name: str, model_patterns: list = None):
        """装饰器：注册 provider"""
        def decorator(func):
            cls._providers[name] = {
                'handler': func,
                'patterns': model_patterns or [],
            }
            return func
        return decorator

    def _detect_provider(self, model: str) -> str:
        model_lower = model.lower()
        for name, config in self._providers.items():
            for pattern in config['patterns']:
                if model_lower.startswith(pattern):
                    return name
        return 'openai_completions' # 默认 openai chat completions 格式（兼容大部分规范）

    def _get_headers(self, api_key):
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

    def _get_b64(self, img):
        final_image_data = None
        try:
            with open(img, 'rb') as f:
                final_image_data = f.read()
            if img.lower().endswith('.png'):
                image_mime_type = 'image/png'
            elif img.lower().endswith('.webp'):
                image_mime_type = 'image/webp'
            elif img.lower().endswith('.git'):
                image_mime_type = 'image/gif'
            else:
                image_mime_type = 'image/jpeg'
        except FileNotFoundError:
            print(f"Error: Image file not found: {img}")
        except Exception as e:
            print(f"Error reading image file: {e}")
            return None
        img_b64 = base64.b64encode(final_image_data).decode('utf-8')
        return image_mime_type, img_b64
    
    def _get_pdf_b64(self, pdf):
        from PyPDF2 import PdfReader

        pages = len(PdfReader(pdf).pages)
        pdf_size_mb = os.path.getsize(pdf_path) / (1024 ** 2)
        with open(pdf, 'rb') as f:
            pdf_data = base64.b64encode(f.read()).decode('utf-8')

        return pages, pdf_size_mb, pdf_data

    def _parse_json_response(self, content: str):
        """
        尝试将响应内容解析为 JSON 对象；
        解析成功返回 JSON 对象，失败返回原始字符串。
        """
        if not content or not isinstance(content, str):
            return content

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        content_stripped = content.strip()

        # 处理 ```json 的情况
        if content_stripped.startswith('```'):
            lines = content_stripped.split('\n')

            start_idx = 0
            end_idx = len(lines)

            if lines[0].startswith('```'):
                start_idx = 1

            for i in range(len(lines) - 1, 0, -1):
                if lines[i].strip() == '```':
                    end_idx = i
                    break

            json_content = '\n'.join(lines[start_idx:end_idx])

            try:
                return json.loads(json_content)
            except json.JSONDecodeError:
                pass

        # 如果所有解析都失败，返回原始内容
        print(f'Json 解析失败，返回字符串结果: {content}')
        return content

    # NOTE: 弃用
    # def _detect_schema_format(self, schema):
    #     # TODO: 扩充校验。OpenAI 传入的 schema 需要包含 name、schema、type等字段。并在该方法内统一传回报错 messages
    #     def check_types_recursive(obj):
    #         """递归检查所有 type 字段"""
    #         if isinstance(obj, dict):
    #             # 检查当前层的 type
    #             if "type" in obj:
    #                 if obj["type"] in ["OBJECT", "ARRAY", "STRING", "INTEGER", "BOOLEAN"]:
    #                     return True
    #             # 检查 Gemini 特有字段
    #             if "propertyOrdering" in obj:
    #                 return True
    #             # 递归检查所有值
    #             for value in obj.values():
    #                 if check_types_recursive(value):
    #                     return True
    #         elif isinstance(obj, list):
    #             # 递归检查列表中的所有项
    #             for item in obj:
    #                 if check_types_recursive(item):
    #                     return True
    #         return False
    #     # 检查是否为 Gemini 格式
    #     if check_types_recursive(schema):
    #         return "gemini"
    #     # 检查 OpenAI 特有字段（顶层）
    #     if isinstance(schema, dict):
    #         if "additionalProperties" in schema or "strict" in schema:
    #             return "openai"
    #     return "openai"  # 默认为标准 JSON Schema

    @exponential_backoff_retry(max_retries=3, base_delay=1, max_delay=60, backoff_factor=2)
    def _openai_completions(self, prompt: str, systemInstruction: str, image_path: list, pdf_path: list, pdf_data: str, model: str, api_key: str, base_url: str, schema: dict, stream_output: bool, desc: str):

        if pdf_path != [] or pdf_data:
            print(f"OpenAI 暂不支持文档理解")
            return None

        print(f"Call LLM with {model}@_openai_completions: {desc}")

        messages = []
        contents = []
        if systemInstruction:
            messages.append({
                "role": "system",
                "content": systemInstruction
            })
        contents.append({"type": "text", "text": prompt})

        url = base_url if base_url else "https://api.singinggirl.com/v1"
        api_key = api_key if api_key else "Your-API-KEY"

        if '/chat/completions' not in url:
            url = f"{url}/chat/completions"

        if image_path != []:
            for img in image_path:
                mime_type, b64_data = self._get_b64(img)
                contents.append({"type": "image_url", "image_url": {
                    "url": f"data:{mime_type};base64,{b64_data}"
                }})

        messages.append({"role": "user", "content": contents})    
        
        headers = self._get_headers(api_key)
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "stream_options": {"include_usage": True}
        }
        
        if schema:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": schema
            }

        full_content = ""

        try:
            with requests.post(url, headers=headers, json=payload, stream=True) as response:

                if response.status_code != 200:
                    print(f"Error {response.status_code}: {response.text}")
                    return None
                
                for line in response.iter_lines():
                    if not line:
                        continue
                    
                    line = line.decode('utf-8')

                    if not line.startswith("data: "):
                        continue

                    data = line[6:]
                    if data == "[DONE]":
                        break
                    
                    try:
                        chunk = json.loads(data)
                        choices = chunk.get('choices', [])
                        if choices:
                            delta = choices[0].get('delta', {})
                            content = delta.get('content')

                            if content:
                                full_content += content
                                if stream_output:
                                    sys.stdout.write(content)
                                    sys.stdout.flush()
                        
                            finish_reason = choices[0].get("finish_reason")
                            if finish_reason:
                                if stream_output:
                                    print()
                                # print(f"[Finish Reason: {finish_reason}]")
                                print(f"[Status: completed]") # Update: 保持日志风格统一
                        usage = chunk.get("usage")
                        if usage:
                            print(f"[Token Usage - Prompt: {usage.get('prompt_tokens')}, "
                                  f"Completion: {usage.get('completion_tokens')}, "
                                  f"Total: {usage.get('total_tokens')}]")

                    except json.JSONDecodeError as e:
                        print(f"\nJSON Decode Error: {e}")
                        continue

        except requests.exceptions.RequestException as e:
            print(f"Request Error: {e}")
            return None

        return full_content

    @exponential_backoff_retry(max_retries=3, base_delay=1, max_delay=60, backoff_factor=2)
    def _openai_responses(self, prompt: str, systemInstruction: str, image_path: list, pdf_path: list, pdf_data: str, model: str, api_key: str, base_url: str, schema: dict, stream_output: bool, desc: str):
        
        if pdf_path != [] or pdf_data:
            print(f"OpenAI 暂不支持文档理解")
            return None

        print(f"Call LLM with {model}@_openai_responses: {desc}")
        
        messages = []
        contents = []

        contents.append({"type": "input_text", "text": prompt})
        if image_path != []:
            for img in image_path:
                mime_type, b64_data = self._get_b64(img)
                contents.append({"type": "input_image", "image_url": f"data:{mime_type};base64,{b64_data}"})
        
        messages.append({"role": "user", "content": contents})

        url = base_url if base_url else "https://api.singinggirl.com/v1"
        api_key = api_key if api_key else "YOUR-APIKEY"

        if '/responses' not in url:
            url = f"{url}/responses"

        headers = self._get_headers(api_key)
        payload = {
            "model": model,
            "input": messages,
            "stream": True
        }

        if schema:
            payload["text"] = {
                "format": "json_schema",
                "json_schema": schema
            }


        if systemInstruction:
            payload["instructions"] = systemInstruction
        
        full_content = ""
        response_id = None

        try:
            with requests.post(url, headers=headers, json=payload, stream=True) as response:

                if response.status_code != 200:
                    print(f"Error {response.status_code}: {response.text}")
                    return None

                for line in response.iter_lines():
                    if not line:
                        continue

                    line = line.decode('utf-8')

                    if line.startswith("event: "):
                        continue

                    if not line.startswith("data: "):
                        continue
                        
                    data = line[6:]
                    if data == "[DONE]":
                        break

                    try:
                        event = json.loads(data)
                        event_type = event.get("type", "")

                        if event_type == "response.created":
                            resp = event.get("response", {})
                            response_id = resp.get("id")
                            print(f"[Response Created: {response_id}]")
                        
                        elif event_type == "response.output_text.delta":
                            delta = event.get("delta", "")
                            if delta:
                                full_content += delta
                                if stream_output:
                                    sys.stdout.write(delta)
                                    sys.stdout.flush()

                        elif event_type == "response.output_text.done":
                            text = event.get("text", "")

                        elif event_type == "response.completed":
                            resp = event.get("response", {})
                            status = resp.get("status")
                            usage = resp.get("usage", {})

                            if stream_output:
                                print()
                            print(f"[Status: {status}]")

                            if usage:
                                print(f"[Token Usage - Prompt: {usage.get('input_tokens')}, "
                                        f"Completion: {usage.get('output_tokens')}, "
                                        f"Total: {usage.get('total_tokens')}]")

                        elif event_type == "response.failed":
                            resp = event.get("response", {})
                            error = resp.get("error", {})
                            print(f"\n[Error: {error}]")

                        elif event_type == "error":
                            error = event.get("error", {})
                            print(f"\n[Stream Error: {error}]")
                        
                        else:
                            pass

                    except json.JSONDecodeError as e:
                        continue

        except requests.exceptions.RequestException as e:
            print(f"Request Error: {e}")
            return None

        return full_content
    
    @exponential_backoff_retry(max_retries=3, base_delay=1, max_delay=60, backoff_factor=2)
    def _anthropic_messages(self, prompt: str, systemInstruction: str, image_path: list, pdf_path: list, pdf_data: str, model: str, api_key: str, base_url: str, schema: dict, stream_output: bool, desc: str):

        print(f"Call LLM with {model}@_anthropic_messages: {desc}")

        messages = []
        contents = []

        contents.append({"type": "text", "text": prompt})

        if image_path != []:
            for img in image_path:
                mime_type, b64_data = self._get_b64(img)
                contents.append({"type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": b64_data
                }})
        if pdf_data:
            contents.append({"type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": pdf_data
            }})
        if pdf_path != []:
            for pdf in pdf_path:
                pages, pdf_size, pdf_data = self._get_pdf_b64(pdf)
                # TODO: 查看 Anthropic 开发文档确定最大支持的页数和文档大小
                contents.append({"type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": pdf_data
                }})
        messages.append({"role": "user", "content": contents})

        url = base_url if base_url else "https://api.singinggirl.com/v1"
        api_key = api_key if api_key else "YOUR-API-KEY"

        if '/messages' not in url:
            url = f"{url}/messages"

        headers = self._get_headers(api_key)

        payload = {
            "model": model,
            "messages": messages,
            "stream": True
        }

        # TODO: 完善结构化输出
        if schema:
            print(f"Anthropic Messages 格式的结构化输出待开发……")

        if systemInstruction:
            payload["system"] = systemInstruction
        
        full_content = ""
        input_tokens = 0
        output_tokens = 0

        try:
            with requests.post(url, headers=headers, json=payload, stream=True) as response:

                if response.status_code != 200:
                    try:
                        error_data = response.json()
                        error_type = error_data.get("error", {}).get("type", "unknown")
                        error_message = error_data.get("error", {}).get("message", "Unknown error")
                        print(f"Error {response.status_code} - {error_type}: {error_message}")
                    except:
                        print(f"Error {response.status_code}: {response.text}")
                    return None

                for line in response.iter_lines():
                    if not line:
                        continue

                    line = line.decode('utf-8')

                    if line.startswith(':') or not line.strip():
                        continue
                    
                    if line.startswith('data: '):
                        data_str = line[6:].strip()

                        if data_str == '[DONE]':
                            break

                        try:
                            data = json.loads(data_str)
                            
                            event_type = data.get("type", "")

                            if event_type == "message_start":
                                message = data.get("message", {})
                                usage = message.get("usage", {})
                                input_tokens = usage.get("input_tokens", 0)

                            elif event_type == "content_block_delta":
                                delta = data.get("delta", {})
                                if delta.get("type") == "text_delta":
                                    text = delta.get("text", "")
                                    if text:
                                        full_content += text
                                        if stream_output:
                                            sys.stdout.write(text)
                                            sys.stdout.flush()

                            elif event_type == "message_delta":
                                delta = data.get("delta", {})
                                usage = delta.get("usage", {})
                                if usage:
                                    output_tokens = usage.get("output_tokens", 0)

                            elif event_type == "message_stop":
                                if stream_output:
                                    print()
                                print(f'[Status]: completed')

                                if input_tokens > 0 or output_tokens > 0:
                                    total_tokens = input_tokens + output_tokens
                                    print(f"[Token Usage - Prompt: {input_tokens}, "
                                      f"Completion: {output_tokens}, "
                                      f"Total: {total_tokens}]")
                                break

                            elif event_type == "error":
                                error = data.get("error", {})
                                error_type = error.get("type", "unknown")
                                error_message = error.get("message", "Unknown error")
                                print(f"\n[API Error - {error_type}: {error_message}]")
                                break

                        except json.JSONDecodeError as e:
                            print(f"\n[JSON Decode Error: {e}]")
                            print(f"[Raw data: {data_str[:100]}...]")
                            continue

        except requests.exceptions.RequestException as e:
            print(f"Request Error: {e}")
            return None

        return full_content


    @exponential_backoff_retry(max_retries=3, base_delay=1, max_delay=60, backoff_factor=2)
    def _gemini_generateContent(self, prompt: str, systemInstruction: str, image_path: list, pdf_path: list, pdf_data: str, model: str, api_key: str, base_url: str, schema: dict, stream_output: bool, desc: str):
        
        print(f"Call LLM with {model}@_gemini_generateContent: {desc}")

        api_key = api_key if api_key else "YOUR-APIKEY"
        base_url = base_url if base_url else "https://api.singinggirl.com/v1beta"
        url = f"{base_url}/models/{model}:streamGenerateContent?key=&alt=sse"

        headers = self._get_headers(api_key)

        contents = []
        parts = []

        parts.append({
            'text': prompt
        })

        if image_path != []:
            for img in image_path:
                mime_type, b64_data = self._get_b64(img)
                parts.append({"inline_data": {
                    "mime_type": mime_type,
                    "data": b64_data
                }})
        if pdf_data:
            parts.append({"inline_data": {
                "mime_type": "application/pdf",
                "data": pdf_data
            }})
        if pdf_path != []:
            for pdf in pdf_path:
                pages, pdf_size, pdf_data = self._get_pdf_b64(pdf)
                if pages > 1000 or pdf_size > 50: # TODO: 上提，不要写死
                    print(f"Gemini 支持不超过 50MB 或 1,000 页的 PDF 文件，请对文件额外处理后重试")
                    return None
                parts.append({"inline_data": {
                    "mime_type": "application/pdf",
                    "data": pdf_data
                }})
        contents.append({"role": "user", "parts": parts})

        payload = {
            'contents': contents,
        }

        if schema:
            payload["generationConfig"] = {
                "responseMimeType": "application/json",
                "responseJsonSchema": schema
            }

        if systemInstruction:
            payload['systemInstruction'] = {
                'parts': [{'text': systemInstruction}]
            }

        full_content = ""

        try:
            with requests.post(url, headers=headers, json=payload, stream=True) as response:

                if response.status_code != 200:
                    error_data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
                    print(f"Error {response.status_code}: {error_data}")
                    return None

                for line in response.iter_lines():
                    if not line:
                        continue

                    line_str = line.decode('utf-8')

                    if not line_str.strip() or line_str.startswith(':'):
                        continue
                    
                    if line_str.startswith('data: '):
                        line_str = line_str[6:] # 去掉 sse 起始符
                    
                    if line_str.strip() == '[DONE]':
                        break

                    try:
                        chunk = json.loads(line_str)

                        if "error" in chunk:
                            error = chunk["error"]
                            print(f"\n[API Error: {error.get('message', 'Unknown error')}]")
                            break

                        candidates = chunk.get("candidates", [])
                        if not candidates:
                            continue

                        candidate = candidates[0]

                        safety_ratings = candidate.get("safetyRatings", [])
                        if safety_ratings:
                            blocked = any(rating.get("blocked", False) for rating in safety_ratings)
                            if blocked:
                                print("\n[Content blocked by safety filters]")
                                break

                        content = candidate.get("content", {})
                        parts = content.get("parts", [])

                        for part in parts:
                            # print(part)
                            if part.get('thought'):
                                continue
                            if 'text' in part:
                                text = part["text"]
                                full_content += text
                                if stream_output:
                                    sys.stdout.write(text)
                                    sys.stdout.flush()

                        finish_reason = candidate.get("finishReason")
                        if finish_reason:
                            if stream_output:
                                print()
                            # print(f"\n\n[Finish Reason: {finish_reason}]")
                            print(f"[Status: completed]") # Update: 保持日志风格统一
                            usage = chunk.get("usageMetadata")
                            if usage:
                                prompt_tokens = usage.get("promptTokenCount", 0)
                                candidates_tokens = usage.get("candidatesTokenCount", 0)
                                total_tokens = usage.get("totalTokenCount", 0)

                                print(f"[Token Usage - Prompt: {prompt_tokens}, "
                                  f"Completion: {candidates_tokens}, "
                                  f"Total: {total_tokens}]")

                            break

                    except json.JSONDecodeError as e:
                        print(f"\nJSON Decode Error: {e}")
                        continue

        except requests.exceptions.RequestException as e:
            print(f"Request Error: {e}")
            return None

        # 当有 schema 时，尝试解析 JSON
        if schema:
            return self._parse_json_response(full_content)

        return full_content



    def _glm_coding(self, prompt: str, systemInstruction: str, image_path: list, pdf_path: list, pdf_data: str, model: str, api_key: str, base_url: str, schema: dict, stream_output: bool, desc: str):

        if pdf_path != [] or pdf_data:
            print(f"GLM 暂不支持文档理解")
            return None

        if schema:
            print(f"GLM 暂不支持结构化输出")
            return None

        print(f"{model} 兼容 openai chat completions 格式")

        return self._openai_completions(
            prompt=prompt,
            systemInstruction=systemInstruction,
            image_path=image_path,
            pdf_path=[],
            pdf_data=None,
            model=model,
            api_key='YOUR-API-KEY',
            base_url='https://open.bigmodel.cn/api/coding/paas/v4',
            schema=None,
            stream_output=stream_output,
            desc=desc
        )

# 注册装饰器
LLMRouter.register('openai_responses', ['gpt-5', 'o1', 'o3', 'o4'])(LLMRouter._openai_responses)
LLMRouter.register('openai_completions', ['gpt'])(LLMRouter._openai_completions)
LLMRouter.register('anthropic', ['claude-'])(LLMRouter._anthropic_messages)
LLMRouter.register('gemini', ['gemini-'])(LLMRouter._gemini_generateContent)
LLMRouter.register('glm_coding', ['glm-'])(LLMRouter._glm_coding)
