# -*- coding: utf-8 -*-
"""
ai_client.py — chama Claude com imagem + prompt e faz parse resiliente do JSON.
"""

import re
import json
import logging
from pathlib import Path

from config import MODEL

log = logging.getLogger("extractor")


def call_claude_multi(
    prompt: str,
    images_b64: "list[str]",
    api_key: str,
    max_tokens: int = 16000,
) -> tuple[str, int, int, float]:
    """
    Envia prompt com múltiplas imagens (1–3) para Claude.
    Retorna (raw_text, tokens_input, tokens_output, custo_usd).
    """
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)

    content: list = []
    for img in images_b64:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": img},
        })
    content.append({"type": "text", "text": prompt})

    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": content}],
    )

    raw_text   = response.content[0].text
    tokens_in  = response.usage.input_tokens
    tokens_out = response.usage.output_tokens
    custo      = tokens_in * 3 / 1_000_000 + tokens_out * 15 / 1_000_000
    log.info("  [multi] %d imgs | tokens: in=%d out=%d custo=$%.4f",
             len(images_b64), tokens_in, tokens_out, custo)
    return raw_text, tokens_in, tokens_out, custo


def call_claude(
    prompt: str,
    img_b64: "str | None",
    api_key: str,
    max_tokens: int = 16000,
) -> tuple[str, int, int, float]:
    """
    Envia prompt (com imagem opcional) para Claude.
    Retorna (raw_text, tokens_input, tokens_output, custo_usd).
    """
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)

    if img_b64:
        content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64},
            },
            {"type": "text", "text": prompt},
        ]
    else:
        content = [{"type": "text", "text": prompt}]

    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": content}],
    )

    raw_text   = response.content[0].text
    tokens_in  = response.usage.input_tokens
    tokens_out = response.usage.output_tokens
    custo      = tokens_in * 3 / 1_000_000 + tokens_out * 15 / 1_000_000
    log.info("  Tokens: in=%d out=%d custo=$%.4f", tokens_in, tokens_out, custo)
    return raw_text, tokens_in, tokens_out, custo


def parse_ai_json(raw_text: str, save_path: Path | None = None) -> dict:
    """
    Parse resiliente em 4 tentativas. Salva resposta raw em save_path quando fornecido.
    Levanta ValueError se todas as tentativas falharem.
    """
    if save_path:
        try:
            save_path.write_text(raw_text, encoding="utf-8")
            log.info("  Raw response salvo em: %s", save_path)
        except Exception as e:
            log.warning("  Nao foi possivel salvar raw response: %s", e)

    parsed = None

    # Tentativa 1: bloco ```json ... ```
    m = re.search(r"```(?:json)?\s*(.*?)```", raw_text, re.DOTALL)
    if m:
        try:
            parsed = json.loads(m.group(1).strip())
        except Exception:
            pass

    # Tentativa 2: primeiro { até o último }
    if not parsed:
        start = raw_text.find("{")
        end   = raw_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                parsed = json.loads(raw_text[start:end + 1])
            except Exception:
                pass

    # Tentativa 3: json.loads direto
    if not parsed:
        try:
            parsed = json.loads(raw_text.strip())
        except Exception:
            pass

    # Tentativa 4: JSON truncado — descarta último item incompleto e fecha estrutura
    if not parsed:
        chunk = raw_text[raw_text.find("{"):] if "{" in raw_text else raw_text
        last_complete = chunk.rfind("\n    }")
        if last_complete == -1:
            last_complete = chunk.rfind("},")
        if last_complete != -1:
            truncated = chunk[:last_complete + 6]
            opens  = truncated.count("{") - truncated.count("}")
            arrays = truncated.count("[") - truncated.count("]")
            candidate = truncated + ("]" * max(arrays, 0)) + ("}" * max(opens, 0))
            try:
                parsed = json.loads(candidate)
                log.warning("  JSON truncado — recuperados %d itens completos", len(parsed.get("itens", [])))
            except Exception:
                pass

        if not parsed:
            opens  = chunk.count("{") - chunk.count("}")
            arrays = chunk.count("[") - chunk.count("]")
            candidate = chunk + ("]" * max(arrays, 0)) + ("}" * max(opens, 0))
            try:
                parsed = json.loads(candidate)
                log.warning("  JSON reconstruido por contagem de chaves")
            except Exception:
                pass

    if not parsed:
        raise ValueError(
            f"Falha ao parsear resposta da IA (raw salvo): {raw_text[:300]}"
        )

    return parsed
