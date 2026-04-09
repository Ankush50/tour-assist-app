# 🧭 Odyssey (Tour Assist)

Welcome to **Odyssey**, an AI-powered, academic-level travel companion application. Built to solve the modern traveler's dilemmas—information overload, fake reviews, and rigid itineraries—Odyssey introduces state-of-the-art **trust mechanisms**, **AI-driven generation**, and **collaborative planning**.

![Odyssey App](https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80)

## 🚀 Key Features

Compared to standard travel aggregators, Odyssey introduces significant academic and practical novelty:

1. **AI Authenticity Scoring** & **Geo-Verified Reviews**: Fights fake reviews using NLP sentiment analysis and strict GPS polygon-matching to guarantee a user was actually at the location when they reviewed it.
2. **Collaborative Itinerary Building**: Share a live link to an itinerary. Collaborators can authenticate and modify dates, add locations, and remove steps while the system safely logs all activity via a `TripCollaborationLog` engine.
3. **"Beat the Crowd" Temporal Maps**: Using machine learning proxies from review timestamp concentration, the system predicts historical crowd density and recommends the best off-peak times to visit attractions.
4. **Eco-Score Sustainability Metrics**: Encourages green travel by scoring locations and itineraries based on their environmental footprint (e.g. calculated travel distances and location categorisation).
5. **Voice-to-Text Multi-Modal Reviews**: Dramatically reduces friction for generating user content by allowing instant, AI-transcribed verbal reviews.

## 🛠️ Technology Stack

- **Backend:** FastAPI (Python), SQLAlchemy, PostgreSQL (PostGIS for spatial queries)
- **Frontend:** React (Vite), Tailwind CSS, React-Router-DOM
- **Integrations:** Gemini AI API (NLP & Generation), Leaflet Maps API, Browser Geolocation & SpeechRecognition API
- **Deployment:** Render (Backend), Netlify (Frontend)

## 📦 Local Setup & Installation

### 1. Database Setup
Ensure you have PostgreSQL installed. You do **not** need a spatial extension if you run locally.
```bash
# Create a blank database named 'tour_assist'
createdb tour_assist
```

### 2. Backend
```bash
cd tour-assist-backend
python -m venv venv
source venv/bin/activate       # (Windows: venv\Scripts\activate)
pip install -r requirements.txt
# Set your environment variables (e.g. GEMINI_API_KEY)
uvicorn main:app --reload
```

### 3. Frontend
```bash
cd tour-assist-frontend
npm install
npm run dev
```

## 🤝 Collaboration
When testing shared trips, copy the `share_token` URL, open an incognito window, create a test account, and observe the real-time activity log on the main account's dashboard.

---
*Created as a Final Year Computer Science (BSc Honours) Project.*
