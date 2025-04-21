import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime
import pytz
import numpy as np
from myapp.messages import add_message

class TestAddMessage(unittest.TestCase):
    @patch('myapp.messages.get_remote_embedding')
    @patch('myapp.messages.encryption_manager.encrypt')
    @patch('myapp.messages.db')
    @patch('myapp.messages.faiss_index')
    def test_add_text_message(self, mock_faiss_index, mock_db, mock_encrypt, mock_get_embedding):
        # Setup mocks
        mock_get_embedding.return_value = [0.1, 0.2, 0.3, 0.4]
        mock_encrypt.return_value = "encrypted_content"
        
        # Mock Firestore document reference and its methods
        mock_doc_ref = MagicMock()
        mock_doc_id = MagicMock()
        mock_doc_id.id = "test_message_id"
        mock_doc_ref.__getitem__.return_value = mock_doc_ref
        mock_doc_ref.__getitem__.return_value = mock_doc_id
        mock_db.collection.return_value.add.return_value = mock_doc_ref
        
        # Call the function
        result = add_message(
            role="student",
            room_id="test_room",
            sender="test_user",
            content="Hello, this is a test message"
        )
        
        # Assertions
        self.assertEqual(result, "test_message_id")
        mock_get_embedding.assert_called_once_with("Hello, this is a test message")
        mock_encrypt.assert_called_once_with("Hello, this is a test message")
        mock_db.collection.assert_called_once_with('hub_messages')
        mock_faiss_index.add.assert_called_once()
        
        # Check if the correct data was passed to Firestore
        call_args = mock_db.collection.return_value.add.call_args[0][0]
        self.assertEqual(call_args['role'], "student")
        self.assertEqual(call_args['room_id'], "test_room")
        self.assertEqual(call_args['sender'], "test_user")
        self.assertEqual(call_args['content'], "encrypted_content")
        self.assertEqual(call_args['message_type'], "text")
        self.assertEqual(call_args['embedding'], [0.1, 0.2, 0.3, 0.4])
        
    @patch('myapp.messages.get_remote_embedding')
    @patch('myapp.messages.encryption_manager.encrypt')
    @patch('myapp.messages.db')
    @patch('myapp.messages.faiss_index')
    def test_add_file_message(self, mock_faiss_index, mock_db, mock_encrypt, mock_get_embedding):
        # Setup mocks
        mock_get_embedding.return_value = [0.1, 0.2, 0.3, 0.4]
        mock_encrypt.return_value = "encrypted_content"
        
        # Mock Firestore document reference
        mock_doc_ref = MagicMock()
        mock_doc_id = MagicMock()
        mock_doc_id.id = "test_file_id"
        mock_doc_ref.__getitem__.return_value = mock_doc_ref
        mock_doc_ref.__getitem__.return_value = mock_doc_id
        mock_db.collection.return_value.add.return_value = mock_doc_ref
        
        # Call the function
        result = add_message(
            role="teacher",
            room_id="test_room",
            sender="test_user",
            content="File description",
            message_type="file",
            file_url="http://example.com/test.pdf"
        )
        
        # Assertions
        self.assertEqual(result, "test_file_id")
        
        # Check if file_url was included in the data
        call_args = mock_db.collection.return_value.add.call_args[0][0]
        self.assertEqual(call_args['file_url'], "http://example.com/test.pdf")
        self.assertEqual(call_args['message_type'], "file")

unittest.main()