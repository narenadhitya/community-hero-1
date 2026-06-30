import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Sparkles, Map, Shield, HelpCircle, Users } from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      icon: '🏔️',
      title: 'Welcome to Community Hero',
      description: 'Your neighborhood is a living micro-grid! Every road, light, park canopy, and water pipeline has its own real-time health indicator. Together, we keep our community thriving.',
      color: 'from-orange-500 to-amber-500',
      actionLabel: 'Explore the Grid',
      badge: '📍 LOCAL SYNERGY'
    },
    {
      icon: '🔍',
      title: 'AI Classification & Vitals',
      description: 'Snap a picture of any civic hazard. Our Gemini integration classifies issues in seconds and maps them instantly. Watch neighborhood vitals fluctuate dynamically based on cooperative effort.',
      color: 'from-amber-500 to-yellow-600',
      actionLabel: 'See Cooperative Actions',
      badge: '⚡ REAL-TIME INTELLIGENCE'
    },
    {
      icon: '🛡️',
      title: 'Cooperative Missions & SLAs',
      description: 'Join hands on neighborhood-wide greening or lighting missions, attend volunteer cleanups, and track public departments with rigorous, transparent SLA timers.',
      color: 'from-emerald-500 to-teal-600',
      actionLabel: 'Enter the Watchroom',
      badge: '🤝 CO-OP ACCOUNTABILITY'
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      localStorage.setItem('communityhero_onboarded', 'true');
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const slide = slides[currentSlide];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-amber-950/80 backdrop-blur-md overflow-hidden select-none">
      <style>{`
        @keyframes slideIn {
          0% { transform: translateX(50px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-change {
          animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="relative w-full max-w-lg bg-white border-4 border-amber-200 rounded-[40px] p-8 md:p-10 shadow-2xl flex flex-col justify-between min-h-[500px]">
        {/* Top Progress bar */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-[10px] font-black text-amber-900/40 uppercase tracking-widest">
            Demo Guide • Slide {currentSlide + 1} of 3
          </span>
          <div className="flex gap-1.5">
            {slides.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentSlide === idx ? 'w-8 bg-orange-500' : 'w-2 bg-amber-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Dynamic Slide Content */}
        <div key={currentSlide} className="space-y-6 flex-1 flex flex-col justify-center text-center animate-slide-change">
          <div className="mx-auto w-24 h-24 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-5xl shadow-inner animate-bounce-gentle">
            {slide.icon}
          </div>

          <div className="space-y-3">
            <span className="px-3 py-1 bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-200">
              {slide.badge}
            </span>
            <h2 className="text-3xl font-display font-black text-amber-950 tracking-tight leading-none pt-1">
              {slide.title}
            </h2>
            <p className="text-sm text-amber-900/70 leading-relaxed font-semibold max-w-md mx-auto">
              {slide.description}
            </p>
          </div>
        </div>

        {/* Lower Controls & Actions */}
        <div className="flex items-center justify-between gap-4 pt-8 mt-4 border-t border-amber-100">
          <button
            onClick={handleBack}
            disabled={currentSlide === 0}
            className={`px-5 py-3.5 bg-amber-50 border-2 border-amber-200 hover:bg-amber-100 rounded-2xl text-xs font-black text-amber-950 flex items-center gap-1.5 transition-all cursor-pointer ${
              currentSlide === 0 ? 'opacity-30 cursor-not-allowed' : ''
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={handleNext}
            className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 border-b-4 border-orange-700 hover:border-orange-800 text-white rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 shadow-md"
          >
            {currentSlide === slides.length - 1 ? (
              <>
                Let's Play! <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                {slide.actionLabel} <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
