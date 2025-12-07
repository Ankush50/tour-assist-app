import React, { useState, useMemo, useEffect } from 'react';

// --- Icon Components (No change) ---
const StarIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.87 5.753h6.05c.969 0 1.371 1.24.588 1.81l-4.89 3.548 1.87 5.753c.3.921-.755 1.688-1.54 1.18l-4.89-3.548-4.89 3.548c-.784.508-1.84-.259-1.54-1.18l1.87-5.753-4.89-3.548c-.783-.57-.38-1.81.588-1.81h6.05l1.87-5.753z" />
  </svg>
);

const SearchIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const VegIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 20 20">
    <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-green-600"/>
    <circle cx="10" cy="10" r="4" fill="currentColor" className="text-green-600"/>
  </svg>
);

const NonVegIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 20 20">
    <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-600"/>
    <circle cx="10" cy="10" r="4" fill="currentColor" className="text-red-600"/>
  </svg>
);

const HOTEL_IMAGES = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80",
  "https://plus.unsplash.com/premium_photo-1661953124283-76d0a8436b87?q=80&w=888&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?q=80&w=871&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", 
];

const RESTAURANT_IMAGES = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?q=80&w=465&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

];

const getFallbackImage = (type, name) => {
  const images = type === 'Hotel' ? HOTEL_IMAGES : RESTAURANT_IMAGES;
  // Simple hash function to deterministically pick an image based on name
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % images.length;
  return images[index];
};

// --- Helper Functions ---
function filterAndSortPlaces(places, filters) {
  let filtered = [...places];

  if (filters.type !== 'All') {
    filtered = filtered.filter(place => place.type === filters.type);
  }

  if (filters.type !== 'Hotel') {
    if (filters.veg && !filters.nonVeg) {
      filtered = filtered.filter(place => place.veg === true);
    } else if (!filters.veg && filters.nonVeg) {
      filtered = filtered.filter(place => place.nonVeg === true);
    } else if (!filters.veg && !filters.nonVeg) {
      filtered = filtered.filter(place => place.type === 'Hotel');
    }
  }

  if (filters.type !== 'Restaurant') {
    const selectedPrices = Object.keys(filters.price)
      .filter(key => filters.price[key])
      .map(key => parseInt(key));

    if (selectedPrices.length > 0 && selectedPrices.length < 3) {
      filtered = filtered.filter(place => place.type === 'Restaurant' || selectedPrices.includes(place.price));
    }
  }

  switch (filters.sort) {
    case 'rating':
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'price_low_high':
      filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price_high_low':
      filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'nearest':
    default:
      filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      break;
  }
  return filtered;
}

