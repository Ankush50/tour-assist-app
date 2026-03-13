import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, MapPin, Star } from "lucide-react";

// Same getting API URL logic as App.jsx
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (
    import.meta.env.MODE === "production" ||
    window.location.hostname !== "localhost"
  ) {
    return "https://tour-assist-app.onrender.com";
  }
  return "http://localhost:8000";
};
const API_BASE_URL = getApiBaseUrl();

// Re-using the fallback image logic
const HOTEL_IMAGES = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
];
const RESTAURANT_IMAGES = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
];
const getFallbackImage = (type, name) => {
  const images = type === "Hotel" ? HOTEL_IMAGES : RESTAURANT_IMAGES;
  const index =
    name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    images.length;
  return images[index];
};

const SavedPlaceCard = ({ place, onRemove }) => {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.location?.lat},${place.location?.lon}`;

  return (
    <div className="bg-surface rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02] relative group">
      <div className="relative h-48">
        <img
          className="w-full h-full object-cover"
          src={place.image_url || getFallbackImage(place.type, place.name)}
          alt={place.name}
          onError={(e) => {
            e.target.src = getFallbackImage(place.type, place.name);
          }}
        />
        <div className="absolute top-2 left-2 bg-primary/90 backdrop-blur text-white px-2 py-1 rounded-md text-sm font-bold flex items-center gap-1 shadow-md">
          {place.rating || "New"} <Star className="w-3 h-3 fill-current" />
        </div>

        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            onRemove(place.id);
          }}
          className="absolute top-2 right-2 p-2 rounded-full bg-white/90 text-red-500 hover:bg-red-50 hover:text-red-700 shadow-md transition-all duration-300 transform opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
          title="Remove from Saved"
        >
          <svg
            className="w-5 h-5 fill-current"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={0}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      </div>

      <a
        href={place.location ? googleMapsUrl : "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4"
      >
        <div className="flex justify-between items-start mb-2">
          <h3
            className="text-lg font-bold text-text-main pr-2 break-words"
            title={place.name}
          >
            {place.name}
          </h3>
          <span
            className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${place.type === "Hotel" ? "bg-secondary text-text-main" : "bg-primary/20 text-primary"}`}
          >
            {place.type}
          </span>
        </div>
        <div className="text-sm text-gray-500 flex items-start gap-1">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="line-clamp-2">
            {place.address || "Address not available"}
          </span>
        </div>
      </a>
    </div>
  );
};

const SavedPlaces = () => {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  if (!username) {
    navigate("/login");
    return null;
  }

  const [savedPlaces, setSavedPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSavedPlaces();
  }, []);

  const fetchSavedPlaces = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/user/saved-places`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to load saved places");

      const data = await response.json();
      setSavedPlaces(data.places || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePlace = async (placeId) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Optimistically remove from UI
    setSavedPlaces((prev) => prev.filter((p) => p.id !== placeId));

    try {
      await fetch(`${API_BASE_URL}/api/places/${placeId}/save`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error("Failed to remove place", error);
      // Refresh to restore state if deletion failed
      fetchSavedPlaces();
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans text-text-main flex flex-col items-center">
      {/* Header */}
      <header className="w-full bg-surface shadow-sm border-b border-secondary py-4 px-6 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-primary hover:text-accent transition-colors font-medium"
        >
          <ArrowLeft size={20} />
          Back to Map
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold font-serif text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent">
            Odyssey
          </h1>
          <span>🧭</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl p-4 md:p-8 flex flex-col">
        <div className="text-center mb-8 mt-4 md:mt-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4 text-primary">
            <Compass size={32} />
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-text-main mb-3 font-serif">
            Your Travel Itinerary
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Ready to embark,{" "}
            <span className="font-bold text-accent">{username}</span>?
          </p>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        {error && !loading && (
          <div className="text-center text-red-500 py-10 bg-red-50 rounded-xl max-w-2xl mx-auto w-full">
            <p>{error}</p>
            <button
              onClick={fetchSavedPlaces}
              className="mt-4 text-primary underline"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Content Area */}
        {!loading && !error && savedPlaces.length === 0 ? (
          <div className="bg-surface rounded-2xl shadow-sm border border-secondary p-8 md:p-12 text-center flex flex-col items-center justify-center bg-opacity-50 min-h-[300px] max-w-2xl mx-auto w-full">
            <svg
              className="w-16 h-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              ></path>
            </svg>
            <h3 className="text-2xl font-bold text-text-main mb-2">
              No places saved yet
            </h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Start exploring the map and click the heart icon on hotels or
              restaurants you want to visit.
            </p>
            <button
              onClick={() => navigate("/")}
              className="bg-primary hover:bg-opacity-90 text-white font-bold py-3 px-8 rounded-xl shadow-md transform transition-all hover:scale-105"
            >
              Start Exploring
            </button>
          </div>
        ) : (
          !loading &&
          !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {savedPlaces.map((place) => (
                <SavedPlaceCard
                  key={place.id}
                  place={place}
                  onRemove={handleRemovePlace}
                />
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default SavedPlaces;
