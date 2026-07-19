"""
Shared slowapi Limiter instance.

Lives in its own module (rather than on main.py) so routers can import it
without creating a circular import: main.py imports the routers, so the
routers can't import the limiter back from main.py.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
