# 🚀 InternQuest – AI-Powered Internship Recommendation System

## 📌 Overview

InternQuest is an **AI-driven internship recommendation system** that analyzes a candidate’s profile and suggests the **top 5 most relevant internships** using intelligent matching.

The system combines **resume parsing (Gemini AI), web scraping, and machine learning–based scoring** to deliver personalized internship recommendations.

---

## ✨ Key Features

* 📄 Resume upload (PDF/TXT) with **AI-based data extraction**
* 🧠 Skill, education, and sector extraction using **Google Gemini API**
* 🌐 Live internship data fetched via **web scraping (Internshala)**
* 🎯 Intelligent recommendation system with **custom scoring algorithm**
* 📊 Match score visualization using charts
* 💻 Interactive frontend with modern UI and animations

---

## 🛠️ Tech Stack

### 🔹 Frontend

* React.js
* Tailwind CSS
* Framer Motion
* Chart.js

### 🔹 Backend

* FastAPI
* BeautifulSoup (Web Scraping)
* Requests

### 🔹 AI Integration

* Google Gemini API (for resume parsing)

---

## ⚙️ System Workflow

1. User uploads resume (PDF/TXT) OR enters details manually
2. Resume text is extracted using **PDF.js**
3. Gemini AI extracts:

   * Education
   * Skills
   * Sector
   * Location
4. Backend fetches live internships from Internshala
5. Each internship is scored based on:

   * Skill match
   * Education match
   * Sector match
   * Location match
6. Top 5 internships are returned with match scores

---

## 🧠 Recommendation Logic

The system uses a scoring mechanism:

* Education match → +2
* Skill match → based on overlap
* Sector match → +1
* Location match → +1

Top internships are ranked based on total score.

---

## 📊 Sample Output

* Internship Title
* Organization
* Required Skills
* Match Score (%)
* Apply Link

---

## ▶️ How to Run

### 🔹 Backend Setup

```bash id="b1h92a"
pip install fastapi uvicorn requests beautifulsoup4
uvicorn main:app --reload
```

### 🔹 Frontend Setup

```bash id="z2k91m"
npm install
npm start
```

---

## 🔐 Environment Variables

Create a `.env` file in frontend:

```env id="8dj3k2"
REACT_APP_GEMINI_API_KEY=your_api_key_here
```

---

## 💡 Future Improvements

* Add ML-based recommendation model
* Improve scraping accuracy
* Add user authentication
* Deploy on cloud (AWS / Render / Vercel)
* Real-time internship filtering

---

## 🙋‍♀️ Author

**Srivarshini Komirishetty**

* GitHub: https://github.com/Srivarshini04
* LinkedIn: https://linkedin.com/in/srivarshini-komirishetty

---

## ⭐ Conclusion

This project demonstrates the integration of **AI, web scraping, and full-stack development** to build a real-world intelligent recommendation system.

---

## 📜 License

This project is open-source and available under the MIT License.
