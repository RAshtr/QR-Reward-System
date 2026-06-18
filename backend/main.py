from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import qrcode
from PIL import Image, ImageDraw
import io
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
        return {"campaigns": [], "total_payout": 0}
    try:
        with open(DB_FILE, "r") as f:
            return json.load(f)
    except:
        return {"campaigns": [], "total_payout": 0}

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

class CampaignCreate(BaseModel):
    series_name: str
    min_amount: float
    max_amount: float
    quantity: int
    start_date: str   # Format: YYYY-MM-DD
    expiry_date: str

@app.get("/admin/analytics")
def get_analytics():
    db = load_db()
    total_qrs = sum(c.get("quantity", 0) for c in db["campaigns"])
    return {
        "total_campaigns": len(db["campaigns"]),
        "total_qrs_generated": total_qrs,
        "total_payout_distributed": db.get("total_payout", 0)
    }

@app.get("/admin/campaigns/")
def get_campaigns():
    db = load_db()
    return db["campaigns"]

@app.post("/admin/campaigns/")
def create_campaign(campaign: CampaignCreate):
    import random, uuid
    db = load_db()
    new_id = len(db["campaigns"]) + 1
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
        "qr_list": qr_list
    }
    
    db["campaigns"].append(campaign_dict)
    save_db(db)
    return campaign_dict

# 🎯 FOOLPROOF VALIDATION ROUTE (Strict HTTP 400 Exception Engine)
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
        
    # Python pure date objects execution logic
    current_date = datetime.now().date()
    
    start_date_raw = target_campaign.get("start_date")
    expiry_date_raw = target_campaign.get("expiry_date")
    
    # 1. 🔥 STRICT START DATE LOCK (Throws explicit 400 block message)
    if start_date_raw:
        clean_start = start_date_raw.split("T")[0].strip()
        campaign_start = datetime.strptime(clean_start, "%Y-%m-%d").date()
        
        if current_date < campaign_start:
            raise HTTPException(
                status_code=400, 
                detail=f"campaign_not_started:{clean_start}"
            )
            
    # 2. 🔥 EXPIRY DATE CHECK
    if expiry_date_raw:
        clean_expiry = expiry_date_raw.split("T")[0].strip()
        campaign_expiry = datetime.strptime(clean_expiry, "%Y-%m-%d").date()
        if current_date > campaign_expiry:
            raise HTTPException(status_code=400, detail="This voucher coupon batch has already expired!")
            
    # 3. 🔥 ALREADY REDEEMED CHECK
    if target_qr.get("is_redeemed"):
        return {
            "status": "success",
            "is_redeemed": True,
            "assigned_amount": target_qr.get("assigned_amount")
        }
        
    return {
        "status": "success",
        "is_redeemed": False,
        "assigned_amount": target_qr.get("assigned_amount")
    }

@app.get("/api/v1/generate-print-qr")
def generate_print_ready_sticker(qr_id: str, company_name: Optional[str] = "MARUTHI"):
    canvas_w, canvas_h = 600, 266
    canvas = Image.new("RGB", (canvas_w, canvas_h), "white")
    canvas_draw = ImageDraw.Draw(canvas)
    
    canvas_draw.rectangle([(410, 0), (600, canvas_h)], fill="#0f172a")
    
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=5, border=1)
    target_scan_url = f"https://qr-reward-system-gilt.vercel.app/claim/{qr_id}"
    qr.add_data(target_scan_url)
    qr.make(fit=True)
    
    qr_img = qr.make_image(fill_color="#0f172a", back_color="white").convert("RGB").resize((190, 190))
    canvas.paste(qr_img, (410, 38)) 
    
    logo_filename = "logo.png"
    if not os.path.exists(logo_filename) and os.path.exists("logo.png.png"):
        logo_filename = "logo.png.png"
        
    logo_loaded = False
    if os.path.exists(logo_filename):
        try:
            raw_img = Image.open(logo_filename)
            if raw_img.mode in ('RGBA', 'LA') or (raw_img.mode == 'P' and 'transparency' in raw_img.info):
                blended = Image.new("RGB", raw_img.size, (255, 255, 255))
                blended.paste(raw_img, mask=raw_img.convert('RGBA').split()[3])
                logo_asset = blended
            else:
                logo_asset = raw_img.convert("RGB")
            
            logo_asset = logo_asset.resize((270, 70), Image.Resampling.LANCZOS)
            canvas.paste(logo_asset, (20, 15))
            logo_loaded = True
            print(f"🔥 HD FILE LOAD LOGGED: {logo_filename}")
        except Exception as e:
            print(f"❌ PIL fallback exception handling: {str(e)}")

    if not logo_loaded:
        canvas_draw.text((20, 30), "MARUTHI ELECTRODES", fill="#0f172a")

    canvas_draw.rectangle([(15, 95), (395, 155)], fill="#1d4ed8") 
    canvas_draw.text((25, 102), "Scratch & Scan To Win", fill="white")
    canvas_draw.text((25, 126), "Instant Cashback", fill="white")
    
    canvas_draw.rectangle([(295, 110), (375, 140)], fill="#1d4ed8")
    canvas_draw.text((310, 115), "UPI", fill="white")
    
    canvas_draw.polygon([(355, 115), (365, 125), (355, 135)], fill="#ea580c")
    canvas_draw.polygon([(365, 115), (375, 125), (365, 135)], fill="#16a34a")

    canvas_draw.text((20, 172), "1. Scan QR.  2. Open Link.  3. Scratch & Claim.", fill="#475569")
    canvas_draw.line([(15, 215), (395, 215)], fill="#e2e8f0", width=1)
    
    clean_uid_str = str(qr_id).upper().strip()
    if len(clean_uid_str) > 28:
        clean_uid_str = f"{clean_uid_str[:14]}...{clean_uid_str[-12:]}"
        
    canvas_draw.text((20, 228), "SECURE TRACKING S/N:", fill="#94a3b8")
    canvas_draw.text((185, 228), clean_uid_str, fill="#0f172a")
    
    canvas_draw.rectangle([(0, 0), (599, 265)], outline="#cbd5e1", width=2)
    
    image_stream = io.BytesIO()
    canvas.save(image_stream, format="PNG")
    image_stream.seek(0)
    
    return Response(content=image_stream.getvalue(), media_type="image/png")