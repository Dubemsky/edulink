import logging
import requests
import json
import faiss

# Using google colab to host the endpoint online, then connected it to my django app

COLAB_URL = 'https://091d-35-236-227-72.ngrok-free.app'

embedding_dimension = 384
faiss_index = faiss.IndexFlatL2(embedding_dimension)

logger = logging.getLogger(__name__)

def get_remote_embedding(query):
    """Gets embedding from the remote Colab server."""
    try:
        data = {'question': query}
        headers = {'Content-type': 'application/json'}
        response = requests.post(COLAB_URL, data=json.dumps(data), headers=headers)
        response.raise_for_status()
        return response.json()['embedding']
    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to Colab: {e}")
        return None
    except KeyError:
        logger.error("Embedding not found in Colab response.")
        return None
    except json.JSONDecodeError:
        logger.error("Invalid JSON response from Colab.")
        return None