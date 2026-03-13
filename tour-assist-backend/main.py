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
from schemas import PlaceCreateRequest, UserCreate, UserLogin, Token, ReviewCreate, ReviewResponse, PlaceResponse
from utils import get_location_from_address
import auth
import difflib
from typing import List, Optional
from datetime import timedelta
# -------------------------------------------------

# This creates the 'places' table if it doesn't exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- CORS ---
from settings import settings

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"],  # Allow all origins for testing Netlify deployment
    allow_methods=["*"], 
    allow_headers=["*"],
    allow_credentials=False  # Must be False when using allow_origins=["*"]
)

@app.get("/")
def read_root():
    return {"message": "Tour-Assist API is connected to PostgreSQL!"}

# --- AUTH ROUTES ---
@app.post("/api/auth/register", response_model=Token)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = auth.create_access_token(data={"sub": new_user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login", response_model=Token)
def login_for_access_token(user_credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == user_credentials.username).first()
    if not user or not auth.verify_password(user_credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}
# -------------------

# --- AUTH DEPENDENCIES ---
from fastapi.security import OAuth2PasswordBearer
import jwt
from auth import oauth2_scheme, SECRET_KEY, ALGORITHM

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def serialize_place(place, db: Session, user=None):
    """Helper to serialize a single place model to dictionary"""
    place_dict = {c.name: getattr(place, c.name) for c.name in place.__table__.columns.keys() if c.name != 'location'}
    
    if place.location is not None:
        point_geom = db.scalar(func.ST_AsText(place.location))
        point_coords = point_geom.replace('POINT(', '').replace(')', '').split(' ')
        place_dict["location"] = {
            "lon": float(point_coords[0]),
            "lat": float(point_coords[1])
        }
        
    if "non_veg" in place_dict:
        place_dict["nonVeg"] = place_dict.pop("non_veg")
        
    place_dict["is_saved"] = user in place.saved_by_users if user else False
    return place_dict

# --- SAVED PLACES ---
@app.post("/api/places/{place_id}/save")
def save_place(place_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    place = db.query(models.Place).filter(models.Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
        
    if current_user not in place.saved_by_users:
        place.saved_by_users.append(current_user)
        db.commit()
    return {"message": "Place saved successfully", "is_saved": True}

@app.delete("/api/places/{place_id}/save")
def unsave_place(place_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    place = db.query(models.Place).filter(models.Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
        
    if current_user in place.saved_by_users:
        place.saved_by_users.remove(current_user)
        db.commit()
    return {"message": "Place removed from saved", "is_saved": False}

@app.get("/api/user/saved-places")
def get_saved_places(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Load relationships specifically
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    places_list = [serialize_place(p, db, user) for p in user.saved_places]
    return {"places": places_list}

# --- REVIEWS ---
@app.post("/api/places/{place_id}/reviews", response_model=ReviewResponse)
def create_review(
    place_id: int, 
    review: ReviewCreate, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    place = db.query(models.Place).filter(models.Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
        
    # Optional: Prevent multiple reviews per user per place
    existing_review = db.query(models.Review).filter(
        models.Review.user_id == current_user.id,
        models.Review.place_id == place_id
    ).first()
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this place.")
        
    db_review = models.Review(
        user_id=current_user.id,
        place_id=place_id,
        rating=review.rating,
        comment=review.comment
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    
    # Return structured response matching ReviewResponse
    db.refresh(current_user)
    return {
        "id": db_review.id,
        "user_id": db_review.user_id,
        "username": current_user.username,
        "place_id": db_review.place_id,
        "rating": db_review.rating,
        "comment": db_review.comment,
        "created_at": str(db_review.created_at)
    }

@app.get("/api/places/{place_id}/reviews", response_model=List[ReviewResponse])
def get_place_reviews(place_id: int, db: Session = Depends(get_db)):
    place = db.query(models.Place).filter(models.Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
        
    reviews = db.query(models.Review).filter(models.Review.place_id == place_id).order_by(models.Review.created_at.desc()).all()
    
    result = []
    for r in reviews:
        # User is loaded since we have `user = relationship(...)` mapping in models
        result.append({
            "id": r.id,
            "user_id": r.user_id,
            "username": r.user.username,
            "place_id": r.place_id,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": str(r.created_at)
        })
    return result

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
    # Radius set to 1.5 km as requested
    search_radius_meters = 1500

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
    
    
    # Attempt to grab current_user from token (Optional auth logic for lists)
    # The frontend shouldn't send it unless requested so we will just return place data.
    places_list = []
    for place, distance in results:
        place_dict = serialize_place(place, db)
        place_dict["distance"] = distance / 1000  
        


        places_list.append(place_dict)

    return {"places": places_list}

@app.post("/api/places/create-by-address")
async def create_place_by_address(
    place_request: PlaceCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Creates a new place by geocoding the address.
    """
    coordinates = get_location_from_address(place_request.address)
    
    if not coordinates:
        raise HTTPException(status_code=404, detail="Address not found")
        
    lat, lon = coordinates
    
    # Neon/PostGIS uses (Longitude, Latitude) order for POINT
    location_point = from_shape(Point(lon, lat), srid=4326)
    
    new_place = models.Place(
        name=place_request.name,
        description=place_request.description,
        address=place_request.address, # Save address
        type=place_request.category,
        location=location_point,
        # Default values for fields not provided
        price=0,
        veg=False,
        non_veg=False,
        rating=0.0,
        image_url=""
    )
    
    db.add(new_place)
    db.commit()
    db.refresh(new_place)
    
    return {
        "message": "Place created successfully", 
        "id": new_place.id,
        "location": {"lat": lat, "lon": lon}
    }

@app.get("/api/places/search")
def search_places(
    query: str, 
    db: Session = Depends(get_db)
):
    """
    Search for places by name with fuzzy matching.
    Prioritizes exact matches, then fuzzy matches.
    """
    if not query:
        return {"places": []}
        
    # Get all places from DB (optimisation: normally you'd filter in SQL, 
    # but for fuzzy match we need python logic or pg_trgm extension. 
    # Using python difflib for simplicity as requested/planned)
    all_places = db.query(models.Place).all()
    
    # 1. Exact/Contains Match (Case Insensitive) - Name OR Address
    exact_matches = [
        p for p in all_places 
        if query.lower() in p.name.lower() or (p.address and query.lower() in p.address.lower())
    ]
    
    # 2. Fuzzy Match
    # Get list of places not in exact_matches
    other_places = [p for p in all_places if p not in exact_matches]
    
    # We will fuzzy match against Name AND Address
    # Create a map for easy lookup: string -> place
    name_map = {p.name: p for p in other_places}
    address_map = {p.address: p for p in other_places if p.address}
    
    all_searchable_strings = list(name_map.keys()) + list(address_map.keys())
    
    # Find close matches (cutoff=0.6 means 60% similarity)
    close_matches_strings = difflib.get_close_matches(query, all_searchable_strings, n=5, cutoff=0.6)
    
    fuzzy_matches = []
    for s in close_matches_strings:
        if s in name_map:
            fuzzy_matches.append(name_map[s])
        elif s in address_map:
            fuzzy_matches.append(address_map[s])
            
    # Dedup fuzzy matches just in case
    fuzzy_matches = list(set(fuzzy_matches))
    
    # Combine results
    final_results = exact_matches + fuzzy_matches
    
    # Format results
    places_list = []
    for place in final_results:
        place_dict = serialize_place(place, db)
        

            
        places_list.append(place_dict)
        
    return {"places": places_list}

@app.get("/api/places/suggestions")
def get_search_suggestions(
    query: str,
    db: Session = Depends(get_db)
):
    """
    Returns list of place names for autocomplete suggestions.
    """
    if not query:
        return {"suggestions": []}
        
    # Optimisation: Fetch names and addresses
    results = db.query(models.Place.name, models.Place.address).all()
    
    all_strings = []
    for name, address in results:
        if name:
            all_strings.append(name)
        if address:
            all_strings.append(address)
    
    # Remove duplicates
    all_strings = list(set(all_strings))
    
    # Find matches
    matches = difflib.get_close_matches(query, all_strings, n=5, cutoff=0.5)
    
    # Also include starts_with matches
    starts_with = [s for s in all_strings if s.lower().startswith(query.lower())]
    
    # Combine and dedup
    combined = list(set(matches + starts_with))
    combined.sort() # Sort alphabetically
    
    return {"suggestions": combined[:5]}

@app.get("/api/places/all")
def get_all_places(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Fetch all places (with limit) for default view.
    """
    places = db.query(models.Place).limit(limit).all()
    
    places_list = []
    for place in places:
        place_dict = serialize_place(place, db)
        

            
        places_list.append(place_dict)
        
    return {"places": places_list}


if __name__ == "__main__":
    # Use 0.0.0.0 to accept connections from all interfaces (including localhost)
    uvicorn.run(app, host="0.0.0.0", port=8000)