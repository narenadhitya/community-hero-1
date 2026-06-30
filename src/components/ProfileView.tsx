import React, { useState, useEffect, useMemo } from 'react';
import { User, Issue } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Avatar from './Avatar';
import { 
  Award, Shield, User as UserIcon, CheckCircle2, AlertCircle, Save, 
  Settings, Heart, Navigation, Droplet, Trash2, Users, Calendar, Sparkles, Loader2, Compass, Lock
} from 'lucide-react';

interface ProfileViewProps {
  currentUser: User | null;
  issues: Issue[];
  onUserUpdate: (updatedUser: Partial<User>) => void;
}

const SKIN_COLORS = [
  { value: '#f5d0a9', label: 'Beige Sand' },
  { value: '#cca47c', label: 'Golden Clay' },
  { value: '#ffd1dc', label: 'Peach Blossom' },
  { value: '#8d5524', label: 'Terracotta Brown' },
  { value: '#ffdca3', label: 'Sunset Ochre' },
];

const HAIR_STYLES = [
  { value: 'curly', label: 'Curly Coils' },
  { value: 'fringe', label: 'Fringe Swoop' },
  { value: 'bald', label: 'Smooth Dome' },
  { value: 'spiky', label: 'Adventure Spike' },
  { value: 'executive', label: 'Classic Wave' },
  // Premium custom items
  { value: 'explore-hat', label: '🤠 Safari Explorer Hat' },
  { value: 'captain-cap', label: '⚓ Sailor Captain Cap' },
  { value: 'crown', label: '👑 Sparkly Golden Crown' },
];

const ACCESSORIES = [
  { value: 'none', label: 'No Extra' },
  { value: 'badge', label: '⭐ Gold Star Badge' },
  { value: 'hard-hat', label: '👷 Guild Hard-Hat' },
  { value: 'glasses', label: '👓 Classic Frames' },
  { value: 'goggles', label: '🥽 GIS Goggles' },
  // Premium custom items
  { value: 'cozy-backpack', label: '🎒 Explorer Backpack' },
  { value: 'binoculars', label: '🔭 Neck Binoculars' },
];

const SHIRT_COLORS = [
  { value: '#059669', label: 'Civic Mint' },
  { value: '#d97706', label: 'Ochre Amber' },
  { value: '#e11d48', label: 'Bougainvillea Red' },
  { value: '#38bdf8', label: 'Ocean Sky Blue' },
  // Premium outfits
  { value: 'stripes', label: '👕 Mediterranean Stripes' },
  { value: 'coat', label: '🧥 Adventure Utility Coat' },
];

