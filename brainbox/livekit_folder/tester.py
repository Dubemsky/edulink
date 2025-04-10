# test_livekit.py
import livekit
import sys
import inspect

print("Python version:", sys.version)
print("LiveKit package path:", livekit.__file__)
print("LiveKit modules:", dir(livekit))

# Check if 'api' is in the module
if hasattr(livekit, 'api'):
    print("\nlivekit.api modules:", dir(livekit.api))
    
    # Try to find relevant classes
    for name in dir(livekit.api):
        obj = getattr(livekit.api, name)
        if inspect.isclass(obj) or inspect.ismodule(obj):
            print(f"- {name}: {type(obj).__name__}")
            
            # If it's a module, check its contents too
            if inspect.ismodule(obj):
                print(f"  Contents: {dir(obj)}")
else:
    print("No 'api' module found in livekit package")
    
    # Check top-level modules
    for name in dir(livekit):
        obj = getattr(livekit, name)
        if inspect.isclass(obj) or inspect.ismodule(obj):
            print(f"- {name}: {type(obj).__name__}")