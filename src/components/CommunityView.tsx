import React, { useState, useEffect, useMemo } from 'react';
import { User, Neighborhood, Issue } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, getDocs, doc, updateDoc, increment, arrayUnion, 
  setDoc, onSnapshot, query, orderBy, where, limit 
} from 'firebase/firestore';
import { 
  Award, Users, Compass, Shield, Flame, MessageSquare, ArrowUp, 
  Zap, Calendar, CheckCircle2, Trophy, Navigation, Smile, Sparkles, 
  Loader2, Info, Send, RefreshCw, Plus, Clock
} from 'lucide-react';

interface CommunityViewProps {
  currentUser: User | null;
  neighborhoods: Neighborhood[];
  issues: Issue[];
  onRefreshData: () => Promise<void>;
  onUserUpdate: (updatedUser: Partial<User>) => void;
}

interface LeaderboardUser {
  id: string;
  name: string;
  level: number;
  xp: number;
  trustScore: number;
  avatarConfig: string;
  titles: string[];
}

interface CommunityMission {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: string;
  reward: string;
  icon: string;
  actions: string[];
}

interface DiscussionPost {
  id: string;
  author: string;
  avatar: string;
  timestamp: string;
  neighborhoodId: string;
  neighborhoodName: string;
  content: string;
  upvotes: number;
  upvotedByUserIds?: string[];
  replies: number;
}

interface AIDigest {
  summary: string;
  suggestion: string;
  updatedAt?: string;
}

// Seeded local community events matching the design theme
const COMMUNITY_EVENTS = [
  {
    id: 'evt_mission_cleanup',
    title: 'Valencia Corridor Cleanup Drive',
    description: 'Help clean litter, sort recyclable plastics, and sweep the walking lanes of our central brick plaza.',
    date: 'Saturday, 10:00 AM',
    location: 'Valencia & 18th St, Mission District',
    neighborhoodId: 'mission_district',
    xpReward: 15,
    commXpReward: 25,
    tag: 'Cleanliness',
    image: '🧹'
  },
  {
    id: 'evt_north_beach_lanterns',
    title: 'Harbor Pier Safety Meetup',
    description: 'Join local safety wardens to map unlit harbor corners and verify solar lanterns along the pier walk.',
    date: 'Friday, 8:00 PM',
    location: 'Columbus Ave & Union St, North Beach',
    neighborhoodId: 'north_beach',
    xpReward: 15,
    commXpReward: 25,
    tag: 'Safety & Lighting',
    image: '🔦'
  },
  {
    id: 'evt_mission_tree_planting',
    title: 'Lemon Tree Canopy Planting',
    description: 'Plant native coastal lemon trees, secure root stakes, and set up rain catchments along the sector boundary.',
    date: 'Sunday, 11:00 AM',
    location: 'Dolores Park Border, Mission District',
    neighborhoodId: 'mission_district',
    xpReward: 15,
    commXpReward: 25,
    tag: 'Green Canopy',
    image: '🌳'
  }
];

