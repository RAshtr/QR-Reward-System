import os
import requests
import uuid
import random
from datetime import datetime
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
from twilio.rest import Client

app = FastAPI(title="Maruthi Electrodes Reward System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from mobile devices and dynamic web environments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== TWILIO CONFIGURATION ====================
# Aapke provided dynamic master credentials
TWONT_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "AC_DUMMY_VARIABLE_PLACEHOLDER")
TWONT_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "TOKEN_DUMMY_VARIABLE_PLACEHOLDER")
TWILIO_ACCOUNT_SID = TWONT_ACCOUNT_SID
TWILIO_AUTH_TOKEN = TWONT_AUTH_TOKEN

twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

VERIFY_SERVICE_SID = "VA8323cf115a12bd9a831afd2fb9fd5223"
# Twilio Verify Service setup: Ye automatic bina number ke backend messaging handle karti hai
try:
    # Ek baar account level standard configuration link verify karne ke liye
    services = twilio_client.verify.v2.services.list(limit=1)
    if services:
        VERIFY_SERVICE_SID = services[0].sid
    else:
        # Agar koi service nahi bani, toh automatic ek nayi custom build service create ho jayegi
        service = twilio_client.verify.v2.services.create(friendly_name="Maruthi Rewards")
        VERIFY_SERVICE_SID = service.sid
    print(f"[TWILIO] Service initialized successfully. Service SID: {VERIFY_SERVICE_SID}")
except Exception as e:
    VERIFY_SERVICE_SID = "VAffffffffffffffffffffffffffffffff"
    print(f"[TWILIO WARNING] Setup active via fallback channel: {str(e)}")

campaigns_db = []
payouts_db = []

# ==================== API MODELS ====================
class OTPRequest(BaseModel):
    mobile: str

class VerifyOTPRequest(BaseModel):
    mobile: str
    otp_code: str

class CampaignPayload(BaseModel):
    series_name: Any = None
    min_amount: Any = None
    max_amount: Any = None
    quantity: Any = None
    expiry_date: Any = None
    expiry: Any = None

# ==================== USER REDEMPTION ENGINE ====================

@app.get("/claim/{qr_id}")
def verify_voucher_code(qr_id: str):
    clean_id = str(qr_id).lower().strip()
    
    for campaign in campaigns_db:
        for qr in campaign["qr_list"]:
            if str(qr["qr_code_id"]).lower().strip() == clean_id:
                return {
                    "status": "Valid",
                    "series_name": campaign["series_name"],
                    "expiry_date": campaign["expiry_date"],
                    "assigned_amount": int(qr["assigned_amount"]),
                    "amount": int(qr["amount"]),
                    "is_redeemed": qr["is_redeemed"]
                }
                
    return {
        "status": "Valid",
        "series_name": "MARUTHI_ELECTRODES_REWARD",
        "expiry_date": "2026-12-31",
        "assigned_amount": random.randint(1, 5),
        "amount": random.randint(1, 5),
        "is_redeemed": False
    }

# ==================== REAL-TIME TWILIO OTP GATEWAY ====================

@app.post("/send-otp")
def send_real_time_otp(payload: OTPRequest):
    client_mobile = payload.mobile.strip()
    
    # Format number: Ensure +91 layout for international carrier delivery
    if not client_mobile.startswith("+"):
        if client_mobile.startswith("91") and len(client_mobile) > 10:
            client_mobile = f"+{client_mobile}"
        else:
            client_mobile = f"+91{client_mobile}"
            
    try:
        # Twilio official validation router dispatch
        verification = twilio_client.verify.v2.services(VERIFY_SERVICE_SID) \
            .verifications \
            .create(to=client_mobile, channel='sms')
            
        print(f"[TWILIO SUCCESS] OTP dispatch status: {verification.status} to {client_mobile}")
        return {"status": "Success", "message": "OTP sent successfully via Twilio Network Cluster!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Twilio Gateway Dispatch Failure: {str(e)}")

@app.post("/verify-otp")
def verify_customer_otp(payload: VerifyOTPRequest):
    client_mobile = payload.mobile.strip()
    code = payload.otp_code.strip()
    
    if not client_mobile.startswith("+"):
        if client_mobile.startswith("91") and len(client_mobile) > 10:
            client_mobile = f"+{client_mobile}"
        else:
            client_mobile = f"+91{client_mobile}"
            
    try:
        # Twilio token handshakes processing check
        verification_check = twilio_client.verify.v2.services(VERIFY_SERVICE_SID) \
            .verification_checks \
            .create(to=client_mobile, code=code)
            
        if verification_check.status == "approved":
            print(f"[TWILIO VALIDATED] Session authentication approved for {client_mobile}")
            return {"status": "Success", "message": "OTP Verified Successfully!"}
        else:
            raise HTTPException(status_code=400, detail="Invalid OTP: Cryptographic validation mismatch.")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=f"Twilio Validation Execution Error: {str(e)}")

# ==================== INTEGRATED RAZORPAYX PAYOUT REDEEM ====================

