from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List

# 1. QR Code details
class QRCodeResponse(BaseModel):
    qr_code_id: str
    assigned_amount: float
    is_redeemed: bool
    redeemed_at: Optional[datetime] = None
    # YE DO FIELDS ADD KARO:
    redeemed_mobile: Optional[str] = None
    redeemed_upi: Optional[str] = None

    class Config:
        from_attributes = True

# 2. Schema for creating a new campaign
class CampaignCreate(BaseModel):
    series_name: str
    description: Optional[str] = None
    min_amount: float
    max_amount: float
    quantity: int
    expiry_date: date

# 3. Campaign Response (Changing 'Campaign' to 'CampaignResponse' to fix AttributeError)
class CampaignResponse(BaseModel):
    id: int
    series_name: str
    # ... baki fields ...
    qr_list: List[QRCodeResponse] = [] # <--- Ye exact hona chahiye

    class Config:
        from_attributes = True

# 4. Analytics summary
class AdminAnalytics(BaseModel):
    total_campaigns: int
    total_qrs_generated: int
    total_redeemed_count: int
    total_payout_distributed: float
    total_payout_redeemed: float
    remaining_liability: float

class OTPSend(BaseModel):
    mobile: str

class OTPVerify(BaseModel):
    mobile: str
    otp_code: str