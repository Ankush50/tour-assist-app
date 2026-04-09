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

function SharedTrip() {
  const { shareToken } = useParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/trips/shared/${shareToken}`)
      .then(res => {
        if (!res.ok) throw new Error("Trip not found or link expired.");
        return res.json();
      })
      .then(data => { setTrip(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [shareToken]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">🧭</div>
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
  const sortedDays = Object.keys(days).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-indigo-200 text-sm font-semibold uppercase tracking-widest mb-3">
            🔗 Shared Itinerary by {trip.created_by}
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-3">{trip.trip_name}</h1>
          <p className="text-indigo-200">
            {trip.items.length} place{trip.items.length !== 1 ? "s" : ""} · {sortedDays.length} day{sortedDays.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        {sortedDays.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">📋</div>
            <p>This trip has no places added yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {sortedDays.map(day => (
              <div key={day}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-lg">
                    {day}
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Day {day}</h2>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <div className="flex flex-col gap-4">
                  {days[day].map((item, idx) => {
                    const place = item.place;
                    if (!place) return null;
                    const mapsUrl = place.location
                      ? `https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lon}`
                      : null;

                    return (
                      <div key={item.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex gap-0 hover:shadow-lg transition-shadow">
                        {/* Color accent */}
                        <div className="w-1.5 bg-gradient-to-b from-indigo-500 to-purple-500 flex-shrink-0" />
                        
                        {/* Place image */}
                        {place.image_url && (
                          <img
                            src={place.image_url}
                            alt={place.name}
                            className="w-24 h-24 object-cover flex-shrink-0"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        )}

                        {/* Info */}
                        <div className="p-4 flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                                {place.type}
                              </span>
                              <h3 className="font-bold text-gray-800 mt-1 text-base leading-tight">{place.name}</h3>
                            </div>
                            {place.rating > 0 && (
                              <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg shrink-0">
                                ⭐ {place.rating}
                              </span>
                            )}
                          </div>
                          {place.address && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1 truncate">
                              📍 {place.address}
                            </p>
                          )}
                          {place.description && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{place.description}</p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Link
                              to={`/places/${place.id}`}
                              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700 transition-colors"
                            >
                              View Details →
                            </Link>
                            {mapsUrl && (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-full font-semibold hover:border-blue-400 hover:text-blue-500 transition-colors"
                              >
                                🗺️ Maps
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        <div className="text-center mt-16 py-10 border-t border-gray-100">
          <p className="text-gray-400 text-sm mb-4">Discover your own journey with Odyssey</p>
          <Link
            to="/"
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
