import logging
import requests
import json
import faiss

COLAB_URL = 'https://5f34-34-138-128-86.ngrok-free.app/get_embedding' 
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
    except (KeyError, json.JSONDecodeError) as e:
        logger.error(f"Invalid response from Colab: {e}")
        return None