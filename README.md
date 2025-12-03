# 🎓 EduLink

**A next-generation collaboration platform for colleges, inspired by Reddit, Stack Overflow, LinkedIn, and Discord.**

EduLink empowers students and teachers to connect, collaborate, and share knowledge in a community-driven environment. It combines discussion, networking, real-time communication, and AI-powered features to make academic collaboration practical and scalable.

---

## 🌟 Alignment with Opportunity 
EduLink demonstrates hands-on experience in areas IBM values for developer roles:
- **Backend & APIs:** Designed and implemented server-side logic and REST/WebSocket endpoints using Django.  
- **Cloud & DevOps mindset:** Development with deployment/testing practices and tools; awareness of containerization and cloud-hosting patterns.  
- **AI / LLMs:** Integrated Sentence Transformers and BART for semantic search and summarization — experience with algorithms and LLM pipelines.  
- **Automation & Quality:** Project structured with testable modules and an emphasis on maintainability and CI-style workflows.  
- **Collaboration & Agile:** Built iteratively with user-focused design decisions and version-controlled workflows.  

---

## 🚀 Key Features
- **👩‍🏫 Dual Portals:** Separate Teacher and Student sections with role-based views and permissions.  
- **🏠 Hub Rooms:** Teachers create and manage rooms where students post questions, resources, and host sessions.  
- **💬 Real-Time Communication:** Instant messaging and live updates via WebSocket integration (Django Channels).  
- **📊 Room Analytics:** Engagement metrics (active users, most popular threads, participation over time) for teachers.  
- **🎥 Livestreaming:** Embedded livestream capability for live lectures and Q&A.  
- **👤 Profiles & Community:** Personal profiles, LinkedIn-style feed and connections, and private messaging between users.  
- **🔒 Secure Authentication:** Firebase-backed authentication and role separation.  
- **⚡ Development Tunnels:** ngrok for secure, ephemeral public access during development and testing.  
- **🧠 AI-Powered Question Search:** **Sentence Transformers** produce semantic embeddings so similar questions are detected (reduces duplicates and improves search relevance).  
- **🗂️ Intelligent Summarization:** **BART** is used to auto-summarize long threads and livestream transcripts so users can get concise takeaways.  
- **🧩 Modular Design:** Clear separation between presentation, business logic, data, and AI modules to enable scaling and microservice extraction.

---

## 🧩 Tech Stack (summary)
**Frontend**
- HTML5, CSS3, JavaScript (Django templates for initial implementation)

**Backend**
- Django, Django Channels (WebSockets)
- PostgreSQL

**Authentication & Integrations**
- Firebase Authentication
- External API integrations (e.g., OAuth/LinkedIn, StackOverflow-like data ingestion, Discord-like messaging patterns)

**Machine Learning / NLP**
- Sentence Transformers (semantic embeddings for search/matching)
- BART (text summarization and thread summarization)

**Dev / Testing / Deployment**
- ngrok (development tunneling)
- Git & GitHub (version control)
- (Recommended next steps: Docker, Kubernetes, CI pipelines)

---

## 🧠 How AI features are implemented (technical details)
- **Semantic Search & Duplicate Detection (Sentence Transformers):**
  - At ingest time, each question/post is encoded into a fixed-size vector using a Sentence Transformer model.
  - Vectors stored in a vector store (or PostgreSQL + pgvector) and nearest-neighbour search is performed to find semantically similar posts.
  - Similarity thresholding is used to suggest duplicates and cluster related threads.
- **Thread & Stream Summarization (BART):**
  - Long discussions and livestream transcripts are batched and fed to a fine-tuned or pre-trained BART summarization pipeline.
  - The resulting summary is stored and surfaced on thread listings and hub overviews so users can quickly see key points.

---

## 🧾 System Architecture (high level)
1. **Client (browser)** — renders UI, interacts with REST endpoints and WebSockets.
2. **Django App** — API endpoints, business rules, authentication hooks, channels layer for realtime.
3. **PostgreSQL** — primary relational store for users, posts, analytics.
4. **AI Module** — separate process/service (can be containerized) that computes embeddings and summaries; exposes internal API or message-queue interface.
5. **Auth Provider** — Firebase manages user sign-up/sign-in and session tokens.
6. **Optional Vector Store** — pgvector or a dedicated vector DB for efficient similarity search.

---

## 🧠 Methodologies & Development Practices
- **Agile / Iterative Development:** Short sprints, prioritized features, continuous feedback from test users.  
- **TDD / Test Automation (recommended):** Unit tests for core services, integration tests for API endpoints, automated test runs in CI.  
- **Modular & Microservice-ready Architecture:** Code organized for easy extraction of AI modules and real-time services into containers/microservices.  
- **Design Thinking & UX:** User flows and wireframes validated for separate teacher/student experiences and accessibility.  
- **Version Control & Branching:** Git flow with feature branches, PR reviews, and issue-based tasking.

---

## ⚙️ Local Setup (Quick Start Guide)

### 🧩 Requirements
- Python 3.9+  
- PostgreSQL  
- Firebase project (for authentication)  
- Git  
- (Optional) ngrok for testing real-time and external callbacks  

---

### 🚀 Setup Instructions

```bash
# 1️⃣ Clone the repository
git clone https://github.com/Dubemsky/EduLink.git
cd EduLink

# 2️⃣ Create a virtual environment
python -m venv venv
# Activate it
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# 3️⃣ Install dependencies
pip install -r requirements.txt

# 4️⃣ Configure environment variables
# (Create a .env file in the root directory)
# Example:
DJANGO_SECRET_KEY=your_secret_key_here
DATABASE_URL=postgres://username:password@localhost:5432/edulink
FIREBASE_CONFIG_PATH=path_to_your_firebase_credentials.json

# 5️⃣ Run migrations
python manage.py migrate

# 6️⃣ Start the development server
python manage.py runserver

