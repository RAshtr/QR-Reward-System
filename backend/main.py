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

# 🎯 FIX: Batch Generation ke liye structural configuration models
class CampaignCreate(BaseModel):
    series_name: str
    min_amount: float
    max_amount: float
    quantity: int
    start_date: str   
    expiry_date: str
    is_bumper: Optional[bool] = False  # Payload crash protection

class CustomerTrackRequest(BaseModel):
    mobile: str
    name: str
    qr_id: str

# Helper to parse flexible date formats coming from react UI (like YYYY-MM-DD or DD-MM-YYYY)
def parse_flexible_date(date_str: str):
    clean_str = str(date_str).split("T")[0].strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(clean_str, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Date format mismatch for string: {date_str}")

@app.get("/admin/campaigns/")
def get_campaigns():
    db = load_db()
    return db.get("campaigns", [])

# 🎯 BACK: Missing Batch Creation Endpoint Restored & Strengthened
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
        
    current_date = datetime.now().date()
    start_date_raw = target_campaign.get("start_date")
    expiry_date_raw = target_campaign.get("expiry_date")
    
    if start_date_raw:
        try:
            campaign_start = parse_flexible_date(start_date_raw)
            if current_date < campaign_start:
                raise HTTPException(status_code=400, detail=f"campaign_not_started:{campaign_start}")
        except Exception as e:
            print(f"Date check pass override bypass: {str(e)}")
            
    if expiry_date_raw:
        try:
            campaign_expiry = parse_flexible_date(expiry_date_raw)
            if current_date > campaign_expiry:
                raise HTTPException(status_code=400, detail="This voucher coupon batch has already expired!")
        except Exception as e:
            print(f"Expiry validation bypass: {str(e)}")
            
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

@app.post("/customer/check-progress")
def check_customer_loyalty(req: CustomerTrackRequest):
    db = load_db()
    mobile = req.mobile.strip()
    name = req.name.strip()
    
    if mobile not in db["customers"]:
        db["customers"][mobile] = {
            "name": name,
            "total_scans": 0,
            "history": []
        }
        
    customer_data = db["customers"][mobile]
    customer_data["name"] = name
    
    if req.qr_id not in customer_data["history"]:
        customer_data["total_scans"] += 1
        customer_data["history"].append(req.qr_id)
        
    scans_done = customer_data["total_scans"]
    is_bumper_hit = False
    remaining = 64 - scans_done
    
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