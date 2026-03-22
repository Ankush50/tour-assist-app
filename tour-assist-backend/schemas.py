from pydantic import BaseModel
from datetime import datetime

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

class ReviewCreate(BaseModel):
    rating: int
    comment: str | None = None

class ReviewResponse(BaseModel):
    id: int
    user_id: int
    username: str
    place_id: int
    rating: int
    comment: str | None
    created_at: str

    class Config:
        from_attributes = True

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

    class Config:
        from_attributes = True

class Message(BaseModel):
    role: str
    content: str

class AIContextRequest(BaseModel):
    history: list[Message]
    filters: dict
    budget: list[int]
    session_id: str

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
