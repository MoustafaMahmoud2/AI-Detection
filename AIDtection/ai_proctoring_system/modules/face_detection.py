import cv2
import mediapipe as mp

class FaceDetector:
    def __init__(self, confidence=0.5):
        self.mp_face = mp.solutions.face_detection
        self.detector = self.mp_face.FaceDetection(min_detection_confidence=confidence)

    def detect_faces(self, frame):
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.detector.process(rgb_frame)

        faces = []

        if results.detections:
            for detection in results.detections:
                bbox = detection.location_data.relative_bounding_box
                h, w, _ = frame.shape

                x = int(bbox.xmin * w)
                y = int(bbox.ymin * h)
                width = int(bbox.width * w)
                height = int(bbox.height * h)
                # Discard too small detections that are likely wall decorations or ghosts 
                # Dropped to 45px to support wide-angle webcams and students leaning backward comfortably.
                if width > 45 and height > 45:
                    faces.append((x, y, width, height))

        return faces