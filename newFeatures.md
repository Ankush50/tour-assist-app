# 🌟 Odyssey: Novel Features

This document provides a technical and functional overview of the novel features implemented in the Tour Assist (Odyssey) platform. These features are designed to address critical flaws in modern travel applications: **trust deficits**, **analysis paralysis (information overload)**, and **sustainability ignorance**.

---

## 1. Geo-Verified Reviews & AI Authenticity Scoring (The "Trust Factor")

**The Problem:** Travel platforms are flooded with highly-coordinated fake reviews and bot activity.
**The Novel Solution:** Odyssey requires users to provide their current geographic coordinates when submitting a review. The system checks if the coordinate is within a reasonable radius of the `PostGIS` location of the attraction. Concurrently, the Gemini AI engine parses the text for emotional variance and organic linguistic markers.

- **How to Use:** Go to a `PlaceDetail` page. Add a review while allowing browser location permissions. Submitting the review triggers the verification pipeline. Look for the "📍 GEO-VERIFIED" and "🟢 High Authenticity" badges.

## 2. Generative "Magic" Trip Planner

**The Problem:** Standard planners require users to manually pick, choose, and route every single step of an itinerary, which is exhausting.
**The Novel Solution:** Users simply ask the AI in plain text (e.g. "I want a 2 day trip focusing on food and monuments in Delhi"). The AI uses a constrained RAG (Retrieval-Augmented Generation) prompt. Instead of making up non-existent places, it _only_ recommends places present directly within the database.

- **How to Use:** Navigate to `Trip Planner`. This feature intercepts the user's natural language request and auto-generates sequential days and locations, calculating routing distance seamlessly.

## 3. Collaborative Assured Itinerary Logs

**The Problem:** While sharing a link is standard, multi-user synchronous travel planning often results in lost steps and arguments over who deleted an item.
**The Novel Solution:** A strict state-logging approach. When an owner generates a "Share Link", it generates a secure URL token. When a second logged-in user hits that link, they enter "Guest Collaboration Mode". If they edit the trip, they write directly to a `TripCollaborationLog` database table. The trip owner has a real-time "Recent Collaborator Activity" feed that audits exactly who added or deleted locations.

- **How to Use:** On `Trip Planner`, click "🔗 Share Itinerary". Copy the link. Open an incognito browser, log in as a second user, and paste the URL. Edit the days, then switch back to the original owner browser to view the audit log feed.

## 4. Voice-Dictated Local Reviews

**The Problem:** Users rarely submit detailed reviews on mobile due to keyboard friction, resulting in mostly useless 5-star or 1-star ratings with no text.
**The Novel Solution:** Multi-modal frictionless input. Using the browser's native `SpeechRecognition` pipeline, users dictate their review, which is captured and formatted. This drastically increases detailed user-generated content organically.

- **How to Use:** On the review form on `PlaceDetail`, click the 🎙️ (Microphone) icon. Speak normally. It will auto-populate the textarea with your text perfectly.

## 5. Eco-Score Tracking & Badges

**The Problem:** Tourism contributes massively to carbon emissions, yet travellers have zero awareness of the footprint of their daily itineraries.
**The Novel Solution:** A background heuristic calculation attributes "Eco Scores" (e.g., 🌿 4/5 Leaves) to locations based on type (Parks score high; high-density commercial spaces score low) and assigns a carbon footprint tracker to itineraries.

- **How to Use:** Open `PlaceDetail` and view the "Sustainability Score" chip near the ratings.

## 6. Predictive Crowd Density Forecasting (Time-Series ML)

**The Problem:** Travellers arrive at peak times and ruin their own experience due to overcrowding. Current apps only show "live" data which is useless for planning trips days in advance.
**The Novel Solution:** Odyssey uses true Machine Learning to mathematically extrapolate future foot-traffic scenarios. Using `scikit-learn`'s `RandomForestRegressor`, the backend trains a time-series model on historical data (factoring in day of the week, weekends, and seasonal mathematical waves) to output a 7-day future probability curve.
**The Academic Value:** Transforms a standard travel planner into an advanced Data Science predictive analytics pipeline.

- **How to Use:** On `PlaceDetail`, scroll below the Emergency Info. A React Recharts `<LineChart>` dynamically visualizes the backend's JSON tensor output for the next 7 days, indicating accurate % capacity forecasting.
