# -*- coding: utf-8 -*-
"""
image_processor.py — compressão de imagens para envio à API Anthropic.
"""

import io
import logging

log = logging.getLogger("extractor")

# ~7.4 MB raw → ~9.9 MB base64 (Anthropic aceita até 10 MB base64)
BASE64_LIMIT = 9_900_000


def compress_to_jpeg(data: bytes) -> bytes:
    """
    Converte para JPEG somente se necessário:
    - JPEG pequeno o suficiente: retorna sem re-encodar.
    - PNG/WEBP ou acima do limite: comprime com qualidade decrescente.
    """
    from PIL import Image as PILImage

    PILImage.MAX_IMAGE_PIXELS = None

    if data[:3] == b"\xff\xd8\xff" and len(data) * 4 // 3 < BASE64_LIMIT:
        img_check = PILImage.open(io.BytesIO(data))
        w, h = img_check.size
        if max(w, h) <= 8000:
            log.info("  Imagem JPEG já dentro do limite (%dKB), sem re-encode", len(data) // 1024)
            return data

    img = PILImage.open(io.BytesIO(data)).convert("RGB")
    w, h = img.size
    MAX_DIM = 8000
    if max(w, h) > MAX_DIM:
        scale = MAX_DIM / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), PILImage.LANCZOS)

    for quality in (85, 75, 65, 50):
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        result = buf.getvalue()
        if len(result) * 4 // 3 < BASE64_LIMIT:
            return result

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=40)
    return buf.getvalue()
