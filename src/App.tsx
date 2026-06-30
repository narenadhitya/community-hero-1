import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc, collection, getDocs } from 'firebase/firestore';
import { seedDatabase } from './lib/seeder';
import { User, Neighborhood, Issue, Department } from './types';
import AuthScreen from './components/AuthScreen';
import HomeView from './components/HomeView';
import ReportView from './components/ReportView';
import ProfileView from './components/ProfileView';
import CommunityView from './components/CommunityView';
import WorkerView from './components/WorkerView';
import AccountabilityView from './components/AccountabilityView';
import Avatar from './components/Avatar';
import { Compass, Camera, User as UserIcon, Users, LogOut, Award, Loader2, Sparkles, Trophy, Star, Shield, HelpCircle } from 'lucide-react';
import CelebrationOverlay from './components/CelebrationOverlay';
import OnboardingScreen from './components/OnboardingScreen';
import { motion } from 'motion/react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'report' | 'profile' | 'community' | 'accountability'>('home');
  const [justReportedIssueId, setJustReportedIssueId] = useState<string | null>(null);

  // Firestore sync state
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Onboarding & Celebration state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [celebratedLevel, setCelebratedLevel] = useState<number | null>(null);
  const [unlockedBadgeId, setUnlockedBadgeId] = useState<string | null>(null);
  const [celebratedBadges, setCelebratedBadges] = useState<string[] | null>(null);

  useEffect(() => {
    const onboarded = localStorage.getItem('communityhero_onboarded');
    if (!onboarded) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (celebratedLevel === null) {
        setCelebratedLevel(currentUser.level);
      } else if (currentUser.level > celebratedLevel) {
        setShowLevelUpModal(true);
        setCelebratedLevel(currentUser.level);
      }
    }
  }, [currentUser?.level, celebratedLevel]);

  useEffect(() => {
    if (currentUser) {
      const currentBadges = currentUser.badges || [];
      if (celebratedBadges === null) {
        setCelebratedBadges(currentBadges);
      } else {
        const newlyUnlocked = currentBadges.filter(b => !celebratedBadges.includes(b));
        if (newlyUnlocked.length > 0) {
          setUnlockedBadgeId(newlyUnlocked[0]);
        }
        setCelebratedBadges(currentBadges);
      }
    }
  }, [currentUser?.badges, celebratedBadges]);

  // 1. Initial Seeding and Auth listener
  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null;

    const setupApp = async () => {
      try {
        console.log('Bootstrapping Community Hero applet resources...');
        // Perform standard database seeding on startup if empty
        await seedDatabase();
      } catch (e) {
        console.error('Error during app bootstrap seeding:', e);
      } finally {
        // Attach Auth listener
        unsubscribeAuth = onAuthStateChanged(auth, (user) => {
          if (user) {
            setUid(user.uid);
          } else {
            setUid(null);
            setCurrentUser(null);
            setLoading(false);
          }
        });
      }
    };

    setupApp();

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  // 2. Fetch User Profile and Live Data Listeners once Authenticated
  useEffect(() => {
    if (!uid) return;

    setLoading(true);
    let unsubscribeUser: (() => void) | null = null;
    let unsubscribeNeighborhoods: (() => void) | null = null;
    let unsubscribeIssues: (() => void) | null = null;
    let unsubscribeDepartments: (() => void) | null = null;

    try {
      // Live-sync User Profile document
      unsubscribeUser = onSnapshot(doc(db, 'users', uid), (docSnap) => {
        if (docSnap.exists()) {
          setCurrentUser({
            id: uid,
            ...docSnap.data(),
          } as User);
        } else {
          console.warn('Authenticated user doc not found in Firestore yet.');
        }
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      });

      // Live-sync Neighborhoods (Shared GIS data)
      unsubscribeNeighborhoods = onSnapshot(doc(db, 'neighborhoods', 'mission_district'), () => {
        // Fetch all neighborhoods dynamically on any updates
        onSnapshot(doc(db, 'neighborhoods', 'north_beach'), () => {
          // Double nesting for reliable multi-doc tracking since we have exactly 2 neighborhoods
          const nbRef1 = doc(db, 'neighborhoods', 'mission_district');
          const nbRef2 = doc(db, 'neighborhoods', 'north_beach');
          
          Promise.all([getDoc(nbRef1), getDoc(nbRef2)]).then(([snap1, snap2]) => {
            const list: Neighborhood[] = [];
            if (snap1.exists()) list.push({ id: snap1.id, ...snap1.data() } as Neighborhood);
            if (snap2.exists()) list.push({ id: snap2.id, ...snap2.data() } as Neighborhood);
            setNeighborhoods(list);
          });
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'neighborhoods');
      });

      // Live-sync Active Issues
      unsubscribeIssues = onSnapshot(doc(db, 'neighborhoods', 'mission_district'), () => {
        fetchDynamicIssues();
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'issues');
      });

      // Live-sync Departments
      unsubscribeDepartments = onSnapshot(collection(db, 'departments'), (snapshot) => {
        const list: Department[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Department);
        });
        setDepartments(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'departments');
      });

    } catch (err) {
      console.error('Error attaching live listeners:', err);
      setLoading(false);
    }

    return () => {
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeNeighborhoods) unsubscribeNeighborhoods();
      if (unsubscribeIssues) unsubscribeIssues();
      if (unsubscribeDepartments) unsubscribeDepartments();
    };
  }, [uid]);

  // Dynamic Manual Fetch for Issues
  const fetchDynamicIssues = async () => {
    try {
      const list: Issue[] = [];
      const querySnapshot = await getDocs(collection(db, 'issues'));
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Issue);
      });
      setIssues(list);
    } catch (e) {
      console.error('Error fetching issue list:', e);
    }
  };

  // Allow manual refreshing of all collections
  const handleManualRefresh = async () => {
    await fetchDynamicIssues();
  };

  // Mock handler to sign in sandbox guest manually from external components
  const handleSandboxSignInFromApp = (sandboxUid: string) => {
    setUid(sandboxUid);
  };

  // Sign out helper
  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUid(null);
      setCurrentUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to handle client-side updates to active citizen state
  const handleUserUpdate = (updatedFields: Partial<User>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...updatedFields });
    }
  };

  // Render Loading Overlay
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf6eb] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-[#f97316] animate-spin mb-4" />
        <h3 className="text-amber-900 text-sm font-black tracking-wide font-display animate-pulse">
          ALIGNING HYPERLOCAL CIVIC GPS GRID...
        </h3>
        <p className="text-[10px] text-amber-850/60 mt-1 font-mono font-bold">Connecting to secure Firestore database</p>
      </div>
    );
  }

  // Render Auth screen if not logged in
  if (!uid || !currentUser) {
    return <AuthScreen onSignInSuccess={handleSandboxSignInFromApp} />;
  }

  // Parse current user avatar selections
  let avatarObj = { skin: '#f5d0a9', hair: 'short', shirt: '#059669', accessory: 'glasses' };
  try {
    avatarObj = JSON.parse(currentUser.avatarConfig);
  } catch (e) {
    // Ignore, use fallback
  }

  return (
    <div className="min-h-screen bg-[#faf6eb] text-amber-950 flex flex-col font-sans antialiased select-none">
      {/* Header Navbar: Warm Mediterranean styling */}
      {activeTab !== 'home' && (
        <header className="bg-amber-950 text-[#fffbeb] sticky top-0 z-40 border-b-3 border-[#f3e9d4] shadow-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          {/* Logo brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center text-amber-950 font-black border-2 border-[#fffbeb] shadow-sm animate-float">
              🏖️
            </div>
            <div>
              <h1 className="text-xl font-display font-black tracking-tight text-white">Community Hero</h1>
              <p className="text-amber-200/80 text-[10px] uppercase tracking-widest font-bold">☀️ Coastal Civic Watchroom</p>
            </div>
          </div>

          {/* User widget */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-[10px] font-black px-2 py-0.5 bg-amber-400 text-amber-950 rounded-full">
                  RANK {currentUser.level}
                </span>
                <span className="font-bold text-sm text-white">{currentUser.name}</span>
              </div>
              <div className="text-[10px] text-amber-200/70 uppercase font-bold tracking-wider mt-0.5">
                {currentUser.role === 'worker' ? '🛠️ Guild Officer' : (currentUser.titles[0] || 'Sentinel Explorer')} &bull; {currentUser.xp} XP &bull; {currentUser.trustScore}% Trust
              </div>
            </div>

            {/* Unified Avatar image container */}
            <div className="w-11 h-11 rounded-2xl border-2 border-amber-300 p-0.5 flex-shrink-0 bg-white shadow-inner">
              <Avatar config={avatarObj} />
            </div>

            {/* Logout button */}
            <button
              onClick={handleSignOut}
              className="p-2 hover:bg-amber-900 text-amber-100 hover:text-white rounded-xl transition-all cursor-pointer border-2 border-amber-900/60"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      )}

      {/* Main Content Area */}
      <main className={activeTab === 'home' ? 'flex-1 w-full h-screen relative overflow-hidden' : 'flex-1 max-w-7xl w-full mx-auto px-6 py-8 pb-32'}>
        {currentUser.role === 'worker' ? (
          <WorkerView
            currentUser={currentUser}
            departments={departments}
            issues={issues}
            neighborhoods={neighborhoods}
            onRefreshData={handleManualRefresh}
            onUserUpdate={handleUserUpdate}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeView
                neighborhoods={neighborhoods}
                issues={issues}
                departments={departments}
                currentUser={currentUser}
                onRefreshData={handleManualRefresh}
                onUserUpdate={handleUserUpdate}
                justReportedIssueId={justReportedIssueId}
                setJustReportedIssueId={setJustReportedIssueId}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'report' && (
              <ReportView
                currentUser={currentUser}
                neighborhoods={neighborhoods}
                issues={issues}
                onReportSuccess={(newId) => {
                  setJustReportedIssueId(newId);
                  setActiveTab('home');
                  handleManualRefresh();
                }}
                onRefreshData={handleManualRefresh}
                onUserUpdate={handleUserUpdate}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                currentUser={currentUser}
                issues={issues}
                onUserUpdate={handleUserUpdate}
              />
            )}

            {activeTab === 'community' && (
              <CommunityView
                currentUser={currentUser}
                neighborhoods={neighborhoods}
                issues={issues}
                onRefreshData={handleManualRefresh}
                onUserUpdate={handleUserUpdate}
              />
            )}

            {activeTab === 'accountability' && (
              <AccountabilityView
                departments={departments}
                onRefreshData={handleManualRefresh}
              />
            )}
          </>
        )}
      </main>

      {/* Navigation Tab Bar (Bottom) - Floating Playful Glassmorphism Bar */}
      {currentUser.role !== 'worker' && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#faf6eb]/90 backdrop-blur-md border-3 border-[#ebdcb9] rounded-[24px] shadow-xl px-6 py-2 flex gap-2 max-w-sm w-11/12 items-center justify-between">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveTab('home')}
            className="flex flex-col items-center gap-0.5 group cursor-pointer"
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'home'
                ? 'bg-amber-100 text-amber-900 border-2 border-amber-400 font-bold border-b-4 border-b-amber-500 scale-102 translate-y-[1px]'
                : 'text-amber-800/40 hover:bg-amber-50/50 hover:text-amber-950 border-2 border-transparent hover:border-b-4 hover:border-b-amber-300 active:translate-y-[2px]'
            }`}>
              <Compass className="w-5 h-5" />
            </div>
            <span className={`text-[9px] font-black tracking-wider font-display ${activeTab === 'home' ? 'text-amber-950' : 'text-amber-800/40'}`}>MAP</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveTab('community')}
            className="flex flex-col items-center gap-0.5 group cursor-pointer"
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'community'
                ? 'bg-amber-100 text-amber-900 border-2 border-amber-400 font-bold border-b-4 border-b-amber-500 scale-102 translate-y-[1px]'
                : 'text-amber-800/40 hover:bg-amber-50/50 hover:text-amber-950 border-2 border-transparent hover:border-b-4 hover:border-b-amber-300 active:translate-y-[2px]'
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <span className={`text-[9px] font-black tracking-wider font-display ${activeTab === 'community' ? 'text-amber-950' : 'text-amber-800/40'}`}>COMMUNITY</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => setActiveTab('report')}
            className="flex flex-col items-center gap-0.5 group relative cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-orange-500 shadow-lg shadow-orange-350/50 border-3 border-white flex items-center justify-center text-white hover:scale-105 transition-transform -mt-8 border-b-6 border-b-orange-700 active:translate-y-[3px] active:border-b-0 duration-75">
              <Camera className="w-6 h-6 animate-pulse-gentle" />
            </div>
            <span className="text-[9px] font-black tracking-wider text-orange-600 mt-1 font-display">REPORT</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveTab('profile')}
            className="flex flex-col items-center gap-0.5 group cursor-pointer"
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === 'profile'
                ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 font-bold border-b-4 border-b-amber-400 scale-102 translate-y-[1px]'
                : 'text-amber-800/40 hover:bg-amber-50/50 hover:text-amber-950 border-2 border-transparent hover:border-b-4 hover:border-b-amber-300 active:translate-y-[2px]'
            }`}>
              <UserIcon className="w-5 h-5" />
            </div>
            <span className={`text-[9px] font-black tracking-wider font-display ${activeTab === 'profile' ? 'text-amber-900' : 'text-amber-800/40'}`}>PROFILE</span>
          </motion.button>
        </nav>
      )}

      {/* Celebration and Onboarding overlays */}
      {showOnboarding && (
        <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
      )}

      {showLevelUpModal && currentUser && (
        <CelebrationOverlay
          type="level"
          title={`Level ${currentUser.level} Reached!`}
          subtitle={
            currentUser.level >= 5
              ? '⛵ You have ascended to Sea Master Sentinel rank!'
              : currentUser.level >= 3
              ? '🐚 You have ascended to Coastal Guardian rank!'
              : '🌴 You have ascended to Sandy Sentinel Defender rank!'
          }
          levelNumber={currentUser.level}
          onClose={() => setShowLevelUpModal(false)}
        />
      )}

      {unlockedBadgeId && currentUser && (
        <CelebrationOverlay
          type="badge"
          title="Prestige Badge Unlocked!"
          subtitle="Your outstanding contribution to our micro-grid has earned you a badge."
          badgeId={unlockedBadgeId}
          onClose={() => setUnlockedBadgeId(null)}
        />
      )}
    </div>
  );
}