export default function ProfileView({ currentUser, issues, onUserUpdate }: ProfileViewProps) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState({
    skin: '#f5d0a9',
    hair: 'short',
    shirt: '#059669',
    accessory: 'glasses',
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form state from user object
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      try {
        const parsedAvatar = JSON.parse(currentUser.avatarConfig);
        setAvatar(parsedAvatar);
      } catch (e) {
        console.warn('Could not parse avatar configuration, using default.');
      }
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  // Filter issues reported by current user
  const myReports = issues.filter((issue) => issue.reporterId === currentUser.id);

  // Dynamic 8-badge calculations
  const computedBadges = useMemo(() => {
    const myVerifications = issues.filter(
      (i) => i.confirmedByUserIds?.includes(currentUser.id) || i.rejectedByUserIds?.includes(currentUser.id)
    );
    
    const roadActions = issues.filter(
      (i) => i.type === 'pothole' && (i.reporterId === currentUser.id || i.confirmedByUserIds?.includes(currentUser.id) || i.rejectedByUserIds?.includes(currentUser.id))
    );
    const waterActions = issues.filter(
      (i) => i.type === 'water_leak' && (i.reporterId === currentUser.id || i.confirmedByUserIds?.includes(currentUser.id) || i.rejectedByUserIds?.includes(currentUser.id))
    );
    const wasteActions = issues.filter(
      (i) => i.type === 'waste_problem' && (i.reporterId === currentUser.id || i.confirmedByUserIds?.includes(currentUser.id) || i.rejectedByUserIds?.includes(currentUser.id))
    );
    
    const attendedEventsCount = currentUser.attendedEvents?.length || 0;
    
    const isWeekend = (dateStr: string) => {
      const day = new Date(dateStr).getDay();
      return day === 0 || day === 6; // Sunday = 0, Saturday = 6
    };
    const weekendActionsCount = issues.filter(
      (i) => isWeekend(i.reportedAt) && (i.reporterId === currentUser.id || i.confirmedByUserIds?.includes(currentUser.id) || i.rejectedByUserIds?.includes(currentUser.id))
    ).length + (currentUser.attendedEvents ? currentUser.attendedEvents.length : 0);

    const totalContributions = myReports.length + myVerifications.length;

    const badgesList = [
      {
        id: 'first_report',
        name: 'First Expedition',
        desc: 'Planted your first quest flag on the map.',
        icon: AlertCircle,
        color: 'text-orange-700 border-orange-200 bg-orange-50',
        current: myReports.length,
        target: 1,
        unlocked: myReports.length >= 1,
      },
      {
        id: 'road_guardian',
        name: 'Cobblestone Guardian',
        desc: 'Reported or verified 3 roads or pothole issues.',
        icon: Navigation,
        color: 'text-amber-700 border-amber-200 bg-amber-50',
        current: roadActions.length,
        target: 3,
        unlocked: roadActions.length >= 3,
      },
      {
        id: 'water_protector',
        name: 'Water Protector',
        desc: 'Reported or verified 3 water leak issues.',
        icon: Droplet,
        color: 'text-sky-700 border-sky-200 bg-sky-50',
        current: waterActions.length,
        target: 3,
        unlocked: waterActions.length >= 3,
      },
      {
        id: 'cleanliness_champion',
        name: 'Cleanliness Champion',
        desc: 'Reported or verified 3 waste or litter problems.',
        icon: Trash2,
        color: 'text-emerald-700 border-emerald-200 bg-emerald-50',
        current: wasteActions.length,
        target: 3,
        unlocked: wasteActions.length >= 3,
      },
      {
        id: 'master_verifier',
        name: 'Sentinel Scholar',
        desc: 'Verified 5 incident reports submitted by other citizens.',
        icon: Shield,
        color: 'text-indigo-700 border-indigo-200 bg-indigo-50',
        current: myVerifications.length,
        target: 5,
        unlocked: myVerifications.length >= 5,
      },
      {
        id: 'community_builder',
        name: 'Piazza Ambassador',
        desc: 'Attended 3 localized community events.',
        icon: Users,
        color: 'text-purple-700 border-purple-200 bg-purple-50',
        current: attendedEventsCount,
        target: 3,
        unlocked: attendedEventsCount >= 3,
      },
      {
        id: 'weekend_volunteer',
        name: 'Twilight Sentinel',
        desc: 'Logged or verified at least 1 issue during Saturday or Sunday.',
        icon: Calendar,
        color: 'text-pink-700 border-pink-200 bg-pink-50',
        current: weekendActionsCount,
        target: 1,
        unlocked: weekendActionsCount >= 1,
      },
      {
        id: 'infrastructure_hero',
        name: 'Grand Archon',
        desc: 'Reached Level 5 or completed 10 total civic contributions.',
        icon: Award,
        color: 'text-rose-700 border-rose-200 bg-rose-50',
        current: totalContributions,
        target: 10,
        unlocked: currentUser.level >= 5 || totalContributions >= 10,
      },
    ];

    return badgesList;
  }, [issues, currentUser]);

  // Auto-synchronize newly unlocked badges to Firestore user profile doc
  useEffect(() => {
    if (!currentUser) return;
    const newlyUnlockedBadgeIds = computedBadges
      .filter((b) => b.unlocked && !currentUser.badges.includes(b.id))
      .map((b) => b.id);

    if (newlyUnlockedBadgeIds.length > 0) {
      const userRef = doc(db, 'users', currentUser.id);
      const updatedBadges = [...currentUser.badges, ...newlyUnlockedBadgeIds];
      
      updateDoc(userRef, {
        badges: updatedBadges,
      }).then(() => {
        onUserUpdate({
          badges: updatedBadges,
        });
      }).catch((err) => {
        console.error('Failed to auto-sync unlocked badges to Firestore:', err);
      });
    }
  }, [computedBadges, currentUser, onUserUpdate]);

  // Handle profile and avatar saving
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      const updatedConfig = JSON.stringify(avatar);

      await updateDoc(userRef, {
        name: name,
        avatarConfig: updatedConfig,
      });

      onUserUpdate({
        name: name,
        avatarConfig: updatedConfig,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.id}`);
    } finally {
      setSaving(false);
    }
  };

  const xpNeeded = 100;
  const xpProgress = (currentUser.xp / xpNeeded) * 100;

  return (
    <div className="space-y-8 pb-36">
      {/* Whimsical Page Header */}
      <div className="space-y-2 border-b-2 border-amber-100 pb-6">
        <span className="px-3 py-1 bg-amber-100 text-amber-800 border-2 border-amber-200 text-xs font-black rounded-full uppercase tracking-wider">
          🧭 Citizens Explorer Registry
        </span>
        <h2 className="text-4xl font-display font-black text-[#7c2d12] tracking-tight">Your Explorer Log</h2>
        <p className="text-amber-800/75 text-sm max-w-lg font-medium leading-relaxed">
          Craft your customized travel avatar, inspect your verified civic trust ratings, and unlock rewards as you restore our sector maps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Avatar Outfit Customizer */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white border-2 border-amber-300 p-5 rounded-[20px] space-y-5 flex flex-col items-center shadow-[0_8px_24px_rgba(124,45,18,0.08)] relative overflow-hidden">
            <div className="absolute top-2 right-2 text-2xl animate-pulse">☀️</div>
            
            {/* Real-time Custom Vector Avatar Wrapper */}
            <div className="w-40 h-40 relative animate-float">
              <Avatar config={avatar} />
            </div>

            {/* Trust Rating Ring */}
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-950 border-2 border-emerald-200 px-4 py-2 rounded-full text-xs font-black shadow-inner">
              <Shield className="w-4 h-4 text-emerald-600 animate-pulse" />
              🛡️ ADVENTURE TRUST: {currentUser.trustScore}%
            </div>

            <form onSubmit={handleSaveProfile} className="w-full space-y-5">
              {/* Name Handle Editor */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-900 uppercase tracking-wider block">Explorer Handle</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#faf6eb]/50 text-amber-950 border-2 border-[#ebdcb9] rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#f97316] focus:bg-white font-bold transition-all"
                  required
                />
              </div>

              {/* Skin tone colors */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-900 uppercase tracking-wider block">Skin Tone</label>
                <div className="flex gap-2 flex-wrap">
                  {SKIN_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setAvatar({ ...avatar, skin: color.value })}
                      className="w-8 h-8 rounded-full border-2 relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95"
                      style={{ 
                        backgroundColor: color.value, 
                        borderColor: avatar.skin === color.value ? '#f97316' : '#ebdcb9',
                      }}
                      title={color.label}
                    >
                      {avatar.skin === color.value && <div className="w-2.5 h-2.5 rounded-full bg-white border border-orange-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Outfit colors */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#7c2d12] uppercase tracking-wider block">Cozy Outfit</label>
                <div className="grid grid-cols-2 gap-2">
                  {SHIRT_COLORS.map((shirt) => (
                    <button
                      key={shirt.value}
                      type="button"
                      onClick={() => setAvatar({ ...avatar, shirt: shirt.value })}
                      className={`px-3 py-2 text-left text-xs font-bold border-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                        avatar.shirt === shirt.value 
                          ? 'border-[#f97316] bg-orange-50 text-orange-950' 
                          : 'border-[#f3e9d4] bg-white hover:bg-amber-50/20 text-amber-900/80'
                      }`}
                    >
                      <span 
                        className="w-3 h-3 rounded-full shrink-0 border border-slate-300" 
                        style={{ backgroundColor: shirt.value.startsWith('#') ? shirt.value : '#38bdf8' }} 
                      />
                      <span className="truncate">{shirt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Explorer Hat options */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#7c2d12] uppercase tracking-wider block">Hats & Coiffure</label>
                <div className="grid grid-cols-2 gap-2">
                  {HAIR_STYLES.map((hairOpt) => (
                    <button
                      key={hairOpt.value}
                      type="button"
                      onClick={() => setAvatar({ ...avatar, hair: hairOpt.value })}
                      className={`px-2 py-1.5 text-left text-xs font-bold border-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                        avatar.hair === hairOpt.value 
                          ? 'border-[#f97316] bg-orange-50 text-orange-950 font-black' 
                          : 'border-[#f3e9d4] bg-white hover:bg-amber-50/20 text-amber-900/80'
                      }`}
                    >
                      <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden border border-[#ebdcb9] bg-[#faf6eb] p-0.5">
                        <Avatar 
                          config={{
                            skin: avatar.skin,
                            hair: hairOpt.value,
                            shirt: avatar.shirt,
                            accessory: 'none'
                          }} 
                        />
                      </div>
                      <span className="truncate text-[11px]">{hairOpt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Explorer Gear */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#7c2d12] uppercase tracking-wider block">Explorer Gear</label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCESSORIES.map((acc) => (
                    <button
                      key={acc.value}
                      type="button"
                      onClick={() => setAvatar({ ...avatar, accessory: acc.value })}
                      className={`px-2 py-1.5 text-left text-xs font-bold border-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                        avatar.accessory === acc.value 
                          ? 'border-[#f97316] bg-orange-50 text-orange-950 font-black' 
                          : 'border-[#f3e9d4] bg-white hover:bg-amber-50/20 text-amber-900/80'
                      }`}
                    >
                      <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden border border-[#ebdcb9] bg-[#faf6eb] p-0.5">
                        <Avatar 
                          config={{
                            skin: avatar.skin,
                            hair: avatar.hair,
                            shirt: avatar.shirt,
                            accessory: acc.value
                          }} 
                        />
                      </div>
                      <span className="truncate text-[11px]">{acc.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Save changes */}
              <button
                type="submit"
                disabled={saving}
                className="w-full h-12 bg-orange-500 hover:bg-orange-400 border-2 border-orange-600 border-b-5 active:border-b-2 active:translate-y-[3px] text-white font-black rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer transition-all duration-100 shadow-md disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Lock In New Look!
                  </>
                )}
              </button>

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 text-xs font-black rounded-xl text-center animate-bounce">
                  ✨ Outfit and Handle Registered Successfully!
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right Column: Experience, Leveling & Quest Seals (Badges) */}
        <div className="md:col-span-7 space-y-6">
          {/* Level Progress Banner */}
          <div className="bg-white border-2 border-amber-300 p-5 rounded-[20px] space-y-4 shadow-[0_8px_24px_rgba(124,45,18,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-amber-800/60 uppercase tracking-wider">Leveling Status</span>
                <h3 className="text-2xl font-display font-black text-[#7c2d12]">Rank {currentUser.level} Sector Pioneer</h3>
              </div>
              <div className="w-14 h-14 bg-amber-100 border-2 border-amber-300 rounded-2xl flex items-center justify-center text-xl font-black text-amber-800 animate-pulse">
                🏅 {currentUser.level}
              </div>
            </div>

            {/* XP Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-amber-900 font-bold">
                <span>Experience Points (XP)</span>
                <span>{currentUser.xp} / {xpNeeded} XP</span>
              </div>
              <div className="h-5 bg-[#faf6eb] border-2 border-[#ebdcb9] rounded-full overflow-hidden p-0.5">
                <div 
                  className="h-full bg-[#f97316] rounded-full transition-all duration-500" 
                  style={{ width: `${xpProgress}%` }} 
                />
              </div>
              <p className="text-[10px] text-amber-800/60 font-semibold italic">
                Gain exactly +25 personal XP when validating fixes, and +5 XP for submitting verifications!
              </p>
            </div>
          </div>

          {/* Gamified 8 Quest Seals Grid */}
          <div className="space-y-4">
            <h4 className="text-lg font-display font-black text-amber-950 flex items-center gap-1.5">
              <span>🌟</span> Quest Seals & Achievements ({computedBadges.filter(b => b.unlocked).length} / 8 Unlocked)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {computedBadges.map((badge) => {
                const Icon = badge.icon;
                const displayCurrent = Math.min(badge.current, badge.target);
                const progressPercent = Math.min(100, (displayCurrent / badge.target) * 100);

                // Setup category colors based on badge theme
                let badgeColorTheme = {
                  border: 'border-amber-300',
                  bg: 'bg-amber-50/50',
                  text: 'text-amber-800',
                  iconBg: 'bg-amber-100 border-amber-300 text-amber-800',
                  glow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                };

                if (badge.id === 'first_report') {
                  badgeColorTheme = {
                    border: 'border-orange-300',
                    bg: 'bg-orange-50/50',
                    text: 'text-orange-800',
                    iconBg: 'bg-orange-100 border-orange-300 text-orange-800',
                    glow: 'shadow-[0_0_12px_rgba(249,115,22,0.15)]'
                  };
                } else if (badge.id === 'water_protector') {
                  badgeColorTheme = {
                    border: 'border-sky-300',
                    bg: 'bg-sky-50/50',
                    text: 'text-sky-800',
                    iconBg: 'bg-sky-100 border-sky-300 text-sky-800',
                    glow: 'shadow-[0_0_12px_rgba(56,189,248,0.15)]'
                  };
                } else if (badge.id === 'cleanliness_champion') {
                  badgeColorTheme = {
                    border: 'border-emerald-300',
                    bg: 'bg-emerald-50/50',
                    text: 'text-emerald-800',
                    iconBg: 'bg-emerald-100 border-emerald-300 text-emerald-800',
                    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  };
                } else if (badge.id === 'master_verifier') {
                  badgeColorTheme = {
                    border: 'border-indigo-300',
                    bg: 'bg-indigo-50/50',
                    text: 'text-indigo-800',
                    iconBg: 'bg-indigo-100 border-indigo-300 text-indigo-800',
                    glow: 'shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                  };
                } else if (badge.id === 'community_builder') {
                  badgeColorTheme = {
                    border: 'border-purple-300',
                    bg: 'bg-purple-50/50',
                    text: 'text-purple-800',
                    iconBg: 'bg-purple-100 border-purple-300 text-purple-800',
                    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                  };
                } else if (badge.id === 'weekend_volunteer') {
                  badgeColorTheme = {
                    border: 'border-pink-300',
                    bg: 'bg-pink-50/50',
                    text: 'text-pink-800',
                    iconBg: 'bg-pink-100 border-pink-300 text-pink-850',
                    glow: 'shadow-[0_0_12px_rgba(236,72,153,0.15)]'
                  };
                } else if (badge.id === 'infrastructure_hero') {
                  badgeColorTheme = {
                    border: 'border-amber-400',
                    bg: 'bg-amber-50/50',
                    text: 'text-amber-800',
                    iconBg: 'bg-amber-100 border-amber-400 text-amber-800',
                    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  };
                }

                return (
                  <div 
                    key={badge.id}
                    className={`p-4 border-2 rounded-[20px] transition-all flex flex-col justify-between ${
                      badge.unlocked 
                        ? `bg-white ${badgeColorTheme.border} ${badgeColorTheme.glow} hover:scale-102` 
                        : 'bg-white/80 border-slate-200 opacity-60 filter saturate-50 blur-[0.2px]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Illustrated Icon Seal Shield */}
                      <div className={`p-3 rounded-tl-[24px] rounded-br-[24px] rounded-tr-[10px] rounded-bl-[10px] shrink-0 border-2 relative ${
                        badge.unlocked 
                          ? badgeColorTheme.iconBg 
                          : 'bg-slate-100 border-slate-300 text-slate-400'
                      }`}>
                        <Icon className={`w-5 h-5 ${badge.unlocked ? 'animate-float' : ''}`} />
                        {!badge.unlocked && (
                          <div className="absolute -bottom-1 -right-1 bg-slate-600 text-white rounded-full p-0.5 border border-white">
                            <Lock className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-xs font-black text-amber-950">{badge.name}</h5>
                          {badge.unlocked && <span className="text-[10px]">✨</span>}
                        </div>
                        <p className="text-[10.5px] text-amber-900/70 font-semibold leading-relaxed">{badge.desc}</p>
                      </div>
                    </div>

                    {/* Progress details */}
                    <div className="mt-4 pt-3 border-t-2 border-dashed border-[#f3e9d4]/60 space-y-1.5">
                      <div className="flex justify-between text-[10px] text-amber-900/60 font-black uppercase">
                        <span>EXPEDITION LEVEL</span>
                        <span>{displayCurrent} / {badge.target}</span>
                      </div>
                      <div className="h-4 bg-slate-100/80 border border-slate-200 rounded-full overflow-hidden p-0.5 shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            badge.unlocked 
                              ? 'bg-gradient-to-r from-amber-400 to-orange-400' 
                              : 'bg-slate-300'
                          }`} 
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
