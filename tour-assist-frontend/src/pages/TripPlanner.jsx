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

// Playful color palettes for each trip card / day section
const TRIP_COLORS = [
  { bg: "from-violet-500 to-purple-600", light: "bg-violet-50 dark:bg-violet-900/20", border: "border-violet-200 dark:border-violet-700", text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  { bg: "from-pink-500 to-rose-600",     light: "bg-pink-50 dark:bg-pink-900/20",     border: "border-pink-200 dark:border-pink-700",     text: "text-pink-600 dark:text-pink-400",     dot: "bg-pink-500" },
  { bg: "from-amber-500 to-orange-600",  light: "bg-amber-50 dark:bg-amber-900/20",   border: "border-amber-200 dark:border-amber-700",  text: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-500" },
  { bg: "from-teal-500 to-emerald-600",  light: "bg-teal-50 dark:bg-teal-900/20",     border: "border-teal-200 dark:border-teal-700",    text: "text-teal-600 dark:text-teal-400",    dot: "bg-teal-500" },
  { bg: "from-blue-500 to-indigo-600",   light: "bg-blue-50 dark:bg-blue-900/20",     border: "border-blue-200 dark:border-blue-700",    text: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-500" },
  { bg: "from-lime-500 to-green-600",    light: "bg-lime-50 dark:bg-lime-900/20",     border: "border-lime-200 dark:border-lime-700",    text: "text-lime-600 dark:text-lime-400",    dot: "bg-lime-500" },
];
const DAY_EMOJIS = ["🌅", "🌞", "🌇", "🌃", "🌠", "🌄", "🏙️"];

const getColor = (idx) => TRIP_COLORS[idx % TRIP_COLORS.length];

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
  const [shareError, setShareError] = useState(null);

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
    setTripDetail(null);
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

  const deleteTrip = async (tripId, e) => {
    e.stopPropagation();
    if (!confirm("Delete this trip? This can't be undone! 🗑️")) return;
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
      setTrips(prev => prev.map(t => t.id === tripDetail.id ? { ...t, item_count: Math.max(0, t.item_count - 1) } : t));
    } catch (e) { console.error(e); }
  };

  const shareTrip = async () => {
    if (!tripDetail) return;
    setSharing(true);
    setShareError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips/${tripDetail.id}/share`, {
        method: "POST",
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setTripDetail(prev => ({ ...prev, share_token: data.share_token }));
        setTrips(prev => prev.map(t => t.id === tripDetail.id ? { ...t, share_token: data.share_token } : t));
      } else {
        const err = await res.json();
        setShareError(err.detail || "Failed to generate share link.");
      }
    } catch (e) { setShareError("Network error. Try again."); }
    setSharing(false);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/trip/${tripDetail.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    });
  };

  // Group items by day
  const dayGroups = {};
  (tripDetail?.items || []).forEach(item => {
    const d = item.day_number;
    if (!dayGroups[d]) dayGroups[d] = [];
    dayGroups[d].push(item);
  });
  const sortedDays = Object.keys(dayGroups).map(Number).sort((a, b) => a - b);

  const selectedTripObj = trips.find(t => t.id === selectedTrip);
  const selectedTripColorIdx = trips.findIndex(t => t.id === selectedTrip);
  const activePalette = getColor(selectedTripColorIdx);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 font-sans">
      {/* Colorful Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-pink-600 to-amber-500 text-white py-10 px-4 shadow-xl">
        {/* Decorative blobs */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 right-20 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Explore
          </button>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black flex items-center gap-3 drop-shadow-md">
                🗺️ Trip Planner
              </h1>
              <p className="text-white/70 mt-1 text-sm">Plan your adventures · share with friends · make memories ✨</p>
            </div>
            {/* Create Trip Form */}
            <form onSubmit={createTrip} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={newTripName}
                onChange={e => setNewTripName(e.target.value)}
                placeholder="✏️  Trip name..."
                className="flex-1 sm:w-48 px-4 py-2.5 rounded-2xl text-gray-800 text-sm font-semibold bg-white/95 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white shadow-inner"
              />
              <button
                type="submit"
                disabled={creating || !newTripName.trim()}
                className="px-5 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/40 text-white font-black text-sm disabled:opacity-40 transition-all hover:scale-105 active:scale-95 shadow"
              >
                {creating ? "✨" : "+ New"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-6 flex-col md:flex-row">
        {/* ===== TRIP LIST ===== */}
        <div className="md:w-72 flex-shrink-0">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 px-1">
            My Trips ({trips.length})
          </h2>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-20 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-700/60" />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-14 px-4">
              <div className="text-5xl mb-4 animate-bounce">✈️</div>
              <p className="font-bold text-gray-600 dark:text-gray-300 mb-1">No trips yet!</p>
              <p className="text-xs text-gray-400">Type a name above and hit "+ New"</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {trips.map((trip, idx) => {
                const pal = getColor(idx);
                const isActive = selectedTrip === trip.id;
                return (
                  <button
                    key={trip.id}
                    onClick={() => loadTripDetail(trip.id)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all hover:shadow-lg group ${
                      isActive
                        ? `border-transparent bg-gradient-to-r ${pal.bg} text-white shadow-lg scale-[1.02]`
                        : `border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-800/70 hover:border-gray-300 dark:hover:border-gray-600 hover:scale-[1.01]`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : pal.dot} shrink-0`} />
                          <p className={`font-bold text-sm truncate ${isActive ? "text-white" : "text-gray-800 dark:text-gray-200"}`}>
                            {trip.name}
                          </p>
                        </div>
                        <p className={`text-xs ml-4 ${isActive ? "text-white/70" : "text-gray-400"}`}>
                          {trip.item_count} place{trip.item_count !== 1 ? "s" : ""}
                          {trip.share_token && <span className={`ml-2 ${isActive ? "text-white/80" : "text-green-500"}`}>🔗</span>}
                        </p>
                      </div>
                      <button
                        onClick={e => deleteTrip(trip.id, e)}
                        className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                          isActive ? "hover:bg-white/20 text-white/70 hover:text-white" : "hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 hover:text-red-400"
                        }`}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick tip */}
          <div className="mt-6 p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">💡 Tip</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              Click 📌 on any place card to add it to a trip instantly!
            </p>
          </div>
        </div>

        {/* ===== TRIP DETAIL ===== */}
        <div className="flex-1 min-w-0">
          {!selectedTrip ? (
            <div className="flex items-center justify-center h-80">
              <div className="text-center px-8">
                <div className="text-7xl mb-5 animate-pulse">🧭</div>
                <p className="font-bold text-gray-500 dark:text-gray-400 text-lg">Select a trip to view it</p>
                <p className="text-sm text-gray-400 mt-2">or create a new adventure above ✨</p>
                <Link
                  to="/"
                  className="inline-block mt-6 px-6 py-2.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:scale-105"
                >
                  Explore Places →
                </Link>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="flex items-center justify-center h-60">
              <div className="text-center">
                <div className="text-5xl mb-3 animate-spin">🧭</div>
                <p className="text-gray-400 text-sm">Loading your itinerary...</p>
              </div>
            </div>
          ) : tripDetail ? (
            <div>
              {/* Detail header */}
              <div className={`rounded-3xl p-6 mb-6 bg-gradient-to-r ${activePalette.bg} text-white shadow-xl relative overflow-hidden`}>
                <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <h2 className="text-2xl font-black mb-1">{tripDetail.name}</h2>
                  <p className="text-white/70 text-sm">
                    {tripDetail.items.length} place{tripDetail.items.length !== 1 ? "s" : ""}
                    {" · "}
                    {sortedDays.length} day{sortedDays.length !== 1 ? "s" : ""}
                  </p>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {/* Share button */}
                    {tripDetail.share_token ? (
                      <button
                        onClick={copyShareLink}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                          copiedToken
                            ? "bg-white text-green-600 border-white"
                            : "bg-white/20 hover:bg-white/30 border-white/40 text-white"
                        }`}
                      >
                        {copiedToken ? "✅ Link Copied!" : "🔗 Copy Share Link"}
                      </button>
                    ) : (
                      <button
                        onClick={shareTrip}
                        disabled={sharing || tripDetail.items.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white/20 hover:bg-white/30 border border-white/40 text-white disabled:opacity-40 transition-all"
                        title={tripDetail.items.length === 0 ? "Add places first to share" : "Generate share link"}
                      >
                        {sharing ? "⏳ Generating..." : "🔗 Share Itinerary"}
                      </button>
                    )}
                    <Link
                      to="/"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white/20 hover:bg-white/30 border border-white/40 text-white transition-all"
                    >
                      + Add Places
                    </Link>
                  </div>

                  {shareError && (
                    <p className="mt-2 text-xs text-red-200 bg-red-500/20 px-3 py-1.5 rounded-xl">{shareError}</p>
                  )}
                </div>
              </div>

              {/* Shared link banner */}
              {tripDetail.share_token && (
                <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 flex-wrap">
                  <span className="text-xl">🔗</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Public link active</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 truncate font-mono mt-0.5">
                      {window.location.origin}/trip/{tripDetail.share_token}
                    </p>
                  </div>
                  <Link
                    to={`/trip/${tripDetail.share_token}`}
                    target="_blank"
                    className="shrink-0 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    Preview →
                  </Link>
                </div>
              )}

              {/* Empty itinerary */}
              {tripDetail.items.length === 0 ? (
                <div className="text-center py-20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
                  <div className="text-6xl mb-5">📍</div>
                  <p className="font-bold text-gray-600 dark:text-gray-300 text-lg mb-2">No places yet!</p>
                  <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
                    Browse places on the home page, then tap 📌 on any card to add here.
                  </p>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  >
                    🌍 Explore Places
                  </Link>
                </div>
              ) : (
                /* Day-by-day itinerary */
                <div className="flex flex-col gap-8">
                  {sortedDays.map((day, dayIdx) => {
                    const dayPal = getColor(dayIdx);
                    const dayEmoji = DAY_EMOJIS[dayIdx % DAY_EMOJIS.length];
                    return (
                      <div key={day}>
                        {/* Day header */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${dayPal.bg} text-white font-black flex items-center justify-center text-lg shadow-md`}>
                            {dayEmoji}
                          </div>
                          <div>
                            <h3 className="font-black text-gray-800 dark:text-gray-200">Day {day}</h3>
                            <p className="text-xs text-gray-400">{dayGroups[day].length} stop{dayGroups[day].length !== 1 ? "s" : ""}</p>
                          </div>
                          <div className={`flex-1 h-0.5 bg-gradient-to-r ${dayPal.bg} opacity-30 rounded-full`} />
                        </div>

                        {/* Place cards */}
                        <div className="flex flex-col gap-3">
                          {dayGroups[day].map((item, itemIdx) => {
                            const place = item.place;
                            if (!place) return null;
                            const mapsUrl = place.location
                              ? `https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lon}`
                              : null;

                            return (
                              <div
                                key={item.id}
                                className={`group bg-white dark:bg-gray-800/80 border-2 ${dayPal.border} rounded-2xl overflow-hidden flex hover:shadow-lg transition-all hover:scale-[1.01]`}
                              >
                                {/* Left color accent */}
                                <div className={`w-1.5 bg-gradient-to-b ${dayPal.bg} flex-shrink-0`} />

                                {/* Step number */}
                                <div className={`${dayPal.light} w-10 flex items-center justify-center flex-shrink-0`}>
                                  <span className={`text-sm font-black ${dayPal.text}`}>{itemIdx + 1}</span>
                                </div>

                                {/* Image */}
                                {place.image_url && (
                                  <img
                                    src={place.image_url}
                                    alt={place.name}
                                    className="w-20 h-full object-cover flex-shrink-0 max-h-24"
                                    onError={e => { e.target.style.display = "none"; }}
                                  />
                                )}

                                {/* Info */}
                                <div className="p-3 flex-1 min-w-0 flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${dayPal.text} ${dayPal.light} px-2 py-0.5 rounded-full`}>
                                          {place.type}
                                        </span>
                                        <Link
                                          to={`/places/${place.id}`}
                                          className="block font-bold text-sm text-gray-800 dark:text-gray-200 mt-1 hover:text-indigo-600 transition-colors leading-tight"
                                        >
                                          {place.name}
                                        </Link>
                                      </div>
                                      {place.rating > 0 && (
                                        <span className="text-xs font-bold text-amber-500 shrink-0">⭐ {place.rating}</span>
                                      )}
                                    </div>
                                    {place.address && (
                                      <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 truncate">
                                        📍 {place.address}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-1.5 mt-2">
                                    {mapsUrl && (
                                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors font-semibold">
                                        🗺️ Maps
                                      </a>
                                    )}
                                    <button
                                      onClick={() => removeItem(item.id)}
                                      className="text-[10px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-400 hover:border-red-300 hover:text-red-400 transition-colors font-semibold"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
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
