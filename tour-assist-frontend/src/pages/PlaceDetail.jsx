import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icon issue in React
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return "http://127.0.0.1:8000";
};
const API_BASE_URL = getApiBaseUrl();

function PlaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We fetch the all places API to grab the details since we don't have a specific /api/places/{id} yet
    fetch(`${API_BASE_URL}/api/places/all?limit=1000`)
      .then(res => res.json())
      .then(data => {
        const found = data.places.find(p => p.id === parseInt(id));
        setPlace(found);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-10 text-center">Loading details...</div>;
  if (!place) return <div className="p-10 text-center text-red-500">Place not found.</div>;

  const position = [
    place.location?.coordinates?.[1] || 0,
    place.location?.coordinates?.[0] || 0
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 relative z-10 w-full">
      <button onClick={() => navigate(-1)} className="mb-6 px-4 py-2 bg-white/70 backdrop-blur-md border border-gray-200 rounded-full text-gray-700 hover:bg-gray-100 transition-colors font-medium shadow-sm flex items-center gap-2">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Back to Results
      </button>

      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/40 dark:border-gray-700/50 rounded-3xl shadow-2xl overflow-hidden">
        <div className="relative h-72 sm:h-96 w-full">
          <img 
            src={place.image_url || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80"}
            alt={place.name} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          <div className="absolute bottom-6 left-6 right-6">
             <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-3 py-1 bg-primary text-white rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                {place.type}
              </span>
              {place.rating > 0 && (
                <span className="px-3 py-1 bg-accent text-gray-900 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                  ⭐ {place.rating} / 5.0
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white mb-2 leading-tight drop-shadow-md">{place.name}</h1>
            <p className="text-gray-200 text-sm sm:text-base font-medium flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {place.address}
            </p>
          </div>
        </div>
        
        <div className="p-6 sm:p-10">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">About</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed max-w-3xl mb-10 text-lg">
            {place.description || "No description available for this place."}
          </p>

          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Explore on Map</h2>
          {position[0] !== 0 && position[1] !== 0 ? (
            <div className="h-80 sm:h-96 w-full rounded-2xl overflow-hidden shadow-inner border border-gray-200 dark:border-gray-700 relative z-0">
              <MapContainer center={position} zoom={15} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                <Marker position={position}>
                  <Popup className="font-sans">
                    <strong>{place.name}</strong> <br /> {place.address}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : (
             <p className="text-gray-500 italic">No map coordinates available for this location.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlaceDetail;
