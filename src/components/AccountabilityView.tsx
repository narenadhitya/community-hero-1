import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Department } from "../types";
import { Shield, Clock, CheckCircle2, AlertTriangle, ChevronRight, FileText, Calendar, Building, Sparkles } from "lucide-react";

interface AccountabilityViewProps {
  departments: Department[];
  onRefreshData?: () => void;
}

interface EscalationLog {
  id: string;
  issueId: string;
  issueTitle: string;
  departmentId: string;
  departmentName: string;
  escalationMessage: string;
  timestamp: string;
}

export default function AccountabilityView({ departments, onRefreshData }: AccountabilityViewProps) {
  const [escalations, setEscalations] = useState<EscalationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEscalationId, setExpandedEscalationId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Subscribe to live escalations
  useEffect(() => {
    const escalationsRef = collection(db, "escalations");
    const q = query(escalationsRef, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: EscalationLog[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as EscalationLog);
        });
        setEscalations(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to escalations:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Department metadata with Mediterranean warm descriptions and icons
  const getDeptMeta = (id: string) => {
    switch (id) {
      case "roads":
        return {
          icon: "🧱",
          description: "Charming stone roads, coastal stairs, brick walk lanes, and terracotta pavement tiles.",
          color: "border-amber-200 bg-amber-50/50",
          textColor: "text-amber-800"
        };
      case "water_drainage":
        return {
          icon: "⛲",
          description: "Water mains, historic harbor pumps, marine water filtration, and public water fountains.",
          color: "border-sky-200 bg-sky-50/50",
          textColor: "text-sky-800"
        };
      case "electrical_lighting":
        return {
          icon: "🏮",
          description: "Solar post lanterns, dusk-sensing pier arches, maritime light towers, and fiber lines.",
          color: "border-indigo-200 bg-indigo-50/50",
          textColor: "text-indigo-800"
        };
      case "sanitation":
        return {
          icon: "🧺",
          description: "Litter collection, seaweed sweeps, composting vessels, and recycling terracotta bins.",
          color: "border-orange-200 bg-orange-50/50",
          textColor: "text-orange-800"
        };
      case "parks_environment":
        return {
          icon: "🍋",
          description: "Palm rows, vertical lemon trellises, public harbor gardens, and historic park walls.",
          color: "border-emerald-200 bg-emerald-50/50",
          textColor: "text-emerald-800"
        };
      default:
        return {
          icon: "🏛️",
          description: "General municipal civil dispatch and public sector response teams.",
          color: "border-[#ebdcb9] bg-[#faf6eb]",
          textColor: "text-amber-950"
        };
    }
  };

  const filteredEscalations = activeFilter === "all"
    ? escalations
    : escalations.filter(e => e.departmentId === activeFilter);

  // Overall performance calculations
  const topDepartment = departments.length > 0 
    ? [...departments].sort((a, b) => b.accountabilityScore - a.accountabilityScore)[0] 
    : null;

  const totalEscalations = escalations.length;

  return (
    <div className="space-y-8 pb-16">
      {/* Transparency Header Banner */}
      <div className="bg-white p-6 rounded-3xl border-3 border-[#ebdcb9] shadow-soft relative overflow-hidden">
        {/* Soft background accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full blur-2xl opacity-40 -mr-10 -mt-10" />
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border-2 border-emerald-200 text-[10px] font-black rounded-full uppercase tracking-widest flex items-center gap-1">
              <Shield className="w-3 h-3" /> Citizens' Transparency Portal
            </span>
            {onRefreshData && (
              <button 
                onClick={onRefreshData}
                className="text-xs text-amber-700 hover:text-amber-950 font-bold underline cursor-pointer"
              >
                Sync Data
              </button>
            )}
          </div>
          <h2 className="text-3xl font-display font-black text-[#7c2d12] tracking-tight">
            Department Accountability
          </h2>
          <p className="text-amber-800/60 text-xs font-semibold max-w-2xl">
            Real-time public performance tracking of our municipal guilds. We monitor SLA target times, citizen escalations, and reward immediate service with higher trust ratings.
          </p>
        </div>
      </div>

      {/* Trust & Transparency Dashboard Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Performer Card */}
        <div className="bg-white p-6 rounded-3xl border-3 border-[#ebdcb9] shadow-soft flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl border-2 border-amber-300">
            <Sparkles className="w-6 h-6 animate-pulse-gentle" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-amber-800/50 block">
              Top Guild Performance
            </span>
            <span className="font-display font-black text-amber-950 text-base block truncate mt-0.5">
              {topDepartment ? topDepartment.name : "Analyzing Sectors..."}
            </span>
            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
              ⭐ {topDepartment ? `${topDepartment.accountabilityScore}% Trust Score` : "N/A"}
            </span>
          </div>
        </div>

        {/* Global SLA target */}
        <div className="bg-white p-6 rounded-3xl border-3 border-[#ebdcb9] shadow-soft flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-sky-100 text-sky-800 rounded-2xl border-2 border-sky-300">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-sky-800/50 block">
              Emergency SLA Target
            </span>
            <span className="font-display font-black text-amber-950 text-base block mt-0.5">
              3.0 Minutes Demo Limit
            </span>
            <span className="text-xs text-sky-650 font-semibold block mt-0.5">
              Continuous 30s scans active
            </span>
          </div>
        </div>

        {/* Total Escalations */}
        <div className="bg-white p-6 rounded-3xl border-3 border-[#ebdcb9] shadow-soft flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-orange-100 text-orange-800 rounded-2xl border-2 border-orange-300">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-orange-800/50 block">
              Active Escaped SLAs
            </span>
            <span className="font-display font-black text-amber-950 text-base block mt-0.5">
              {totalEscalations} Total Escalations
            </span>
            <span className="text-xs text-orange-600 font-semibold block mt-0.5">
              Dispatched to supervisors
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Column Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Hand: Department Performance Cards */}
        <div className="lg:col-span-7 space-y-6">
          <h3 className="text-lg font-display font-black text-amber-950 flex items-center gap-2">
            <Building className="w-5 h-5 text-amber-800" /> Municipal Guild Ratings
          </h3>

          <div className="space-y-4">
            {departments.map((dept) => {
              const meta = getDeptMeta(dept.id);
              const rating = dept.accountabilityScore;
              
              // Determine badge based on accountabilityScore
              let ratingBadge = "Bronze Standard";
              let ratingColor = "bg-amber-100 text-amber-800 border-amber-300";
              if (rating >= 90) {
                ratingBadge = "Stellar Coastal Shield";
                ratingColor = "bg-emerald-100 text-emerald-800 border-emerald-300";
              } else if (rating >= 80) {
                ratingBadge = "Silver Merit";
                ratingColor = "bg-sky-100 text-sky-800 border-sky-300";
              } else if (rating < 70) {
                ratingBadge = "SLA Deficit Warning";
                ratingColor = "bg-red-100 text-red-800 border-red-300 animate-pulse";
              }

              return (
                <div 
                  key={dept.id} 
                  className="bg-white rounded-3xl border-3 border-[#ebdcb9] p-5 shadow-soft transition-all hover:scale-[1.01]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl p-1.5 bg-[#faf6eb] rounded-xl border border-[#ebdcb9]">
                        {meta.icon}
                      </span>
                      <div>
                        <h4 className="font-display font-black text-amber-950 text-base">
                          {dept.name}
                        </h4>
                        <p className="text-[11px] text-amber-800/60 font-semibold max-w-sm mt-0.5 leading-tight">
                          {meta.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-start sm:items-end gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border-2 bg-white shadow-sm flex items-center gap-1">
                        🏆 Score: <strong className="text-amber-950">{rating}%</strong>
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${ratingColor}`}>
                        {ratingBadge}
                      </span>
                    </div>
                  </div>

                  {/* Accountability rating progress bar */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-[10px] font-bold text-amber-800/60">
                      <span>Civic Accountability Level</span>
                      <span>{rating} / 100</span>
                    </div>
                    <div className="w-full bg-[#faf6eb] h-3.5 rounded-full border-2 border-[#ebdcb9] overflow-hidden p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          rating >= 85 ? "bg-emerald-500" : rating >= 75 ? "bg-orange-400" : "bg-red-500"
                        }`}
                        style={{ width: `${rating}%` }}
                      />
                    </div>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4 bg-[#faf6eb]/50 p-3 rounded-2xl border-2 border-[#f3e9d4] text-xs font-bold text-amber-900">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-700/50" />
                      <div>
                        <span className="text-[9px] text-amber-800/50 block uppercase">Avg Response Time</span>
                        <span className="font-mono text-amber-950 font-black">{dept.avgResponseHours || 4} Hours</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-700/50" />
                      <div>
                        <span className="text-[9px] text-amber-800/50 block uppercase">Fix Verification Rate</span>
                        <span className="font-mono text-amber-950 font-black">
                          {dept.resolutionRate ? `${Math.round(dept.resolutionRate * 100)}%` : "92%"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Hand: Public Escalations Scrollable Log */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-black text-amber-950 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" /> Escalated SLA Letters
            </h3>
            <span className="text-[10px] font-black px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-200 rounded-full">
              LIVE BROADCAST
            </span>
          </div>

          {/* Department Filter Pills */}
          <div className="flex flex-wrap gap-1.5 bg-[#faf6eb] p-1 rounded-2xl border-2 border-[#ebdcb9]">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 text-[10px] font-black rounded-xl transition-all cursor-pointer uppercase ${
                activeFilter === "all" ? "bg-orange-500 text-white shadow-sm" : "text-amber-850/50 hover:text-amber-950"
              }`}
            >
              All Guilds
            </button>
            {departments.map(dept => (
              <button
                key={dept.id}
                onClick={() => setActiveFilter(dept.id)}
                className={`px-3 py-1.5 text-[10px] font-black rounded-xl transition-all cursor-pointer uppercase ${
                  activeFilter === dept.id ? "bg-orange-500 text-white shadow-sm" : "text-amber-850/50 hover:text-amber-950"
                }`}
              >
                {getDeptMeta(dept.id).icon} {dept.name.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* Log List */}
          <div className="space-y-4 max-h-[640px] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              <div className="bg-white p-8 rounded-3xl border-3 border-[#ebdcb9] text-center text-amber-800/60 font-semibold text-xs">
                Syncing escalation log files...
              </div>
            ) : filteredEscalations.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border-3 border-[#ebdcb9] text-center text-amber-800/40 text-xs font-semibold py-12">
                🌸 No escalated breaches recorded for this selection. All guilds are resolving issues within SLA windows!
              </div>
            ) : (
              filteredEscalations.map((esc) => {
                const meta = getDeptMeta(esc.departmentId);
                const isExpanded = expandedEscalationId === esc.id;
                
                return (
                  <div 
                    key={esc.id} 
                    className="bg-white rounded-3xl border-3 border-orange-200 shadow-soft overflow-hidden transition-all relative"
                  >
                    {/* Top warning ribbon */}
                    <div className="bg-orange-50 border-b border-orange-100 px-4 py-2 flex items-center justify-between text-[10px] font-bold text-orange-850">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                        SLA BREACH ESCALATION
                      </span>
                      <span className="font-mono text-orange-800">
                        {new Date(esc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <h4 className="text-xs font-black text-amber-950 tracking-tight">
                          Ref: "{esc.issueTitle}"
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] font-semibold text-amber-800/60">
                          <span className="text-sm">{meta.icon}</span>
                          <span>Escalated to: <strong>{esc.departmentName}</strong></span>
                        </div>
                      </div>

                      {/* Expandable Formal Letter preview */}
                      <div className="border-t border-[#ebdcb9] pt-2.5">
                        {isExpanded ? (
                          <div className="bg-[#fffdf9] p-4 rounded-2xl border-2 border-[#f3e9d4] shadow-inner text-[11px] leading-relaxed font-serif text-amber-950 font-medium space-y-3 relative">
                            {/* Decorative wax seal */}
                            <div className="absolute top-2 right-2 w-7 h-7 bg-orange-700/10 border-2 border-dashed border-orange-700 rounded-full flex items-center justify-center text-[10px] select-none opacity-80 rotate-12">
                              ⚖️
                            </div>
                            
                            <div className="border-b border-dashed border-amber-200 pb-2 mb-2 font-mono text-[9px] text-amber-800/50 uppercase tracking-widest font-black">
                              OFFICIAL CIVIC DISPATCH
                            </div>
                            
                            <p className="whitespace-pre-line">
                              {esc.escalationMessage}
                            </p>

                            <div className="border-t border-dashed border-amber-200 pt-2 font-mono text-[8px] text-amber-800/40 uppercase">
                              TIMESTAMP: {new Date(esc.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-800/80 font-medium line-clamp-2">
                            {esc.escalationMessage}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => setExpandedEscalationId(isExpanded ? null : esc.id)}
                        className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-950 border-2 border-[#ebdcb9] rounded-xl text-[10px] font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3 h-3 text-amber-800" />
                        {isExpanded ? "Hide Formal Letter" : "Read Formal Letter Dispatch"}
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
  );
}
