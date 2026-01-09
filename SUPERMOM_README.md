# 🌟 Super Mom 工作台

为职场新手妈妈打造的智能助手平台，集成语音识别、AI对话、TTS语音合成等功能。

## ✨ 功能特性

### 1. 🍅 番茄钟
- **三种模式**：专注时刻（25分钟）、小憩一下（5分钟）、自定义时长
- **分秒输入**：自定义模式支持点击时间直接输入分钟和秒数
- **音频提醒**：完成后自动播放童声提示音（串行播放2次，防重复触发）
- **优雅设计**：使用 Abril Fatface 创意字体 + 紫色渐变主题
- **防重复机制**：useRef 标志位确保音频只播放一次

### 2. 💝 安心话匣
- **情感陪伴 AI**：使用温柔知性女声（百度TTS 4288音色）
- **双模式输入**：支持语音识别和文字输入
- **实时语音回复**：WebSocket 实时通信 + TTS语音合成
- **分步响应**：先显示用户识别文本，再显示AI回复
- **Markdown渲染**：支持 **加粗**、*斜体*、表格等富文本格式

### 3. 📝 贴心备忘录
- **双输入模式**：文字输入 + 语音识别（ASR）
- **任务管理**：勾选完成、删除任务
- **语音反馈**："丈夫夸奖"温暖男声（完成任务时触发）
- **实时提示**：底部浮动气泡显示操作确认

### 4. 🍜 产后食记
- **专业营养师 AI**：亲切闺蜜音色（百度TTS 4144）
- **智能表格生成**：LLM 自动生成 Markdown 格式营养表格
- **Markdown 富文本**：支持表格、加粗、斜体等格式渲染
- **个性化建议**：月子餐、哺乳期饮食、营养搭配等
- **语音+文字**：双模式交互体验

### 5. 💡 每日新知（Daily Insight）
- **翻转卡片**：3D 翻转动画（点击查看答案）
- **放大模态**：全屏展示答案，沉浸式阅读体验
- **循环切题**：5个实用知识点自动轮播
- **精美设计**：靛蓝渐变 + 黄色灯泡图标 + Mom's Wisdom 主题
- **知识内容**："孕傻"真相、父婴依恋、背奶保鲜、呼吸法、产后脱发

## 🏗️ 技术架构

### 后端技术栈
- **Python 3.9+**
- **Flask**: HTTP API服务器
- **WebSocket**: 实时双向通信
- **百度AI**: 语音识别(ASR)和语音合成(TTS)
- **LLM**: Gemini API for intelligent conversations

### 前端技术栈
- **React 18**: 用户界面框架（Hooks: useState, useEffect, useRef）
- **Vite**: 快速构建工具和开发服务器
- **TailwindCSS**: 原子化 CSS 框架
- **Lucide React**: 现代图标库（Heart, Clock, Lightbulb 等）
- **Web Audio API**: 音频录制、处理和播放
- **Google Fonts**: 
  - Abril Fatface（创意数字字体）
  - Great Vibes（优雅手写 Slogan 字体）
  - 高级中文宋体栈（Songti SC, Noto Serif SC）
- **Markdown 渲染**: 自定义组件支持表格、加粗、斜体
- **3D CSS 变换**: perspective + backface-visibility 实现翻转卡片

## 📁 项目结构

```
one/
├── supermom_backend.py          # 主后端服务器
├── supermom_config.py           # 配置文件（提示词、音色设置）
├── requirements.txt             # Python依赖
├── Audio/                       # 音频处理模块
│   ├── realtime_voice_server.py # 语音处理核心
│   ├── baidu_asr.py            # 百度语音识别
│   ├── TTS-ws-demo.py          # TTS WebSocket SDK
│   ├── outputs/                # 音频输出文件夹
│   │   └── 妈咪你辛苦了_童声.mp3  # 番茄钟完成音频
├── supermom_frontend/          # React前端项目
│   ├── src/
│   │   ├── App.jsx            # 主应用组件
│   │   ├── main.jsx           # 入口文件
│   │   └── index.css          # 全局样式
│   ├── package.json           # Node.js依赖
│   ├── vite.config.js         # Vite配置
│   └── index.html             # HTML模板
├── llm_req.py                  # LLM请求封装
└── router.py                   # 路由模块
```

