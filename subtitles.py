import time
from google.cloud import speech
import os
import pyaudio
import re
import sys
import queue

# Set Google Cloud service account key file
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "neural-hour-396912-71847d90e713.json"

class MicrophoneStream:
    def __init__(self, rate, chunk):
        self._rate = rate
        self._chunk = chunk
        self._buff = queue.Queue()
        self.closed = True

    def __enter__(self):
        self._audio_interface = pyaudio.PyAudio()
        self._audio_stream = self._audio_interface.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self._rate,
            input=True,
            frames_per_buffer=self._chunk,
            stream_callback=self._fill_buffer,
        )

        self.closed = False
        return self

    def __exit__(self, type, value, traceback):
        self._audio_stream.stop_stream()
        self._audio_stream.close()
        self.closed = True
        self._buff.put(None)
        self._audio_interface.terminate()

    def _fill_buffer(self, in_data, frame_count, time_info, status_flags):
        self._buff.put(in_data)
        return None, pyaudio.paContinue

    def generator(self):
        while not self.closed:
            chunk = self._buff.get()
            if chunk is None:
                return
            data = [chunk]

            while True:
                try:
                    chunk = self._buff.get(block=False)
                    if chunk is None:
                        return
                    data.append(chunk)
                except queue.Empty:
                    break
            yield b"".join(data)

def write_to_file(s, out):
    with open(out, "a", encoding="utf-8") as f:
        f.write(s)

def write_subtitles_to_file(responses, output_file, start, stop_event):
    os.remove(output_file)

    for response in responses:
        if not response.results:
            continue
        result = response.results[0]

        if not result.alternatives:
            continue

        transcript = result.alternatives[0].transcript

        write_to_file(transcript + " --Time-- " + str(time.time() - start) + "\n", output_file)

        if stop_event.is_set():
            return
    
        if re.search(r"\b(exit|quit)\b", transcript, re.I):
            write_to_file(str(time.time() - start), output_file)
            print("Exiting...\n")
            exit(0)


def getSubs(stop_event):
    RATE = 16000
    CHUNK = 1024

    language_code = "te-IN"
    
    client = speech.SpeechClient()

    
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=RATE,
        language_code=language_code,
    )

    streaming_config = speech.StreamingRecognitionConfig(
        config=config, interim_results=False
    )

    with MicrophoneStream(RATE, CHUNK) as stream:
        audio_generator = stream.generator()
        requests = (speech.StreamingRecognizeRequest(audio_content=content) for content in audio_generator)

        responses = client.streaming_recognize(streaming_config, requests)

        write_subtitles_to_file(responses, "out//subtitles.txt", time.time(), stop_event)