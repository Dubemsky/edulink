from channels.generic.websocket import AsyncWebsocketConsumer

class DirectChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
