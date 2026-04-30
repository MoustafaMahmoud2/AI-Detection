# utils/camera.py
import cv2

class Camera:
    def __init__(self, camera_id, width, height):
        self.cap = cv2.VideoCapture(camera_id)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

    def get_frame(self):
        success, frame = self.cap.read()
        if not success:
            return None
        return frame

    def release(self):
        self.cap.release()
        cv2.destroyAllWindows()