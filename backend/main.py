from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup
import json

app = FastAPI()

# Enable React frontend (or any client) to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Define the expected structure of the candidate data from the frontend
class CandidateProfile(BaseModel):
    education: str
    skills: list[str]
    sector: str
    location: str

# --- 1. WEB SCRAPING DATA FETCH (INTERNSHALA) ---

def fetch_live_internships(candidate: CandidateProfile):
    """
    Scrapes and maps live internship data from Internshala.
    """
    url = "https://internshala.com/internships/"
    print(f"Scraping Internshala: {url}")

    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Find internship containers (adjust selector based on actual HTML structure)
        internship_containers = soup.find_all('div', class_='individual_internship')

        if not internship_containers:
            # Fallback selectors if class changes
            internship_containers = soup.find_all('div', class_='internship_meta')

        mapped_internships = []

        for container in internship_containers[:100]:  # Limit to 100
            try:
                # Extract title
                title_elem = container.find('h3', class_='heading_4_5') or container.find('a', class_='job-title-href')
                title = title_elem.get_text(strip=True) if title_elem else 'Internship N/A'

                # Extract organization
                org_elem = container.find('p', class_='company-name') or container.find('a', class_='company-name')
                organization = org_elem.get_text(strip=True) if org_elem else 'Organization N/A'

                # Extract location
                loc_elem = container.find('p', class_='location') or container.find('span', class_='location')
                location = loc_elem.get_text(strip=True).split(',')[0].strip() if loc_elem else 'Remote'

                # Extract skills (if available)
                skills_elem = container.find('div', class_='tags') or container.find('p', class_='tags')
                skills = []
                if skills_elem:
                    skill_tags = skills_elem.find_all('span') or skills_elem.find_all('a')
                    skills = [tag.get_text(strip=True) for tag in skill_tags if tag.get_text(strip=True)]

                # Extract apply link
                link_elem = container.find('a', href=True)
                apply_link = link_elem['href'] if link_elem else '#'
                if apply_link.startswith('/'):
                    apply_link = f"https://internshala.com{apply_link}"

                # Map to required structure
                mapped_internships.append({
                    "Title": title,
                    "Organization": organization,
                    "Education": ["Any", candidate.education],
                    "Skills": list(set(skills + candidate.skills[:1])),
                    "Sector": candidate.sector,  # Default to candidate's sector since not scraped
                    "Location": location,
                    "applyLink": apply_link,
                    "Score": 0
                })

            except Exception as e:
                print(f"Skipping internship due to parsing error: {e}")
                continue

        if not mapped_internships:
            raise HTTPException(status_code=404, detail="No internships found on Internshala.")

        return mapped_internships

    except requests.RequestException as e:
        print(f"Error scraping Internshala: {e}")
        raise HTTPException(status_code=500, detail="Error fetching data from Internshala.")


# --- 2. SCORING LOGIC ---
def calculate_score(candidate: dict, internship: dict):
    score = 0
    
    # Score 1: Education Match
    if candidate["education"] in internship["Education"] or "Any" in internship["Education"]:
        score += 2
        
    # Score 2: Skill Match (Intersection count)
    candidate_skills_set = set(candidate["skills"])
    internship_skills_set = set(internship["Skills"])
    skill_matches = candidate_skills_set.intersection(internship_skills_set)
    score += len(skill_matches)
    
    # Score 3: Sector Match
    if candidate["sector"] == internship["Sector"] or internship["Sector"] == "Any":
        score += 1
        
    # Score 4: Location Match
    if candidate["location"] == internship["Location"] or internship["Location"] == "Remote" or candidate["location"] == "Any":
        score += 1
        
    return score

# --- 3. RECOMMENDATION ENDPOINT (Uses scraped data) ---
@app.post("/recommendations")
def get_recommendations(candidate: CandidateProfile):

    # 1. Fetch the live list of internships from Internshala
    live_internships = fetch_live_internships(candidate)

    scored = []
    candidate_dict = candidate.dict()
    
    # 2. Score the live data
    for internship in live_internships:
        s = calculate_score(candidate_dict, internship)
        scored.append({**internship, "Score": s})
        
    # 3. Sort and Return Top 5
    scored.sort(key=lambda x: x["Score"], reverse=True)
    
    # Return the top 5 matches
    return {"recommendations": scored[:5]}