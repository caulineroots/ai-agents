# -*- coding: utf-8 -*-
"""
Google Maps business lead scraper — Selenium-based extraction for local Windows / Colab.
"""

from __future__ import annotations

import os
import random
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

LogFn = Callable[[str], None]


@dataclass
class CityTarget:
    state_code: str
    city_name: str
    parent_city: Optional[str] = None

LISTING_SELECTORS = (
    "div.Nv2PK",
    "div.THOPZb",
    "div[role='article']",
    "a[href*='/maps/place/']",
)

COOKIE_BUTTON_XPATHS = (
    "//button[contains(., 'Aceitar tudo')]",
    "//button[contains(., 'Accept all')]",
    "//button[contains(., 'Aceitar')]",
    "//button[contains(., 'Accept')]",
)


def _default_log(msg: str) -> None:
    print(msg)


def setup_driver(headless: Optional[bool] = None) -> webdriver.Chrome:
    """Configure Chrome for local Windows or Google Colab."""
    if headless is None:
        headless = os.environ.get("HEADLESS_MAPS", "false").lower() in ("1", "true", "yes")

    chrome_options = Options()
    if headless:
        chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)

    colab_chromium = Path("/usr/bin/chromium-browser")
    if os.environ.get("COLAB_RELEASE_TAG") or colab_chromium.exists():
        chrome_options.binary_location = str(colab_chromium)

    driver = webdriver.Chrome(options=chrome_options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver


def accept_cookies(driver: webdriver.Chrome) -> None:
    for xpath in COOKIE_BUTTON_XPATHS:
        try:
            btn = WebDriverWait(driver, 3).until(
                EC.element_to_be_clickable((By.XPATH, xpath))
            )
            btn.click()
            time.sleep(0.5)
            return
        except Exception:
            continue


def search_businesses(
    driver: webdriver.Chrome,
    location: str,
    keyword: str = "clinic",
    log: LogFn = _default_log,
) -> bool:
    """Open Maps search results for location. Returns False if no results feed loads."""
    query = f"{keyword} {location}".strip()
    encoded = query.replace(" ", "+")
    driver.get(f"https://www.google.com/maps/search/{encoded}")
    accept_cookies(driver)
    log(f"Buscando: {query}")

    feed_selector = "div[role='feed'], div.Nv2PK, a[href*='/maps/place/']"

    try:
        WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, feed_selector))
        )
        time.sleep(random.uniform(2.0, 4.0))
        return True
    except TimeoutException:
        pass

    try:
        driver.get("https://www.google.com/maps")
        accept_cookies(driver)
        search_box = WebDriverWait(driver, 12).until(
            EC.presence_of_element_located((By.ID, "searchboxinput"))
        )
        search_box.clear()
        search_box.send_keys(query)
        search_box.send_keys(Keys.ENTER)
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, feed_selector))
        )
        time.sleep(random.uniform(2.0, 4.0))
        return True
    except TimeoutException:
        log(f"Sem resultados no Maps para: {query}")
        return False
    except Exception as e:
        log(f"Falha ao buscar {query}: {e}")
        return False


def scroll_results_panel(driver: webdriver.Chrome) -> bool:
    selectors = [
        "div[role='feed']",
        "div[aria-label*='Results for']",
        "div.m6QErb[aria-label]",
        "div.section-layout",
        ".section-scrollbox",
    ]
    for selector in selectors:
        try:
            panel = WebDriverWait(driver, 2).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            driver.execute_script(
                "arguments[0].scrollTop = arguments[0].scrollTop + arguments[0].offsetHeight;",
                panel,
            )
            time.sleep(1.0)
            return True
        except Exception:
            continue

    try:
        driver.execute_script("""
            const divs = document.querySelectorAll('div');
            for (const d of divs) {
                if (d.scrollHeight > d.clientHeight * 1.5) {
                    d.scrollTop = d.scrollTop + d.clientHeight;
                    break;
                }
            }
        """)
        return True
    except Exception:
        return False


def _normalize_place_url(href: str) -> str:
    if not href:
        return ""
    href = href.split("?")[0].rstrip("/")
    return href


