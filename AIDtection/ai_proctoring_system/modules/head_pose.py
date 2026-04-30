import cv2
import mediapipe as mp
from config import settings

class HeadPoseEstimator:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.calibrated = False
        self.calibration_frames = 0
        self.yaw_sum = 0.0
        self.pitch_sum = 0.0
        self.baseline_yaw = 0.0
        self.baseline_pitch = 0.0

    def reset(self):
        self.calibrated = False
        self.calibration_frames = 0
        self.yaw_sum = 0.0
        self.pitch_sum = 0.0
        self.baseline_yaw = 0.0
        self.baseline_pitch = 0.0

    def get_pose(self, frame):
        import math
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                head_right = face_landmarks.landmark[234] 
                head_left = face_landmarks.landmark[454]  
                head_top = face_landmarks.landmark[10]    
                head_bottom = face_landmarks.landmark[152] 
                
                dx = head_left.x - head_right.x
                dz = head_left.z - head_right.z
                yaw = math.degrees(math.atan2(dz, dx))
                
                dy_pitch = head_bottom.y - head_top.y
                dz_pitch = head_bottom.z - head_top.z
                pitch = math.degrees(math.atan2(dz_pitch, dy_pitch))
                
                if not self.calibrated:
                    self.yaw_sum += yaw
                    self.pitch_sum += pitch
                    self.calibration_frames += 1
                    if self.calibration_frames >= 10:
                        self.baseline_yaw = self.yaw_sum / 10.0
                        self.baseline_pitch = self.pitch_sum / 10.0
                        self.calibrated = True
                    return "Calibrating...", yaw

                diff_yaw = yaw - self.baseline_yaw
                diff_pitch = pitch - self.baseline_pitch

                if diff_yaw < -10:
                    direction = "Looking Right"
                elif diff_yaw > 10:
                    direction = "Looking Left"
                elif diff_pitch > 10:
                    direction = "Looking Down"
                elif diff_pitch < -10:
                    direction = "Looking Up"
                else:
                    direction = "Forward"

                return direction, yaw

        return "No Face", 0
