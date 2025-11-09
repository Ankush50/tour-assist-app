from sqlalchemy import Column, Integer, String, Boolean, Numeric, Text
from geoalchemy2 import Geography
from database import Base

class Place(Base):
    __tablename__ = "places"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
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