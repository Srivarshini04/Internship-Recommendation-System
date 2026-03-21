import React, { useState, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { Pie } from "react-chartjs-2";
import "chart.js/auto";

// 3D Imports
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import { inSphere } from "maath/random/dist/maath-random.esm";

// PDF imports
import * as pdfjsLib from "pdfjs-dist";

// Set the worker source for PDF.js
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

// Gemini API Configuration
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

// --- 3D Background Component (Animated Nodes) ---
const AnimatedDotsBackground = (props) => {
  const ref = useRef();
  // Generate random data points for the starfield effect (5000 points * 3 coordinates each)
  const [sphere] = useState(() => inSphere(new Float32Array(5000 * 3), { radius: 1.5 }));

  // Animate the points
  useFrame((state, delta) => {
    ref.current.rotation.x -= delta / 10;
    ref.current.rotation.y -= delta / 15;
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
        <PointMaterial
          transparent
          color="#81E6D9" // Teal color for the nodes
          size={0.005}
          sizeAttenuation={true}
          depthWrite={false}
        />
      </Points>
    </group>
  );
};



// --- Gemini AI Extraction Function ---
const extractDataWithGemini = async (text) => {
    console.log("Extracting data with Gemini AI from text:", text.substring(0, 200) + "...");

    const prompt = `
Extract the following information accurately from the resume text provided below. Return the result as a valid JSON object with exactly these keys: education, skills, sector, location.

- education: The latest education qualification mentioned. Standardize to common abbreviations. Recognize full forms and convert them:
  - Bachelor of Technology / Bachelor of Engineering -> B.Tech
  - Master of Technology / Master of Engineering -> M.Tech
  - Bachelor of Science -> B.Sc
  - Master of Science -> M.Sc
  - Bachelor of Arts -> B.A
  - Master of Arts -> MA
  - Bachelor of Commerce -> B.Com
  - Master of Business Administration -> MBA
  - Bachelor of Computer Applications -> BCA
  - Master of Computer Applications -> MCA
  - Doctor of Philosophy -> PhD
  - And similar for other qualifications. If the qualification is "12th Pass" or equivalent, use "12th Pass". If none found, use "Any Graduate".
- skills: An array of the most relevant technical skills mentioned, limited to 5-10 skills (e.g., ["Python", "JavaScript", "Machine Learning"]). Prioritize skills from recent experience. If none, use ["General Skills"].
- sector: Accurately infer the preferred sector based on the branch in their latest education qualification and recent skills/experience. For example, if education is "B.Tech in Computer Science", infer "IT" or "Software Development"; if "B.Tech in Mechanical Engineering", infer "Automotive" or "Industrial"; if "MBA", infer "Finance" or "Consulting"; if "B.Sc in Data Science", infer "Data Science". Use "IT" as default if unclear.
- location: Preferred location or city mentioned, focusing on the most recent or preferred one (e.g., "Bangalore", "Mumbai", "Remote"). If none, use "Remote".

Resume Text:
${text}

Output only the JSON object, no additional text.
`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    education: { type: "STRING" },
                    skills: { type: "ARRAY", items: { type: "STRING" } },
                    sector: { type: "STRING" },
                    location: { type: "STRING" }
                },
                required: ["education", "skills", "sector", "location"]
            }
        }
    };

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonString) {
            const parsed = JSON.parse(jsonString);
            console.log("Gemini extracted data:", parsed);
            return parsed;
        } else {
            throw new Error("No response content from Gemini API.");
        }
    } catch (err) {
        console.error("Gemini extraction error:", err);
        throw err;
    }
};

