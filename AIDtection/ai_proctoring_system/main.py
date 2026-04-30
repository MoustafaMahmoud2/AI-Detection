import cv2
import time
from modules.face_detection import FaceDetector
from modules.head_pose import HeadPoseEstimator
from modules.head_pose_logic import HeadPoseLogic
from modules.eye_tracking import EyeTracker
from modules.eye_tracking_logic import EyeTrackingLogic
from modules.speech_detection import SpeechDetector
from modules.speech_logic import SpeechLogic
from modules.object_detection import ObjectDetector
from config import settings

def main():
    cap = cv2.VideoCapture(settings.CAMERA_INDEX)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, settings.FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, settings.FRAME_HEIGHT)

    # Modules
    face_detector = FaceDetector(settings.FACE_CONFIDENCE)
    pose_estimator = HeadPoseEstimator()
    pose_logic = HeadPoseLogic()
    eye_tracker = EyeTracker()
    eye_logic = EyeTrackingLogic()
    speech_detector = SpeechDetector()
    speech_logic = SpeechLogic()
    object_detector = ObjectDetector()
    
    previous_warning = "Normal"

    while True:
        ret, frame = cap.read()
        if not ret:
            break

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
        # SPEECH DETECTION
        # =========================
        is_speaking = speech_detector.get_speech_status()
        speech_cheating = speech_logic.update(is_speaking)

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

            # عد الأشخاص بحد أدنى للثقة عشان ميعتبرش الأشياء العادية أشخاص
            if label == "person" and conf > 0.65:
                person_count += 1
                color_box = (255, 0, 0)  # Blue
            elif label == "person":
                continue # تجاهل الأشياء الوهمية اللي ثقتها ضعيفة

            # تحديد اللون لباقي الأشياء
            elif label == "cell phone" or label == "laptop":
                phone_detected = True
                color_box = (0, 0, 255)  # Red

            else:
                color_box = (0, 255, 0)

            # رسم المستطيل
            cv2.rectangle(frame, (x1, y1), (x2, y2), color_box, 2)

            # كتابة اسم object
            cv2.putText(frame, f"{label} {conf:.2f}", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color_box, 2)

        if person_count > 1:
            multiple_persons_yolo = True

        # =========================
        # ALERT SYSTEM
        # =========================
        if len(faces) == 0:
            warning = "No Person Detected"
            color = (0, 0, 255)

        elif len(faces) > settings.MAX_FACES_ALLOWED:
            warning = "Multiple People Detected"
            color = (0, 0, 255)

        elif phone_detected:
            warning = "Phone Detected"
            color = (0, 0, 255)

        elif multiple_persons_yolo:
            warning = "Multiple Persons (YOLO)"
            color = (0, 0, 255)

        elif cheating:
            warning = "Cheating: Looking Away"
            color = (0, 0, 255)

        elif eye_cheating:
            warning = "Cheating: Eye Tracking"
            color = (0, 0, 255)

        elif speech_cheating:
            warning = "Speech Detection"
            color = (0, 0, 255)

        else:
            warning = "Normal"
            color = (0, 255, 0)

        # =========================
        # UI DISPLAY
        # =========================
        cv2.rectangle(frame, (10, 10), (600, 160), (0, 0, 0), -1)

        cv2.putText(frame, warning, (20, 45),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

        cv2.putText(frame, f"Head Dir: {direction}", (20, 85),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        cv2.putText(frame, f"Eye Dir: {eye_dir}", (300, 85),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        cv2.putText(frame, f"Faces: {len(faces)}", (500, 85),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # الصوت
        speech_text = "Yes" if is_speaking else "No"
        cv2.putText(frame, f"Voice: {speech_text}", (500, 125),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0) if not is_speaking else (0, 0, 255), 2)

        # الوقت للرأس
        if pose_logic.look_start_time:
            elapsed = time.time() - pose_logic.look_start_time
        else:
            elapsed = 0

        cv2.putText(frame, f"Head Time: {round(elapsed,1)}s", (20, 125),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

        # الوقت للعين
        if eye_logic.look_start_time:
            eye_elapsed = time.time() - eye_logic.look_start_time
        else:
            eye_elapsed = 0

        cv2.putText(frame, f"Eye Time: {round(eye_elapsed,1)}s", (300, 125),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

        # =========================
        # SCREENSHOT SYSTEM
        # =========================
        # if warning != "Normal" and warning != "Speech Detection" and warning != previous_warning:
        #     import os
        #     if not os.path.exists("evidence"):
        #         os.makedirs("evidence")
        #     timestamp = time.strftime("%Y%m%d-%H%M%S")
        #     filename = f"evidence/cheat_{timestamp}.jpg"
        #     capture_frame = frame.copy()
        #     cv2.imwrite(filename, capture_frame)
            
        previous_warning = warning

        cv2.imshow("AI Proctoring System", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    speech_detector.stop()
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
