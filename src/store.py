import json
import os
import threading
import uuid
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
ACTIVITY_CAP = 500

_lock = threading.Lock()

def _path(name):
	return os.path.join(DATA_DIR, name)

def _read(name, default):
	try:
		with open(_path(name)) as f:
			return json.load(f)
	except (FileNotFoundError, json.JSONDecodeError):
		return default

def _write(name, data):
	os.makedirs(DATA_DIR, exist_ok=True)
	tmp = _path(f'{name}.tmp')
	with open(tmp, 'w') as f:
		json.dump(data, f, indent=1)
	os.replace(tmp, _path(name))

def log_activity(kind, text, source='agent'):
	with _lock:
		entries = _read('activity.json', [])
		entries.append({
			'ts': datetime.now().isoformat(timespec='seconds'),
			'kind': kind,
			'text': text,
			'source': source,
		})
		_write('activity.json', entries[-ACTIVITY_CAP:])

def read_activity(limit=200):
	with _lock:
		return list(reversed(_read('activity.json', [])[-limit:]))

def list_notes():
	with _lock:
		notes = _read('notes.json', [])
	return sorted(notes, key=lambda n: n['updated'], reverse=True)

def create_note(text):
	note = {
		'id': uuid.uuid4().hex[:8],
		'text': text,
		'updated': datetime.now().isoformat(timespec='seconds'),
	}
	with _lock:
		notes = _read('notes.json', [])
		notes.append(note)
		_write('notes.json', notes)
	return note

def update_note(note_id, text):
	with _lock:
		notes = _read('notes.json', [])
		for note in notes:
			if note['id'] == note_id:
				note['text'] = text
				note['updated'] = datetime.now().isoformat(timespec='seconds')
				_write('notes.json', notes)
				return note
	return None

def delete_note(note_id):
	with _lock:
		notes = _read('notes.json', [])
		_write('notes.json', [n for n in notes if n['id'] != note_id])
