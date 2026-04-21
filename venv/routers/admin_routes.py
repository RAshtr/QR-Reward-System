from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, database, schemas
import uuid
import random
from typing import List

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

# --- 1. Analytics Endpoint ---
@router.get("/analytics", response_model=schemas.AdminAnalytics)
def get_analytics(db: Session = Depends(database.get_db)):
    total_campaigns = db.query(models.Campaign).count()
    total_qrs = db.query(models.QRCode).count()
    redeemed_qrs = db.query(models.QRCode).filter(models.QRCode.is_redeemed == True).count()
    
    # Summing amounts
    total_dist_query = db.query(func.sum(models.QRCode.assigned_amount)).scalar() or 0
    total_paid_query = db.query(func.sum(models.QRCode.assigned_amount)).filter(models.QRCode.is_redeemed == True).scalar() or 0
    
    total_dist = float(total_dist_query)
    total_paid = float(total_paid_query)
    
    return {
        "total_campaigns": total_campaigns,
        "total_qrs_generated": total_qrs,
        "total_redeemed_count": redeemed_qrs,
        "total_payout_distributed": round(total_dist, 2),
        "total_payout_redeemed": round(total_paid, 2),
        "remaining_liability": round(total_dist - total_paid, 2)
    }

# --- 2. Create Campaign (Batch Generation) ---
@router.post("/campaigns/", response_model=schemas.CampaignResponse)
def create_campaign(campaign: schemas.CampaignCreate, db: Session = Depends(database.get_db)):
    # Model instance creation (Like ASP.NET Entity mapping)
    db_campaign = models.Campaign(
        series_name=campaign.series_name,
        min_amount=float(campaign.min_amount),
        max_amount=float(campaign.max_amount),
        quantity=int(campaign.quantity),
        expiry_date=campaign.expiry_date
    )
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)

    # Bulk QR generation
    qr_list = []
    for _ in range(int(campaign.quantity)):
        random_reward = round(random.uniform(float(campaign.min_amount), float(campaign.max_amount)), 2)
        new_qr = models.QRCode(
            campaign_id=db_campaign.id,
            qr_code_id=str(uuid.uuid4())[:12], 
            assigned_amount=random_reward,
            is_redeemed=False
        )
        qr_list.append(new_qr)
    
    db.add_all(qr_list)
    db.commit()
    return db_campaign

# --- 3. Get All Campaigns with Nested QR Data ---
@router.get("/campaigns/")
def get_campaigns(db: Session = Depends(database.get_db)):
    campaigns = db.query(models.Campaign).all()
    result = []
    
    for c in campaigns:
        # Latest redeemed QRs first logic
        qrs = db.query(models.QRCode).filter(models.QRCode.campaign_id == c.id).all()
        
        result.append({
            "id": c.id,
            "series_name": c.series_name,
            "qr_list": [
                {
                    "qr_code_id": str(qr.qr_code_id),
                    "assigned_amount": float(qr.assigned_amount),
                    "is_redeemed": bool(qr.is_redeemed),
                    "redeemed_mobile": qr.redeemed_mobile,
                    "redeemed_upi": qr.redeemed_upi,
                    "transaction_id": qr.transaction_id,
                    "redeemed_at": qr.redeemed_at.isoformat() if qr.redeemed_at else None
                } for qr in qrs
            ]
        })
    return result