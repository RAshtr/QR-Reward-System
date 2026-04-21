import random
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, schemas, database

router = APIRouter(tags=["User Operations"])

# Database Dependency
get_db = database.get_db

# --- OTP ENDPOINTS ---

@router.post("/send-otp")
def send_otp(payload: schemas.OTPSend, db: Session = Depends(get_db)):
    # Generate 4-digit random OTP
    generated_otp = str(random.randint(1000, 9999))
    
    # Save to database
    new_otp_entry = models.OTPVerification(
        mobile=payload.mobile, 
        otp_code=generated_otp
    )
    db.add(new_otp_entry)
    db.commit()
    
    # Professional Debug Log for Terminal
    print(f"\n--- SMS GATEWAY SIMULATION ---")
    print(f"To: {payload.mobile}")
    print(f"Message: Your verification code is {generated_otp}")
    print(f"------------------------------\n")
    
    return {"status": "Success", "message": "OTP sent successfully"}

@router.post("/verify-otp")
def verify_otp(payload: schemas.OTPVerify, db: Session = Depends(get_db)):
    # Check for the most recent unverified OTP that hasn't expired (5 min window)
    otp_record = db.query(models.OTPVerification).filter(
        models.OTPVerification.mobile == payload.mobile,
        models.OTPVerification.otp_code == payload.otp_code,
        models.OTPVerification.is_verified == False,
        models.OTPVerification.expires_at > datetime.utcnow()
    ).first()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    # Mark as verified
    otp_record.is_verified = True
    db.commit()
    
    return {"status": "Success", "message": "Mobile number verified"}

# --- QR & REWARD ENDPOINTS ---

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
    # 1. Fetch QR Details
    db_qr = db.query(models.QRCode).filter(models.QRCode.qr_code_id == qr_id).first()
    
    if not db_qr:
        raise HTTPException(status_code=404, detail="Invalid QR Code")
    
    if db_qr.is_redeemed:
        return {"status": "Error", "message": "This QR is already claimed!"}

    # 2. OTP VERIFICATION CHECK (Security requirement from PDF)
    verified_mobile = db.query(models.OTPVerification).filter(
        models.OTPVerification.mobile == mobile,
        models.OTPVerification.is_verified == True
    ).first()

    if not verified_mobile:
        return {"status": "Error", "message": "Mobile number not verified via OTP"}

    # 3. FRAUD PROTECTION: 1 Mobile/UPI = 1 Reward per Campaign
    existing_claim = db.query(models.QRCode).filter(
        (models.QRCode.redeemed_mobile == mobile) | 
        (models.QRCode.redeemed_upi == upi)
    ).filter(
        models.QRCode.is_redeemed == True,
        models.QRCode.campaign_id == db_qr.campaign_id
    ).first()

    if existing_claim:
        return {
            "status": "Error", 
            "message": "Limit Exceeded: This Mobile or UPI has already claimed a reward!"
        }

    # 4. Process Redemption
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
        print(f"Redeem Error: {e}")
        raise HTTPException(status_code=500, detail="Server Error during payment processing")