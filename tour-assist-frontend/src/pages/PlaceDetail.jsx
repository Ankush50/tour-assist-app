import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import AIAssistant from "../components/AIAssistant";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.MODE === "production" || window.location.hostname !== "localhost") {
    return "https://tour-assist-app.onrender.com";
  }
  return "http://localhost:8000";
};
const API_BASE_URL = getApiBaseUrl();

// --- Crowd Pulse: Feature 6 ---
function CrowdPulseBadge({ pulse }) {
  const config = {
    active: { color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800", dot: "bg-green-500", label: "Active", desc: "Reviewed in last 7 days" },
    recent: { color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800", dot: "bg-yellow-500", label: "Recent", desc: "Reviewed in last 30 days" },
    quiet:  { color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700", dot: "bg-gray-400", label: "Quiet", desc: "No recent reviews" },
  }[pulse] || null;
  if (!config) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${config.color}`}
      title={config.desc}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${pulse === "active" ? "animate-pulse" : ""}`} />
      {config.label}
    </span>
  );
}

// --- Tier badge helper ---
const TIER_CONFIG = {
  "Expert":       { emoji: "🌟", color: "text-purple-600 dark:text-purple-400" },
  "Trusted Local":{ emoji: "🥇", color: "text-amber-600 dark:text-amber-400" },
  "Regular":      { emoji: "🥈", color: "text-gray-500 dark:text-gray-400" },
  "Explorer":     { emoji: "🥉", color: "text-orange-500 dark:text-orange-400" },
};

function PlaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [newReviewText, setNewReviewText] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [localVotes, setLocalVotes] = useState({});
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Trip planner integration
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [addingToTrip, setAddingToTrip] = useState(false);
  const [addedToTrip, setAddedToTrip] = useState(false);
  const [showTripPanel, setShowTripPanel] = useState(false);

  // New features
  const [isDictating, setIsDictating] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/places/${id}`)
      .then(res => { if (!res.ok) throw new Error("Place not found"); return res.json(); })
      .then(data => { setPlace(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && place) fetchReviews();
  }, [loading, place]);

  useEffect(() => {
    if (token) fetchUserTrips();
  }, [token]);

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/places/${id}/reviews`);
      if (res.ok) setReviews(await res.json());
    } catch (e) { console.error(e); }
    setLoadingReviews(false);
  };

  const handleSummarizeReviews = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/places/${id}/summary`);
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.summary);
      }
    } catch (e) { console.error(e); }
    setLoadingSummary(false);
  };

  const fetchUserTrips = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTrips(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!token) { alert("Please log in to leave a review."); return; }
    if (!newReviewText.trim()) { alert("Please write a comment."); return; }

    setSubmittingReview(true);

    let userLat = null, userLon = null;
    try {
      await new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
          pos => { userLat = pos.coords.latitude; userLon = pos.coords.longitude; resolve(); },
          () => resolve(), { timeout: 5000 }
        );
      });
    } catch (_) {}

    try {
      const res = await fetch(`${API_BASE_URL}/api/places/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating: newReviewRating, comment: newReviewText, user_lat: userLat, user_lon: userLon }),
      });
      if (res.ok) {
        const newReview = await res.json();
        setReviews(prev => [newReview, ...prev]);
        setNewReviewText("");
        setNewReviewRating(5);
      } else {
        const err = await res.json();
        alert(err.detail || "Error submitting review.");
      }
    } catch (e) { alert("Failed to submit. Try again."); }
    setSubmittingReview(false);
  };

  const handleVote = async (reviewId, vote) => {
    if (!token) { alert("Please log in to vote."); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vote }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocalVotes(prev => ({ ...prev, [reviewId]: data.user_vote }));
        setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, helpful_votes: data.helpful_votes, unhelpful_votes: data.unhelpful_votes } : r));
      }
    } catch (e) { console.error(e); }
  };

  const handleAddToTrip = async () => {
    if (!token || !selectedTripId) return;
    setAddingToTrip(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips/${selectedTripId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ place_id: parseInt(id), day_number: 1 }),
      });
      if (res.ok) { setAddedToTrip(true); setTimeout(() => setAddedToTrip(false), 3000); }
      else { const err = await res.json(); alert(err.detail || "Could not add to trip."); }
    } catch (e) { console.error(e); }
    setAddingToTrip(false);
  };

  if (loading) return (
    <div className="p-10 text-center">
      <div className="text-5xl animate-bounce mb-3">🧭</div>
      <p className="text-gray-500">Loading details...</p>
    </div>
  );
  if (!place) return <div className="p-10 text-center text-red-500">Place not found.</div>;

  const position = [place.location?.coordinates?.[1] || place.location?.lat || 0, place.location?.coordinates?.[0] || place.location?.lon || 0];
  const hasPosition = position[0] !== 0 && position[1] !== 0;
  const googleMapsUrl = hasPosition ? `https://www.google.com/maps/dir/?api=1&destination=${position[0]},${position[1]}` : null;

  // Crowd pulse from backend (Feature 6)
  const crowdPulse = place?.crowd_pulse;
  // Visit counter (Feature 8)
  const viewCount = place?.view_count || 0;
  
  // Real Features sourced from DB
  const ecoScore = place?.eco_score || 4; 
  const policeStation = place?.police_contact || "";
  const hospital = place?.hospital_contact || "";

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 relative z-10 w-full animate-fade-in-up">
      {/* Top nav bar — always has Home + Back */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full font-bold text-sm shadow-sm hover:bg-primary/80 transition-colors transform hover:scale-105"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
        </Link>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-white/70 backdrop-blur-md border border-gray-200 rounded-full text-gray-700 hover:bg-gray-100 transition-colors font-medium shadow-sm flex items-center gap-2 transform hover:scale-105 text-sm"
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>

      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/40 dark:border-gray-700/50 rounded-3xl shadow-2xl overflow-hidden animate-zoom-in">
        {/* Hero Image */}
        <div className="relative h-72 sm:h-96 w-full">
          <img
            src={place.image_url || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80"}
            alt={place.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Feature 8: Visit counter badge */}
          {viewCount > 0 && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <span>👀</span> {viewCount.toLocaleString()} views
            </div>
          )}

          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-3 py-1 bg-primary text-white rounded-full text-xs font-bold uppercase tracking-wider">
                {place.type}
              </span>
              {place.rating > 0 && (
                <span className="px-3 py-1 bg-accent text-gray-900 rounded-full text-xs font-bold flex items-center gap-1">
                  ⭐ {place.rating} / 5.0
                </span>
              )}
              {/* Feature 6: Crowd Pulse */}
              {crowdPulse && <CrowdPulseBadge pulse={crowdPulse} />}
              {/* Feature: Eco Score */}
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1 border border-emerald-200">
                🌱 Eco: {ecoScore}/5
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white mb-2 leading-tight drop-shadow-md">{place.name}</h1>
            <p className="text-gray-200 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {place.address}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          {/* About section */}
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">About</h2>
            <div className="flex gap-2 flex-wrap">
              {/* Add to Trip button (Feature 7) */}
              {token && (
                <div className="relative">
                  <button
                    onClick={() => setShowTripPanel(v => !v)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-bold text-sm shadow-md transition-all transform hover:scale-105 active:scale-95"
                  >
                    🗺️ Add to Trip
                  </button>
                  {showTripPanel && (
                    <div className="absolute right-0 top-12 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-64 animate-fade-in">
                      <p className="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">Add to trip</p>
                      {trips.length === 0 ? (
                        <div className="text-center py-3">
                          <p className="text-xs text-gray-400 mb-2">No trips yet.</p>
                          <Link to="/trips" className="text-xs text-primary font-bold hover:underline">Create a trip →</Link>
                        </div>
                      ) : (
                        <>
                          <select
                            value={selectedTripId}
                            onChange={e => setSelectedTripId(e.target.value)}
                            className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-surface text-text-main mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">-- Select trip --</option>
                            {trips.map(t => <option key={t.id} value={t.id}>{t.name} ({t.item_count} places)</option>)}
                          </select>
                          <button
                            onClick={handleAddToTrip}
                            disabled={!selectedTripId || addingToTrip || addedToTrip}
                            className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${addedToTrip ? "bg-green-100 text-green-600" : "bg-primary text-white hover:bg-opacity-90 disabled:opacity-50"}`}
                          >
                            {addedToTrip ? "✅ Added!" : addingToTrip ? "Adding..." : "Add to Trip"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => document.getElementById("ai-trigger")?.click()}
                className="bg-accent text-gray-900 border border-gray-200 px-4 py-2 rounded-full font-bold shadow-md hover:bg-yellow-400 transition-colors flex items-center gap-2 transform hover:scale-105 active:scale-95 text-sm"
              >
                <span>✨</span> Ask AI About This Place
              </button>
            </div>
          </div>

          {/* Feature: Local Emergency Card */}
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex gap-3 items-center">
              <span className="text-2xl">🚨</span>
              <div>
                <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Emergency Info</p>
                <p className="text-sm text-red-800 dark:text-red-300 font-medium">Safe zone. Tourist police active.</p>
              </div>
            </div>
            <div className="flex gap-4 text-xs font-medium text-red-700 dark:text-red-300">
              <div>🏥 {hospital}</div>
              <div>🚓 {policeStation}</div>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-300 leading-relaxed max-w-3xl mb-8 text-base">
            {place.description || "No description available for this place."}
          </p>

          {/* Actions */}
          {googleMapsUrl && (
            <div className="mb-10">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-md transition-all transform hover:scale-105 text-sm"
              >
                🗺️ Get Directions (Google Maps)
              </a>
            </div>
          )}

          {/* Map */}
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Explore on Map</h2>
          {hasPosition ? (
            <div className="h-72 w-full rounded-2xl overflow-hidden shadow-inner border border-gray-200 dark:border-gray-700 mb-10 relative z-0">
              <MapContainer center={position} zoom={15} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                <Marker position={position}>
                  <Popup><strong>{place.name}</strong><br />{place.address}</Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : (
            <p className="text-gray-400 italic mb-10">No map coordinates available.</p>
          )}

          {/* ===== REVIEWS SECTION ===== */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-3">
              Reviews
              <span className="text-sm font-normal text-gray-400">({reviews.length})</span>
              {/* Feature 6: Crowd pulse next to review count */}
              {crowdPulse && <CrowdPulseBadge pulse={crowdPulse} />}
            </h2>

            {/* Review Form */}
            {token ? (
              <form onSubmit={handleSubmitReview} className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-5 mb-8 border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Leave a Review</p>
                <div className="flex items-center gap-1 mb-3">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} type="button" onClick={() => setNewReviewRating(star)}
                      className={`text-2xl transition-transform hover:scale-125 ${star <= newReviewRating ? "text-yellow-400" : "text-gray-300"}`}>
                      ★
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-500 font-medium">{newReviewRating}/5</span>
                </div>
                <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-2 rounded-xl mb-3 border border-gray-200 dark:border-gray-700">
                  <textarea
                    value={newReviewText}
                    onChange={e => setNewReviewText(e.target.value)}
                    placeholder="Share your experience (or tap the mic to dictate)..."
                    className="w-full text-sm p-2 bg-transparent text-text-main focus:outline-none resize-none"
                    rows="2"
                  />
                  {/* Feature: Voice Dictation */}
                  <div>
                    <button type="button" 
                      onClick={() => {
                        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                        if (!SpeechRecognition) {
                          alert("Voice dictation is not supported in this browser.");
                          return;
                        }
                        const recognition = new SpeechRecognition();
                        recognition.continuous = true;
                        recognition.interimResults = true;
                        recognition.lang = 'en-US';
                        
                        // Show visual UI feedback that browser is actually listening
                        setIsDictating(true);
                        
                        recognition.onresult = (e) => {
                          let finalTranscripts = '';
                          let interimTranscripts = '';
                          for (let i = e.resultIndex; i < e.results.length; i++) {
                            const transcript = e.results[i][0].transcript;
                            if (e.results[i].isFinal) {
                              finalTranscripts += transcript;
                            } else {
                              interimTranscripts += transcript;
                            }
                          }
                          
                          if (finalTranscripts) {
                            setNewReviewText(prev => prev ? prev + " " + finalTranscripts : finalTranscripts);
                          }
                        };
                        
                        recognition.onerror = (e) => {
                          console.error("Speech Recognition Error:", e);
                          alert("Speech recognition failed. Please ensure microphone permissions are granted.");
                          setIsDictating(false);
                        };
                        
                        recognition.onend = () => {
                          setIsDictating(false);
                        };
                        
                        recognition.start();
                        
                        // Safety timeout
                        setTimeout(() => {
                           recognition.stop();
                           setIsDictating(false);
                        }, 10000);
                      }}
                      className={`ml-2 p-3 shrink-0 rounded-xl transition-colors ${
                        isDictating ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 hover:bg-gray-200 text-gray-500"
                      }`}
                      title="Dictate Review"
                    >
                      🎙️
                    </button>
                    {isDictating && (
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900/90 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center justify-center gap-3">
                        <span className="relative flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                        </span>
                        <p className="font-bold tracking-wide">Listening... Speak now.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    📍 Location checked for geo-verification
                  </p>
                  <button type="submit" disabled={submittingReview}
                    className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2">
                    {submittingReview ? "Scoring with AI..." : "Post Review"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-5 mb-8 border border-dashed border-gray-300 text-center">
                <p className="text-gray-500 text-sm mb-3">Log in to leave a review</p>
                <Link to="/login" className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-full hover:bg-opacity-90 transition-colors">Log in</Link>
              </div>
            )}

            {/* Review List & AI Summary */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                Reviews
                <span className="bg-gray-100 text-gray-600 text-sm py-1 px-3 rounded-full font-bold">{reviews.length}</span>
              </h2>
              {reviews.length > 0 && !aiSummary && (
                <button
                  onClick={handleSummarizeReviews}
                  disabled={loadingSummary}
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                >
                  {loadingSummary ? "Generating..." : "✨ AI Summarise"}
                </button>
              )}
            </div>

            {aiSummary && (
              <div className="mb-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl shadow-sm">
                <p className="text-indigo-800 font-bold flex items-center gap-2 mb-2 text-sm uppercase tracking-wide">
                  <span>✨</span> AI Summary Consensus
                </p>
                <div className="text-indigo-900 text-sm leading-relaxed whitespace-pre-line">
                  {aiSummary}
                </div>
              </div>
            )}

            {loadingReviews ? (
              <div className="text-center py-8 text-gray-400">Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-4xl mb-3">💬</div>
                <p className="font-medium">No reviews yet — be the first!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {reviews.map(review => {
                  const authLabel = review.authenticity_label;
                  const authScore = review.authenticity_score;
                  const authConfig = authLabel === "Verified"
                    ? { bg: "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800", badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400", icon: "🛡️" }
                    : authLabel === "Suspicious"
                    ? { bg: "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800", badge: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400", icon: "⚠️" }
                    : { bg: "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800", badge: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400", icon: "✓" };
                  const tierCfg = TIER_CONFIG[review.reviewer_tier] || TIER_CONFIG["Explorer"];
                  const userVote = localVotes[review.id];
                  const isHighlyRated = (review.helpful_votes || 0) >= 5;

                  return (
                    <div key={review.id} className={`rounded-2xl p-5 shadow-sm border ${authConfig.bg} transition-all hover:shadow-md`}>
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Username + Avatar */}
                          <div className="w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center text-sm uppercase shrink-0">
                            {review.username.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{review.username}</span>
                            {/* Feature 4: Reviewer tier */}
                            <span className={`ml-1.5 text-xs font-semibold ${tierCfg.color}`} title={`${review.reviewer_tier} reviewer`}>
                              {tierCfg.emoji} {review.reviewer_tier}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-yellow-500 shrink-0">
                          {"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(5-review.rating)}</span>
                        </div>
                      </div>

                      {/* Badges row */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {/* Feature 1: AI Authenticity badge */}
                        {authLabel && (
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${authConfig.badge}`}>
                            {authConfig.icon} {authLabel}
                            {authScore !== null && <span className="opacity-60 font-normal">({authScore}/100)</span>}
                          </span>
                        )}
                        {/* Feature 2: Geo-verified */}
                        {review.is_geo_verified && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                            📍 Verified Visit
                          </span>
                        )}
                        {/* Community verified */}
                        {isHighlyRated && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                            ⭐ Community Verified
                          </span>
                        )}
                      </div>

                      {/* Comment */}
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{review.comment}</p>

                      {/* Footer: date + vote buttons */}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" })}
                        </span>
                        {/* Feature 3: Voting */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleVote(review.id, "helpful")}
                            className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-bold transition-all ${userVote === "helpful" ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-green-50 hover:text-green-500 dark:hover:bg-green-900/20"}`}
                            title="Helpful"
                          >
                            👍 {review.helpful_votes || 0}
                          </button>
                          <button
                            onClick={() => handleVote(review.id, "unhelpful")}
                            className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-bold transition-all ${userVote === "unhelpful" ? "bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-red-50 hover:text-red-400 dark:hover:bg-red-900/20"}`}
                            title="Not helpful"
                          >
                            👎 {review.unhelpful_votes || 0}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <AIAssistant
        filters={{ type: place.type }}
        setFilters={() => {}}
        userLocation={null}
        PlaceCardComponent={() => null}
        placeContext={place.name}
      />
    </div>
  );
}

export default PlaceDetail;
