"""Private service boundary. Browser identities are authorized by the Node gateway."""
import hmac
import os
from fastapi import Header, HTTPException


def require_service(authorization: str = Header(default="")) -> None:
    secret = os.getenv("AI_SERVICE_API_KEY", "")
    if len(secret) < 32:
        raise HTTPException(status_code=503, detail="AI service authentication is not configured")
    expected = f"Bearer {secret}"
    if not hmac.compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Service authentication required")
