import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.MODE === "production" || window.location.hostname !== "localhost") {
    return "https://tour-assist-app.onrender.com";
  }
  return "http://localhost:8000";
};
const API_BASE_URL = getApiBaseUrl();

function TripPlanner() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTripName, setNewTripName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripDetail, setTripDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetchTrips();
  }, []);

  const authHeaders = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips`, { headers: authHeaders() });
      if (res.ok) setTrips(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadTripDetail = async (tripId) => {
    setSelectedTrip(tripId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips/${tripId}`, { headers: authHeaders() });
      if (res.ok) setTripDetail(await res.json());
    } catch (e) { console.error(e); }
    setLoadingDetail(false);
  };

  const createTrip = async (e) => {
    e.preventDefault();
    if (!newTripName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: newTripName })
      });
      if (res.ok) {
        const data = await res.json();
        setTrips(prev => [data, ...prev]);
        setNewTripName("");
        loadTripDetail(data.id);
      }
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  const deleteTrip = async (tripId) => {
    if (!confirm("Delete this trip?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/trips/${tripId}`, { method: "DELETE", headers: authHeaders() });
      setTrips(prev => prev.filter(t => t.id !== tripId));
      if (selectedTrip === tripId) { setSelectedTrip(null); setTripDetail(null); }
    } catch (e) { console.error(e); }
  };

  const removeItem = async (itemId) => {
    if (!tripDetail) return;
    try {
      await fetch(`${API_BASE_URL}/api/trips/${tripDetail.id}/items/${itemId}`, { method: "DELETE", headers: authHeaders() });
      setTripDetail(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
      setTrips(prev => prev.map(t => t.id === tripDetail.id ? { ...t, item_count: t.item_count - 1 } : t));
    } catch (e) { console.error(e); }
  };

  const shareTrip = async () => {
    if (!tripDetail) return;
    setSharing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips/${tripDetail.id}/share`, { method: "POST", headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTripDetail(prev => ({ ...prev, share_token: data.share_token }));
        setTrips(prev => prev.map(t => t.id === tripDetail.id ? { ...t, share_token: data.share_token } : t));
      }
    } catch (e) { console.error(e); }
    setSharing(false);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/trip/${tripDetail.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    });
  };

  // Group items by day
  const dayGroups = {};
  (tripDetail?.items || []).forEach(item => {
    const d = item.day_number;
    if (!dayGroups[d]) dayGroups[d] = [];
    dayGroups[d].push(item);
  });

  return (
    <div className="min-h-screen bg-background text-text-main font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-accent text-white py-8 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/80 hover:text-white text-sm mb-3 transition-colors">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            <h1 className="text-3xl font-black flex items-center gap-3">🗺️ Trip Planner</h1>
            <p className="text-white/70 text-sm mt-1">Plan, organise & share your itineraries</p>
          </div>
          {/* Create new trip form */}
          <form onSubmit={createTrip} className="flex gap-2">
            <input
              type="text"
              value={newTripName}
              onChange={e => setNewTripName(e.target.value)}
              placeholder="New trip name..."
              className="px-4 py-2 rounded-xl text-gray-800 text-sm font-medium bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 min-w-[180px]"
            />
            <button
              type="submit"
              disabled={creating || !newTripName.trim()}
              className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm disabled:opacity-50 transition-colors border border-white/30"
            >
              {creating ? "..." : "+ Create"}
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-6 flex-col md:flex-row min-h-[calc(100vh-140px)]">
        {/* Trip List */}
        <div className="md:w-72 flex-shrink-0">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">My Trips</h2>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />)}
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">✈️</div>
              <p className="text-sm">No trips yet.<br/>Create your first one!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {trips.map(trip => (
                <div
                  key={trip.id}
                  onClick={() => loadTripDetail(trip.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                    selectedTrip === trip.id
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 dark:border-gray-700 hover:border-primary/50 bg-white/60 dark:bg-gray-800/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{trip.name}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {trip.item_count} place{trip.item_count !== 1 ? "s" : ""}
                        {trip.share_token && <span className="ml-2 text-green-500">🔗 Shared</span>}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteTrip(trip.id); }}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded"
                      title="Delete trip"
                    >
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trip Detail */}
        <div className="flex-1">
          {!selectedTrip ? (
            <div className="flex-1 flex items-center justify-center py-24 text-gray-400">
              <div className="text-center">
                <div className="text-6xl mb-4">👈</div>
                <p className="font-medium">Select a trip to view its itinerary</p>
                <p className="text-sm mt-1">or create a new one above</p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="text-4xl mb-3 animate-spin">🧭</div>
                <p className="text-gray-400">Loading itinerary...</p>
              </div>
            </div>
          ) : tripDetail ? (
            <div>
              {/* Trip header */}
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <h2 className="text-2xl font-black">{tripDetail.name}</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {tripDetail.items.length} place{tripDetail.items.length !== 1 ? "s" : ""}
                    {" "}across {Object.keys(dayGroups).length} day{Object.keys(dayGroups).length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {tripDetail.share_token ? (
                    <button
                      onClick={copyShareLink}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        copiedToken ? "bg-green-100 text-green-600 border border-green-200" : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                      }`}
                    >
                      {copiedToken ? "✅ Link Copied!" : "🔗 Copy Share Link"}
                    </button>
                  ) : (
                    <button
                      onClick={shareTrip}
                      disabled={sharing || tripDetail.items.length === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-accent text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {sharing ? "Generating..." : "🔗 Share Itinerary"}
                    </button>
                  )}
                  <Link
                    to="/"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-surface border border-secondary hover:border-primary text-text-main transition-colors"
                  >
                    + Add Places
                  </Link>
                </div>
              </div>

              {/* Shared link display */}
              {tripDetail.share_token && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3">
                  <span className="text-green-500 text-xl">🔗</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-green-700 dark:text-green-400">Public share link active</p>
                    <p className="text-xs text-green-600 dark:text-green-500 truncate">
                      {window.location.origin}/trip/{tripDetail.share_token}
                    </p>
                  </div>
                  <Link
                    to={`/trip/${tripDetail.share_token}`}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shrink-0"
                    target="_blank"
                  >
                    Preview →
                  </Link>
                </div>
              )}

              {/* Empty state */}
              {tripDetail.items.length === 0 ? (
                <div className="text-center py-16 bg-white/60 dark:bg-gray-800/60 rounded-2xl border border-dashed border-gray-300">
                  <div className="text-5xl mb-4">🏖️</div>
                  <p className="font-bold text-gray-600">No places added yet</p>
                  <p className="text-sm text-gray-400 mt-1 mb-6">Browse places on the home page and add them to this trip</p>
                  <Link to="/" className="px-6 py-3 bg-primary text-white rounded-full font-bold text-sm hover:bg-opacity-90 transition-colors">
                    Explore Places →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {Object.keys(dayGroups).sort((a,b) => Number(a)-Number(b)).map(day => (
                    <div key={day}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-full bg-primary text-white font-black flex items-center justify-center text-sm shadow">
                          {day}
                        </div>
                        <h3 className="font-bold text-gray-700 dark:text-gray-300">Day {day}</h3>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      </div>
                      <div className="flex flex-col gap-3">
                        {dayGroups[day].map(item => {
                          const place = item.place;
                          if (!place) return null;
                          return (
                            <div key={item.id} className="bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex gap-4 hover:shadow-md transition-shadow">
                              {place.image_url && (
                                <img
                                  src={place.image_url}
                                  alt={place.name}
                                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                                  onError={e => { e.target.style.display='none'; }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">{place.type}</span>
                                    <Link to={`/places/${place.id}`} className="block font-bold text-text-main hover:text-primary transition-colors mt-1">{place.name}</Link>
                                  </div>
                                  <button
                                    onClick={() => removeItem(item.id)}
                                    className="text-gray-300 hover:text-red-400 transition-colors p-1 ml-2"
                                    title="Remove from trip"
                                  >
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                {place.address && <p className="text-xs text-gray-400 mt-1 truncate">📍 {place.address}</p>}
                                {place.rating > 0 && <p className="text-xs text-amber-500 font-semibold mt-1">⭐ {place.rating}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default TripPlanner;
