import cv2
import mediapipe as mp
import time
from config import settings

class EyeTracker:
    def __init__(self):
        # We must use refine_landmarks=True to get iris points
        self.face_mesh = mp.solutions.face_mesh.FaceMesh(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            refine_landmarks=True
        )
        self.calibrated = False
        self.calibration_frames = 0
        
        self.h_ratio_sum = 0.0
        self.v_ratio_sum = 0.0
        
        self.baseline_h_ratio = 0.0
        self.baseline_v_ratio = 0.0
        
        self.smoothed_h = None
        self.smoothed_v = None
        self.alpha = 0.15 # معدل تنعيم قوي لمنع التشتت

    def reset(self):
        self.calibrated = False
        self.calibration_frames = 0
        self.h_ratio_sum = 0.0
        self.v_ratio_sum = 0.0
        self.baseline_h_ratio = 0.0
        self.baseline_v_ratio = 0.0
        self.smoothed_h = None
        self.smoothed_v = None

    def get_eye_direction(self, frame):
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                landmarks = face_landmarks.landmark
                
                # Right Eye (Viewer's left)
                # Outer: 33, Inner: 133, Top: 159, Bottom: 145, Iris center: 468
                r_inner = landmarks[133]
                r_outer = landmarks[33]
                r_top = landmarks[159]
                r_bottom = landmarks[145]
                r_iris = landmarks[468]

                # Left Eye (Viewer's right)
                # Inner: 362, Outer: 263, Top: 386, Bottom: 374, Iris center: 473
                l_inner = landmarks[362]
                l_outer = landmarks[263]
                l_top = landmarks[386]
                l_bottom = landmarks[374]
                l_iris = landmarks[473]

                # --- Horizontal Ratio (Average of both eyes) ---
                # Right eye width (inner x > outer x)
                r_width = r_inner.x - r_outer.x
                r_h_offset = r_iris.x - r_outer.x
                r_h_ratio = r_h_offset / r_width if r_width != 0 else 0.5
                
                # Left eye width (outer x > inner x)
                l_width = l_outer.x - l_inner.x
                l_h_offset = l_iris.x - l_inner.x
                l_h_ratio = l_h_offset / l_width if l_width != 0 else 0.5
                
                # Notice left eye geometry is mirrored, so we match their logical movement
                h_ratio = (r_h_ratio + l_h_ratio) / 2.0

                # --- Vertical Ratio (Average of both eyes) ---
                r_height = r_bottom.y - r_top.y
                r_v_offset = r_iris.y - r_top.y
                r_v_ratio = r_v_offset / r_height if r_height != 0 else 0.5
                
                l_height = l_bottom.y - l_top.y
                l_v_offset = l_iris.y - l_top.y
                l_v_ratio = l_v_offset / l_height if l_height != 0 else 0.5
                
                v_ratio = (r_v_ratio + l_v_ratio) / 2.0

                # تطبيق نظام التنعيم الذكي (Moving Average)
                if self.smoothed_h is None:
                    self.smoothed_h = h_ratio
                    self.smoothed_v = v_ratio
                else:
                    self.smoothed_h = self.smoothed_h * (1 - self.alpha) + h_ratio * self.alpha
                    self.smoothed_v = self.smoothed_v * (1 - self.alpha) + v_ratio * self.alpha

                # Auto Calibration logic for longer baseline 
                if not self.calibrated:
                    self.h_ratio_sum += self.smoothed_h
                    self.v_ratio_sum += self.smoothed_v
                    self.calibration_frames += 1
                    if self.calibration_frames >= 10:
                        self.baseline_h_ratio = self.h_ratio_sum / 10.0
                        self.baseline_v_ratio = self.v_ratio_sum / 10.0
                        self.calibrated = True
                    return "Calibrating..."

                diff_h = self.smoothed_h - self.baseline_h_ratio
                diff_v = self.smoothed_v - self.baseline_v_ratio

                # thresholds usually around 0.05 to 0.08 difference for a clear glance away
                if diff_h < -settings.EYE_H_THRESHOLD:
                    direction = "Looking Right"
                elif diff_h > settings.EYE_H_THRESHOLD:
                    direction = "Looking Left"
                elif diff_v < -settings.EYE_V_THRESHOLD:
                    direction = "Looking Up"
                elif diff_v > settings.EYE_V_THRESHOLD:
                    direction = "Looking Down"
                else:
                    direction = "Forward"

                return direction

        return "No Face"
