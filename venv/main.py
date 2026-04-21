from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import admin_routes, user_routes
import models, database

app = FastAPI(title="QR Reward Pro System")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create Database Tables
models.Base.metadata.create_all(bind=database.engine)

# Include Routers (ASP.NET MVC ke Controllers ki tarah)
app.include_router(admin_routes.router)
app.include_router(user_routes.router)

@app.get("/")
def root():
    return {"message": "Professional Modular API is Live"}