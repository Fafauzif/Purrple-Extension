#!/usr/bin/env python3
"""Tests use a fake Calendar API and no credentials or persistent profile."""
import importlib.util
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

MODULE = Path(__file__).resolve().parents[1] / 'tools' / 'calendar' / 'calendar_host.py'
SPEC = importlib.util.spec_from_file_location('calendar_host', MODULE)
host = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(host)
OPERATION = '8255524a-8b0b-4603-97ac-5dba194b085b'
SAVED = {'connection': 'connection', 'access_token': 'local-test-token'}


class CalendarTests(unittest.TestCase):
    def test_upcoming_paginates_and_keeps_date_only_fields(self):
        def response(_, url):
            q = parse_qs(urlsplit(url).query)
            self.assertEqual(q['singleEvents'], ['true'])
            self.assertEqual(q['orderBy'], ['startTime'])
            if 'pageToken' not in q:
                return {'nextPageToken': 'next', 'items': [
                    {'status': 'cancelled'}, {'summary': 'All day', 'start': {'date': '2026-11-18'}}]}
            self.assertEqual(q['pageToken'], ['next'])
            return {'items': [{'summary': '<literal>'}]}
        with patch.object(host, 'calendar_call', side_effect=response):
            result = host.upcoming(SAVED)
        self.assertEqual(result['events'][0]['start'], {'date': '2026-11-18'})
        self.assertEqual(result['events'][1]['title'], '<literal>')
        self.assertFalse(result['hasMore'])
        self.assertNotIn('access_token', result)

    def test_lost_insert_response_is_verified_without_duplicate_post(self):
        draft = {'connection': 'connection', 'operation': OPERATION, 'title': 'Focus together',
                 'start': '2026-11-18T12:00:00+07:00', 'end': '2026-11-18T12:25:00+07:00'}
        captured = []
        def response(_, url, body=None):
            if body:
                captured.append(body)
                raise host.CalendarError('Timeout', 'retry')
            self.assertTrue(url.endswith('/' + OPERATION.replace('-', '')))
            return captured[0]
        with patch.object(host, 'calendar_call', side_effect=response):
            result = host.create(SAVED, draft)
        self.assertEqual(len(captured), 1)
        self.assertEqual(result['event']['title'], 'Focus together')
        self.assertEqual(result['event']['start']['dateTime'], draft['start'])

    def test_conflict_with_a_different_event_is_not_treated_as_success(self):
        draft = {'connection': 'connection', 'operation': OPERATION, 'title': 'Plan',
                 'start': '2026-11-18T12:00:00Z', 'end': '2026-11-18T13:00:00Z'}
        replies = [host.CalendarError('Conflict', status=409), {'summary': 'Different event'}]
        with patch.object(host, 'calendar_call', side_effect=replies):
            with self.assertRaisesRegex(host.CalendarError, 'does not match'):
                host.create(SAVED, draft)
        with self.assertRaisesRegex(host.CalendarError, 'Connection changed'):
            host.create(SAVED, {**draft, 'connection': 'stale'})

    def test_disconnect_removes_local_session_when_google_is_offline(self):
        with tempfile.TemporaryDirectory() as path:
            saved = Path(path) / 'connection.json'
            saved.write_text('{"refresh_token":"local-fixture"}')
            with patch.object(host, 'SESSION', saved), patch.object(host, 'request_json', side_effect=host.CalendarError('offline')):
                self.assertEqual(host.dispatch({'operation':'disconnect'}), {'connected':False,'revoked':False})
                self.assertFalse(saved.exists())


if __name__ == '__main__':
    unittest.main()
