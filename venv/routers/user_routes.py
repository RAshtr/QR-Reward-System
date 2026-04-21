from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import models, database
import uuid

router = APIRouter(tags=["User Operations"])

@router.get("/claim/{qr_id}")
def check_qr(qr_id: str, db: Session = Depends(database.get_db)):
    db_qr = db.query(models.QRCode).filter(models.QRCode.qr_code_id == qr_id).first()
    if not db_qr:
        raise HTTPException(status_code=404, detail="Invalid QR Code")
    return {
        "qr_id": db_qr.qr_code_id,
        "amount": float(db_qr.assigned_amount),
        "is_redeemed": db_qr.is_redeemed
    }

@router.post("/redeem/{qr_id}")
def redeem_reward(qr_id: str, mobile: str, upi: str, db: Session = Depends(database.get_db)):
    # 1. QR dhoondo
    db_qr = db.query(models.QRCode).filter(models.QRCode.qr_code_id == qr_id).first()
    
    if not db_qr:
        raise HTTPException(status_code=404, detail="Invalid QR Code")
    
    if db_qr.is_redeemed:
        return {"status": "Error", "message": "This QR is already claimed!"}

    # --- SECURITY CHECK: 1 Mobile/UPI = 1 Reward ---
    # Check if this mobile or UPI has already claimed a reward in the system
    existing_claim = db.query(models.QRCode).filter(
        (models.QRCode.redeemed_mobile == mobile) | 
        (models.QRCode.redeemed_upi == upi)
    ).filter(
        models.QRCode.is_redeemed == True,
        models.QRCode.campaign_id == db_qr.campaign_id  # <-- Sirf isi batch ka check
    ).first()

    if existing_claim:
        return {
            "status": "Error", 
            "message": "Limit Exceeded: This Mobile or UPI has already claimed a reward!"
        }
    # ----------------------------------------------

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
        raise HTTPException(status_code=500, detail="Server Error during payment")