import React, { useState, useMemo, useEffect } from 'react';
import { Neighborhood, Issue, Department, User, IssueType, IssueStatus } from '../types';
import MapComponent from './MapComponent';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { 
  Heart, Shield, Lightbulb, Droplet, Leaf, Eye, Users, AlertCircle, 
  MapPin, Clock, CheckCircle2, User as UserIcon, Trash2, Sliders, Navigation, RefreshCw,
  Sparkles, AlertTriangle, Brain, X, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Custom animated 3D react character representing neighborhood health
export function NeighborhoodBlob({ health }: { health: number }) {
  const [animatedHealth, setAnimatedHealth] = useState(health);

  useEffect(() => {
    const duration = 1000; // 1 second transition
    const startTime = performance.now();
    const startValue = animatedHealth;

    let animFrameId: number;
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing out quadratic
      const ease = progress * (2 - progress);
      setAnimatedHealth(startValue + (health - startValue) * ease);

      if (progress < 1) {
        animFrameId = requestAnimationFrame(animate);
      }
    };
    animFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameId);
  }, [health]);

  const h = animatedHealth;
  
  // Continuous interpolation helper
  const interpolate = (val: number, x1: number, x2: number, y1: number, y2: number): number => {
    const t = Math.min(1, Math.max(0, (val - x1) / (x2 - x1)));
    return y1 + t * (y2 - y1);
  };

  // 1. Dynamic continuous color gradient (Coral -> Amber -> Emerald)
  let color = 'rgb(16, 185, 129)';
  if (h <= 65) {
    const t = Math.min(1, Math.max(0, (h - 45) / 20));
    const r = Math.round(244 + t * (245 - 244));
    const g = Math.round(63 + t * (158 - 63));
    const b = Math.round(94 + t * (11 - 94));
    color = `rgb(${r}, ${g}, ${b})`;
  } else if (h <= 80) {
    const t = Math.min(1, Math.max(0, (h - 65) / 15));
    const r = Math.round(245 + t * (16 - 245));
    const g = Math.round(158 + t * (185 - 158));
    const b = Math.round(11 + t * (129 - 11));
    color = `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = Math.min(1, Math.max(0, (h - 80) / 20));
    const r = Math.round(16 + t * (34 - 16));
    const g = Math.round(185 + t * (197 - 185));
    const b = Math.round(129 + t * (94 - 129));
    color = `rgb(${r}, ${g}, ${b})`;
  }

  // 2. High-contrast face color (Deep crimson -> Deep Amber/Brown -> Deep Emerald)
  let faceColor = '#064e3b';
  if (h <= 65) {
    faceColor = '#4c0519';
  } else if (h <= 80) {
    faceColor = '#78350f';
  }

  // Text status label
  let text = 'THRIVING!';
  if (h < 65) {
    text = 'CRITICAL GRID!';
  } else if (h < 80) {
    text = 'STABILIZING';
  }

  // 3. Continuous Squishy Blob Geometry calculation
  const rx = interpolate(h, 50, 90, 27, 36);
  const ry = interpolate(h, 50, 90, 23, 38);
  const cy = interpolate(h, 50, 90, 53, 50);

  const x_left = 50 - rx;
  const x_right = 50 + rx;
  const x_left_ctrl = 50 - 0.552 * rx;
  const x_right_ctrl = 50 + 0.552 * rx;
  const y_top_ctrl = cy - 0.552 * ry;
  const y_bottom_ctrl = cy + 0.552 * ry;
  const y_top = cy - ry;
  const y_bottom = cy + ry;

  const bodyPath = `M ${x_left} ${cy} C ${x_left} ${y_top_ctrl}, ${x_left_ctrl} ${y_top}, 50 ${y_top} C ${x_right_ctrl} ${y_top}, ${x_right} ${y_top_ctrl}, ${x_right} ${cy} C ${x_right} ${y_bottom_ctrl}, ${x_right_ctrl} ${y_bottom}, 50 ${y_bottom} C ${x_left_ctrl} ${y_bottom}, ${x_left} ${y_bottom_ctrl}, ${x_left} ${cy} Z`;

  // 4. Continuous Mouth Curve calculation
  const y_mouth = interpolate(h, 50, 90, 63, 56);
  const y_ctrl = interpolate(h, 50, 90, 52, 70);
  const mouthPath = `M 38 ${y_mouth} Q 50 ${y_ctrl}, 62 ${y_mouth}`;

  // 5. Continuous Eyebrow Slant/Arch calculation
  const ly_start = interpolate(h, 50, 90, 37, 38);
  const ly_ctrl = interpolate(h, 50, 90, 43, 32);
  const ly_end = interpolate(h, 50, 90, 44, 36);
  const leftEyebrowPath = `M 32 ${ly_start} Q 38 ${ly_ctrl}, 44 ${ly_end}`;

  const ry_start = interpolate(h, 50, 90, 44, 36);
  const ry_ctrl = interpolate(h, 50, 90, 43, 32);
  const ry_end = interpolate(h, 50, 90, 37, 38);
  const rightEyebrowPath = `M 56 ${ry_start} Q 62 ${ry_ctrl}, 68 ${ry_end}`;

  // 6. Continuous Eye Squish calculation
  const cy_eye = interpolate(h, 50, 90, 48, 46);
  const ry_eye = interpolate(h, 50, 90, 3.5, 0.8);
  const rx_eye = 3.5;

  // 7. Blush intensity calculation
  const blushOpacity = interpolate(h, 50, 90, 0, 0.75);

  // 8. Sad teardrop intensity
  const tearOpacity = interpolate(h, 35, 62, 0.9, 0);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[220px] mx-auto select-none">
      <div className="relative">
        {/* Magic glowing background matching microgrid state */}
        <div 
          className="absolute inset-0 rounded-full blur-2xl opacity-20 transition-all duration-1000"
          style={{ backgroundColor: color }}
        />
        <svg 
          viewBox="0 0 100 100" 
          className="w-32 h-32 relative z-10 filter drop-shadow-[0_8px_4px_rgba(0,0,0,0.12)] transition-all duration-1000 ease-out animate-pulse-gentle"
        >
          {/* Morphing primary body */}
          <path
            d={bodyPath}
            fill={color}
          />

          {/* Morphing Left Eyebrow */}
          <path
            d={leftEyebrowPath}
            stroke={faceColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Morphing Right Eyebrow */}
          <path
            d={rightEyebrowPath}
            stroke={faceColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Left Eye */}
          <ellipse
            cx="37"
            cy={cy_eye}
            rx={rx_eye}
            ry={ry_eye}
            fill={faceColor}
          />

          {/* Right Eye */}
          <ellipse
            cx="63"
            cy={cy_eye}
            rx={rx_eye}
            ry={ry_eye}
            fill={faceColor}
          />

          {/* Cute Blushing Cheeks */}
          {blushOpacity > 0 && (
            <g opacity={blushOpacity}>
              <circle cx="28" cy={y_mouth + 1.5} r="3.5" fill="#f43f5e" />
              <circle cx="72" cy={y_mouth + 1.5} r="3.5" fill="#f43f5e" />
            </g>
          )}

          {/* Sad Tear Drop */}
          {tearOpacity > 0 && (
            <path
              d="M 33 52 C 33 50, 35 50, 35 52 C 35 54, 33 56, 33 56 C 33 56, 31 54, 33 52"
              fill="#38bdf8"
              opacity={tearOpacity}
            />
          )}

          {/* Morphing Mouth */}
          <path
            d={mouthPath}
            stroke={faceColor}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
      
      <div className="text-center space-y-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-amber-800/60 block font-display">
          Microgrid Vitality Blob
        </span>
        <h4 className="text-lg font-display font-black text-amber-950 tracking-tight">
          {text}
        </h4>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100/50 border border-amber-200/60 rounded-full shadow-inner">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <span className="text-[10px] font-black text-amber-900 font-display">
            {Math.round(animatedHealth)}% HEALTH
          </span>
        </div>
      </div>
    </div>
  );
}

interface HomeViewProps {
  neighborhoods: Neighborhood[];
  issues: Issue[];
  departments: Department[];
  currentUser: User | null;
  onRefreshData: () => Promise<void>;
  onUserUpdate: (updatedUser: Partial<User>) => void;
  justReportedIssueId: string | null;
  setJustReportedIssueId: (id: string | null) => void;
  setActiveTab: (tab: 'home' | 'report' | 'profile' | 'community' | 'accountability') => void;
}

export default function HomeView({
  neighborhoods,
  issues,
  departments,
  currentUser,
  onRefreshData,
  onUserUpdate,
  justReportedIssueId,
  setJustReportedIssueId,
  setActiveTab,
}: HomeViewProps) {
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [radiusFilter, setRadiusFilter] = useState<number | null>(null); // in km (e.g. 0.5, 1, null)
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | IssueType>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | IssueStatus>('all');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showMapFilters, setShowMapFilters] = useState(false);

  // AI Classification animation states
  const [aiClassificationStep, setAiClassificationStep] = useState<number>(-1);

  useEffect(() => {
    if (justReportedIssueId) {
      const issue = issues.find(i => i.id === justReportedIssueId);
      if (issue) {
        setSelectedNeighborhoodId(issue.neighborhoodId);
        setSelectedIssueId(justReportedIssueId);
        setAiClassificationStep(0);
      }
    }
  }, [justReportedIssueId, issues]);

  useEffect(() => {
    if (aiClassificationStep >= 0 && aiClassificationStep < 3) {
      const timer = setTimeout(() => {
        setAiClassificationStep(prev => prev + 1);
      }, 950);
      return () => clearTimeout(timer);
    } else if (aiClassificationStep === 3) {
      const timer = setTimeout(() => {
        setAiClassificationStep(-1);
        if (setJustReportedIssueId) {
          setJustReportedIssueId(null);
        }
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [aiClassificationStep, setJustReportedIssueId]);

  // Compute live neighborhood health scores
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const computedNeighborhoods = useMemo(() => {
    return neighborhoods.map((n) => {
      // Clone healthScores so we can modify them
      const liveHealthScores = { ...n.healthScores };
      
      // Get issues for this neighborhood
      const nIssues = issues.filter((i) => i.neighborhoodId === n.id);
      
      nIssues.forEach((issue) => {
        // Find which metric this issue type affects
        let metric: keyof typeof n.healthScores = 'infrastructure';
        if (issue.type === 'waste_problem') metric = 'cleanliness';
        if (issue.type === 'broken_streetlight') metric = 'lighting';
        if (issue.type === 'water_leak') metric = 'water';
        if (issue.type === 'other') metric = 'safety';
        
        if (issue.status !== 'resolved' && issue.status !== 'disputed') {
          // Unresolved issue slowly lowers score the longer it stays open
          const reportedTime = new Date(issue.reportedAt).getTime();
          const ageMs = Date.now() - reportedTime;
          const ageSecs = Math.max(0, ageMs / 1000);
          
          // Degrade 0.02 points per second of being open, scaled by severity
          const decay = 0.02 * ageSecs * (issue.severity || 0.5);
          liveHealthScores[metric] = Math.max(10, liveHealthScores[metric] - decay);
        } else if (issue.status === 'resolved' && (issue.confirmCount || 0) >= 2) {
          // Resolved and verified issues raise the score back up!
          liveHealthScores[metric] = Math.min(100, liveHealthScores[metric] + 8);
        }
      });
      
      // Ensure all values are rounded and capped
      const roundedScores = {} as typeof n.healthScores;
      for (const [k, v] of Object.entries(liveHealthScores)) {
        roundedScores[k as keyof typeof n.healthScores] = Math.min(100, Math.max(0, Math.round(v)));
      }
      
      return {
        ...n,
        healthScores: roundedScores,
      };
    });
  }, [neighborhoods, issues, tick]);

  // Selected neighborhood object (uses live computed scores)
  const selectedNeighborhood = useMemo(() => {
    return computedNeighborhoods.find((n) => n.id === selectedNeighborhoodId) || null;
  }, [computedNeighborhoods, selectedNeighborhoodId]);

  // Selected issue detailed object
  const selectedIssue = useMemo(() => {
    if (!selectedIssueId) return null;
    return issues.find((i) => i.id === selectedIssueId) || null;
  }, [issues, selectedIssueId]);

  // Selected issue's department
  const selectedIssueDepartment = useMemo(() => {
    if (!selectedIssue) return null;
    return departments.find((d) => d.id === selectedIssue.departmentId) || null;
  }, [selectedIssue, departments]);

  // Filter verifying issues for the selected neighborhood
  const issuesToVerify = useMemo(() => {
    return issues.filter((i) => i.neighborhoodId === selectedNeighborhoodId && (i.status === 'verifying' || i.status === 'verifying_fix'));
  }, [issues, selectedNeighborhoodId]);

  const slaInfo = useMemo(() => {
    if (!selectedIssue || !selectedIssue.slaDeadline) return null;
    const deadlineTime = new Date(selectedIssue.slaDeadline).getTime();
    const diff = deadlineTime - Date.now();
    
    if (diff <= 0) {
      return { breached: true, label: "SLA BREACHED", details: "Escalated to Director" };
    }
    
    const totalSecs = Math.floor(diff / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return {
      breached: false,
      label: "Active SLA",
      timeString: `${mins}m ${secs}s remaining`
    };
  }, [selectedIssue, selectedIssue?.slaDeadline, tick]);

  // Calculate overall health score for selected neighborhood
  const overallHealthScore = useMemo(() => {
    if (!selectedNeighborhood) return 0;
    const scores = selectedNeighborhood.healthScores;
    const sum = 
      scores.infrastructure + 
      scores.cleanliness + 
      scores.safety + 
      scores.lighting + 
      scores.water + 
      scores.green + 
      scores.accessibility + 
      scores.engagement;
    return Math.round(sum / 8);
  }, [selectedNeighborhood]);

  // Dynamic feedback visual styling of overall health for light-mode theme
  const getHealthColor = (score: number) => {
    if (score >= 85) return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200/80', progress: 'stroke-emerald-500' };
    if (score >= 70) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200/80', progress: 'stroke-amber-500' };
    return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200/80', progress: 'stroke-rose-500' };
  };

  const healthStyle = getHealthColor(overallHealthScore);

  // Trigger a brief toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Community Verification logic states & handlers
  const [verifyingPhotoMap, setVerifyingPhotoMap] = useState<{[key: string]: string}>({});
  const [isVerifyingAction, setIsVerifyingAction] = useState<string | null>(null);

  const handleAutoAttachPhoto = (issue: Issue) => {
    let presetPhoto = 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=400'; // fallback
    if (issue.type === 'pothole') {
      presetPhoto = 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=400';
    } else if (issue.type === 'broken_streetlight') {
      presetPhoto = 'https://images.unsplash.com/photo-1509024644558-2f5de0f9ca0b?auto=format&fit=crop&q=80&w=400';
    } else if (issue.type === 'water_leak') {
      presetPhoto = 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&q=80&w=400';
    } else if (issue.type === 'waste_problem') {
      presetPhoto = 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=400';
    }
    setVerifyingPhotoMap(prev => ({
      ...prev,
      [issue.id]: presetPhoto
    }));
    showToast('📸 Verification photo simulated!');
  };

  const handleUploadVerificationPhoto = (issueId: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setVerifyingPhotoMap(prev => ({
          ...prev,
          [issueId]: reader.result as string
        }));
        showToast('✓ Custom verification photo attached!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerifyIssue = async (issue: Issue, isConfirm: boolean) => {
    if (isVerifyingAction || !currentUser) return;
    setIsVerifyingAction(issue.id);

    try {
      const issueRef = doc(db, 'issues', issue.id);

      if (issue.status === 'verifying_fix') {
        const currentFixConfirms = issue.fixVerificationConfirms || 0;
        const currentFixRejects = issue.fixVerificationRejects || 0;
        const currentFixConfirmedUsers = issue.fixConfirmedByUserIds || [];
        const currentFixRejectedUsers = issue.fixRejectedByUserIds || [];

        if (currentFixConfirmedUsers.includes(currentUser.id) || currentFixRejectedUsers.includes(currentUser.id)) {
          showToast("⚠️ You have already verified this fix!");
          setIsVerifyingAction(null);
          return;
        }

        let nextFixConfirms = currentFixConfirms;
        let nextFixRejects = currentFixRejects;
        let nextFixConfirmedUsers = [...currentFixConfirmedUsers];
        let nextFixRejectedUsers = [...currentFixRejectedUsers];

        if (isConfirm) {
          nextFixConfirms += 1;
          nextFixConfirmedUsers.push(currentUser.id);
        } else {
          nextFixRejects += 1;
          nextFixRejectedUsers.push(currentUser.id);
        }

        const updateData: any = {
          fixVerificationConfirms: nextFixConfirms,
          fixVerificationRejects: nextFixRejects,
          fixConfirmedByUserIds: nextFixConfirmedUsers,
          fixRejectedByUserIds: nextFixRejectedUsers,
        };

        let statusChangedMsg = "";

        if (isConfirm && nextFixConfirms >= 2) {
          updateData.status = 'resolved';
          updateData.resolvedAt = new Date().toISOString();

          // Award Reporter XP (+25 XP)
          try {
            const reporterRef = doc(db, 'users', issue.reporterId);
            const reporterSnap = await getDoc(reporterRef);
            if (reporterSnap.exists()) {
              const repData = reporterSnap.data();
              let repXp = (repData.xp || 0) + 25;
              let repLevel = repData.level || 1;
              if (repXp >= 100) {
                repXp -= 100;
                repLevel += 1;
              }
              await updateDoc(reporterRef, { xp: repXp, level: repLevel });
            }
          } catch (err) {
            console.error('Error awarding reporter XP:', err);
          }

          // Raise neighborhood health score for that category
          if (selectedNeighborhood) {
            const nRef = doc(db, 'neighborhoods', selectedNeighborhood.id);
            let metricToBoost = 'infrastructure';
            if (issue.type === 'waste_problem') metricToBoost = 'cleanliness';
            if (issue.type === 'broken_streetlight') metricToBoost = 'lighting';
            if (issue.type === 'water_leak') metricToBoost = 'water';
            if (issue.type === 'other') metricToBoost = 'safety';

            const currentMetricValue = selectedNeighborhood.healthScores[metricToBoost as keyof typeof selectedNeighborhood.healthScores] || 70;
            const boostAmount = Math.min(6, 100 - currentMetricValue);

            await updateDoc(nRef, {
              [`healthScores.${metricToBoost}`]: increment(boostAmount),
              communityXP: increment(30),
            });
          }

          // Update Department metrics (Accountability score & resolution rates increase)
          if (issue.departmentId) {
            const deptRef = doc(db, 'departments', issue.departmentId);
            const isFastResolution = issue.slaDeadline && new Date() <= new Date(issue.slaDeadline);
            await updateDoc(deptRef, {
              accountabilityScore: increment(isFastResolution ? 5 : 2),
              resolutionRate: increment(0.01),
            });
          }

          statusChangedMsg = "🎉 Fix confirmed by community! Issue marked as resolved and neighborhood score raised!";
        } else if (!isConfirm && nextFixRejects >= 2) {
          // Reopen and flag for escalation
          updateData.status = 'routed'; // reopen back to routed
          updateData.isEscalated = true; // flag it for escalation
          // Reset fix counts
          updateData.fixVerificationConfirms = 0;
          updateData.fixVerificationRejects = 0;
          updateData.fixConfirmedByUserIds = [];
          updateData.fixRejectedByUserIds = [];
          // Remove photos so the worker must submit new proofs
          updateData.beforePhoto = null;
          updateData.duringPhoto = null;
          updateData.afterPhoto = null;

          statusChangedMsg = "⚠️ Fix rejected by community! Issue reopened and escalated to department supervisor.";
        } else {
          statusChangedMsg = isConfirm
            ? `✓ Fix confirmation registered (${nextFixConfirms}/2).`
            : `✗ Fix rejection registered (${nextFixRejects}/2).`;
        }

        await updateDoc(issueRef, updateData);

        // Award Verifier (current user) with exactly +5 XP
        try {
          const verifierRef = doc(db, 'users', currentUser.id);
          const verifierXpReward = 5;
          let verifierNewXp = currentUser.xp + verifierXpReward;
          let verifierNewLevel = currentUser.level;
          if (verifierNewXp >= 100) {
            verifierNewXp = verifierNewXp - 100;
            verifierNewLevel += 1;
          }
          await updateDoc(verifierRef, {
            xp: verifierNewXp,
            level: verifierNewLevel,
          });
          onUserUpdate({
            xp: verifierNewXp,
            level: verifierNewLevel,
          });
          statusChangedMsg += ` (+5 Verifier XP Registered)`;
        } catch (userErr) {
          console.error('Failed to award verifier XP:', userErr);
        }

        showToast(statusChangedMsg);
        await onRefreshData();
        setIsVerifyingAction(null);
        return;
      }

      const currentConfirms = issue.confirmCount || 0;
      const currentRejects = issue.rejectCount || 0;
      const currentConfirmedUsers = issue.confirmedByUserIds || [];
      const currentRejectedUsers = issue.rejectedByUserIds || [];
      const currentPhotos = issue.verificationPhotos || [];
      
      if (currentConfirmedUsers.includes(currentUser.id) || currentRejectedUsers.includes(currentUser.id)) {
        showToast("⚠️ You have already verified this issue!");
        setIsVerifyingAction(null);
        return;
      }

      let nextConfirms = currentConfirms;
      let nextRejects = currentRejects;
      let nextConfirmedUsers = [...currentConfirmedUsers];
      let nextRejectedUsers = [...currentRejectedUsers];
      let nextPhotos = [...currentPhotos];

      const attachedPhoto = verifyingPhotoMap[issue.id];

      if (isConfirm) {
        nextConfirms += 1;
        nextConfirmedUsers.push(currentUser.id);
        if (attachedPhoto) {
          nextPhotos.push(attachedPhoto);
        }
      } else {
        nextRejects += 1;
        nextRejectedUsers.push(currentUser.id);
      }

      const updateData: any = {
        confirmCount: nextConfirms,
        rejectCount: nextRejects,
        confirmedByUserIds: nextConfirmedUsers,
        rejectedByUserIds: nextRejectedUsers,
        verificationPhotos: nextPhotos,
      };

      let statusChangedMsg = "";

      if (isConfirm && nextConfirms >= 2) {
        updateData.status = 'routed';
        
        const initialDeptId = 
          issue.type === 'pothole' ? 'roads' : 
          issue.type === 'broken_streetlight' ? 'electrical_lighting' : 
          issue.type === 'water_leak' ? 'water_drainage' : 
          issue.type === 'waste_problem' ? 'sanitation' : 'roads';

        let assignedDeptId = initialDeptId;
        let routingExplanation = "Routed automatically based on issue category presets.";
        
        try {
          const routeRes = await fetch('/api/gemini/route-issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: issue.type,
              title: issue.title,
              description: issue.description,
            })
          });
          if (routeRes.ok) {
            const routeData = await routeRes.json();
            if (routeData.departmentId) {
              assignedDeptId = routeData.departmentId;
              routingExplanation = routeData.explanation;
            }
          }
        } catch (routeErr) {
          console.error('Failed to perform smart routing with Gemini:', routeErr);
        }

        // Fetch predictive insights from Gemini using other historical issues in the same neighborhood
        const historicalIssuesInNeighborhood = issues.filter(
          (h) => h.neighborhoodId === issue.neighborhoodId && h.id !== issue.id
        );

        try {
          const insightRes = await fetch('/api/gemini/predictive-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              newIssue: {
                id: issue.id,
                title: issue.title,
                type: issue.type,
                description: issue.description,
                location: issue.location,
                reportedAt: issue.reportedAt,
              },
              historicalIssues: historicalIssuesInNeighborhood.map((h) => ({
                id: h.id,
                title: h.title,
                type: h.type,
                location: h.location,
                reportedAt: h.reportedAt,
              })),
            })
          });
          if (insightRes.ok) {
            const insightData = await insightRes.json();
            if (insightData && typeof insightData.riskScore === 'number') {
              updateData.predictiveInsight = insightData;
            }
          }
        } catch (insightErr) {
          console.error('Failed to calculate predictive insights with Gemini:', insightErr);
        }

        const slaOffsetMs = 3 * 60 * 1000; // 3 minutes demo SLA
        const slaDeadline = new Date(Date.now() + slaOffsetMs).toISOString();

        updateData.departmentId = assignedDeptId;
        updateData.slaDeadline = slaDeadline;
        updateData.routingExplanation = routingExplanation;

        try {
          const reporterRef = doc(db, 'users', issue.reporterId);
          await updateDoc(reporterRef, {
            trustScore: increment(3)
          });
          if (issue.reporterId === currentUser.id) {
            onUserUpdate({
              trustScore: currentUser.trustScore + 3
            });
          }
        } catch (userErr) {
          console.error('Failed to reward reporter trustScore:', userErr);
        }

        statusChangedMsg = "🎉 Report verified by community! Smart routed with active SLA.";
      } else if (!isConfirm && nextRejects >= 2) {
        updateData.status = 'disputed';

        try {
          const reporterRef = doc(db, 'users', issue.reporterId);
          await updateDoc(reporterRef, {
            trustScore: increment(-5)
          });
          if (issue.reporterId === currentUser.id) {
            onUserUpdate({
              trustScore: currentUser.trustScore - 5
            });
          }
        } catch (userErr) {
          console.error('Failed to penalize reporter trustScore:', userErr);
        }

        statusChangedMsg = "⚠️ Report disputed by community! Reporter trust score penalized.";
      } else {
        statusChangedMsg = isConfirm 
          ? `✓ Confirmation registered (${nextConfirms}/2).` 
          : `✗ Rejection registered (${nextRejects}/2).`;
      }

      await updateDoc(issueRef, updateData);
      
      // Reward Verifying User with exactly +5 XP as per rules
      try {
        const verifierRef = doc(db, 'users', currentUser.id);
        const verifierXpReward = 5;
        let verifierNewXp = currentUser.xp + verifierXpReward;
        let verifierNewLevel = currentUser.level;
        if (verifierNewXp >= 100) {
          verifierNewXp = verifierNewXp - 100;
          verifierNewLevel += 1;
        }
        await updateDoc(verifierRef, {
          xp: verifierNewXp,
          level: verifierNewLevel,
        });
        onUserUpdate({
          xp: verifierNewXp,
          level: verifierNewLevel,
        });
        statusChangedMsg += ` (+5 Verifier XP Registered)`;
      } catch (userErr) {
        console.error('Failed to award verifier XP:', userErr);
      }
      
      setVerifyingPhotoMap(prev => {
        const next = { ...prev };
        delete next[issue.id];
        return next;
      });

      showToast(statusChangedMsg);
      await onRefreshData();
    } catch (err) {
      console.error('Failed to process community verification:', err);
      showToast('❌ Failed to submit verification.');
    } finally {
      setIsVerifyingAction(null);
    }
  };

  // Simulate neighborhood healing - Resolving an issue
  const handleResolveIssue = async (issue: Issue) => {
    if (isUpdatingStatus || !currentUser) return;
    setIsUpdatingStatus(true);
    try {
      const issueRef = doc(db, 'issues', issue.id);
      
      // Update issue status to resolved
      await updateDoc(issueRef, {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
      });

      // Update neighborhood metrics based on the type of issue resolved (Neighborhood Heals!)
      if (selectedNeighborhood) {
        const nRef = doc(db, 'neighborhoods', selectedNeighborhood.id);
        
        // Match issue types to score upgrades
        let metricToBoost = 'infrastructure';
        if (issue.type === 'waste_problem') metricToBoost = 'cleanliness';
        if (issue.type === 'broken_streetlight') metricToBoost = 'lighting';
        if (issue.type === 'water_leak') metricToBoost = 'water';
        if (issue.type === 'other') metricToBoost = 'safety';

        // Cap score boost at 100 max
        const currentMetricValue = selectedNeighborhood.healthScores[metricToBoost as keyof typeof selectedNeighborhood.healthScores] || 70;
        const boostAmount = Math.min(6, 100 - currentMetricValue);

        await updateDoc(nRef, {
          [`healthScores.${metricToBoost}`]: increment(boostAmount),
          communityXP: increment(30),
        });
      }

      // Update Department metrics (Accountability score & resolution rates increase)
      if (issue.departmentId) {
        const deptRef = doc(db, 'departments', issue.departmentId);
        const isFastResolution = issue.slaDeadline && new Date() <= new Date(issue.slaDeadline);
        await updateDoc(deptRef, {
          accountabilityScore: increment(isFastResolution ? 5 : 2),
          resolutionRate: increment(0.01),
        });
      }

      // Reward User with XP & Trust Score
      const userRef = doc(db, 'users', currentUser.id);
      const xpReward = 25;
      const trustReward = 2;
      
      let newXP = currentUser.xp + xpReward;
      let newLevel = currentUser.level;
      // Simple leveling algorithm - every 100 XP = 1 level
      if (newXP >= 100) {
        newXP = newXP - 100;
        newLevel += 1;
      }

      await updateDoc(userRef, {
        xp: newXP,
        level: newLevel,
        trustScore: increment(trustReward),
        badges: currentUser.badges.includes('first_responder') 
          ? currentUser.badges 
          : [...currentUser.badges, 'first_responder'],
      });

      onUserUpdate({
        xp: newXP,
        level: newLevel,
        trustScore: currentUser.trustScore + trustReward,
        badges: currentUser.badges.includes('first_responder') 
          ? currentUser.badges 
          : [...currentUser.badges, 'first_responder'],
      });

      showToast(`✨ Issue Fixed! Neighborhood Healed (+30 Comm. XP, +25 Personal XP)`);
      await onRefreshData();
      setSelectedIssueId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `issues/${issue.id}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Dynamic communityLevel and theme calculation
  const communityLevelDetails = useMemo(() => {
    if (!selectedNeighborhood) return null;
    const xp = selectedNeighborhood.communityXP || 0;
    
    // Every 300 XP = 1 communityLevel
    const computedLevel = Math.floor(xp / 300) + 1;
    
    // Theme matching with Mediterranean, cozy descriptions
    let themeName = "Sandy Brick Cobble";
    let themeBadgeColor = "from-amber-600 to-amber-700";
    let themeDescription = "Charming warm brick walkways, sandy corners, and basic solar lantern posts.";
    
    if (computedLevel === 2) {
      themeName = "Biophilic Sea Garden";
      themeBadgeColor = "from-emerald-500 to-teal-600";
      themeDescription = "Vibrant maritime flower pots, planted palm rows, and lush coastal pocket parks!";
    } else if (computedLevel === 3) {
      themeName = "Dusk Lantern Pier";
      themeBadgeColor = "from-indigo-500 to-pink-600";
      themeDescription = "Ambient golden light arches, harbor bells, and twilight-sensing walkway indicators.";
    } else if (computedLevel === 4) {
      themeName = "Solar Punk Eco-Haven";
      themeBadgeColor = "from-yellow-500 to-emerald-600";
      themeDescription = "Wave-powered electric grids, vertical lemon tree trellises, and recycled brick water catchments.";
    } else if (computedLevel >= 5) {
      themeName = "Golden Coastal Renaissance";
      themeBadgeColor = "from-amber-500 to-rose-600";
      themeDescription = "Exquisite restoration of historic clock towers, marble water fountains, and pristine terra-cotta paths.";
    }
    
    return {
      level: computedLevel,
      themeName,
      themeBadgeColor,
      themeDescription,
      xpTowardsNext: xp % 300,
    };
  }, [selectedNeighborhood]);

  return (
    <div className="relative w-full h-[calc(100vh-80px)] md:h-screen overflow-hidden bg-[#faf6eb]">
      {/* Toast Alert / Popup */}
      {toastMessage && (
        <div className="absolute bottom-32 left-4 z-50 bg-[#7c2d12] text-amber-50 text-xs px-5 py-3 rounded-2xl shadow-xl border-2 border-amber-300 font-sans font-black flex items-center gap-2.5 animate-bounce-gentle">
          <span className="text-sm">✨</span>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-amber-200 hover:text-white font-black text-sm ml-2">×</button>
        </div>
      )}

      {/* Edge-to-Edge Map Layer */}
      <div className="absolute inset-0 w-full h-full z-0">
        <MapComponent
          neighborhoods={computedNeighborhoods}
          selectedNeighborhood={selectedNeighborhood}
          issues={issues}
          selectedIssueId={selectedIssueId}
          onSelectIssue={(issue) => {
            setSelectedIssueId(issue.id);
          }}
          radiusFilter={radiusFilter}
          activeTypeFilter={activeTypeFilter}
          activeStatusFilter={activeStatusFilter}
          markerCreationMode={false}
          tempMarker={null}
          onMapClick={() => {
            setSelectedIssueId(null);
            setSelectedNeighborhoodId(null);
          }}
          currentUser={currentUser}
          onSelectNeighborhood={setSelectedNeighborhoodId}
        />
      </div>

      {/* FLOATING HUD ELEMENT 1: Compact XP/Level Pill Top-Left */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setActiveTab('profile')}
        className="absolute top-4 left-4 z-30 bg-[#fffdf9] border-3 border-[#ebdcb9] rounded-2xl shadow-lg px-3.5 py-2 flex items-center gap-2.5 cursor-pointer hover:border-amber-400 hover:scale-102 transition-all"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl border-2 border-white flex items-center justify-center text-white font-display font-black text-xs shadow-md">
          Lv {currentUser?.level ?? 1}
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-black uppercase text-amber-900 tracking-wider font-display">CIVIC LEVEL</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-16 bg-amber-100 h-2 rounded-full border border-[#ebdcb9]/60 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${currentUser?.xp ?? 0}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 10 }}
              />
            </div>
            <span className="text-[9px] font-black text-amber-950 font-display">{(currentUser?.xp ?? 0)}%</span>
          </div>
        </div>
      </motion.div>
 
      {/* FLOATING HUD ELEMENT 2: Streak Counter Top-Right */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setActiveTab('profile')}
        className="absolute top-4 right-4 z-30 bg-[#fffdf9] border-3 border-[#ebdcb9] rounded-2xl shadow-lg px-3.5 py-2 flex items-center gap-2 cursor-pointer hover:border-amber-400 hover:scale-102 transition-all"
      >
        <span className="text-lg animate-pulse-gentle">🔥</span>
        <div className="flex flex-col">
          <span className="text-[8px] font-black uppercase text-orange-600 tracking-wider font-display">STREAK</span>
          <span className="text-xs font-black text-amber-950 font-display tracking-wide">
            {currentUser?.badges.includes('daily_streak') ? '3 DAYS' : '1 DAY'}
          </span>
        </div>
      </motion.div>
 
      {/* FLOATING HUD ELEMENT 3: Sector Switcher (Responsive: stacked on mobile, centered on desktop) */}
      <div className="absolute top-20 sm:top-16 left-4 sm:left-1/2 sm:-translate-x-1/2 z-20 bg-[#fffdf9] border-2 border-[#ebdcb9] px-2.5 py-1 rounded-full shadow-lg flex gap-1 items-center">
        {computedNeighborhoods.map((nb) => (
          <button
            key={nb.id}
            onClick={() => {
              if (selectedNeighborhoodId === nb.id) {
                setSelectedNeighborhoodId(null);
              } else {
                setSelectedNeighborhoodId(nb.id);
                setSelectedIssueId(null);
              }
            }}
            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              selectedNeighborhoodId === nb.id
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-amber-900/60 hover:text-amber-950 hover:bg-amber-50/50'
            }`}
          >
            {nb.id === 'mission_district' ? '🧱 Valencia' : '🌊 Harbor'}
          </button>
        ))}
      </div>
 
      {/* FLOATING HUD ELEMENT 4: Interactive Filter Button (Floating Right-Middle - Responsive) */}
      <div className="absolute top-20 sm:top-28 right-4 z-20 flex flex-col items-end gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMapFilters(!showMapFilters)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-lg transition-all cursor-pointer ${
            showMapFilters 
              ? 'bg-amber-500 text-white border-amber-600' 
              : 'bg-white text-amber-900 border-[#ebdcb9] hover:bg-amber-50'
          }`}
        >
          <Sliders className="w-4 h-4" />
        </motion.button>

        <button 
          onClick={onRefreshData}
          className="w-9 h-9 rounded-xl bg-white border-2 border-[#ebdcb9] text-amber-900 hover:bg-amber-50 shadow-lg flex items-center justify-center cursor-pointer"
          title="Refresh Map Quests"
        >
          <RefreshCw className="w-4 h-4 animate-pulse-gentle" />
        </button>

        {/* Filters Drawer Panel overlay on Map */}
        <AnimatePresence>
          {showMapFilters && (
            <motion.div
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              className="bg-white/95 border-3 border-[#ebdcb9] rounded-2xl p-4 shadow-2xl max-w-xs text-amber-950 font-sans font-bold"
            >
              <div className="flex justify-between items-center border-b border-amber-100 pb-1.5 mb-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1">
                  🗺️ MAP FILTER RADAR
                </span>
                <button onClick={() => setShowMapFilters(false)} className="text-amber-900/50 hover:text-amber-900">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {/* Distance Filter */}
                <div>
                  <label className="text-[9px] font-black uppercase text-amber-900 block mb-1">Spatial Radius Filter</label>
                  <select
                    value={radiusFilter || ''}
                    onChange={(e) => setRadiusFilter(e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full bg-amber-50/50 border border-[#ebdcb9] text-[10px] rounded-lg px-2.5 py-1 font-bold text-amber-950 outline-none"
                  >
                    <option value="">Whole Sector Boundary</option>
                    <option value="0.5">Within 500m (Hyperlocal)</option>
                    <option value="1.0">Within 1.0 km</option>
                    <option value="1.5">Within 1.5 km</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="text-[9px] font-black uppercase text-amber-900 block mb-1">Quest Category</label>
                  <select
                    value={activeTypeFilter}
                    onChange={(e) => setActiveTypeFilter(e.target.value as any)}
                    className="w-full bg-amber-50/50 border border-[#ebdcb9] text-[10px] rounded-lg px-2.5 py-1 font-bold text-amber-950 outline-none"
                  >
                    <option value="all">All Hazards</option>
                    <option value="pothole">🕳️ Potholes / Crumbling Path</option>
                    <option value="broken_streetlight">💡 Sleppy Lamps / Dark Areas</option>
                    <option value="water_leak">💧 Water Leakages</option>
                    <option value="waste_problem">🟢 Garbage & Litter Problems</option>
                    <option value="other">⭐ Other Community Needs</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-[9px] font-black uppercase text-amber-900 block mb-1">Quest Status</label>
                  <select
                    value={activeStatusFilter}
                    onChange={(e) => setActiveStatusFilter(e.target.value as any)}
                    className="w-full bg-amber-50/50 border border-[#ebdcb9] text-[10px] rounded-lg px-2.5 py-1 font-bold text-amber-950 outline-none"
                  >
                    <option value="all">All Quests</option>
                    <option value="pending">📌 Reported</option>
                    <option value="verifying">🔍 Verifying</option>
                    <option value="routed">📦 Assigned</option>
                    <option value="in_progress">🛠️ In Progress</option>
                    <option value="resolved">🌟 Healed</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FLOATING HUD ELEMENT 5: Interactive Slide-Up Card (Bottom Center) */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 w-11/12 max-w-md pointer-events-none">
        <AnimatePresence mode="wait">
          {selectedIssue && (
            /* --- ISSUE DETAILED INSPECTOR CARD --- */
            <motion.div
              key="issue-card"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 100 }}
              className="bg-[#fffdf9] border-4 border-[#ebdcb9] rounded-[28px] shadow-2xl p-5 max-h-[60vh] overflow-y-auto pointer-events-auto select-none space-y-4"
            >
              {/* AI Coprocessor Active Loading Screen Overlay */}
              {aiClassificationStep !== -1 && (
                <div className="absolute inset-0 bg-[#fdfbf7]/98 z-30 flex flex-col justify-center items-center p-6 space-y-4 rounded-3xl animate-fadeIn">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center animate-pulse relative">
                    <Brain className="w-7 h-7 text-amber-900 animate-bounce" />
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                    </span>
                  </div>
                  
                  <div className="text-center space-y-1 max-w-xs">
                    <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest bg-orange-50 px-2 rounded-full border border-orange-200">
                      Gemini Coprocessor Active
                    </span>
                    <h4 className="text-xs font-black text-amber-950">Analyzing Quest & Routing...</h4>
                  </div>

                  <div className="w-full max-w-xs space-y-2 pt-1">
                    <div className="flex items-center gap-2.5 text-[10px] font-bold">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${
                        aiClassificationStep > 0 ? 'bg-emerald-500 text-white font-bold' : 'bg-amber-100 text-amber-800 animate-pulse'
                      }`}>
                        {aiClassificationStep > 0 ? '✓' : '1'}
                      </div>
                      <span className={aiClassificationStep === 0 ? 'text-amber-950 font-black' : 'text-slate-400'}>
                        Pixel-Analyzing photo details...
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 text-[10px] font-bold">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${
                        aiClassificationStep > 1 ? 'bg-emerald-500 text-white font-bold' : aiClassificationStep === 1 ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {aiClassificationStep > 1 ? '✓' : '2'}
                      </div>
                      <span className={aiClassificationStep === 1 ? 'text-amber-950 font-black' : 'text-slate-400'}>
                        Calculating Sector Grid GPS...
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 text-[10px] font-bold">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${
                        aiClassificationStep > 2 ? 'bg-emerald-500 text-white font-bold' : aiClassificationStep === 2 ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {aiClassificationStep > 2 ? '✓' : '3'}
                      </div>
                      <span className={aiClassificationStep === 2 ? 'text-amber-950 font-black' : 'text-slate-400'}>
                        Routing to responsible Department...
                      </span>
                    </div>
                  </div>

                  <div className="w-full max-w-xs h-1.5 bg-amber-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-700 ease-out rounded-full" 
                      style={{ width: `${(aiClassificationStep + 1) * 33}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Title & Category Header */}
              <div className="flex justify-between items-start border-b-2 border-amber-50 pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[9px] font-black rounded-full uppercase border border-orange-200">
                      {selectedIssue.type.replace('_', ' ')}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-black">
                      ★ {selectedIssue.reporterTrustScore ?? 75}% Trust
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-amber-950 mt-1 leading-snug">{selectedIssue.title}</h4>
                  <p className="text-amber-800/50 text-[9px] font-mono font-bold uppercase tracking-wider">
                    REPORTER: {selectedIssue.reporterName || 'Civic Hero'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedIssueId(null)}
                  className="w-7 h-7 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-850 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Media Photo */}
              {selectedIssue.mediaUrl && (
                <div className="rounded-2xl overflow-hidden border-2 border-[#ebdcb9] max-h-36 shadow-inner relative group">
                  <img
                    src={selectedIssue.mediaUrl}
                    alt={selectedIssue.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Description */}
              <p className="text-xs text-amber-950/80 font-bold leading-relaxed bg-[#faf6eb]/50 p-2.5 rounded-xl border border-amber-100">
                {selectedIssue.description}
              </p>

              {/* Quick Metadata Block */}
              <div className="space-y-2 bg-amber-50/40 p-3 rounded-2xl border border-amber-100 text-[10px] font-bold">
                <div className="flex justify-between items-center text-amber-900">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-700" /> Location Sector:
                  </span>
                  <span>{selectedNeighborhood?.name}</span>
                </div>

                <div className="flex justify-between items-center text-amber-900">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-amber-700" /> Quest Status:
                  </span>
                  <span
                    className="font-black uppercase tracking-wider text-[9px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-100"
                    style={{
                      color: 
                        selectedIssue.status === 'resolved' ? '#059669' :
                        selectedIssue.status === 'disputed' ? '#ef4444' :
                        selectedIssue.status === 'verifying' ? '#6366f1' :
                        '#d97706',
                    }}
                  >
                    {selectedIssue.status.replace('_', ' ')}
                  </span>
                </div>

                {selectedIssueDepartment && (
                  <div className="border-t border-amber-200/40 pt-2.5 mt-1 space-y-1">
                    <p className="text-[#7c2d12] font-black">{selectedIssueDepartment.name}</p>
                    <div className="flex justify-between text-amber-900/60 text-[9px]">
                      <span>Accountability: {selectedIssueDepartment.accountabilityScore}%</span>
                      <span>Resolution Rate: {Math.round(selectedIssueDepartment.resolutionRate * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* SLA / Escalation Status */}
              {slaInfo && (
                <div className={`p-3 rounded-2xl border flex items-center justify-between text-[10px] font-bold shadow-inner ${
                  slaInfo.breached 
                    ? 'bg-rose-50 border-rose-200 text-rose-800' 
                    : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                }`}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 animate-pulse-gentle" />
                    <div>
                      <span className="font-extrabold uppercase block text-[8px] tracking-widest">{slaInfo.label}</span>
                      <span className="text-[10px]">{slaInfo.breached ? slaInfo.details : slaInfo.timeString}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* WORKER ACTIONS FOR THE ACTIVE ISSUE */}
              {selectedIssue.status !== 'resolved' && (
                <div className="pt-2 border-t border-amber-50">
                  <button
                    onClick={() => handleResolveIssue(selectedIssue)}
                    disabled={isUpdatingStatus}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 border-b-4 border-emerald-700 active:border-b-0 text-white text-xs font-black rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    🚀 SIMULATE HEALING (RESOLVE QUEST)
                  </button>
                  <p className="text-[9px] text-center text-slate-400 mt-1.5">
                    Clicking resolve simulates city crew repairing the hazard and uploads verification proof.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SECTOR DETAIL BOTTOM SHEET */}
      <AnimatePresence>
        {!selectedIssue && selectedNeighborhood && (
          <motion.div
            key="sector-bottom-sheet"
            drag="y"
            dragConstraints={{ top: 0, bottom: 400 }}
            dragElastic={0.15}
            onDragEnd={(event, info) => {
              if (info.offset.y > 100) {
                setSelectedNeighborhoodId(null);
              }
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 22, stiffness: 150 }}
            className="absolute bottom-0 left-0 right-0 z-30 bg-[#fffdf9] border-t-4 border-x-4 border-[#ebdcb9] rounded-t-[32px] shadow-2xl h-[55vh] flex flex-col pointer-events-auto select-none"
          >
            {/* Drag Handle Container */}
            <div className="w-full flex justify-center py-3 bg-transparent select-none cursor-grab active:cursor-grabbing flex-shrink-0 border-b border-amber-50">
              <div className="w-16 h-1.5 bg-amber-200/80 rounded-full" />
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Header Title with Avatar Config Level Theme */}
              <div className="flex justify-between items-center border-b-2 border-amber-50 pb-2.5">
                <div className="space-y-0.5">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-black rounded-full uppercase tracking-wider font-display">
                    🗺️ Expedition Sector Area
                  </span>
                  <h3 className="text-lg font-display font-black text-[#7c2d12] tracking-tight">{selectedNeighborhood.name} Sector</h3>
                </div>
                <button
                  onClick={() => setSelectedNeighborhoodId(null)}
                  className="w-8 h-8 rounded-full bg-amber-100/80 hover:bg-amber-200 border-2 border-amber-300 text-amber-900 flex items-center justify-center cursor-pointer border-b-3 border-amber-400 active:translate-y-[1.5px] active:border-b-0 transition-all"
                >
                  <X className="w-4.5 h-4.5 stroke-[2.5]" />
                </button>
              </div>

              {/* Highlighted Microgrid Vitality Focal Card */}
              <div className="bg-[#faf6eb] border-3 border-[#ebdcb9] rounded-3xl p-5 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-100/60 border border-emerald-200/50 rounded-full text-[8px] font-black text-emerald-800 uppercase tracking-widest font-display animate-pulse-gentle">
                  Active Microgrid
                </div>
                <NeighborhoodBlob health={overallHealthScore} />
              </div>

              {/* Theme unlocked card */}
              {communityLevelDetails && (
                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3 text-amber-950">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">🏞️</span>
                    <div>
                      <span className="text-[8px] font-bold text-amber-800 uppercase block tracking-wider font-display">Theme &bull; Lv {communityLevelDetails.level}</span>
                      <span className="text-xs font-black text-amber-950 mt-0.5 font-display">{communityLevelDetails.themeName}</span>
                    </div>
                  </div>
                  <p className="text-[10px] leading-relaxed font-semibold text-amber-900/80 mt-1">
                    {communityLevelDetails.themeDescription}
                  </p>
                </div>
              )}

              {/* Individual Wellness Pillar Badges with Progress Bars */}
              <div className="space-y-2">
                <span className="text-[9px] font-black uppercase text-amber-900 tracking-wider font-display">Sector Wellness Index</span>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-amber-950">
                  
                  {/* Infrastructure */}
                  <div className="p-2.5 bg-amber-50/30 rounded-xl border border-[#ebdcb9]/40 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="text-amber-800 flex items-center gap-1 font-display"><Shield className="w-3 h-3 text-amber-700" /> Build</span>
                      <span className="font-display">{selectedNeighborhood.healthScores.infrastructure}%</span>
                    </div>
                    <div className="h-1.5 bg-amber-100 rounded-full mt-2.5 overflow-hidden">
                      <motion.div 
                        className="h-full bg-emerald-500 rounded-full" 
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedNeighborhood.healthScores.infrastructure}%` }}
                        transition={{ type: 'spring', stiffness: 60, damping: 12, delay: 0.1 }}
                      />
                    </div>
                  </div>

                  {/* Cleanliness */}
                  <div className="p-2.5 bg-amber-50/30 rounded-xl border border-[#ebdcb9]/40 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="text-amber-800 flex items-center gap-1 font-display"><Trash2 className="w-3 h-3 text-amber-700" /> Clean</span>
                      <span className="font-display">{selectedNeighborhood.healthScores.cleanliness}%</span>
                    </div>
                    <div className="h-1.5 bg-amber-100 rounded-full mt-2.5 overflow-hidden">
                      <motion.div 
                        className="h-full bg-amber-500 rounded-full" 
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedNeighborhood.healthScores.cleanliness}%` }}
                        transition={{ type: 'spring', stiffness: 60, damping: 12, delay: 0.2 }}
                      />
                    </div>
                  </div>

                  {/* Lighting */}
                  <div className="p-2.5 bg-amber-50/30 rounded-xl border border-[#ebdcb9]/40 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="text-amber-800 flex items-center gap-1 font-display"><Lightbulb className="w-3 h-3 text-amber-700" /> Light</span>
                      <span className="font-display">{selectedNeighborhood.healthScores.lighting}%</span>
                    </div>
                    <div className="h-1.5 bg-amber-100 rounded-full mt-2.5 overflow-hidden">
                      <motion.div 
                        className="h-full bg-indigo-500 rounded-full" 
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedNeighborhood.healthScores.lighting}%` }}
                        transition={{ type: 'spring', stiffness: 60, damping: 12, delay: 0.3 }}
                      />
                    </div>
                  </div>

                  {/* Water */}
                  <div className="p-2.5 bg-amber-50/30 rounded-xl border border-[#ebdcb9]/40 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="text-amber-800 flex items-center gap-1 font-display"><Droplet className="w-3 h-3 text-amber-700" /> Water</span>
                      <span className="font-display">{selectedNeighborhood.healthScores.water}%</span>
                    </div>
                    <div className="h-1.5 bg-amber-100 rounded-full mt-2.5 overflow-hidden">
                      <motion.div 
                        className="h-full bg-sky-500 rounded-full" 
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedNeighborhood.healthScores.water}%` }}
                        transition={{ type: 'spring', stiffness: 60, damping: 12, delay: 0.4 }}
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* Cooperative Active Verification Quests inside Card */}
              <div className="pt-2 border-t border-amber-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-[#7c2d12] uppercase tracking-wider flex items-center gap-1">
                    🔍 SECTOR VERIFICATION HUB
                  </span>
                  <span className="text-[9px] bg-[#7c2d12] text-amber-50 px-2 py-0.5 rounded-full font-black">
                    {issuesToVerify.length} pending
                  </span>
                </div>

                {issuesToVerify.length === 0 ? (
                  <div className="text-center py-4 bg-amber-50/30 border border-[#ebdcb9]/30 rounded-2xl text-[10px] font-bold text-amber-800/60 leading-relaxed">
                    🎉 No reports currently need verification here!
                    <span className="block mt-0.5">Keep exploring to scout for city repairs.</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {issuesToVerify.map((issue) => {
                      const isFixVerifying = issue.status === 'verifying_fix';
                      const attachedPhoto = verifyingPhotoMap[issue.id];
                      const hasVoted = (isFixVerifying ? issue.fixConfirmedByUserIds : issue.confirmedByUserIds)?.includes(currentUser?.id || '') || (isFixVerifying ? issue.fixRejectedByUserIds : issue.rejectedByUserIds)?.includes(currentUser?.id || '');

                      return (
                        <div 
                          key={issue.id} 
                          className="p-3 bg-[#faf6eb] border border-amber-200/60 rounded-xl text-amber-950 space-y-2.5 shadow-sm text-[10px]"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-extrabold rounded text-[8px] uppercase">
                                {isFixVerifying ? '🛠️ FIX COMPLETED' : '📌 VERIFY REPORT'}
                              </span>
                              <h5 className="font-extrabold text-[11px] mt-1 leading-snug">{issue.title}</h5>
                              <p className="text-[8px] text-amber-900/60 font-medium">Category: {issue.type.replace('_', ' ')}</p>
                            </div>
                            <button
                              onClick={() => setSelectedIssueId(issue.id)}
                              className="px-2.5 py-1 bg-white border-2 border-amber-200 text-amber-900 font-display font-black text-[9px] rounded-xl hover:bg-amber-50 border-b-4 border-amber-300 hover:border-b-5 hover:-translate-y-[1px] active:translate-y-[3px] active:border-b-0 transition-all duration-100 cursor-pointer"
                            >
                              View Location
                            </button>
                          </div>

                          {/* Verification proof images from city crew */}
                          {isFixVerifying && (issue.beforePhoto || issue.duringPhoto || issue.afterPhoto) && (
                            <div className="space-y-1 bg-white p-2 rounded-lg border border-[#ebdcb9]/50">
                              <span className="text-[8px] font-black text-[#7c2d12] uppercase block">
                                City Crew Repair Proof:
                              </span>
                              <div className="grid grid-cols-3 gap-1">
                                {issue.beforePhoto && (
                                  <div className="space-y-0.5">
                                    <span className="text-[7px] text-center text-slate-400 block font-bold uppercase">Before</span>
                                    <img src={issue.beforePhoto} className="aspect-square w-full object-cover rounded border border-slate-100" />
                                  </div>
                                )}
                                {issue.duringPhoto && (
                                  <div className="space-y-0.5">
                                    <span className="text-[7px] text-center text-slate-400 block font-bold uppercase">During</span>
                                    <img src={issue.duringPhoto} className="aspect-square w-full object-cover rounded border border-slate-100" />
                                  </div>
                                )}
                                {issue.afterPhoto && (
                                  <div className="space-y-0.5">
                                    <span className="text-[7px] text-center text-slate-400 block font-bold uppercase">After</span>
                                    <img src={issue.afterPhoto} className="aspect-square w-full object-cover rounded border border-slate-100 animate-pulse" />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Voting Buttons */}
                          {hasVoted ? (
                            <div className="text-center bg-indigo-50 border border-indigo-150 py-1.5 rounded-xl font-display font-black text-indigo-700">
                              ✓ Verification Vote Cast!
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleVerifyIssue(issue, true)}
                                className="flex-1 py-1.5 bg-emerald-500 text-white font-display font-black rounded-xl hover:bg-emerald-600 border-b-4 border-emerald-700 hover:border-b-5 hover:-translate-y-[1px] active:translate-y-[3px] active:border-b-0 transition-all duration-100 cursor-pointer flex items-center justify-center gap-1"
                              >
                                👍 Confirm
                              </button>
                              <button
                                onClick={() => handleVerifyIssue(issue, false)}
                                className="flex-1 py-1.5 bg-rose-500 text-white font-display font-black rounded-xl hover:bg-rose-600 border-b-4 border-rose-700 hover:border-b-5 hover:-translate-y-[1px] active:translate-y-[3px] active:border-b-0 transition-all duration-100 cursor-pointer flex items-center justify-center gap-1"
                              >
                                👎 Reject
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