export default function CommunityView({ 
  currentUser, 
  neighborhoods, 
  issues, 
  onRefreshData, 
  onUserUpdate 
}: CommunityViewProps) {
  
  const defaultNbId = (currentUser?.neighborhoodIds && currentUser.neighborhoodIds[0]) || 'mission_district';
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>(defaultNbId);

  // States
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [citizenFilter, setCitizenFilter] = useState<'all' | 'neighborhood'>('neighborhood');
  
  // Real-time Discussion posts states
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Real-time Shared Missions states
  const [missions, setMissions] = useState<CommunityMission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);

  // Real-time AI Digest states
  const [digest, setDigest] = useState<AIDigest | null>(null);
  const [generatingDigest, setGeneratingDigest] = useState(false);

  // General Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [attendingId, setAttendingId] = useState<string | null>(null);

  const showLocalToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch Users for Leaderboard
  const fetchUsers = async () => {
    if (!currentUser) return;
    setLoadingUsers(true);
    try {
      const usersColRef = collection(db, 'users');
      const querySnap = await getDocs(usersColRef);
      const userList: LeaderboardUser[] = [];
      querySnap.forEach((doc) => {
        const data = doc.data();
        userList.push({
          id: doc.id,
          name: data.name || 'Anonymous Citizen',
          level: data.level || 1,
          xp: data.xp || 0,
          trustScore: data.trustScore || 50,
          avatarConfig: data.avatarConfig || '',
          titles: data.titles || [],
        });
      });
      setUsers(userList);
    } catch (err) {
      console.error('Error fetching users for leaderboard:', err);
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  // 2. Real-time Subscription to forum chat/discussion posts
  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const unsubscribe = onSnapshot(postsRef, (snapshot) => {
      const list: DiscussionPost[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DiscussionPost);
      });
      // Sort in-memory desc by timestamp to prevent composite index errors in Firestore
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPosts(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });
    return () => unsubscribe();
  }, []);

  // 3. Real-time Subscription to shared community missions
  useEffect(() => {
    const missionsRef = collection(db, 'missions');
    const unsubscribe = onSnapshot(missionsRef, async (snapshot) => {
      if (snapshot.empty) {
        // Automatically seed the 3 interactive missions to Firestore if not already present
        const initialMissions = [
          {
            id: 'm_ValenciaGreening',
            title: 'Valencia Greening Campaign',
            description: 'Plant native coastal lemon trees and install soil moisture grids.',
            progress: 45,
            target: '100 Actions Done',
            reward: '+150 Community XP',
            icon: '🍋',
            actions: ['Water Lemon Trees', 'Sort Compost Soils', 'Add Mulch Grid'],
          },
          {
            id: 'm_LanternRevival',
            title: 'Lantern Pier Safety Drive',
            description: 'Inspect dark corridors, check solar lanterns, and sweep walkways.',
            progress: 60,
            target: '50 Spots Verified',
            reward: '+100 Community XP',
            icon: '🏮',
            actions: ['Clean Lantern Lens', 'Test Battery Charge', 'Map Dark Alleyway'],
          },
          {
            id: 'm_HarborCleanUp',
            title: 'Harbor Coastal Clean',
            description: 'Sort recyclable micro-plastics and clear washed sea debris.',
            progress: 30,
            target: '80 Bags Sorted',
            reward: '+120 Community XP',
            icon: '🌊',
            actions: ['Gather Docks Litter', 'Sort Green Compost', 'Weigh Beach Seaweed'],
          }
        ];
        for (const m of initialMissions) {
          try {
            await setDoc(doc(db, 'missions', m.id), m);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `missions/${m.id}`);
          }
        }
      } else {
        const list: CommunityMission[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as CommunityMission);
        });
        setMissions(list);
      }
      setLoadingMissions(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'missions');
    });
    return () => unsubscribe();
  }, []);

  // 4. Real-time Subscription to active neighborhood's AI Digest
  useEffect(() => {
    const digestRef = doc(db, 'digests', selectedNeighborhoodId);
    const unsubscribe = onSnapshot(digestRef, (docSnap) => {
      if (docSnap.exists()) {
        setDigest(docSnap.data() as AIDigest);
      } else {
        setDigest(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `digests/${selectedNeighborhoodId}`);
    });
    return () => unsubscribe();
  }, [selectedNeighborhoodId]);

  // 5. Handle Refreshing AI digest on demand
  const handleRefreshDigest = async () => {
    if (generatingDigest) return;
    setGeneratingDigest(true);
    try {
      const activeNb = neighborhoods.find(n => n.id === selectedNeighborhoodId);
      if (!activeNb) {
        showLocalToast('❌ Active neighborhood not found.');
        return;
      }

      // Filter open issues in this neighborhood
      const openIssues = issues.filter(
        i => i.neighborhoodId === selectedNeighborhoodId && i.status !== 'resolved'
      );

      const res = await fetch('/api/gemini/neighborhood-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          neighborhoodName: activeNb.name,
          healthScores: activeNb.healthScores,
          openIssueCount: openIssues.length,
          recentIssues: openIssues.slice(0, 5).map(i => i.title),
        })
      });

      if (!res.ok) {
        throw new Error('Failed to generate neighborhood digest via API');
      }

      const data = await res.json();
      
      // Store in Firestore for real-time syncd display
      await setDoc(doc(db, 'digests', selectedNeighborhoodId), {
        summary: data.summary,
        suggestion: data.suggestion,
        updatedAt: new Date().toISOString()
      });

      showLocalToast(`✨ Composed new digest for ${activeNb.name}!`);
    } catch (err) {
      console.error('Error composing neighborhood digest:', err);
      showLocalToast('❌ Gemini composition failed. Please retry.');
    } finally {
      setGeneratingDigest(false);
    }
  };

  // 6. Handle Contribution to shared missions
  const handleContributeMission = async (missionId: string, actionName: string) => {
    if (!currentUser) return;
    try {
      const mRef = doc(db, 'missions', missionId);
      const targetMission = missions.find(m => m.id === missionId);
      if (!targetMission) return;

      const newProgress = Math.min(100, (targetMission.progress || 0) + 10);
      await updateDoc(mRef, {
        progress: newProgress
      });

      // Award +5 XP to user and +1 trust score
      const userRef = doc(db, 'users', currentUser.id);
      let newXp = currentUser.xp + 5;
      let newLevel = currentUser.level;
      if (newXp >= 100) {
        newXp = newXp - 100;
        newLevel += 1;
      }
      await updateDoc(userRef, {
        xp: newXp,
        level: newLevel,
        trustScore: Math.min(100, (currentUser.trustScore || 50) + 1)
      });

      onUserUpdate({
        xp: newXp,
        level: newLevel,
        trustScore: Math.min(100, (currentUser.trustScore || 50) + 1)
      });

      // Also increment community XP of active neighborhood by 10 points
      const nRef = doc(db, 'neighborhoods', selectedNeighborhoodId);
      await updateDoc(nRef, {
        communityXP: increment(10)
      });

      showLocalToast(`🌟 Contributed "${actionName}"! +5 Citizen XP & +10% Shared Progress!`);
      await onRefreshData();
    } catch (err) {
      console.error('Error contributing to mission:', err);
      showLocalToast('❌ Failed to update mission progress.');
    }
  };

  // 7. Share a new post to the watchroom chat
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !currentUser) return;
    setSubmittingPost(true);
    try {
      const postId = `post_${Date.now()}`;
      const activeNb = neighborhoods.find(n => n.id === selectedNeighborhoodId);
      
      const newPost: DiscussionPost = {
        id: postId,
        author: currentUser.name || 'Anonymous Citizen',
        avatar: '🛡️',
        timestamp: new Date().toISOString(),
        neighborhoodId: selectedNeighborhoodId,
        neighborhoodName: activeNb?.name || 'Local Sector',
        content: newPostContent.trim(),
        upvotes: 0,
        upvotedByUserIds: [],
        replies: 0
      };

      await setDoc(doc(db, 'posts', postId), newPost);
      setNewPostContent('');
      showLocalToast('💬 Share broadcasted on the local discussion board!');
    } catch (err) {
      console.error('Error writing chat post:', err);
      showLocalToast('❌ Failed to post message.');
    } finally {
      setSubmittingPost(false);
    }
  };

  // 8. Upvote a chat post
  const handleUpvotePost = async (postId: string) => {
    if (!currentUser) return;
    try {
      const postRef = doc(db, 'posts', postId);
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const upvotedUsers = post.upvotedByUserIds || [];
      if (upvotedUsers.includes(currentUser.id)) {
        showLocalToast('⚠️ Already endorsed this post!');
        return;
      }

      await updateDoc(postRef, {
        upvotes: increment(1),
        upvotedByUserIds: arrayUnion(currentUser.id)
      });
      showLocalToast('🔺 Endorsed citizen forum post!');
    } catch (err) {
      console.error('Error upvoting post:', err);
    }
  };

  // 9. RSVP to a calendar event
  const handleAttendEvent = async (event: typeof COMMUNITY_EVENTS[0]) => {
    if (!currentUser || attendingId) return;
    
    const attendedList = currentUser.attendedEvents || [];
    if (attendedList.includes(event.id)) {
      showLocalToast("⚠️ You have already RSVP'd and checked in!");
      return;
    }

    setAttendingId(event.id);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      
      const rewardXp = event.xpReward;
      let newXp = currentUser.xp + rewardXp;
      let newLevel = currentUser.level;
      if (newXp >= 100) {
        newXp = newXp - 100;
        newLevel += 1;
      }

      await updateDoc(userRef, {
        attendedEvents: arrayUnion(event.id),
        xp: newXp,
        level: newLevel,
      });

      const nRef = doc(db, 'neighborhoods', event.neighborhoodId);
      await updateDoc(nRef, {
        communityXP: increment(event.commXpReward),
      });

      onUserUpdate({
        attendedEvents: [...attendedList, event.id],
        xp: newXp,
        level: newLevel,
      });

      showLocalToast(`🎉 Registered! +15 Citizen XP, +25 Community XP to neighborhood!`);
      await onRefreshData();
      await fetchUsers();
    } catch (err) {
      console.error('Failed to RSVP to event:', err);
      showLocalToast('❌ Failed to RSVP. Try again.');
    } finally {
      setAttendingId(null);
    }
  };

  // Filters for leaderboards & feeds
  const rankedCitizens = useMemo(() => {
    if (!currentUser) return [];
    let filtered = [...users];
    
    if (citizenFilter === 'neighborhood') {
      filtered = users.filter(u => {
        const belongsToSame = u.id === currentUser.id || 
          (selectedNeighborhoodId === 'mission_district' && u.name !== 'Ada Lovelace') || 
          (selectedNeighborhoodId === 'north_beach' && u.name === 'Ada Lovelace');
        return belongsToSame;
      });
    }

    return filtered.sort((a, b) => b.xp - a.xp || b.trustScore - a.trustScore);
  }, [users, currentUser, citizenFilter, selectedNeighborhoodId]);

  const rankedNeighborhoods = useMemo(() => {
    return [...neighborhoods].sort((a, b) => b.communityXP - a.communityXP);
  }, [neighborhoods]);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => p.neighborhoodId === selectedNeighborhoodId);
  }, [posts, selectedNeighborhoodId]);

  const filteredEvents = useMemo(() => {
    return COMMUNITY_EVENTS.filter(e => e.neighborhoodId === selectedNeighborhoodId);
  }, [selectedNeighborhoodId]);

  const activeNbDetails = useMemo(() => {
    return neighborhoods.find(n => n.id === selectedNeighborhoodId) || null;
  }, [neighborhoods, selectedNeighborhoodId]);

  if (!currentUser) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin h-8 w-8 text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-36 relative">
      {/* Toast HUD */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3.5 bg-amber-950 border-2 border-amber-300 text-amber-50 text-xs font-black rounded-2xl shadow-soft animate-bounce flex items-center gap-2.5 max-w-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sector Switcher Header */}
      <div className="bg-white p-5 rounded-[20px] border-2 border-purple-300 shadow-[0_8px_20px_rgba(124,45,18,0.08)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="px-2.5 py-0.5 bg-orange-50 text-orange-700 border-2 border-orange-200 text-[10px] font-black rounded-full uppercase tracking-widest">
            📍 Cooperative Hub
          </span>
          <h2 className="text-3xl font-display font-black text-[#7c2d12] tracking-tight">
            Citizen Cooperative
          </h2>
          <p className="text-amber-800/60 text-xs font-semibold max-w-md">
            Unite with neighbors to complete active grid challenges, attend volunteer meets, and browse real-time sector updates.
          </p>
        </div>

        {/* Dynamic Sector Selector */}
        <div className="flex bg-[#faf6eb] p-1.5 rounded-2xl border-2 border-[#f3e9d4] self-start md:self-center">
          {neighborhoods.map((nb) => {
            const isActive = selectedNeighborhoodId === nb.id;
            return (
              <button
                key={nb.id}
                onClick={() => setSelectedNeighborhoodId(nb.id)}
                className={`px-4 py-2 text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'font-black rounded-xl bg-orange-500 hover:bg-orange-400 border-2 border-orange-600 border-b-5 active:border-b-2 active:translate-y-[3px] text-white shadow-md'
                    : 'font-bold rounded-xl text-amber-800/60 hover:text-amber-950 hover:bg-amber-100/40'
                }`}
              >
                {nb.id === 'mission_district' ? '🧱 Valencia Sector' : '🌊 Harbor Sector'}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. AI-Generated Neighborhood Digest Card */}
      <div className="bg-[#fffef9] border-2 border-orange-300 rounded-[20px] p-5 shadow-[0_8px_20px_rgba(124,45,18,0.08)] relative overflow-hidden transition-all hover:shadow-md">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-100 rounded-full blur-2xl opacity-40 -mr-12 -mt-12" />
        <div className="absolute bottom-2 right-2 text-6xl opacity-10 select-none">✨</div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <div>
              <h3 className="font-display font-black text-amber-950 text-base flex items-center gap-1.5">
                AI Neighborhood Digest
              </h3>
              <p className="text-[10px] font-bold text-amber-800/60">
                Freshly composed analysis of sector vitality and open issues in {activeNbDetails?.name || 'this sector'}
              </p>
            </div>
          </div>

          <button
            onClick={handleRefreshDigest}
            disabled={generatingDigest}
            className="px-4 py-2 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-950 text-xs font-black rounded-xl transition-all border-2 border-amber-300 flex items-center gap-1.5 cursor-pointer self-start md:self-auto border-b-4 active:border-b-2 active:translate-y-[2px]"
          >
            {generatingDigest ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Composing Digest...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh AI Digest
              </>
            )}
          </button>
        </div>

        {digest ? (
          <div className="space-y-4">
            <div className="text-amber-950 font-medium leading-relaxed font-serif text-sm bg-amber-50/30 p-4 rounded-2xl border border-amber-100/60 shadow-inner">
              <p>"{digest.summary}"</p>
            </div>
            
            <div className="bg-orange-50/50 p-4 rounded-2xl border-2 border-orange-200/50 flex items-start gap-3">
              <span className="text-lg mt-0.5">💡</span>
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-orange-850 uppercase tracking-wider block">
                  Actionable Suggestion
                </span>
                <p className="text-amber-950 text-xs font-semibold leading-relaxed">
                  {digest.suggestion}
                </p>
              </div>
            </div>

            {digest.updatedAt && (
              <span className="text-[9px] font-mono text-amber-800/40 block text-right">
                LAST COMPOSED: {new Date(digest.updatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        ) : (
          <div className="py-8 text-center space-y-3">
            <p className="text-amber-800/60 text-xs font-semibold">
              No daily digest is active for {activeNbDetails?.name || 'this sector'}. Tap the button to summon Gemini.
            </p>
            <button
              onClick={handleRefreshDigest}
              disabled={generatingDigest}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 border-2 border-orange-600 border-b-5 active:border-b-2 active:translate-y-[3px] text-white text-xs font-black rounded-xl flex items-center gap-1.5 mx-auto cursor-pointer transition-all duration-100 shadow-md disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 animate-pulse-gentle" />
              Generate First AI Digest
            </button>
          </div>
        )}
      </div>

      {/* 2. Active Co-op Community Missions Section */}
      <div className="bg-white border-2 border-orange-300 p-5 rounded-[20px] space-y-4 shadow-[0_8px_20px_rgba(124,45,18,0.08)]">
        <div className="space-y-1">
          <h3 className="font-display font-black text-amber-950 text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500 animate-pulse" />
            Co-op Sector Missions
          </h3>
          <p className="text-amber-800/60 text-xs font-semibold">
            Unite as a community to complete active structural milestones. Tapping action triggers increases shared progress, adds +5 Citizen XP, and increments sector vitality.
          </p>
        </div>

        {loadingMissions ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {missions.map((mission) => {
              const mType = mission.id.includes('leak') || mission.id.includes('water') ? 'water' : (mission.id.includes('clean') || mission.id.includes('waste') || mission.id.includes('litter') ? 'clean' : 'quest');
              const borderCol = mType === 'water' ? 'border-sky-300' : (mType === 'clean' ? 'border-emerald-300' : 'border-orange-300');
              const barFill = mType === 'water' ? 'bg-gradient-to-r from-sky-400 to-blue-500' : (mType === 'clean' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-orange-550');
              return (
                <div 
                  key={mission.id} 
                  className={`bg-[#faf6eb]/55 border-2 ${borderCol} rounded-[20px] p-4.5 flex flex-col justify-between space-y-4 shadow-[0_4px_12px_rgba(124,45,18,0.05)]`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-3xl p-1 bg-white rounded-xl border border-[#ebdcb9] shadow-xs">
                        {mission.icon || '🏆'}
                      </span>
                      <span className="text-[9px] font-mono font-black bg-emerald-50 text-emerald-800 border-2 border-emerald-200 px-1.5 py-0.5 rounded">
                        {mission.reward}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="font-display font-black text-amber-950 text-sm">
                        {mission.title}
                      </h4>
                      <p className="text-[11px] text-amber-800/60 leading-relaxed font-semibold mt-0.5">
                        {mission.description}
                      </p>
                    </div>
                  </div>

                  {/* Shared Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-amber-850">
                      <span>Progress</span>
                      <span>{mission.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-white h-4 rounded-full border border-amber-200 overflow-hidden p-0.5 shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${barFill}`}
                        style={{ width: `${mission.progress || 0}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-amber-800/50 block text-right">
                      Target: {mission.target}
                    </span>
                  </div>

                  {/* Contribution Action Buttons */}
                  <div className="space-y-1.5 pt-2 border-t border-[#ebdcb9]/60">
                    <span className="text-[8.5px] font-mono font-black text-amber-800/40 uppercase block mb-1">
                      Direct Citizen Actions:
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {(mission.actions || []).map((action, actionIdx) => (
                        <button
                          key={actionIdx}
                          onClick={() => handleContributeMission(mission.id, action)}
                          className="w-full py-1.5 bg-white hover:bg-orange-50 hover:text-orange-950 border border-[#ebdcb9] rounded-lg text-[10px] font-extrabold text-amber-900 transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5 text-orange-500" />
                          {action} (+5 XP)
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Multi-Column: Events & Chat Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Event Calendar */}
        <div className="lg:col-span-6 space-y-6">
          <h3 className="font-display font-black text-amber-950 text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-800" />
            Volunteer Event Calendar
          </h3>

          <div className="space-y-4">
            {filteredEvents.map((event) => {
              const attendedList = currentUser.attendedEvents || [];
              const isAttended = attendedList.includes(event.id);
              const isAttendingThis = attendingId === event.id;

              return (
                <div 
                  key={event.id}
                  className={`p-4.5 rounded-[20px] border-2 flex flex-col justify-between gap-4 transition-all shadow-[0_6px_16px_rgba(124,45,18,0.06)] ${
                    isAttended
                      ? 'bg-amber-50/20 border-purple-200/50 opacity-75'
                      : 'bg-white border-purple-300 hover:border-purple-400'
                  }`}
                >
                  <div className="flex gap-4 items-start">
                    <span className="w-12 h-12 rounded-xl bg-[#faf6eb] border-2 border-[#ebdcb9] flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
                      {event.image}
                    </span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display font-black text-amber-950 text-sm">
                          {event.title}
                        </h4>
                        <span className="text-[9px] font-mono font-black bg-orange-50 text-orange-850 border border-orange-200 px-1.5 py-0.5 rounded">
                          {event.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800/70 leading-relaxed font-semibold">
                        {event.description}
                      </p>
                      <div className="flex flex-col gap-1 pt-1 text-[10px] font-mono text-amber-800/50 font-bold">
                        <span className="flex items-center gap-1">📅 {event.date}</span>
                        <span className="flex items-center gap-1">📍 {event.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-[#ebdcb9] pt-3.5 flex justify-between items-center">
                    <div className="text-[9px] text-amber-800/40 font-bold">
                      XP Reward: <strong className="text-indigo-600">+15 XP</strong>
                    </div>

                    {isAttended ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800/40 text-[10px] font-black rounded-xl font-mono uppercase">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                        Checked In
                      </span>
                    ) : (
                      <button
                        disabled={attendingId !== null}
                        onClick={() => handleAttendEvent(event)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 border-2 border-purple-700 border-b-5 active:border-b-2 active:translate-y-[3px] text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:translate-y-0 disabled:border-b-2"
                      >
                        {isAttendingThis ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Checking In...
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3.5 h-3.5" />
                            RSVP (+15 XP)
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Citizen Forum / Discussion Feed */}
        <div className="lg:col-span-6 space-y-6">
          <h3 className="font-display font-black text-amber-950 text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-800" />
            Watchroom Discussion Board
          </h3>

          <div className="space-y-4">
            {/* Create Post Form */}
            <form onSubmit={handleCreatePost} className="bg-white p-4 rounded-[20px] border-2 border-purple-300 shadow-[0_8px_20px_rgba(124,45,18,0.08)] space-y-3">
              <span className="text-[10px] font-black text-amber-800/50 uppercase tracking-wider block">
                Broadcast Local News
              </span>
              <div className="relative">
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Share details about a repaired leak, coordinate a walk, or request verifications..."
                  rows={2}
                  maxLength={250}
                  className="w-full bg-[#faf6eb] text-amber-950 placeholder-amber-800/40 text-xs font-semibold p-3.5 rounded-xl border-2 border-[#ebdcb9] focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-[9px] text-amber-800/40 font-bold">
                  Posting as: <strong className="text-amber-950">{currentUser.name}</strong>
                </span>
                <button
                  type="submit"
                  disabled={submittingPost || !newPostContent.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 border-2 border-purple-700 border-b-5 active:border-b-2 active:translate-y-[3px] text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:translate-y-0 disabled:border-b-2"
                >
                  {submittingPost ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Post Update
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Posts Log */}
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredPosts.length === 0 ? (
                <div className="bg-[#faf6eb] p-8 rounded-2xl border-2 border-[#ebdcb9] text-center text-amber-800/40 text-xs font-semibold">
                  💬 No posts recorded yet in {activeNbDetails?.name || 'this sector'}. Start the conversation!
                </div>
              ) : (
                filteredPosts.map((post) => {
                  const alreadyUpvoted = (post.upvotedByUserIds || []).includes(currentUser.id);
                  return (
                    <div 
                      key={post.id} 
                      className="bg-white border-2 border-purple-300 rounded-[20px] p-4 shadow-[0_4px_12px_rgba(124,45,18,0.06)] space-y-3 transition-all hover:border-purple-400"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-sm">
                            {post.avatar || '🛡️'}
                          </span>
                          <div>
                            <span className="font-black text-amber-950 text-xs block">
                              {post.author}
                            </span>
                            <span className="text-amber-800/40 text-[9px] font-bold">
                              {post.timestamp ? new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] bg-[#faf6eb] border border-[#ebdcb9] px-2 py-0.5 rounded font-mono text-amber-800 font-black">
                          #{post.neighborhoodName || 'Sector'}
                        </span>
                      </div>

                      <p className="text-xs text-amber-900 leading-relaxed font-semibold">
                        {post.content}
                      </p>

                      <div className="flex gap-4 border-t border-[#ebdcb9]/60 pt-2.5 text-[10px] font-bold">
                        <button 
                          onClick={() => handleUpvotePost(post.id)}
                          className={`flex items-center gap-1 transition-colors cursor-pointer ${
                            alreadyUpvoted 
                              ? 'text-orange-600' 
                              : 'text-amber-800/40 hover:text-orange-500'
                          }`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                          Upvotes ({post.upvotes || 0})
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Side-by-Side Mini-Leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t-2 border-dashed border-[#ebdcb9]">
        {/* Citizen rankings */}
        <div className="bg-white border-2 border-amber-300 p-4 rounded-[20px] space-y-3 shadow-[0_8px_20px_rgba(124,45,18,0.08)]">
          <div className="flex justify-between items-center">
            <h4 className="font-display font-black text-amber-950 text-sm flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-orange-500" />
              Citizen Rankings
            </h4>
            
            <div className="flex bg-[#faf6eb] p-0.5 rounded-lg border border-[#ebdcb9]">
              <button
                onClick={() => setCitizenFilter('neighborhood')}
                className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                  citizenFilter === 'neighborhood' ? 'bg-orange-500 text-white font-black' : 'text-amber-800/50'
                }`}
              >
                Local
              </button>
              <button
                onClick={() => setCitizenFilter('all')}
                className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                  citizenFilter === 'all' ? 'bg-orange-500 text-white font-black' : 'text-amber-800/50'
                }`}
              >
                Citywide
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {rankedCitizens.map((item, idx) => {
              const isCurrent = item.id === currentUser.id;
              return (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    isCurrent 
                      ? 'bg-orange-50 border-orange-200 text-orange-950 shadow-inner' 
                      : 'bg-[#faf6eb]/30 border-[#ebdcb9]/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-amber-800/40 text-[10px] w-4">
                      #{idx + 1}
                    </span>
                    <span className="text-base">{isCurrent ? '🌟' : idx === 0 ? '👑' : '🛡️'}</span>
                    <div>
                      <span className="font-extrabold text-amber-950 flex items-center gap-1">
                        {item.name}
                        {isCurrent && <span className="px-1 py-0.25 bg-orange-500 text-white text-[7px] font-bold rounded">YOU</span>}
                      </span>
                      <span className="text-[8.5px] text-amber-800/40 block font-bold">
                        {item.titles[0] || 'Civic Guardian'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono text-[9.5px]">
                    <span className="text-amber-950 font-black block">Level {item.level}</span>
                    <span className="text-amber-800/40 font-bold">{item.xp} XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Neighborhood rankings */}
        <div className="bg-white border-2 border-amber-300 p-4 rounded-[20px] space-y-3 shadow-[0_8px_20px_rgba(124,45,18,0.08)]">
          <h4 className="font-display font-black text-amber-950 text-sm flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-orange-500" />
            Sector Rankings
          </h4>

          <div className="space-y-2">
            {rankedNeighborhoods.map((nb, idx) => {
              const belongsToUser = currentUser.neighborhoodIds?.includes(nb.id);
              const computedCommLevel = Math.floor(nb.communityXP / 300) + 1;
              const nextLevelXp = computedCommLevel * 300;
              const prevLevelXp = (computedCommLevel - 1) * 300;
              const currentLevelProgressXp = nb.communityXP - prevLevelXp;
              const levelProgressPct = Math.min(100, (currentLevelProgressXp / 300) * 100);

              return (
                <div
                  key={nb.id}
                  className={`p-3 rounded-xl border flex flex-col gap-2 ${
                    belongsToUser ? 'bg-orange-50/20 border-orange-200' : 'bg-[#faf6eb]/30 border-[#ebdcb9]/40'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-amber-800/40">#{idx + 1}</span>
                      <div>
                        <span className="font-extrabold text-amber-950">{nb.name}</span>
                        <span className="text-[8.5px] font-bold text-orange-600 block">Lvl {computedCommLevel} Sector</span>
                      </div>
                    </div>
                    <div className="text-right font-mono text-[9.5px]">
                      <span className="text-amber-950 font-black block">{nb.communityXP} XP</span>
                      <span className="text-amber-800/40 font-bold">{currentLevelProgressXp}/300 to next level</span>
                    </div>
                  </div>

                  <div className="w-full bg-white h-1.5 rounded-full border border-[#ebdcb9] overflow-hidden">
                    <div 
                      className="h-full bg-orange-400 rounded-full transition-all duration-500"
                      style={{ width: `${levelProgressPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
