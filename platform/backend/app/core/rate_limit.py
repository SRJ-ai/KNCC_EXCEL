"""
KNCC Platform — Rate Limiting & Account Lockout (Rule 2)

Uses an in-memory store (collections.defaultdict) suitable for single-process
deployments. For multi-instance / serverless deployments, swap
`_store` for an Upstash Redis client. The interface is identical.

Thresholds (configurable via env vars):
  KNCC_MAX_ATTEMPTS_PER_IP   = 10  (requests/minute per IP)
  KNCC_MAX_ATTEMPTS_PER_ACC  = 5   (failed logins before lockout)
  KNCC_LOCKOUT_SECONDS       = 900 (15 minutes)
  KNCC_PROGRESSIVE_DELAYS    = 0,1,2,5,15,30  (seconds, indexed by attempt #)
"""

import asyncio
import os
import time
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List

logger = logging.getLogger(__name__)

MAX_IP_PER_MINUTE = int(os.getenv("KNCC_MAX_ATTEMPTS_PER_IP", "10"))
MAX_ACCOUNT_FAILS = int(os.getenv("KNCC_MAX_ATTEMPTS_PER_ACC", "5"))
LOCKOUT_SECONDS = int(os.getenv("KNCC_LOCKOUT_SECONDS", "900"))
PROGRESSIVE_DELAYS = [0, 1, 2, 5, 15, 30]


@dataclass
class _IPBucket:
    timestamps: List[float] = field(default_factory=list)


@dataclass
class _AccountRecord:
    fail_count: int = 0
    locked_until: float = 0.0


# In-memory stores — swap for Redis client if running multi-process
_ip_buckets: Dict[str, _IPBucket] = defaultdict(_IPBucket)
_account_records: Dict[str, _AccountRecord] = defaultdict(_AccountRecord)


# --------------------------------------------------------------------------- #
# IP-level rate limiting                                                        #
# --------------------------------------------------------------------------- #

def check_ip_rate_limit(ip: str) -> None:
    """Raises RuntimeError if this IP exceeds MAX_IP_PER_MINUTE."""
    now = time.time()
    bucket = _ip_buckets[ip]
    # Keep only timestamps within the last 60 seconds
    bucket.timestamps = [t for t in bucket.timestamps if now - t < 60]
    if len(bucket.timestamps) >= MAX_IP_PER_MINUTE:
        logger.warning("Rate limit exceeded for IP %s", ip)
        raise RateLimitError()
    bucket.timestamps.append(now)


# --------------------------------------------------------------------------- #
# Account-level lockout                                                         #
# --------------------------------------------------------------------------- #

def check_account_lockout(email: str) -> None:
    """Raises AccountLockedError if the account is currently locked."""
    rec = _account_records[email]
    if rec.locked_until > time.time():
        raise AccountLockedError()


def record_failed_attempt(email: str) -> int:
    """Increment fail counter; lock account if threshold reached.
    Returns the current fail count (used to pick a progressive delay)."""
    rec = _account_records[email]
    rec.fail_count += 1
    if rec.fail_count >= MAX_ACCOUNT_FAILS:
        rec.locked_until = time.time() + LOCKOUT_SECONDS
        logger.warning(
            "Account locked for %s after %d failed attempts.", email, rec.fail_count
        )
    return rec.fail_count


def clear_failed_attempts(email: str) -> None:
    """Reset counter on successful login."""
    _account_records[email] = _AccountRecord()


def get_progressive_delay(fail_count: int) -> float:
    """Return the delay in seconds for this failure number."""
    idx = min(fail_count, len(PROGRESSIVE_DELAYS) - 1)
    return float(PROGRESSIVE_DELAYS[idx])


async def apply_progressive_delay(fail_count: int) -> None:
    """Async sleep for the progressive delay without blocking the event loop."""
    delay = get_progressive_delay(fail_count)
    if delay > 0:
        await asyncio.sleep(delay)


# --------------------------------------------------------------------------- #
# Custom exceptions (caught in the auth router)                                 #
# --------------------------------------------------------------------------- #

class RateLimitError(Exception):
    pass


class AccountLockedError(Exception):
    pass