def _listing_key(element, driver: webdriver.Chrome) -> str:
    try:
        link = element.find_element(By.CSS_SELECTOR, "a[href*='/maps/place/']")
        return _normalize_place_url(link.get_attribute("href") or "")
    except Exception:
        pass
    try:
        if element.tag_name.lower() == "a":
            return _normalize_place_url(element.get_attribute("href") or "")
    except Exception:
        pass
    text = (element.text or "").strip()
    if text:
        return text[:120]
    return str(id(element))


def _find_listings(driver: webdriver.Chrome) -> list:
    seen: set[str] = set()
    elements: list = []
    for selector in LISTING_SELECTORS:
        for el in driver.find_elements(By.CSS_SELECTOR, selector):
            key = _listing_key(el, driver)
            if not key or key in seen:
                continue
            seen.add(key)
            elements.append(el)
    return elements


def _click_listing(driver: webdriver.Chrome, element) -> bool:
    try:
        element.click()
        return True
    except Exception:
        try:
            driver.execute_script("arguments[0].click();", element)
            return True
        except Exception:
            return False


def _extract_name(driver: webdriver.Chrome) -> Optional[str]:
    selectors = ["h1.DUwDvf", "h1.fontHeadlineLarge", "h1"]
    for sel in selectors:
        try:
            el = WebDriverWait(driver, 3).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, sel))
            )
            text = (el.text or "").strip()
            if text:
                return text
        except Exception:
            continue
    return None


def _extract_phone(driver: webdriver.Chrome) -> Optional[str]:
    try:
        el = driver.find_element(By.CSS_SELECTOR, "button[data-tooltip='Copy phone number']")
        label = el.get_attribute("aria-label") or ""
        return re.sub(r"^Phone:\s*", "", label).strip() or None
    except Exception:
        pass
    try:
        el = driver.find_element(By.CSS_SELECTOR, "button[data-item-id^='phone:tel']")
        raw = el.get_attribute("data-item-id") or ""
        return raw.replace("phone:tel:", "").strip() or None
    except Exception:
        pass
    return None


def _extract_email(driver: webdriver.Chrome) -> Optional[str]:
    try:
        for el in driver.find_elements(By.CSS_SELECTOR, "a[href^='mailto:']"):
            href = el.get_attribute("href") or ""
            email = href.replace("mailto:", "").split("?")[0].strip()
            if email:
                return email
    except Exception:
        pass
    return None


def _extract_website(driver: webdriver.Chrome) -> Optional[str]:
    selectors = [
        "a[data-item-id='authority']",
        "a[data-tooltip='Open website']",
        "a[aria-label*='website']",
        "a[aria-label*='site']",
    ]
    for sel in selectors:
        try:
            el = WebDriverWait(driver, 2).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, sel))
            )
            href = el.get_attribute("href")
            if href and "google" not in href.lower():
                return href
        except Exception:
            continue
    return None


def _extract_maps_url(driver: webdriver.Chrome) -> Optional[str]:
    try:
        url = driver.current_url or ""
        if "/maps/place/" in url:
            return _normalize_place_url(url)
    except Exception:
        pass
    return None


def _read_side_panel(driver: webdriver.Chrome) -> dict:
    time.sleep(random.uniform(1.0, 2.0))
    return {
        "name": _extract_name(driver),
        "phone": _extract_phone(driver),
        "email": _extract_email(driver),
        "website": _extract_website(driver),
        "maps_url": _extract_maps_url(driver),
    }


def extract_business_data(
    driver: webdriver.Chrome,
    num_businesses: int = 20,
    search_location: str = "",
    log: LogFn = _default_log,
    on_lead: Optional[Callable[[dict], None]] = None,
) -> list[dict]:
    """Extract leads from the current Maps results feed — no driver.back()."""
    businesses: list[dict] = []
    processed_keys: set[str] = set()
    no_progress = 0
    max_no_progress = 6

    while len(businesses) < num_businesses and no_progress < max_no_progress:
        listings = _find_listings(driver)
        log(f"Listagens visíveis: {len(listings)}")

        added_this_round = 0
        for element in listings:
            if len(businesses) >= num_businesses:
                break

            key = _listing_key(element, driver)
            if not key or key in processed_keys:
                continue

            processed_keys.add(key)
            if not _click_listing(driver, element):
                continue

            data = _read_side_panel(driver)
            row = {
                "name": data.get("name"),
                "phone": data.get("phone"),
                "email": data.get("email"),
                "website": data.get("website"),
                "maps_url": data.get("maps_url") or key,
                "search_location": search_location,
            }

            if any(row.get(k) for k in ("name", "phone", "email", "website")):
                businesses.append(row)
                added_this_round += 1
                log(
                    f"Lead: {row.get('name') or '—'} | "
                    f"{row.get('phone') or 'sem telefone'} | "
                    f"{row.get('website') or 'sem site'}"
                )
                if on_lead:
                    on_lead(row)

        if added_this_round > 0:
            no_progress = 0
        else:
            no_progress += 1
            log(f"Sem novos leads ({no_progress}/{max_no_progress}) — rolando feed…")
            scroll_results_panel(driver)
            time.sleep(random.uniform(1.5, 3.0))

    return businesses


