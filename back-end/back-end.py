from flask import Flask
import cv2
import numpy as np


import torch
from rfdetr import RFDETRBase
from time import perf_counter

from turbojpeg import TurboJPEG, TJFLAG_FASTUPSAMPLE, TJFLAG_FASTDCT

from flask_socketio import SocketIO, emit
import base64

app = Flask(__name__)
app.config["SECRET_KEY"] = "very_secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
model = RFDETRBase(pretrain_weights="model/checkpoint.pth", device="cuda")
# model.export(output_dir="model/", simplify=True, opset_version=21)
model.optimize_for_inference(compile=False)

jpeg = TurboJPEG()

# warm up model
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


@socketio.on("detect_frame")
def handle_detect_frame(data):
    try:
        # Get request ID for RTT tracking
        request_id = data.get("requestId")

        # Decode image
        image_data = data["image"].split(",")[1]
        image_bytes = base64.b64decode(image_data)

        # Convert to OpenCV format
        npimg = np.frombuffer(image_bytes, np.uint8)
        img = jpeg.decode(npimg, flags=TJFLAG_FASTUPSAMPLE | TJFLAG_FASTDCT)

        img = (
            torch.from_numpy(img)
            .permute((2, 0, 1))
            .contiguous()
            .to(torch.float32)
            .div(255)
        )

        if img is None:
            emit("detection_error", {"error": "Failed to decode image"})
            return

        start = perf_counter()
        # Run object detection model
        # results = model(img, verbose=False)
        results = model.predict(img, threshold=0.3)

        end = perf_counter()

        print(f"inference took {((end - start) * 1000):.2f}ms")

        # Process results
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
                    "bbox": [x1, y1, x2 - x1, y2 - y1],  # x, y, width, height
                }
            )

        emit("detection_result", {"detections": detections, "requestId": request_id})

    except Exception as e:
        print("detection_error", {"error": str(e)})


if __name__ == "__main__":
    print("Starting server on 0.0.0.0:8094")
    socketio.run(app, host="0.0.0.0", port=8094, debug=False)
