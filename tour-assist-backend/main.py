import uvicorn
import secrets
import re
import json
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, text
from geoalchemy2 import Geography
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from datetime import timedelta, datetime
from typing import List, Optional, Dict, Any
import os
import google.generativeai as genai
from ml_forecasting import get_crowd_forecast

import models
import database
from database import engine, get_db
from schemas import (
    PlaceCreateRequest, UserCreate, UserLogin, Token,
    ReviewCreate, ReviewResponse, PlaceResponse,
    VoteRequest, VoteResponse, UserProfileResponse,
    TripCreate, TripItemCreate, TripResponse, SharedTripResponse, TripItemResponse
)
from utils import get_location_from_address
import auth
import difflib

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Create tables
models.Base.metadata.create_all(bind=engine)

# --- DB migrations for new columns (safe, idempotent) ---
MIGRATION_STATEMENTS = [
    "ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS session_id VARCHAR;",
    "ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS chat_name VARCHAR;",
    # Feature 1: AI Authenticity Score
    "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS authenticity_score INTEGER;",
    "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS authenticity_label VARCHAR;",
    # Feature 2: Geo-Verified Reviews
    "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_geo_verified BOOLEAN DEFAULT FALSE;",
    # Feature 3: Community Voting
    "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_votes INTEGER DEFAULT 0;",
    "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS unhelpful_votes INTEGER DEFAULT 0;",
    # Feature 7: Shared Trip
    "ALTER TABLE trips ADD COLUMN IF NOT EXISTS share_token VARCHAR UNIQUE;",
    # Feature 5: Travel Buddy
    "ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_looking_for_buddy BOOLEAN DEFAULT FALSE;",
    # Feature 8: Visit Counter
    "ALTER TABLE places ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;",
    # Eco Score & Emergency
    "ALTER TABLE places ADD COLUMN IF NOT EXISTS eco_score INTEGER DEFAULT 4;",
    "ALTER TABLE places ADD COLUMN IF NOT EXISTS hospital_contact VARCHAR;",
    "ALTER TABLE places ADD COLUMN IF NOT EXISTS police_contact VARCHAR;",
    "ALTER TABLE places ADD COLUMN IF NOT EXISTS crowd_pulse VARCHAR;",
    # Trip item ordering
    "ALTER TABLE trip_items ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;",
    # Feature: Collaboration logging
    """CREATE TABLE IF NOT EXISTS trip_collaboration_logs (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
        collaborator_username VARCHAR,
        action VARCHAR,
        place_name VARCHAR,
        detail VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
    );""",
]

with engine.connect() as conn:
    for stmt in MIGRATION_STATEMENTS:
        try:
            conn.execute(text(stmt))
        except Exception:
            pass
    conn.commit()

app = FastAPI(title="Tour Assist API", version="2.0")

from settings import settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False
)

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def compute_reviewer_tier(user_id: int, db: Session) -> str:
    """Feature 4: Compute reviewer trust tier based on activity."""
    reviews = db.query(models.Review).filter(models.Review.user_id == user_id).all()
    review_count = len(reviews)
    geo_verified_count = sum(1 for r in reviews if r.is_geo_verified)
    total_helpful = sum(r.helpful_votes or 0 for r in reviews)
    avg_helpful = total_helpful / review_count if review_count > 0 else 0

    if review_count >= 10 and avg_helpful >= 3:
        return "Expert"
    elif review_count >= 10 or geo_verified_count > 0:
        return "Trusted Local"
    elif review_count >= 3:
        return "Regular"
    else:
        return "Explorer"


def get_crowd_pulse(place_id: int, db: Session) -> str:
    """Feature 6: Compute crowd pulse from recent review activity."""
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    recent = db.query(models.Review).filter(
        models.Review.place_id == place_id,
        models.Review.created_at >= seven_days_ago
    ).first()
    if recent:
        return "active"

    month_review = db.query(models.Review).filter(
        models.Review.place_id == place_id,
        models.Review.created_at >= thirty_days_ago
    ).first()
    if month_review:
        return "recent"
    return "quiet"


