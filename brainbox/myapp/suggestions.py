import numpy as np
from .faiss import *
from .messages import get_messages_by_room

def get_similar_questions_for_room(query, room_id, k=5):
    faiss_index.reset()  # Reset the FAISS index
    
    if not query or not room_id:
        logger.error("Query or room_id is empty.")
        return []

    query_embedding = get_remote_embedding(query)
    if query_embedding is None:
        logger.error(f"Failed to generate embedding for query: {query}")
        return []

    query_vector = np.array([query_embedding], dtype=np.float32)

    room_messages = get_messages_by_room(room_id)
    if not room_messages:
        logger.warning(f"No messages found for room: {room_id}")
        return []

    room_embeddings = []
    for message in room_messages:
        message_embedding = message.get('embedding')
        if message_embedding is not None:
            room_embeddings.append(np.array(message_embedding, dtype=np.float32))
        else:
            logger.debug(f"Message with ID {message.get('message_id')} has no embedding, skipping.")

    if not room_embeddings:
        logger.warning(f"No valid embeddings found for messages in room: {room_id}")
        return []

    room_embeddings = np.array(room_embeddings, dtype=np.float32)

    try:
        faiss_index.add(room_embeddings)
    except Exception as e:
        logger.error(f"Error adding embeddings to FAISS index: {str(e)}")
        return []

    try:
        distances, indices = faiss_index.search(query_vector, k)
        if indices.size == 0 or np.any(indices == -1):
            logger.warning(f"Invalid indices found for query: {query} in room: {room_id}")
            return []

        similar_questions = []
        for idx in indices[0]:
            if 0 <= idx < len(room_messages):
                similar_question = room_messages[idx]
                similar_questions.append({
                    'message_id': similar_question.get('message_id'),
                    'question': similar_question['content']
                })

        logger.info(f"Found {len(similar_questions)} similar questions for query: {query}")
        return similar_questions

    except Exception as e:
        logger.error(f"Error during FAISS search for query: {query} in room: {room_id} - {str(e)}")
        return []