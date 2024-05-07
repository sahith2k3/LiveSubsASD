import subprocess, threading, cv2, os, wave, time, pyaudio
from shutil import rmtree


class AudioRecorder:
    # Audio class based on pyAudio and Wave
    def __init__(self):
        self.open = True
        self.rate = 44100
        self.frames_per_buffer = 1024
        self.channels = 2
        self.format = pyaudio.paInt16
        self.audio = pyaudio.PyAudio()
        self.stream = self.audio.open(
            format=self.format,
            channels=self.channels,
            rate=self.rate,
            input=True,
            frames_per_buffer=self.frames_per_buffer,
        )
        self.audio_frames = []
        self.len = 0

    # Audio starts being recorded
    def record(self):
        self.stream.start_stream()
        while self.open == True:
            data = self.stream.read(self.frames_per_buffer)
            self.audio_frames.append(data)
            self.len = len(self.audio_frames)

            if self.open == False:
                break

    # Finishes the audio recording therefore the thread too
    def stop(self):
        if self.open == True:
            self.open = False
            self.stream.stop_stream()
            self.stream.close()
            self.audio.terminate()

        return self.audio_frames

    # Launches the audio recording function using a thread
    def start(self):
        audio_thread = threading.Thread(target=self.record)
        audio_thread.start()


def recordAV(proc_queue, subs_thread):
    rmtree("out", ignore_errors=True)
    os.mkdir("out//")
    os.mkdir("out//pyavi")
    os.mkdir("out//pyframes")
    os.mkdir("out//pycrop")
    os.mkdir("out//crops")
    os.mkdir("out//results")

    with open("out//subtitles.txt", "w"):
        pass

    audio_recorder = AudioRecorder()

    # Video setup
    cap = cv2.VideoCapture(0)  # Change this to your video source if needed

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    fourcc = cv2.VideoWriter_fourcc(*"XVID")
    out = cv2.VideoWriter("out//output.avi", fourcc, 30, (1280, 720))
    vind = 0

    tmpout = cv2.VideoWriter(f"out//crops//output{vind}.avi", fourcc, 30, (1280, 720))

    audio_frames = []
    video_frames = []

    cvstart = False
    frame_index = 0
    audio_index = 0
    af = 0

    cap_count = 0
    while True:
        # Record video
        ret, frame = cap.read()

        if not cvstart:
            start_time = time.time()
            subs_thread.start()
            audio_recorder.start()
            cvstart = True

        if not ret:
            break

        # cap_count += 1
        # if cap_count % 5 == 0:
        #     continue

        video_frames.append(frame)

        # Write video frames
        out.write(frame)
        tmpout.write(frame)

        # frame_filename = os.path.join('out', 'pyframes', f'{str(frame_index).rjust(6, "0")}.jpg')
        # cv2.imwrite(frame_filename, frame)

        frame_index += 1
        cv2.imshow("frame", frame)

        if time.time() - start_time > 2:
            x = audio_recorder.audio_frames
            yield frame_index, len(x)

            audio_out = wave.open(f"out//crops//audio_output{audio_index}.wav", "wb")
            audio_out.setnchannels(2)
            audio_out.setsampwidth(
                audio_recorder.audio.get_sample_size(pyaudio.paInt16)
            )
            audio_out.setframerate(44100)
            audio_out.writeframes(b"".join(x[af:]))
            af = len(x)
            audio_out.close()

            tmpout.release()

            ################################
            proc_queue.put(vind)

            vind += 1
            audio_index += 1
            tmpout = cv2.VideoWriter(
                f"out//crops//output{vind}.avi", fourcc, 30, (1280, 720)
            )

            start_time = time.time()

        # Break on a key press (e.g., 'q')
        if cv2.waitKey(1) & 0xFF == ord("q"):
            audio_frames = audio_recorder.stop()
            proc_queue.put(None)
            break

    # Clean up
    tmpout.release()
    out.release()
    cap.release()
    cv2.destroyWindow("frame")

    # Save audio to a WAV file
    audio_out = wave.open("out//audio_output.wav", "wb")
    audio_out.setnchannels(2)
    audio_out.setsampwidth(audio_recorder.audio.get_sample_size(pyaudio.paInt16))
    audio_out.setframerate(44100)
    audio_out.writeframes(b"".join(audio_frames))
    audio_out.close()

    # merge audio and video
    command = "ffmpeg -y -i out//output.avi -i out//audio_output.wav -c:v copy -c:a copy out//AVstream.avi -loglevel panic"  # Combine audio and video file
    subprocess.call(command, shell=True, stdout=None)
