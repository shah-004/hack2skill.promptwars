import os
import re
import uuid
import aiofiles
from fastapi import FastAPI, HTTPException, Request, Form, File, UploadFile, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai.types import Part
from sqlalchemy.orm import Session
import urllib.request
from html.parser import HTMLParser

# Fast URL Extractor to bypass slow proxy web-grounding
class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.result = []
        self.in_style_or_script = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self.in_style_or_script = True

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'):
            self.in_style_or_script = False

    def handle_data(self, data):
        if not self.in_style_or_script:
            self.result.append(data)
            
    def get_text(self):
        return ' '.join(''.join(self.result).split())

def fast_fetch_url(url: str) -> str:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        with urllib.request.urlopen(req, timeout=5) as response:
            html = response.read().decode('utf-8', errors='ignore')
            extractor = TextExtractor()
            extractor.feed(html)
            text = extractor.get_text()
            return f"[Extracted Webpage Text for {url}]:\n{text[:6000]}"
    except Exception as e:
        return f"[Original URL: {url} (Failed to auto-extract text: {str(e)})]"

# Import database configuration
from database import init_db, get_db, Report

# Strictly load environment variables from .env file before initialization
load_dotenv()

# Initialize FastAPI application
app = FastAPI(
    title="Shield UI - Dark Pattern Detector",
    description="API for analyzing e-commerce content for dark patterns and hidden fees.",
    version="2.0.0"
)

# Ensure uploads directory exists
UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static directories
app.mount("/static", StaticFiles(directory="static"), name="static")

# Setup Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Initialize Gemini Client using official google-genai SDK
try:
    client = genai.Client()
except Exception as e:
    client = None
    print(f"Warning: Failed to initialize Gemini client on startup. Check GEMINI_API_KEY. Error: {e}")

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """
    Serve the single-page application frontend.
    """
    return templates.TemplateResponse(request=request, name="index.html")

@app.post("/api/analyze")
async def analyze_content(
    content: str = Form(default=""),
    file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Endpoint to analyze text/URLs and optionally screenshots using Gemini 3.6 Flash.
    """
    if not os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") == "your_gemini_api_key_here":
        raise HTTPException(status_code=500, detail="Valid GEMINI_API_KEY is missing from environment variables.")
        
    if not client:
        raise HTTPException(status_code=500, detail="Gemini client is not initialized correctly.")

    if not content.strip() and not file:
        raise HTTPException(status_code=400, detail="Must provide either text content or an image.")
        
    # Automatically detect any URL in the input and fast-fetch it to bypass slow proxy agents
    import re
    url_match = re.search(r'https?://[^\s)\]"\'<]+', content)
    if url_match and not (file and file.filename):
        extracted_url = url_match.group(0)
        content = fast_fetch_url(extracted_url)

    prompt_text = f"""
    You are an expert cyber safety dark pattern and hidden fee detector.
    Analyze the following content or image for deceptive e-commerce practices.
    
    Content to analyze:
    {content}
    
    Please provide:
    1. A Severity Breakdown (Low, Medium, High).
    2. Dark Pattern Classification (e.g., Roach Motel, Forced Continuity, Hidden Costs, Sneak into Basket, Fake Scarcity).
    3. Community Risk Score (0-100, where 100 is extremely risky).
    4. A detailed explanation of why these scores were given, pointing out specific deceptive elements.
    5. **How to Fight Back**: Immediate, actionable steps the user can take to legally opt out, request data deletion (GDPR/CCPA), or report the deceptive practice to authorities (e.g., FTC).
    
    Format your response in Markdown to be beautifully rendered in the UI. Make the "How to Fight Back" section highly visible.
    """

    gemini_contents = [prompt_text]
    image_path_db = None

    # Handle image upload if present
    if file and file.filename:
        from io import BytesIO
        from PIL import Image
        
        img_bytes = await file.read()
        
        try:
            # Optimize image with Pillow
            img = Image.open(BytesIO(img_bytes))
            
            # Convert to RGB (handles PNGs with alpha)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
                
            # Resize aggressively (max 1024x1024)
            img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            
            # Save optimized image to memory with lower quality for speed
            opt_io = BytesIO()
            img.save(opt_io, format="JPEG", quality=60)
            final_bytes = opt_io.getvalue()
            final_mime = "image/jpeg"
            final_ext = ".jpg"
        except Exception as e:
            print(f"Image optimization failed: {e}")
            final_bytes = img_bytes
            final_mime = file.content_type or "image/jpeg"
            final_ext = os.path.splitext(file.filename)[1]

        # Save image locally
        unique_filename = f"{uuid.uuid4()}{final_ext}"
        image_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        async with aiofiles.open(image_path, 'wb') as out_file:
            await out_file.write(final_bytes)
            
        image_path_db = f"/static/uploads/{unique_filename}"
        
        # Append optimized image to Gemini payload
        gemini_contents.append(Part.from_bytes(data=final_bytes, mime_type=final_mime))

    import asyncio
    max_retries = 5
    retry_delay = 3
    current_model = 'gemini-3.6-flash'
    
    for attempt in range(max_retries):
        try:
            # Generate content using the environment-specific multimodal model
            response = client.models.generate_content(
                model=current_model,
                contents=gemini_contents,
            )
            break # Success, break out of retry loop
        except Exception as e:
            err_str = str(e)
            if "503" in err_str or "429" in err_str or "UNAVAILABLE" in err_str:
                if attempt < max_retries - 1:
                    print(f"API Proxy busy with {current_model} (Attempt {attempt+1}). Retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    retry_delay += 2 # Linear backoff to give the proxy more time
                else:
                    raise HTTPException(
                        status_code=503, 
                        detail="The AI analysis engine is currently experiencing extremely high demand. Please try again in a few moments."
                    )
            else:
                raise HTTPException(status_code=500, detail=f"Error communicating with Gemini API: {err_str}")
    
        
    analysis_text = response.text
    
    # Simple extraction of risk score if available (fallback to 0)
    risk_score = 0
    # Look for the score after the colon to avoid capturing '0' from '(0-100)'
    match = re.search(r'Risk Score.*?:[^\d]*(\d{1,3})', analysis_text, re.IGNORECASE)
    if match:
        try:
            risk_score = int(match.group(1))
        except:
            pass
            
    # Save to database
    new_report = Report(
        content_text=content,
        image_path=image_path_db,
        analysis_summary=analysis_text,
        risk_score=risk_score
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    return {"analysis": analysis_text, "id": new_report.id}
@app.get("/api/reports")
def get_community_reports(db: Session = Depends(get_db)):
    """
    Fetch reports ordered by risk score descending, then votes descending.
    """
    reports = db.query(Report).order_by(Report.risk_score.desc(), Report.votes.desc()).all()
    return reports

@app.post("/api/reports/{report_id}/vote")
def vote_report(report_id: int, db: Session = Depends(get_db)):
    """
    Upvote a report in the community index.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.votes += 1
    db.commit()
    return {"id": report.id, "votes": report.votes}

@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int, db: Session = Depends(get_db)):
    """
    Delete a report from the community index.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    # Delete associated image from disk if it exists
    if report.image_path:
        filename = report.image_path.split("/")[-1]
        local_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception as e:
                print(f"Failed to delete image file: {e}")
                
    db.delete(report)
    db.commit()
    return {"status": "success", "message": "Report deleted"}

if __name__ == "__main__":
    import uvicorn
    # Run the application using Uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
