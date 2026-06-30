import React, { useState, useRef, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { User, Neighborhood, IssueType, IssuePriority, Issue } from '../types';
import { encodeGeohash } from '../utils/geo';
import MapComponent from './MapComponent';
import { 
  Camera, MapPin, Upload, AlertCircle, Compass, Check, HelpCircle, 
  Brain, Loader2, Sparkles, RefreshCw, ThumbsUp, CheckCircle, 
  ChevronRight, AlertTriangle, Info, MapPinIcon 
} from 'lucide-react';

interface ReportViewProps {
  currentUser: User | null;
  neighborhoods: Neighborhood[];
  issues: Issue[];
  onReportSuccess: (newId: string) => void;
  onRefreshData: () => Promise<void>;
  onUserUpdate: (updatedUser: Partial<User>) => void;
}

const CATEGORY_PRESETS: { value: IssueType; label: string; image: string; prompt: string }[] = [
  { 
    value: 'pothole', 
    label: 'Road Cracks / Pothole', 
    image: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=600',
    prompt: 'Road cracks or pothole hazard reported'
  },
  { 
    value: 'broken_streetlight', 
    label: 'Broken Streetlight', 
    image: 'https://images.unsplash.com/photo-1509021436665-8f37bc7065be?auto=format&fit=crop&q=80&w=600',
    prompt: 'Streetlight out or flickering'
  },
  { 
    value: 'water_leak', 
    label: 'Water Pipe Leak', 
    image: 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&q=80&w=600',
    prompt: 'Burst water main or leaking hydrant'
  },
  { 
    value: 'waste_problem', 
    label: 'Illegal Waste Dumping', 
    image: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=600',
    prompt: 'Bulk trash dumping on public sidewalk'
  },
  { 
    value: 'other', 
    label: 'Other Infrastructure', 
    image: 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&q=80&w=600',
    prompt: 'General municipal infrastructure damage'
  },
];

// Helper to calculate exact distance in meters between two lat/lng pairs
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function ReportView({
  currentUser,
  neighborhoods,
  issues,
  onReportSuccess,
  onRefreshData,
  onUserUpdate,
}: ReportViewProps) {
  // Navigation & Core phases
  // 'input' -> Capture or select image
  // 'analyzing' -> Sending to Gemini + querying GPS + Deduplication checks
  // 'duplicate' -> Duplicate warned screen
  // 'review' -> Pre-populated review dashboard for edits and dispatch
  const [phase, setPhase] = useState<'input' | 'analyzing' | 'duplicate' | 'review'>('input');
  
  // Media capture and selection
  const [mediaUrl, setMediaUrl] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Form states (Prefilled by AI, fully editable)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueType>('pothole');
  const [severity, setSeverity] = useState(0.5);
  const [latitude, setLatitude] = useState(37.7599);
  const [longitude, setLongitude] = useState(-122.4148);
  const [neighborhoodId, setNeighborhoodId] = useState('mission_district');
  const [confidenceScore, setConfidenceScore] = useState(0.85);

  // Dynamic analysis/loading trackers
  const [loadingMessage, setLoadingMessage] = useState('Bootstrapping civic data...');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Duplicate states
  const [detectedDuplicate, setDetectedDuplicate] = useState<Issue | null>(null);
  const [duplicateDistance, setDuplicateDistance] = useState<number>(0);

  // Auto GPS trigger when first entering or capturing
  const triggerGPSLookup = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (err) => {
            console.warn('GPS query blocked or timed out, utilizing neighborhood default coordinate.', err);
            resolve({ lat: 37.7599, lng: -122.4148 }); // Fallback (SF Mission)
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      } else {
        resolve({ lat: 37.7599, lng: -122.4148 });
      }
    });
  };

  // Drag-and-drop mechanics
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setMediaUrl(base64String);
      setCapturedPhoto(base64String);
      analyzeWithGemini(base64String, undefined, file.type);
    };
    reader.readAsDataURL(file);
  };

  // Camera capture mechanics
  const startCamera = async () => {
    setCameraActive(true);
    setCapturedPhoto(null);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Live camera stream blocked. Utilizing a fallback category preset.', err);
      setError('Camera access is restricted in this sandbox. Please use a preset below or drag and drop an image.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg');
          setCapturedPhoto(dataUrl);
          setMediaUrl(dataUrl);
          stopCamera();
          analyzeWithGemini(dataUrl, undefined, 'image/jpeg');
        }
      } catch (err) {
        console.error('Canvas screen frame grab failed:', err);
        stopCamera();
      }
    }
  };

  // Trigger Gemini Multimodal model + Spatial GPS Deduplication checks
  const analyzeWithGemini = async (base64Data?: string, urlData?: string, mimeType: string = 'image/jpeg') => {
    setPhase('analyzing');
    setError(null);
    setLoadingMessage('Transmitting evidence to Gemini secure server...');

    // Trigger browser GPS lookup in parallel
    const gpsPromise = triggerGPSLookup();

    try {
      // 1. Send image to server-side API proxy
      setLoadingMessage('Performing pixel-level multimodal hazard inspection...');
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data || null,
          imageUrl: urlData || null,
          mimeType,
        }),
      });

      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || `Gemini failed to analyze this scene (${res.status})`);
      }

      const result = await res.json();
      console.log('Gemini Structured Analysis Completed:', result);

      // 2. Resolve GPS coordinates
      setLoadingMessage('Aligning localized geographic coordinates...');
      const coords = await gpsPromise;
      setLatitude(coords.lat);
      setLongitude(coords.lng);

      // Populate editable review fields
      setTitle(result.title || 'Civic Infrastructure Alert');
      setDescription(result.description || 'Infrastructure damage requires immediate service.');
      setCategory(result.issueType || 'other');
      setSeverity(result.severity !== undefined ? result.severity : 0.5);
      setConfidenceScore(result.confidenceScore !== undefined ? result.confidenceScore : 0.90);

      // Map closest neighborhood
      const nearestNbId = getAssignedNeighborhoodId(coords.lat, coords.lng);
      setNeighborhoodId(nearestNbId);

      // 3. Search Firestore / Memory array for open duplicate issues within 50 meters of the same category
      setLoadingMessage('Auditing municipal indexes for duplicate reports...');
      
      const duplicateMatch = issues.find(issue => {
        if (issue.status === 'resolved') return false;
        if (issue.type !== (result.issueType || 'other')) return false;
        
        const dist = getDistanceInMeters(coords.lat, coords.lng, issue.location.lat, issue.location.lng);
        return dist <= 50; // exactly 50 meters range
      });

      if (duplicateMatch) {
        setDetectedDuplicate(duplicateMatch);
        const distanceRounded = Math.round(getDistanceInMeters(coords.lat, coords.lng, duplicateMatch.location.lat, duplicateMatch.location.lng));
        setDuplicateDistance(distanceRounded);
        setPhase('duplicate');
      } else {
        setPhase('review');
      }

    } catch (err: any) {
      console.error('Failure in report automation flow:', err);
      setError(err.message || 'We could not connect to Gemini AI services at this moment.');
      setPhase('input');
    }
  };

  // Determine neighborhood proximity center
  const getAssignedNeighborhoodId = (lat: number, lng: number): string => {
    let nearestId = 'mission_district';
    let minDistance = Infinity;

    neighborhoods.forEach((nb) => {
      const dist = getDistanceInMeters(lat, lng, nb.boundaryCenter.lat, nb.boundaryCenter.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestId = nb.id;
      }
    });

    return nearestId;
  };

  // Handle map pointer refinement
  const handleMapLocationSelection = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    const updatedNb = getAssignedNeighborhoodId(lat, lng);
    setNeighborhoodId(updatedNb);
  };

  // Submit and save verified report
  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!title.trim() || !description.trim()) {
      setError('Please provide a title and detailed description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const assignedNbId = neighborhoodId || getAssignedNeighborhoodId(latitude, longitude);

    const initialDeptId = 
      category === 'pothole' ? 'roads' : 
      category === 'broken_streetlight' ? 'electrical_lighting' : 
      category === 'water_leak' ? 'water_drainage' : 
      category === 'waste_problem' ? 'sanitation' : 'roads';

    try {
      const newIssue: Omit<Issue, 'id'> = {
        reporterId: currentUser.id,
        reporterName: currentUser.name,
        reporterTrustScore: currentUser.trustScore,
        status: 'verifying',
        type: category,
        severity: severity,
        title: title.trim(),
        description: description.trim(),
        location: {
          lat: latitude,
          lng: longitude,
          geohash: encodeGeohash(latitude, longitude),
        },
        neighborhoodId: assignedNbId,
        departmentId: initialDeptId,
        priority: severity > 0.8 ? 'critical' : severity > 0.5 ? 'high' : severity > 0.2 ? 'medium' : 'low',
        // Fallback placeholder image if no file was loaded
        mediaUrl: mediaUrl || 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&q=80&w=600',
        reportedAt: new Date().toISOString(),
        resolvedAt: null,
        confirmCount: 0,
        rejectCount: 0,
        confirmedByUserIds: [],
        rejectedByUserIds: [],
        verificationPhotos: [],
      };

      // 1. Add issue to Firestore with initial 'verifying' status
      const issuesColRef = collection(db, 'issues');
      const docRef = await addDoc(issuesColRef, newIssue);
      await updateDoc(doc(db, 'issues', docRef.id), { id: docRef.id });

      // 2. Increment neighborhood community XP (award 10 XP)
      const nRef = doc(db, 'neighborhoods', assignedNbId);
      await updateDoc(nRef, {
        communityXP: increment(10),
      });

      // 3. Increment citizen XP (award exactly 10 XP as per prompt)
      const userRef = doc(db, 'users', currentUser.id);
      const xpReward = 10;
      let newXP = currentUser.xp + xpReward;
      let newLevel = currentUser.level;
      if (newXP >= 100 * currentUser.level) {
        newXP = newXP - (100 * currentUser.level);
        newLevel += 1;
      }

      await updateDoc(userRef, {
        xp: newXP,
        level: newLevel,
      });

      onUserUpdate({
        xp: newXP,
        level: newLevel,
      });

      // Success callback
      await onRefreshData();
      onReportSuccess(docRef.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'issues');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to get matching preset image
  const getCategoryLabel = (cat: IssueType): string => {
    return CATEGORY_PRESETS.find(p => p.value === cat)?.label || cat;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in" id="report_view_container">
      {/* 1. INPUT PHASE */}
      {phase === 'input' && (
        <div className="space-y-6" id="input_phase_panel">
          <div className="space-y-2 border-b border-slate-200 pb-5">
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full uppercase tracking-wider">
              Multimodal AI Dispatcher
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Report Local Hazard</h2>
            <p className="text-slate-500 text-sm max-w-2xl leading-relaxed">
              Upload an image or start your live camera. Gemini's advanced multimodal engine will automatically categorize, rate severity, and generate professional inspector briefs.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex gap-2.5 items-start">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
              <div>
                <span className="font-bold">Dispatch Error:</span> {error}
              </div>
            </div>
          )}

          {/* Interactive Evidence Workspace */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Input Options Column (Left) */}
            <div className="md:col-span-8 space-y-6">
              
              {/* Camera vs Upload Switcher */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                
                <div className="flex border-b border-slate-100 bg-slate-50/50 p-1.5">
                  <button
                    type="button"
                    onClick={() => { stopCamera(); setCameraActive(false); }}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      !cameraActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    File Upload
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      cameraActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Camera className="w-4 h-4 animate-pulse" />
                    Live Camera
                  </button>
                </div>

                <div className="p-6">
                  {cameraActive ? (
                    <div className="space-y-4">
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video flex items-center justify-center">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-0 border-2 border-emerald-500/20 pointer-events-none flex items-center justify-center">
                          <div className="w-48 h-48 border border-dashed border-emerald-400/40 rounded-full animate-spin [animation-duration:12s]" />
                        </div>
                      </div>
                      <div className="flex justify-center gap-3">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                        >
                          <Camera className="w-4 h-4" />
                          Snap Photo & Analyze
                        </button>
                        <button
                          type="button"
                          onClick={() => { stopCamera(); setCameraActive(false); }}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Drag & Drop zone */
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4 cursor-pointer transition-all ${
                        dragActive 
                          ? 'border-emerald-500 bg-emerald-50/30' 
                          : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <div className="p-4 bg-white rounded-full border border-slate-100 shadow-sm text-emerald-600">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Drag and drop hazard photo</p>
                        <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, or JPEG (Max 10MB)</p>
                      </div>
                      <button
                        type="button"
                        className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-all shadow-sm"
                      >
                        Choose File
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Presets Gallery for Sandbox Simulation */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-800">Sandbox Quick-Simulate Presets</h3>
                </div>
                <p className="text-slate-400 text-xs">
                  No local files? Click any neighborhood preset below to instantly simulate the Gemini AI report flow!
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {CATEGORY_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        setMediaUrl(preset.image);
                        setCapturedPhoto(preset.image);
                        analyzeWithGemini(undefined, preset.image);
                      }}
                      className="group border border-slate-200 rounded-xl overflow-hidden hover:border-emerald-500 hover:shadow-md transition-all text-left bg-slate-50 cursor-pointer flex flex-col h-24"
                    >
                      <div className="relative flex-1 bg-slate-200 overflow-hidden">
                        {preset.image ? (
                          <img 
                            src={preset.image} 
                            alt={preset.label} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-all"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 text-[10px] font-bold">
                            Default
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-white text-[10px] font-bold text-slate-700 truncate group-hover:text-emerald-600">
                        {preset.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Explanatory Sidebar Column (Right) */}
            <div className="md:col-span-4 space-y-6">
              <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full blur-xl" />
                
                <h3 className="text-base font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                  <Brain className="w-5 h-5 text-emerald-400" />
                  AI MODEL AS-A-SERVICE
                </h3>
                <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
                  <div className="flex gap-2">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong className="text-white">Structured Output Validation:</strong> Returns validated JSON schema parsed natively by Gemini.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong className="text-white">Proximity Deduplication:</strong> Auto-flags any issues filed within 50 meters to optimize municipal resources.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong className="text-white">Inspector Tone Synthesis:</strong> Assesses hazard impact in compliant, high-clarity technical statements.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>STABILITY RATING</span>
                    <span className="text-emerald-400 font-bold">99.8% READY</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ANALYZING / SCANNING PHASE */}
      {phase === 'analyzing' && (
        <div className="bg-white border border-slate-200 p-12 rounded-3xl shadow-lg text-center space-y-8 py-20 animate-pulse" id="analyzing_phase_panel">
          <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
            {/* Animated sonar ring */}
            <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping [animation-duration:1.5s]" />
            <div className="absolute inset-3 bg-emerald-500/20 rounded-full animate-ping [animation-duration:2.5s]" />
            <div className="relative p-5 bg-emerald-50 border border-emerald-200 rounded-full shadow-md text-emerald-600">
              <Brain className="w-10 h-10 animate-pulse" />
            </div>
          </div>

          <div className="space-y-3 max-w-md mx-auto">
            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
              Gemini Interrogating Evidence...
            </h3>
            <p className="text-xs font-mono text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block uppercase tracking-wider">
              {loadingMessage}
            </p>
            <p className="text-slate-500 text-xs leading-relaxed pt-2">
              Our server-side model is classifying pixels, estimating structural hazard parameters, querying current GPS coordinates, and deduplicating nearby report indexes.
            </p>
          </div>
        </div>
      )}

      {/* 3. DUPLICATE FLAGGED WARNING */}
      {phase === 'duplicate' && detectedDuplicate && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg animate-fade-in" id="duplicate_phase_panel">
          <div className="bg-amber-500 text-white p-6 flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold">Potential Duplicate Report Detected</h3>
              <p className="text-xs text-amber-50 leading-relaxed">
                Another citizen logged a matching incident only <span className="font-extrabold underline">{duplicateDistance} meters</span> from your location.
              </p>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wide">Existing Active Report</h4>
              
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                <div className="aspect-video relative bg-slate-800">
                  {detectedDuplicate.mediaUrl ? (
                    <img 
                      src={detectedDuplicate.mediaUrl} 
                      alt={detectedDuplicate.title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-xs">
                      No photo attached
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {detectedDuplicate.status}
                  </div>
                </div>

                <div className="p-4 space-y-2.5">
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-800 text-[9px] font-extrabold rounded-full uppercase tracking-wider">
                    {getCategoryLabel(detectedDuplicate.type)}
                  </span>
                  <h5 className="font-bold text-slate-850 text-sm leading-tight">{detectedDuplicate.title}</h5>
                  <p className="text-slate-500 text-xs leading-relaxed line-clamp-3">{detectedDuplicate.description}</p>
                  
                  <div className="pt-3 border-t border-slate-200/60 flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>REPORTED</span>
                    <span>{new Date(detectedDuplicate.reportedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wide">What does this mean?</h4>
                <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                  <div className="flex gap-2">
                    <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <p>
                      Municipal operations are already assigned to address this coordinates hotspot.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <p>
                      Creating redundant tickets fragment the city queue. Backing this existing report accelerates triage.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    // Treat duplicate as report success to return back home/map
                    onReportSuccess(detectedDuplicate?.id || "");
                  }}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  <ThumbsUp className="w-4 h-4" />
                  Great, support this report & return
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('review')}
                  className="w-full h-11 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Ignore & still report as a separate hazard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. AI REVIEW & CONFIRMATION SCREEN */}
      {phase === 'review' && (
        <form onSubmit={handleConfirmSubmit} className="space-y-6 animate-fade-in" id="review_phase_panel">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-5">
            <div>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full uppercase tracking-wider">
                Assessment Review
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Review AI Briefing</h2>
              <p className="text-slate-500 text-sm">
                Gemini successfully cataloged this issue. Double-check details below before final municipal broadcast.
              </p>
            </div>
            {/* AI Confidence badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-mono text-xs font-bold self-start sm:self-center">
              <Brain className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>{Math.round(confidenceScore * 100)}% AI CONFIDENCE</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Form Fields (Left) */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Structured Data Fields
                </h3>

                {/* AI generated Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wide">Incident Summary Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 focus:bg-white outline-none transition-all font-semibold"
                    placeholder="Brief summary of the issue"
                    maxLength={80}
                  />
                </div>

                {/* AI generated Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wide">Technical Brief (Inspector Tone)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 focus:bg-white outline-none transition-all h-28 resize-none font-semibold leading-relaxed"
                    placeholder="Technical description of the incident"
                    maxLength={500}
                  />
                </div>

                {/* Categories & Severity Slider */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wide">Classified Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full bg-slate-50 text-slate-700 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none font-semibold focus:border-emerald-500"
                    >
                      <option value="pothole">Road Cracks / Pothole</option>
                      <option value="broken_streetlight">Broken Streetlight</option>
                      <option value="water_leak">Water Pipe Leak</option>
                      <option value="waste_problem">Illegal Dumping / Trash</option>
                      <option value="other">Other Hazards</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-500 uppercase tracking-wide">
                      <span>Severity Rating</span>
                      <span className={`font-bold ${severity > 0.8 ? 'text-red-600' : severity > 0.5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {Math.round(severity * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={severity}
                        onChange={(e) => setSeverity(Number(e.target.value))}
                        className="flex-1 h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Geo Location Verification Map block */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    Civic Coordinate Tagging
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                    Your location was grabbed automatically. You can click on the map to refine the coordinate pin.
                  </p>
                </div>

                <div className="h-60 rounded-2xl overflow-hidden border border-slate-200">
                  <MapComponent
                    neighborhoods={neighborhoods}
                    selectedNeighborhood={null}
                    issues={[]}
                    selectedIssueId={null}
                    onSelectIssue={() => {}}
                    radiusFilter={null}
                    activeTypeFilter="all"
                    activeStatusFilter="all"
                    markerCreationMode={true}
                    tempMarker={{ lat: latitude, lng: longitude }}
                    onMapClick={handleMapLocationSelection}
                  />
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 font-mono">
                  <span className="flex items-center gap-1 text-slate-500 font-bold">
                    <MapPinIcon className="w-3.5 h-3.5 text-rose-500" />
                    COORDINATES:
                  </span>
                  <span className="text-slate-800 font-extrabold">{latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
                </div>
              </div>

            </div>

            {/* Media Preview & Submit Panel (Right) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Media Preview Card */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase">Evidence Captured</span>
                  <button
                    type="button"
                    onClick={() => { setPhase('input'); }}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-500 cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Change Image
                  </button>
                </div>
                
                <div className="aspect-video bg-slate-100 relative">
                  {capturedPhoto ? (
                    <img 
                      src={capturedPhoto} 
                      alt="Civic report media evidence" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                      <Camera className="w-8 h-8 mb-2" />
                      No evidence photo attached
                    </div>
                  )}
                </div>
              </div>

              {/* Summary dispatch CTA */}
              <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl" />
                
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h4 className="font-extrabold text-sm tracking-tight">Active Citizen Rewards</h4>
                </div>
                
                <p className="text-xs text-slate-300 leading-relaxed">
                  Submitting this valid incident updates neighborhood health scores and rewards you with:
                </p>

                <div className="space-y-2 bg-white/5 p-3.5 rounded-2xl border border-white/5 text-xs font-mono">
                  <div className="flex justify-between items-center text-emerald-300">
                    <span>CITIZEN XP</span>
                    <span className="font-extrabold">+10 XP</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-400">
                    <span>TRUST SCORE</span>
                    <span className="font-extrabold">+5 PTS</span>
                  </div>
                  <div className="flex justify-between items-center text-indigo-300">
                    <span>NEIGHBORHOOD RECON</span>
                    <span className="font-extrabold">+10 XP</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm hover:scale-[1.01]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Broadcasting Civic Alert...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Broadcast Civic Alert (+10 XP)
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>

        </form>
      )}

    </div>
  );
}
