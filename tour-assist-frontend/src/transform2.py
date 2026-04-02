import re

with open("g:/TourAssit/tour-assist-frontend/src/App.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# Replace the grid layout cleanly
original_grid = """          {!loading && filteredResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResults.map((place, index) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  userLocation={userLocation}
                  priority={index < 4}
                />
              ))}
            </div>
          )}"""
          
new_grid = """          {!loading && filteredResults.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-full lg:w-[65%]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredResults.map((place, index) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      userLocation={userLocation}
                      priority={index < 4}
                    />
                  ))}
                </div>
                {hasMore && <div ref={ref} className="h-20 w-full flex items-center justify-center text-gray-500 mt-4">Loading more places...</div>}
              </div>
              
              <div className="w-full lg:w-[35%] hidden lg:block">
                <div className="sticky top-8 h-[calc(100vh-120px)] rounded-2xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700">
                  <MapContainer 
                    center={userLocation ? [userLocation.lat, userLocation.lon] : [20.5937, 78.9629]} 
                    zoom={userLocation ? 13 : 5} 
                    scrollWheelZoom={true} 
                    className="h-full w-full z-0"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    {filteredResults.map(p => 
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
          )}"""

if original_grid in code:
    code = code.replace(original_grid, new_grid)
    with open("g:/TourAssit/tour-assist-frontend/src/App.jsx", "w", encoding="utf-8") as f:
        f.write(code)
    print("Fixed layout")
else:
    print("Could not find original layout")