def _with_parent_city(location: str, parent_city: Optional[str]) -> str:
    loc = location.strip()
    city = (parent_city or "").strip()
    if not city:
        return loc
    if city.lower() in loc.lower():
        return loc
    return f"{loc} {city}"


def scrape_targets(
    keyword: str,
    targets: list[CityTarget],
    per_city_limit: int = 20,
    log: LogFn = _default_log,
    on_lead: Optional[Callable[[dict], None]] = None,
    on_city_start: Optional[Callable[[int, CityTarget, str], None]] = None,
    on_city_done: Optional[Callable[[CityTarget, int, str], None]] = None,
    headless: Optional[bool] = None,
) -> list[dict]:
    """Run scrape across city targets; returns deduplicated leads."""
    driver = setup_driver(headless=headless)
    all_businesses: list[dict] = []
    seen_global: set[str] = set()

    try:
        for i, target in enumerate(targets):
            loc = _with_parent_city(target.city_name, target.parent_city)

            if on_city_start:
                on_city_start(i, target, loc)

            log(f"[{i + 1}/{len(targets)}] {target.state_code.upper()} — {target.city_name} → {loc}")

            try:
                if not search_businesses(driver, loc, keyword, log=log):
                    if on_city_done:
                        on_city_done(target, 0, loc)
                    log(f"Pulando {target.city_name} — sem listagem no Maps")
                    continue

                city_leads = extract_business_data(
                    driver,
                    num_businesses=per_city_limit,
                    search_location=loc,
                    log=log,
                    on_lead=on_lead,
                )
            except Exception as e:
                err = str(e).split("Stacktrace:")[0].strip() or str(e)
                log(f"Erro em {target.city_name}: {err[:200]}")
                continue

            for item in city_leads:
                unique = item.get("maps_url") or item.get("website") or item.get("name")
                if unique and unique not in seen_global:
                    seen_global.add(unique)
                    all_businesses.append(item)

            if on_city_done:
                on_city_done(target, len(city_leads), loc)

            log(f"Total acumulado: {len(all_businesses)} leads únicos")

            if i < len(targets) - 1:
                pause = random.uniform(2.0, 5.0)
                log(f"Pausa {pause:.1f}s antes do próximo município…")
                time.sleep(pause)
    finally:
        driver.quit()

    return all_businesses


def scrape_locations(
    keyword: str,
    locations: list[str],
    per_city_limit: int = 20,
    parent_city: Optional[str] = None,
    log: LogFn = _default_log,
    on_lead: Optional[Callable[[dict], None]] = None,
    on_city_start: Optional[Callable[[int, str], None]] = None,
    headless: Optional[bool] = None,
) -> list[dict]:
    """Legacy wrapper — plain city names without state tracking."""
    targets = [
        CityTarget(state_code="", city_name=loc.strip(), parent_city=parent_city)
        for loc in locations
        if loc.strip()
    ]

    def _city_start(i: int, target: CityTarget, loc: str) -> None:
        if on_city_start:
            on_city_start(i, loc)

    return scrape_targets(
        keyword=keyword,
        targets=targets,
        per_city_limit=per_city_limit,
        log=log,
        on_lead=on_lead,
        on_city_start=_city_start if on_city_start else None,
        headless=headless,
    )


def probe_driver(headless: Optional[bool] = None) -> bool:
    """Quick health check — opens and closes Chrome."""
    driver = setup_driver(headless=headless)
    try:
        driver.get("https://www.google.com/maps")
        time.sleep(2)
        return "maps" in (driver.current_url or "").lower()
    finally:
        driver.quit()
