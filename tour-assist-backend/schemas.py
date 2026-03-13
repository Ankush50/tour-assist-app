from pydantic import BaseModel

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
