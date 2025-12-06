import uvicorn
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, cast
from geoalchemy2 import Geography
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

# --- FIX: Changed relative imports to absolute ---
import models
import database
from database import engine, get_db
# -------------------------------------------------

# This creates the 'places' table if it doesn't exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- CORS ---
from settings import settings

# Allow localhost for development and frontend URL from settings
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173", # Default for Vite
    "http://127.0.0.1:5173", # Alternative localhost format
]

# Add frontend URL from settings if it's set
if hasattr(settings, 'FRONTEND_URL') and settings.FRONTEND_URL:
    origins.append(settings.FRONTEND_URL)

# Allow all origins for now (you can restrict this in production)
# Note: When allow_origins=["*"], allow_credentials must be False
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"],  # Allow all origins for now
    allow_methods=["*"], 
    allow_headers=["*"],
    allow_credentials=False  # Must be False when using allow_origins=["*"]
)

@app.get("/")
def read_root():
    return {"message": "Tour-Assist API is connected to PostgreSQL!"}

@app.get("/api/places")
async def get_places(
    lat: float, 
    lon: float, 
    db: Session = Depends(get_db)
):
    """
    Fetches places near a specific latitude and longitude.
    """
    
    user_location_point = cast(from_shape(Point(lon, lat), srid=4326), Geography)
    search_radius_meters = 1000

    query = (
        db.query(
            models.Place,
            func.ST_Distance(models.Place.location, user_location_point).label("distance")
        )
        .filter(
            func.ST_DWithin(
                models.Place.location,
                user_location_point,
                search_radius_meters
            )
        )
        .order_by("distance")
    )
    
    results = query.all()
    
    places_list = []
    for place, distance in results:
        place_dict = {c.name: getattr(place, c.name) for c in place.__table__.columns if c.name != 'location'}
        place_dict["distance"] = distance / 1000  
        
        # Convert non_veg to nonVeg for frontend compatibility
        if "non_veg" in place_dict:
            place_dict["nonVeg"] = place_dict.pop("non_veg")
        
        point_geom = db.scalar(func.ST_AsText(place.location))
        point_coords = point_geom.replace('POINT(', '').replace(')', '').split(' ')
        
        place_dict["location"] = {
            "lon": float(point_coords[0]),
            "lat": float(point_coords[1])
        }

        places_list.append(place_dict)

    return {"places": places_list}

if __name__ == "__main__":
    # Use 0.0.0.0 to accept connections from all interfaces (including localhost)
    uvicorn.run(app, host="0.0.0.0", port=8000)