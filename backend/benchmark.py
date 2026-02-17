import asyncio
import os
import sys
import json
import logging
import time
from dotenv import load_dotenv
from service import VerificationService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

async def run_benchmark(pdf_path: str):
    print(f"🚀 Starting benchmark for: {pdf_path}")
    
    if not os.path.exists(pdf_path):
        print(f"❌ File not found: {pdf_path}")
        return

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()
    
    start_time = time.time()
    
    print("Step 1: Running E2E Verification (Check logs for Cache hits)...")
    async for event in VerificationService.run_verification(file_bytes, os.path.basename(pdf_path)):
        if event["event"] == "complete":
            data = json.loads(event["data"])
            print("\n" + "="*50)
            print(f"📊 FINAL SCORE: {data.get('overall_score')}/100")
            print("="*50)
        elif event["event"] == "error":
            print(f"❌ Error: {event['data']}")

    print(f"⏱️ Total verification took {time.time() - start_time:.2f}s")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python benchmark.py <path_to_resume_pdf>")
        sys.exit(1)
    
    asyncio.run(run_benchmark(sys.argv[1]))