## 🚀 快速开始

### 前置要求

1. **Python 3.9+**
2. **Node.js 18+** 和 npm
3. **百度AI账号**（用于ASR和TTS）
4. **LLM API密钥**（Gemini或其他）

### 安装步骤

#### 1. 安装Python依赖

```bash
cd C:\Users\ASUS\Desktop\one
pip install -r requirements.txt
```

#### 2. 配置百度AI密钥

编辑 `Audio/baidu_asr.py` 和 `Audio/baidu_auth.py`，填入你的百度AI密钥：

```python
APP_ID = 'your_app_id'
API_KEY = 'your_api_key'
SECRET_KEY = 'your_secret_key'
```

#### 3. 安装前端依赖

```bash
cd supermom_frontend
npm install
```

#### 4. 启动服务

**方式一：分别启动（开发模式）**

终端1 - 启动后端：
```bash
cd C:\Users\ASUS\Desktop\one
python supermom_backend.py
```

终端2 - 启动前端开发服务器：
```bash
cd supermom_frontend
npm run dev
```

**方式二：生产模式**

先构建前端：
```bash
cd supermom_frontend
npm run build
```

然后启动后端（会自动提供前端静态文件）：
```bash
cd ..
python supermom_backend.py
```

#### 5. 访问应用

开发模式：http://localhost:3000
生产模式：http://localhost:8080

## ⚙️ 配置说明

### `supermom_config.py` 配置文件

#### 语音音色设置 (`VOICE_SETTINGS`)

```python
VOICE_SETTINGS = {
    "emotional_support": {    # 安心话匣
        "tts_per": 111,       # 音色ID（情感女声-知性）
        "tts_speed": 5,       # 语速（0-15）
        "tts_pitch": 6,       # 音调（0-15）
        "tts_volume": 5,      # 音量（0-15）
        "asr_dev_pid": 1537   # ASR模型
    },
    "nutrition_advisor": {    # 产后食记
        "tts_per": 4192,      # 温柔女声
        # ...
    },
    "husband_praise": {       # 丈夫夸奖
        "tts_per": 106,       # 情感男声-温暖
        # ...
    }
}
```

**常用百度TTS音色：**
- `0`: 普通女声
- `1`: 普通男声
- `4`: 情感合成-度丫丫
- `106`: 情感男声-温暖
- `111`: 情感女声-知性
- `4192`: 温柔女声
- `4193`: 可爱童声

#### 系统提示词 (`SYSTEM_PROMPTS`)

提示词分为三个场景，位于 `supermom_config.py`：

1. **`emotional_support`**: 安心话匣的情感陪伴提示词
2. **`nutrition_advisor`**: 产后食记的营养专家提示词
3. **`husband_praise`**: 贴心备忘录的丈夫夸奖提示词

可以根据需要调整提示词风格、长度和角色设定。

## 🎯 功能详解

### 番茄钟功能

**时间设置**：
- **专注时刻**：固定 25 分钟，适合深度工作
- **小憩一下**：固定 5 分钟，短暂休息
- **自定义模式**：
  - 按钮调整：点击 +/- 按钮增减 1 分钟
  - **分秒输入**：点击时间数字，弹出输入框
    - 分钟输入：0-99 分钟
    - 秒数输入：0-59 秒
    - 点击"确定"应用，"取消"关闭

**音频播放机制**：
- 音频文件：`Audio/outputs/妈咪你辛苦了_童声.mp3`
- 播放次数：`POMODORO_REPEAT_TIMES = 2`（串行播放）
- 防重复触发：使用 `hasPlayedRef` 标志位
- 播放流程：播放完第1次 → 等待 `onended` → 播放第2次

### Markdown 渲染功能

**支持的语法**：
- **加粗**：`**文本**` 渲染为 `<strong>`
- *斜体*：`*文本*` 渲染为 `<em>`
- **表格**：标准 Markdown 表格语法
  ```markdown
  | 表头1 | 表头2 |
  |---|---|
  | 单元格1 | 单元格2 |
  ```

