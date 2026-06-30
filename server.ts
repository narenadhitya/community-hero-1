import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc, query, where, getDoc } from "firebase/firestore";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Initialize Firebase for the server-side SLA monitor
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// SLA Monitor function: Checks every 30 seconds for SLA breaches
function startSlaMonitor() {
  setInterval(async () => {
    try {
      console.log("[SLA Monitor] Checking for breached issues...");
      const issuesRef = collection(db, "issues");
      const q = query(issuesRef, where("status", "in", ["routed", "in_progress"]));
      const querySnapshot = await getDocs(q);

      for (const issueDoc of querySnapshot.docs) {
        const issue = issueDoc.data();
        if (issue.isEscalated) continue;

        if (issue.slaDeadline) {
          const deadlineDate = new Date(issue.slaDeadline);
          const now = new Date();

          if (now > deadlineDate) {
            console.log(`[SLA Monitor] Issue SLA breached: ${issueDoc.id} - "${issue.title}"`);

            // 1. Fetch Department info
            let deptName = "Municipal Service Team";
            let currentScore = 80;
            if (issue.departmentId) {
              const deptRef = doc(db, "departments", issue.departmentId);
              const deptSnap = await getDoc(deptRef);
              if (deptSnap.exists()) {
                const deptData = deptSnap.data();
                deptName = deptData.name || deptName;
                currentScore = typeof deptData.accountabilityScore === "number" ? deptData.accountabilityScore : currentScore;
              }
            }

            // 2. Draft escalation message with Gemini
            let escalationMessage = "";
            try {
              const prompt = `Draft a short, formal escalation message addressed to the "${deptName}" department regarding a breached Service Level Agreement (SLA) for the following citizen-reported hazard:
              
              Hazard Title: "${issue.title || "Hazard repair"}"
              Hazard Type: "${issue.type || "General"}"
              Description: "${issue.description || "Unresolved hazard in the sector"}"
              SLA Deadline: ${issue.slaDeadline} (expired at ${deadlineDate.toLocaleString()})
              
              The message must be professional, direct, and formal. State that the emergency response window has expired without resolution, and request immediate field deployment and status updates. Do not use placeholders or generic text; write the full final letter body. Keep it concise (under 100 words).`;

              const response = await ai.models.generateContent({
                model: "gemini-3.5-flash",
                contents: prompt,
              });

              escalationMessage = response.text?.trim() || "";
            } catch (geminiErr) {
              console.error("[SLA Monitor] Gemini API call failed:", geminiErr);
              escalationMessage = `URGENT ESCALATION: The SLA deadline of ${deadlineDate.toLocaleString()} for issue "${issue.title || "Hazard repair"}" has expired. The assigned department "${deptName}" has failed to resolve this within the designated window. Immediate response and intervention is required to restore neighborhood safety.`;
            }

            // 3. Store in "escalations" collection
            const escalationId = `escalation_${issueDoc.id}_${Date.now()}`;
            await setDoc(doc(db, "escalations", escalationId), {
              id: escalationId,
              issueId: issueDoc.id,
              issueTitle: issue.title || "Hazard Repair",
              departmentId: issue.departmentId || "roads",
              departmentName: deptName,
              escalationMessage: escalationMessage,
              timestamp: new Date().toISOString(),
            });

            // 4. Lower department accountabilityScore slightly (by 5 points, clamped at 0)
            if (issue.departmentId) {
              const deptRef = doc(db, "departments", issue.departmentId);
              const newScore = Math.max(0, currentScore - 5);
              await updateDoc(deptRef, {
                accountabilityScore: newScore
              });
              console.log(`[SLA Monitor] Decremented ${issue.departmentId} accountabilityScore to ${newScore}`);
            }

            // 5. Update issue to mark as escalated
            const issueRef = doc(db, "issues", issueDoc.id);
            await updateDoc(issueRef, { isEscalated: true });
            console.log(`[SLA Monitor] Marked issue ${issueDoc.id} as escalated.`);
          }
        }
      }
    } catch (err) {
      console.error("[SLA Monitor] Error running background SLA check:", err);
    }
  }, 30000); // 30 seconds
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '10mb' }));

  // API Route: Multimodal image classification and assessment using Gemini
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { imageBase64, mimeType, imageUrl } = req.body;
      
      let rawBase64 = "";
      let actualMimeType = mimeType || "image/jpeg";

      if (imageBase64) {
        rawBase64 = imageBase64;
        if (imageBase64.includes(";base64,")) {
          const parts = imageBase64.split(";base64,");
          rawBase64 = parts[1];
          actualMimeType = parts[0].replace("data:", "");
        }
      } else if (imageUrl) {
        // Fetch image on server to convert it to base64 safely without CORS
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
          throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
        }
        const arrayBuffer = await imgRes.arrayBuffer();
        rawBase64 = Buffer.from(arrayBuffer).toString("base64");
        const contentType = imgRes.headers.get("content-type");
        if (contentType) {
          actualMimeType = contentType;
        }
      } else {
        return res.status(400).json({ error: "Missing imageBase64 or imageUrl" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: actualMimeType,
              data: rawBase64,
            },
          },
          "Analyze this neighborhood hazard/infrastructure issue photo. Determine the issueType, severity (0-1), provide a short specific title, a 2-3 sentence technical description as if written by an inspector, and your confidence score (0-1)."
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              issueType: {
                type: Type.STRING,
                description: "Must be exactly one of: 'pothole', 'broken_streetlight', 'water_leak', 'waste_problem', or 'other'."
              },
              severity: {
                type: Type.NUMBER,
                description: "Severity rating from 0.0 (negligible) to 1.0 (critically dangerous blocking streets)."
              },
              title: {
                type: Type.STRING,
                description: "Short, highly specific title of the issue."
              },
              description: {
                type: Type.STRING,
                description: "A 2-3 sentence description written objectively in the tone of a professional city inspector assessing public hazards."
              },
              confidenceScore: {
                type: Type.NUMBER,
                description: "Confidence score between 0.0 and 1.0 of the classification."
              }
            },
            required: ["issueType", "severity", "title", "description", "confidenceScore"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response text received from Gemini API");
      }

      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err: any) {
      console.error("Gemini API Error in /api/gemini/analyze:", err);
      res.status(500).json({ error: err.message || "Internal server error during analysis" });
    }
  });

  // API Route: Smart issue routing and SLA assignment using Gemini
  app.post("/api/gemini/route-issue", async (req, res) => {
    try {
      const { type, description, title } = req.body;
      
      const prompt = `You are a city dispatch router. Read the following issue details:
      Issue Title: ${title || ""}
      Issue Type: ${type || ""}
      Issue Description: ${description || ""}

      Determine which of the following 5 departments is the most appropriate to resolve this issue:
      1. 'roads' - Handles road repairs, potholes, sidewalks, fading crosswalk paint/lines, street signs, and traffic signals.
      2. 'water_drainage' - Handles water leaks, broken water mains, clogged storm drains, flooding, water enterprise, and fire hydrants.
      3. 'electrical_lighting' - Handles broken streetlights, dark spaces, exposed electrical wiring, and historical lamp posts.
      4. 'sanitation' - Handles public waste, illegal trash dumping, litter, overflowing public trash containers, and neighborhood cleanliness.
      5. 'parks_environment' - Handles park pathways, historical park structures, green spaces, public parks, and buckled sidewalk trees or environments.

      Select the exact ID of the best department and provide a short, professional, 1-sentence explanation of why it was selected.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              departmentId: {
                type: Type.STRING,
                description: "Must be exactly one of: 'roads', 'water_drainage', 'electrical_lighting', 'sanitation', or 'parks_environment'."
              },
              explanation: {
                type: Type.STRING,
                description: "A short professional 1-sentence explanation of the routing selection."
              }
            },
            required: ["departmentId", "explanation"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response text received from Gemini API");
      }

      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err: any) {
      console.error("Gemini API Error in /api/gemini/route-issue:", err);
      res.status(500).json({ error: err.message || "Internal server error during routing" });
    }
  });

  // API Route: Predictive insights using Gemini
  app.post("/api/gemini/predictive-insights", async (req, res) => {
    try {
      const { newIssue, historicalIssues } = req.body;
      
      const prompt = `You are an expert city hazards data analyst. Analyze this newly reported issue alongside existing historical issues in the same neighborhood to detect any shared underlying risk pattern (e.g., systemic water main leaks causing potholes nearby, power outages affecting streetlights, etc.).
      
      NEW ISSUE:
      - Title: "${newIssue.title || ""}"
      - Type: "${newIssue.type || ""}"
      - Description: "${newIssue.description || ""}"
      - Location: (Lat ${newIssue.location?.lat || ""}, Lng ${newIssue.location?.lng || ""})
      - Date: "${newIssue.reportedAt || ""}"
      
      HISTORICAL ISSUES:
      ${(historicalIssues || []).map((h: any) => `- ID: ${h.id}, Title: "${h.title}", Type: "${h.type}", Location: (Lat ${h.location?.lat}, Lng ${h.location?.lng}), Reported: ${h.reportedAt}`).join("\n")}
      
      Provide:
      1. A riskScore (0-1) for the surrounding area in the next 30 days.
      2. An array of up to 3 relatedIssueIds from the historical list that share a pattern with this new issue.
      3. An explanation (strictly 1 sentence) describing the shared cause or pattern (e.g., "Water infrastructure leaks are undermining the street surface, risking pothole expansion in the sector.").
      
      Return structured JSON matching the specified schema.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              riskScore: {
                type: Type.NUMBER,
                description: "Risk score from 0.0 (low) to 1.0 (high) for the surrounding area in the next 30 days."
              },
              relatedIssueIds: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING
                },
                description: "IDs of up to 3 historical issues that share a pattern or are close to this new issue."
              },
              explanation: {
                type: Type.STRING,
                description: "Strictly one professional sentence describing the shared cause or pattern."
              }
            },
            required: ["riskScore", "relatedIssueIds", "explanation"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response text received from Gemini API");
      }

      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err: any) {
      console.error("Gemini API Error in /api/gemini/predictive-insights:", err);
      res.status(500).json({ error: err.message || "Internal server error during predictive insight calculation" });
    }
  });

  // API Route: AI-generated Neighborhood Digest using Gemini
  app.post("/api/gemini/neighborhood-digest", async (req, res) => {
    try {
      const { neighborhoodName, healthScores, openIssueCount, recentIssues } = req.body;

      const prompt = `You are a warm, supportive, and friendly community leader and neighborhood organizer. Write an AI-generated "Neighborhood Digest" card for "${neighborhoodName}".

      Current Health Scores:
      ${JSON.stringify(healthScores || {})}

      Total Open Issues (Unresolved Hazards): ${openIssueCount || 0}
      
      Recent Reported Issues in the neighborhood:
      ${(recentIssues || []).map((t: string) => `- "${t}"`).join("\n")}

      Task:
      1. Write a friendly, encouraging, and engaging 3-sentence summary of the current status of "${neighborhoodName}" based on its health scores, issues, and activity. Keep the tone warm, welcoming, and community-spirited (inspired by a cozy Mediterranean village spirit).
      2. Provide one highly specific suggestion for a resident (e.g., a relevant volunteer opportunity like checking a streetlamp, reporting cleanliness, attending a cleanup drive, or verifying a specific open issue). This suggestion should be actionable and short.
      
      Return a structured JSON object. No markdown, no HTML. Matches the specified schema.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: "Exactly a warm, encouraging 3-sentence summary of the neighborhood state."
              },
              suggestion: {
                type: Type.STRING,
                description: "One highly specific, short, actionable suggestion/call-to-action for local residents."
              }
            },
            required: ["summary", "suggestion"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response text received from Gemini API");
      }

      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err: any) {
      console.error("Gemini API Error in /api/gemini/neighborhood-digest:", err);
      res.status(500).json({ error: err.message || "Internal server error during neighborhood digest generation" });
    }
  });

  // Serve Vite app
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start background SLA monitoring loop
  startSlaMonitor();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
