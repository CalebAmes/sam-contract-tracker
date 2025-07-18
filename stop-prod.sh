#!/bin/bash

# Kill the frontend and backend tmux sessions
tmux kill-session -t frontend-prod 2>/dev/null
tmux kill-session -t backend-prod 2>/dev/null

echo "Frontend and backend production tmux sessions stopped."