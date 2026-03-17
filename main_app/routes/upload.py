from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db, Photo
import base64
import os
import uuid

router = APIRouter()

class ImageData(BaseModel):
    image_data: str

@router.post("/api/upload")
async def upload_photo(data: ImageData, db: Session = Depends(get_db)):
    try:
        # Separate the header and the base64 string
        if "," in data.image_data:
            base64_img = data.image_data.split(",")[1]
        else:
            base64_img = data.image_data
            
        image_bytes = base64.b64decode(base64_img)
        
        # Generate random filename
        filename = f"strip_{uuid.uuid4().hex}.png"
        
        # Path where the image will be saved on server
        save_dir = os.path.join(os.path.dirname(__file__), "..", "static", "images")
        os.makedirs(save_dir, exist_ok=True)
        filepath = os.path.join(save_dir, filename)
        
        with open(filepath, "wb") as f:
            f.write(image_bytes)
            
        # Save to database
        db_photo = Photo(filename=filename, filepath=f"/static/images/{filename}")
        db.add(db_photo)
        db.commit()
        db.refresh(db_photo)
        
        return {"status": "success", "message": "Photo saved to database properly!", "photo_id": db_photo.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
