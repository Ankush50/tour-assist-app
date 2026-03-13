from sqlalchemy import Column, Integer, String, Boolean, Numeric, Text
from geoalchemy2 import Geography
from database import Base

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

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    
    # We can use func.now() manually or import it
    from sqlalchemy.sql import func
    created_at = Column(String, default=func.now())  # Or DateTime if preferred, let's stick to string if we don't import DateTime globally
