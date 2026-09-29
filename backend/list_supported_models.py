import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

print("Listing all models and supported generation methods:")
for m in genai.list_models():
    if "generateContent" in m.supported_generation_methods:
        print(f"Model: {m.name} | Methods: {m.supported_generation_methods}")
