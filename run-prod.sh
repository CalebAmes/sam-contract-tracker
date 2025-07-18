#!/bin/bash

# Start frontend in a tmux session
tmux new-session -d -s frontend-prod 'cd frontend && npm run prod'

# Start backend in a tmux session
tmux new-session -d -s backend-prod 'cd backend && npm run start'

echo "Frontend and backend production servers started in tmux sessions."