def serialize_place(place, db: Session, user=None, include_crowd_pulse: bool = False):
    """Serialize a Place model to a dictionary."""
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
    place_dict["view_count"] = place_dict.get("view_count") or 0
    
    # Feature defaults if null
    place_dict["eco_score"] = place_dict.get("eco_score") or (((place.id * 7) % 5) + 1)
    place_dict["hospital_contact"] = place_dict.get("hospital_contact") or f"City Hospital (2.{place.id % 8} km)"
    place_dict["police_contact"] = place_dict.get("police_contact") or f"Sector {(place.id % 15) + 1} Police Station (1.{place.id % 5} km)"

    if include_crowd_pulse:
        place_dict["crowd_pulse"] = get_crowd_pulse(place.id, db)

    return place_dict


async def score_review_authenticity(rating: int, comment: str) -> tuple[int, str]:
    """Feature 1: Use Gemini AI to score review authenticity (0-100)."""
    if not comment or len(comment.strip()) < 5:
        return 20, "Suspicious"
    try:
        model = genai.GenerativeModel(model_name="gemini-2.0-flash")
        prompt = f"""You are an expert at detecting fake or low-quality reviews for a travel & tourism platform.

Analyze this review and score its authenticity from 0 to 100:
- 80-100: Specific, detailed, genuine experience (mentions specific dishes/rooms/features, personal context)
- 50-79: Reasonably genuine but somewhat vague
- 0-49: Generic, suspicious, low-effort, or copy-paste style

Review Rating: {rating}/5
Review Comment: "{comment}"

Key rules:
- Very short generic comments ("great place!", "loved it") → score 0-30
- Specific details about food, ambiance, service, room quality → score 70+
- Balanced reviews with both positives and negatives → score 80+
- Suspiciously perfect praise or pure hate-bombing → score 0-25

Respond ONLY in this exact JSON format (no explanation):
{{"score": <number 0-100>, "label": "<Verified|Likely Genuine|Suspicious>"}}"""

        response = model.generate_content(prompt)
        text_resp = response.text.strip()
        json_match = re.search(r'\{.*\}', text_resp, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            score = max(0, min(100, int(data.get("score", 50))))
            label = data.get("label", "Likely Genuine")
            if label not in ["Verified", "Likely Genuine", "Suspicious"]:
                label = "Likely Genuine"
            return score, label
    except Exception as e:
        print(f"[AI Score Error] {e}")
    return 50, "Likely Genuine"


# ============================================================
# AUTH ROUTES
# ============================================================
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


@app.get("/")
def read_root():
    return {"message": "Tour-Assist API v2.0 — Now with AI Trust Engine 🛡️"}


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
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}


# ============================================================
# SAVED PLACES
# ============================================================
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
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    places_list = [serialize_place(p, db, user) for p in user.saved_places]
    return {"places": places_list}


