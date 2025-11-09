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
    <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="#0f8a4f" strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="4" fill="#0f8a4f"/>
  </svg>
);

const NonVegIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 20 20">
    <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="#e43b4f" strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="4" fill="#e43b4f"/>
  </svg>
);

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

// --- **** UPDATED FUNCTION **** ---
// Renamed to 'fetchPlacesNearCoords' and now takes lat/lon as arguments.
async function fetchPlacesNearCoords(lat, lon) {
  if (!lat || !lon) return [];
  
  const API_URL = `http://127.0.0.1:8000/api/places?lat=${lat}&lon=${lon}`;
  
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.places || [];
  } catch (error) {
    console.error("Error fetching places:", error);
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
    <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-6">
          {/* Branding - Top Left */}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-red-600">
              Tour-Assist 🧭
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
                className="w-full px-6 py-3 pr-14 text-base text-gray-800 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                required
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
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

// --- Zomato-Style Card Component (No change) ---
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
    if (rating >= 4.5) return 'bg-green-600';
    if (rating >= 4.0) return 'bg-green-500';
    if (rating >= 3.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation?.lat},${userLocation?.lon}&destination=${place.location?.lat},${place.location?.lon}`;

  return (
    <a
      href={userLocation && place.location ? googleMapsUrl : '#'}
      target="_blank"
      rel="noopener noreferrer"
      title={userLocation && place.location ? "Click to get directions" : "Enable location to get directions"}
      className={`block ${!userLocation || !place.location ? 'cursor-not-allowed' : ''}`}
    >
      <div className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
        <div className="relative">
          <img
            className="aspect-[16/9] w-full object-cover"
            src={place.image_url || 'https://placehold.co/400x225/f0f0f0/c2c2c2?text=Image+Not+Found'}
            alt={place.name}
            onError={(e) => { e.target.src = 'https://placehold.co/400x225/f0f0f0/c2c2c2?text=Image+Not+Found'; }}
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
            <h3 className="text-lg font-bold text-gray-900 truncate" title={place.name}>
              {place.name}
            </h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${place.type === 'Hotel' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
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
            {place.distance != null && (
              <span>{place.distance.toFixed(1)} km away</span>
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
    setLoading(true);
    setMessage('');
    setAllPlaces([]);

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
      setMessage(`No results found near "${destination}".`);
    }
    setLoading(false);
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
    <div className="min-h-screen bg-gray-100 font-inter">
      {/* Navbar */}
      <Navbar 
        destination={destination}
        setDestination={setDestination}
        onSearch={handleSearch}
        loading={loading}
      />
      
      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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
                    <span className="block px-4 py-2 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 transition-all peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700 hover:border-gray-300">
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
                    <span className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm font-medium transition-all peer-checked:border-green-500 peer-checked:bg-green-50 peer-checked:text-green-700 hover:border-gray-300">
                      <VegIcon className="w-4 h-4" />
                      Veg
                    </span>
                  </label>
                  <label className="relative cursor-pointer">
                    <input
                      type="checkbox" name="nonVeg" checked={filters.nonVeg} onChange={handleFilterChange}
                      disabled={filters.type === 'Hotel'} className="peer sr-only"
                    />
                    <span className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm font-medium transition-all peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700 hover:border-gray-300">
                      <NonVegIcon className="w-4 h-4" />
                      Non-Veg
                    </span>
                  </label>
                </div>
                
                {/* Price Filter */}
                <div className={`flex gap-3 border-l border-gray-200 pl-4 ${filters.type === 'Restaurant' ? 'opacity-40 pointer-events-none' : ''}`}>
                  {[1, 2, 3].map(price => (
                    <label key={price} className="relative cursor-pointer">
                      <input
                        type="checkbox" name="price" value={price} checked={filters.price[price]} onChange={handleFilterChange}
                        disabled={filters.type === 'Restaurant'} className="peer sr-only"
                      />
                      <span className="block px-3 py-2 rounded-xl border-2 border-gray-200 text-sm font-medium transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 hover:border-gray-300">
                        {'$'.repeat(price)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* Sort By */}
            <div className="lg:col-span-4">
              <label htmlFor="sort" className="text-sm font-semibold text-gray-700 block mb-3">Sort By</label>
              <select
                id="sort" name="sort" value={filters.sort} onChange={handleFilterChange}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm font-medium text-gray-700 hover:border-gray-300 transition-all"
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
    </div>
  );
}

export default App;