from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import random
import uuid
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "campaigns_database.json"

def load_db():
    if not os.path.exists(DB_FILE):
        return {"campaigns": [], "customers": {}, "total_payout": 0}
    try:
        with open(DB_FILE, "r") as f:
            data = json.load(f)
            if "customers" not in data:
                data["customers"] = {}
            if "campaigns" not in data:
                data["campaigns"] = []
            return data
    except:
        return {"campaigns": [], "customers": {}, "total_payout": 0}

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

# 🎯 Structural Schema Validation Models
class CampaignCreate(BaseModel):
    series_name: str
    min_amount: float
    max_amount: float
    quantity: int
    start_date: str   
    expiry_date: str
    is_bumper: Optional[bool] = False  

class CustomerTrackRequest(BaseModel):
    mobile: str
    name: str
    qr_id: str

# Helper to parse flexible date formats coming from React UI
def parse_flexible_date(date_str: str):
    clean_str = str(date_str).split("T")[0].strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(clean_str, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Date format mismatch for string: {date_str}")

# 🎯 RESTORED: Admin Gateway Analytics Dashboard Node
@app.get("/admin/analytics")
def get_analytics():
    db = load_db()
    campaigns = db.get("campaigns", [])
    total_qrs = sum(c.get("quantity", 0) for c in campaigns)
    return {
        "total_campaigns": len(campaigns),
        "total_qrs_generated": total_qrs,
        "total_payout_distributed": db.get("total_payout", 0)
    }

@app.get("/admin/campaigns/")
def get_campaigns():
    db = load_db()
    return db.get("campaigns", [])

# 🎯 Batch Creation Logic Handler
@app.post("/admin/campaigns/")
def create_campaign(campaign: CampaignCreate):
    db = load_db()
    new_id = len(db.get("campaigns", [])) + 1
    qr_list = []
    
    for _ in range(campaign.quantity):
        assigned = round(random.uniform(campaign.min_amount, campaign.max_amount), 2)
        qr_list.append({
            "qr_code_id": str(uuid.uuid4()),
            "assigned_amount": assigned,
            "is_redeemed": False,
            "redeemed_mobile": "",
            "redeemed_at": None
        })
        
    campaign_dict = {
        "id": new_id,
        "series_name": campaign.series_name,
        "min_amount": campaign.min_amount,
        "max_amount": campaign.max_amount,
        "quantity": campaign.quantity,
        "start_date": campaign.start_date,
        "expiry_date": campaign.expiry_date,
        "is_bumper": campaign.is_bumper if campaign.is_bumper is not None else False,
        "qr_list": qr_list
    }
    
    db["campaigns"].append(campaign_dict)
    save_db(db)
    return campaign_dict

@app.get("/claim/{qr_id}")
def verify_customer_scan(qr_id: str):
    db = load_db()
    target_campaign = None
    target_qr = None
    
    # 🎯 1. QR Code search matrix match loop
    for campaign in db.get("campaigns", []):
        for qr in campaign.get("qr_list", []):
            if str(qr.get("qr_code_id")).strip().lower() == str(qr_id).strip().lower():
                target_campaign = campaign
                target_qr = qr
                break
        if target_campaign:
            break
            
    if not target_campaign or not target_qr:
        raise HTTPException(status_code=404, detail="QR Code Not Found")
        
    # 🎯 2. STRICT DATE VALIDATION (STOPS SCANS BEFORE START DATE)
    current_date = datetime.now().date()
    start_date_raw = target_campaign.get("start_date")
    expiry_date_raw = target_campaign.get("expiry_date")
    
    if start_date_raw:
        try:
            campaign_start = parse_flexible_date(start_date_raw)
            # 🚨 STOPS SCAN PROMPT: Agar aaj ki date start_date se pehle ki hai toh direct strict lock lagao
            if current_date < campaign_start:
                raise HTTPException(
                    status_code=400, 
                    detail=f"This campaign will activate on {campaign_start.strftime('%d-%b-%Y')}. Scans are locked until then!"
                )
        except HTTPException as he:
            raise he
        except Exception as e:
            print(f"Date check strict parser error: {str(e)}")
            
    if expiry_date_raw:
        try:
            campaign_expiry = parse_flexible_date(expiry_date_raw)
            if current_date > campaign_expiry:
                raise HTTPException(status_code=400, detail="This voucher coupon batch has already expired!")
        except Exception as e:
            print(f"Expiry validation crash bypass: {str(e)}")
            
    # If already redeemed, return direct status
    if target_qr.get("is_redeemed"):
        return {
            "status": "success",
            "is_redeemed": True,
            "assigned_amount": target_qr.get("assigned_amount")
        }
        
    return {
        "status": "success",
        "is_redeemed": False,
        "assigned_amount": target_qr.get("assigned_amount"),
        "is_bumper_campaign": target_campaign.get("is_bumper", False)
    }
# 🎯 Customer Unique Identity Bumper Progress Tracker
@app.post("/customer/check-progress")
def check_customer_loyalty(req: CustomerTrackRequest):
    db = load_db()
    
    # Clean data spaces strictly to prevent encoding gaps
    mobile = str(req.mobile).strip()
    name = str(req.name).strip()
    qr_id = str(req.qr_id).strip().lower()
    
    if not mobile:
        raise HTTPException(status_code=400, detail="Mobile number configuration is completely missing!")

    # 🎯 FIX: Core Initialize safe customer directory dict mapping if not exists
    if "customers" not in db:
        db["customers"] = {}
        
    if mobile not in db["customers"]:
        db["customers"][mobile] = {
            "name": name,
            "total_scans": 0,
            "history": []
        }
        
    customer_data = db["customers"][mobile]
    customer_data["name"] = name  # Sync/update latest input name safely
    
    # Ensure history tracker node arrays exist inside database structure
    if "history" not in customer_data:
        customer_data["history"] = []

    # 🎯 FIX: Avoid double tracking count if user submits the same QR token again
    if qr_id not in customer_data["history"]:
        customer_data["total_scans"] = customer_data.get("total_scans", 0) + 1
        customer_data["history"].append(qr_id)
        
    scans_done = customer_data["total_scans"]
    is_bumper_hit = False
    remaining = 64 - scans_done
    
    # Bumper progression unlock reset threshold limit rules
    if scans_done >= 64:
        is_bumper_hit = True
        customer_data["total_scans"] = 0  
        remaining = 64
        
    save_db(db)
    
    return {
        "status": "success",
        "customer_name": name,
        "total_scans_done": scans_done,
        "remaining_scans": remaining,
        "is_bumper_hit": is_bumper_hit
    }