# ============================================================
# FEATURE 4: USER PROFILE & REVIEWER TIER
# ============================================================
@app.get("/api/user/profile", response_model=UserProfileResponse)
async def get_user_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns reviewer tier, stats, and profile info."""
    reviews = db.query(models.Review).filter(models.Review.user_id == current_user.id).all()
    review_count = len(reviews)
    geo_verified_count = sum(1 for r in reviews if r.is_geo_verified)
    total_helpful = sum(r.helpful_votes or 0 for r in reviews)
    tier = compute_reviewer_tier(current_user.id, db)

    return {
        "username": current_user.username,
        "tier": tier,
        "review_count": review_count,
        "geo_verified_count": geo_verified_count,
        "helpful_votes_received": total_helpful,
        "member_since": str(current_user.created_at) if current_user.created_at else None
    }


# ============================================================
# REVIEWS — Features 1, 2, 3, 4
# ============================================================
@app.post("/api/places/{place_id}/reviews", response_model=ReviewResponse)
async def create_review(
    place_id: int,
    review: ReviewCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    place = db.query(models.Place).filter(models.Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    existing_review = db.query(models.Review).filter(
        models.Review.user_id == current_user.id,
        models.Review.place_id == place_id
    ).first()
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this place.")

    # --- Feature 2: Geo-Verification ---
    is_geo_verified = False
    if review.user_lat is not None and review.user_lon is not None and place.location is not None:
        try:
            user_point = cast(from_shape(Point(review.user_lon, review.user_lat), srid=4326), Geography)
            distance_m = db.scalar(func.ST_Distance(place.location, user_point))
            if distance_m is not None and distance_m <= 500:
                is_geo_verified = True
        except Exception as e:
            print(f"[Geo-verify Error] {e}")

    # --- Feature 1: AI Authenticity Scoring (async Gemini call) ---
    authenticity_score, authenticity_label = await score_review_authenticity(
        review.rating, review.comment or ""
    )

    db_review = models.Review(
        user_id=current_user.id,
        place_id=place_id,
        rating=review.rating,
        comment=review.comment,
        is_geo_verified=is_geo_verified,
        authenticity_score=authenticity_score,
        authenticity_label=authenticity_label,
        helpful_votes=0,
        unhelpful_votes=0
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    db.refresh(current_user)

    # Feature 4: compute tier
    tier = compute_reviewer_tier(current_user.id, db)

    return {
        "id": db_review.id,
        "user_id": db_review.user_id,
        "username": current_user.username,
        "place_id": db_review.place_id,
        "rating": db_review.rating,
        "comment": db_review.comment,
        "created_at": str(db_review.created_at) if db_review.created_at else str(datetime.utcnow()),
        "is_geo_verified": db_review.is_geo_verified,
        "authenticity_score": db_review.authenticity_score,
        "authenticity_label": db_review.authenticity_label,
        "helpful_votes": db_review.helpful_votes or 0,
        "unhelpful_votes": db_review.unhelpful_votes or 0,
        "reviewer_tier": tier
    }


@app.get("/api/places/{place_id}/reviews", response_model=List[ReviewResponse])
def get_place_reviews(place_id: int, db: Session = Depends(get_db)):
    place = db.query(models.Place).filter(models.Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    reviews = db.query(models.Review).filter(
        models.Review.place_id == place_id
    ).order_by(models.Review.created_at.desc()).all()

    result = []
    for r in reviews:
        tier = compute_reviewer_tier(r.user_id, db)
        result.append({
            "id": r.id,
            "user_id": r.user_id,
            "username": r.user.username,
            "place_id": r.place_id,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": str(r.created_at),
            "is_geo_verified": r.is_geo_verified or False,
            "authenticity_score": r.authenticity_score,
            "authenticity_label": r.authenticity_label,
            "helpful_votes": r.helpful_votes or 0,
            "unhelpful_votes": r.unhelpful_votes or 0,
            "reviewer_tier": tier
        })
    return result


# ============================================================
# FEATURE 3: COMMUNITY VOTING ON REVIEWS
# ============================================================
@app.post("/api/reviews/{review_id}/vote", response_model=VoteResponse)
async def vote_review(
    review_id: int,
    vote_req: VoteRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if vote_req.vote not in ["helpful", "unhelpful"]:
        raise HTTPException(status_code=400, detail="Vote must be 'helpful' or 'unhelpful'")

    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot vote on your own review.")

    existing_vote = db.query(models.ReviewVote).filter(
        models.ReviewVote.user_id == current_user.id,
        models.ReviewVote.review_id == review_id
    ).first()

    user_vote = vote_req.vote

    if existing_vote:
        if existing_vote.vote == vote_req.vote:
            # Same vote → toggle off (remove)
            if vote_req.vote == "helpful":
                review.helpful_votes = max(0, (review.helpful_votes or 0) - 1)
            else:
                review.unhelpful_votes = max(0, (review.unhelpful_votes or 0) - 1)
            db.delete(existing_vote)
            user_vote = None
        else:
            # Switch vote
            if existing_vote.vote == "helpful":
                review.helpful_votes = max(0, (review.helpful_votes or 0) - 1)
                review.unhelpful_votes = (review.unhelpful_votes or 0) + 1
            else:
                review.unhelpful_votes = max(0, (review.unhelpful_votes or 0) - 1)
                review.helpful_votes = (review.helpful_votes or 0) + 1
            existing_vote.vote = vote_req.vote
    else:
        # New vote
        if vote_req.vote == "helpful":
            review.helpful_votes = (review.helpful_votes or 0) + 1
        else:
            review.unhelpful_votes = (review.unhelpful_votes or 0) + 1
        new_vote = models.ReviewVote(
            user_id=current_user.id,
            review_id=review_id,
            vote=vote_req.vote
        )
        db.add(new_vote)

    db.commit()
    db.refresh(review)
    return {
        "helpful_votes": review.helpful_votes or 0,
        "unhelpful_votes": review.unhelpful_votes or 0,
        "user_vote": user_vote
    }


# ============================================================
# PLACES
# ============================================================
@app.get("/api/places")
async def get_places(
    lat: float,
    lon: float,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
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
    coordinates = get_location_from_address(place_request.address)
    if not coordinates:
        raise HTTPException(status_code=404, detail="Address not found")
    lat, lon = coordinates
    location_point = from_shape(Point(lon, lat), srid=4326)
    new_place = models.Place(
        name=place_request.name,
        description=place_request.description,
        address=place_request.address,
        type=place_request.category,
        location=location_point,
        price=0, veg=False, non_veg=False, rating=0.0, image_url="", view_count=0
    )
    db.add(new_place)
    db.commit()
    db.refresh(new_place)
    return {"message": "Place created successfully", "id": new_place.id, "location": {"lat": lat, "lon": lon}}


@app.get("/api/places/search")
def search_places(query: str, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    if not query:
        return {"places": []}
    search_term = f"%{query}%"
    places = db.query(models.Place).filter(
        (models.Place.name.ilike(search_term)) |
        (models.Place.address.ilike(search_term)) |
        (models.Place.type.ilike(search_term)) |
        (models.Place.description.ilike(search_term))
    ).offset(skip).limit(limit).all()
    return {"places": [serialize_place(p, db) for p in places]}


@app.get("/api/places/suggestions")
def get_search_suggestions(query: str, db: Session = Depends(get_db)):
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
def get_all_places(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    places = db.query(models.Place).offset(skip).limit(limit).all()
    return {"places": [serialize_place(p, db) for p in places]}


@app.get("/api/places/{place_id}")
def get_place_detail(place_id: int, db: Session = Depends(get_db)):
    """Feature 8: Increments view_count on every visit."""
    place = db.query(models.Place).filter(models.Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    # Increment visit counter
    place.view_count = (place.view_count or 0) + 1
    db.commit()
    db.refresh(place)

    result = serialize_place(place, db, include_crowd_pulse=True)
    return result


@app.get("/api/places/{place_id}/summary")
def summarize_reviews(place_id: int, db: Session = Depends(get_db)):
    place = db.query(models.Place).filter(models.Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    
    reviews = db.query(models.Review).filter(models.Review.place_id == place_id).all()
    if not reviews:
        return {"summary": "No reviews available to summarize."}
        
    reviews_text = "\n".join([f"- {r.rating} stars: {r.comment}" for r in reviews if r.comment])
    if not reviews_text.strip():
        return {"summary": "No text reviews available to summarize."}
        
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f"Summarize the following reviews for {place.name} into exactly 3 short, punchy bullet points. Focus on the consensus, ignore fake-sounding info:\n\n{reviews_text}"
        response = model.generate_content(prompt)
        return {"summary": response.text.strip()}
    except Exception as e:
        print(f"Gemini Summarization error: {e}")
        return {"summary": "AI summarization is currently unavailable."}


# ============================================================
# FEATURE 7: SHARED TRIP PLANNER
# ============================================================
@app.get("/api/trips")
async def get_user_trips(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trips = db.query(models.Trip).filter(models.Trip.user_id == current_user.id).order_by(models.Trip.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "created_at": str(t.created_at),
            "share_token": t.share_token,
            "is_looking_for_buddy": getattr(t, 'is_looking_for_buddy', False),
            "item_count": db.query(models.TripDayItem).filter(models.TripDayItem.trip_id == t.id).count()
        }
        for t in trips
    ]


@app.post("/api/trips")
async def create_trip(
    trip_data: TripCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = models.Trip(user_id=current_user.id, name=trip_data.name)
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return {"id": trip.id, "name": trip.name, "created_at": str(trip.created_at), "share_token": None, "item_count": 0}


@app.get("/api/trips/{trip_id}")
async def get_trip_detail(
    trip_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id, models.Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    items = []
    for item in sorted(trip.items, key=lambda x: (x.day_number, x.order_index)):
        items.append({
            "id": item.id,
            "day_number": item.day_number,
            "place": serialize_place(item.place, db) if item.place else None
        })
    return {
        "id": trip.id,
        "name": trip.name,
        "created_at": str(trip.created_at),
        "share_token": trip.share_token,
        "is_looking_for_buddy": getattr(trip, 'is_looking_for_buddy', False),
        "items": items
    }

@app.post("/api/trips/{trip_id}/buddy")
async def toggle_trip_buddy(
    trip_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id, models.Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip.is_looking_for_buddy = not getattr(trip, 'is_looking_for_buddy', False)
    db.commit()
    return {"message": "Buddy status updated", "is_looking_for_buddy": trip.is_looking_for_buddy}

@app.get("/api/buddies/matches")
def get_buddy_matches(
    trip_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """MOCK feature finding overlapping trips for Buddy System"""
    users = ["alex_wanderer", "global_nomad99", "culture_seeker", "photo_travels", "foodie_exp"]
    return {
        "matches": [
            {"username": u, "match_percentage": 98 - (i * 12), "shared_interests": ["Monuments", "Street Food"]}
            for i, u in enumerate(users)
        ]
    }


@app.delete("/api/trips/{trip_id}")
async def delete_trip(
    trip_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id, models.Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.delete(trip)
    db.commit()
    return {"message": "Trip deleted"}


@app.post("/api/trips/{trip_id}/items")
async def add_trip_item(
    trip_id: int,
    item_data: TripItemCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id, models.Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Check if place already in trip
    existing = db.query(models.TripDayItem).filter(
        models.TripDayItem.trip_id == trip_id,
        models.TripDayItem.place_id == item_data.place_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Place already in this trip.")

    item = models.TripDayItem(
        trip_id=trip_id,
        place_id=item_data.place_id,
        day_number=item_data.day_number
    )
    db.add(item)
    db.commit()
    return {"message": "Place added to trip", "item_id": item.id}


@app.delete("/api/trips/{trip_id}/items/{item_id}")
async def remove_trip_item(
    trip_id: int,
    item_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(models.TripDayItem).filter(
        models.TripDayItem.id == item_id,
        models.TripDayItem.trip_id == trip_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item removed"}


@app.post("/api/trips/{trip_id}/share")
async def share_trip(
    trip_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a public share token for the trip."""
    trip = db.query(models.Trip).filter(
        models.Trip.id == trip_id,
        models.Trip.user_id == current_user.id
    ).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if not trip.share_token:
        trip.share_token = secrets.token_urlsafe(16)
        db.commit()
        db.refresh(trip)
    return {"share_token": trip.share_token}


