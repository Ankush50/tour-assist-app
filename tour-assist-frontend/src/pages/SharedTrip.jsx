import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.MODE === "production" || window.location.hostname !== "localhost") {
    return "https://tour-assist-app.onrender.com";
  }
  return "http://localhost:8000";
};
const API_BASE_URL = getApiBaseUrl();

const DAY_COLORS = [
  "from-violet-500 to-purple-600",
  "from-pink-500 to-rose-500",
  "from-amber-500 to-orange-500",
  "from-teal-500 to-emerald-500",
  "from-blue-500 to-indigo-500",
  "from-lime-500 to-green-500",
];
const DAY_LIGHT = [
  "bg-violet-50 dark:bg-violet-900/20 border-violet-200",
  "bg-pink-50 dark:bg-pink-900/20 border-pink-200",
  "bg-amber-50 dark:bg-amber-900/20 border-amber-200",
  "bg-teal-50 dark:bg-teal-900/20 border-teal-200",
  "bg-blue-50 dark:bg-blue-900/20 border-blue-200",
  "bg-lime-50 dark:bg-lime-900/20 border-lime-200",
];
const DAY_EMOJIS = ["🌅", "🌞", "🌇", "🌃", "🌠", "🌄", "🏙️"];

function SharedTrip() {
  const { shareToken } = useParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  // Search panel for adding places
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingPlaceId, setAddingPlaceId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1);

  // Edit toast
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const maxDay = Math.max(1, ...((trip?.items || []).map(i => i.day_number)));

  useEffect(() => {
    loadTrip();
  }, [shareToken]);

  const loadTrip = () => {
    fetch(`${API_BASE_URL}/api/trips/shared/${shareToken}`)
      .then(res => {
        if (!res.ok) throw new Error("Trip not found or link expired.");
        return res.json();
      })
      .then(data => { setTrip(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  const searchPlaces = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/places/search?query=${encodeURIComponent(searchQuery)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.places || []);
      }
    } catch (e) { console.error(e); }
    setSearching(false);
  };

  const handleAddPlace = async (placeId) => {
    if (!token) { showToast("Please log in to edit this trip.", "error"); return; }
    setAddingPlaceId(placeId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips/shared/${shareToken}/items`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ place_id: placeId, day_number: selectedDay }),
      });
      if (res.ok) {
        const newItem = await res.json();
        setTrip(prev => ({ ...prev, items: [...prev.items, newItem] }));
        showToast(`Added to Day ${selectedDay}! 🎉`);
      } else {
        const err = await res.json();
        showToast(err.detail || "Could not add place.", "error");
      }
    } catch (e) { showToast("Network error.", "error"); }
    setAddingPlaceId(null);
  };

  const handleRemoveItem = async (itemId) => {
    if (!token) { showToast("Please log in to edit this trip.", "error"); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips/shared/${shareToken}/items/${itemId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        setTrip(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
        showToast("Removed from trip.");
      }
    } catch (e) { console.error(e); }
  };

  const handleChangeDay = async (itemId, newDay) => {
    if (!token) { showToast("Please log in to edit this trip.", "error"); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips/shared/${shareToken}/items/${itemId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ day_number: newDay }),
      });
      if (res.ok) {
        setTrip(prev => ({
          ...prev,
          items: prev.items.map(i => i.id === itemId ? { ...i, day_number: newDay } : i)
        }));
        showToast(`Moved to Day ${newDay} 📅`);
      }
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">🗺️</div>
        <p className="text-gray-500 font-medium">Loading shared trip...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl p-10 shadow-lg max-w-md mx-4">
        <div className="text-5xl mb-4">😶</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Trip Not Found</h1>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link to="/" className="px-6 py-3 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-colors">
          ← Back to Odyssey
        </Link>
      </div>
    </div>
  );

  // Group items by day
  const days = {};
  (trip.items || []).forEach(item => {
    const day = item.day_number;
    if (!days[day]) days[day] = [];
    days[day].push(item);
  });
  const sortedDays = Object.keys(days).map(Number).sort((a, b) => a - b);
  const totalDays = sortedDays.length > 0 ? Math.max(...sortedDays) : 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 font-sans">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[999] px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-bold transition-all ${toast.type === "error" ? "bg-red-500" : "bg-emerald-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-500 text-white py-12 px-4 shadow-xl">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 right-20 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-2">
                🔗 Shared Itinerary by {trip.created_by}
              </p>
              <h1 className="text-4xl md:text-5xl font-black mb-2 drop-shadow">{trip.trip_name}</h1>
              <p className="text-indigo-200 text-sm">
                {trip.items.length} place{trip.items.length !== 1 ? "s" : ""} · {sortedDays.length} day{sortedDays.length !== 1 ? "s" : ""}
              </p>
            </div>
            {/* Collaborative edit toggle */}
            {token ? (
              <button
                onClick={() => setShowAddPanel(v => !v)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm border-2 transition-all ${
                  showAddPanel
                    ? "bg-white text-indigo-600 border-white"
                    : "bg-white/20 hover:bg-white/30 text-white border-white/40"
                }`}
              >
                {showAddPanel ? "✕ Close Editor" : `✏️ Edit as ${username}`}
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm border-2 bg-white/20 hover:bg-white/30 text-white border-white/40 transition-all"
              >
                🔒 Log in to Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Add Places Panel */}
      {showAddPanel && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-5">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h3 className="font-black text-gray-800 text-lg">➕ Add a Place</h3>
              {username && <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-600 rounded-full font-bold">✏️ Editing as {username}</span>}
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-xs font-bold text-gray-500">Add to Day:</label>
                <select
                  value={selectedDay}
                  onChange={e => setSelectedDay(Number(e.target.value))}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {Array.from({ length: totalDays + 1 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>Day {d}</option>
                  ))}
                  <option value={totalDays + 1}>New Day {totalDays + 1}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchPlaces()}
                placeholder="Search for a place to add... (e.g. Taj Mahal)"
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={searchPlaces}
                disabled={searching}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {searching ? "..." : "Search"}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {searchResults.map(place => {
                  const alreadyAdded = trip.items.some(i => i.place?.id === place.id);
                  return (
                    <div key={place.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${alreadyAdded ? "border-gray-100 bg-gray-50 opacity-50" : "border-gray-100 hover:border-indigo-200 bg-white hover:bg-indigo-50"}`}>
                      {place.image_url && (
                        <img src={place.image_url} alt={place.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" onError={e => e.target.style.display = "none"} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">{place.name}</p>
                        <p className="text-xs text-gray-400 truncate">{place.type} · {place.address}</p>
                      </div>
                      <button
                        onClick={() => !alreadyAdded && handleAddPlace(place.id)}
                        disabled={alreadyAdded || addingPlaceId === place.id}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          alreadyAdded ? "bg-gray-100 text-gray-400 cursor-not-allowed" :
                          addingPlaceId === place.id ? "bg-gray-100 text-gray-400" :
                          "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                      >
                        {alreadyAdded ? "Added" : addingPlaceId === place.id ? "..." : "+ Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Day Itinerary */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {sortedDays.length === 0 ? (
          <div className="text-center py-24 rounded-3xl border-2 border-dashed border-gray-200 bg-white/60">
            <div className="text-6xl mb-5">📋</div>
            <p className="font-bold text-gray-600 text-lg mb-2">No places yet!</p>
            <p className="text-sm text-gray-400">Click "✏️ Edit This Trip" above to add places</p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {sortedDays.map((day, dayIdx) => {
              const pal = DAY_COLORS[dayIdx % DAY_COLORS.length];
              const light = DAY_LIGHT[dayIdx % DAY_LIGHT.length];
              const emoji = DAY_EMOJIS[dayIdx % DAY_EMOJIS.length];
              return (
                <div key={day}>
                  {/* Day Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${pal} text-white font-black text-lg flex items-center justify-center shadow-md`}>
                      {emoji}
                    </div>
                    <div>
                      <h2 className="font-black text-gray-800 text-lg">Day {day}</h2>
                      <p className="text-xs text-gray-400">{days[day].length} stop{days[day].length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className={`flex-1 h-0.5 bg-gradient-to-r ${pal} opacity-30 rounded-full`} />
                  </div>

                  <div className="flex flex-col gap-3">
                    {days[day].map((item, idx) => {
                      const place = item.place;
                      if (!place) return null;
                      const mapsUrl = place.location
                        ? `https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lon}`
                        : null;

                      return (
                        <div key={item.id} className={`bg-white rounded-2xl border-2 ${light} overflow-hidden flex hover:shadow-lg transition-all group`}>
                          {/* Step number */}
                          <div className={`${light} w-10 flex items-center justify-center flex-shrink-0`}>
                            <span className="text-sm font-black text-gray-500">{idx + 1}</span>
                          </div>

                          {/* Image */}
                          {place.image_url && (
                            <img src={place.image_url} alt={place.name} className="w-20 h-full max-h-24 object-cover flex-shrink-0" onError={e => e.target.style.display = "none"} />
                          )}

                          {/* Info */}
                          <div className="p-3 flex-1 min-w-0 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{place.type}</span>
                                <Link to={`/places/${place.id}`} className="block font-bold text-gray-800 mt-1 text-sm hover:text-indigo-600 transition-colors leading-tight truncate">
                                  {place.name}
                                </Link>
                                {place.address && <p className="text-[10px] text-gray-400 truncate">📍 {place.address}</p>}
                              </div>
                              {place.rating > 0 && <span className="text-xs font-bold text-amber-500 shrink-0">⭐ {place.rating}</span>}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {mapsUrl && (
                                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors font-semibold">
                                  🗺️ Maps
                                </a>
                              )}
                              {/* Move day selector */}
                              {showAddPanel && (
                                <>
                                  <select
                                    value={item.day_number}
                                    onChange={e => handleChangeDay(item.id, Number(e.target.value))}
                                    className="text-[10px] px-2 py-1 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                    title="Move to different day"
                                  >
                                    {Array.from({ length: totalDays + 1 }, (_, i) => i + 1).map(d => (
                                      <option key={d} value={d}>Day {d}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="text-[10px] px-2.5 py-1 rounded-full border border-red-100 text-red-400 hover:border-red-300 hover:text-red-500 transition-colors font-semibold"
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
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

        {/* Footer CTA */}
        <div className="text-center mt-16 py-10 border-t border-gray-100">
          <p className="text-gray-400 text-sm mb-4">Discover your own journey with Odyssey</p>
          <Link to="/"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            🧭 Open Odyssey
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SharedTrip;
