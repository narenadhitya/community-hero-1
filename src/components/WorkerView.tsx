import React, { useState, useMemo, useEffect } from 'react';
import { User, Issue, Department, Neighborhood } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { 
  Briefcase, MapPin, CheckCircle2, AlertTriangle, Clock, 
  Sparkles, Camera, Navigation, Upload, ArrowRight, Check, Play, Lock, ShieldAlert
} from 'lucide-react';

interface WorkerViewProps {
  currentUser: User | null;
  departments: Department[];
  issues: Issue[];
  neighborhoods: Neighborhood[];
  onRefreshData: () => Promise<void>;
  onUserUpdate: (updatedUser: Partial<User>) => void;
}

export default function WorkerView({
  currentUser,
  departments,
  issues,
  neighborhoods,
  onRefreshData,
  onUserUpdate
}: WorkerViewProps) {
  // Worker coordinates state (defaults near Mission District / Dolores Park center)
  const [workerLat, setWorkerLat] = useState(37.7599);
  const [workerLng, setWorkerLng] = useState(-122.4148);
  const [isUpdatingStatusId, setIsUpdatingStatusId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Simulated GPS or Custom Location Select
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'tracking' | 'error'>('idle');

  // Photo simulation URLs
  const PHOTO_PRESETS: { [key: string]: { before: string; during: string; after: string } } = {
    pothole: {
      before: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=400',
      during: 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&q=80&w=400',
      after: 'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&q=80&w=400'
    },
    broken_streetlight: {
      before: 'https://images.unsplash.com/photo-1509024644558-2f5de0f9ca0b?auto=format&fit=crop&q=80&w=400',
      during: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400',
      after: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&q=80&w=400'
    },
    water_leak: {
      before: 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&q=80&w=400',
      during: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400',
      after: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&q=80&w=400'
    },
    waste_problem: {
      before: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=400',
      during: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=400',
      after: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&q=80&w=400'
    },
    other: {
      before: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400',
      during: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400',
      after: 'https://images.unsplash.com/photo-1581092162613-f9a8043515b2?auto=format&fit=crop&q=80&w=400'
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Get active department of worker
  const activeDept = useMemo(() => {
    if (!currentUser || !currentUser.departmentId) return null;
    return departments.find(d => d.id === currentUser.departmentId) || null;
  }, [currentUser, departments]);

  // Request high-precision GPS coordinate simulation
  const handleDetectGPS = () => {
    setGpsStatus('tracking');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setWorkerLat(pos.coords.latitude);
          setWorkerLng(pos.coords.longitude);
          setGpsStatus('idle');
          showToast('📡 Real GPS Coordinates Synced Successfully!');
        },
        (err) => {
          console.error('GPS extraction failed:', err);
          // Auto fallbacks near Dolores Park coordinates for test demo
          setWorkerLat(37.7612);
          setWorkerLng(-122.4154);
          setGpsStatus('idle');
          showToast('ℹ️ GPS blocked/timed out. Defaulting to Dolores Park demo coords.');
        },
        { timeout: 5000 }
      );
    } else {
      setGpsStatus('error');
      showToast('❌ Geolocation is not supported by your browser.');
    }
  };

  // Helper to jump to a specific neighborhood zone coordinate preset
  const handleJumpToZone = (lat: number, lng: number, zoneName: string) => {
    setWorkerLat(lat);
    setWorkerLng(lng);
    showToast(`📍 GPS relocated to center of ${zoneName}!`);
  };

  // 1. Queue logic: Filter and Sort by Proximity + Priority
  const sortedQueue = useMemo(() => {
    if (!currentUser || !currentUser.departmentId) return [];

    // Filter queue issues matching active worker's department and ignoring fully resolved ones
    // Keep pending/verifying in normal feed, but departments see: 'routed', 'in_progress', 'verifying_fix', 'disputed'
    const deptIssues = issues.filter(
      (i) => i.departmentId === currentUser.departmentId && i.status !== 'resolved'
    );

    return deptIssues.map((issue) => {
      // Calculate direct Euclidean distance in km (1 deg ~ 111.32 km)
      const latDiff = issue.location.lat - workerLat;
      const lngDiff = issue.location.lng - workerLng;
      const distanceDegrees = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
      const distanceKm = distanceDegrees * 111.32;

      // Assign numerical weight to priorities (higher is more critical)
      const priorityWeight = 
        issue.priority === 'critical' ? 100 : 
        issue.priority === 'high' ? 75 : 
        issue.priority === 'medium' ? 50 : 25;

      // Escalated issues get a critical routing bump (+40 points)
      const escalationBump = issue.isEscalated ? 40 : 0;

      // Calculate combined dispatch score: high priority and close distance increase the dispatch score
      // Score = priorityWeight + escalationBump - (distanceKm * 15)
      const dispatchScore = Math.round(priorityWeight + escalationBump - (distanceKm * 15));

      return {
        ...issue,
        distanceKm,
        dispatchScore,
      };
    }).sort((a, b) => b.dispatchScore - a.dispatchScore); // Sort descending by dispatch score (highest dispatch priority first)
  }, [issues, currentUser, workerLat, workerLng]);

  // Handle setting status to 'in_progress'
  const handleStartWork = async (issueId: string) => {
    setIsUpdatingStatusId(issueId);
    try {
      const issueRef = doc(db, 'issues', issueId);
      await updateDoc(issueRef, {
        status: 'in_progress'
      });
      showToast('👷 Issue Status marked as: IN PROGRESS. Commencing repairs.');
      await onRefreshData();
    } catch (err) {
      console.error('Error starting work:', err);
      showToast('❌ Failed to update status to In Progress.');
      handleFirestoreError(err, OperationType.UPDATE, `issues/${issueId}`);
    } finally {
      setIsUpdatingStatusId(null);
    }
  };

  // Handle simulating photo upload
  const handleSimulatePhoto = async (issue: Issue, phase: 'before' | 'during' | 'after') => {
    const presetObj = PHOTO_PRESETS[issue.type] || PHOTO_PRESETS.other;
    const photoUrl = presetObj[phase];

    try {
      const issueRef = doc(db, 'issues', issue.id);
      await updateDoc(issueRef, {
        [`${phase}Photo`]: photoUrl
      });
      showToast(`📸 Simulated ${phase} photo snap uploaded!`);
      await onRefreshData();
    } catch (err) {
      console.error('Error simulating photo upload:', err);
      showToast('❌ Failed to save simulated photo.');
      handleFirestoreError(err, OperationType.UPDATE, `issues/${issue.id}`);
    }
  };

  // Handle uploading real file photos
  const handleUploadPhoto = async (issueId: string, phase: 'before' | 'during' | 'after', file: File) => {
    // Standard FileReader to convert file to Base64 dataURL for persistent demo storage in firestore
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      try {
        const issueRef = doc(db, 'issues', issueId);
        await updateDoc(issueRef, {
          [`${phase}Photo`]: dataUrl
        });
        showToast(`📁 Uploaded ${phase} photo successfully!`);
        await onRefreshData();
      } catch (err) {
        console.error('Failed to save uploaded photo:', err);
        showToast('❌ Failed to save uploaded image.');
        handleFirestoreError(err, OperationType.UPDATE, `issues/${issueId}`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit Completed Fix to Verification
  const handleSubmitFix = async (issue: Issue) => {
    if (!issue.beforePhoto || !issue.duringPhoto || !issue.afterPhoto) {
      showToast('⚠️ Proof Required: Please snap/upload Before, During, and After photos before submitting!');
      return;
    }

    setIsUpdatingStatusId(issue.id);
    try {
      const issueRef = doc(db, 'issues', issue.id);
      await updateDoc(issueRef, {
        status: 'verifying_fix',
        fixVerificationConfirms: 0,
        fixVerificationRejects: 0,
        fixConfirmedByUserIds: [],
        fixRejectedByUserIds: []
      });
      showToast('🎉 Fix submitted! Citizens in this corridor are being notified to verify.');
      await onRefreshData();
    } catch (err) {
      console.error('Error submitting fix:', err);
      showToast('❌ Failed to submit fix.');
      handleFirestoreError(err, OperationType.UPDATE, `issues/${issue.id}`);
    } finally {
      setIsUpdatingStatusId(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 relative">
      {/* HUD Toast Messages */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white border border-indigo-500/30 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Department Dispatch Terminal
              </span>
              {activeDept && (
                <span className="px-3 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-mono font-extrabold rounded-full uppercase">
                  {activeDept.name} Crew
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black tracking-tight mt-1">
              Officer: <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">{currentUser.name}</span>
            </h2>
            <p className="text-slate-300 text-xs leading-relaxed max-w-xl font-medium">
              You are assigned to address repairs routed to the <strong>{activeDept?.name || 'Municipal'}</strong> department. Your active queue is sorted below using real-time dispatch calculations.
            </p>
          </div>

          {/* Core Level badge */}
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl shrink-0">
            <div className="text-center">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">Worker Level</span>
              <span className="text-2xl font-black text-amber-400 block mt-0.5">Lvl {currentUser.level}</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">Personal XP</span>
              <span className="text-2xl font-black text-white block mt-0.5">{currentUser.xp} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Hand: Location / GPS Override Console (Lg: 4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Navigation className="w-4.5 h-4.5 text-indigo-600 animate-spin-slow" />
                Crew Location HUD
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Set your crew location coordinates below to dynamically sort and calculate proximity to active repair corridors.
              </p>
            </div>

            {/* Coordinates display */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-2 gap-4 text-center">
              <div>
                <span className="text-[9px] font-mono text-slate-400 block uppercase font-bold">Latitude</span>
                <span className="text-sm font-mono font-bold text-slate-800">{workerLat.toFixed(5)}</span>
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-400 block uppercase font-bold">Longitude</span>
                <span className="text-sm font-mono font-bold text-slate-800">{workerLng.toFixed(5)}</span>
              </div>
            </div>

            {/* Simulated GPS toggle */}
            <button
              onClick={handleDetectGPS}
              disabled={gpsStatus === 'tracking'}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-100 disabled:opacity-50"
            >
              <Navigation className={`w-4 h-4 text-indigo-200 ${gpsStatus === 'tracking' ? 'animate-ping' : ''}`} />
              {gpsStatus === 'tracking' ? 'Syncing Mobile GPS...' : 'Simulate GPS Tracking'}
            </button>

            {/* Manual Quick relocate shortcuts */}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Manual Corridor Relocate:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleJumpToZone(37.7599, -122.4148, 'Mission District')}
                  className="p-2 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 text-left transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  Mission District
                </button>
                <button
                  onClick={() => handleJumpToZone(37.8014, -122.4087, 'North Beach')}
                  className="p-2 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 text-left transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  North Beach
                </button>
              </div>
            </div>

            {/* Department scoreboard overview */}
            {activeDept && (
              <div className="border-t border-slate-100 pt-4 space-y-2.5">
                <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Department Performance:</span>
                <div className="space-y-1.5 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Accountability Score:</span>
                    <span className="text-slate-800 font-bold">{activeDept.accountabilityScore}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Resolution Rate:</span>
                    <span className="text-slate-800 font-bold">{Math.round(activeDept.resolutionRate * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Average SLA Speed:</span>
                    <span className="text-slate-800 font-bold">{activeDept.avgResponseHours} hrs</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Hand: Active Queue sorted by Optimized Proximity + Priority (Lg: 8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
                  Optimized Route Dispatch Queue
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Dynamic routing sorted client-side by **Proximity distance + Severity Weight**. Fix verification demands before/during/after records.
                </p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg font-mono">
                {sortedQueue.length} Active Jobs
              </span>
            </div>

            {sortedQueue.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50 space-y-1.5">
                <span className="text-3xl block">🌈</span>
                <h4 className="text-sm font-bold text-slate-700">All clear! No active routed issues for your department.</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Nice work! Keep an eye on incoming reports verified by citizens on the main coordinate map.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedQueue.map((issue, idx) => {
                  const hasBefore = !!issue.beforePhoto;
                  const hasDuring = !!issue.duringPhoto;
                  const hasAfter = !!issue.afterPhoto;

                  return (
                    <div 
                      key={issue.id} 
                      className={`border rounded-2xl p-5 space-y-4 shadow-xs transition-all ${
                        issue.status === 'in_progress'
                          ? 'bg-amber-50/20 border-amber-200 shadow-sm ring-1 ring-amber-300'
                          : issue.status === 'verifying_fix'
                          ? 'bg-emerald-50/20 border-emerald-200'
                          : 'bg-slate-50/40 border-slate-200 hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Priority, Dispatch Score & Route stats */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 border border-slate-200/60 rounded-xl shadow-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                            ROUTE #{idx + 1}
                          </span>
                          
                          {/* Priority badge */}
                          <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded uppercase ${
                            issue.priority === 'critical' ? 'bg-red-600 text-white' :
                            issue.priority === 'high' ? 'bg-amber-600 text-white' :
                            issue.priority === 'medium' ? 'bg-indigo-600 text-white' : 'bg-slate-500 text-white'
                          }`}>
                            {issue.priority} priority
                          </span>

                          {/* Escalation state badge */}
                          {issue.isEscalated && (
                            <span className="px-2 py-0.5 bg-rose-100 border border-rose-200 text-rose-700 text-[9px] font-mono font-bold rounded animate-pulse uppercase flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                              REOPENED & ESCALATED
                            </span>
                          )}
                        </div>

                        {/* Dispatch scoring calculation display */}
                        <div className="text-right text-[10px] font-mono flex flex-col items-end">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-slate-400">Proximity:</span>
                            <span className="text-slate-800">{issue.distanceKm.toFixed(2)} km</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-black mt-0.5 text-indigo-600">
                            <span>Dispatch Score:</span>
                            <span>{issue.dispatchScore} pts</span>
                          </div>
                        </div>
                      </div>

                      {/* Header issue text */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-800 leading-snug">{issue.title}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${
                            issue.status === 'routed' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                            issue.status === 'in_progress' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                            issue.status === 'verifying_fix' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {issue.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">{issue.description}</p>
                        
                        {/* SLA / Deadline Display */}
                        {issue.slaDeadline && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-2 font-bold uppercase">
                            <Clock className="w-3.5 h-3.5" />
                            <span>SLA Target: {new Date(issue.slaDeadline).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Photo evidence matrix */}
                      <div className="border-t border-slate-200/60 pt-4 space-y-3">
                        <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase tracking-wide">
                          Municipal Evidence Tracking Grid (Before/During/After Proof)
                        </span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Phase 1: Before Photo */}
                          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">1. Before</span>
                              {hasBefore && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </div>
                            
                            {hasBefore ? (
                              <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200">
                                <img src={issue.beforePhoto} alt="Before repair" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="aspect-video bg-slate-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-slate-200 text-center p-2">
                                <span className="text-sm text-slate-400">❌ Missing</span>
                              </div>
                            )}

                            {issue.status === 'in_progress' && (
                              <div className="flex gap-1.5 mt-1">
                                <button
                                  onClick={() => handleSimulatePhoto(issue, 'before')}
                                  className="flex-1 py-1 bg-slate-150 hover:bg-slate-200 text-[9px] font-bold rounded text-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Camera className="w-3 h-3" /> Simulate
                                </button>
                                <label className="py-1 px-1.5 bg-slate-150 hover:bg-slate-200 text-[9px] font-bold rounded text-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1">
                                  <Upload className="w-3 h-3" />
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleUploadPhoto(issue.id, 'before', e.target.files[0]);
                                      }
                                    }} 
                                  />
                                </label>
                              </div>
                            )}
                          </div>

                          {/* Phase 2: During Photo */}
                          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">2. During</span>
                              {hasDuring && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </div>
                            
                            {hasDuring ? (
                              <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200">
                                <img src={issue.duringPhoto} alt="During repair" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="aspect-video bg-slate-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-slate-200 text-center p-2">
                                <span className="text-sm text-slate-400">❌ Missing</span>
                              </div>
                            )}

                            {issue.status === 'in_progress' && (
                              <div className="flex gap-1.5 mt-1">
                                <button
                                  onClick={() => handleSimulatePhoto(issue, 'during')}
                                  className="flex-1 py-1 bg-slate-150 hover:bg-slate-200 text-[9px] font-bold rounded text-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Camera className="w-3 h-3" /> Simulate
                                </button>
                                <label className="py-1 px-1.5 bg-slate-150 hover:bg-slate-200 text-[9px] font-bold rounded text-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1">
                                  <Upload className="w-3 h-3" />
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleUploadPhoto(issue.id, 'during', e.target.files[0]);
                                      }
                                    }} 
                                  />
                                </label>
                              </div>
                            )}
                          </div>

                          {/* Phase 3: After Photo */}
                          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">3. After</span>
                              {hasAfter && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </div>
                            
                            {hasAfter ? (
                              <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200">
                                <img src={issue.afterPhoto} alt="After repair" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="aspect-video bg-slate-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-slate-200 text-center p-2">
                                <span className="text-sm text-slate-400">❌ Missing</span>
                              </div>
                            )}

                            {issue.status === 'in_progress' && (
                              <div className="flex gap-1.5 mt-1">
                                <button
                                  onClick={() => handleSimulatePhoto(issue, 'after')}
                                  className="flex-1 py-1 bg-slate-150 hover:bg-slate-200 text-[9px] font-bold rounded text-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Camera className="w-3 h-3" /> Simulate
                                </button>
                                <label className="py-1 px-1.5 bg-slate-150 hover:bg-slate-200 text-[9px] font-bold rounded text-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1">
                                  <Upload className="w-3 h-3" />
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleUploadPhoto(issue.id, 'after', e.target.files[0]);
                                      }
                                    }} 
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Main Interaction Actions */}
                      <div className="border-t border-slate-100 pt-4 flex gap-3">
                        {issue.status === 'routed' && (
                          <button
                            disabled={isUpdatingStatusId !== null}
                            onClick={() => handleStartWork(issue.id)}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-100 disabled:opacity-50"
                          >
                            <Play className="w-4 h-4 text-indigo-200" />
                            {isUpdatingStatusId === issue.id ? 'Starting Work...' : 'Mark In Progress & Accept Job'}
                          </button>
                        )}

                        {issue.status === 'in_progress' && (
                          <button
                            disabled={isUpdatingStatusId !== null}
                            onClick={() => handleSubmitFix(issue)}
                            className={`w-full h-11 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                              hasBefore && hasDuring && hasAfter
                                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-100'
                                : 'bg-slate-400 opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-150" />
                            {isUpdatingStatusId === issue.id ? 'Submitting...' : 'Submit Fix to Citizen Verification'}
                          </button>
                        )}

                        {issue.status === 'verifying_fix' && (
                          <div className="w-full bg-emerald-50/50 border border-emerald-100 p-3.5 rounded-xl text-center">
                            <p className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
                              Awaiting Citizen Verification ({issue.fixVerificationConfirms || 0}/2 Confirms)
                            </p>
                            <p className="text-[10px] text-slate-450 font-semibold mt-1">
                              Nearby citizens are reviewing your photographic evidence to close this ticket.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