// --- **** NEW FUNCTION **** ---
// This function converts a text address (e.g., "Delhi") into coordinates.
async function geocodeDestination(destination) {
  // Uses a free, public geocoding API (Nominatim)
  const GEOCODE_URL = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`;
  
  try {
    const response = await fetch(GEOCODE_URL);
    if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const { lat, lon } = data[0];
      return { lat: parseFloat(lat), lon: parseFloat(lon) };
    } else {
      return null; // No coordinates found
    }
  } catch (error) {
    console.error("Error geocoding destination:", error);
    return null;
  }
}

// --- API Configuration ---
// Use environment variable, or default to Render URL for production, localhost for development
const getApiBaseUrl = () => {
  // Check if VITE_API_URL is explicitly set
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In production (when deployed), use Render URL
  // In development (localhost), use localhost:8000
  if (import.meta.env.MODE === 'production' || window.location.hostname !== 'localhost') {
    return 'https://tour-assist-app.onrender.com';
  }
  
  // Default to localhost for local development
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

// Log the API URL being used (for debugging)
console.log("API Base URL:", API_BASE_URL);

// --- **** UPDATED FUNCTION **** ---
// Renamed to 'fetchPlacesNearCoords' and now takes lat/lon as arguments.
async function fetchPlacesNearCoords(lat, lon) {
  if (!lat || !lon) return [];
  
  const API_URL = `${API_BASE_URL}/api/places?lat=${lat}&lon=${lon}`;
  
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Map non_veg to nonVeg for frontend compatibility
    if (data.places && Array.isArray(data.places)) {
      return data.places.map(place => ({
        ...place,
        nonVeg: place.non_veg !== undefined ? place.non_veg : place.nonVeg
      }));
    }
    
    return data.places || [];
  } catch (error) {
    console.error("Error fetching places:", error);
    console.error("API URL attempted:", API_URL);
    
    // Check if it's a network error (backend not running)
    if (error.message.includes('Failed to fetch') || error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.error(`Backend server might not be running or request was blocked. Trying to connect to: ${API_BASE_URL}`);
    }
    
    return [];
  }
}
// --- ************************** ---


// --- Navbar Component ---
const Navbar = ({ destination, setDestination, onSearch, loading }) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch(e);
    }
  };

  return (
    <nav className="bg-surface shadow-sm border-b border-secondary sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-6">
          {/* Branding - Top Left */}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-primary font-serif">
              Odyssey 🧭
            </h1>
          </div>
          
          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <form onSubmit={onSearch} className="relative">
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter a tourist place (e.g., Connaught Place, Delhi)"
                className="w-full px-6 py-3 pr-14 text-base text-text-main bg-surface border-2 border-secondary rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                required
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-opacity-90 text-white p-2.5 rounded-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                <SearchIcon className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
};

// --- Footer Component ---
const Footer = () => (
  <footer className="bg-text-main text-surface border-t border-primary/20 mt-auto py-4">
    <div className="max-w-7xl mx-auto px-4 text-center">
      <div className="mb-2">
        <span className="text-xl font-serif font-bold text-accent">Odyssey 🧭</span>
        <p className="text-xs text-gray-400">Your personal travel companion</p>
      </div>
      <div className="text-xs text-gray-300 space-y-2">
        <div className="flex justify-center gap-4 font-medium">
          <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-primary transition-colors">Contact</a>
        </div>
        <p className="opacity-60">&copy; {new Date().getFullYear()} Odyssey. All rights reserved.</p>
      </div>
    </div>
  </footer>
);


function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// --- Zomato-Style Card Component ---
const PlaceCard = ({ place, userLocation }) => {
  const formatPrice = (price) => {
    if (!price) return null;
    return (
      <span className="text-sm font-semibold text-gray-700">
        {'$'.repeat(price)}
        <span className="text-gray-400">{'$'.repeat(3 - price)}</span>
      </span>
    );
  };

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return 'bg-primary';
    if (rating >= 4.0) return 'bg-primary/80';
    if (rating >= 3.5) return 'bg-accent/80';
    return 'bg-accent';
  };

  // Calculate distance from user if location is available
  const distanceFromUser = useMemo(() => {
    if (userLocation && place.location) {
      return calculateDistance(
        userLocation.lat, userLocation.lon,
        place.location.lat, place.location.lon
      );
    }
    return null;
  }, [userLocation, place.location]);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.location?.lat},${place.location?.lon}`;

  return (
    <a
      href={place.location ? googleMapsUrl : '#'}
      target="_blank"
      rel="noopener noreferrer"
      title={place.location ? "Click to get directions" : "Location not available"}
      className={`block ${!place.location ? 'cursor-not-allowed' : ''}`}
    >
      <div className="bg-surface rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
        <div className="relative">
          <img
            className="aspect-[16/9] w-full object-cover"
            src={place.image_url || getFallbackImage(place.type, place.name)}
            alt={place.name}
            onError={(e) => {
              // Prevent infinite loop if fallback also fails
              const fallback = getFallbackImage(place.type, place.name);
              if (e.target.src !== fallback) {
                e.target.src = fallback;
              } else {
                 e.target.src = 'https://placehold.co/400x225/f0f0f0/c2c2c2?text=Image+Not+Found';
              }
            }}
          />
          {place.rating && (
            <div className={`absolute top-2 right-2 px-2 py-1 rounded-md text-white text-sm font-bold ${getRatingColor(place.rating)}`}>
              <div className="flex items-center gap-1">
                <span>{place.rating}</span>
                <StarIcon className="w-3 h-3" />
              </div>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-lg font-bold text-text-main truncate" title={place.name}>
              {place.name}
            </h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${place.type === 'Hotel' ? 'bg-secondary text-text-main' : 'bg-primary/20 text-primary'}`}>
              {place.type}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
            <div className="flex items-center gap-2">
              {place.type === 'Hotel' && <span>{formatPrice(place.price)}</span>}
              {place.type === 'Restaurant' && (
                <div className="flex gap-2">
                  {place.veg && <VegIcon title="Vegetarian" />}
                  {place.nonVeg && <NonVegIcon title="Non-Vegetarian" />}
                </div>
              )}
            </div>
          </div>
          
          {/* Distance Info */}
          <div className="flex flex-col gap-0.5 mt-1 mb-2 text-xs text-gray-500">
             {place.distance != null && (
              <span className="flex items-center gap-1">
                 📍 {place.distance.toFixed(2)} km from search
              </span>
            )}
            {distanceFromUser !== null && (
              <span className="flex items-center gap-1 text-primary font-medium" title="Calculated from your browser's location">
                 👤 {distanceFromUser.toFixed(2)} km from you (approx)
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 truncate" title={place.description}>
            {place.description}
          </p>
        </div>
      </div>
    </a>
  );
};

// --- Main App Component ---
function App() {
  const [destination, setDestination] = useState(''); // Default to empty
  const [allPlaces, setAllPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Find nearby hotels and restaurants for your trip.');
  const [filters, setFilters] = useState({
    type: 'All',
    veg: true,
    nonVeg: true,
    price: { 1: true, 2: true, 3: true },
    sort: 'nearest', // Default sort to nearest
  });

  // --- ADDED FOR NAVIGATION ---
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          console.log("User location found:", position.coords);
        },
        (error) => {
          // This is the detailed error handler
          let errorMessage = "Enable location services to get directions.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "You denied location access. Please enable it in your browser to get directions.";
              console.error("User denied the request for Geolocation.");
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable.";
              console.error("Location information is unavailable.");
              break;
            case error.TIMEOUT:
              errorMessage = "The request to get user location timed out.";
              console.error("The request to get user location timed out.");
              break;
            default:
              errorMessage = "An unknown error occurred while getting location.";
              console.error("An unknown error occurred:", error.message);
              break;
          }
          setMessage(errorMessage);
        }
      );
    } else {
      console.log("Geolocation is not available in this browser.");
      setMessage("Geolocation is not supported by your browser.");
    }
  }, []); // Empty array means this runs once on load
  // --- END OF ADDED CODE ---

  // --- **** UPDATED SEARCH HANDLER **** ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!destination.trim()) {
      setMessage('Please enter a destination to search.');
      return;
    }
    
    setLoading(true);
    setMessage('');
    setAllPlaces([]);

    try {
      // Step 1: Geocode the destination text
      const coords = await geocodeDestination(destination);

      if (!coords) {
        setMessage(`Could not find coordinates for "${destination}". Please try a different location.`);
        setLoading(false);
        return;
      }

      // Step 2: Fetch places using the coordinates
      const places = await fetchPlacesNearCoords(coords.lat, coords.lon);
      setAllPlaces(places);

      if (places.length === 0) {
        setMessage(`No results found near "${destination}". The database might be empty or there are no places within 1km of this location.`);
      }
    } catch (error) {
      console.error("Search error:", error);
      setMessage(`Error searching for "${destination}". Please check if the backend server is running.`);
    } finally {
      setLoading(false);
    }
  };
  // --- ********************************* ---

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'price') {
      setFilters(prev => ({ ...prev, price: { ...prev.price, [value]: checked } }));
    } else if (type === 'checkbox') {
      setFilters(prev => ({ ...prev, [name]: checked }));
    } else {
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  const filteredResults = useMemo(() => {
    return filterAndSortPlaces(allPlaces, filters);
  }, [allPlaces, filters]);

  return (
    <div className="min-h-screen bg-background font-sans text-text-main flex flex-col">
      {/* Navbar */}
      <Navbar 
        destination={destination}
        setDestination={setDestination}
        onSearch={handleSearch}
        loading={loading}
      />
      
      <main className="max-w-6xl mx-auto p-4 md:p-8 flex-grow w-full">
        <div className="bg-surface rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Category Filter */}
            <fieldset className="lg:col-span-3">
              <legend className="text-sm font-semibold text-gray-700 mb-3">Category</legend>
              <div className="flex flex-wrap gap-3">
                {['All', 'Hotels', 'Restaurants'].map(type => (
                  <label key={type} className="relative cursor-pointer">
                    <input
                      type="radio" name="type" value={type}
                      checked={filters.type === type} onChange={handleFilterChange}
                      className="peer sr-only"
                    />
                    <span className="block px-4 py-2 rounded-xl border-2 border-secondary text-sm font-medium text-text-main transition-all peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary hover:border-primary/50">
                      {type}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Preferences Filter */}
            <fieldset className="lg:col-span-5">
              <legend className="text-sm font-semibold text-gray-700 mb-3">Preferences</legend>
              <div className="flex flex-wrap gap-4">
                {/* Veg/Non-Veg */}
                <div className={`flex gap-3 ${filters.type === 'Hotel' ? 'opacity-40 pointer-events-none' : ''}`}>
                  <label className="relative cursor-pointer">
                    <input
                      type="checkbox" name="veg" checked={filters.veg} onChange={handleFilterChange}
                      disabled={filters.type === 'Hotel'} className="peer sr-only"
                    />
                    <span className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-secondary text-sm font-medium transition-all peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary hover:border-primary/50">
                      <VegIcon className="w-4 h-4" />
                      Veg
                    </span>
                  </label>
                  <label className="relative cursor-pointer">
                    <input
                      type="checkbox" name="nonVeg" checked={filters.nonVeg} onChange={handleFilterChange}
                      disabled={filters.type === 'Hotel'} className="peer sr-only"
                    />
                    <span className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-secondary text-sm font-medium transition-all peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent hover:border-accent/50">
                      <NonVegIcon className="w-4 h-4" />
                      Non-Veg
                    </span>
                  </label>
                </div>
                
                {/* Price Filter */}
                <div className={`flex gap-3 border-l border-gray-200 pl-4 ${filters.type === 'Restaurant' ? 'opacity-40 pointer-events-none' : ''}`}>
                  {[1, 2, 3].map(price => {
                    const priceLabels = { 1: 'Budget', 2: 'Standard', 3: 'Premium' };
                    return (
                    <label key={price} className="relative cursor-pointer">
                      <input
                        type="checkbox" name="price" value={price} checked={filters.price[price]} onChange={handleFilterChange}
                        disabled={filters.type === 'Restaurant'} className="peer sr-only"
                      />
                      <span className="block px-3 py-2 rounded-xl border-2 border-secondary text-sm font-medium transition-all peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary hover:border-primary/50">
                        {priceLabels[price]}
                      </span>
                    </label>
                  );})}
                </div>
              </div>
            </fieldset>

            {/* Sort By */}
            <div className="lg:col-span-4">
              <label htmlFor="sort" className="text-sm font-semibold text-gray-700 block mb-3">Sort By</label>
              <select
                id="sort" name="sort" value={filters.sort} onChange={handleFilterChange}
                className="w-full px-4 py-2.5 border-2 border-secondary rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm font-medium text-text-main hover:border-primary/50 transition-all"
              >
                <option value="nearest">📍 Nearest First</option>
                <option value="rating">⭐ Highest Rated</option>
                <option value="price_low_high">💰 Price: Low to High</option>
                <option value="price_high_low">💎 Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          {loading && <p className="text-center text-gray-600 text-lg">Searching...</p>}
          
          {message && !loading && <p className="text-center text-gray-600 text-lg">{message}</p>}
          
          {!loading && filteredResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResults.map(place => (
                <PlaceCard key={place.id} place={place} userLocation={userLocation} />
              ))}
            </div>
          )}
        </div>
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;