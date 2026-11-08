"""Fault-inject release download failures without making network requests."""
import io
import json
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch
import urllib.error

build = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/build-core.py'))
download = build['download']
asset = 'wasm-bindgen-0.2.129-x86_64-unknown-linux-musl.tar.gz'
url = f'https://github.com/wasm-bindgen/wasm-bindgen/releases/download/0.2.129/{asset}'


def metadata(name=asset):
    return io.BytesIO(json.dumps({'assets': [{'name': name, 'id': 123}]}).encode())


class Downloads(unittest.TestCase):
    def setUp(self):
        self.sleep = patch('time.sleep').start()
        patch('sys.stderr', new_callable=io.StringIO).start()
        self.addCleanup(patch.stopall)

    def test_success_does_not_need_the_api(self):
        with patch('urllib.request.urlopen', return_value=io.BytesIO(b'archive')) as request:
            self.assertEqual(download(url), b'archive')
        self.assertEqual(request.call_count, 1)
        self.sleep.assert_not_called()

    def test_transient_failure_uses_the_exact_asset_through_the_public_api(self):
        with patch('urllib.request.urlopen', side_effect=[TimeoutError(), metadata(), io.BytesIO(b'archive')]) as request:
            self.assertEqual(download(url), b'archive')
        requests = [call.args[0] for call in request.call_args_list]
        self.assertIn('/releases/tags/0.2.129?krab_retry=', requests[1].full_url)
        self.assertIn('/releases/assets/123?krab_retry=', requests[2].full_url)
        self.assertEqual(requests[2].get_header('Accept'), 'application/octet-stream')
        self.assertTrue(all(call.kwargs['timeout'] == 30 for call in request.call_args_list))

    def test_checksum_file_has_its_own_matching_api_asset(self):
        with patch('urllib.request.urlopen', side_effect=[TimeoutError(), metadata(asset + '.sha256sum'), io.BytesIO(b'checksum')]):
            self.assertEqual(download(url + '.sha256sum'), b'checksum')

    def test_permanent_http_failure_is_not_retried(self):
        with patch('urllib.request.urlopen', side_effect=urllib.error.HTTPError(url, 404, 'missing', {}, None)) as request:
            with self.assertRaises(urllib.error.HTTPError):
                download(url)
        self.assertEqual(request.call_count, 1)
        self.sleep.assert_not_called()

    def test_missing_locked_asset_fails_instead_of_using_another_build(self):
        with patch('urllib.request.urlopen', side_effect=[TimeoutError(), metadata('another-build')]):
            with self.assertRaisesRegex(RuntimeError, 'Locked wasm-bindgen release asset is missing'):
                download(url)

    def test_repeated_failure_stays_bounded_and_reuses_api_metadata(self):
        with patch('urllib.request.urlopen', side_effect=[TimeoutError(), metadata(), TimeoutError(), TimeoutError()]) as request:
            with self.assertRaises(TimeoutError):
                download(url)
        self.assertEqual(request.call_count, 4)
        self.assertEqual(self.sleep.call_count, 2)


if __name__ == '__main__':
    unittest.main()
