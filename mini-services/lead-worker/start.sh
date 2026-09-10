#!/bin/bash
# LeadPulse worker start script — keeps the worker running.
cd /home/z/my-project/mini-services/lead-worker
exec bun index.ts
