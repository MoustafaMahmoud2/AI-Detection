import time
from config import settings

class HeadPoseLogic:
    def __init__(self):
        self.look_start_time = None
        self.cheating = False

    def reset(self):
        self.look_start_time = None
        self.cheating = False

    def update(self, direction):
        if direction in ["Calibrating...", "Forward", "No Face"]:
            self.look_start_time = None
            self.cheating = False
        else:
            if self.look_start_time is None:
                self.look_start_time = time.time()
                
            elapsed = time.time() - self.look_start_time
            if elapsed >= settings.MAX_LOOK_AWAY_TIME:
                self.cheating = True
                
        return self.cheating
