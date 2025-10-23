from flask import Flask, request, jsonify
import cv2
import numpy as np
from ultralytics import YOLO
from flask_socketio import SocketIO, emit
import base64


app = Flask(__name__)
app.config['SECRET_KEY'] = 'very_secret'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
model = YOLO("yolov11l_640px.pt")
model.to("cuda")


# Nutri-score convertion
# 12x A
# 7x B
# 6x C
# 4x D
# 1x E
NUTRISCORE_DICT = {
    # Haverdrink
    "haverdrink oatly": 2,          # C
    "haverdrink ah terra": 2,       # C
    "haverdrink alpro": 0,          # A
    "haverdrink ekoplaza": 4,       # E
    "haverdrink rude health": 2,    # C
    "haverdrink natrue": 2,         # C

    # Pastasaus
    "pastasaus jumbo": 0,           # A
    "pastasaus heinz": 0,           # A
    "pastasaus spagheroni": 2,      # C
    "pastasaus ah bio": 0,          # A
    "pastasaus fertilia": 3,        # D Self assigned
    "pastasaus ekoplaza": 1,        # B

    # Koffie
    "koffie douwe egberts": 1,      # B
    "koffie cafe gondoliere": 1,    # B
    "koffie kanis gunnink": 1,      # B
    "koffie perla bio": 1,          # B
    "koffie fairtrade original": 1, # B
    "koffie ekoplaza": 3,           # D Self assigned

    # Pasta
    "pasta de cecco": 0,            # A
    "pasta rummo": 0,               # A
    "pasta ah bio": 1,              # B
    "pasta la bio idea": 3,         # D Self assigned
    "pasta la molisana": 0,         # A
    "pasta grand italia": 0,        # A

    # Pindakaas
    "pindakaas ah bio": 0,          # A
    "pindakaas whole earth": 0,     # A
    "pindakaas luna e terra": 3,    # D Self assigned
    "pindakaas calve": 0,           # A
    "pindakaas jumbo": 0,           # A
    "pindakaas skippy": 2,          # C
}


@socketio.on('detect_frame')
def handle_detect_frame(data):
    try:
        # Get request ID for RTT tracking
        request_id = data.get('requestId')

        # Decode image
        image_data = data['image'].split(',')[1]
        image_bytes = base64.b64decode(image_data)

        # Convert to OpenCV format
        npimg = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if img is None:
            emit('detection_error', {'error': 'Failed to decode image'})
            return

        # Run object detection model
        results = model(img, verbose=False)

        # Process results
        detections = []
        for result in results:
            for box in result.boxes:
                class_id = int(box.cls)
                class_name = model.names[class_id]
                confidence = float(box.conf)
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                detections.append({
                    "class": class_name,
                    "confidence": confidence,
                    "nutri_score": NUTRISCORE_DICT.get(class_name, "Unknown"),
                    "bbox": [x1, y1, x2 - x1, y2 - y1]  # x, y, width, height
                })

        emit('detection_result', {
            'detections': detections,
            'requestId': request_id
        })

    except Exception as e:
        emit('detection_error', {'error': str(e)})

if __name__ == '__main__':
    print("Starting server on 0.0.0.0:8094")
    socketio.run(app, host='0.0.0.0', port=8094, debug=False)
