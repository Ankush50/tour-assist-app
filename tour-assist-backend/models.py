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
    address = Column(String) # Added address column
    type = Column(String)
    price = Column(Integer)
    veg = Column(Boolean)
    
    # --- THE FIX ---
    # Changed "non_Veg" to "non_veg" to match the database
    non_veg = Column(Boolean) 
    # ---------------

    rating = Column(Numeric(3, 1))
    image_url = Column(String)
    description = Column(Text)
    
    # This maps to the GEOGRAPHY column
    location = Column(Geography(geometry_type='POINT', srid=4326))
    
    # Relationships
    saved_by_users = relationship("User", secondary=user_saved_places, back_populates="saved_places")
    reviews = relationship("Review", back_populates="place")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    saved_places = relationship("Place", secondary=user_saved_places, back_populates="saved_by_users")
    reviews = relationship("Review", back_populates="user")

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    place_id = Column(Integer, ForeignKey("places.id"))
    rating = Column(Integer)  # Assuming 1 to 5 stars
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    user = relationship("User", back_populates="reviews")
    place = relationship("Place", back_populates="reviews")