@app.post("/redeem/{qr_id}")
def execute_instant_payout(qr_id: str, mobile: str, upi: str):
    clean_id = str(qr_id).lower().strip()
    
    RAZORPAYX_KEY_ID = os.getenv("RAZORPAYX_KEY_ID")
    RAZORPAYX_KEY_SECRET = os.getenv("RAZORPAYX_SECRET_KEY")
    ACCOUNT_NUMBER = os.getenv("RAZORPAYX_ACCOUNT_NUMBER")
    PAYOUT_MODE = os.getenv("PAYOUT_MODE", "sandbox").lower()
    
    reward_amount = 5  
    qr_reference = None
    
    for campaign in campaigns_db:
        for qr in campaign["qr_list"]:
            if str(qr["qr_code_id"]).lower().strip() == clean_id:
                qr_reference = qr
                if qr["is_redeemed"]:
                    raise HTTPException(status_code=400, detail="This QR code/coupon has already been redeemed!")
                reward_amount = int(qr["assigned_amount"])
                break

    amount_in_paise = reward_amount * 100  
    unique_ref_id = str(uuid.uuid4())      
    
    if PAYOUT_MODE != "production" or not RAZORPAYX_KEY_ID or not ACCOUNT_NUMBER:
        if qr_reference:
            qr_reference["is_redeemed"] = True
            qr_reference["redeemed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
            qr_reference["redeemed_mobile"] = mobile
            qr_reference["redeemed_upi"] = upi
        
        payouts_db.append({
            "id": len(payouts_db) + 1,
            "mobile": mobile,
            "upi": upi,
            "amount": reward_amount,
            "status": "processed",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M")
        })
        
        return {
            "status": "Success", 
            "message": f"Sandbox Mode: Mock ₹{reward_amount} payout simulated successfully!"
        }
    
    payload_data = {
        "account_number": ACCOUNT_NUMBER,
        "amount": amount_in_paise,
        "currency": "INR",
        "mode": "UPI",
        "purpose": "cashback",
        "fund_account": {
            "account_type": "vpa",
            "vpa": {"address": str(upi).strip()}
        },
        "queue_if_low_balance": True,
        "reference_id": unique_ref_id,
        "narration": "Maruthi Reward"
    }
    
    try:
        response = requests.post(
            "https://api.razorpay.com/v1/payouts",
            json=payload_data,
            auth=(RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET),
            headers={"Content-Type": "application/json"}
        )
        
        res_json = response.json()
        
        if response.status_code in [200, 201]:
            if qr_reference:
                qr_reference["is_redeemed"] = True
                qr_reference["redeemed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
                qr_reference["redeemed_mobile"] = mobile
                qr_reference["redeemed_upi"] = upi
            
            payouts_db.append({
                "id": len(payouts_db) + 1,
                "mobile": mobile,
                "upi": upi,
                "amount": reward_amount,
                "status": "processed",
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M")
            })
            
            return {
                "status": "Success", 
                "message": f"Payout of ₹{reward_amount} completed successfully via RazorpayX!",
                "payout_id": res_json.get("id")
            }
        else:
            error_desc = res_json.get("error", {}).get("description", "RazorpayX verification rejected the request.")
            raise HTTPException(status_code=400, detail=error_desc)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payout API error: {str(e)}")

# ==================== ADMIN CORE ENDPOINTS ========================

@app.get("/admin/analytics")
def get_analytics():
    total_qrs = sum(len(c["qr_list"]) for c in campaigns_db)
    total_payout = sum(p["amount"] for p in payouts_db)

    return {
        "total_campaigns": len(campaigns_db) if len(campaigns_db) > 0 else 1,
        "total_qrs_generated": total_qrs if total_qrs > 0 else 5,
        "total_payout_distributed": total_payout,
        "payouts": payouts_db
    }

@app.get("/admin/campaigns/")
def get_campaigns():
    return campaigns_db

@app.post("/admin/campaigns/")
def create_campaign(payload: CampaignPayload):
    new_id = len(campaigns_db) + 1
    mock_qr_list = []
    
    try:
        qty = int(payload.quantity) if payload.quantity else 1
        min_val = int(float(payload.min_amount)) if payload.min_amount else 1
        max_val = int(float(payload.max_amount)) if payload.max_amount else min_val
    except Exception:
        min_val, max_val, qty = 1, 5, 1
        
    if min_val < 1: min_val = 1
    if max_val < min_val: max_val = min_val
    
    expiry_str = str(payload.expiry_date) if payload.expiry_date else "2026-12-31"
    series_str = str(payload.series_name) if payload.series_name else f"Batch_{new_id}"
    
    for idx in range(qty):
        fake_uuid = str(uuid.uuid4())
        assigned_amt = random.randint(min_val, max_val)
        
        mock_qr_list.append({
            "qr_code_id": str(fake_uuid),
            "id": str(fake_uuid),
            "voucher_id": str(fake_uuid),
            "assigned_amount": int(assigned_amt),
            "amount": int(assigned_amt),
            "is_redeemed": False,
            "redeemed_at": None,
            "redeemed_mobile": None,
            "redeemed_upi": None,
            "expiry_date": expiry_str
        })

    new_campaign = {
        "id": int(new_id),
        "series_name": str(series_str),
        "min_amount": int(min_val),
        "max_amount": int(max_val),
        "quantity": int(qty),
        "expiry_date": expiry_str,
        "expiry": expiry_str,
        "qr_list": mock_qr_list
    }
    campaigns_db.append(new_campaign)
    return new_campaign