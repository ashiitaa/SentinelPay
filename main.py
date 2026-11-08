from fastapi import FastAPI, HTTPException
import sqlite3

app = FastAPI(title="SentinelPay Security Proxy")
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any frontend URL/file
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect("sentinelpay.db")
    cursor = conn.cursor()
    
    # Sub-wallets / Allowances table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS wallets (
            agent_id TEXT PRIMARY KEY,
            allowance REAL,
            spent REAL DEFAULT 0,
            is_frozen INTEGER DEFAULT 0
        )
    """)
    
    # Audit log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transaction_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT,
            amount REAL,
            status TEXT,
            reason TEXT
        )
    """)
    
    # Add a demo agent wallet with $100 allowance if it doesn't exist yet
    cursor.execute("INSERT OR IGNORE INTO wallets (agent_id, allowance, spent, is_frozen) VALUES (?, ?, ?, ?)",
                   ("agent_01", 100.0, 0.0, 0))
    
    conn.commit()
    conn.close()

init_db()

@app.get("/")
def home():
    return {"status": "SentinelPay Security Proxy Active"}

# Security Verification Endpoint
@app.post("/verify-payment")
def verify_payment(agent_id: str, amount: float, prompt_text: str = ""):
    conn = sqlite3.connect("sentinelpay.db")
    cursor = conn.cursor()
    
    # Fetch agent wallet
    cursor.execute("SELECT allowance, spent, is_frozen FROM wallets WHERE agent_id = ?", (agent_id,))
    wallet = cursor.fetchone()
    
    if not wallet:
        conn.close()
        raise HTTPException(status_code=404, detail="Agent wallet not found")
        
    allowance, spent, is_frozen = wallet
    
    # Rule 1: Check if wallet is frozen
    if is_frozen:
        conn.close()
        return {"status": "BLOCKED", "reason": "Wallet is frozen due to past security flags"}
    
    # Rule 2: Allowance verification
    if (spent + amount) > allowance:
        conn.close()
        return {"status": "BLOCKED", "reason": "Allowance limit exceeded"}
    
    # Rule 3: Basic prompt-injection rule check
    suspicious_keywords = ["override", "ignore rules", "free money", "bypass"]
    if any(keyword in prompt_text.lower() for keyword in suspicious_keywords):
        cursor.execute("UPDATE wallets SET is_frozen = 1 WHERE agent_id = ?", (agent_id,))
        conn.commit()
        conn.close()
        return {"status": "BLOCKED", "reason": "Prompt-injection detected. Wallet has been frozen."}
    
    # Approve transaction
    cursor.execute("UPDATE wallets SET spent = spent + ? WHERE agent_id = ?", (amount, agent_id))
    cursor.execute("INSERT INTO transaction_logs (agent_id, amount, status, reason) VALUES (?, ?, ?, ?)",
                   (agent_id, amount, "APPROVED", "Passed all security checks"))
    conn.commit()
    conn.close()
    
    return {"status": "APPROVED", "remaining_allowance": allowance - (spent + amount)}
# Feature 4: Unfreeze Wallet (Human Override)
@app.post("/unfreeze-wallet")
def unfreeze_wallet(agent_id: str):
    conn = sqlite3.connect("sentinelpay.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT is_frozen FROM wallets WHERE agent_id = ?", (agent_id,))
    wallet = cursor.fetchone()
    
    if not wallet:
        conn.close()
        raise HTTPException(status_code=404, detail="Agent wallet not found")
        
    cursor.execute("UPDATE wallets SET is_frozen = 0 WHERE agent_id = ?", (agent_id,))
    conn.commit()
    conn.close()
    
    return {"status": "SUCCESS", "message": f"Wallet for {agent_id} has been unfrozen."}

# Feature 5: Get All Transaction Logs (For Frontend Live Feed)
@app.get("/transactions")
def get_transactions():
    conn = sqlite3.connect("sentinelpay.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, agent_id, amount, status, reason FROM transaction_logs ORDER BY id DESC")
    logs = cursor.fetchall()
    conn.close()
    
    return [
        {"id": row[0], "agent_id": row[1], "amount": row[2], "status": row[3], "reason": row[4]}
        for row in logs
    ]

# Feature 5 (cont.): Get Wallet Status (For Frontend Dashboard)
@app.get("/wallet-status/{agent_id}")
def get_wallet_status(agent_id: str):
    conn = sqlite3.connect("sentinelpay.db")
    cursor = conn.cursor()
    cursor.execute("SELECT allowance, spent, is_frozen FROM wallets WHERE agent_id = ?", (agent_id,))
    wallet = cursor.fetchone()
    conn.close()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Agent wallet not found")
        
    return {
        "agent_id": agent_id,
        "allowance": wallet[0],
        "spent": wallet[1],
        "remaining": wallet[0] - wallet[1],
        "is_frozen": bool(wallet[2])
    }