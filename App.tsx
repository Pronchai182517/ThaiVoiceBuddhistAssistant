
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, Blob, LiveServerMessage } from '@google/genai';
import { encode, decode, decodeAudioData } from './utils/audioUtils';
import { TranscriptionEntry, ConnectionStatus } from './types';
import Visualizer from './components/Visualizer';
import FileUpload from './components/FileUpload';
import CameraPreview from './components/CameraPreview';

const SYSTEM_INSTRUCTION = `คุณคือผู้ช่วยอัจฉริยะวิเคราะห์ภาพและวัตถุ (Object Detection Assistant) เพศชาย ที่พูดภาษาไทยได้อย่างคล่องแคล่ว

กฎสำคัญในการสนทนาภาษาไทย:
- ใช้สรรพนามแทนตัวเองว่า "ผม" เท่านั้น ห้ามใช้ "ฉัน" หรือ "ดิฉัน"
- ใช้คำลงท้ายว่า "ครับ" เท่านั้น ห้ามใช้ "ค่ะ" หรือ "คะ"
- พูดด้วยน้ำเสียงสุภาพ เป็นมิตร และมีชีวิตชีวาแบบผู้ชาย

หน้าที่หลักของคุณคือ:
1. วิเคราะห์ภาพจากกล้องที่ผู้ใช้ส่งมาแบบเรียลไทม์
2. ระบุวัตถุ สิ่งของ หรือข้อความที่ปรากฏในภาพเมื่อผู้ใช้ถามหรือเมื่อเห็นสิ่งที่น่าสนใจ
3. ให้ข้อมูลรายละเอียดเกี่ยวกับวัตถุนั้นๆ เช่น วิธีใช้, ประวัติ หรือคำแนะนำที่เกี่ยวข้อง
4. หากเห็นวัตถุไม่ชัดเจน ให้แนะนำผู้ใช้ให้ขยับกล้องหรือจัดแสงให้ดีขึ้นครับ`;