@app.get("/api/trips/shared/{share_token}")
def get_shared_trip(share_token: str, db: Session = Depends(get_db)):
    """Public endpoint — view a shared trip without auth."""
    trip = db.query(models.Trip).filter(models.Trip.share_token == share_token).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Shared trip not found or link expired.")
    items = []
    for item in sorted(trip.items, key=lambda x: (x.day_number, x.order_index)):
        items.append({
            "id": item.id,
            "day_number": item.day_number,
            "place": serialize_place(item.place, db) if item.place else None
        })
    return {
        "trip_name": trip.name,
        "created_by": trip.user.username,
        "share_token": share_token,
        "items": items
    }


# Owner: change day number of a trip item
@app.patch("/api/trips/{trip_id}/items/{item_id}")
async def update_trip_item_day(
    trip_id: int,
    item_id: int,
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id, models.Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    item = db.query(models.TripDayItem).filter(
        models.TripDayItem.id == item_id, models.TripDayItem.trip_id == trip_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.day_number = int(payload.get("day_number", item.day_number))
    db.commit()
    return {"day_number": item.day_number}


# Shared trip collaborative editing — requires login
@app.post("/api/trips/shared/{share_token}/items")
def add_to_shared_trip(
    share_token: str,
    item_data: TripItemCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.share_token == share_token).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Shared trip not found")
    if trip.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You are the owner. Use /api/trips endpoints.")
    existing = db.query(models.TripDayItem).filter(
        models.TripDayItem.trip_id == trip.id,
        models.TripDayItem.place_id == item_data.place_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Place already in this trip.")
    item = models.TripDayItem(trip_id=trip.id, place_id=item_data.place_id, day_number=item_data.day_number)
    db.add(item)
    # Log the action
    place = db.query(models.Place).filter(models.Place.id == item_data.place_id).first()
    log = models.TripCollaborationLog(
        trip_id=trip.id,
        collaborator_username=current_user.username,
        action="added",
        place_name=place.name if place else f"Place #{item_data.place_id}",
        detail=f"to Day {item_data.day_number}"
    )
    db.add(log)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "day_number": item.day_number, "place": serialize_place(place, db) if place else None}


@app.delete("/api/trips/shared/{share_token}/items/{item_id}")
def remove_from_shared_trip(
    share_token: str,
    item_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.share_token == share_token).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Shared trip not found")
    item = db.query(models.TripDayItem).filter(
        models.TripDayItem.id == item_id, models.TripDayItem.trip_id == trip.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    place_name = item.place.name if item.place else f"Item #{item_id}"
    db.delete(item)
    log = models.TripCollaborationLog(
        trip_id=trip.id,
        collaborator_username=current_user.username,
        action="removed",
        place_name=place_name,
        detail=None
    )
    db.add(log)
    db.commit()
    return {"message": "Removed"}


@app.patch("/api/trips/shared/{share_token}/items/{item_id}")
def update_shared_trip_item_day(
    share_token: str,
    item_id: int,
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.share_token == share_token).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Shared trip not found")
    item = db.query(models.TripDayItem).filter(
        models.TripDayItem.id == item_id, models.TripDayItem.trip_id == trip.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    old_day = item.day_number
    new_day = int(payload.get("day_number", old_day))
    place_name = item.place.name if item.place else f"Item #{item_id}"
    item.day_number = new_day
    log = models.TripCollaborationLog(
        trip_id=trip.id,
        collaborator_username=current_user.username,
        action="moved_to_day",
        place_name=place_name,
        detail=f"from Day {old_day} to Day {new_day}"
    )
    db.add(log)
    db.commit()
    return {"day_number": new_day}


# Owner: view collaboration activity log
@app.get("/api/trips/{trip_id}/activity")
def get_trip_activity(
    trip_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id, models.Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    logs = db.query(models.TripCollaborationLog).filter(
        models.TripCollaborationLog.trip_id == trip_id
    ).order_by(models.TripCollaborationLog.created_at.desc()).limit(50).all()
    return [{
        "id": l.id,
        "collaborator": l.collaborator_username,
        "action": l.action,
        "place_name": l.place_name,
        "detail": l.detail,
        "created_at": str(l.created_at)
    } for l in logs]


# ============================================================
# AI ASSISTANT — Feature 5: Mood-Based Discovery
# ============================================================
from schemas import AIContextRequest, AIChatMessageResponse, AIChatSessionResponse, ChatRenameRequest

@app.get("/api/ai/history", response_model=list[AIChatSessionResponse])
async def get_ai_history(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
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
    return db.query(models.AIChatMessage).filter(
        models.AIChatMessage.user_id == current_user.id,
        models.AIChatMessage.session_id == session_id
    ).order_by(models.AIChatMessage.created_at.asc()).all()


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
    try:
        current_user = await auth.get_current_user_optional(req, db)

        # Build user context
        saved_places_text = ""
        if current_user:
            saved_names = [p.name for p in current_user.saved_places]
            if saved_names:
                saved_places_text += f"\n- The user has saved: {', '.join(saved_names)}."
            good_reviews = [r.place.name for r in current_user.reviews if r.rating >= 4]
            if good_reviews:
                saved_places_text += f"\n- Highly rated by user: {', '.join(good_reviews)}."
            if saved_places_text:
                saved_places_text = "\n\nUser Preferences:" + saved_places_text

        filters_text = json.dumps(request.filters)
        user_loc_text = ""
        if request.user_location:
            user_loc_text = f"\nUser location: Lat {request.user_location.get('lat')}, Lon {request.user_location.get('lon')}."

        # Feature 5: Mood-Based Discovery
        mood_text = ""
        if request.mood:
            mood_text = f"\n\n🎭 MOOD CONTEXT: The user is in a '{request.mood}' mood. Tailor all suggestions to match this vibe — choose places, descriptions, and language that specifically fit a '{request.mood}' experience. Be evocative about why each place fits their mood."

        system_instructions = f"""You are Odyssey AI, a friendly and enthusiastic travel assistant for the Tour Assist app.
Your tone should be welcoming, engaging, and brief. Use emojis appropriately.

The user currently has these filters active: {filters_text}{user_loc_text}{saved_places_text}{mood_text}

When suggesting places, rely ONLY on places available in the app database.
If you decide to recommend a specific place OR the user asks to filter/show specific types, output a JSON block at the very end:
```json
{{
  "search_query": "momo",
  "new_filters": {{
    "type": "Hotel"
  }}
}}
```
Valid types: "All", "Hotel", "Restaurant", "Attraction", "Activity", "Landmark".
Keep your text response short (2-3 sentences max). Let your personality shine!
"""

        try:
            model = genai.GenerativeModel(
                model_name="gemini-2.0-flash",
                system_instruction=system_instructions
            )
            chat = model.start_chat(history=[])
        except Exception:
            model = genai.GenerativeModel(model_name="gemini-1.5-flash")
            chat = model.start_chat(history=[])

        for msg in request.history[:-1]:
            role = "user" if msg.role == "user" else "model"
            chat.history.append({"role": role, "parts": [msg.content]})

        latest_msg = request.history[-1].content if request.history else "Hello!"
        response = chat.send_message(latest_msg)
        reply_text = response.text

        search_query = None
        new_filters = None
        places = []
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', reply_text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
                search_query = data.get("search_query")
                new_filters = data.get("new_filters")
                reply_text = reply_text[:json_match.start()].strip()
            except Exception:
                pass

        if search_query:
            search_term = f"%{search_query}%"
            results = db.query(models.Place).filter(
                (models.Place.name.ilike(search_term)) |
                (models.Place.description.ilike(search_term)) |
                (models.Place.address.ilike(search_term))
            ).limit(3).all()
            for place in results:
                places.append(serialize_place(place, db))

        if current_user and request.history and request.session_id:
            existing = db.query(models.AIChatMessage).filter(
                models.AIChatMessage.session_id == request.session_id
            ).first()
            chat_name = existing.chat_name if existing else request.history[0].content[:25] + "..."
            last_user_msg = request.history[-1].content if request.history else "Hello!"
            db.add(models.AIChatMessage(
                user_id=current_user.id, session_id=request.session_id,
                chat_name=chat_name, role="user", content=last_user_msg
            ))
            db.add(models.AIChatMessage(
                user_id=current_user.id, session_id=request.session_id,
                chat_name=chat_name, role="assistant", content=reply_text,
                places_json=json.dumps(jsonable_encoder(places)) if places else None
            ))
            db.commit()

        return {
            "reply": reply_text,
            "places": places,
            "session_id": request.session_id,
            "new_filters": new_filters
        }

    except Exception as e:
        print(f"[AI Suggest Error] {e}")
        return {
            "reply": "I'm having a little trouble connecting right now. What kind of place are you looking for?",
            "places": []
        }
@app.get("/api/places/{place_id}/forecast")
def get_place_forecast(place_id: int, db: Session = Depends(get_db)):
    """Academic Feature: Time-Series Crowd Forecasting via scikit-learn."""
    place = db.query(models.Place).filter(models.Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    
    try:
        from ml_forecasting import get_crowd_forecast
        forecast_data = get_crowd_forecast(place_id)
        return {"forecast": forecast_data}
    except Exception as e:
        print(f"ML Forecast Error: {e}")
        raise HTTPException(status_code=500, detail="Internal ML Forecasting API Error")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)