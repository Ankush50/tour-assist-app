import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
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
from typing import List, Optional, Dict, Any
from datetime import timedelta, datetime
import os
import google.generativeai as genai
import json

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
# -------------------------------------------------

from sqlalchemy import text
# This creates the 'places' table if it doesn't exist
models.Base.metadata.create_all(bind=engine)
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE ai_chat_messages ADD COLUMN session_id VARCHAR;"))
        conn.execute(text("ALTER TABLE ai_chat_messages ADD COLUMN chat_name VARCHAR;"))
        conn.commit()
except Exception:
    pass # columns likely already exist

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
    place_dict = {c.name: getattr(place, c.name) for c in place.__table__.columns if c.name != 'location'}
    
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
        "created_at": str(db_review.created_at) if db_review.created_at else str(datetime.utcnow())
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
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Fetches places near a specific latitude and longitude.
    """
    
    user_location_point = cast(from_shape(Point(lon, lat), srid=4326), Geography)

    query = (
        db.query(
            models.Place,
            func.ST_Distance(models.Place.location, user_location_point).label("distance")
        )
        .order_by("distance")
        .offset(skip)
        .limit(limit)
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
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Search for places using Postgres native ILIKE for scalable substring operations.
    """
    if not query:
        return {"places": []}
        
    search_term = f"%{query}%"
    places = db.query(models.Place).filter(
        (models.Place.name.ilike(search_term)) |
        (models.Place.address.ilike(search_term)) |
        (models.Place.type.ilike(search_term)) |
        (models.Place.description.ilike(search_term))
    ).offset(skip).limit(limit).all()
    
    # Format results
    places_list = []
    for place in places:
        place_dict = serialize_place(place, db)
        places_list.append(place_dict)
        
    return {"places": places_list}
    return {"places": places_list}

@app.get("/api/places/suggestions")
def get_search_suggestions(
    query: str,
    db: Session = Depends(get_db)
):
    """
    Returns list of place names, addresses, and types for autocomplete suggestions natively.
    """
    if not query:
        return {"suggestions": []}
        
    search_term = f"%{query}%"
    results = db.query(models.Place.name, models.Place.address, models.Place.type).filter(
        (models.Place.name.ilike(search_term)) |
        (models.Place.address.ilike(search_term)) |
        (models.Place.type.ilike(search_term))
    ).limit(20).all()
    
    all_strings = []
    for name, address, p_type in results:
        if name and query.lower() in name.lower():
            all_strings.append(name)
        if address and query.lower() in address.lower():
            all_strings.append(address)
        if p_type and query.lower() in p_type.lower():
            all_strings.append(p_type)
    
    all_strings = list(set(all_strings))
    query_lower = query.lower()
    all_strings.sort(key=lambda x: (not x.lower().startswith(query_lower), query_lower not in x.lower(), x))
    
    return {"suggestions": all_strings[:7]}

