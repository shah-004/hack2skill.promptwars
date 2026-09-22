from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
import datetime

DATABASE_URL = "sqlite:///./community.db"

# Create the engine, allowing multiple threads for FastAPI concurrency
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    content_text = Column(Text, nullable=True)
    image_path = Column(String, nullable=True)
    analysis_summary = Column(Text, nullable=False)
    risk_score = Column(Integer, nullable=False, default=0)
    dark_pattern_type = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    votes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
