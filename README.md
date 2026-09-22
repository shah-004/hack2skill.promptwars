# 🛡️ Shield UI - Dark Pattern Detector

Shield UI is an advanced, AI-powered web application designed to detect and expose deceptive e-commerce practices (Dark Patterns). Powered by Google's Gemini multimodal AI, it analyzes text, URLs, and webpage screenshots to identify manipulative layouts, hidden costs, and fake scarcity tactics designed to trick consumers.

## ✨ Features

- **Multimodal AI Analysis**: Upload a massive screenshot, paste a URL, or drop in raw text. The application uses the `gemini-3.6-flash` (or `gemini-1.5-flash`) engine to deeply analyze the content for deceptive intent.
- **Native Python URL Extractor**: A custom-built, blazing-fast native URL crawler instantly extracts and purifies webpage text, completely bypassing slow AI web-crawling bottlenecks.
- **Community Hall of Shame**: A persistent, community-voted SQLite database ranking the internet's worst UI designs from highest to lowest risk. Users can submit, upvote, and delete deceptive entries.
- **Resilient AI Pipeline**: The backend is protected by an exponential backoff loop with linear fallback, guaranteeing that the application survives API proxy rate limits and high-demand 503 traffic spikes.
- **Actionable Defense**: Generates a detailed "Cyber Safety Analysis" report highlighting the specific dark patterns used, and provides direct links to file FTC reports or GDPR data requests to fight back.

## 🛠️ Tech Stack

- **Backend**: Python, FastAPI, Uvicorn
- **AI Integration**: Google GenAI SDK (`google-genai`)
- **Database**: SQLite with SQLAlchemy ORM
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (No heavy frameworks!)
- **Image Processing**: Pillow (Aggressive optimization to reduce API overhead)

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- A Google Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/dark-pattern-detector.git
   cd dark-pattern-detector
   ```

2. **Set up a virtual environment:**
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Mac/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Create a `.env` file in the root directory (you can copy `.env.template`) and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

5. **Run the Application:**
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

6. **Open your browser:**
   Navigate to [http://127.0.0.1:8000](http://127.0.0.1:8000) to start detecting dark patterns!

## 💡 How it Works

1. **Input Phase**: The user submits a suspect e-commerce URL or screenshot.
2. **Preprocessing Phase**: 
   - Images are instantly heavily compressed and converted to RGB using Pillow to save network bandwidth.
   - URLs are automatically detected via Regex and fast-fetched locally by the backend.
3. **Analysis Phase**: The payload is sent to Gemini, which classifies the deception and scores the risk from 0-100.
4. **Community Archival**: The result is permanently archived into the Hall of Shame database so the community can hold the offending website accountable.

## 📜 License

This project is open-source and available under the MIT License.
