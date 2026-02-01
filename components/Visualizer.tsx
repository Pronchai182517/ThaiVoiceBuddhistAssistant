
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  color: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, color }) => {
  const bars = Array.from({ length: 12 });

  return (
    <div className="flex items-center justify-center gap-1 h-12 w-full">
      {bars.map((_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full transition-all duration-300 ${color} ${
            isActive ? 'animate-bounce' : 'h-2 opacity-30'
          }`}
          style={{
            height: isActive ? `${Math.random() * 100 + 20}%` : '8px',
            animationDelay: `${i * 0.1}s`,
            animationDuration: '0.6s'
          }}
        />
      ))}
    </div>
  );
};

export default Visualizer;
