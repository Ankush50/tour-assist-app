from sqlalchemy import Column, Integer, String, Boolean, Numeric, Text, ForeignKey, Table, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geography
from database import Base

# Association table for Many-to-Many relationship (Users <-> Saved Places)
user_saved_places = Table(
    'user_saved_places',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('place_id', Integer, ForeignKey('places.id'), primary_key=True)
)

class Place(Base):
    __tablename__ = "places"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    address = Column(String)
    type = Column(String)
    price = Column(Integer)
    veg = Column(Boolean)
    non_veg = Column(Boolean)
    rating = Column(Numeric(3, 1))
    image_url = Column(String)
    description = Column(Text)
    location = Column(Geography(geometry_type='POINT', srid=4326))

    # Feature 8: Smart Visit Counter
    view_count = Column(Integer, default=0, server_default='0')

    # Relationships
    saved_by_users = relationship("User", secondary=user_saved_places, back_populates="saved_places")
    reviews = relationship("Review", back_populates="place", lazy="dynamic")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    saved_places = relationship("Place", secondary=user_saved_places, back_populates="saved_by_users")
    reviews = relationship("Review", back_populates="user")
    trips = relationship("Trip", back_populates="user", cascade="all, delete-orphan")
    review_votes = relationship("ReviewVote", back_populates="user", cascade="all, delete-orphan")


class Trip(Base):
    __tablename__ = "trips"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    created_at = Column(DateTime, default=func.now())

    # Feature 7: Shared Trip Planner
    share_token = Column(String, unique=True, nullable=True)

    user = relationship("User", back_populates="trips")
    items = relationship("TripDayItem", back_populates="trip", cascade="all, delete-orphan")


class TripDayItem(Base):
    __tablename__ = "trip_items"
    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    place_id = Column(Integer, ForeignKey("places.id"))
    day_number = Column(Integer, default=1)
    order_index = Column(Integer, default=0)

    trip = relationship("Trip", back_populates="items")
    place = relationship("Place")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    place_id = Column(Integer, ForeignKey("places.id"))
    rating = Column(Integer)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())

    # Feature 2: Geo-Verified Review
    is_geo_verified = Column(Boolean, default=False, server_default='false')

    # Feature 1: AI Authenticity Score
    authenticity_score = Column(Integer, nullable=True)       # 0-100
    authenticity_label = Column(String, nullable=True)        # "Verified" | "Likely Genuine" | "Suspicious"

    # Feature 3: Community Helpfulness Voting
    helpful_votes = Column(Integer, default=0, server_default='0')
    unhelpful_votes = Column(Integer, default=0, server_default='0')

    # Relationships
    user = relationship("User", back_populates="reviews")
    place = relationship("Place", back_populates="reviews")
    votes = relationship("ReviewVote", back_populates="review", cascade="all, delete-orphan")


class ReviewVote(Base):
    """Tracks which user voted helpful/unhelpful on a review — prevents duplicate votes."""
    __tablename__ = "review_votes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    review_id = Column(Integer, ForeignKey("reviews.id"))
    vote = Column(String)   # "helpful" or "unhelpful"
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="review_votes")
    review = relationship("Review", back_populates="votes")


class AIChatMessage(Base):
    __tablename__ = "ai_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    session_id = Column(String, index=True)
    chat_name = Column(String, nullable=True)
    role = Column(String)    # 'user' or 'model'/'assistant'
    content = Column(Text)
    places_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User")
