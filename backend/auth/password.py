import bcrypt

def hash_password(password: str) -> str:
    """
    Hashes a password using bcrypt.
    Truncates to 72 bytes to adhere to bcrypt specification.
    """
    if not password:
        return ""
    pwd_bytes = password[:72].encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against a bcrypt hash.
    Safely handles empty inputs and malformed hashes without crashing.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        pwd_bytes = plain_password[:72].encode("utf-8")
        hash_bytes = hashed_password.strip().encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False
