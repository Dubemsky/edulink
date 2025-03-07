class MessagesRouter:
    def db_for_read(self, model, **hints):
        if model._meta.app_label == 'myapp':
            return 'default'  # Use the SQLite database for read operations
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label == 'myapp':
            return 'default'  # Use the SQLite database for write operations
        return None
