
import React, { useState, useCallback } from 'react';

interface FileUploadProps {
  onUpload: (data: { name: string; type: string; content: string; isUrl?: boolean }) => void;
  isOpen: boolean;
  onClose: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUpload, isOpen, onClose }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState('');

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      onUpload({
        name: file.name,
        type: file.type,
        content: base64.split(',')[1]
      });
    };
    reader.readAsDataURL(file);
  }, [onUpload]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onUpload({
        name: url,
        type: 'text/url',
        content: url,
        isUrl: true
      });
      setUrl('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-900/20 backdrop-blur-md">
      <div className="bg-white border border-emerald-100 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-emerald-900">เพิ่มข้อมูลที่สดใส</h2>
          <button onClick={onClose} className="text-emerald-300 hover:text-emerald-600 p-2 text-2xl transition-colors">&times;</button>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`relative border-2 border-dashed rounded-3xl p-10 mb-8 flex flex-col items-center justify-center transition-all ${
            isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-emerald-100 hover:border-emerald-300 bg-emerald-50/30'
          }`}
        >
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => e.target.files && handleFile(e.target.files[0])}
            accept=".jpg,.jpeg,.png,.mp4,.mp3"
          />
          <svg className="w-12 h-12 text-emerald-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-bold text-emerald-800 text-center">
            ลากไฟล์มาวางที่นี่ หรือ <span className="text-emerald-600 underline cursor-pointer">เลือกไฟล์</span>
          </p>
          <p className="text-[10px] text-emerald-400 mt-2 font-medium">
            รองรับภาพ วิดีโอ และเสียง
          </p>
        </div>

        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="วาง URL เว็บไซต์ที่นี่..."
              className="w-full bg-emerald-50/50 border border-emerald-100 rounded-2xl py-4 px-5 text-sm text-emerald-900 placeholder:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-emerald-200"
          >
            ส่ง URL ข้อมูล
          </button>
        </form>
      </div>
    </div>
  );
};

export default FileUpload;
