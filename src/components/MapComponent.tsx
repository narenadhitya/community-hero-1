import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Issue, Neighborhood, User } from '../types';
import { encodeGeohash, calculateDistance } from '../utils/geo';
import { AlertCircle, CheckCircle2, Shield, Eye, Flame, MapPin, Sparkles, Info, ZoomIn, ZoomOut, Compass } from 'lucide-react';
import Avatar from './Avatar';

interface MapComponentProps {
  neighborhoods: Neighborhood[];
  selectedNeighborhood: Neighborhood | null;
  issues: Issue[];
  selectedIssueId: string | null;
  onSelectIssue: (issue: Issue) => void;
  radiusFilter: number | null; // in km
  activeTypeFilter: 'all' | string;
  activeStatusFilter: 'all' | string;
  markerCreationMode: boolean;
  tempMarker: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  currentUser?: User | null;
  onSelectNeighborhood?: (id: string | null) => void;
}

// Bounding Box for our SF GIS Map Projection
const MIN_LAT = 37.74;
const MAX_LAT = 37.81;
const MIN_LNG = -122.435;
const MAX_LNG = -122.40;

export default function MapComponent({
  neighborhoods,
  selectedNeighborhood,
  issues,
  selectedIssueId,
  onSelectIssue,
  radiusFilter,
  activeTypeFilter,
  activeStatusFilter,
  markerCreationMode,
  tempMarker,
  onMapClick,
  currentUser,
  onSelectNeighborhood,
}: MapComponentProps) {
  
  const [showLegend, setShowLegend] = useState(false);
  const [showHint, setShowHint] = useState(() => {
    return !localStorage.getItem('dismissed_map_hint');
  });

  // Interactive Zoom & Pan States
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lng: number } | null>(null);

  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    if (showHint) {
      const timer = setTimeout(() => {
        setShowHint(false);
        localStorage.setItem('dismissed_map_hint', 'true');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showHint]);
  
  // Dimensions of the SVG canvas
  const width = 800;
  const height = 600;

  const maxLatProj = MAX_LAT;
  const maxLngProj = MAX_LNG;

  const userLoc = useMemo(() => {
    if (selectedNeighborhood?.id === 'north_beach') {
      return { lat: 37.794, lng: -122.411 };
    }
    return { lat: 37.761, lng: -122.418 };
  }, [selectedNeighborhood]);

  // Projection helpers
  const latToY = (lat: number) => {
    return height - ((lat - MIN_LAT) / (maxLatProj - MIN_LAT)) * height;
  };

  const lngToX = (lng: number) => {
    return ((lng - MIN_LNG) / (maxLngProj - MIN_LNG)) * width;
  };

  // Helper to restrict panning so the user doesn't drag the map off-screen
  const clampPan = (x: number, y: number, currentZoom: number) => {
    const minX = width * (1 - currentZoom);
    const minY = height * (1 - currentZoom);
    const clampedX = Math.min(0, Math.max(minX, x));
    const clampedY = Math.min(0, Math.max(minY, y));
    return { x: clampedX, y: clampedY };
  };

  // Dragging and Pointer navigation handlers
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Only pan on left click or primary touch point
    if (e.button !== 0) return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX,
      panY
    };
    setIsPanning(true);
    hasDraggedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert pixel coordinate back to map coordinate space (with current zoom/pan inverted)
    const svgX = clickX * (width / rect.width);
    const svgY = clickY * (height / rect.height);

    const mapX = (svgX - panX) / zoom;
    const mapY = (svgY - panY) / zoom;

    const currentLng = MIN_LNG + (mapX / width) * (maxLngProj - MIN_LNG);
    const currentLat = MIN_LAT + ((height - mapY) / height) * (maxLatProj - MIN_LAT);

    if (currentLat >= MIN_LAT && currentLat <= MAX_LAT && currentLng >= MIN_LNG && currentLng <= MAX_LNG) {
      setHoverCoords({ lat: currentLat, lng: currentLng });
    } else {
      setHoverCoords(null);
    }

    if (!isPanning) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasDraggedRef.current = true;
    }

    const targetX = dragStartRef.current.panX + dx;
    const targetY = dragStartRef.current.panY + dy;

    const { x, y } = clampPan(targetX, targetY, zoom);
    setPanX(x);
    setPanY(y);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    setIsPanning(false);
  };

  const handlePointerLeave = () => {
    setIsPanning(false);
    setHoverCoords(null);
  };

  // Mouse wheel scroll zoom helper
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const svgX = clickX * (width / rect.width);
    const svgY = clickY * (height / rect.height);

    const mapX = (svgX - panX) / zoom;
    const mapY = (svgY - panY) / zoom;

    const zoomFactor = 1.15;
    let newZoom = zoom;
    if (e.deltaY < 0) {
      newZoom = Math.min(5, zoom * zoomFactor);
    } else {
      newZoom = Math.max(1, zoom / zoomFactor);
    }

    const targetPanX = svgX - mapX * newZoom;
    const targetPanY = svgY - mapY * newZoom;

    const { x, y } = clampPan(targetPanX, targetPanY, newZoom);

    setZoom(newZoom);
    setPanX(x);
    setPanY(y);
  };

  // Double click zoom in helper
  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const svgX = clickX * (width / rect.width);
    const svgY = clickY * (height / rect.height);

    const mapX = (svgX - panX) / zoom;
    const mapY = (svgY - panY) / zoom;

    const newZoom = Math.min(5, zoom * 1.6);
    const targetPanX = svgX - mapX * newZoom;
    const targetPanY = svgY - mapY * newZoom;

    const { x, y } = clampPan(targetPanX, targetPanY, newZoom);

    setZoom(newZoom);
    setPanX(x);
    setPanY(y);
  };

  // Zoom Button triggers
  const handleZoomIn = () => {
    const svgX = 400;
    const svgY = 300;
    const mapX = (svgX - panX) / zoom;
    const mapY = (svgY - panY) / zoom;

    const newZoom = Math.min(5, zoom * 1.4);
    const targetPanX = svgX - mapX * newZoom;
    const targetPanY = svgY - mapY * newZoom;

    const { x, y } = clampPan(targetPanX, targetPanY, newZoom);
    setZoom(newZoom);
    setPanX(x);
    setPanY(y);
  };

  const handleZoomOut = () => {
    const svgX = 400;
    const svgY = 300;
    const mapX = (svgX - panX) / zoom;
    const mapY = (svgY - panY) / zoom;

    const newZoom = Math.max(1, zoom / 1.4);
    const targetPanX = svgX - mapX * newZoom;
    const targetPanY = svgY - mapY * newZoom;

    const { x, y } = clampPan(targetPanX, targetPanY, newZoom);
    setZoom(newZoom);
    setPanX(x);
    setPanY(y);
  };

  const handleReset = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Calculate dynamic scale width & label
  const scaleDetails = useMemo(() => {
    const metersPerPixelAt1x = 3.84;
    let scaleMeters = 1000;

    if (zoom >= 4) {
      scaleMeters = 100;
    } else if (zoom >= 2.5) {
      scaleMeters = 200;
    } else if (zoom >= 1.5) {
      scaleMeters = 500;
    }

    const widthInPixels = (scaleMeters * zoom) / metersPerPixelAt1x;
    return {
      label: scaleMeters >= 1000 ? `${scaleMeters / 1000} km` : `${scaleMeters} m`,
      width: widthInPixels
    };
  }, [zoom]);

  // Convert map coordinates back to lat/lng on map click (if no drag occurred)
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (hasDraggedRef.current) {
      return; // Ignore clicks that occur at the end of a drag operation
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const svgX = clickX * (width / rect.width);
    const svgY = clickY * (height / rect.height);

    const mapX = (svgX - panX) / zoom;
    const mapY = (svgY - panY) / zoom;

    const clickedLng = MIN_LNG + (mapX / width) * (maxLngProj - MIN_LNG);
    const clickedLat = MIN_LAT + ((height - mapY) / height) * (maxLatProj - MIN_LAT);

    if (clickedLat >= MIN_LAT && clickedLat <= MAX_LAT && clickedLng >= MIN_LNG && clickedLng <= MAX_LNG) {
      onMapClick(clickedLat, clickedLng);
    }
  };

  // Find dynamic overall average health score for each neighborhood to determine color tint
  const neighborhoodHealthDetails = useMemo(() => {
    return neighborhoods.map((n) => {
      const scores = Object.values(n.healthScores);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
      
      // Warm, whimsical color palette representing neighborhood overall health
      let tintColor = '#10b981'; // green (healthy)
      let textColor = '#065f46';
      let bgColor = 'bg-emerald-100/90 text-emerald-800';
      let label = 'THRIVING';
      
      if (avgScore < 65) {
        tintColor = '#ef4444'; // Red (critical)
        textColor = '#991b1b';
        bgColor = 'bg-rose-100/90 text-rose-800';
        label = 'CRITICAL';
      } else if (avgScore < 80) {
        tintColor = '#f59e0b'; // Warm golden yellow (warning)
        textColor = '#854d0e';
        bgColor = 'bg-amber-100/90 text-amber-800';
        label = 'STABILIZING';
      }
      
      return {
        id: n.id,
        avgScore,
        lowestScore: scores.length > 0 ? Math.min(...scores) : 100,
        tintColor,
        textColor,
        bgColor,
        label,
        center: n.boundaryCenter,
        name: n.name,
      };
    });
  }, [neighborhoods]);

  // Filter issues based on criteria and spatial constraints
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // 1. Neighborhood filter
      if (selectedNeighborhood && issue.neighborhoodId !== selectedNeighborhood.id) {
        return false;
      }
      // 2. Type filter
      if (activeTypeFilter !== 'all' && issue.type !== activeTypeFilter) {
        return false;
      }
      // 3. Status filter
      if (activeStatusFilter !== 'all' && issue.status !== activeStatusFilter) {
        return false;
      }
      // 4. Radius filter around the selected neighborhood's center (spatial constraint)
      if (selectedNeighborhood && radiusFilter) {
        const dist = calculateDistance(
          selectedNeighborhood.boundaryCenter.lat,
          selectedNeighborhood.boundaryCenter.lng,
          issue.location.lat,
          issue.location.lng
        );
        if (dist > radiusFilter) {
          return false;
        }
      }
      return true;
    });
  }, [issues, selectedNeighborhood, activeTypeFilter, activeStatusFilter, radiusFilter]);

  // Whimsical color helper for issue statuses
  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'resolved':
        return { color: '#10b981', label: 'Healed', emoji: '🌟' };
      case 'in_progress':
        return { color: '#f59e0b', label: 'Fixing', emoji: '🛠️' };
      case 'routed':
        return { color: '#0ea5e9', label: 'Assigned', emoji: '📦' };
      case 'verifying':
      case 'verifying_fix':
        return { color: '#8b5cf6', label: 'Verifying', emoji: '🔍' };
      default:
        return { color: '#ef4444', label: 'Reported', emoji: '📌' };
    }
  };

  return (
    <div 
      className="relative w-full overflow-hidden bg-[#faf6eb] rounded-3xl border-3 border-[#ebdcb9] shadow-soft"
      style={{ backgroundImage: 'radial-gradient(#ebdcb9 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      {/* Decorative top header (repositioned to avoid overlapping top-left cards) */}
      <div className="absolute top-[132px] sm:top-20 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <span className="px-3 py-1 bg-white text-amber-900 text-[10px] font-bold rounded-full border-2 border-[#f3e9d4] shadow-sm flex items-center gap-1.5 animate-pulse-gentle">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          MUNICIPAL QUEST GRID
        </span>
        {selectedNeighborhood && (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-950 text-[10px] font-black rounded-full border-2 border-emerald-200/60 shadow-sm">
            🗺️ Expedition Sector: {selectedNeighborhood.name}
          </span>
        )}
      </div>

      {/* Legend Compact Pill & Popover */}
      <div className="absolute top-[132px] sm:top-20 right-4 z-20 flex flex-col items-end">
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="bg-white hover:bg-amber-50 border-2 border-[#ebdcb9] px-2.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5 cursor-pointer text-amber-900 text-[10px] font-black transition-all"
        >
          <Info className="w-3.5 h-3.5 text-amber-600" />
          <span>MAP GUIDE</span>
          <span className="bg-[#7c2d12] text-amber-50 px-1.5 py-0.5 rounded-full text-[8px] font-black leading-none">
            8
          </span>
        </button>

        {showLegend && (
          <div className="mt-2 bg-white/95 border-2 border-[#ebdcb9] p-3 rounded-2xl text-[10px] text-slate-700 shadow-xl max-w-[170px] font-sans font-bold animate-fadeIn space-y-1.5 pointer-events-auto">
            <div className="flex justify-between items-center border-b border-amber-100 pb-1 mb-1">
              <span className="font-bold text-amber-800 text-xs uppercase tracking-wider flex items-center gap-1">
                🌟 Quest Legend
              </span>
              <button 
                onClick={() => setShowLegend(false)}
                className="text-amber-800 hover:text-red-600 font-extrabold text-xs"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 border border-red-600" />
              <span>New Report</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-400 border border-violet-600" />
              <span>Under Verification</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 border border-sky-600" />
              <span>Dispatch Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-600" />
              <span>Under Repair</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-600" />
              <span>Fully Healed!</span>
            </div>

            <p className="font-bold text-amber-800 text-[10px] uppercase tracking-wider mt-1.5 mb-1 border-b border-amber-100 pb-1 flex items-center gap-1 pt-1">
              <span>🩺</span> Vitality Health
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-700" />
              <span>Thriving (≥80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-700" />
              <span>Stabilizing (65-79%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-700" />
              <span>Critical (&lt;65%)</span>
            </div>
          </div>
        )}
      </div>

      <svg
        id="community-hero-gis-canvas"
        viewBox={`0 0 ${width} ${height}`}
        className={`w-full h-auto select-none transition-all duration-75 touch-none ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onClick={handleSvgClick}
      >
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15"/>
          </filter>
          <filter id="soft-glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* --- PANNABLE AND ZOOMABLE MAP GROUP --- */}
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`} className="transition-transform duration-75 ease-out">
          
          {/* --- COORDINATE GRID SYSTEM --- */}
          <g opacity="0.32" pointerEvents="none">
            {[-122.43, -122.42, -122.41].map((lon) => (
              <g key={`grid-lon-${lon}`}>
                <line
                  x1={lngToX(lon)}
                  y1={0}
                  x2={lngToX(lon)}
                  y2={height}
                  stroke="#d4b483"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                <text
                  x={lngToX(lon) + 4}
                  y={22}
                  fill="#7c2d12"
                  fontSize="7"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  {Math.abs(lon).toFixed(4)}°W
                </text>
              </g>
            ))}
            {[37.75, 37.76, 37.77, 37.78, 37.79, 37.80].map((lat) => (
              <g key={`grid-lat-${lat}`}>
                <line
                  x1={0}
                  y1={latToY(lat)}
                  x2={width}
                  y2={latToY(lat)}
                  stroke="#d4b483"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                <text
                  x={12}
                  y={latToY(lat) - 4}
                  fill="#7c2d12"
                  fontSize="7"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  {lat.toFixed(4)}°N
                </text>
              </g>
            ))}
          </g>

          {/* --- DECORATIVE MOVING CLOUDS --- */}
        <g opacity="0.45" className="animate-float-slow">
          {/* Cloud 1 */}
          <path d="M 50 100 Q 60 85 75 90 Q 90 85 95 100 Q 110 100 110 115 Q 110 125 95 125 L 45 125 Q 35 120 40 110 Q 40 100 50 100 Z" fill="#ffffff" filter="url(#shadow)" />
          {/* Cloud 2 */}
          <path d="M 620 120 Q 630 105 645 110 Q 660 105 665 120 Q 680 120 680 135 L 610 135 Q 600 130 610 120 Z" fill="#ffffff" filter="url(#shadow)" />
        </g>

        {/* --- BAY WATER / OCEAN REGION --- */}
        <g>
          {/* Sky-Blue Water outline */}
          <path
            d={`M ${lngToX(-122.435)} ${latToY(37.81)} 
               L ${lngToX(-122.40)} ${latToY(37.81)} 
               L ${lngToX(-122.40)} ${latToY(37.785)} 
               Q ${lngToX(-122.405)} ${latToY(37.79)} ${lngToX(-122.41)} ${latToY(37.795)}
               T ${lngToX(-122.42)} ${latToY(37.805)}
               Z`}
            fill="#a5f3fc"
            stroke="#7dd3fc"
            strokeWidth="3"
            opacity="0.9"
            filter="url(#shadow)"
          />

          {/* Ocean Water Ripples (Animated waves) */}
          <g stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" className="animate-float">
            <path d="M 640 140 Q 650 145 660 140" />
            <path d="M 670 160 Q 680 165 690 160" />
            <path d="M 720 100 Q 730 105 740 100" />
            <path d="M 580 180 Q 590 185 600 180" />
          </g>

          {/* Tiny Mediterranean Sailboat */}
          <g transform={`translate(${lngToX(-122.41)}, ${latToY(37.804)})`} className="animate-float">
            <ellipse cx="0" cy="5" rx="10" ry="3" fill="#9a3412" opacity="0.2" />
            {/* Boat body */}
            <path d="M -12 2 L 12 2 L 8 8 L -8 8 Z" fill="#fff9f2" stroke="#7c2d12" strokeWidth="1.5" />
            {/* Sail */}
            <path d="M 0 2 L 0 -12 L 8 0 Z" fill="#f97316" stroke="#ea580c" strokeWidth="1.5" />
          </g>
        </g>

        {/* --- MAJOR PARKS (GREENERY AREAS) --- */}
        {/* Dolores Park (Mission District) */}
        <g>
          <rect
            x={lngToX(-122.4285)}
            y={latToY(37.7615)}
            width={lngToX(-122.425) - lngToX(-122.4285)}
            height={latToY(37.758) - latToY(37.7615)}
            fill="#4ade80"
            rx="12"
            opacity="0.8"
            stroke="#22c55e"
            strokeWidth="2"
            filter="url(#shadow)"
          />
          {/* Tiny Swaying Trees in Dolores Park */}
          <g className="animate-sway" style={{ transformOrigin: `${lngToX(-122.427)}px ${latToY(37.760)}px` }}>
            <circle cx={lngToX(-122.427)} cy={latToY(37.760) - 4} r="6" fill="#15803d" />
            <rect x={lngToX(-122.427) - 1.5} y={latToY(37.760) - 1} width="3" height="6" fill="#78350f" />
          </g>
          <g className="animate-sway" style={{ transformOrigin: `${lngToX(-122.426)}px ${latToY(37.759)}px` }}>
            <circle cx={lngToX(-122.426)} cy={latToY(37.759) - 3} r="5" fill="#166534" />
            <rect x={lngToX(-122.426) - 1} y={latToY(37.759) - 1} width="2" height="5" fill="#78350f" />
          </g>
          <text
            x={lngToX(-122.4267)}
            y={latToY(37.7608)}
            fill="#14532d"
            fontSize="8"
            fontWeight="bold"
            fontFamily="Fredoka"
            textAnchor="middle"
          >
            Dolores Meadow
          </text>
        </g>

        {/* Washington Square Park (North Beach) */}
        <g>
          <rect
            x={lngToX(-122.4115)}
            y={latToY(37.8025)}
            width={lngToX(-122.4095) - lngToX(-122.4115)}
            height={latToY(37.8005) - latToY(37.8025)}
            fill="#4ade80"
            rx="10"
            opacity="0.8"
            stroke="#22c55e"
            strokeWidth="2"
            filter="url(#shadow)"
          />
          {/* Swaying Tree */}
          <g className="animate-sway" style={{ transformOrigin: `${lngToX(-122.4105)}px ${latToY(37.801)}px` }}>
            <circle cx={lngToX(-122.4105)} cy={latToY(37.801) - 4} r="5" fill="#15803d" />
            <rect x={lngToX(-122.4105) - 1} y={latToY(37.801) - 1} width="2" height="6" fill="#78350f" />
          </g>
          <text
            x={lngToX(-122.4105)}
            y={latToY(37.8018)}
            fill="#14532d"
            fontSize="7"
            fontWeight="bold"
            fontFamily="Fredoka"
            textAnchor="middle"
          >
            Piazza Green
          </text>
        </g>

        {/* --- COBBLESTONE COLOURED STREETS --- */}
        <g stroke="#ecd3be" strokeLinecap="round" opacity="0.9" filter="url(#shadow)">
          {/* Valencia St */}
          <line
            x1={lngToX(-122.422)} y1={latToY(37.74)}
            x2={lngToX(-122.422)} y2={latToY(37.77)}
            strokeWidth="5"
          />
          {/* Mission St */}
          <line
            x1={lngToX(-122.419)} y1={latToY(37.74)}
            x2={lngToX(-122.419)} y2={latToY(37.77)}
            strokeWidth="6"
          />
          {/* Harrison St */}
          <line
            x1={lngToX(-122.413)} y1={latToY(37.74)}
            x2={lngToX(-122.413)} y2={latToY(37.77)}
            strokeWidth="4"
          />
          {/* Broadway */}
          <line
            x1={lngToX(-122.435)} y1={latToY(37.798)}
            x2={lngToX(-122.40)} y2={latToY(37.798)}
            strokeWidth="6"
          />
          {/* Columbus Ave */}
          <line
            x1={lngToX(-122.425)} y1={latToY(37.795)}
            x2={lngToX(-122.402)} y2={latToY(37.808)}
            strokeWidth="6"
          />
          {/* Stockton St */}
          <line
            x1={lngToX(-122.408)} y1={latToY(37.785)}
            x2={lngToX(-122.408)} y2={latToY(37.81)}
            strokeWidth="4"
          />
          {/* Grant Ave */}
          <line
            x1={lngToX(-122.407)} y1={latToY(37.785)}
            x2={lngToX(-122.407)} y2={latToY(37.81)}
            strokeWidth="4"
          />
        </g>

        {/* Street labels */}
        <g fill="#92400e" fontSize="7" fontWeight="bold" fontFamily="Fredoka" opacity="0.6">
          <text x={lngToX(-122.419) + 6} y={latToY(37.745)} transform={`rotate(-90, ${lngToX(-122.419) + 6}, ${latToY(37.745)})`}>
            COBBLESTONE CORRIDOR
          </text>
          <text x={lngToX(-122.43)} y={latToY(37.795)}>
            SUNSET PLAZA LANE
          </text>
          <text x={lngToX(-122.417)} y={latToY(37.801)} transform={`rotate(-15, ${lngToX(-122.417)}, ${latToY(37.801)})`}>
            COLUMBUS BOULEVARD
          </text>
        </g>

        {/* --- NEIGHBORHOOD BOUNDARY BOUNDS (NEIGHBORHOOD EXPEDITION ZONES) --- */}
        {neighborhoodHealthDetails.map((detail) => {
          const x = lngToX(detail.center.lng);
          const y = latToY(detail.center.lat);
          const r = detail.id === 'mission_district' ? 120 : 110;
          const isDimmed = selectedNeighborhood && selectedNeighborhood.id !== detail.id;

          return (
            <g key={detail.id} opacity={isDimmed ? 0.35 : 1} className="transition-all duration-300">
              {/* Circular boundary with dashed playful border */}
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={detail.tintColor}
                fillOpacity="0.12"
                stroke={detail.tintColor}
                strokeWidth="4.5"
                strokeDasharray="8 6"
              />
              
              {/* Whimsical Sector Tags with Opaque Card Background */}
              <g 
                transform={`translate(${x}, ${y - r - 18})`}
                className="cursor-pointer"
                onClick={(e) => {
                  if (hasDraggedRef.current) return;
                  e.stopPropagation();
                  if (onSelectNeighborhood) {
                    onSelectNeighborhood(detail.id);
                  }
                }}
              >
                <rect
                  x="-115"
                  y="-10"
                  width="230"
                  height="18"
                  rx="9"
                  fill="#ffffff"
                  stroke={detail.tintColor}
                  strokeWidth="2"
                  filter="url(#shadow)"
                />
                <text
                  x="0"
                  y="2"
                  fill={detail.textColor}
                  fontSize="8"
                  fontWeight="900"
                  fontFamily="Fredoka"
                  letterSpacing="0.5"
                  textAnchor="middle"
                >
                  🏝️ {detail.name.toUpperCase()} • {detail.avgScore}% HEALTH ({detail.label})
                </text>
              </g>

              {/* HAND-DRAWN LANDMARK ILLUSTRATION AT THE CENTER OF NEIGHBORHOOD */}
              <g 
                transform={`translate(${x}, ${y})`} 
                className="cursor-pointer"
                onClick={(e) => {
                  if (hasDraggedRef.current) return;
                  e.stopPropagation();
                  if (onSelectNeighborhood) {
                    onSelectNeighborhood(detail.id);
                  }
                }}
              >
                {/* Ping/glow circles */}
                {detail.lowestScore < 80 && (
                  <circle cx="0" cy="0" r="28" fill={detail.tintColor} fillOpacity="0.15" className="animate-ping" />
                )}

                {/* Ground platform / grass island for the landmark */}
                <ellipse cx="0" cy="18" rx="20" ry="7" fill="#4ade80" stroke="#16a34a" strokeWidth="1.5" filter="url(#shadow)" />
                
                {/* Render Red/White coastal lighthouse for North Beach */}
                {detail.id === 'north_beach' && (
                  <g transform="translate(0, -6)" className="animate-float">
                    {/* Beam of light */}
                    <polygon points="0,-18 -120,-45 -120,-10" fill="#fef08a" fillOpacity="0.25" />
                    <polygon points="0,-18 120,-45 120,-10" fill="#fef08a" fillOpacity="0.25" />

                    {/* Lighthouse tower */}
                    <path d="M -6 18 L 6 18 L 4 -12 L -4 -12 Z" fill="#ffffff" stroke="#991b1b" strokeWidth="1.5" />
                    {/* Red Stripes */}
                    <path d="M -5.3 10 L 5.3 10 L 4.8 2 L -4.8 2 Z" fill="#dc2626" />
                    <path d="M -4.3 -4 L 4.3 -4 L 4 -10 L -4 -10 Z" fill="#dc2626" />

                    {/* Light room */}
                    <rect x="-3" y="-18" width="6" height="6" fill="#fef08a" stroke="#78350f" strokeWidth="1" />
                    {/* Dome */}
                    <path d="M -3.5 -18 C -3.5 -25 3.5 -25 3.5 -18 Z" fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
                  </g>
                )}

                {/* Render cozy Spanish Mediterranean Cottage for Mission District */}
                {detail.id === 'mission_district' && (
                  <g transform="translate(-1, -4)" className="animate-float">
                    {/* Cottage Walls */}
                    <rect x="-10" y="2" width="20" height="15" fill="#fdf6e2" stroke="#d97706" strokeWidth="1.5" rx="2" />
                    {/* Terracotta roof */}
                    <polygon points="-13,3 0,-8 13,3" fill="#ea580c" stroke="#9a3412" strokeWidth="1.5" />
                    {/* Cute blue door */}
                    <rect x="-3" y="8" width="6" height="9" fill="#38bdf8" stroke="#0369a1" strokeWidth="1" rx="1" />
                    {/* Tiny circle window */}
                    <circle cx="0" cy="-1" r="2.5" fill="#fef08a" stroke="#78350f" strokeWidth="0.8" />
                  </g>
                )}

                {/* Floating health badge above the island */}
                <g transform="translate(0, -32)">
                  <rect
                    x="-20"
                    y="-8"
                    width="40"
                    height="16"
                    rx="8"
                    fill="#1e293b"
                    stroke={detail.tintColor}
                    strokeWidth="2"
                    filter="url(#shadow)"
                  />
                  <text
                    x="0"
                    y="3"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="900"
                    fontFamily="Fredoka"
                    textAnchor="middle"
                  >
                    {detail.avgScore}%
                  </text>
                </g>
              </g>
            </g>
          );
        })}

        {/* Radius circle helper if filtering by distance (Expedition Range Ring) */}
        {selectedNeighborhood && radiusFilter && (
          <circle
            cx={lngToX(selectedNeighborhood.boundaryCenter.lng)}
            cy={latToY(selectedNeighborhood.boundaryCenter.lat)}
            r={radiusFilter * 85} // visual scale
            fill="none"
            stroke="#f97316"
            strokeWidth="3"
            strokeDasharray="8 4"
            opacity="0.8"
          />
        )}

        {/* --- PLOTTING ISSUES --- */}
        {filteredIssues.map((issue) => {
          const x = lngToX(issue.location.lng);
          const y = latToY(issue.location.lat);
          const isSelected = selectedIssueId === issue.id;
          const statusDetails = getStatusDetails(issue.status);

          return (
            <g
              key={issue.id}
              className="transition-all duration-300 transform origin-center cursor-pointer hover:scale-110 active:scale-95"
              onClick={(e) => {
                if (hasDraggedRef.current) return;
                e.stopPropagation();
                onSelectIssue(issue);
              }}
            >
              {/* Highlight Ring for Selected Quest */}
              {isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r="22"
                  fill="none"
                  stroke={statusDetails.color}
                  strokeWidth="3"
                  strokeDasharray="4 2"
                  className="animate-spin"
                  style={{ transformOrigin: `${x}px ${y}px`, animationDuration: '10s' }}
                />
              )}

              {/* Ripple Ring */}
              {(isSelected || (issue.severity > 0.7 && issue.status !== 'resolved')) && (
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? '24' : '18'}
                  fill={statusDetails.color}
                  opacity="0.25"
                  className="animate-ping"
                />
              )}

              {/* Marker pin shadow */}
              <ellipse cx={x} cy={y + 11} rx="8" ry="2.5" fill="#1e293b" fillOpacity="0.18" />

              {/* WHIMSICAL MINI MARKER DRAWING */}
              <g transform={`translate(${x}, ${y}) ${isSelected ? 'scale(1.2)' : 'scale(1)'}`} className="transition-all duration-300">
                {/* Playful Shield-shaped Board with a tiny pin point */}
                <path
                  d="M -12 -12 L 12 -12 C 12 -12 14 -4 14 0 C 14 4 11 11 0 16 C -11 11 -14 4 -14 0 C -14 -4 -12 -12 -12 -12 Z"
                  fill="#ffffff"
                  stroke={statusDetails.color}
                  strokeWidth="2.5"
                  filter="url(#shadow)"
                />

                {/* Draw Issue-Specific Whimsical Cartoon Object inside the Shield */}
                {issue.type === 'pothole' && (
                  // Cracked boulder / pothole
                  <g transform="translate(0, -1)" fill="#b45309" stroke="#78350f" strokeWidth="1">
                    <circle cx="0" cy="0" r="6" fill="#f5e0c3" />
                    <circle cx="-1" cy="1" r="3.5" fill="#b45309" />
                    <line x1="-3" y1="-3" x2="-1" y2="-1" />
                    <line x1="3" y1="-2" x2="1" y2="0" />
                  </g>
                )}

                {issue.type === 'broken_streetlight' && (
                  // Cute sleepy yellow lantern with a small cross
                  <g transform="translate(0, -1)">
                    {/* Lantern frame */}
                    <rect x="-4" y="-5" width="8" height="9" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.2" rx="1.5" />
                    {/* Sleeping eyes */}
                    <path d="M-2.2 -1 Q-1.5 1 -0.8 -1" fill="none" stroke="#ca8a04" strokeWidth="1" strokeLinecap="round" />
                    <path d="M0.8 -1 Q1.5 1 2.2 -1" fill="none" stroke="#ca8a04" strokeWidth="1" strokeLinecap="round" />
                    {/* Bandage plaster on lantern */}
                    <line x1="-2" y1="-3" x2="2" y2="1" stroke="#f43f5e" strokeWidth="1.5" />
                  </g>
                )}

                {issue.type === 'water_leak' && (
                  // Glossy cartoon droplet
                  <g transform="translate(0, -1.5)">
                    <path d="M 0 -7 C -4 -2 -5 1 -5 3 C -5 5.5 -3 7.5 0 7.5 C 3 7.5 5 5.5 5 3 C 5 1 4 -2 0 -7 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.2" />
                    {/* Glint reflection */}
                    <path d="M -1.8 1 Q -2.8 3 -1.8 4.5" fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
                  </g>
                )}

                {issue.type === 'waste_problem' && (
                  // Cute cartoon trash bag
                  <g transform="translate(0, -1)">
                    <path d="M -5 5 C -6 -1 -4 -4 -1 -4 Q 0 -6 1 -4 C 4 -4 6 -1 5 5 C 5 7 -5 7 -5 5 Z" fill="#86efac" stroke="#16a34a" strokeWidth="1.2" />
                    {/* Tie bow at top */}
                    <path d="M -2 -4 L 2 -4 M -1 -4 L -2 -6 M 1 -4 L 2 -6" stroke="#15803d" strokeWidth="1" />
                    {/* Small band-aid */}
                    <line x1="-1" y1="2" x2="2" y2="4" stroke="#f43f5e" strokeWidth="1.2" />
                  </g>
                )}

                {issue.type === 'other' && (
                  // Sparkling gold star
                  <g transform="translate(0, -1)">
                    <polygon points="0,-7 2,-2 7,-2 3,1 5,6 0,3 -5,6 -3,1 -7,-2 -2,-2" fill="#fbbf24" stroke="#d97706" strokeWidth="1.2" />
                  </g>
                )}

                {/* Miniature state indicator at top right */}
                <circle cx="10" cy="-10" r="5" fill={statusDetails.color} stroke="#ffffff" strokeWidth="1.5" />
                <text x="10" y="-8.2" fill="#ffffff" fontSize="5.5" fontWeight="black" textAnchor="middle" fontFamily="Fredoka">
                  {statusDetails.emoji}
                </text>
              </g>
            </g>
          );
        })}

        {/* User Avatar Marker sitting on the map */}
        <g transform={`translate(${lngToX(userLoc.lng)}, ${latToY(userLoc.lat)})`}>
          {/* Pulsing blue glow under avatar */}
          <circle cx="0" cy="0" r="18" fill="#3b82f6" opacity="0.2" className="animate-ping" />
          <circle cx="0" cy="0" r="12" fill="#3b82f6" opacity="0.35" />
          {/* White outline border ring for the circular avatar */}
          <circle cx="0" cy="0" r="14" fill="#ffffff" stroke="#3b82f6" strokeWidth="2.5" filter="url(#shadow)" />
          {/* Avatar embedded using foreignObject */}
          <foreignObject x="-12" y="-12" width="24" height="24">
            <div className="w-full h-full rounded-full overflow-hidden">
              {currentUser && (
                <Avatar config={(() => {
                  try { return JSON.parse(currentUser.avatarConfig); } catch(e) { return {}; }
                })()} />
              )}
            </div>
          </foreignObject>
          {/* Small "YOU" nameplate */}
          <g transform="translate(0, 20)">
            <rect x="-14" y="-7" width="28" height="12" rx="4" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" filter="url(#shadow)" />
            <text x="0" y="2" fill="#ffffff" fontSize="7" fontWeight="black" textAnchor="middle" fontFamily="Fredoka">
              YOU
            </text>
          </g>
        </g>

        {/* Temp report marker preview when user is picking a location */}
        {tempMarker && (
          <g transform={`translate(${lngToX(tempMarker.lng)}, ${latToY(tempMarker.lat)})`} className="animate-bounce">
            <circle cx="0" cy="0" r="22" fill="#f97316" opacity="0.25" />
            {/* Handcrafted sign board */}
            <rect x="-35" y="-32" width="70" height="20" rx="6" fill="#f97316" stroke="#ea580c" strokeWidth="2.5" filter="url(#shadow)" />
            <polygon points="-6,-12 6,-12 0,2" fill="#f97316" stroke="#ea580c" strokeWidth="2.5" />
            <text x="0" y="-19" fill="#ffffff" fontSize="8" fontWeight="900" textAnchor="middle" fontFamily="Fredoka">
              📍 DROP PIN!
            </text>
          </g>
        )}
        </g>
      </svg>

      {/* Dynamic Scale & Coordinates HUD */}
      <div className="absolute bottom-20 left-4 z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur-sm border-2 border-[#ebdcb9] px-3 py-2 rounded-2xl shadow-md text-amber-950 max-w-[195px] pointer-events-none">
        {/* Coordinates tracker */}
        <div className="flex items-center gap-1.5 font-mono text-[9px] font-black text-amber-900/85">
          <Compass className="w-3.5 h-3.5 text-amber-600 animate-spin" style={{ animationDuration: '12s' }} />
          <span>
            {hoverCoords 
              ? `${hoverCoords.lat.toFixed(4)}°N, ${Math.abs(hoverCoords.lng).toFixed(4)}°W` 
              : 'HOVER FOR COORDS'}
          </span>
        </div>

        {/* Dynamic map scale line */}
        <div className="flex flex-col gap-1 border-t border-amber-100 pt-1.5">
          <span className="text-[8px] font-black uppercase text-amber-800/70 tracking-wider">Map Scale</span>
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              {/* Visual scale line */}
              <div 
                className="h-1.5 bg-amber-950 relative border border-amber-950 rounded-xs transition-all duration-300"
                style={{ width: `${scaleDetails.width}px`, maxWidth: '140px' }}
              >
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white" />
              </div>
            </div>
            <span className="font-mono text-[9px] font-extrabold leading-none">{scaleDetails.label}</span>
          </div>
        </div>
      </div>

      {/* Playful Floating RPG-style Map Controls */}
      <div className="absolute bottom-20 right-4 z-20 flex flex-col gap-2">
        {/* Zoom In Button */}
        <button
          onClick={handleZoomIn}
          className="w-11 h-11 bg-[#fffdf9] hover:bg-amber-50 border-2 border-orange-300 rounded-[20px] shadow-[0_4px_12px_rgba(124,45,18,0.08)] flex items-center justify-center text-[#7c2d12] font-display font-black text-xl transition-all cursor-pointer border-b-5 border-b-orange-400 active:border-b-2 active:translate-y-[3px]"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5 stroke-[2.5]" />
        </button>
        
        {/* Zoom Out Button */}
        <button
          onClick={handleZoomOut}
          className="w-11 h-11 bg-[#fffdf9] hover:bg-amber-50 border-2 border-orange-300 rounded-[20px] shadow-[0_4px_12px_rgba(124,45,18,0.08)] flex items-center justify-center text-[#7c2d12] font-display font-black text-xl transition-all cursor-pointer border-b-5 border-b-orange-400 active:border-b-2 active:translate-y-[3px]"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5 stroke-[2.5]" />
        </button>
        
        {/* Reset Map Button */}
        <button
          onClick={handleReset}
          className="w-11 h-11 bg-[#fffdf9] hover:bg-amber-50 border-2 border-orange-300 rounded-[20px] shadow-[0_4px_12px_rgba(124,45,18,0.08)] flex items-center justify-center text-[#7c2d12] font-display font-black text-xs transition-all cursor-pointer border-b-5 border-b-orange-400 active:border-b-2 active:translate-y-[3px]"
          title="Reset Map View"
        >
          <Compass className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Map Overlay Instruction Bar */}
      {showHint && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 border-2 border-orange-200 p-3 rounded-[20px] backdrop-blur-md flex items-center justify-between text-xs text-amber-950 font-sans font-bold shadow-[0_6px_16px_rgba(124,45,18,0.08)] animate-fadeIn pointer-events-auto">
          <div className="flex items-center gap-2">
            <MapPin className="text-orange-500 w-4 h-4 animate-bounce" />
            <span className="pr-2">
              {markerCreationMode
                ? 'Click any coordinate on the game map above to plant your Expedition Banner!'
                : 'Tap on any cartoon landmark or issue shield on the map to inspect details.'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="font-mono text-[10px] bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
              ✨ {filteredIssues.length} active quests
            </div>
            <button
              onClick={() => {
                setShowHint(false);
                localStorage.setItem('dismissed_map_hint', 'true');
              }}
              className="text-amber-900/60 hover:text-amber-900 cursor-pointer font-black text-sm ml-1 px-1.5 py-0.5 rounded-full hover:bg-amber-50"
              title="Dismiss map instructions"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
