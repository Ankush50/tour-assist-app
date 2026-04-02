import re

with open("g:/TourAssit/tour-assist-frontend/src/App.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Imports
if "PlaceDetail" not in code:
    code = code.replace(
        'import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";',
        'import { BrowserRouter, Routes, Route, useNavigate, Link } from "react-router-dom";'
    )
    code = code.replace(
        'import SavedPlaces from "./pages/SavedPlaces";',
        'import SavedPlaces from "./pages/SavedPlaces";\nimport PlaceDetail from "./pages/PlaceDetail";\nimport { useInView } from "react-intersection-observer";\nimport { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";\nimport "leaflet/dist/leaflet.css";\nimport L from "leaflet";\nimport markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";\nimport markerIcon from "leaflet/dist/images/marker-icon.png";\nimport markerShadow from "leaflet/dist/images/marker-shadow.png";\ndelete L.Icon.Default.prototype._getIconUrl;\nL.Icon.Default.mergeOptions({\n  iconRetinaUrl: markerIcon2x,\n  iconUrl: markerIcon,\n  shadowUrl: markerShadow,\n});'
    )

# 2. Add Routes
if "PlaceDetail" not in code.split("<Routes>")[1]:
    code = code.replace(
        '<Route path="/saved" element={<SavedPlaces />} />',
        '<Route path="/saved" element={<SavedPlaces />} />\n        <Route path="/places/:id" element={<PlaceDetail />} />'
    )

# 3. Add Link to PlaceCard
if "<div className=\"bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-white/40 dark:border-gray-700/50 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col group overflow-hidden\">" in code:
    code = code.replace(
        '<div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-white/40 dark:border-gray-700/50 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col group overflow-hidden">',
        '<Link to={`/places/${place.id}`} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-white/40 dark:border-gray-700/50 rounded-2xl shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 flex flex-col group overflow-hidden cursor-pointer block">'
    )
    # Finding the end of PlaceCard
    code = code.replace(
        """        </div>
      </div>
    </div>
  );
};""", 
        """        </div>
      </div>
    </Link>
  );
};"""
    )
    
# 4. Filter categories
code = code.replace(
    '{["All", "Hotel", "Restaurant"].map((type) => (',
    '{["All", "Hotel", "Restaurant", "Attraction", "Activity", "Landmark"].map((type) => ('
)

# 5. Fetch default places / Handle infinite scroll states
inview_state = r"""
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { ref, inView } = useInView({ rootMargin: '400px' });
  const PAGE_LIMIT = 20;

  useEffect(() => {
    if (inView && hasMore && !loading && hasLocationDetermined) {
      setPage(p => p + 1);
    }
  }, [inView, hasMore, loading, hasLocationDetermined]);
"""

if "useInView({ rootMargin" not in code:
    code = code.replace(
        '  const [userLocation, setUserLocation] = useState(null);',
        '  const [userLocation, setUserLocation] = useState(null);\n' + inview_state
    )
    
fetch_replace = r"""
  useEffect(() => {
    if (!destination && hasLocationDetermined) {
      const fetchDefaultPlaces = async () => {
        if (page === 0) setLoading(true);
        try {
          let url = `${API_BASE_URL}/api/places/all?limit=${PAGE_LIMIT}&skip=${page * PAGE_LIMIT}`;
          if (userLocation) {
            url = `${API_BASE_URL}/api/places?lat=${userLocation.lat}&lon=${userLocation.lon}&limit=${PAGE_LIMIT}&skip=${page * PAGE_LIMIT}`;
          }
          
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            const fetched = data.places || [];
            if (fetched.length < PAGE_LIMIT) setHasMore(false);
            
            if (page === 0) {
               setAllPlaces(fetched);
               if (fetched.length > 0) setMessage("Top places for you");
               else setMessage("No places found.");
            } else {
               setAllPlaces(prev => {
                   const ids = prev.map(p => p.id);
                   return [...prev, ...fetched.filter(p => !ids.includes(p.id))];
               });
            }
          }
        } catch (error) {
          console.error("Error fetching defaults:", error);
          if (page === 0) setMessage("Could not load places.");
        } finally {
          if (page === 0) setLoading(false);
        }
      };

      fetchDefaultPlaces();
    }
  }, [destination, hasLocationDetermined, userLocation, page]); 

  // Reset page when search or location changes
  useEffect(() => {
     setPage(0);
     setHasMore(true);
  }, [destination, userLocation]);
"""

# Replace the original fetchDefaultPlaces useEffect
orig_fetch_start = code.find("  // --- ADDED: Fetch Default Places ---")
orig_fetch_end = code.find("  // --- END ADDED CODE ---", orig_fetch_start)
if orig_fetch_start != -1 and orig_fetch_end != -1:
    code = code[:orig_fetch_start] + fetch_replace + code[orig_fetch_end + 28:]

# 6. Infinite Scroll and Map Layout
# Find the places grid to inject intersection ref and map UI
grid_start = code.find('            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">')
grid_end = code.find('          )}', grid_start)
if grid_start != -1 and "ref={ref}" not in code:
    original_grid = code[grid_start:grid_end]
    
    # We will split the container to have a map side-by-side on large screens
    map_html = """
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-full lg:w-2/3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {filteredPlaces.map((place, index) => (
                    <PlaceCard
                      key={place.id || index}
                      place={place}
                      userLocation={userLocation}
                      priority={index < 4}
                    />
                  ))}
                </div>
                {hasMore && <div ref={ref} className="h-20 w-full flex items-center justify-center text-gray-500 mt-4">Loading more places...</div>}
              </div>
              <div className="w-full lg:w-1/3 hidden lg:block">
                <div className="sticky top-8 h-[calc(100vh-120px)] rounded-2xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700">
                  <MapContainer 
                    center={userLocation ? [userLocation.lat, userLocation.lon] : [20.5937, 78.9629]} 
                    zoom={userLocation ? 13 : 5} 
                    scrollWheelZoom={true} 
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    {filteredPlaces.map(p => 
                      p.location && p.location.coordinates ? (
                        <Marker key={p.id} position={[p.location.coordinates[1], p.location.coordinates[0]]}>
                           <Popup><Link to={`/places/${p.id}`} className="font-bold underline">{p.name}</Link></Popup>
                        </Marker>
                      ) : null
                    )}
                  </MapContainer>
                </div>
              </div>
            </div>
"""
    code = code.replace(original_grid, map_html)

with open("g:/TourAssit/tour-assist-frontend/src/App.jsx", "w", encoding="utf-8") as f:
    f.write(code)

print("App.jsx transformed successfully!")