// --- Main Application Component ---
function App() {
  const [education, setEducation] = useState("");
  const [skillsInput, setSkillsInput] = useState(""); // Raw input for skills
  const [skills, setSkills] = useState([]); // Processed skill tags
  const [sector, setSector] = useState("");
  const [location, setLocation] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");

  const sectors = ["Advertising", "Aerospace", "Automotive", "BPO", "Blockchain", "Consulting", "Construction", "Content", "Cybersecurity", "Design", "E-Commerce", "EdTech", "Energy", "Entertainment", "FMCG", "Finance","Food Tech", "Gaming", "HR", "Hardware", "IT", "IT Services", "Industrial", "Legal", "Media", "Medical Devices", "Mobility", "Networking", "Oil&Gas", "Pharma", "Semiconductor", "Software", "Tech", "Telecom"];
  const locations = ["Bangaluru", "Bangalore", "Chennai", "Delhi", "Gurugram", "Hyderabad", "Jaipur", "Kolkata", "Mumbai", "Navi Mumbai", "Noida", "Pune", "Remote", "WFH"];
  const educationOptions = ["12th Pass", "Any", "Any Graduate", "B.A", "B.com", "B.Des", "B.Pharm", "B.Sc", "B.Tech", "BBA", "CA", "CFA", "CMA", "Diploma", "LLB", "LLM", "M.Des", "M.S", "M.Sc", "M.Tech", "MA", "MBA", "MCA", "PGDM", "PhD"];

  // --- File Upload and Extraction ---
  const handleFileChange = (e) => {
    console.log("handleFileChange called, files:", e.target.files);
    const file = e.target.files[0];
    console.log("File selected:", file);
    if (file) {
      console.log("File type:", file.type, "Size:", file.size);
      setError("");
      extractResumeData(file);
    } else {
      console.log("No file selected");
      setError("No file selected. Please choose a PDF or TXT file.");
    }
  };

  const extractResumeData = async (file) => {
    setExtracting(true);
    setError("");
    console.log("Starting extraction for file:", file.name, "Type:", file.type, "Size:", file.size);

    try {
      let text = "";
      // 1. Extract raw text from PDF or TXT
      if (file.type === "text/plain") {
        console.log("Processing as text file");
        text = await file.text();
        console.log("Extracted text length:", text.length);
      } else if (file.type === "application/pdf") {
        console.log("Processing as PDF file");
        const arrayBuffer = await file.arrayBuffer();
        console.log("ArrayBuffer size:", arrayBuffer.byteLength);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log("PDF loaded, pages:", pdf.numPages);
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => (item.str || "")).join(" ");
        }
        console.log("Extracted text length from PDF:", text.length);
      } else {
        console.error("Unsupported file type:", file.type);
        throw new Error("Unsupported file type. Please upload a PDF or TXT file.");
      }

      if (text.length < 50) {
        console.error("Text too short:", text.length);
        throw new Error("Extracted text is too short. Ensure your PDF is text-selectable and not a scanned image.");
      }

      console.log("Extracting data with Gemini AI from text:", text.substring(0, 200) + "...");
      // 2. Use Gemini AI to parse structured data from the raw text
      const extracted = await extractDataWithGemini(text);
      console.log("Extracted data:", extracted);

      // 3. Update state with AI results
      setEducation(extracted.education || "");
      setSkills(extracted.skills || []);
      setSector(extracted.sector || "");
      setLocation(extracted.location || "");

    } catch (err) {
      console.error("Extraction error:", err);
      setError(`AI Extraction Failed. Error: ${err.message}. Please check your API key and file content.`);
    } finally {
      setExtracting(false);
    }
  };

  // --- Skill Tag Management ---
  const handleAddSkill = (e) => {
    if (e.key === 'Enter' && skillsInput.trim() !== '') {
      const newSkills = skillsInput.split(',').map(s => s.trim()).filter(s => s !== '');
      setSkills(prev => [...new Set([...prev, ...newSkills])]); // Add unique skills
      setSkillsInput('');
      e.preventDefault();
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  // Update state when skillsInput changes for seamless comma input
  const handleInputChange = (e) => {
    setSkillsInput(e.target.value);
  }

  // --- API Submission Logic ---
  const handleSubmit = async () => {
    // Final check to process any skill text left in the input field before submission
    const finalSkills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .concat(skills);
      
    const uniqueSkills = [...new Set(finalSkills)];
    setSkills(uniqueSkills); // Update skills state with any final entries
    setSkillsInput(''); // Clear the input field

    setLoading(true);
    setShowResults(false);
    setRecommendations([]);

    try {
      // NOTE: Using uniqueSkills for the API call
      const res = await axios.post("http://127.0.0.1:8000/recommendations", {
        education,
        skills: uniqueSkills,
        sector,
        location,
      });
      setRecommendations(res.data.recommendations);
      setShowResults(true);
    } catch (err) {
      console.error("API Error:", err);
      // In a real app, you'd show a user-friendly error message here
    }
    setLoading(false);
  };

  // --- Chart Data Processing ---
  const chartData = {
    labels: recommendations.slice(0, 5).map(r => r.Title), // Top 5 for cleaner chart
    datasets: [
      {
        label: "Match Score",
        data: recommendations.slice(0, 5).map(r => r.Score),
        backgroundColor: [
          "#10B981", // Emerald
          "#3B82F6", // Blue
          "#F97316", // Orange
          "#EC4899", // Pink
          "#8B5CF6", // Violet
        ],
        borderColor: "#1F2937",
        borderWidth: 1,
      },
    ],
  };

  const animationVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-inter">
      {/* 1. HERO SECTION (3D Background) */}
      <section className="relative h-[60vh] md:h-[70vh] flex items-center justify-center overflow-hidden rounded-b-3xl shadow-2xl shadow-teal-500/10">
        
        {/* 3D Canvas for Animated Nodes */}
        <div className="absolute inset-0 z-0 opacity-50">
          <Canvas camera={{ position: [0, 0, 1] }}>
            <Suspense fallback={null}>
              <AnimatedDotsBackground />
            </Suspense>
          </Canvas>
        </div>

        {/* Hero Content */}
        <motion.div 
          className="relative z-10 text-center p-6 md:p-12 bg-black bg-opacity-30 rounded-xl backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-7xl font-extrabold leading-tight text-white drop-shadow-lg">
            InternQuest – Your journey to the perfect internship.
          </h1>
          <p className="mt-4 text-xl md:text-2xl font-light text-teal-300">
            Find the internship you’ve always dreamed of, powered by intelligent matching
          </p>
          <motion.a
            href="#profile-form"
            className="mt-8 inline-block px-10 py-4 bg-teal-500 hover:bg-teal-400 text-gray-900 font-bold text-lg rounded-full transition-all duration-300 shadow-xl shadow-teal-500/50 hover:shadow-2xl hover:scale-105"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Find Your Path 🚀
          </motion.a>
        </motion.div>
      </section>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-16 md:px-8">

        {/* 2. HOW IT WORKS SECTION */}
        <motion.section 
          className="mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          transition={{ staggerChildren: 0.2 }}
        >
          <h2 className="text-4xl font-bold text-center mb-12 text-teal-400">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <motion.div variants={animationVariants} className="bg-gray-800 p-8 rounded-xl shadow-2xl border-t-4 border-blue-500 text-center hover:shadow-blue-500/20 transition-shadow">
              <span className="text-5xl mb-4 inline-block">🧠</span>
              <h3 className="text-2xl font-semibold mb-2 text-white">Smart Matching</h3>
              <p className="text-gray-400">Our advanced algorithm connects your unique profile to the perfect Internship opportunities.</p>
            </motion.div>
            {/* Step 2 */}
            <motion.div variants={animationVariants} className="bg-gray-800 p-8 rounded-xl shadow-2xl border-t-4 border-teal-500 text-center hover:shadow-teal-500/20 transition-shadow">
              <span className="text-5xl mb-4 inline-block">🎯</span>
              <h3 className="text-2xl font-semibold mb-2 text-white">Personalized Insights</h3>
              <p className="text-gray-400">Receive data-driven recommendations and match scores tailored just for you.</p>
            </motion.div>
            {/* Step 3 */}
            <motion.div variants={animationVariants} className="bg-gray-800 p-8 rounded-xl shadow-2xl border-t-4 border-pink-500 text-center hover:shadow-pink-500/20 transition-shadow">
              <span className="text-5xl mb-4 inline-block">📈</span>
              <h3 className="text-2xl font-semibold mb-2 text-white">Career Growth</h3>
              <p className="text-gray-400">Take the next step in your Internship journey with confidence and clarity.</p>
            </motion.div>
          </div>
        </motion.section>

        {/* 3. INPUT FORM SECTION */}
        <motion.section
          id="profile-form"
          className="bg-gray-800 p-8 rounded-xl shadow-2xl shadow-gray-700/50 mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-6 text-white border-b border-gray-700 pb-3">Upload Your Resume</h2>

          {/* Resume Upload Section */}
          <div className="mb-8">
            <label htmlFor="resume-upload" className="block mb-2 text-white font-medium">
              Upload Your Resume (PDF or TXT)
            </label>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => {
                console.log("File input onChange triggered", e.target.files);
                handleFileChange(e);
              }}
              className="p-3 border border-gray-600 rounded-lg bg-gray-700 text-white w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-500 file:text-gray-900 hover:file:bg-teal-400 transition cursor-pointer"
              id="resume-upload"
            />
            {extracting && <p className="text-teal-400 mt-2">Extracting resume data... Please wait.</p>}
            {error && <p className="text-red-400 mt-2">{error}</p>}
          </div>

          {/* Note about extraction method */}
          <div className="mb-8 p-4 bg-blue-900/50 rounded-lg border border-blue-500">
            <p className="text-blue-300 text-sm">
              <strong>Note:</strong> Resume data is extracted using Google Gemini AI for intelligent parsing.
              For best results, ensure your resume contains clear mentions of education, skills, and location preferences.
            </p>
          </div>

          <h3 className="text-2xl font-bold mb-4 text-white">Or Define Your Profile Manually</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">

            {/* Education Dropdown */}
            <select className="p-3 border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-teal-500 focus:border-teal-500 transition" value={education} onChange={(e) => setEducation(e.target.value)}>
              <option value="" disabled>Select Education</option>
              {educationOptions.map((edu, idx) => (
                <option key={idx} value={edu}>{edu}</option>
              ))}
            </select>

            {/* Sector Dropdown */}
            <select className="p-3 border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-teal-500 focus:border-teal-500 transition" value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="" disabled>Select Target Sector</option>
              {sectors.map((s, idx) => (
                <option key={idx} value={s}>{s}</option>
              ))}
            </select>

            {/* Location Dropdown */}
            <select className="p-3 border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-teal-500 focus:border-teal-500 transition" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="" disabled>Select Location</option>
              {locations.map((l, idx) => (
                <option key={idx} value={l}>{l}</option>
              ))}
            </select>

            {/* Skills Input (Tag System) */}
            <div className="lg:col-span-4">
              <input
                type="text"
                className="p-3 border border-gray-600 rounded-lg bg-gray-700 text-white w-full focus:ring-teal-500 focus:border-teal-500 transition"
                placeholder="Enter skills (separated by comma or press Enter)"
                value={skillsInput}
                onChange={handleInputChange}
                onKeyDown={handleAddSkill}
              />
              <div className="mt-3 flex flex-wrap gap-2 min-h-[30px]">
                {skills.map((skill, index) => (
                  <motion.span
                    key={index}
                    className="px-3 py-1 text-sm bg-teal-500 text-gray-900 rounded-full font-medium cursor-pointer flex items-center shadow-md hover:bg-teal-400 transition"
                    onClick={() => handleRemoveSkill(skill)}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {skill}
                    <span className="ml-1 font-bold">×</span>
                  </motion.span>
                ))}
                {skills.length === 0 && <p className="text-gray-500 text-sm italic">Add 3-5 key skills (e.g., Python, Artificial Intelligence ,Graphics..).</p>}
              </div>
            </div>

          </div>

          <motion.button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-6 py-4 bg-blue-600 text-white font-bold text-xl rounded-lg hover:bg-blue-700 transition duration-300 shadow-lg shadow-blue-600/50 disabled:bg-gray-600 disabled:shadow-none flex items-center justify-center"
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.99 }}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              "Get Personalized Recommendations"
            )}
          </motion.button>

        </motion.section>

        {/* 4. RESULTS SECTION */}
        {showResults && recommendations.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-8 text-teal-400">Top Recommendations</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              
              {/* Recommendations List (2/3 width) */}
              <div className="lg:col-span-2 space-y-6">
                {recommendations.map((intern, idx) => (
                  <motion.div 
                    key={idx} 
                    className="bg-gray-800 p-6 rounded-xl shadow-xl hover:shadow-teal-500/20 transition transform border-l-4 border-blue-500"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-2xl font-bold text-teal-400">{intern.Title}</h3>
                      <div className="text-right">
                        <span className="text-4xl font-extrabold text-blue-500">{intern.Score}%</span>
                        <p className="text-sm text-gray-400">Match Score</p>
                      </div>
                    </div>
                    <p className="text-gray-300 mb-1"><strong>Organization:</strong> {intern.Organization}</p>
                    <p className="text-gray-300 mb-1"><strong>Sector:</strong> {intern.Sector} | <strong>Location:</strong> {intern.Location}</p>
                    <p className="text-gray-400 text-sm mt-2">
                      <strong className="text-white">Skills Needed:</strong> {intern.Skills.join(", ")}
                    </p>
                    <a href={intern.applyLink} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-teal-500 hover:text-teal-400 transition">View Details & Apply →</a>
                  </motion.div>
                ))}
              </div>

              {/* Match Score Visualization (1/3 width) */}
              <motion.div 
                className="lg:col-span-1 bg-gray-800 p-6 rounded-xl shadow-xl border-l-4 border-teal-500 sticky top-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: recommendations.length * 0.1 }}
              >
                <h3 className="text-xl font-semibold mb-6 text-white text-center">Top 5 Match Score Breakdown</h3>
                <div className="w-full h-80 flex items-center justify-center">
                  <Pie 
                    data={chartData} 
                    options={{ 
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            color: '#e5e7eb', // White color for legend text
                          }
                        },
                        title: {
                          display: false,
                        }
                      },
                    }} 
                  />
                </div>
              </motion.div>

            </div>
          </motion.section>
        )}
      </main>
      
      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-800 text-center text-gray-500">
        <p>&copy; {new Date().getFullYear()} InternQuest – Your journey to the perfect internship. All rights reserved.</p>
        <p className="text-xs mt-1">Powered by Intelligent Matching.</p>
      </footer>
    </div>
  );
}

export default App;