**渲染位置**：
- 安心话匣对话气泡
- 产后食记对话气泡
- 用户消息和 AI 消息均支持

**样式特点**：
- 表格使用高级宋体字体
- 响应式适配（用户气泡深色背景自动调整）
- 圆角阴影设计

### 每日新知翻转卡片

**交互流程**：
1. **初始状态**：显示问题卡片（正面）
2. **点击第1次**：
   - 卡片放大至全屏
   - 3D 翻转 180° 显示答案（背面）
   - 半透明黑色遮罩 + 模糊背景
3. **点击第2次**：
   - 卡片缩小回原位
   - 自动切换到下一题（循环5题）

**设计元素**：
- 靛蓝渐变背景
- 黄色灯泡图标（Lightbulb fill）
- 题目编号显示（01-05）
- "Mom's Wisdom" 主题标题
- 弹跳提示按钮

### 语音识别流程

1. 前端录制音频（WebM格式）
2. 转换为PCM格式（16kHz单声道）
3. Base64编码后发送到后端
4. 百度ASR识别为文字
5. 返回识别结果

### AI对话流程

1. 用户输入（语音或文字）
2. WebSocket发送到后端
3. 根据场景选择对应的Handler
4. LLM生成回复文本
5. TTS合成语音
6. 返回文字+音频Base64
7. 前端播放语音并显示文字

### 备忘录夸奖机制

- 触发条件：点击完成任务（从未完成→已完成）
- WebSocket消息类型：`memo_complete`
- 后端使用"丈夫"角色的Handler生成个性化夸奖
- 返回文字和语音，前端展示并播放

## 🔧 开发调试

### 查看后端日志

后端会打印详细日志，包括：
- WebSocket连接状态
- 音频数据接收情况
- ASR识别结果
- LLM回复内容
- TTS合成状态

### 前端调试

打开浏览器控制台查看：
- WebSocket连接状态
- 音频录制和播放日志
- API请求响应

### 常见问题

**1. 麦克风无法访问**
- 检查浏览器权限设置
- 确保使用HTTPS或localhost

**2. WebSocket连接失败**
- 确认后端服务已启动
- 检查防火墙设置
- 验证端口8766未被占用

**3. 音频无法播放**
- 检查浏览器是否支持Web Audio API
- 确认音频文件路径正确
- 查看控制台错误信息

**4. LLM无响应**
- 验证API密钥配置
- 检查网络连接
- 查看后端错误日志

## 📝 自定义配置

### 修改提示词

编辑 `supermom_config.py` 中的 `SYSTEM_PROMPTS` 字典，调整三个场景的提示词。

### 更换音色

编辑 `supermom_config.py` 中的 `VOICE_SETTINGS`，修改 `tts_per` 值，选择不同音色。

### 调整LLM模型

修改 `supermom_config.py` 中的 `LLM_MODEL` 变量：

```python
LLM_MODEL = "gemini-3-flash-preview"  # 或其他支持的模型
```

### 更换番茄钟音频

替换 `Audio/outputs/妈咪你辛苦了_童声.mp3` 文件，或修改配置中的路径。

## 🎨 UI自定义

前端使用TailwindCSS，可在 `supermom_frontend/src/App.jsx` 中修改：
- 颜色主题（rose、emerald、stone等）
- 布局结构
- 动画效果
- 组件样式

## 📊 性能优化

- WebSocket保持长连接，减少握手开销
- 音频采用流式传输，降低延迟
- 前端组件按需加载
- 生产环境使用构建优化

## 🔐 安全建议

1. 不要将API密钥提交到版本控制
2. 生产环境使用环境变量存储敏感信息
3. 启用HTTPS和WSS加密传输
4. 限制WebSocket连接速率
5. 验证用户输入，防止注入攻击

## 📄 许可证

本项目仅供学习和个人使用。

## 🙏 致谢

- 百度AI平台提供语音服务
- Google Gemini提供LLM能力
- React和Vite社区
- 所有开源贡献者

## 📮 联系方式

如有问题或建议，欢迎反馈。

---

**祝所有Super Mom工作生活平衡，幸福美满！** 🌟💖
