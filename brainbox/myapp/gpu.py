import os

# Check if the model folder exists
model_path = "models/all-MiniLM-L6-v2"

if os.path.exists(model_path):
    print("✅ Model is already downloaded locally!")
else:
    print("❌ Model not found. Need to download.")
