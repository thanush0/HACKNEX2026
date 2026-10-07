from contextlib import contextmanager
from time import perf_counter


@contextmanager
def elapsed():
    start = perf_counter()
    box = {}
    try:
        yield box
    finally:
        box["seconds"] = perf_counter() - start
