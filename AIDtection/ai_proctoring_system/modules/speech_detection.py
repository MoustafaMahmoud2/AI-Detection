import webrtcvad
import time
import struct
import math
from config import settings

def get_rms(chunk):
    count = len(chunk) // 2
    if count == 0: return 0
    fmt = f"<{count}h"
    samples = struct.unpack(fmt, chunk)
    sum_squares = sum((s ** 2) for s in samples)
    return math.sqrt(sum_squares / count)

class SpeechDetector:
    def __init__(self):
        self.vad = webrtcvad.Vad(3) # Mode 3 is the most aggressive, strictly filters background noise/clicks and only detects human speech
        self.RATE = 16000
        self.is_human_speaking = False
        self.last_speech_time = 0

    def reset(self):
        self.is_human_speaking = False
        self.last_speech_time = 0

    def process_audio_chunk(self, audio_bytes):
        try:
            # Webrtcvad expects frames of 10, 20, or 30 ms.
            # At 16000 Hz, 30 ms is 480 samples = 960 bytes (16-bit PCM).
            chunk_size = 960
            
            speech_detected = False
            for i in range(0, len(audio_bytes), chunk_size):
                chunk = audio_bytes[i:i+chunk_size]
                if len(chunk) == chunk_size:
                    if self.vad.is_speech(chunk, self.RATE):
                        rms = get_rms(chunk)
                        if rms > 150:
                            speech_detected = True
                            break

            if speech_detected:
                self.last_speech_time = time.time()
                
            # Restore 1.0s decay. Humans pause for breath; shorter decays break continuous speech and prevent 2-second triggers.
            self.is_human_speaking = (time.time() - self.last_speech_time) < 1.0
            
            return self.is_human_speaking
        except Exception as e:
            print(f"Error processing audio chunk: {e}")
            return self.is_human_speaking

    def get_speech_status(self):
        self.is_human_speaking = (time.time() - self.last_speech_time) < 1.0
        return self.is_human_speaking
