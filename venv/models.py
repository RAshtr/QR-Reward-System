from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime,timedelta


class Campaign(Base):
    __tablename__ = "campaigns"
    qr_list = relationship("QRCode", back_populates="campaign", lazy="joined")
    id = Column(Integer, primary_key=True, index=True)
    series_name = Column(String)
    description = Column(String, nullable=True)
    min_amount = Column(Float)
    max_amount = Column(Float)
    quantity = Column(Integer)
    expiry_date = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship with QRs
    qr_codes = relationship("QRCode", back_populates="campaign")

class QRCode(Base):
    __tablename__ = "qr_codes"
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    qr_code_id = Column(String, unique=True, index=True)
    assigned_amount = Column(Float)
    
    # Redemption Details (User Flow ke liye naye columns)
    is_redeemed = Column(Boolean, default=False)
    redeemed_mobile = Column(String, nullable=True)  # User ka mobile number
    redeemed_upi = Column(String, nullable=True)     # User ki UPI ID
    transaction_id = Column(String, nullable=True)   # Payment ka reference ID
    redeemed_at = Column(DateTime, nullable=True)    # Kab claim kiya
    
    campaign = relationship("Campaign", back_populates="qr_codes")


class OTPVerification(Base):
    __tablename__ = "otp_verifications"

    id = Column(Integer, primary_key=True, index=True)
    mobile = Column(String, index=True)
    otp_code = Column(String)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # OTP 5 minute mein expire ho jayega
    expires_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(minutes=5))