from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
import os
from routes import upload
from database import init_db

app = FastAPI(title="Photobooth App")

# Initialize DB on startup
init_db()

# Create necessary directories if they don't exist
os.makedirs("main_app/static/css", exist_ok=True)
os.makedirs("main_app/static/js", exist_ok=True)
os.makedirs("main_app/static/images", exist_ok=True)

app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

app.include_router(upload.router)

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
