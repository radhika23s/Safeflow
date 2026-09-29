import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-3.7-flash")
response = model.generate_content("Say 'Horizon Financial Crime AI reasonAgent is online.' in one short sentence.")
print("Gemini Response:\n", response.text)
