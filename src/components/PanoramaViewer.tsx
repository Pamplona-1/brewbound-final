import React, { useEffect, useRef, useState } from 'react';
import { Eye, Compass, RotateCcw, ZoomIn, ZoomOut, Maximize, Minimize, HelpCircle, Move, Sparkles } from 'lucide-react';

interface PanoramaViewerProps {
  imageUrl: string;
  cafeName: string;
  height?: string;
}

export const PanoramaViewer: React.FC<PanoramaViewerProps> = ({
  imageUrl,
  cafeName,
  height = '320px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [yaw, setYaw] = useState<number>(0);
  const [pitch, setPitch] = useState<number>(0);
  const [fov, setFov] = useState<number>(1); // Zoom level: 0.8 (zoomed in) to 1.5 (wide)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  // Auto rotation loop when idle
  useEffect(() => {
    if (!isAutoRotating || isDragging) return;

    const interval = setInterval(() => {
      setYaw((prev) => (prev + 0.15) % 100);
    }, 40);

    return () => clearInterval(interval);
  }, [isAutoRotating, isDragging]);

  // Touch and Mouse handlers for 360 drag navigation
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setIsAutoRotating(false);
    setDragStart({ x: e.clientX, y: e.clientY });
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // Convert pixel delta to percentage of panorama view
    setYaw((prev) => (prev - deltaX * 0.12 + 100) % 100);
    setPitch((prev) => Math.max(-25, Math.min(25, prev - deltaY * 0.15)));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const handleReset = () => {
    setYaw(0);
    setPitch(0);
    setFov(1);
    setIsAutoRotating(true);
  };

  const handleZoom = (delta: number) => {
    setFov((prev) => Math.max(0.7, Math.min(1.4, prev + delta)));
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-xl select-none transition-all duration-300 ${
        isExpanded ? 'fixed inset-4 z-50 rounded-3xl min-h-[80vh] shadow-2xl flex flex-col' : ''
      }`}
      style={{ height: isExpanded ? 'calc(100vh - 2rem)' : height }}
    >
      {/* 360 Dynamic Viewport Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden relative"
        style={{ touchAction: 'none' }}
      >
        {/* Equirectangular / Cylindrical 360 Image Background */}
        <div
          className="absolute inset-0 w-[400%] h-[150%] -left-[150%] -top-[25%] transition-transform duration-75"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundRepeat: 'repeat-x',
            backgroundSize: 'auto 100%',
            backgroundPosition: `${yaw}% ${50 + pitch}%`,
            transform: `scale(${fov})`,
            filter: 'contrast(1.05) brightness(0.98)',
          }}
        />

        {/* Loading / Error States */}
        <img
          src={imageUrl}
          alt={cafeName}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          className="hidden"
        />

        {/* Ambient Spherical Vignette Effect */}
        <div className="absolute inset-0 pointer-events-none bg-radial from-transparent via-transparent to-black/40 shadow-inner" />

        {/* 360 Degree Compass / Badge */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-black/70 backdrop-blur-md text-amber-400 border border-amber-500/30 rounded-full text-[11px] font-bold shadow-lg">
          <Compass className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin' : ''}`} />
          <span>360° Interior View</span>
        </div>

        {/* Help Tip Overlay */}
        <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md text-slate-300 border border-slate-700/60 rounded-full text-[10px] pointer-events-none">
          <Move className="w-3 h-3 text-amber-400" />
          <span>Click and drag to look around inside</span>
        </div>

        {/* Interactive Controls (Top Right) */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className={`p-1.5 rounded-xl backdrop-blur-md border text-xs font-bold transition-all ${
              isAutoRotating
                ? 'bg-amber-600/90 border-amber-400 text-white shadow-md'
                : 'bg-black/60 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isAutoRotating ? 'Pause Auto-Rotation' : 'Resume 360 Auto-Rotation'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white border border-slate-700 rounded-xl backdrop-blur-md transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleZoom(0.15)}
            className="p-1.5 bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white border border-slate-700 rounded-xl backdrop-blur-md transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white border border-slate-700 rounded-xl backdrop-blur-md transition-all"
            title={isExpanded ? 'Exit Fullscreen' : 'Fullscreen 360 View'}
          >
            {isExpanded ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Center Orientation Crosshair on Drag */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full border border-dashed border-amber-400/60 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Overlay Header */}
      {isExpanded && (
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{cafeName}</span>
            <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-600/40">
              360° Panoramic Spatial Environment
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
          >
            Close Fullscreen
          </button>
        </div>
      )}
    </div>
  );
};
