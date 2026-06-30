import React from 'react';

interface AvatarProps {
  config: {
    skin?: string;
    hair?: string;
    shirt?: string;
    accessory?: string;
  };
  className?: string;
}

export default function Avatar({ config, className = "w-full h-full" }: AvatarProps) {
  const skin = config.skin || '#f5d0a9';
  const hair = config.hair || 'short';
  const shirt = config.shirt || '#059669';
  const accessory = config.accessory || 'none';

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`${className} bg-amber-50/40 rounded-full border-2 border-amber-200/60 shadow-inner`}
    >
      <defs>
        {/* Sky gradient background for the badge */}
        <linearGradient id="avatar-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fed7aa" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#avatar-bg-grad)" />

      {/* COZY EXPLORER BACKPACK (PEEKING FROM BEHIND THE SHOULDERS) */}
      {accessory === 'cozy-backpack' && (
        <g stroke="#7c2d12" strokeWidth="1.2">
          {/* Left backpack bulge */}
          <rect x="18" y="55" width="10" height="20" rx="3.5" fill="#c2410c" />
          {/* Right backpack bulge */}
          <rect x="72" y="55" width="10" height="20" rx="3.5" fill="#c2410c" />
          {/* Straps on shoulders */}
          <path d="M22 68 Q 30 63 34 68" fill="none" stroke="#7c2d12" strokeWidth="2" />
          <path d="M78 68 Q 70 63 66 68" fill="none" stroke="#7c2d12" strokeWidth="2" />
        </g>
      )}

      {/* SHOULDERS / SHIRT */}
      <g>
        {shirt === 'stripes' ? (
          // Breton Mediterranean coastal stripes
          <g>
            <path d="M22 85 C22 70, 32 60, 50 60 C68 60, 78 70, 78 85 Z" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1.5" />
            <path d="M25 76 Q 50 67 75 76" fill="none" stroke="#0ea5e9" strokeWidth="3" />
            <path d="M23 82 Q 50 74 77 82" fill="none" stroke="#0ea5e9" strokeWidth="3" />
          </g>
        ) : shirt === 'coat' ? (
          // Explorer brown utility coat
          <g>
            <path d="M22 85 C22 70, 32 60, 50 60 C68 60, 78 70, 78 85 Z" fill="#b45309" stroke="#78350f" strokeWidth="1.5" />
            {/* Inner undershirt collar */}
            <polygon points="43,60 50,68 57,60" fill="#fef08a" />
            {/* Lapels */}
            <path d="M38 60 L45 74 L42 85" fill="none" stroke="#78350f" strokeWidth="2" />
            <path d="M62 60 L55 74 L58 85" fill="none" stroke="#78350f" strokeWidth="2" />
            {/* Gold buttons */}
            <circle cx="42" cy="78" r="1.5" fill="#fbbf24" />
            <circle cx="58" cy="78" r="1.5" fill="#fbbf24" />
          </g>
        ) : (
          // Solid classic shirt color
          <path d="M22 85 C22 70, 32 60, 50 60 C68 60, 78 70, 78 85 Z" fill={shirt} stroke="#1e293b" strokeWidth="1.2" />
        )}
      </g>

      {/* NECK BINOCULARS (UNDER THE CHIN) */}
      {accessory === 'binoculars' && (
        <g stroke="#1e293b" strokeWidth="1.2" fill="#fbbf24" transform="translate(0, 15)">
          {/* Strap hanging down */}
          <path d="M35 45 Q 50 60 65 45" fill="none" stroke="#475569" strokeWidth="1.5" />
          {/* Binocular left lens */}
          <rect x="41" y="47" width="7" height="11" rx="1.5" />
          {/* Binocular right lens */}
          <rect x="52" y="47" width="7" height="11" rx="1.5" />
          {/* Center bridge */}
          <line x1="48" y1="52" x2="52" y2="52" strokeWidth="2" />
        </g>
      )}

      {/* NECK */}
      <rect x="44" y="50" width="12" height="12" fill={skin} rx="2.5" stroke="#1e293b" strokeWidth="1" />

      {/* FACE */}
      <circle cx="50" cy="40" r="16" fill={skin} stroke="#1e293b" strokeWidth="1.2" />

      {/* EYES */}
      <circle cx="44" cy="38" r="1.8" fill="#1e293b" />
      <circle cx="56" cy="38" r="1.8" fill="#1e293b" />

      {/* SMILE */}
      <path d="M45 44 Q50 48 55 44" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />

      {/* HAIR STYLES */}
      {hair === 'curly' && (
        <g fill="#271c19">
          <circle cx="50" cy="24" r="5.5" />
          <circle cx="42" cy="26" r="4.5" />
          <circle cx="58" cy="26" r="4.5" />
          <circle cx="36" cy="31" r="4" />
          <circle cx="64" cy="31" r="4" />
          <circle cx="47" cy="22" r="5" />
        </g>
      )}
      {hair === 'fringe' && (
        <path d="M34 31 Q50 18 66 31 C61 24, 39 24, 34 31 Z" fill="#4a3728" stroke="#271c19" strokeWidth="1" />
      )}
      {hair === 'spiky' && (
        <path d="M33 29 L39 16 L45 24 L51 14 L57 24 L63 16 L67 29 Z" fill="#1e1b4b" stroke="#0f172a" strokeWidth="1" />
      )}
      {hair === 'executive' && (
        <path d="M33 27 Q48 16 65 22 Q60 18 50 18 Q40 18 33 27 Z" fill="#d97706" stroke="#b45309" strokeWidth="1" />
      )}

      {/* COSY EXPLORER PREMIUM HATS */}
      {hair === 'explore-hat' && (
        <g transform="translate(0, -2)">
          {/* Safari Explorer Hat dome */}
          <path d="M32 25 C32 12, 68 12, 68 25 Z" fill="#e5cbb3" stroke="#78350f" strokeWidth="1.5" />
          {/* Hat band */}
          <rect x="34.5" y="21" width="31" height="4" fill="#7c2d12" />
          {/* Hat brim */}
          <ellipse cx="50" cy="25" rx="23" ry="4" fill="#e5cbb3" stroke="#78350f" strokeWidth="1.5" />
        </g>
      )}

      {hair === 'captain-cap' && (
        <g transform="translate(0, -3)">
          {/* Sailor blue brim / peak */}
          <path d="M 33 24 Q 50 29 67 24 L 69 19 Q 50 12 31 19 Z" fill="#0369a1" stroke="#0284c7" strokeWidth="1" />
          {/* White top cap */}
          <path d="M 33 19 Q 50 10 67 19 C 68 14, 32 14, 33 19 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
          {/* Anchor badge */}
          <g transform="translate(50, 18) scale(0.4)">
            <circle cx="0" cy="-6" r="2" fill="#fbbf24" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#fbbf24" strokeWidth="2" />
            <line x1="-3" y1="-1" x2="3" y2="-1" stroke="#fbbf24" strokeWidth="2" />
            <path d="M -4 1 Q 0 6 4 1" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </g>
      )}

      {hair === 'crown' && (
        <g transform="translate(0, -4)" className="animate-float">
          {/* Golden crown base */}
          <rect x="33" y="19" width="34" height="4" fill="#fbbf24" stroke="#ca8a04" strokeWidth="1.2" rx="1" />
          {/* Crown Spikes */}
          <polygon points="33,19 33,8 41,15 50,4 59,15 67,8 67,19" fill="#fbbf24" stroke="#ca8a04" strokeWidth="1.5" />
          {/* Ruby Gems */}
          <circle cx="33" cy="8" r="1.5" fill="#f43f5e" />
          <circle cx="50" cy="4" r="1.5" fill="#f43f5e" />
          <circle cx="67" cy="8" r="1.5" fill="#f43f5e" />
          <circle cx="50" cy="15" r="1.5" fill="#3b82f6" />
        </g>
      )}

      {/* ACCESSORIES */}
      {accessory === 'glasses' && (
        <g stroke="#000000" strokeWidth="1.5" fill="none" opacity="0.9">
          <circle cx="44" cy="38" r="4.5" />
          <circle cx="56" cy="38" r="4.5" />
          <line x1="48.5" y1="38" x2="51.5" y2="38" />
          <line x1="39.5" y1="38" x2="36" y2="40" />
          <line x1="60.5" y1="38" x2="64" y2="40" />
        </g>
      )}

      {accessory === 'goggles' && (
        <rect x="35" y="34" width="30" height="8" rx="3.5" fill="#0ea5e9" stroke="#0284c7" strokeWidth="1.2" opacity="0.9" />
      )}

      {accessory === 'hard-hat' && (
        <g transform="translate(0, -2)">
          <path d="M32 26 C32 15, 68 15, 68 26 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1.2" />
          <rect x="29" y="24" width="42" height="3" rx="1" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
          <rect x="46" y="15" width="8" height="11" fill="#f59e0b" />
        </g>
      )}

      {accessory === 'badge' && (
        <g transform="translate(42.5, 64) scale(0.75)">
          <polygon points="10,0 13,7 20,7 15,12 17,19 10,15 3,19 5,12 0,7 7,7" fill="#fbbf24" stroke="#d97706" strokeWidth="1.2" />
        </g>
      )}
    </svg>
  );
}
