from cryptography.fernet import Fernet
import base64
import os
from django.conf import settings
import json

class EncryptionManager:
    
    def __init__(self):
        # Try to get the key from settings or environment variable
        key = getattr(settings, 'ENCRYPTION_KEY', os.environ.get('ENCRYPTION_KEY', None))
        
        # If no key is found, generate one (for development - in production, this should be set in settings)
        if key is None:
            # Generate a key for development use only
            # In production, this key should be stored securely and consistently
            self.key = Fernet.generate_key()
            print("WARNING: Using a generated encryption key. This should be set in settings for production.")
        else:
            # If key is provided as a string, ensure it's properly encoded
            if isinstance(key, str):
                # Ensure the key is properly base64 encoded
                try:
                    # Try to decode to ensure it's valid base64
                    base64.urlsafe_b64decode(key)
                    self.key = key.encode() if isinstance(key, str) else key
                except Exception:
                    # If not a valid base64 string, encode and hash it
                    self.key = base64.urlsafe_b64encode(key.encode())
            else:
                self.key = key
        
        self.cipher_suite = Fernet(self.key)
    
    def encrypt(self, data):
        if data is None:
            return None
            
        # If data is a dictionary or list, convert to JSON string
        if isinstance(data, (dict, list)):
            data = json.dumps(data)
            
        if isinstance(data, str):
            data = data.encode('utf-8')
            
        encrypted_data = self.cipher_suite.encrypt(data)
        return encrypted_data.decode('utf-8')
    
    def decrypt(self, encrypted_data):
        if encrypted_data is None:
            return None
            
        try:
            if isinstance(encrypted_data, str):
                encrypted_data = encrypted_data.encode('utf-8')
                
            decrypted_data = self.cipher_suite.decrypt(encrypted_data)
            decrypted_str = decrypted_data.decode('utf-8')
            
            try:
                return json.loads(decrypted_str)
            except json.JSONDecodeError:
                return decrypted_str
        except Exception as e:
            print(f"Error decrypting data: {e}")
            return encrypted_data

encryption_manager = EncryptionManager()