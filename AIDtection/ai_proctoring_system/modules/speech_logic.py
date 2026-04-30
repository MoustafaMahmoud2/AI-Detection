import time
from config import settings

class SpeechLogic:
    def __init__(self):
        self.speech_start_time = None
        self.cheating = False

    def reset(self):
        self.speech_start_time = None
        self.cheating = False

    def update(self, is_speaking):
        if is_speaking:
            if self.speech_start_time is None:
                self.speech_start_time = time.time()
                
            elapsed = time.time() - self.speech_start_time
            if elapsed >= settings.SPEECH_TIME_LIMIT:
                self.cheating = True
        else:
            self.speech_start_time = None
            self.cheating = False
            
        return self.cheating
