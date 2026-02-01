
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CameraPreviewProps {
  stream: MediaStream | null;
  isActive: boolean;
  mode: 'live' | 'scan';
}

const CameraPreview: React.FC<CameraPreviewProps> = ({ stream, isActive, mode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoActive, setVideoActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State สำหรับตำแหน่งและขนาด
  const [position, setPosition] = useState({ x: (window.innerWidth - 320) / 2, y: 20 });
  const [size, setSize] = useState({ width: 320, height: 180 }); // เริ่มต้นที่ 16:9 (320x180)

  // State สำหรับการ Drag และ Resize
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 });
  const [initialRect, setInitialRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    let mounted = true;
    const setupVideo = async () => {
      if (!stream || !isActive) {
        if (videoRef.current) videoRef.current.srcObject = null;
        if (mounted) { setVideoActive(false); setError(null); }
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        if (mounted) setError('ไม่พบสัญญาณวิดีโอ');
        return;
      }
      const videoTrack = videoTracks[0];
      const handleTrackEnded = () => { if (mounted) { setVideoActive(false); setError('การเชื่อมต่อกล้องขาดหาย'); } };
      videoTrack.addEventListener('ended', handleTrackEnded);
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        try {
          if (mounted) setError(null);
          await video.play();
          if (mounted) setVideoActive(true);
        } catch (err) {
          console.error('Camera play error:', err);
          if (mounted) { setVideoActive(false); setError('ไม่สามารถเล่นวิดีโอได้'); }
        }
      }
      return () => videoTrack.removeEventListener('ended', handleTrackEnded);
    };
    setupVideo();
    return () => { mounted = false; if (videoRef.current) videoRef.current.srcObject = null; };
  }, [stream, isActive]);

  // ฟังก์ชันจัดการการเริ่ม Drag
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setInitialMousePos({ x: e.clientX, y: e.clientY });
    setInitialRect({ x: position.x, y: position.y, w: size.width, h: size.height });
  };

  // ฟังก์ชันจัดการการเริ่ม Resize
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(direction);
    setInitialMousePos({ x: e.clientX, y: e.clientY });
    setInitialRect({ x: position.x, y: position.y, w: size.width, h: size.height });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - initialMousePos.x;
      const dy = e.clientY - initialMousePos.y;
      setPosition({
        x: initialRect.x + dx,
        y: initialRect.y + dy
      });
    } else if (isResizing) {
      const dx = e.clientX - initialMousePos.x;
      const dy = e.clientY - initialMousePos.y;
      let newW = initialRect.w;
      let newH = initialRect.h;
      let newX = initialRect.x;
      let newY = initialRect.y;

      if (isResizing.includes('e')) newW = Math.max(160, initialRect.w + dx);
      if (isResizing.includes('w')) {
        const delta = Math.min(initialRect.w - 160, dx);
        newW = initialRect.w - delta;
        newX = initialRect.x + delta;
      }
      if (isResizing.includes('s')) newH = Math.max(90, initialRect.h + dy);
      if (isResizing.includes('n')) {
        const delta = Math.min(initialRect.h - 90, dy);
        newH = initialRect.h - delta;
        newY = initialRect.y + delta;
      }

      setSize({ width: newW, height: newH });
      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, isResizing, initialMousePos, initialRect]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  if (!isActive || !stream) return null;

  // กำหนดสไตล์ตามโหมด
  const isScanMode = mode === 'scan';
  const statusLabel = isScanMode ? 'SCAN' : 'Live';
  const ringColor = isScanMode ? 'ring-yellow-400' : 'ring-white';
  const borderColor = isScanMode ? 'border-yellow-400/50' : 'border-white';

  return (
    <div
      ref={containerRef}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        position: 'fixed'
      }}
      className={`z-50 overflow-hidden rounded-2xl border-4 ${borderColor}
                  bg-emerald-950 shadow-[0_20px_50px_rgba(16,185,129,0.3)] 
                  transition-all duration-300 ease-in-out
                  animate-in fade-in group ring-2 ${ringColor}
                  ${isDragging || isResizing ? 'shadow-2xl scale-[1.02]' : ''}`}
    >
      {/* ส่วนควบคุมการ Resize (มุม) */}
      <div onMouseDown={(e) => handleResizeStart(e, 'nw')} className="absolute top-0 left-0 w-4 h-4 z-40 cursor-nwse-resize" />
      <div onMouseDown={(e) => handleResizeStart(e, 'ne')} className="absolute top-0 right-0 w-4 h-4 z-40 cursor-nesw-resize" />
      <div onMouseDown={(e) => handleResizeStart(e, 'sw')} className="absolute bottom-0 left-0 w-4 h-4 z-40 cursor-nesw-resize" />
      <div onMouseDown={(e) => handleResizeStart(e, 'se')} className="absolute bottom-0 right-0 w-4 h-4 z-40 cursor-nwse-resize" />

      {/* ส่วนควบคุมการ Drag (ขอบทั้ง 4) */}
      <div onMouseDown={handleDragStart} className="absolute top-0 left-4 right-4 h-2 z-30 cursor-move" />
      <div onMouseDown={handleDragStart} className="absolute bottom-0 left-4 right-4 h-2 z-30 cursor-move" />
      <div onMouseDown={handleDragStart} className="absolute left-0 top-4 bottom-4 w-2 z-30 cursor-move" />
      <div onMouseDown={handleDragStart} className="absolute right-0 top-4 bottom-4 w-2 z-30 cursor-move" />

      {/* สัญลักษณ์แสดงโหมด (Live/Scan) */}
      <div className={`absolute top-2 left-2 z-20 flex items-center gap-1.5 
                      bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full 
                      border ${isScanMode ? 'border-yellow-400/30' : 'border-white/30'} 
                      shadow-sm pointer-events-none ring-1 ${ringColor}`}>
        <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${error ? 'bg-amber-400' : videoActive ? 'bg-red-500 animate-pulse' : 'bg-emerald-200'
          }`} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isScanMode ? 'text-yellow-400' : 'text-white'}`}>
          {error ? 'Error' : statusLabel}
        </span>
      </div>

      {/* วิดีโอหลัก */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-700 pointer-events-none ${videoActive ? 'opacity-100' : 'opacity-0'
          }`}
      />

      {/* เอฟเฟกต์การแสกน (เฉพาะโหมด Scan) */}
      {videoActive && !error && isScanMode && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-1 bg-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.6)] absolute top-0 animate-[scan_3s_ease-in-out_infinite]" />
          <div className="absolute inset-0 border-[20px] border-yellow-400/5 mix-blend-overlay" />
        </div>
      )}

      {/* หน้ากากตอนโหลด */}
      {!videoActive && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950 gap-2">
          <div className="w-8 h-8 border-4 border-emerald-800 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-[10px] text-emerald-400 font-bold">กำลังเชื่อมต่อ...</span>
        </div>
      )}

      {/* แสดงข้อผิดพลาด */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950 p-4 text-center gap-2">
          <div className="p-2 bg-emerald-900 rounded-full">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <span className="text-xs text-emerald-200 font-bold px-2">{error}</span>
        </div>
      )}

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

export default CameraPreview;
