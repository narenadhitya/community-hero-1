import React, { useEffect, useState } from 'react';
import { Award, Trophy, Zap, Star, Shield, Sparkles } from 'lucide-react';

interface CelebrationOverlayProps {
  type: 'level' | 'badge';
  title: string;
  subtitle: string;
  detailText?: string;
  badgeId?: string;
  levelNumber?: number;
  onClose: () => void;
}

export default function CelebrationOverlay({
  type,
  title,
  subtitle,
  detailText,
  badgeId,
  levelNumber,
  onClose,
}: CelebrationOverlayProps) {
  const [particles, setParticles] = useState<{ id: number; emoji: string; left: number; delay: number; scale: number; duration: number }[]>([]);

  useEffect(() => {
    // Generate celebratory floating particles
    const emojis = ['🎉', '✨', '🌟', '🏆', '⭐', '🦁', '🧱', '👑', '🌈', '🔥'];
    const p = Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      left: Math.random() * 100, // percentage
      delay: Math.random() * 2, // seconds
      scale: 0.5 + Math.random() * 1.5,
      duration: 3 + Math.random() * 3, // seconds
    }));
    setParticles(p);
  }, []);

  // Map badge IDs to gorgeous visual presentation
  const getBadgeIcon = (id?: string) => {
    switch (id) {
      case 'first_report':
        return { emoji: '🚩', label: 'First Expedition', bg: 'from-orange-400 to-amber-500' };
      case 'road_guardian':
        return { emoji: '🧱', label: 'Cobblestone Guardian', bg: 'from-amber-500 to-yellow-600' };
      case 'water_protector':
        return { emoji: '💧', label: 'Water Protector', bg: 'from-sky-400 to-blue-600' };
      case 'cleanliness_champion':
        return { emoji: '🧹', label: 'Cleanliness Champion', bg: 'from-emerald-400 to-teal-600' };
      case 'master_verifier':
        return { emoji: '🛡️', label: 'Sentinel Scholar', bg: 'from-indigo-400 to-purple-600' };
      case 'community_builder':
        return { emoji: '🏛️', label: 'Piazza Ambassador', bg: 'from-purple-400 to-pink-600' };
      case 'weekend_volunteer':
        return { emoji: '🌙', label: 'Twilight Sentinel', bg: 'from-pink-400 to-rose-600' };
      case 'infrastructure_hero':
        return { emoji: '👑', label: 'Grand Archon', bg: 'from-rose-500 to-orange-600 animate-pulse' };
      default:
        return { emoji: '🏅', label: 'Prestige Badge', bg: 'from-amber-400 to-orange-500' };
    }
  };

  const badgeDetails = getBadgeIcon(badgeId);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-amber-950/85 backdrop-blur-md overflow-hidden select-none">
      {/* Dynamic Keyframe Injection for the falling particles */}
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(105vh) rotate(0deg) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(90vh) rotate(45deg) scale(var(--scale));
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-15vh) rotate(720deg) scale(var(--scale));
            opacity: 0;
          }
        }
        @keyframes zoomInElastic {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          60% {
            transform: scale(1.1);
          }
          80% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes pulseGlow {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 25px rgba(251, 191, 36, 0.4);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 50px rgba(251, 191, 36, 0.8);
          }
        }
        .animate-float-particle {
          animation: floatUp var(--duration) linear infinite;
          animation-delay: var(--delay);
        }
        .animate-modal-elastic {
          animation: zoomInElastic 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .animate-glow-pulse {
          animation: pulseGlow 2.5s infinite ease-in-out;
        }
      `}</style>

      {/* Floating Particle Rain background */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute text-2xl animate-float-particle"
            style={
              {
                left: `${p.left}%`,
                '--delay': `${p.delay}s`,
                '--duration': `${p.duration}s`,
                '--scale': p.scale,
              } as React.CSSProperties
            }
          >
            {p.emoji}
          </div>
        ))}
      </div>

      {/* Inner Celebration Box */}
      <div className="relative w-full max-w-md bg-white border-4 border-amber-300 rounded-[36px] p-8 shadow-2xl text-center animate-modal-elastic space-y-6">
        {/* Glowing header badge */}
        <div className="mx-auto w-24 h-24 rounded-full bg-amber-50 border-4 border-amber-300 flex items-center justify-center animate-glow-pulse">
          {type === 'level' ? (
            <div className="relative">
              <Trophy className="w-12 h-12 text-amber-500" />
              <span className="absolute -bottom-2 -right-2 bg-orange-600 text-white text-xs font-black px-2 py-0.5 rounded-full border-2 border-white">
                {levelNumber || 2}
              </span>
            </div>
          ) : (
            <span className="text-5xl">{badgeDetails.emoji}</span>
          )}
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 bg-orange-100 text-orange-800 text-[10px] font-black uppercase tracking-widest rounded-full border border-orange-200">
            {type === 'level' ? '🏆 Level Ascended' : '✨ Prestige Badge Earned'}
          </span>
          <h2 className="text-3xl font-display font-black text-amber-950 tracking-tight leading-tight">
            {title}
          </h2>
          <p className="text-sm font-semibold text-amber-800/80 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Feature/Unlock specifics */}
        {type === 'level' ? (
          <div className="bg-[#faf6eb] border-2 border-[#ebdcb9] rounded-2xl p-4 text-left space-y-2.5">
            <span className="text-[10px] font-black text-amber-900/60 uppercase tracking-widest block">
              Level {levelNumber} Benefits Unlocked:
            </span>
            <ul className="space-y-1.5 text-xs text-amber-950 font-semibold">
              <li className="flex items-center gap-2">
                <span className="text-orange-500">⚡</span> Greater voting weight on public escalations
              </li>
              <li className="flex items-center gap-2">
                <span className="text-orange-500">🌟</span> Elite customized citizen gear & avatar shields
              </li>
              <li className="flex items-center gap-2">
                <span className="text-orange-500">🎓</span> Premium title decoration on Community boards
              </li>
            </ul>
          </div>
        ) : (
          <div className={`p-5 rounded-2xl bg-gradient-to-br ${badgeDetails.bg} text-white shadow-md text-center space-y-1`}>
            <span className="text-xs uppercase font-black tracking-widest opacity-80">
              {badgeDetails.label}
            </span>
            <p className="text-xs font-medium italic opacity-95">
              "{detailText || 'A badge signifying great honor and devotion to our public grid.'}"
            </p>
          </div>
        )}

        {/* Interactive Close button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-black rounded-2xl shadow-md transition-all border-b-4 border-orange-700 cursor-pointer hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Superb, Continue Quest!
          </button>
        </div>
      </div>
    </div>
  );
}
