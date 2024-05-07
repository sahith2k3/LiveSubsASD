import queue, threading, warnings
from capture import recordAV
from threads import crop_shot, frame2facebboxs, proc_video, track_shot, visualization
from subtitles import getSubs

warnings.filterwarnings("ignore", category=UserWarning)
def prPurple(skk): print("\033[95m {}\033[00m" .format(skk))
def prCyan(skk): print("\033[96m {}\033[00m" .format(skk))


faces, tracks = [], []
frames = queue.Queue()
proc_queue = queue.Queue()
facequeue = queue.Queue()
cropqueue = queue.Queue()
visua_queue = queue.Queue()

ts_proc = threading.Thread(target=proc_video, args=(proc_queue, frames))
ts_proc.start()

faceThread = threading.Thread(target=frame2facebboxs, args=(frames, faces, facequeue))
faceThread.start()

trackthread = threading.Thread(target=track_shot, args=(facequeue, tracks, cropqueue))
trackthread.start()

cropthread = threading.Thread(target=crop_shot , args=(cropqueue, visua_queue))
cropthread.start()

visua_thread = threading.Thread(target=visualization, args=(visua_queue, ))
visua_thread.start()                               

stop_event = threading.Event()
subs_thread = threading.Thread(target=getSubs, args=(stop_event, ))

for l, v in recordAV(proc_queue, subs_thread):
    prCyan("\nYielded VA frames: " + str(l) + ", " + str(v))


ts_proc.join()

frames.put(None)
faceThread.join()

facequeue.put(None)
trackthread.join()

cropqueue.put((None, None))
cropthread.join()

visua_queue.put((None, None, None))
visua_thread.join()

stop_event.set()