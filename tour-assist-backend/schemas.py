from pydantic import BaseModel

class PlaceCreateRequest(BaseModel):
    name: str
    description: str
    address: str
    category: str
