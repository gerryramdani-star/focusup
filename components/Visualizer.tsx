
import React, { useRef, useEffect } from 'react';
import { ConnectionState } from '../types';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  connectionState: ConnectionState;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, connectionState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      if (!analyser) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * (canvas.height / 1.5);

        ctx.beginPath();
        if (connectionState === ConnectionState.SPEAKING) {
          ctx.fillStyle = '#6366f1'; // Indigo
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#6366f1';
        } else if (connectionState === ConnectionState.LISTENING) {
          ctx.fillStyle = '#ec4899'; // Pink
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#ec4899';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.shadowBlur = 0;
        }

        const centerY = canvas.height / 2;
        // Draw rounded bars
        const r = barWidth / 2;
        ctx.roundRect(x, centerY - barHeight/2, barWidth, barHeight, 10);
        ctx.fill();
        
        x += barWidth + 4;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser, connectionState]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40"
      width={600}
      height={300}
    />
  );
};

export default Visualizer;