@app.get("/api/places/all")
def get_all_places(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Fetch all places paginated.
    """
    places = db.query(models.Place).offset(skip).limit(limit).all()
    
    places_list = []
    for place in places:
        place_dict = serialize_place(place, db)
        places_list.append(place_dict)
        
    return {"places": places_list}


# --- AI ASSISTANT ENDPOINT ---
from schemas import AIContextRequest, AIChatMessageResponse, AIChatSessionResponse, ChatRenameRequest

@app.get("/api/ai/history", response_model=list[AIChatSessionResponse])
async def get_ai_history(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Group by session_id to get unique chat threads
    sessions = db.query(
        models.AIChatMessage.session_id,
        func.max(models.AIChatMessage.chat_name).label("chat_name"),
        func.min(models.AIChatMessage.created_at).label("created_at")
    ).filter(
        models.AIChatMessage.user_id == current_user.id,
        models.AIChatMessage.session_id != None
    ).group_by(models.AIChatMessage.session_id).order_by(func.min(models.AIChatMessage.created_at).desc()).all()
    
    return [{"session_id": s.session_id, "chat_name": s.chat_name or "New Chat", "created_at": s.created_at} for s in sessions]

@app.get("/api/ai/history/{session_id}", response_model=list[AIChatMessageResponse])
async def get_ai_session_history(
    session_id: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    messages = db.query(models.AIChatMessage).filter(
        models.AIChatMessage.user_id == current_user.id,
        models.AIChatMessage.session_id == session_id
    ).order_by(models.AIChatMessage.created_at.asc()).all()
    return messages

@app.delete("/api/ai/history/{session_id}", response_model=dict)
async def delete_ai_session(
    session_id: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db.query(models.AIChatMessage).filter(
        models.AIChatMessage.user_id == current_user.id,
        models.AIChatMessage.session_id == session_id
    ).delete()
    db.commit()
    return {"message": "success"}

@app.put("/api/ai/history/{session_id}", response_model=dict)
async def rename_ai_session(
    session_id: str,
    req: ChatRenameRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db.query(models.AIChatMessage).filter(
        models.AIChatMessage.user_id == current_user.id,
        models.AIChatMessage.session_id == session_id
    ).update({"chat_name": req.chat_name})
    db.commit()
    return {"message": "success"}

@app.post("/api/ai/suggest")
async def ai_suggest(
    request: AIContextRequest,
    req: Request,
    db: Session = Depends(get_db)
):
    """
    Proactively suggests places using Gemini AI based on context.
    Optionally saves history if user is authenticated.
    """
    try:
        current_user = await auth.get_current_user_optional(req, db)

        # 1. Gather User Context
        saved_places_text = ""
        if current_user:
            saved_names = [p.name for p in current_user.saved_places]
            if saved_names:
                saved_places_text += f"\n- The user has saved these places: {', '.join(saved_names)}."
            
            good_reviews = [r.place.name for r in current_user.reviews if r.rating >= 4]
            if good_reviews:
                saved_places_text += f"\n- The user gave high ratings to: {', '.join(good_reviews)}."
            
            if saved_places_text:
                saved_places_text = "\n\nUser Preferences based on interactions:" + saved_places_text
        
        filters_text = json.dumps(request.filters)
        user_loc_text = ""
        if request.user_location:
            user_loc_text = f"\nThe user's current location coordinates are Lat: {request.user_location.get('lat')}, Lon: {request.user_location.get('lon')}."
        
        # 2. Construct System Prompt
        system_instructions = f"""
You are Odyssey AI, a friendly and enthusiastic travel assistant for the Tour Assist app.
Your tone should be welcoming, engaging, and brief. Use emojis appropriately.

The user currently has these filters active in the app: {filters_text}{user_loc_text}{saved_places_text}

When suggesting places, strictly rely ONLY on the places provided natively by the app (we will search them). 
Currently, you don't know the exact database IDs perfectly, so just suggest place names and categories natively available like "momos", "hotels", "restaurants".
If you decide to recommend a specific theoretical place, format your recommendation text freely but output a JSON block at the very end of your response like this: 
```json
{{"search_query": "momo"}}
```
So we can fetch relevant places to show in the UI. Keep your text response short (2-3 sentences max).
"""

        # 3. Setup Model - using gemini-flash-latest since older versions are defunct.
        try:
            model = genai.GenerativeModel(
                model_name="gemini-flash-latest",
                system_instruction=system_instructions
            )
            # Try to start chat to verify model exists
            chat = model.start_chat(history=[])
        except Exception:
            # Fallback to gemini-pro-latest
            model = genai.GenerativeModel(
                model_name="gemini-pro-latest"
            )
            chat = model.start_chat(history=[])
            
        # 4. Convert history to Generative AI format
        for msg in request.history[:-1]:
            # map 'user' -> 'user', 'assistant' -> 'model'
            role = "user" if msg.role == "user" else "model"
            chat.history.append({"role": role, "parts": [msg.content]})
            
        # 5. Send message
        latest_msg = request.history[-1].content if request.history else "Hello!"
        response = chat.send_message(latest_msg)
        
        reply_text = response.text
        
        # 6. Extract JSON search_query if present
        search_query = None
        places = []
        import re
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', reply_text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
                search_query = data.get("search_query")
                reply_text = reply_text[:json_match.start()].strip() # Remove JSON from text
            except Exception:
                pass
                
        # 7. Fetch associated places if a query was generated
        if search_query:
            # Fuzzy search using existing logic
            all_places = db.query(models.Place).all()
            exact_matches = [p for p in all_places if search_query.lower() in p.name.lower() or (p.address and search_query.lower() in p.address.lower())]
            other_places = [p for p in all_places if p not in exact_matches]
            name_map = {p.name: p for p in other_places}
            matches = difflib.get_close_matches(search_query, list(name_map.keys()), n=3, cutoff=0.5)
            fuzzy_matches = [name_map[m] for m in matches]
            final_results = exact_matches + fuzzy_matches
            
            # Serialize
            for place in final_results[:3]: # Limit to 3 places max
                places.append(serialize_place(place, db))
                
        # 8. Save to history if logged in
        if current_user and request.history and request.session_id:
            # Check if this is a new session
            existing = db.query(models.AIChatMessage).filter(
                models.AIChatMessage.session_id == request.session_id
            ).first()
            
            chat_name = existing.chat_name if existing else request.history[0].content[:25] + "..."
            
            last_user_msg = request.history[-1].content if request.history else "Hello!"
            db_user_msg = models.AIChatMessage(
                user_id=current_user.id,
                session_id=request.session_id,
                chat_name=chat_name,
                role="user",
                content=last_user_msg,
                places_json=None
            )
            # Save AI's response
            db_ai_msg = models.AIChatMessage(
                user_id=current_user.id,
                session_id=request.session_id,
                chat_name=chat_name,
                role="assistant",
                content=reply_text,
                places_json=json.dumps(jsonable_encoder(places)) if places else None
            )
            db.add(db_user_msg)
            db.add(db_ai_msg)
            db.commit()

        return {
            "reply": reply_text,
            "places": places
        }

        
    except Exception as e:
        print(f"AI Suggestion Error: {e}")
        return {
            "reply": "I'm having a little trouble connecting right now, but I'm still here to help! What kind of place are you looking for?",
            "places": []
        }

if __name__ == "__main__":
    # Use 0.0.0.0 to accept connections from all interfaces (including localhost)
    uvicorn.run(app, host="0.0.0.0", port=8000)