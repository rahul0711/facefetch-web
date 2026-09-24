"""Face-fetching: find every photo in a folder that contains a given face.

Reuses the attendance system's SCRFD detector, shared alignment, and AdaFace
embedder (app/attendance/) so gallery faces and selfie queries land in the
same embedding space.
"""
