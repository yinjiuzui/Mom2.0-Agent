import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  Clock, 
  Coffee, 
  Mic, 
  Send, 
  CheckCircle2, 
  Plus, 
  Minus,
  X, 
  Utensils, 
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Lightbulb,
  RefreshCw
} from 'lucide-react';

const WS_URL = 'ws://localhost:8766';
const API_URL = 'http://localhost:8080';

/**
 * 引入 Google Fonts
 */
const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Great+Vibes&display=swap');
    
    .font-creative {
      font-family: 'Abril Fatface', cursive;
      letter-spacing: 0.05em;
    }
    
    .font-slogan {
      font-family: 'Great Vibes', cursive;
    }
    
    .font-song {
      font-family: "Songti SC", "Noto Serif SC", "STSong", "SimSun", serif;
    }

    /* 表格样式优化 - 针对 LLM 生成的 Markdown 表格 */
    .prose-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.75rem 0;
      font-size: 0.85rem;
      background-color: rgba(255, 255, 255, 0.5);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    
    .prose-table th {
      background-color: #f5f5f4;
      color: #57534e;
      font-weight: 600;
      padding: 0.75rem;
      text-align: left;
      font-family: "Songti SC", "Noto Serif SC", serif;
      border-bottom: 2px solid #e7e5e4;
    }
    
    .prose-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #f5f5f4;
      color: #44403c;
      font-family: "Songti SC", "Noto Serif SC", serif;
    }

    .prose-table tr:last-child td {
      border-bottom: none;
    }

    /* 用户消息气泡中的表格样式适配 */
    .bg-slate-700 .prose-table {
      background-color: rgba(255, 255, 255, 0.1);
    }
    .bg-slate-700 .prose-table th {
      background-color: rgba(0, 0, 0, 0.2);
      color: #e2e8f0;
      border-bottom-color: rgba(255, 255, 255, 0.1);
    }
    .bg-slate-700 .prose-table td {
      color: #f1f5f9;
      border-bottom-color: rgba(255, 255, 255, 0.05);
    }
  `}</style>
);

/**
 * 简易 Markdown 解析组件
 * 专门用于解析纯文本中的表格、加粗、斜体和换行
 */
const MarkdownRenderer = ({ content, isUser }) => {
  // 解析内联样式（加粗、斜体）
  const parseInlineStyles = (text) => {
    const parts = [];
    let lastIndex = 0;
    
    // 正则：匹配 **加粗** 或 *斜体*
    const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      // 添加前面的普通文本
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // 判断是加粗还是斜体
      if (match[1]) {
        // **加粗**
        parts.push(<strong key={match.index}>{match[2]}</strong>);
      } else if (match[3]) {
        // *斜体*
        parts.push(<em key={match.index}>{match[4]}</em>);
      }
      
      lastIndex = regex.lastIndex;
    }
    
    // 添加剩余文本
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  // 简单的表格解析逻辑
  const renderContent = () => {
    // 检查是否包含 Markdown 表格特征 (简单的检查：包含 | 和 ---)
    if (content.includes('|') && content.includes('---')) {
      const lines = content.split('\n');
      const elements = [];
      let tableBuffer = [];
      let inTable = false;

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        // 判定是否是表格行
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          if (!inTable) inTable = true;
          tableBuffer.push(trimmed);
        } else {
          // 如果之前在处理表格，现在结束了，渲染表格
          if (inTable) {
            elements.push(renderTable(tableBuffer, `tbl-${index}`));
            tableBuffer = [];
            inTable = false;
          }
          // 渲染普通文本行（支持内联样式）
          if (line !== '') {
            elements.push(
              <p key={`p-${index}`} className="mb-1 min-h-[1.2em]">
                {parseInlineStyles(line)}
              </p>
            );
          }
        }
      });

      // 处理末尾可能的表格
      if (inTable) {
        elements.push(renderTable(tableBuffer, `tbl-last`));
      }

      return elements;
    }

    // 如果没有表格，直接处理换行和内联样式
    return content.split('\n').map((line, i) => (
      <p key={i} className="mb-1 min-h-[1.2em]">
        {parseInlineStyles(line)}
      </p>
    ));
  };

  const renderTable = (rows, key) => {
    // 过滤掉分隔行 |---|
    const cleanRows = rows.filter(r => !r.includes('---'));
    if (cleanRows.length === 0) return null;

    const headers = cleanRows[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
    const data = cleanRows.slice(1).map(r => r.split('|').filter(c => c.trim() !== '').map(c => c.trim()));

    return (
      <div key={key} className="overflow-x-auto my-2 rounded-lg">
        <table className="prose-table">
          <thead>
            <tr>
              {headers.map((h, i) => <th key={i}>{parseInlineStyles(h)}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => <td key={j}>{parseInlineStyles(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return <div className="markdown-body">{renderContent()}</div>;
};

/**
 * ChatInterface - 整合了WebSocket语音功能
 */
const ChatInterface = ({ title, type, onClose, initialMessage }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: initialMessage, sender: 'bot' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadingType, setLoadingType] = useState('bot');
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    wsRef.current = new WebSocket(WS_URL);
    
    wsRef.current.onopen = () => {
      console.log(`[${type}] WebSocket连接成功`);
    };
    
    wsRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[${type}] 收到服务器响应:`, data);
        
        if (data.error) {
          console.error(`[${type}] 错误:`, data.message);
          setMessages(prev => [...prev, { 
            id: Date.now(), 
            text: `抱歉，出现了一些问题：${data.message}`, 
            sender: 'bot' 
          }]);
          setIsSending(false);
          return;
        }
        
        if (data.type === 'user_text_recognized') {
          console.log(`[${type}] 识别完成，显示用户文本:`, data.user_text);
          
          setMessages(prev => [...prev, { 
            id: Date.now(), 
            text: data.user_text, 
            sender: 'user'
          }]);
          
          setLoadingType('bot');
          return;
        }
        
        if (data.type === 'voice_response' || data.type === 'text_response') {
          console.log(`[${type}] 收到AI回复:`, data.response_text);
          
          setMessages(prev => [...prev, { 
            id: Date.now(), 
            text: data.response_text, 
            sender: 'bot',
            audio: data.audio
          }]);
          
          if (data.audio) {
            playAudio(data.audio);
          }
          
          setIsSending(false);
        }
      } catch (error) {
        console.error(`[${type}] 消息处理错误:`, error);
        setIsSending(false);
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error(`[${type}] WebSocket错误:`, error);
      setIsSending(false);
    };
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [type]);

  const playAudio = async (audioBase64) => {
    try {
      const audioData = atob(audioBase64);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
    } catch (error) {
      console.error('音频播放错误:', error);
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || isSending) return;
    
    const newMsg = { id: Date.now(), text: inputText, sender: 'user' };
    setMessages(prev => [...prev, newMsg]);
    setIsSending(true);
    
    const chatTypeMap = {
      'food': 'nutrition_advisor',
      'talk': 'emotional_support'
    };
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'text_chat',
        chat_type: chatTypeMap[type],
        text: inputText
      }));
    }
    
    setInputText('');
  };

  const startRecording = async () => {
    console.log(`[${type}] 开始录音...`);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      console.log(`[${type}] 麦克风访问成功`);
      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`[${type}] 录音数据块:`, event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        console.log(`[${type}] 录音停止，共`, audioChunksRef.current.length, '个数据块');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log(`[${type}] 音频Blob大小:`, audioBlob.size, 'bytes');
        await sendAudioToServer(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsListening(true);
      console.log(`[${type}] MediaRecorder已启动`);
    } catch (error) {
      console.error(`[${type}] 录音错误:`, error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const sendAudioToServer = async (audioBlob) => {
    console.log(`[${type}] 开始处理音频发送到服务器...`);
    try {
      setIsSending(true);
      setLoadingType('user');
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log(`[${type}] ArrayBuffer大小:`, arrayBuffer.byteLength, 'bytes');
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log(`[${type}] 音频解码成功，时长:`, audioBuffer.duration.toFixed(2), '秒');
      
      const offlineContext = new OfflineAudioContext(1, audioBuffer.length, 16000);
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      
      console.log(`[${type}] 重采样到16kHz...`);
      const renderedBuffer = await offlineContext.startRendering();
      const pcmData = renderedBuffer.getChannelData(0);
      const pcmInt16 = new Int16Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        pcmInt16[i] = Math.max(-32768, Math.min(32767, Math.floor(pcmData[i] * 32768)));
      }
      
      console.log(`[${type}] PCM数据大小:`, pcmInt16.byteLength, 'bytes');
      
      const uint8Array = new Uint8Array(pcmInt16.buffer);
      const chunkSize = 8192;
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binaryString += String.fromCharCode.apply(null, chunk);
      }
      const audioBase64 = btoa(binaryString);
      console.log(`[${type}] Base64编码长度:`, audioBase64.length, '字符');
      
      const chatTypeMap = {
        'food': 'nutrition_advisor',
        'talk': 'emotional_support'
      };
      
      console.log(`[${type}] 通过WebSocket发送语音数据，类型:`, chatTypeMap[type]);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'voice_chat',
          chat_type: chatTypeMap[type],
          audio: audioBase64
        }));
        console.log(`[${type}] 语音数据已发送，等待服务器响应...`);
      } else {
        console.error(`[${type}] WebSocket未连接，状态:`, wsRef.current?.readyState);
        setIsSending(false);
        alert('连接断开，请刷新页面重试');
      }
    } catch (error) {
      console.error(`[${type}] 音频发送错误:`, error);
      setIsSending(false);
      alert('音频处理失败: ' + error.message);
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className={`bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[600px] border-4 ${type === 'food' ? 'border-emerald-100' : 'border-purple-100'}`}>
        <div className={`p-4 flex justify-between items-center ${type === 'food' ? 'bg-emerald-50' : 'bg-purple-50'}`}>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${type === 'food' ? 'bg-emerald-200 text-emerald-700' : 'bg-purple-200 text-purple-700'}`}>
              {type === 'food' ? <Utensils size={20} /> : <Heart size={20} />}
            </div>
            <h3 className="font-song font-bold text-slate-700 text-lg tracking-wide">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm font-song ${
                msg.sender === 'user' 
                  ? 'bg-slate-700 text-white rounded-br-none' 
                  : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
              }`}>
                <MarkdownRenderer content={msg.text} isUser={msg.sender === 'user'} />
              </div>
            </div>
          ))}
          {isSending && (
            <div className={`flex ${loadingType === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-2xl ${
                loadingType === 'user' 
                  ? 'bg-slate-700 text-white rounded-br-none' 
                  : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
              }`}>
                <div className="flex gap-1">
                  <div className={`w-2 h-2 rounded-full animate-bounce ${loadingType === 'user' ? 'bg-slate-300' : 'bg-slate-400'}`} style={{animationDelay: '0ms'}}></div>
                  <div className={`w-2 h-2 rounded-full animate-bounce ${loadingType === 'user' ? 'bg-slate-300' : 'bg-slate-400'}`} style={{animationDelay: '150ms'}}></div>
                  <div className={`w-2 h-2 rounded-full animate-bounce ${loadingType === 'user' ? 'bg-slate-300' : 'bg-slate-400'}`} style={{animationDelay: '300ms'}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button 
              className={`p-3 rounded-full transition-all ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} ${isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handleMicClick}
              disabled={isSending}
              title="语音输入"
            >
              <Mic size={20} />
            </button>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="输入或说话..."
              disabled={isListening || isSending}
              className="flex-1 bg-slate-50 border-none rounded-full px-4 py-3 focus:ring-2 focus:ring-purple-200 outline-none text-slate-700 font-song"
            />
            <button 
              onClick={handleSend}
              className={`p-3 rounded-full text-white transition-transform active:scale-95 shadow-md ${type === 'food' ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-purple-400 hover:bg-purple-500'}`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 每日新知组件 (Daily Insight / Mom's Why)
 * 交互升级：翻转 + 放大模态框
 */
const DailyInsight = () => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const insights = [
    {
      q: "为什么感觉记忆力下降，\"孕傻\"是真的吗？",
      a: "其实智力并未下降。是因为照顾宝宝占用了大量注意力资源。尝试使用右侧的「贴心备忘录」来给大脑减负吧，你依然很棒！"
    },
    {
      q: "宝宝只认妈妈，不跟爸爸睡怎么办？",
      a: "试试\"循序渐进法\"。周末让爸爸主导陪玩，妈妈适当\"消失\"一小会儿去喝杯咖啡。给父婴建立依恋关系的空间。"
    },
    {
      q: "重返职场，背奶如何保鲜？",
      a: "母乳在常温(25°C)下可保存4小时，蓝冰包内可保存24小时。建议准备专用的双层背奶包，既隐蔽又安全。"
    },
    {
      q: "如何在工作间隙快速缓解焦虑？",
      a: "试试\"4-7-8呼吸法\"：吸气4秒，憋气7秒，呼气8秒。重复3次，能有效激活副交感神经，让心率平缓下来。"
    },
    {
       q: "产后脱发严重，什么时候能好转？",
       a: "这是激素水平回落导致的生理性脱发，通常在产后6-12个月会自然恢复。请保持好心情，多补充蛋白质和铁质。"
    }
  ];

  const handleCardClick = () => {
    if (isFlipped) {
      // 如果已翻转（放大状态），则重置状态并切题
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % insights.length);
      }, 500); // 等待动画完成
    } else {
      // 未翻转时，进入放大+翻转状态
      setIsFlipped(true);
    }
  };

  return (
    <div className="h-40 relative">
      {/* 占位符：当卡片变为 fixed 飞出时，保留原位置防止布局塌陷 */}
      {isFlipped && <div className="w-full h-full" />}

      <div 
        className={`
          group perspective cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${isFlipped 
            ? 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6' // 放大模态模式
            : 'relative w-full h-full' // 正常网格模式
          }
        `}
        onClick={handleCardClick}
      >
        <div 
          className={`
            relative transform-style-3d transition-all duration-700 shadow-xl
            ${isFlipped 
              ? 'w-full max-w-xl h-[60vh] rotate-y-180' // 放大尺寸 + 翻转
              : 'w-full h-full rotate-y-0 hover:shadow-lg' // 正常尺寸
            }
          `}
        >
          {/* 正面: 问题 (Front Side) */}
          <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-5 border border-indigo-100 flex flex-col justify-between overflow-hidden">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-800">
                   <Lightbulb size={isFlipped ? 24 : 18} className="text-yellow-500 fill-yellow-500 transition-all" />
                   <h3 className={`font-song font-bold tracking-wider transition-all ${isFlipped ? 'text-lg' : 'text-sm'}`}>每日·新知</h3>
                </div>
                <span className={`font-creative text-indigo-200 opacity-50 transition-all ${isFlipped ? 'text-6xl' : 'text-2xl'}`}>
                  0{currentIndex + 1}
                </span>
             </div>
             
             <p className={`font-song text-slate-700 font-bold leading-snug pr-4 transition-all ${isFlipped ? 'text-3xl mt-8' : 'text-lg'}`}>
               {insights[currentIndex].q}
             </p>
             
             <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-indigo-400 font-song">
                   {isFlipped ? "" : "点击查看答案"}
                </span>
                {!isFlipped && (
                  <div className="p-1.5 rounded-full bg-white/50 text-indigo-300">
                    <span className="text-[10px] font-creative">Tap</span>
                  </div>
                )}
             </div>
          </div>

          {/* 背面: 答案 (Back Side - Enlarged View) */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-3xl p-8 shadow-2xl border border-indigo-100 flex flex-col justify-center items-center text-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
             <div className="absolute top-6 right-6 p-3 opacity-20">
               <Sparkles size={80} className="text-indigo-500" />
             </div>
             
             <h4 className="text-indigo-500 font-song font-bold text-xl mb-6">Mom's Wisdom</h4>
             
             <p className="font-song text-slate-700 text-2xl leading-relaxed max-w-lg">
               {insights[currentIndex].a}
             </p>

             <div className="mt-12 animate-bounce">
               <span className="text-sm bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full font-song cursor-pointer hover:bg-indigo-100 transition-colors">
                 点击屏幕切换下一题
               </span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * MemoPad - 整合了语音识别和WebSocket通知功能
 */
const MemoPad = () => {
  const [memos, setMemos] = useState([
    { id: 1, text: "下午3点挤奶", done: false },
    { id: 2, text: "回复Lisa邮件", done: true },
  ]);
  const [newMemo, setNewMemo] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [botReply, setBotReply] = useState(null);
  
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    wsRef.current = new WebSocket(WS_URL);
    
    wsRef.current.onopen = () => {
      console.log('[Memo] WebSocket连接成功');
    };
    
    wsRef.current.onerror = (error) => {
      console.error('[Memo] WebSocket错误:', error);
    };
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const addMemo = (text) => {
    const content = text || newMemo;
    if (!content.trim()) return;
    
    setMemos([...memos, { id: Date.now(), text: content, done: false }]);
    setNewMemo('');
    
    setBotReply({ text: `好的，已为您添加"${content}"` });
    setTimeout(() => setBotReply(null), 3000);
  };

  const toggleMemo = (id) => {
    const memo = memos.find(m => m.id === id);
    if (memo && !memo.done && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'memo_complete',
        memo_text: memo.text
      }));
    }
    
    setMemos(memos.map(m => m.id === id ? { ...m, done: !m.done } : m));
  };

  const startRecording = async () => {
    console.log('[Memo] 开始录音...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      console.log('[Memo] 麦克风访问成功');
      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('[Memo] 录音数据块:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        console.log('[Memo] 录音停止，共', audioChunksRef.current.length, '个数据块');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('[Memo] 音频Blob大小:', audioBlob.size, 'bytes');
        await sendAudioForASR(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsListening(true);
      console.log('[Memo] MediaRecorder已启动');
    } catch (error) {
      console.error('[Memo] 录音错误:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const sendAudioForASR = async (audioBlob) => {
    console.log('[Memo ASR] 开始处理音频...');
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('[Memo ASR] ArrayBuffer大小:', arrayBuffer.byteLength, 'bytes');
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('[Memo ASR] 音频解码成功，时长:', audioBuffer.duration.toFixed(2), '秒');
      
      const offlineContext = new OfflineAudioContext(1, audioBuffer.length, 16000);
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      
      console.log('[Memo ASR] 重采样到16kHz...');
      const renderedBuffer = await offlineContext.startRendering();
      const pcmData = renderedBuffer.getChannelData(0);
      const pcmInt16 = new Int16Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        pcmInt16[i] = Math.max(-32768, Math.min(32767, Math.floor(pcmData[i] * 32768)));
      }
      
      console.log('[Memo ASR] PCM数据大小:', pcmInt16.byteLength, 'bytes');
      
      const uint8Array = new Uint8Array(pcmInt16.buffer);
      const chunkSize = 8192;
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binaryString += String.fromCharCode.apply(null, chunk);
      }
      const audioBase64 = btoa(binaryString);
      console.log('[Memo ASR] Base64编码长度:', audioBase64.length, '字符');
      
      console.log('[Memo ASR] 发送请求到:', `${API_URL}/api/asr`);
      const response = await fetch(`${API_URL}/api/asr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio: audioBase64 })
      });
      
      console.log('[Memo ASR] 响应状态:', response.status);
      const result = await response.json();
      console.log('[Memo ASR] 响应结果:', result);
      
      if (!result.error && result.text) {
        console.log('[Memo ASR] 识别成功:', result.text);
        addMemo(result.text);
      } else {
        console.error('[Memo ASR] 识别失败:', result.message);
        alert('语音识别失败: ' + result.message);
      }
    } catch (error) {
      console.error('[Memo ASR] 异常:', error);
      alert('语音识别出错: ' + error.message);
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col h-full relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -z-0 opacity-50" />
      
      <h3 className="text-slate-700 font-song font-bold text-lg tracking-wide mb-4 flex items-center gap-2 relative z-10">
        <Sparkles size={18} className="text-purple-400" />
        贴心备忘录
      </h3>

      <div className="flex-1 overflow-y-auto space-y-2 mb-4 relative z-10 custom-scrollbar pr-2">
        {memos.map(memo => (
          <div 
            key={memo.id} 
            className="flex items-center gap-3 p-2 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors group/item"
            onClick={() => toggleMemo(memo.id)}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
              memo.done ? 'bg-purple-300 border-purple-300' : 'border-slate-300'
            }`}>
              {memo.done && <CheckCircle2 size={14} className="text-white" />}
            </div>
            <span className={`text-sm text-slate-600 font-song ${memo.done ? 'line-through text-slate-400' : ''}`}>
              {memo.text}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); setMemos(memos.filter(m => m.id !== memo.id)); }}
              className="ml-auto opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-purple-400 p-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {botReply && (
        <div className="absolute bottom-16 left-6 right-6 z-20 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div className="bg-slate-800 text-white text-xs px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 opacity-90 font-song">
            <Volume2 size={14} className="text-purple-300 animate-pulse" />
            <span>{botReply.text}</span>
          </div>
        </div>
      )}

      <div className="relative z-10 flex items-center gap-2 bg-slate-50 rounded-xl p-1 pr-1 border border-transparent focus-within:border-purple-100 focus-within:ring-2 focus-within:ring-purple-50 transition-all">
        <button 
          onClick={handleMicClick}
          className={`p-2 rounded-lg transition-all ${isListening ? 'bg-purple-100 text-purple-500 animate-pulse' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}
        >
          <Mic size={16} />
        </button>
        <input 
          type="text" 
          value={newMemo}
          onChange={(e) => setNewMemo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMemo()}
          placeholder="记点什么..."
          disabled={isListening}
          className="flex-1 bg-transparent border-none text-sm px-1 py-2 outline-none text-slate-700 placeholder:text-slate-400 font-song"
        />
        <button 
          onClick={() => addMemo()} 
          className="bg-slate-200 hover:bg-purple-400 hover:text-white text-slate-600 rounded-lg p-1.5 transition-all"
        >
          {isListening ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Plus size={16} />}
        </button>
      </div>
    </div>
  );
};

/**
 * Pomodoro - 番茄钟
 */
const Pomodoro = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('focus');
  const [customDuration, setCustomDuration] = useState(30 * 60);
  const [inputMinutes, setInputMinutes] = useState(30);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const hasPlayedRef = useRef(false); // 防止重复播放

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(timeLeft - 1), 1000);
      hasPlayedRef.current = false; // 重置播放标志
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      // 只在未播放时才触发
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        playCompletionSound();
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const playCompletionSound = async () => {
    try {
      const response = await fetch(`${API_URL}/api/pomodoro-audio`);
      const data = await response.json();
      
      if (data.error) {
        console.error('获取音频失败:', data.message);
        return;
      }
      
      // 解码base64音频
      const audioData = atob(data.audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }
      
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      // 播放指定次数
      const repeatTimes = data.repeat_times || 1;
      let playCount = 0;
      
      const playNext = () => {
        if (playCount < repeatTimes) {
          const audio = new Audio(audioUrl);
          audio.onended = () => {
            playCount++;
            playNext();
          };
          audio.play();
        } else {
          URL.revokeObjectURL(audioUrl);
        }
      };
      
      playNext();
    } catch (error) {
      console.error('播放完成音效失败:', error);
    }
  };

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    if (mode === 'focus') setTimeLeft(25 * 60);
    else if (mode === 'rest') setTimeLeft(5 * 60);
    else setTimeLeft(customDuration);
  };

  const changeMode = (newMode) => {
    setMode(newMode);
    setIsActive(false);
    if (newMode === 'focus') setTimeLeft(25 * 60);
    else if (newMode === 'rest') setTimeLeft(5 * 60);
    else setTimeLeft(customDuration);
  };

  const adjustTime = (seconds) => {
    if (isActive) return;
    const newTime = Math.max(60, timeLeft + seconds);
    setTimeLeft(newTime);
    setCustomDuration(newTime);
  };

  const handleCustomTimeSubmit = () => {
    if (isActive) return;
    const totalSeconds = Math.max(1, inputMinutes * 60 + inputSeconds);
    setTimeLeft(totalSeconds);
    setCustomDuration(totalSeconds);
    setShowInput(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-[40px] shadow-lg shadow-purple-100/50 p-6 flex flex-col items-center justify-center relative overflow-hidden w-full h-full border border-white">
      <div className={`absolute inset-0 bg-gradient-to-br transition-opacity duration-1000 ${
        isActive ? 'from-purple-50 to-white opacity-100' : 'from-white to-slate-50 opacity-100'
      }`} />
      
      <div className="absolute w-64 h-64 rounded-full border-[6px] border-purple-100/50 z-0"></div>
      
      <div className="z-10 text-center space-y-4">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <button 
            className={`text-sm font-medium px-3 py-1 rounded-full transition-colors font-song ${mode === 'focus' ? 'bg-purple-100 text-purple-700' : 'text-slate-400 hover:text-slate-500'}`}
            onClick={() => changeMode('focus')}
          >
            专注时刻
          </button>
          <button 
            className={`text-sm font-medium px-3 py-1 rounded-full transition-colors font-song ${mode === 'rest' ? 'bg-teal-100 text-teal-700' : 'text-slate-400 hover:text-slate-500'}`}
            onClick={() => changeMode('rest')}
          >
            小憩一下
          </button>
          <button 
            className={`text-sm font-medium px-3 py-1 rounded-full transition-colors font-song ${mode === 'custom' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-500'}`}
            onClick={() => changeMode('custom')}
          >
            自定义
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          {mode === 'custom' && !isActive && !showInput && (
            <button 
              onClick={() => adjustTime(-60)}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
              title="减少1分钟"
            >
              <Minus size={16} />
            </button>
          )}
          
          {showInput && mode === 'custom' && !isActive ? (
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                min="0" 
                max="99"
                value={inputMinutes}
                onChange={(e) => setInputMinutes(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                className="w-20 text-4xl font-creative text-slate-700 text-center bg-slate-50 border-2 border-purple-200 rounded-xl px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="00"
              />
              <span className="text-3xl font-creative text-slate-500">:</span>
              <input 
                type="number" 
                min="0" 
                max="59"
                value={inputSeconds}
                onChange={(e) => setInputSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                className="w-20 text-4xl font-creative text-slate-700 text-center bg-slate-50 border-2 border-purple-200 rounded-xl px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="00"
              />
              <button 
                onClick={handleCustomTimeSubmit}
                className="ml-2 px-4 py-2 bg-purple-400 text-white rounded-lg hover:bg-purple-500 transition-colors font-song text-sm"
              >
                确定
              </button>
              <button 
                onClick={() => setShowInput(false)}
                className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors font-song text-sm"
              >
                取消
              </button>
            </div>
          ) : (
            <div 
              className={`text-7xl font-creative text-slate-700 tracking-wide tabular-nums leading-none w-[320px] text-center ${mode === 'custom' && !isActive ? 'cursor-pointer hover:text-purple-500 transition-colors' : ''}`}
              onClick={() => mode === 'custom' && !isActive && setShowInput(true)}
              title={mode === 'custom' && !isActive ? '点击输入自定义时间' : ''}
            >
              {formatTime(timeLeft)}
            </div>
          )}

          {mode === 'custom' && !isActive && !showInput && (
            <button 
              onClick={() => adjustTime(60)}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
              title="增加1分钟"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        
        <p className="text-slate-400 text-sm h-6 font-song">
          {isActive ? 
            (mode === 'rest' ? "好好放松..." : "沉浸工作中...") : 
            (mode === 'custom' ? "设定你的专属节奏" : (mode === 'focus' ? "准备好开始了吗？" : "休息是为了走更远的路"))
          }
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          <button 
            onClick={toggleTimer}
            className="w-16 h-16 rounded-full bg-purple-400 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-200 hover:scale-105 transition-all"
          >
            {isActive ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
          </button>
          <button 
            onClick={resetTimer}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all"
            title="重置"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F6FA] text-slate-700 font-sans selection:bg-purple-200">
      <FontStyles />
      {/* 3D Transform CSS */}
      <style>{`
        .perspective { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
      
      <div className="max-w-7xl mx-auto p-6 h-screen flex flex-col">
        <header className="flex justify-between items-center mb-6 px-2">
          <div>
            <h1 className="text-3xl font-song font-bold text-slate-800 tracking-wide">她伴:Mom2.0职场版Agent</h1>
            <p className="text-slate-500 text-2xl mt-2 ml-1 font-slogan tracking-wide">Love yourself a little more today.</p>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
            <Clock className="text-purple-400" size={20} />
            <div className="text-right">
              <div className="text-3xl font-creative text-slate-700 leading-none tracking-wide">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-song">
                {currentTime.toLocaleDateString([], { month: 'long', day: 'numeric', weekday: 'long' })}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-12 gap-6 h-full pb-6">
          <div className="col-span-8 flex flex-col gap-6">
            <div className="flex-1">
              <Pomodoro />
            </div>

            {/* 底部双列网格：安心话匣 + 每日新知 */}
            <div className="grid grid-cols-2 gap-6">
              
              {/* 安心话匣 - 调整为双列布局样式 */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-3xl p-1 shadow-sm h-40 relative overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                   onClick={() => setActiveChat('talk')}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="bg-white/60 backdrop-blur-sm h-full rounded-[20px] p-5 flex flex-col justify-between border border-white/50 group-hover:bg-white/80 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-400 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                      <Heart size={24} fill="currentColor" className="animate-pulse" />
                    </div>
                    <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center text-purple-400 shadow-sm group-hover:scale-110 transition-transform">
                      <Mic size={20} />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-song font-bold text-slate-800 mb-1 tracking-wide">安心话匣</h2>
                    <p className="text-slate-500 text-xs font-song leading-relaxed">焦虑、疲惫或者想吐槽？<br/>这里是你的专属树洞。</p>
                  </div>
                </div>
              </div>

              {/* 新增组件：每日新知（翻转卡片） */}
              <DailyInsight />

            </div>
          </div>

          <div className="col-span-4 flex flex-col gap-6 h-full">
            <div className="flex-[1.5] min-h-[250px]">
              <MemoPad />
            </div>

            <div 
              className="flex-1 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-6 relative overflow-hidden hover:shadow-md transition-all cursor-pointer border border-emerald-100/50 group"
              onClick={() => setActiveChat('food')}
            >
              <div className="absolute top-4 right-4 text-emerald-200/50">
                <Utensils size={80} />
              </div>
              
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-800 flex items-center justify-center mb-3">
                    <Coffee size={20} />
                  </div>
                  <h3 className="text-2xl font-song font-bold text-slate-800 mb-1 tracking-wide">产后食记</h3>
                  <p className="text-emerald-700/80 text-sm leading-relaxed max-w-[80%] font-song">
                    怎么吃恢复快？今天该补什么？<br/>
                    问问你的专属营养师。
                  </p>
                </div>
                
                <div className="mt-4 flex items-center gap-2 text-emerald-600 font-medium text-sm group-hover:translate-x-1 transition-transform font-song">
                  <span>开启对话</span>
                  <div className="bg-white p-1 rounded-full">
                    <Play size={10} fill="currentColor" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {activeChat && (
        <ChatInterface 
          title={activeChat === 'food' ? "产后食记 - 营养咨询" : "安心话匣 - 情绪树洞"}
          type={activeChat}
          initialMessage={activeChat === 'food' 
            ? "嗨！今天感觉身体怎么样？想咨询关于月子餐、回奶还是日常营养搭配的问题呢？" 
            : "亲爱的，我在呢。是不是工作太累了，还是因为想念宝宝而分心？这里只有我们，你可以畅所欲言。"}
          onClose={() => setActiveChat(null)}
        />
      )}
    </div>
  );
}
