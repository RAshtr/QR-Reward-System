import random
import uuid
import os
import requests
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import models, schemas, database

# Initialization
load_dotenv()
SMS_API_KEY = os.getenv("FAST2SMS_API_KEY")

router = APIRouter(tags=["User Operations"])
get_db = database.get_db

def send_real_sms(mobile_number, otp_code):
    url = "https://www.fast2sms.com/dev/bulkV2"
    payload = {
        "variables_values": otp_code,
        "route": "otp",
        "numbers": mobile_number,
    }
    headers = {
        'authorization': SMS_API_KEY,
        'Content-Type': "application/x-www-form-urlencoded",
        'Cache-Control': "no-cache",
    }
    try:
        response = requests.request("POST", url, data=payload, headers=headers)
        return response.json()
    except Exception as e:
        print(f"SMS API Connection Error: {e}")
        return None

@router.post("/send-otp")
def send_otp(payload: schemas.OTPSend, db: Session = Depends(get_db)):
    # 1. Daily Limit Check
    today = datetime.now().date()
    daily_count = db.query(models.QRCode).filter(
        models.QRCode.redeemed_mobile == payload.mobile,
        func.date(models.QRCode.redeemed_at) == today,
        models.QRCode.is_redeemed == True
    ).count()

    if daily_count >= 10:
        return {"status": "Error", "message": "Daily claim limit reached"}

    # 2. Generate OTP
    generated_otp = str(random.randint(1000, 9999))
    
    # --- FIXED: Use local datetime.now() instead of utcnow() ---
    expiry_time = datetime.now() + timedelta(minutes=5) 
    
    print(f"\n[DEBUG] OTP for {payload.mobile}: {generated_otp} | Valid Until: {expiry_time}")

    # 3. Attempt Real SMS
    sms_res = send_real_sms(payload.mobile, generated_otp)
    
    # Purane unverified OTPs delete kar dete hain
    db.query(models.OTPVerification).filter(
        models.OTPVerification.mobile == payload.mobile,
        models.OTPVerification.is_verified == False
    ).delete()

    new_otp = models.OTPVerification(
        mobile=payload.mobile, 
        otp_code=generated_otp,
        expires_at=expiry_time, # 5 min from now
        is_verified=False
    )
    db.add(new_otp)
    db.commit()

    if sms_res and sms_res.get("return"):
        return {"status": "Success", "message": "OTP sent to mobile"}
    else:
        return {"status": "Success", "message": "OTP generated (Check Terminal)"}

@router.post("/verify-otp")
def verify_otp(payload: schemas.OTPVerify, db: Session = Depends(get_db)):
    # TIME CHECK HATA DIYA HAI - Bas OTP aur Mobile match hona chahiye
    otp_record = db.query(models.OTPVerification).filter(
        models.OTPVerification.mobile == payload.mobile,
        models.OTPVerification.otp_code == payload.otp_code,
        models.OTPVerification.is_verified == False
    ).first()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    otp_record.is_verified = True
    db.commit()
    return {"status": "Success", "message": "Verified"}

@router.get("/claim/{qr_id}")
def check_qr(qr_id: str, db: Session = Depends(get_db)):
    db_qr = db.query(models.QRCode).filter(models.QRCode.qr_code_id == qr_id).first()
    if not db_qr:
        raise HTTPException(status_code=404, detail="Invalid QR Code")
    return {
        "qr_id": db_qr.qr_code_id,
        "amount": float(db_qr.assigned_amount),
        "is_redeemed": db_qr.is_redeemed
    }

@router.post("/redeem/{qr_id}")
def redeem_reward(qr_id: str, mobile: str, upi: str, db: Session = Depends(get_db)):
    db_qr = db.query(models.QRCode).filter(models.QRCode.qr_code_id == qr_id).first()
    
    if not db_qr or db_qr.is_redeemed:
        return {"status": "Error", "message": "QR not available"}

    is_verified = db.query(models.OTPVerification).filter(
        models.OTPVerification.mobile == mobile,
        models.OTPVerification.is_verified == True
    ).first()

    if not is_verified:
        return {"status": "Error", "message": "Verification required"}

    today = datetime.now().date()
    today_claims = db.query(models.QRCode).filter(
        (models.QRCode.redeemed_mobile == mobile) | (models.QRCode.redeemed_upi == upi),
        func.date(models.QRCode.redeemed_at) == today,
        models.QRCode.is_redeemed == True
    ).count()

    if today_claims >= 2:
        return {"status": "Error", "message": "Daily limit exceeded"}

    try:
        db_qr.is_redeemed = True
        db_qr.redeemed_mobile = mobile
        db_qr.redeemed_upi = upi
        db_qr.redeemed_at = datetime.now()
        db_qr.transaction_id = f"TNK-{uuid.uuid4().hex[:10].upper()}"
        
        db.commit()
        return {
            "status": "Success", 
            "transaction_id": db_qr.transaction_id,
            "reward_amount": float(db_qr.assigned_amount)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Transaction failed")