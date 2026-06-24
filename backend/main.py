from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
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
            return data
    except:
        return {"campaigns": [], "customers": {}, "total_payout": 0}

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

# Customer progress request model
class CustomerTrackRequest(BaseModel):
    mobile: str
    name: str
    qr_id: str

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
        clean_start = start_date_raw.split("T")[0].strip()
        if current_date < datetime.strptime(clean_start, "%Y-%m-%d").date():
            raise HTTPException(status_code=400, detail=f"campaign_not_started:{clean_start}")
            
    if expiry_date_raw:
        clean_expiry = expiry_date_raw.split("T")[0].strip()
        if current_date > datetime.strptime(clean_expiry, "%Y-%m-%d").date():
            raise HTTPException(status_code=400, detail="This voucher coupon batch has already expired!")
            
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

# 🎯 NEW: HAR CUSTOMER KE NAME/NUMBER SE TRACK KARNE KA ROUTE
@app.post("/customer/check-progress")
def check_customer_loyalty(req: CustomerTrackRequest):
    db = load_db()
    mobile = req.mobile.strip()
    name = req.name.strip()
    
    # Agar customer pehle se nahi hai toh naya banao
    if mobile not in db["customers"]:
        db["customers"][mobile] = {
            "name": name,
            "total_scans": 0,
            "history": []
        }
        
    customer_data = db["customers"][mobile]
    # Name update kar do agar badla ho toh
    customer_data["name"] = name
    
    # Scan register karo agar ye QR is bande ne pehle scan nahi kiya hai history me
    if req.qr_id not in customer_data["history"]:
        customer_data["total_scans"] += 1
        customer_data["history"].append(req.qr_id)
        
    scans_done = customer_data["total_scans"]
    is_bumper_hit = False
    remaining = 64 - scans_done
    
    if scans_done >= 64:
        is_bumper_hit = True
        customer_data["total_scans"] = 0  # Reset to 0 after bumper reward
        remaining = 64
        
    save_db(db)
    
    return {
        "status": "success",
        "customer_name": name,
        "total_scans_done": scans_done,
        "remaining_scans": remaining,
        "is_bumper_hit": is_bumper_hit
    }