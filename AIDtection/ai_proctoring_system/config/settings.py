# =========================
# GENERAL SETTINGS
# =========================

CAMERA_INDEX = 0
FRAME_WIDTH = 640
FRAME_HEIGHT = 480

# =========================
# FACE DETECTION
# =========================

FACE_CONFIDENCE = 0.70
MAX_FACES_ALLOWED = 1

# =========================
# HEAD POSE (LOOKING)
# =========================

LOOK_LEFT_THRESHOLD = -20
LOOK_RIGHT_THRESHOLD = 20
LOOK_UP_THRESHOLD = 20
LOOK_DOWN_THRESHOLD = -20

MAX_LOOK_AWAY_TIME = 0.5  # seconds

# =========================
# EYE TRACKING (LOOKING)
# =========================

EYE_LOOK_AWAY_TIME = 2.0 
EYE_H_THRESHOLD = 0.12 
EYE_V_THRESHOLD = 0.10 

# =========================
# SPEECH DETECTION
# =========================

SPEECH_TIME_LIMIT = 2.0 # seconds
SPEECH_CONFIDENCE_THRESHOLD = 0.5 # model certainty for human voice

# =========================
# OBJECT DETECTION 
# =========================

DETECT_PHONE = True
DETECT_PERSON = True

PHONE_CLASS_NAME = "cell phone"
PERSON_CLASS_NAME = "person"

# =========================
# ALERT SYSTEM
# =========================

ENABLE_ALERTS = True
SHOW_WARNINGS = True

# =========================
# TIMERS
# =========================

NO_FACE_TIME_LIMIT = 5  
MULTIPLE_FACES_TIME_LIMIT = 3