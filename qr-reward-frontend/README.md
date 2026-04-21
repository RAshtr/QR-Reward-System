# 🚀 Professional QR Reward System

A full-stack, modular automated reward distribution system. This project allows admins to generate batches of QR codes with randomized cash rewards and enables users to claim them via UPI instantly.

## 🌟 Key Features
- **Modular Architecture:** Built using FastAPI's `APIRouter` for a clean, scalable, and professional folder structure.
- **Batch Generation:** Admins can create multiple QR campaigns with custom date expiry, quantity, and reward ranges (Min/Max).
- **Fraud Prevention:** Integrated security check to ensure **1 Reward per Mobile/UPI ID** per campaign to prevent system abuse.
- **Dynamic Analytics:** Real-time dashboard showing Total Payout, Active QRs, and Remaining Liability.
- **PDF Reporting:** Export scannable QR code reports in PDF format using `jspdf`.

## 🛠️ Tech Stack
- **Frontend:** React.js, Axios, JsPDF, QRCode.js
- **Backend:** Python (FastAPI), SQLAlchemy (ORM)
- **Database:** PostgreSQL

## 📁 Project Structure
```text
/QR_Code_Reward_System
├── main.py              # Application Entry Point
├── models.py            # Database Entities (SQLAlchemy)
├── schemas.py           # Data Validation (Pydantic)
├── database.py          # Connection Logic
├── routers/             # Modular Controllers
│   ├── admin_routes.py
│   └── user_routes.py
├── qr-reward-frontend/  # React Application
└── README.md


🚀 Getting Started
1. Backend Setup
Create a virtual environment: python -m venv venv

Activate venv: venv\Scripts\activate

Install requirements: pip install fastapi uvicorn sqlalchemy psycopg2

Run server: uvicorn main:app --reload

2. Frontend Setup
Navigate to the frontend folder.

Install dependencies: npm install

Start the app: npm start

🛡️ Security Logic
The system implements a strict check in user_routes.py. Before processing any claim, it verifies if the provided Mobile Number or UPI ID has already been used in the current campaign. This ensures that the budget is distributed fairly and prevents multiple claims by the same user.