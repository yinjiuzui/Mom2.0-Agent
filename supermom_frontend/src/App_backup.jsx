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
  Volume2
} from 'lucide-react';

const WS_URL = 'ws://localhost:8766';
const API_URL = 'http://localhost:8080';

const ChatInterface = ({ title, type, onClose, initialMessage }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: initialMessage, sender: 'bot' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadingType, setLoadingType] = useState('bot'); // 'user' or 'bot' - 控制加载气泡位置
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
        
        // 处理用户文本识别完成（第一步）
        if (data.type === 'user_text_recognized') {
          console.log(`[${type}] 识别完成，显示用户文本:`, data.user_text);
          
          // 立即显示用户识别的文本
          setMessages(prev => [...prev, { 
            id: Date.now(), 
            text: data.user_text, 
            sender: 'user'
          }]);
          
          // 改变加载类型为'bot'，表示现在等待AI回复
          setLoadingType('bot');
          // 保持加载状态，等待AI回复
          // setIsSending 保持 true
          return;
        }
        
        // 处理AI回复（第二步）
        if (data.type === 'voice_response' || data.type === 'text_response') {
          console.log(`[${type}] 收到AI回复:`, data.response_text);
          
          // 显示AI回复
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
      const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
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
      setLoadingType('user'); // 设置为等待用户消息（识别中）
      
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
      
      // 分块转换为Base64，避免栈溢出
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
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className={`bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[600px] border-4 ${type === 'food' ? 'border-emerald-100' : 'border-rose-100'}`}>
        <div className={`p-4 flex justify-between items-center ${type === 'food' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${type === 'food' ? 'bg-emerald-200 text-emerald-700' : 'bg-rose-200 text-rose-700'}`}>
              {type === 'food' ? <Utensils size={20} /> : <Heart size={20} />}
            </div>
            <h3 className="font-bold text-stone-700 text-lg">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
            <X size={20} className="text-stone-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-stone-700 text-white rounded-br-none' 
                  : 'bg-white text-stone-700 border border-stone-100 rounded-bl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isSending && (
            <div className={`flex ${loadingType === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-2xl ${
                loadingType === 'user' 
                  ? 'bg-stone-700 text-white rounded-br-none' 
                  : 'bg-white text-stone-700 border border-stone-100 rounded-bl-none'
              }`}>
                <div className="flex gap-1">
                  <div className={`w-2 h-2 rounded-full animate-bounce ${loadingType === 'user' ? 'bg-stone-300' : 'bg-stone-400'}`} style={{animationDelay: '0ms'}}></div>
                  <div className={`w-2 h-2 rounded-full animate-bounce ${loadingType === 'user' ? 'bg-stone-300' : 'bg-stone-400'}`} style={{animationDelay: '150ms'}}></div>
                  <div className={`w-2 h-2 rounded-full animate-bounce ${loadingType === 'user' ? 'bg-stone-300' : 'bg-stone-400'}`} style={{animationDelay: '300ms'}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-stone-100">
          <div className="flex items-center gap-2">
            <button 
              className={`p-3 rounded-full transition-all ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'} ${isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              placeholder={isListening ? "正在录音..." : "输入或说话..."}
              disabled={isListening || isSending}
              className="flex-1 bg-stone-50 border-none rounded-full px-4 py-3 focus:ring-2 focus:ring-rose-200 outline-none text-stone-700"
            />
            <button 
              onClick={handleSend}
              disabled={isSending}
              className={`p-3 rounded-full text-white transition-transform active:scale-95 shadow-md ${type === 'food' ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-rose-400 hover:bg-rose-500'} ${isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const audioContextRef = useRef(null);

  useEffect(() => {
    wsRef.current = new WebSocket(WS_URL);
    
    wsRef.current.onopen = () => {
      console.log('[Memo] WebSocket连接成功');
    };
    
    wsRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'memo_praise' && !data.error) {
          setBotReply({ text: data.praise_text });
          
          if (data.audio) {
            playAudio(data.audio);
          }
          
          setTimeout(() => {
            setBotReply(null);
          }, 4000);
        }
      } catch (error) {
        console.error('[Memo] 消息处理错误:', error);
      }
    };
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playAudio = async (audioBase64) => {
    try {
      const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
    } catch (error) {
      console.error('音频播放错误:', error);
    }
  };

  const addMemo = (text) => {
    const content = text || newMemo;
    if (!content.trim()) return;
    
    setMemos([...memos, { id: Date.now(), text: content, done: false }]);
    setNewMemo('');
    
    setBotReply({ text: `好的，已为您添加"${content}"` });
    
    setTimeout(() => {
      setBotReply(null);
    }, 3000);
  };

  const toggleMemo = (id) => {
    const memo = memos.find(m => m.id === id);
    
    if (memo && !memo.done) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'memo_complete',
          memo_text: memo.text
        }));
      }
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
      
      // 分块转换为Base64，避免栈溢出
      const uint8Array = new Uint8Array(pcmInt16.buffer);
      const chunkSize = 8192; // 每次处理8KB
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
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col h-full relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-50 rounded-bl-full -z-0 opacity-50" />
      
      <h3 className="text-stone-700 font-bold mb-4 flex items-center gap-2 relative z-10">
        <Sparkles size={18} className="text-yellow-400" />
        贴心备忘录
      </h3>

      <div className="flex-1 overflow-y-auto space-y-2 mb-4 relative z-10 custom-scrollbar pr-2">
        {memos.map(memo => (
          <div 
            key={memo.id} 
            className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg cursor-pointer transition-colors group/item"
            onClick={() => toggleMemo(memo.id)}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
              memo.done ? 'bg-rose-300 border-rose-300' : 'border-stone-300'
            }`}>
              {memo.done && <CheckCircle2 size={14} className="text-white" />}
            </div>
            <span className={`text-sm text-stone-600 ${memo.done ? 'line-through text-stone-400' : ''}`}>
              {memo.text}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); setMemos(memos.filter(m => m.id !== memo.id)); }}
              className="ml-auto opacity-0 group-hover/item:opacity-100 text-stone-400 hover:text-rose-400 p-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {botReply && (
        <div className="absolute bottom-16 left-6 right-6 z-20 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div className="bg-stone-800 text-white text-xs px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 opacity-90">
            <Volume2 size={14} className="text-rose-300 animate-pulse" />
            <span>{botReply.text}</span>
          </div>
        </div>
      )}

      <div className="relative z-10 flex items-center gap-2 bg-stone-50 rounded-xl p-1 pr-1 border border-transparent focus-within:border-rose-100 focus-within:ring-2 focus-within:ring-rose-50 transition-all">
        <button 
          onClick={handleMicClick}
          className={`p-2 rounded-lg transition-all ${isListening ? 'bg-rose-100 text-rose-500 animate-pulse' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-200'}`}
        >
          <Mic size={16} />
        </button>
        <input 
          type="text" 
          value={newMemo}
          onChange={(e) => setNewMemo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMemo()}
          placeholder={isListening ? "正在聆听..." : "记点什么..."}
          disabled={isListening}
          className="flex-1 bg-transparent border-none text-sm px-1 py-2 outline-none text-stone-700 placeholder:text-stone-400"
        />
        <button 
          onClick={() => addMemo()} 
          className="bg-stone-200 hover:bg-rose-400 hover:text-white text-stone-600 rounded-lg p-1.5 transition-all"
        >
          {isListening ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Plus size={16} />}
        </button>
      </div>
    </div>
  );
};

const Pomodoro = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('focus');
  const [customDuration, setCustomDuration] = useState(30 * 60);
  const audioContextRef = useRef(null);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      playCompletionAudio();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const playCompletionAudio = async () => {
    try {
      const response = await fetch(`${API_URL}/api/pomodoro-audio`);
      const result = await response.json();
      
      if (!result.error) {
        for (let i = 0; i < result.repeat_times; i++) {
          await new Promise(resolve => setTimeout(resolve, i * 100));
          await playAudio(result.audio);
          if (i < result.repeat_times - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    } catch (error) {
      console.error('播放完成音频错误:', error);
    }
  };

  const playAudio = async (audioBase64) => {
    try {
      const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
      
      return new Promise((resolve) => {
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = resolve;
        source.start(0);
      });
    } catch (error) {
      console.error('音频播放错误:', error);
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-[40px] shadow-lg shadow-rose-100/50 p-8 flex flex-col items-center justify-center relative overflow-hidden w-full max-w-md mx-auto aspect-square border border-white">
      <div className={`absolute inset-0 bg-gradient-to-br transition-opacity duration-1000 ${
        isActive ? 'from-rose-50 to-white opacity-100' : 'from-white to-stone-50 opacity-100'
      }`} />
      
      <div className="absolute w-64 h-64 rounded-full border-[6px] border-rose-100/50 z-0"></div>
      
      <div className="z-10 text-center space-y-4">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <button 
            className={`text-sm font-medium px-3 py-1 rounded-full transition-colors ${mode === 'focus' ? 'bg-rose-100 text-rose-700' : 'text-stone-400 hover:text-stone-500'}`}
            onClick={() => changeMode('focus')}
          >
            专注时刻
          </button>
          <button 
            className={`text-sm font-medium px-3 py-1 rounded-full transition-colors ${mode === 'rest' ? 'bg-teal-100 text-teal-700' : 'text-stone-400 hover:text-stone-500'}`}
            onClick={() => changeMode('rest')}
          >
            小憩一下
          </button>
          <button 
            className={`text-sm font-medium px-3 py-1 rounded-full transition-colors ${mode === 'custom' ? 'bg-indigo-100 text-indigo-700' : 'text-stone-400 hover:text-stone-500'}`}
            onClick={() => changeMode('custom')}
          >
            自定义
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          {mode === 'custom' && !isActive && (
            <button 
              onClick={() => adjustTime(-60)}
              className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center transition-colors"
              title="减少1分钟"
            >
              <Minus size={16} />
            </button>
          )}
          
          <div className="text-7xl font-light text-stone-700 tracking-tighter tabular-nums font-['Inter'] w-[280px]">
            {formatTime(timeLeft)}
          </div>

          {mode === 'custom' && !isActive && (
            <button 
              onClick={() => adjustTime(60)}
              className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center transition-colors"
              title="增加1分钟"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        
        <p className="text-stone-400 text-sm h-6">
          {isActive ? 
            (mode === 'rest' ? "好好放松..." : "沉浸工作中...") : 
            (mode === 'custom' ? "设定你的专属节奏" : (mode === 'focus' ? "准备好开始了吗？" : "休息是为了走更远的路"))
          }
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          <button 
            onClick={toggleTimer}
            className="w-16 h-16 rounded-full bg-rose-400 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200 hover:scale-105 transition-all"
          >
            {isActive ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
          </button>
          <button 
            onClick={resetTimer}
            className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-all"
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
    <div className="min-h-screen bg-[#FDFBF7] text-stone-700 font-sans selection:bg-rose-100">
      <div className="lg:hidden fixed inset-0 bg-white z-[100] flex items-center justify-center p-6 text-center text-stone-500">
        为了获得最佳体验，请使用平板或桌面设备查看您的专属工作台。
      </div>

      <div className="max-w-7xl mx-auto p-6 h-screen flex flex-col">
        <header className="flex justify-between items-center mb-6 px-2">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">早安，Super Mom 🌟</h1>
            <p className="text-stone-500 text-sm mt-1">今天也要爱自己多一点。</p>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-3">
            <Clock className="text-rose-400" size={20} />
            <div className="text-right">
              <div className="text-xl font-bold text-stone-700 leading-none">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs text-stone-400">
                {currentTime.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-12 gap-6 h-full pb-6">
          <div className="col-span-8 flex flex-col gap-6">
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
              <Pomodoro />
            </div>

            <div className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-3xl p-1 shadow-sm h-32 relative overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                 onClick={() => setActiveChat('talk')}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="bg-white/60 backdrop-blur-sm h-full rounded-[20px] p-6 flex items-center justify-between border border-white/50 group-hover:bg-white/80 transition-colors">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-orange-400 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                    <Heart size={32} fill="currentColor" className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-800 mb-1">安心话匣</h2>
                    <p className="text-stone-500 text-sm">焦虑、疲惫或者想吐槽？我一直在这里听你说。</p>
                  </div>
                </div>
                <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center text-rose-400 shadow-sm group-hover:scale-110 transition-transform">
                  <Mic size={24} />
                </div>
              </div>
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
                  <h3 className="text-xl font-bold text-stone-800 mb-1">产后食记</h3>
                  <p className="text-emerald-700/80 text-sm leading-relaxed max-w-[80%]">
                    怎么吃恢复快？今天该补什么？<br/>
                    问问你的专属营养师。
                  </p>
                </div>
                
                <div className="mt-4 flex items-center gap-2 text-emerald-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
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
