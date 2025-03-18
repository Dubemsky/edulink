import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter,URLRouter
from myapp.routing import wsPattern

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'brainbox.settings')

http_response_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": http_response_app,
    "websocket": URLRouter(wsPattern),
})


