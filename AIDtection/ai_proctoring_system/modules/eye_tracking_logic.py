import time
from config import settings

class EyeTrackingLogic:
    def __init__(self):
        self.look_start_time = None
        self.cheating = False

    def reset(self):
        self.look_start_time = None
        self.cheating = False

    def update(self, direction):
        # لو بيبص بعيد أو الكاميرا ملقطتش عينه
        if direction not in ["Forward", "Calibrating...", "No Face"]:
            if self.look_start_time is None:
                self.look_start_time = time.time()

            elapsed = time.time() - self.look_start_time

            if elapsed >= settings.EYE_LOOK_AWAY_TIME:
                self.cheating = True
            else:
                self.cheating = False

        # لو رجع يبص قدام
        else:
            self.look_start_time = None
            self.cheating = False

        return self.cheating
