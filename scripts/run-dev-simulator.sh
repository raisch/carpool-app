#!/usr/bin/env bash
set -u

app_pid=
simulator_pid=

cleanup() {
  trap - INT TERM EXIT

  [[ -n "${simulator_pid}" ]] && kill "${simulator_pid}" 2>/dev/null || true
  [[ -n "${app_pid}" ]] && kill "${app_pid}" 2>/dev/null || true

  wait "${simulator_pid}" 2>/dev/null || true
  wait "${app_pid}" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

pnpm dev &
app_pid=$!

node --env-file=.env wordpress/simulator/server.mjs &
simulator_pid=$!

exit_code=0
while :; do
	if ! kill -0 "${app_pid}" 2>/dev/null; then
		wait "${app_pid}" 2>/dev/null || exit_code=$?
		break
	fi
	if ! kill -0 "${simulator_pid}" 2>/dev/null; then
		wait "${simulator_pid}" 2>/dev/null || exit_code=$?
		break
	fi
	sleep 1
done

cleanup
exit "${exit_code}"
