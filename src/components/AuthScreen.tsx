import React, { useState } from 'react';
import { auth, googleProvider, handleFirestoreError, OperationType, db } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Shield, Compass, Award, UserCheck, AlertTriangle, Briefcase, HardHat, Hammer, Trash, Droplet, Lightbulb, Sparkles, Map } from 'lucide-react';

interface AuthScreenProps {
  onSignInSuccess: (uid: string) => void;
}

export default function AuthScreen({ onSignInSuccess }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'citizen' | 'worker'>('citizen');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('roads');

  const DEPARTMENTS = [
    { id: 'roads', name: 'Roads & Asphalt', icon: Hammer, color: 'text-amber-600 bg-amber-50' },
    { id: 'water_drainage', name: 'Water & Drainage', icon: Droplet, color: 'text-blue-600 bg-blue-50' },
    { id: 'electrical_lighting', name: 'Electrical & Lighting', icon: Lightbulb, color: 'text-indigo-600 bg-indigo-50' },
    { id: 'sanitation', name: 'Sanitation Dept', icon: Trash, color: 'text-rose-600 bg-rose-50' },
    { id: 'parks_environment', name: 'Parks & Environment', icon: HardHat, color: 'text-emerald-600 bg-emerald-50' }
  ];

  // Fallback / Sandbox local citizen sign-in
  const handleSandboxSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const sandboxUid = 'sandbox_citizen_hero_101';
      const userRef = doc(db, 'users', sandboxUid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const defaultUser = {
          name: 'Jane Civic',
          avatarConfig: JSON.stringify({
            skin: '#ffd1dc',
            hair: 'curly',
            shirt: '#f97316',
            accessory: 'badge',
          }),
          trustScore: 75,
          level: 2,
          xp: 150,
          badges: ['first_responder', 'waste_warrior'],
          titles: ['Hyperlocal Sentinel', 'Pothole Patrol'],
          neighborhoodIds: ['mission_district'],
          joinedAt: new Date().toISOString(),
          role: 'citizen'
        };
        await setDoc(userRef, defaultUser);
      } else {
        // Ensure role is set on existing sandbox user
        await setDoc(userRef, { role: 'citizen' }, { merge: true });
      }
      
      onSignInSuccess(sandboxUid);
    } catch (err: any) {
      console.error('Sandbox login error:', err);
      setError('Could not connect to database. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  // Google Sign In via Firebase Popup
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const newUserProfile = {
          name: user.displayName || 'Anonymous Citizen',
          avatarConfig: JSON.stringify({
            skin: '#f5d0a9',
            hair: 'short',
            shirt: '#38bdf8',
            accessory: 'glasses',
          }),
          trustScore: 50,
          level: 1,
          xp: 0,
          badges: [],
          titles: ['Fresh Recruit'],
          neighborhoodIds: [],
          joinedAt: new Date().toISOString(),
          role: 'citizen'
        };
        await setDoc(userRef, newUserProfile);
      } else {
        // Ensure role is citizen
        await setDoc(userRef, { role: 'citizen' }, { merge: true });
      }

      onSignInSuccess(user.uid);
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/popup-blocked') {
        setError('Google sign-in popup was blocked. Please try clicking again or use sandbox citizen mode.');
      } else {
        setError(err.message || 'Authentication failed. Please use Sandbox Citizen Mode.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Department Worker login handler
  const handleWorkerSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedDept = DEPARTMENTS.find(d => d.id === selectedDeptId);
      const deptName = selectedDept ? selectedDept.name : 'Municipal';
      const sandboxWorkerUid = `sandbox_worker_${selectedDeptId}`;
      const userRef = doc(db, 'users', sandboxWorkerUid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const defaultWorker = {
          name: `Officer ${deptName.split(' ')[0]}`,
          avatarConfig: JSON.stringify({
            skin: '#cca47c',
            hair: 'executive',
            shirt: '#ea580c',
            accessory: 'badge',
          }),
          trustScore: 100,
          level: 3,
          xp: 150,
          badges: ['Community Builder', 'Infrastructure Hero'],
          titles: ['Municipal Crew', 'Corridor Overseer'],
          neighborhoodIds: ['mission_district', 'north_beach'],
          joinedAt: new Date().toISOString(),
          role: 'worker',
          departmentId: selectedDeptId,
        };
        await setDoc(userRef, defaultWorker);
      } else {
        // Ensure role is correctly worker
        await setDoc(userRef, { role: 'worker', departmentId: selectedDeptId }, { merge: true });
      }

      onSignInSuccess(sandboxWorkerUid);
    } catch (err: any) {
      console.error('Worker sign-in error:', err);
      setError('Could not connect to database. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf6eb] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans select-none">
      {/* Handcrafted background detail elements */}
      <div className="absolute top-1/6 left-1/6 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl animate-pulse-gentle" />
      <div className="absolute bottom-1/6 right-1/6 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl animate-float" />

      {/* Main card */}
      <div className="max-w-md w-full bg-white border-3 border-[#ebdcb9] rounded-3xl p-8 relative z-10 shadow-soft">
        
        {/* Playful brand header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-amber-100 border-3 border-amber-300 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm animate-float">
            <Compass className="w-11 h-11 text-amber-600" />
          </div>
          <h1 className="text-4xl font-display font-black text-[#7c2d12] tracking-tight">Community Hero</h1>
          <p className="text-amber-700/80 text-xs mt-1.5 font-bold uppercase tracking-wider">
            ☀️ A Playful Mediterranean Civic Quest
          </p>
        </div>

        {/* Tabs picker */}
        <div className="grid grid-cols-2 p-1.5 bg-[#fefaf0] border-2 border-[#f3e9d4] rounded-2xl mb-8">
          <button
            onClick={() => setActiveTab('citizen')}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'citizen' 
                ? 'bg-[#f97316] text-white shadow-sm font-black scale-102' 
                : 'text-amber-800/60 hover:text-amber-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Citizen Explorer
          </button>
          <button
            onClick={() => setActiveTab('worker')}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'worker' 
                ? 'bg-[#0ea5e9] text-white shadow-sm font-black scale-102' 
                : 'text-amber-800/60 hover:text-amber-900'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Guild Worker Crew
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl text-orange-800 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-500" />
            <div>
              <p className="font-bold text-orange-950">Adventure Alert</p>
              <p className="mt-0.5 font-semibold text-orange-900/80">{error}</p>
            </div>
          </div>
        )}

        {activeTab === 'citizen' ? (
          <div className="flex flex-col gap-4">
            <button
              id="google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-13 bg-white text-amber-900 font-bold border-2 border-[#ebdcb9] rounded-2xl flex items-center justify-center gap-3 shadow-xs hover:bg-amber-50/30 transition-all cursor-pointer disabled:opacity-50 text-xs active:scale-98"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.89 3.02C6.21 7.53 8.87 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.58l3.76 2.91c2.2-2.03 3.49-5.02 3.49-8.64z" />
                <path fill="#FBBC05" d="M5.28 10.58c-.24-.71-.38-1.48-.38-2.28s.14-1.57.38-2.28L1.39 7.56C.5 9.36 0 11.4 0 13.5s.5 4.14 1.39 5.94l3.89-3.02c-.24-.71-.38-1.48-.38-2.28s.14-1.57.38-2.28z" />
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.76-2.91c-1.1.74-2.52 1.18-4.2 1.18-3.13 0-5.79-2.49-6.73-5.54L1.39 15.84C3.37 19.73 7.35 23 12 23z" />
              </svg>
              Sign in with Google Account
            </button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-[#ebdcb9]/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-amber-800/40 font-mono font-bold">OR EXPLORER CODES</span>
              </div>
            </div>

            <button
              id="sandbox-signin-btn"
              onClick={handleSandboxSignIn}
              disabled={loading}
              className="w-full h-13 btn-playful-primary flex items-center justify-center gap-2 text-xs"
            >
              <UserCheck className="w-5 h-5 animate-pulse" />
              Begin Local Citizen Quest!
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <span className="text-[10px] font-mono font-bold text-amber-800/50 block uppercase tracking-wide">
              Select Your Guild Department:
            </span>

            {/* Department Picker */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {DEPARTMENTS.map((dept) => {
                const Icon = dept.icon;
                const isSelected = selectedDeptId === dept.id;
                return (
                  <button
                    key={dept.id}
                    onClick={() => setSelectedDeptId(dept.id)}
                    className={`w-full p-3 border-2 rounded-2xl flex items-center justify-between transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'border-[#0ea5e9] bg-sky-50 shadow-sm font-semibold'
                        : 'border-[#f3e9d4] hover:bg-[#faf6eb]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl shrink-0 ${dept.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-amber-950 font-bold">{dept.name}</span>
                    </div>
                    {isSelected && <div className="w-3 h-3 rounded-full bg-[#0ea5e9]" />}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleWorkerSignIn}
              disabled={loading}
              className="w-full h-13 btn-playful-secondary flex items-center justify-center gap-2 text-xs"
            >
              <Briefcase className="w-4 h-4 animate-pulse" />
              Authenticate Guild Officer
            </button>
          </div>
        )}

        <div className="mt-8 pt-6 border-t-2 border-[#f3e9d4] text-center">
          <p className="text-[10.5px] text-amber-800/60 max-w-sm mx-auto leading-relaxed font-bold">
            ☀️ Explore, report, and help heal our beautiful neighborhood sectors! Gain coins, 
            unlock badges, and build community harmony with every real action.
          </p>
        </div>
      </div>

      {/* Feature Showcase Grid at Bottom */}
      <div className="max-w-4xl w-full mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10 px-4">
        <div className="bg-white border-2 border-[#ebdcb9] p-6 rounded-3xl shadow-soft text-center sm:text-left hover:scale-102 transition-transform duration-300">
          <div className="w-10 h-10 bg-orange-50 border-2 border-orange-200 text-orange-600 rounded-xl flex items-center justify-center mb-3 mx-auto sm:mx-0">
            <Compass className="w-5 h-5" />
          </div>
          <h3 className="text-[#7c2d12] text-sm font-display font-black">Report Quests</h3>
          <p className="text-amber-800/70 text-xs mt-1.5 leading-relaxed font-semibold">Drop pins on broken lights, leaks, or debris. Watch citizens and guild worker crews respond.</p>
        </div>

        <div className="bg-white border-2 border-[#ebdcb9] p-6 rounded-3xl shadow-soft text-center sm:text-left hover:scale-102 transition-transform duration-300">
          <div className="w-10 h-10 bg-amber-50 border-2 border-amber-200 text-amber-500 rounded-xl flex items-center justify-center mb-3 mx-auto sm:mx-0">
            <Award className="text-amber-500 w-5 h-5" />
          </div>
          <h3 className="text-[#7c2d12] text-sm font-display font-black">Cozy Explorer Gear</h3>
          <p className="text-amber-800/70 text-xs mt-1.5 leading-relaxed font-semibold">Earn XP and coins to unlock customized backpacks, crowns, outfits, and prestige badges.</p>
        </div>

        <div className="bg-white border-2 border-[#ebdcb9] p-6 rounded-3xl shadow-soft text-center sm:text-left hover:scale-102 transition-transform duration-300">
          <div className="w-10 h-10 bg-sky-50 border-2 border-sky-200 text-[#0ea5e9] rounded-xl flex items-center justify-center mb-3 mx-auto sm:mx-0">
            <Map className="w-5 h-5" />
          </div>
          <h3 className="text-[#7c2d12] text-sm font-display font-black">Watch Sectors Heal</h3>
          <p className="text-amber-800/70 text-xs mt-1.5 leading-relaxed font-semibold">Keep track of neighborhood vitality indexes. Cooperate together to unlock the Solar Punk Eco-Utopia!</p>
        </div>
      </div>
    </div>
  );
}
