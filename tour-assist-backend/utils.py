from geopy.geocoders import Nominatim
from typing import Tuple, Optional

def get_location_from_address(address: str) -> Optional[Tuple[float, float]]:
    """
    Geocodes an address string to (latitude, longitude).
    Uses 'Tour-Assist-App' as user_agent to comply with OSM policies.
    """
    try:
        # Initialize Nominatim API with a custom user_agent
        geolocator = Nominatim(user_agent="Tour-Assist-App")
        location = geolocator.geocode(address)
        
        if location:
            return location.latitude, location.longitude
        return None
    except Exception as e:
        print(f"Geocoding error: {e}")
        return None
