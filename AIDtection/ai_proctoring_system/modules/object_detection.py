# modules/object_detection.py

from ultralytics import YOLO

class ObjectDetector:
    def __init__(self):
        self.model = YOLO("yolov8s.pt")

    def detect(self, frame):
        # 0: person, 63: laptop (غالباً التابلت بيتقري لاب توب), 67: cell phone
        # رجعنا الحساسية لمستوى طبيعي عشان الإنذارات الكاذبة
        results = self.model(frame, conf=0.25, classes=[0, 63, 67], verbose=False)

        detections = []

        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                label = self.model.names[cls_id]
                conf = float(box.conf[0])

                if label == "person" and conf < 0.45:
                    continue
                if label == "laptop" and conf < 0.45:
                    continue
                if label == "cell phone" and conf < 0.45:
                    continue

                x1, y1, x2, y2 = map(int, box.xyxy[0])

                detections.append({
                    "label": label,
                    "confidence": conf,
                    "box": (x1, y1, x2, y2)
                })

        return detections