const VOICE_NAME = 'Orus';
const FRAME_RATE = 1;

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [cameraMode, setCameraMode] = useState<'live' | 'scan'>('live');
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  const audioContexts = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const audioNodes = useRef<{ sources: Set<AudioBufferSourceNode>; nextStartTime: number }>({
    sources: new Set(),
    nextStartTime: 0,
  });
  const sessionRef = useRef<any>(null);
  const transcriptRef = useRef<{ input: string; output: string }>({ input: '', output: '' });
  const frameIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const cleanup = useCallback(() => {
    if (frameIntervalRef.current) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) { }
      sessionRef.current = null;
    }

    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      setActiveStream(null);
    }

    audioNodes.current.sources.forEach(source => {
      try { source.stop(); } catch (e) { }
    });
    audioNodes.current.sources.clear();
    audioNodes.current.nextStartTime = 0;

    if (audioContexts.current) {
      try {
        audioContexts.current.input.close();
        audioContexts.current.output.close();
      } catch (e) { }
      audioContexts.current = null;
    }

    setStatus(ConnectionStatus.DISCONNECTED);
    setIsAiSpeaking(false);
    setIsUserSpeaking(false);
  }, [activeStream]);

  const createPCMDataBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const startConnection = async () => {
    // 1. Check API Key first
    if (!process.env.API_KEY) {
      showToast('ไม่พบ API Key กรุณาตรวจสอบ .env.local');
      console.error('API Key is missing');
      return;
    }

    try {
      setStatus(ConnectionStatus.CONNECTING);

      // 2. Request Media Access
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Browser ไม่รองรับการเข้าถึงกล้อง/ไมค์ (Check HTTPS/Localhost)');
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: 1.777777778,
            frameRate: { ideal: 30 }
          }
        });
      } catch (mediaErr: any) {
        console.error('Media Access Error:', mediaErr);
        setStatus(ConnectionStatus.ERROR);
        showToast(`Media Error: ${mediaErr.name} - ${mediaErr.message}`);
        return;
      }

      setActiveStream(stream);
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContexts.current = { input: inputCtx, output: outputCtx };

      // 3. Connect to Gemini API
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const sessionPromise = ai.live.connect({
          model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
            systemInstruction: SYSTEM_INSTRUCTION,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              setStatus(ConnectionStatus.CONNECTED);
              const source = inputCtx.createMediaStreamSource(stream);
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);

              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const volume = inputData.reduce((a, b) => a + Math.abs(b), 0) / inputData.length;
                setIsUserSpeaking(volume > 0.01);
                const pcmBlob = createPCMDataBlob(inputData);
                sessionPromise.then(session => { session.sendRealtimeInput({ media: pcmBlob }); });
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);

              const video = document.createElement('video');
              video.srcObject = stream;
              video.play();
              if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');

              frameIntervalRef.current = window.setInterval(() => {
                if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
                  canvas.width = 640;
                  canvas.height = 360;
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                  sessionPromise.then(session => { session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } }); });
                }
              }, 1000 / FRAME_RATE);
            },
            onmessage: async (message: LiveServerMessage) => {
              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio) {
                setIsAiSpeaking(true);
                const { output: outputCtx } = audioContexts.current!;
                audioNodes.current.nextStartTime = Math.max(audioNodes.current.nextStartTime, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                const gainNode = outputCtx.createGain();
                source.connect(gainNode);
                gainNode.connect(outputCtx.destination);
                source.addEventListener('ended', () => {
                  audioNodes.current.sources.delete(source);
                  if (audioNodes.current.sources.size === 0) setIsAiSpeaking(false);
                });
                source.start(audioNodes.current.nextStartTime);
                audioNodes.current.nextStartTime += audioBuffer.duration;
                audioNodes.current.sources.add(source);
              }
              if (message.serverContent?.interrupted) {
                audioNodes.current.sources.forEach(s => { try { s.stop(); } catch (e) { } });
                audioNodes.current.sources.clear();
                audioNodes.current.nextStartTime = 0;
                setIsAiSpeaking(false);
              }
              if (message.serverContent?.inputTranscription) transcriptRef.current.input += message.serverContent.inputTranscription.text;
              if (message.serverContent?.outputTranscription) transcriptRef.current.output += message.serverContent.outputTranscription.text;
              if (message.serverContent?.turnComplete) {
                const userText = transcriptRef.current.input.trim();
                const aiText = transcriptRef.current.output.trim();
                if (userText || aiText) {
                  setTranscriptions(prev => [
                    ...prev,
                    ...(userText ? [{ role: 'user', text: userText, timestamp: Date.now() } as TranscriptionEntry] : []),
                    ...(aiText ? [{ role: 'model', text: aiText, timestamp: Date.now() } as TranscriptionEntry] : [])
                  ]);
                }
                transcriptRef.current = { input: '', output: '' };
              }
            },
            onerror: (e) => {
              console.error('Session Error:', e);
              setStatus(ConnectionStatus.ERROR);
              showToast('เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI'); // Specific connection error
              cleanup();
            },
            onclose: (e) => {
              console.error('Session Closed Details:', e);
              showToast(`Session Closed: ${e.code || 'Unknown'} - ${e.reason || ''}`);
              cleanup();
            }
          }
        });
        sessionRef.current = await sessionPromise;
      } catch (connErr) {
        console.error('Connection Error:', connErr);
        setStatus(ConnectionStatus.ERROR);
        // Check if error is related to 404/API key from the error object if possible, generic for now
        showToast('เชื่อมต่อ Server ไม่สำเร็จ (เช็ค API Key/Model)');
        if (stream) {
          stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        }
      }

    } catch (err) {
      console.error('Unexpected Error:', err);
      setStatus(ConnectionStatus.ERROR);
      showToast('เกิดข้อผิดพลาดที่ไม่คาดคิด');
    }
  };

  const handleDataUpload = async (data: { name: string; type: string; content: string; isUrl?: boolean }) => {
    showToast(`รับข้อมูลสำเร็จ: ${data.name.substring(0, 20)}...`);
    setIsUploadOpen(false);
    const newEntry: TranscriptionEntry = {
      role: 'user',
      text: data.isUrl ? `แชร์ลิงก์: ${data.name}` : `อัปโหลดไฟล์: ${data.name}`,
      timestamp: Date.now(),
      fileMetadata: { name: data.name, type: data.type, content: data.type.startsWith('image/') ? data.content : undefined, isUrl: data.isUrl }
    };
    setTranscriptions(prev => [...prev, newEntry]);
    if (sessionRef.current && (data.type.startsWith('image/') || data.type === 'video/mp4')) {
      try {
        await sessionRef.current.sendRealtimeInput({ media: { data: data.content, mimeType: 'image/jpeg' } });
      } catch (err) { console.error('Error sending media:', err); }
    }
  };

  const renderFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    if (type === 'text/url') return <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
    return <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [transcriptions]);

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 md:p-6 relative overflow-hidden">
      <CameraPreview
        stream={activeStream}
        isActive={status === ConnectionStatus.CONNECTED}
        mode={cameraMode}
      />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-emerald-700 text-white px-6 py-3 rounded-full shadow-lg animate-in slide-in-from-top duration-300 font-medium flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {toast}
        </div>
      )}

      <header className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-600">
            BAI Buddhist AI
          </h1>
          <p className="text-base md:text-lg text-emerald-600 font-medium">สนทนาผ่านกล้อง</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`w-4 h-4 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : status === ConnectionStatus.CONNECTING ? 'bg-emerald-400' : 'bg-emerald-200'}`} />
          <span className="text-sm md:text-base uppercase tracking-wider font-bold text-emerald-900">{status}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-4 overflow-hidden relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-emerald-200">
          {transcriptions.length === 0 && status !== ConnectionStatus.CONNECTED && (
            <div className="h-full flex flex-col items-center justify-center text-emerald-400 text-center p-8 border-2 border-dashed border-emerald-200 rounded-3xl bg-white/60 backdrop-blur-sm">
              <svg className="w-20 h-20 mb-6 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="text-xl md:text-2xl font-semibold mb-2">เริ่มต้นการสนทนา</p>
              <p className="text-base md:text-lg">กดปุ่มไมค์ด้านล่างเพื่อเริ่มสนทนา</p>
            </div>
          )}

          {transcriptions.map((t, i) => (
            <div key={`${t.timestamp}-${i}`} className={`flex flex-col ${t.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${t.role === 'user' ? 'bg-emerald-700 text-white rounded-tr-none' : 'bg-white text-emerald-900 border border-emerald-100 rounded-tl-none'}`}>
                {t.fileMetadata && (
                  <div className={`mb-3 flex items-center gap-3 p-3 rounded-xl ${t.role === 'user' ? 'bg-black/10' : 'bg-emerald-50'} border border-emerald-100/20`}>
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white/20 rounded-lg">{renderFileIcon(t.fileMetadata.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{t.fileMetadata.name}</p>
                      <p className="text-[10px] opacity-60 uppercase">{t.fileMetadata.type}</p>
                    </div>
                  </div>
                )}
                {t.fileMetadata?.content && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-emerald-100/30 shadow-sm">
                    <img src={`data:${t.fileMetadata.type};base64,${t.fileMetadata.content}`} alt="preview" className="max-w-full h-auto object-cover max-h-48 w-full" />
                  </div>
                )}
                <p className="text-base md:text-lg leading-relaxed">{t.text}</p>
              </div>
              <span className="text-sm text-emerald-600 mt-2 mx-2 font-semibold">{t.role === 'user' ? 'คุณ' : 'Gemini'}</span>
            </div>
          ))}
        </div>

        <div className="bg-white/90 backdrop-blur-lg border border-emerald-100 rounded-3xl p-6 md:p-8 shadow-[0_10px_40px_rgba(5,150,105,0.15)] mt-auto relative z-30">
          <div className="flex flex-col items-center gap-6">
            <div className="grid grid-cols-2 w-full gap-4">
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100/50 shadow-inner">
                <p className="text-sm md:text-base uppercase text-emerald-700 font-bold mb-3 text-center">คุณกำลังพูด</p>
                <Visualizer isActive={isUserSpeaking} color="bg-emerald-500" />
              </div>
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100/50 shadow-inner">
                <p className="text-sm md:text-base uppercase text-emerald-700 font-bold mb-3 text-center">AI กำลังตอบ</p>
                <Visualizer isActive={isAiSpeaking} color="bg-teal-500" />
              </div>
            </div>

            <div className="flex items-center gap-6 md:gap-10">
              <button
                onClick={() => setIsUploadOpen(true)}
                title="อัปโหลดข้อมูล"
                aria-label="อัปโหลดไฟล์"
                className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white border-2 border-emerald-300 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-all active:scale-90 shadow-md"
              >
                <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              </button>

              <button
                onClick={() => status === ConnectionStatus.CONNECTED ? cleanup() : startConnection()}
                disabled={status === ConnectionStatus.CONNECTING}
                aria-label={status === ConnectionStatus.CONNECTED ? 'หยุดสนทนา' : 'เริ่มสนทนา'}
                className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-90 shadow-xl ${status === ConnectionStatus.CONNECTED ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-300' : 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-300'}`}
              >
                {status === ConnectionStatus.CONNECTING ? <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : status === ConnectionStatus.CONNECTED ? <svg className="w-10 h-10 md:w-12 md:h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> : <svg className="w-10 h-10 md:w-12 md:h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>}
              </button>

              <button
                onClick={() => setCameraMode(prev => prev === 'live' ? 'scan' : 'live')}
                title={`สลับเป็นโหมด ${cameraMode === 'live' ? 'Scan' : 'Live'}`}
                aria-label="สลับโหมดกล้อง"
                className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white border-2 border-emerald-300 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-all active:scale-90 shadow-md"
              >
                <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            <p className="text-base md:text-lg font-bold text-emerald-900">
              {status === ConnectionStatus.CONNECTED ? `โหมด ${cameraMode === 'live' ? 'ถ่ายทอดสด' : 'สแกน'} กำลังทำงาน` : 'กดปุ่มไมค์เพื่อเริ่มสนทนา'}
            </p>
          </div>
        </div>
      </main>

      <FileUpload isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUpload={handleDataUpload} />
    </div>
  );
};

export default App;
