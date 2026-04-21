import os
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# 1. Load .env file (if exists)
base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(base_dir, ".env"))

# 2. Setup Connection Variables
user = "postgres"
password = "R@vi2912"  # Your raw password
host = "localhost"
port = "5432"
db_name = "qr_reward_system"

# 3. Handle Special Characters in Password (The Fix)
# This converts '@' into '%40' so SQLAlchemy understands it correctly
safe_password = urllib.parse.quote_plus(password)

# 4. Construct Final DATABASE_URL
DATABASE_URL = f"postgresql://{user}:{safe_password}@{host}:{port}/{db_name}"

# 5. Create Engine
engine = create_engine(DATABASE_URL)

# 6. Session and Base Setup
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 7. Dependency to get DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()