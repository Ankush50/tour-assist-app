from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PlaceCreateRequest(BaseModel):
    name: str
    description: str
    address: str
    category: str

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserLogin(UserBase):
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

# Feature 2 extension: accept GPS coords alongside review text
class ReviewCreate(BaseModel):
    rating: int
    comment: str | None = None
    user_lat: float | None = None   # for geo-verification
    user_lon: float | None = None   # for geo-verification

# Feature 1, 2, 3, 4: Extended review response
class ReviewResponse(BaseModel):
    id: int
    user_id: int
    username: str
    place_id: int
    rating: int
    comment: str | None
    created_at: str
    # Feature 2
    is_geo_verified: bool = False
    # Feature 1
    authenticity_score: int | None = None
    authenticity_label: str | None = None
    # Feature 3
    helpful_votes: int = 0
    unhelpful_votes: int = 0
    # Feature 4: Reviewer tier (computed, not stored in DB)
    reviewer_tier: str = "Explorer"

    class Config:
        from_attributes = True

# Feature 3: Vote request schema
class VoteRequest(BaseModel):
    vote: str   # "helpful" or "unhelpful"

class VoteResponse(BaseModel):
    helpful_votes: int
    unhelpful_votes: int
    user_vote: str | None = None

# Feature 4: User profile response
class UserProfileResponse(BaseModel):
    username: str
    tier: str
    review_count: int
    geo_verified_count: int
    helpful_votes_received: int
    member_since: str | None

class PlaceResponse(BaseModel):
    id: int
    name: str
    address: str | None
    type: str | None
    price: int | None
    veg: bool | None
    nonVeg: bool | None
    rating: float | None
    image_url: str | None
    description: str | None
    distance: float | None = None
    location: dict | None = None
    is_saved: bool = False
    # Feature 8: visit counter
    view_count: int = 0
    # Feature 6: crowd pulse
    crowd_pulse: str | None = None   # "active" | "recent" | "quiet"
    # Eco Score & Emergency
    eco_score: int | None = None
    hospital_contact: str | None = None
    police_contact: str | None = None

    class Config:
        from_attributes = True

class Message(BaseModel):
    role: str
    content: str

# Feature 5: Mood-based Discovery
class AIContextRequest(BaseModel):
    history: list[Message]
    filters: dict
    budget: list[int]
    session_id: str
    user_location: dict | None = None
    mood: str | None = None   # e.g. "Relaxing", "Adventure", "Family", "Romantic", "Lively", "Solo"

class AIChatMessageResponse(BaseModel):
    id: int
    session_id: str | None
    role: str
    content: str
    places_json: str | None
    created_at: datetime

    class Config:
        from_attributes = True

class AIChatSessionResponse(BaseModel):
    session_id: str
    chat_name: str
    created_at: datetime

class ChatRenameRequest(BaseModel):
    chat_name: str

# Feature 7: Shared Trip schemas
class TripCreate(BaseModel):
    name: str

class TripItemCreate(BaseModel):
    place_id: int
    day_number: int = 1

class TripItemResponse(BaseModel):
    id: int
    day_number: int
    place: dict | None

class TripResponse(BaseModel):
    id: int
    name: str
    created_at: str
    share_token: str | None
    item_count: int = 0
    is_looking_for_buddy: bool = False

class SharedTripResponse(BaseModel):
    trip_name: str
    created_by: str
    share_token: str
    items: list[TripItemResponse]
