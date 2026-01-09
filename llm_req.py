import uuid
import os
import sys
from router import LLMRouter
import requests
import json
import asyncio
import time

class Agent(LLMRouter):

    def stdout_off(self):
        sys.stdout = open(os.devnull, 'w')

    def stdout_on(self):
        sys.stdout = sys.__stdout__

    def router(
        self,
        prompt: str,
        model: str = 'gemini-3-flash-preview',
        systemInstruction = None,
        image_path: list = [],
        pdf_path: list = [],
        pdf_data: str = None,
        provider: str = 'auto',
        api_key: str = None,
        base_url: str = None,
        schema: dict = None,
        stream_output: bool = True,
        description=''
    ):
        """
        provider: 指定的供应商，可选值：
            - 'auto': 自动检测
            - 'openai_completions': OpenAI Chat Completions API （大部分模型兼容该统一规范）
            - 'openai_responses': OpenAI Responses API (/v1/responses)
            - 'anthropic': Anthropic Messages API (/v1/messages)
            - 'gemini': Gemini Generate (/v1beta/models/${modelName}:generateContent)
            - 'glm_coding': GLM Coding (/api/coding/pass/v4)

        stream_output: 是否打印流式输出到控制台，默认为 True

        * 支持图像理解;
        * 支持文档理解 (gemini, anthropic);
        * 支持结构化输出 (openai_completions, openai_responses) # TODO: 补充结构化输出测例
            - 仅支持传入标准的 Json Schema, 不支持 Pydantic Model、TypeDict Model;
            - OpenAI 和 Gemini 所支持的 Schema 不同；# TODO: Check
                - OpenAI 是标准的 Json Schema, 类型小写, 支持联合类型;
                - Gemini 是 protobuf 风格的 Json Schema;
        """
        actual_provider = self._detect_provider(model) if provider == 'auto' else provider

        if actual_provider not in self._providers:
            raise ValueError(f"Unknown provider: {actual_provider}")
        
        handler = getattr(self, self._providers[actual_provider]['handler'].__name__)
        return handler(prompt=prompt, systemInstruction=systemInstruction, image_path=image_path, schema=schema,
                       pdf_path=pdf_path, pdf_data=pdf_data, model=model, api_key=api_key, base_url=base_url,
                       stream_output=stream_output, desc=description)


if __name__ == '__main__':
    llm = Agent()
    user_input = "三亚学院附近有什么好吃的？"
    
    result = llm.router(
        prompt=f"""
        你的任务是针对用户的输入进行**意图识别**

        我们有以下意图选择：
        1. 简单聊天；
        2. 查询美食餐厅。

        用户输入：{user_input}

        Use this Json Response Format:
        {{
            "intent": "chat" | "restaurant"
        }}
        """,
        schema={
            "type": "object",
            "properties": {
                "intent": {
                    "type": "string",
                    "enum": ["chat", "restaurant"],
                    "description": "用户意图类型"
                }
            },
            "required": ["intent"]
        }
    )
    print(result)

    if result['intent'] == 'restaurant':
        print("现在开始查询高德地图……")