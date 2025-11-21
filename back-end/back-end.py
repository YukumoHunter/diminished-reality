import asyncio
import websockets
import cv2
import numpy as np
import torch
from rfdetr import RFDETRBase
from time import perf_counter
from turbojpeg import TurboJPEG, TJFLAG_FASTUPSAMPLE, TJFLAG_FASTDCT
import base64
import json
import ssl
import pathlib
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = pathlib.Path(__file__).parent / "cert"
SSL_CERT_PATH = BASE_DIR / "cert.pem"
SSL_KEY_PATH = BASE_DIR / "key.pem"

# Initialize Model
model = RFDETRBase(pretrain_weights="model/checkpoint.pth")
model.optimize_for_inference(compile=False)

jpeg = TurboJPEG()

# Create a ThreadPool for running inference without blocking the asyncio event loop
# This prevents the websocket from timing out during heavy computation
executor = ThreadPoolExecutor(max_workers=1)

# Warm up model
dummy_img = np.zeros((640, 640, 3))
for _ in range(10):
    _ = model.predict(dummy_img)

# Nutri-score convertion
# 12x A
# 7x B
# 6x C
# 4x D
# 1x E
NUTRISCORE_DICT = {
    # Haverdrink
    "haverdrink oatly": 2,  # C
    "haverdrink ah terra": 2,  # C
    "haverdrink alpro": 0,  # A
    "haverdrink ekoplaza": 4,  # E
    "haverdrink rude health": 2,  # C
    "haverdrink natrue": 2,  # C
    # Pastasaus
    "pastasaus jumbo": 0,  # A
    "pastasaus heinz": 0,  # A
    "pastasaus spagheroni": 2,  # C
    "pastasaus ah bio": 0,  # A
    "pastasaus fertilia": 3,  # D Self assigned
    "pastasaus ekoplaza": 1,  # B
    # Koffie
    "koffie douwe egberts": 1,  # B
    "koffie cafe gondoliere": 1,  # B
    "koffie kanis gunnink": 1,  # B
    "koffie perla bio": 1,  # B
    "koffie fairtrade original": 1,  # B
    "koffie ekoplaza": 3,  # D Self assigned
    # Pasta
    "pasta de cecco": 0,  # A
    "pasta rummo": 0,  # A
    "pasta ah bio": 1,  # B
    "pasta la bio idea": 3,  # D Self assigned
    "pasta la molisana": 0,  # A
    "pasta grand italia": 0,  # A
    # Pindakaas
    "pindakaas ah bio": 0,  # A
    "pindakaas whole earth": 0,  # A
    "pindakaas luna e terra": 3,  # D Self assigned
    "pindakaas calve": 0,  # A
    "pindakaas jumbo": 0,  # A
    "pindakaas skippy": 2,  # C
}


def run_inference_sync(image_bytes, request_id):
    """
    Synchronous function to handle image decoding and inference.
    This runs in a separate thread to keep the Websocket heartbeat alive.
    """
    try:
        # 1. Decode Image
        npimg = np.frombuffer(image_bytes, np.uint8)
        img = jpeg.decode(npimg, flags=TJFLAG_FASTUPSAMPLE | TJFLAG_FASTDCT)

        if img is None:
            return {"error": "Failed to decode image"}

        # 2. Preprocess
        img_tensor = (
            torch.from_numpy(img)
            .permute((2, 0, 1))
            .contiguous()
            .to(torch.float32)
            .div(255)
        )

        # 3. Inference
        start = perf_counter()
        results = model.predict(img_tensor, threshold=0.3)
        end = perf_counter()

        inference_time = (end - start) * 1000
        print(f"inference took {inference_time:.2f}ms")

        # 4. Format Results
        detections = []
        for xyxy, mask, confidence, class_id, tracker_id, data in results:
            confidence = float(confidence)
            class_name = model.model.class_names[class_id]
            x1, y1, x2, y2 = map(float, xyxy)

            detections.append(
                {
                    "class": class_name,
                    "confidence": confidence,
                    "nutri_score": NUTRISCORE_DICT.get(class_name, "Unknown"),
                    "bbox": [x1, y1, x2 - x1, y2 - y1],
                }
            )

        return {"detections": detections, "requestId": request_id}

    except Exception as e:
        print(f"Inference Error: {e}")
        return {"error": str(e)}


async def inference_worker(websocket, queue):
    """
    Consumer: Pulls frames from queue and runs inference.
    """
    while True:
        # Get the next frame from the queue
        data_str = await queue.get()

        try:
            data = json.loads(data_str)
            request_id = data.get("requestId")
            image_data = data["image"].split(",")[1]
            image_bytes = base64.b64decode(image_data)

            # Run inference in a separate thread so we don't block the event loop
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                executor, run_inference_sync, image_bytes, request_id
            )

            # Send result back
            await websocket.send(json.dumps(response))

        except Exception as e:
            print(f"Worker Error: {e}")
        finally:
            queue.task_done()


async def detect_frame_handler(websocket, path):
    """
    Producer: Receives frames and puts them in a size-limited queue.
    """
    # Maxsize=1 ensures we only keep the LATEST frame.
    # If the GPU is busy, we drop incoming frames.
    queue = asyncio.Queue(maxsize=1)

    # Start the consumer task
    worker_task = asyncio.create_task(inference_worker(websocket, queue))

    try:
        async for message in websocket:
            if queue.full():
                # BUFFER STRATEGY: Drop the oldest frame (LIFO)
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass

            # Put the new frame in the queue
            await queue.put(message)

    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    finally:
        # Clean up the worker when connection closes
        worker_task.cancel()


async def main():
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)

    try:
        ssl_context.load_cert_chain(SSL_CERT_PATH, SSL_KEY_PATH)
    except Exception as e:
        print(f"Error loading certificates: {e}")
        return

    print(f"Starting secure server (WSS) on 0.0.0.0:5174...")

    async with websockets.serve(detect_frame_handler, "0.0.0.0", 5174, ssl=ssl_context):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
