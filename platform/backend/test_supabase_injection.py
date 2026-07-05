import json
import urllib.request
import urllib.error
from io import BytesIO
import unittest
from unittest.mock import patch, MagicMock

import os
import sys

# Ensure backend directory is in the path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import the inject_accounts function
from inject_test_accounts import inject_accounts

class TestSupabaseAccountInjection(unittest.TestCase):
    
    @patch('inject_test_accounts.SUPABASE_URL', '')
    @patch('inject_test_accounts.SUPABASE_SERVICE_KEY', '')
    def test_inject_missing_keys(self):
        # When keys are missing in env and args, it should return False
        result = inject_accounts()
        self.assertFalse(result)

    def test_inject_invalid_url(self):
        # When URL is not HTTP/HTTPS (e.g. database connection string or blank), it should return False
        result = inject_accounts("postgresql://user:pass@localhost:5432/db", "some_key")
        self.assertFalse(result)
        
        result = inject_accounts("invalid_url", "some_key")
        self.assertFalse(result)

    @patch('urllib.request.urlopen')
    def test_inject_new_users_success(self, mock_urlopen):
        # Mock GET response (empty user list)
        get_response_data = json.dumps({"users": []}).encode('utf-8')
        mock_get_resp = MagicMock()
        mock_get_resp.__enter__.return_value = mock_get_resp
        mock_get_resp.read.return_value = get_response_data
        
        # Mock POST response (created user)
        post_response_data = json.dumps({"id": "some-uuid", "email": "temp@kncc.com"}).encode('utf-8')
        mock_post_resp = MagicMock()
        mock_post_resp.__enter__.return_value = mock_post_resp
        mock_post_resp.read.return_value = post_response_data
        
        # We expect 3 total calls: 1 GET to list users, 2 POSTs to create users
        mock_urlopen.side_effect = [mock_get_resp, mock_post_resp, mock_post_resp]
        
        result = inject_accounts("https://example-supabase.co", "test-service-key")
        self.assertTrue(result)
        
        # Check that urlopen was called 3 times
        self.assertEqual(mock_urlopen.call_count, 3)
        
        # Check first call is GET to /admin/users
        first_call_args = mock_urlopen.call_args_list[0][0][0]
        self.assertEqual(first_call_args.full_url, "https://example-supabase.co/auth/v1/admin/users")
        self.assertEqual(first_call_args.get_method(), "GET")
        self.assertEqual(first_call_args.headers.get("Apikey"), "test-service-key")
        self.assertEqual(first_call_args.headers.get("Authorization"), "Bearer test-service-key")
        
        # Check second call is POST to /admin/users with admin payload
        second_call_args = mock_urlopen.call_args_list[1][0][0]
        self.assertEqual(second_call_args.get_method(), "POST")
        admin_data = json.loads(second_call_args.data.decode('utf-8'))
        self.assertEqual(admin_data["email"], "admin@kncc.com")
        self.assertEqual(admin_data["password"], "Password123!")
        self.assertTrue(admin_data["email_confirm"])
        self.assertEqual(admin_data["user_metadata"]["role"], "admin")
        self.assertEqual(admin_data["user_metadata"]["organization_name"], "KNCC")

        # Check third call is POST to /admin/users with engineer payload
        third_call_args = mock_urlopen.call_args_list[2][0][0]
        self.assertEqual(third_call_args.get_method(), "POST")
        eng_data = json.loads(third_call_args.data.decode('utf-8'))
        self.assertEqual(eng_data["email"], "engineer@kncc.com")
        self.assertEqual(eng_data["user_metadata"]["role"], "engineer")

    @patch('urllib.request.urlopen')
    def test_inject_existing_users(self, mock_urlopen):
        # Mock GET response containing both users
        get_response_data = json.dumps({
            "users": [
                {"email": "admin@kncc.com", "id": "1"},
                {"email": "engineer@kncc.com", "id": "2"}
            ]
        }).encode('utf-8')
        mock_get_resp = MagicMock()
        mock_get_resp.__enter__.return_value = mock_get_resp
        mock_get_resp.read.return_value = get_response_data
        
        mock_urlopen.side_effect = [mock_get_resp]
        
        result = inject_accounts("https://example-supabase.co", "test-service-key")
        self.assertTrue(result)
        
        # Since both users exist, we should only call GET once, and 0 POSTs.
        self.assertEqual(mock_urlopen.call_count, 1)

    @patch('urllib.request.urlopen')
    def test_inject_partial_existing_users(self, mock_urlopen):
        # Mock GET response containing only admin
        get_response_data = json.dumps({
            "users": [
                {"email": "admin@kncc.com", "id": "1"}
            ]
        }).encode('utf-8')
        mock_get_resp = MagicMock()
        mock_get_resp.__enter__.return_value = mock_get_resp
        mock_get_resp.read.return_value = get_response_data
        
        # Mock POST response for engineer creation
        post_response_data = json.dumps({"id": "2", "email": "engineer@kncc.com"}).encode('utf-8')
        mock_post_resp = MagicMock()
        mock_post_resp.__enter__.return_value = mock_post_resp
        mock_post_resp.read.return_value = post_response_data
        
        mock_urlopen.side_effect = [mock_get_resp, mock_post_resp]
        
        result = inject_accounts("https://example-supabase.co", "test-service-key")
        self.assertTrue(result)
        
        # Expect 2 calls: 1 GET, 1 POST (for engineer)
        self.assertEqual(mock_urlopen.call_count, 2)
        
        # Verify the POST data is for engineer
        post_call_args = mock_urlopen.call_args_list[1][0][0]
        data = json.loads(post_call_args.data.decode('utf-8'))
        self.assertEqual(data["email"], "engineer@kncc.com")

    @patch('urllib.request.urlopen')
    def test_inject_user_already_exists_handled(self, mock_urlopen):
        # Mock GET response (empty list)
        get_response_data = json.dumps({"users": []}).encode('utf-8')
        mock_get_resp = MagicMock()
        mock_get_resp.__enter__.return_value = mock_get_resp
        mock_get_resp.read.return_value = get_response_data
        
        # Mock POST HTTPError 400 (User already exists)
        err_msg = json.dumps({"msg": "A user with this email address has already been registered"}).encode('utf-8')
        http_error = urllib.error.HTTPError(
            url="https://example-supabase.co/auth/v1/admin/users",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=BytesIO(err_msg)
        )
        
        # For the first user (admin), return the HTTPError. For the second (engineer), return success.
        post_response_data = json.dumps({"id": "2", "email": "engineer@kncc.com"}).encode('utf-8')
        mock_post_resp = MagicMock()
        mock_post_resp.__enter__.return_value = mock_post_resp
        mock_post_resp.read.return_value = post_response_data
        
        mock_urlopen.side_effect = [mock_get_resp, http_error, mock_post_resp]
        
        # Even though admin creation returns a 400 "already exists", the function should handle it
        # and succeed overall since the user exists and the next user succeeds.
        result = inject_accounts("https://example-supabase.co", "test-service-key")
        self.assertTrue(result)
        
        # 3 calls: 1 GET, 2 POSTs
        self.assertEqual(mock_urlopen.call_count, 3)

if __name__ == '__main__':
    unittest.main()
