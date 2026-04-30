import cv2
import time
import base64
import numpy as np
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from modules.face_detection import FaceDetector
from modules.head_pose import HeadPoseEstimator
from modules.head_pose_logic import HeadPoseLogic
from modules.eye_tracking import EyeTracker
from modules.eye_tracking_logic import EyeTrackingLogic
from modules.speech_detection import SpeechDetector
from modules.speech_logic import SpeechLogic
from modules.object_detection import ObjectDetector
from config import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate models globally since it's a local app essentially
face_detector = FaceDetector(settings.FACE_CONFIDENCE)
pose_estimator = HeadPoseEstimator()
pose_logic = HeadPoseLogic()
eye_tracker = EyeTracker()
eye_logic = EyeTrackingLogic()
speech_detector = SpeechDetector()
speech_logic = SpeechLogic()
object_detector = ObjectDetector()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket Connection Accepted")
    
    # Reset all trackers and logic for the new user session
    pose_estimator.reset()
    eye_tracker.reset()
    pose_logic.reset()
    eye_logic.reset()
    speech_detector.reset()
    speech_logic.reset()
    try:
        while True:
            try:
                message = await websocket.receive()
                
                if "bytes" in message:
                    audio_bytes = message["bytes"]
                    is_speaking = speech_detector.process_audio_chunk(audio_bytes)
                    speech_logic.update(is_speaking)
                    
                    if speech_logic.cheating:
                        await websocket.send_text(json.dumps({"warning": "Speech Detection"}))
                    continue

                if "text" not in message or message["text"] is None:
                    continue
                    
                data = message["text"]
                
                # Decode the base64 string
                if data.startswith('data:image'):
                    data = data.split(',')[1]
                else:
                    continue # Ignore invalid websocket payloads
                
                # Fix base64 padding if necessary
                missing_padding = len(data) % 4
                if missing_padding:
                    data += '=' * (4 - missing_padding)
                    
                img_bytes = base64.b64decode(data)
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is None:
                    continue

                # =========================
                # FACE DETECTION
                # =========================
                faces = face_detector.detect_faces(frame)
                for (x, y, w, h) in faces:
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)

                # =========================
                # HEAD POSE
                # =========================
                direction, angle = pose_estimator.get_pose(frame)
                cheating = pose_logic.update(direction)

                # =========================
                # EYE TRACKING
                # =========================
                eye_dir = eye_tracker.get_eye_direction(frame)
                eye_cheating = eye_logic.update(eye_dir)

                # =========================
                # SPEECH DETECTION (Backend WebRTC VAD)
                # =========================
                # state is updated asynchronously by binary audio chunks above
                speech_cheating = speech_logic.cheating

                # =========================
                # YOLO OBJECT DETECTION
                # =========================
                detections = object_detector.detect(frame)

                phone_detected = False
                multiple_persons_yolo = False
                person_count = 0

                for det in detections:
                    label = det["label"]
                    conf = det["confidence"]
                    x1, y1, x2, y2 = det["box"]

                    if label == "person" and conf > 0.85:
                        person_count += 1
                        color_box = (255, 0, 0)
                    elif label == "person":
                        continue

                    elif label == "cell phone" or label == "laptop":
                        phone_detected = True
                        color_box = (0, 0, 255)
                    else:
                        color_box = (0, 255, 0)

                    cv2.rectangle(frame, (x1, y1), (x2, y2), color_box, 2)
                    cv2.putText(frame, f"{label} {conf:.2f}", (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color_box, 2)

                # Disabled YOLO counting persons to avoid ghost bodies
                multiple_persons_yolo = False

                # =========================
                # ALERT SYSTEM
                # =========================
                warnings = []
                if len(faces) == 0:
                    warnings.append("No Person Detected")
                if len(faces) > settings.MAX_FACES_ALLOWED:
                    warnings.append("Multiple People Detected")
                if cheating:
                    warnings.append("Cheating: Looking Away")
                if phone_detected:
                    warnings.append("Phone Detected")
                if eye_cheating:
                    warnings.append("Cheating: Eye Tracking")
                if speech_cheating:
                    warnings.append("Speech Detection")

                if not warnings:
                    warnings.append("Normal")
                
                # Take the primary warning string for the visual UI overlay drawing directly on camera box feed
                warning = warnings[0] if len(warnings) > 0 else "Normal"

                # === VISUAL OVERLAY FOR USER ===
                # If cheating is detected, draw it physically on the frame!
                if warning != "Normal":
                    cv2.putText(frame, f"⚠️ {warning}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

                # Show calibration indicator so the user knows they need to sit still
                if direction == "Calibrating..." or eye_dir == "Calibrating...":
                    cv2.putText(frame, "Please sit still. Calibrating face & eyes... (3s)", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                    # Draw a guiding box in the center for them to fit their face into
                    h, w, _ = frame.shape
                    cv2.rectangle(frame, (int(w/2 - 100), int(h/2 - 150)), (int(w/2 + 100), int(h/2 + 150)), (0, 255, 255), 2)

                # Encode back to base64
                _, buffer = cv2.imencode('.jpg', frame)
                encoded_img = base64.b64encode(buffer).decode('utf-8')
                
                response_payload = {
                    "warning": warning,
                    "warnings": warnings,
                    "image": f"data:image/jpeg;base64,{encoded_img}"
                }
                
                await websocket.send_text(json.dumps(response_payload))

            except WebSocketDisconnect:
                print("WebSocket Disconnected from client")
                break
            except Exception as e:
                import traceback
                with open("error_log.txt", "a") as f:
                    f.write(traceback.format_exc() + "\n")
                print(f"Error processing single frame (Ignored): {e}")
                await asyncio.sleep(0.05)
                
    except Exception as fatal_e:
        print(f"Fatal connection error: {fatal_e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
