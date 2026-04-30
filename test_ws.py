import asyncio
import websockets
import base64
import json
import cv2
import numpy as np

async def test():
    try:
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        _, buf = cv2.imencode('.jpg', frame)
        b64 = base64.b64encode(buf).decode()
        
        async with websockets.connect('ws://127.0.0.1:8000/ws') as ws:
            await ws.send('data:image/jpeg;base64,' + b64)
            msg = await ws.recv()
            data = json.loads(msg)
            print('Warning:', data.get('warning'))
            print('Image received:', bool(data.get('image')))
    except Exception as e:
        print(f"Test Failed: {e}")

asyncio.run(test())
