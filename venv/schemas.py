from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List

# 1. Schema for creating a new campaign
class CampaignCreate(BaseModel):
    series_name: str
    description: Optional[str] = None
    min_amount: float
    max_amount: float
    quantity: int
    expiry_date: date

# 2. Schema for campaign data returned to the client
class CampaignResponse(BaseModel):
    id: int
    series_name: str
    min_amount: float
    max_amount: float
    quantity: int
    expiry_date: str

    class Config:
        from_attributes = True

# 3. New Schema: For QR Code details (To fix the PDF data issue)
class QRCodeResponse(BaseModel):
    qr_code_id: str
    assigned_amount: float
    is_redeemed: bool
    redeemed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# 4. Schema for Admin Dashboard Analytics summary
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